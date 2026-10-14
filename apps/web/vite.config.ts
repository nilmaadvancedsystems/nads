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

// O OCR (Tesseract, src/comum/ocr.ts): o worker, o motor e o português servidos pelo próprio site em /ocr/ (nada vem
// de fora). No build, os arquivos vão para dist/ocr; no npm run dev, saem direto do node_modules.
const ARQUIVOS_DO_OCR: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'por.traineddata.gz': '@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
};
const caminhoDoOcr = (rel: string) => path.resolve(__dirname, '../../node_modules', rel);
function arquivosDoOcr(): Plugin {
  return {
    name: 'nads-ocr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/ocr\/([\w.-]+)$/.exec((req.url || '').split('?')[0]);
        const rel = m && ARQUIVOS_DO_OCR[m[1]];
        if (!rel) { next(); return; }
        res.setHeader('Content-Type', m[1].endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        fs.createReadStream(caminhoDoOcr(rel)).pipe(res);
      });
    },
    generateBundle() {
      for (const [nome, rel] of Object.entries(ARQUIVOS_DO_OCR)) this.emitFile({ type: 'asset', fileName: 'ocr/' + nome, source: fs.readFileSync(caminhoDoOcr(rel)) });
    },
  };
}

// base '/': as rotas são caminhos de verdade (ex.: /901/movimento/relatorio), então os
// arquivos precisam ser referenciados a partir da raiz do site, não do caminho da página.
export default defineConfig({
  plugins: [react(), versaoDoSite(), arquivosDoOcr()],
  base: '/',
  server: { port: 5178 },
});
