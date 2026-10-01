import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// versao.json ao lado do site: a página aberta confere de tempos em tempos e, se saiu versão nova,
// avisa para atualizar (AvisoDeVersaoNova, no @nads/ui). Assim uma aba aberta antes da publicação
// não fica rodando o código velho sem ninguém saber.
function versaoDoSite(): Plugin {
  return {
    name: 'nads-versao',
    apply: 'build',
    generateBundle() {
      const texto = fs.readFileSync(path.resolve(__dirname, 'src/versao.ts'), 'utf8');
      const versao = /VERSAO_SISTEMA = '([^']+)'/.exec(texto)?.[1] || '';
      this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao }) });
    },
  };
}

// base '/': as rotas são caminhos de verdade (ex.: /901/movimento/relatorio), então os
// arquivos precisam ser referenciados a partir da raiz do site, não do caminho da página.
export default defineConfig({
  plugins: [react(), versaoDoSite()],
  base: '/',
  server: { port: 5178 },
});
