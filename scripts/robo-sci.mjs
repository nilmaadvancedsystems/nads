#!/usr/bin/env node
// As APIs da SCI no robô (24/11/2026: "monta o nads para suportar completamente a integracao do sci"). O robô (robo/,
// CommonJS) usa a mesma regra que os testes conferem, sem copiar: este script junta num arquivo só o que está em
// packages/core/src/sci/integracao (config/sci, Integra NET, publicação no SCI Report) e o cliente do SCI Report
// (areaCliente/sciReport*.ts). Sai em robo/gerado/sci.js, que vai para o repositório (a VM só faz git pull).
//
//   node scripts/robo-sci.mjs              gera de novo
//   node scripts/robo-sci.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'sci.js');
const ENTRADA = '\0sci-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = [
  'export { criarClienteSciReport, ErroDoSci } from ' + caminho('packages/core/src/areaCliente/sciReportCliente.ts') + ';',
  'export { janelaDoSci } from ' + caminho('packages/core/src/areaCliente/sciReport.ts') + ';',
  'export * from ' + caminho('packages/core/src/sci/integracao/index.ts') + ';',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-sci.mjs a partir de packages/core/src/sci/integracao e areaCliente/sciReport*.ts.',
  '// Mudou alguma dessas fontes? Rode `node scripts/robo-sci.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    platform: 'node',
    logLevel: 'warn',
    plugins: [{ name: 'entrada-do-robo', resolveId: id => (id === ENTRADA ? id : null), load: id => (id === ENTRADA ? codigo : null) }],
  });
  // sem minificar: fica legível para quem conferir o que o robô faz
  const { output } = await pacote.generate({ format: 'cjs', codeSplitting: false, minify: false, comments: false });
  await pacote.close();
  if (output.length !== 1) throw new Error('o pacote saiu em ' + output.length + ' arquivos (esperava 1)');
  return AVISO + output[0].code.replace(/\r\n/g, '\n');
}

const conteudo = await gerar();
if (process.argv.includes('--conferir')) {
  let atual = '';
  try { atual = readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n'); } catch { /* não existe: velho */ }
  if (atual !== conteudo) {
    console.error('robo/gerado/sci.js está velho em relação ao core: rode `node scripts/robo-sci.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/sci.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/sci.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
