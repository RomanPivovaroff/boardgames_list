// Скачивает опубликованный CSV из Google Sheets и превращает в public/games.json
import Papa from 'papaparse'
import { writeFileSync, existsSync } from 'node:fs'

const url = process.env.SHEET_CSV_URL
if (!url) {
  if (existsSync('public/games.json')) { console.log('SHEET_CSV_URL не задан, оставляю games.json'); process.exit(0) }
  console.error('Задайте SHEET_CSV_URL (ссылка на опубликованный CSV)'); process.exit(1)
}

const csv = await (await fetch(url)).text()
const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })

const get = (row, ...names) => {
  for (const n of names) {
    const k = Object.keys(row).find(k => k.toLowerCase().startsWith(n.toLowerCase()))
    if (k && row[k]?.trim()) return row[k].trim()
  }
  return ''
}
// как get, но из всех подходящих колонок предпочитает значение, начинающееся с http
// (для ссылок: красивая колонка с текстом «Правила» + служебная с URL, или просто URL в одной)
const getHttp = (row, ...names) => {
  const rest = []
  for (const n of names) {
    for (const k of Object.keys(row)) {
      if (!k.toLowerCase().startsWith(n.toLowerCase()) || !row[k]?.trim()) continue
      const v = row[k].trim()
      if (v.toLowerCase().startsWith('http')) return v
      rest.push(v)
    }
  }
  return rest[0] || ''
}
// Обложка: колонок «Коробка…» может быть несколько (со вставленной картинкой и с URL).
// CSV вставленную в ячейку картинку не выгружает (там пусто), поэтому берём значение-ссылку
// из любой колонки с префиксом «Коробка/Картинка»; текст вроде «ящик 3» ссылкой не считается.
const getImage = row => {
  const v = getHttp(row, 'Коробка', 'Картинка')
  return v.toLowerCase().startsWith('http') ? v : ''
}
const range = s => {
  const m = s.match(/(\d+)\s*[–—-]\s*(\d+)/)
  if (m) return [+m[1], +m[2]]
  const one = s.match(/(\d+)/)
  return one ? [+one[1], s.includes('от') ? null : +one[1]] : [null, null]
}
// Кириллица транслитерируется в латиницу, чтобы ссылки были вида #/g/terraforming-mars
const TRANSLIT = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' }
const slug = s => s.toLowerCase().split('').map(ch => ch in TRANSLIT ? TRANSLIT[ch] : ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const seen = new Set()
const games = data.map(r => {
  const name = get(r, 'Название')
  if (!name) return null
  let id = slug(name), i = 2
  while (seen.has(id)) id = `${slug(name)}-${i++}`
  seen.add(id)
  const [pMin, pMax] = range(get(r, 'Кол-во'))
  const [tMin, tMax] = range(get(r, 'Время партии'))
  return {
    id, name,
    publisher: get(r, 'Издатель'),
    genres: get(r, 'Жанр').split(',').map(s => s.trim()).filter(Boolean),
    difficulty: +get(r, 'Уровень') || null,
    playersMin: pMin, playersMax: pMax ?? pMin,
    timeLabel: get(r, 'Время партии'), timeMin: tMin, timeMax: tMax,
    learn: get(r, 'Время освоения'),
    description: get(r, 'Описание'),
    rulesUrl: getHttp(r, 'Ссылка на правила', 'Правила'),
    gameUrl: getHttp(r, 'Ссылка на игру', 'Игра'),
    image: getImage(r),
    owner: get(r, 'Владелец'),
    parentTitle: get(r, 'Дополнение к', 'Дополнение'),
  }
}).filter(Boolean)

// Дополнения: строка с заполненной «Дополнение к <название базовой игры>» прицепляется к базовой.
// publisher/жанры наследуются от базы, если не заполнены. Родитель не найден — остаётся обычной игрой.
const byId = new Map(games.map(g => [g.id, g]))
for (const g of games) {
  if (!g.parentTitle) continue
  const p = byId.get(slug(g.parentTitle))
  g.parentTitle = undefined
  if (!p || p === g) continue
  g.parentId = p.id
  p.expansions = p.expansions || []
  p.expansions.push(g)
  if (!g.publisher) g.publisher = p.publisher
  if (!g.genres.length) g.genres = [...p.genres]
}
writeFileSync('public/games.json', JSON.stringify(games, null, 1))
console.log(`Игр: ${games.length}`)
