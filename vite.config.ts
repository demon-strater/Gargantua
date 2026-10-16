import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 상대 경로로 빌드해야 GitHub Pages의 하위 경로(/astra-lab/)에서도 그대로 동작합니다.
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 8010 },
  preview: { host: '127.0.0.1', port: 8010 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
})
