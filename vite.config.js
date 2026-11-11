import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// BASE задаётся в GitHub Actions как /<имя-репозитория>/
// __SHEET_CSV_URL__ — ссылка на опубликованный CSV (секрет SHEET_CSV_URL), «запекается» в бандл:
// по ней иконка-синхронизация подтягивает свежие данные прямо в браузере.
// URL публичный (таблица опубликована «для всех в интернете»), секретов внутри нет.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE || '/',
  define: { __SHEET_CSV_URL__: JSON.stringify(process.env.SHEET_CSV_URL || '') },
})
