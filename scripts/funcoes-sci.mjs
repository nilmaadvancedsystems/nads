#!/usr/bin/env node
// A regra do SCI Report na função do Firebase (24/11/2026: as guias do SCI Report 24h na Área do Cliente). A função
// (funcoes/index.js, ESM, Node 22) precisa do mesmo core que os testes conferem, sem copiar: este script junta num arquivo
// só o que está em packages/core/src/areaCliente/sciReport*.ts. Sai em funcoes/gerado/sciReport.js, que vai para o
// repositório (o firebase deploy sobe a pasta funcoes/ como está). O mesmo empacotador do scripts/robo-danfse.mjs.
//
//   node scripts/funcoes-sci.mjs              gera de novo
//   node scripts/funcoes-sci.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'funcoes', 'gerado', 'sciReport.js');
const ENTRADA = '\0sci-da-funcao';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = [
  'export { criarClienteSciReport, criarAtendimentoDaArea, ErroDoSci } from ' + caminho('packages/core/src/areaCliente/sciReportCliente.ts') + ';',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/funcoes-sci.mjs a partir de packages/core/src/areaCliente/sciReport*.ts.',
  '// Mudou alguma dessas fontes? Rode `node scripts/funcoes-sci.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    platform: 'node',
    logLevel: 'warn',
    plugins: [{ name: 'entrada-da-funcao', resolveId: id => (id === ENTRADA ? id : null), load: id => (id === ENTRADA ? codigo : null) }],
  });
  // sem minificar: a função é pequena e o que sobe para o Google fica legível para quem conferir
  const { output } = await pacote.generate({ format: 'esm', codeSplitting: false, minify: false, comments: false });
  await pacote.close();
  if (output.length !== 1) throw new Error('o pacote saiu em ' + output.length + ' arquivos (esperava 1)');
  return AVISO + output[0].code.replace(/\r\n/g, '\n');
}

const conteudo = await gerar();
if (process.argv.includes('--conferir')) {
  let atual = '';
  try { atual = readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n'); } catch { /* não existe: velho */ }
  if (atual !== conteudo) {
    console.error('funcoes/gerado/sciReport.js está velho em relação ao core: rode `node scripts/funcoes-sci.mjs` e commite.');
    process.exit(1);
  }
  console.log('funcoes/gerado/sciReport.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('funcoes/gerado/sciReport.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
