import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { jamoSvgTaggerPlugin } from './tools/jamo-svg/vite-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), jamoSvgTaggerPlugin()],
  server: {
    watch: {
      // Jamo SVG Tagger data is written by its dev API on every save; watching
      // it makes Vite reload the page. Its tools/*.ts sources stay watched.
      ignored: [
        '**/tools/jamo-svg/reviews/**',
        '**/tools/jamo-svg/queue/**',
        '**/tools/jamo-svg/cache/**',
      ],
    },
    open: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/@firebase/') ||
            id.includes('/node_modules/firebase/')
          ) {
            return 'firebase'
          }
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
