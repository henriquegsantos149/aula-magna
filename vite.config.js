import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'ggsr/index.html'),
        matricula: resolve(__dirname, 'ggsr/pagina-de-matricula.html'),
        iama: resolve(__dirname, 'iama/iama.html')
      }
    }
  }
});
