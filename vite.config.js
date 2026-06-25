import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Crucial for Electron to resolve assets correctly when loading index.html from file system
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
