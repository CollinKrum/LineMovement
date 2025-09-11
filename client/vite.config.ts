import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'client',                       // where index.html lives
  plugins: [react()],
  build: {
    outDir: '../dist/client',           // build to root/dist/client
    emptyOutDir: false                  // don't wipe the server bundle
  },
})
