import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' so the built site also works from a subpath (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 3000 },
})
