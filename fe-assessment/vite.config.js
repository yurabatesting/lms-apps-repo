import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/assessment/', // <-- WAJIB DITAMBAHKAN AGAR ASET TIDAK ERROR 404
})