import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 2026-08-19 порт шилжилт: Vite-ийн автомат сонголт (5173 эзэмшигдсэн бол
  // 5174, 5175... руу чимээгүй шилждэг) дээр найдахгүй, ТОДОРХОЙ порт
  // тавьсан — apps/api/src/main.ts-ийн enableCors()/order-events.gateway.ts
  // хатуу заасан origin яг ЭНЭ порттой таарах ёстой тул (эс бөгөөс бүх
  // хүсэлт чимээгүй CORS-оор block хийгддэг, CLAUDE.md-ийн Phase 2
  // Playwright тэмдэглэлийг үз). strictPort: true — өөр процесс 5273-г
  // эзэлсэн бол чимээгүй өөр порт руу шилжихийн оронд ЯВАГДАХГҮЙ, тодорхой
  // алдаа өгнө (мөргөлдөөнийг нуухгүй).
  server: {
    port: 5273,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
