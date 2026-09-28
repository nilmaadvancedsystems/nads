import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base '/': as rotas são caminhos de verdade (ex.: /901/movimento/relatorio), então os
// arquivos precisam ser referenciados a partir da raiz do site, não do caminho da página.
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5178 },
});
