import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Сборка в ОДИН html-файл: работает двойным кликом, без установки и без сервера
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
})
