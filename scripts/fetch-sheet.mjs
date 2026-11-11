// Скачивает опубликованный CSV из Google Sheets и превращает в public/games.json
import { writeFileSync, existsSync } from 'node:fs'
import { parseSheetCsv } from '../src/parse-sheet.mjs'

const url = process.env.SHEET_CSV_URL
if (!url) {
  if (existsSync('public/games.json')) { console.log('SHEET_CSV_URL не задан, оставляю games.json'); process.exit(0) }
  console.error('Задайте SHEET_CSV_URL (ссылка на опубликованный CSV)'); process.exit(1)
}

const csv = await (await fetch(url)).text()
const games = parseSheetCsv(csv)
writeFileSync('public/games.json', JSON.stringify(games, null, 1))
console.log(`Игр: ${games.length}`)
