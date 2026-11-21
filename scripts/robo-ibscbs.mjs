#!/usr/bin/env node
// A conferência do IBS/CBS no robô (21/11/2026, robo/sieg-ibscbs.js). O robô do SIEG (robo/, CommonJS, roda no PC do
// servidor) usa a mesma regra do Fiscal, sem copiar: a leitura do grupo IBSCBS da NF-e, o pedido à calculadora da Receita,
// a comparação e o resumo do mês (packages/core/src/tarefas/sieg/ibsCbs.ts). Sai em robo/gerado/ibscbs.js, que vai para o
// repositório (o servidor só faz git pull). O mesmo jeito do scripts/robo-ibscbs.mjs.
//
//   node scripts/robo-ibscbs.mjs              gera de novo
//   node scripts/robo-ibscbs.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'ibscbs.js');
const ENTRADA = '\0ibscbs-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = 'export * from ' + caminho('packages/core/src/tarefas/sieg/ibsCbs.ts') + ';';

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-ibscbs.mjs a partir de packages/core/src/tarefas/sieg/ibsCbs.ts. Mudou a',
  '// fonte? Rode `node scripts/robo-ibscbs.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    platform: 'node',
    logLevel: 'warn',
    plugins: [{ name: 'entrada-do-robo', resolveId: id => (id === ENTRADA ? id : null), load: id => (id === ENTRADA ? codigo : null) }],
  });
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
    console.error('robo/gerado/ibscbs.js está velho em relação ao core: rode `node scripts/robo-ibscbs.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/ibscbs.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/ibscbs.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
