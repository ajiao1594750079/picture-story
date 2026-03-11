import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/generate-essay': 'http://localhost:8000',
      '/generate-video': 'http://localhost:8000',
      '/tts': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
    }
  }
})
