import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// BASE задаётся в GitHub Actions как /<имя-репозитория>/
export default defineConfig({ plugins: [react()], base: process.env.BASE || '/' })
