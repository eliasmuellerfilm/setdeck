import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WICHTIG: Setze hier deinen GitHub Repository-Namen ein
// Beispiel: wenn dein Repo "mein-filmdispo" heisst -> base: '/mein-filmdispo/'
// Wenn du eine eigene Domain nutzt -> base: '/'
const REPO_NAME = 'filmdispo' // <-- HIER ANPASSEN

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
