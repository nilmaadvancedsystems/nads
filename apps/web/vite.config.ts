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

// O site da Área do Cliente (VITE_APLICATIVO=cliente, 17/10/2026) é aberto por quem não é da equipe: o main.tsx recebe
// src/rotasDoCliente.tsx no lugar do src/rotas.tsx, que importa todos os aplicativos. Assim nenhuma tela, rota ou dado
// interno entra no pacote desse site (o rotas.tsx de sempre continua igual para os outros). O OCR também fica de fora.
// E o @nads/core entra como "sem efeito colateral": o site importa o core pelo índice, e os módulos com conta no topo
// (a lista de empresas, a planilha do DP, as rotinas, a equipe de exemplo) entrariam inteiros mesmo sem uso. Com isso,
// só o que a Área do Cliente usa vai junto (o core é TypeScript puro: nenhum módulo dele depende de ser importado à toa).
// O site do admin (VITE_APLICATIVO=admin, 21/10/2026) faz o mesmo com src/rotasDoAdmin.tsx: leva só o site do admin e as
// telas da Tarefas que ele reaproveita (sem o OCR, que nenhuma tela dele usa).
const ROTAS_PROPRIAS: Record<string, string> = { cliente: 'src/rotasDoCliente.tsx', admin: 'src/rotasDoAdmin.tsx' };
const ROTAS_DO_SITE = ROTAS_PROPRIAS[process.env.VITE_APLICATIVO || ''] || '';
function rotasProprias(): Plugin {
  return {
    name: 'nads-rotas-proprias',
    enforce: 'pre',
    resolveId(fonte, quem) {
      if (ROTAS_DO_SITE && fonte === './rotas' && quem && /[\\/]src[\\/]main\.tsx$/.test(quem)) return path.resolve(__dirname, ROTAS_DO_SITE);
      return null;
    },
  };
}

// Os pedaços do site (revisão da UI, 18/10/2026: o pacote inicial era um arquivo só de 4 MB). As telas grandes já vêm à
// parte pelo lazy (comum/pedaco.tsx); aqui:
// - "sem efeito colateral" em todos os sites (antes só no da Área do Cliente, acima): o @nads/core, o xlsx e os logos das
//   bandeiras de cartão do @nads/ui (só dados; o resto do @nads/ui tem efeito no topo e fica como está). Sem isso, o que
//   uma tela importa do índice do core arrasta o core inteiro, e um módulo que só importa o xlsx traz os 470 KB dele;
// - as bibliotecas em arquivos próprios, com nome fixo: mudam pouco, então o navegador guarda de uma publicação para a
//   outra e só baixa de novo o código do nads. O xlsx, o pdf-lib e o node-forge só baixam com a tela que os usa.
const SEM_EFEITO = /[\\/]packages[\\/]core[\\/]src[\\/].*\.ts$|[\\/]packages[\\/]ui[\\/]src[\\/]logosBandeiras\.ts$|[\\/]node_modules[\\/]xlsx[\\/]/;
const SEM_EFEITO_NO_CORE = { moduleSideEffects: (id: string) => !SEM_EFEITO.test(id) };
const npm = (...pacotes: string[]) => new RegExp('[\\\\/]node_modules[\\\\/](' + pacotes.join('|') + ')[\\\\/]');
const BIBLIOTECAS = [
  { name: 'react', test: npm('react', 'react-dom', 'react-router', 'scheduler', 'cookie', 'set-cookie-parser') },
  // o Firestore à parte do resto do Firebase (login, app): juntos passavam de 500 KB
  { name: 'firestore', test: npm('@firebase[\\\\/]firestore', '@firebase[\\\\/]webchannel-wrapper', 're2js', '@grpc') },
  { name: 'firebase', test: npm('firebase', '@firebase', 'idb', 'tslib') },
  { name: 'xlsx', test: npm('xlsx') },
  { name: 'animejs', test: npm('animejs') },
  { name: 'pdf-lib', test: npm('pdf-lib', '@pdf-lib', 'pako') },
  { name: 'node-forge', test: npm('node-forge') },
];

// base '/': as rotas são caminhos de verdade (ex.: /901/movimento/relatorio), então os
// arquivos precisam ser referenciados a partir da raiz do site, não do caminho da página.
export default defineConfig({
  plugins: [react(), versaoDoSite(), ...(ROTAS_DO_SITE ? [rotasProprias()] : [arquivosDoOcr()])],
  build: { rolldownOptions: { treeshake: SEM_EFEITO_NO_CORE, output: { codeSplitting: { groups: BIBLIOTECAS } } } },
  base: '/',
  server: { port: 5178 },
});
