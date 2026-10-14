import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Con dominio custom (es. https://benchmark.monaripietro.it/) il sito e' servito
// alla radice: base '/'. Sotto github.io il path sarebbe '/Benchmark/'.
const base = process.env.PAGES_BASE || '/'

export default defineConfig({
  plugins: [react()],
  base,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
