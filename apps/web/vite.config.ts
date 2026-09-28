import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './': o build funciona em qualquer endereço (a cópia é publicada num link próprio).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5178 },
});
