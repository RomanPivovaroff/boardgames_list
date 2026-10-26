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
    rulesUrl: get(r, 'Ссылка на правила', 'Правила'),
    image: get(r, 'Коробка', 'Картинка'),
  }
}).filter(Boolean)

writeFileSync('public/games.json', JSON.stringify(games, null, 1))
console.log(`Игр: ${games.length}`)
