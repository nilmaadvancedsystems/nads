#!/usr/bin/env node
// As cartas do Fiscal no robô (12/11/2026: a Carta de balanço e o Checklist mensal). O robô (robo/, CommonJS) precisa dos
// mesmos textos e datas do core (cartasFiscal) e do mesmo PDF que o "Ver a carta" do nads desenha — sem copiar. Este script
// junta num arquivo só, em CommonJS, o core e o desenharCartaDeBalanco de cartaDeBalancoPdf.ts, com o pdf-lib dentro. Sai
// em robo/gerado/cartas.js, que vai para o repositório (a VM só faz git pull). O mesmo jeito do scripts/robo-danfse.mjs.
//
//   node scripts/robo-cartas.mjs              gera de novo
//   node scripts/robo-cartas.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'cartas.js');
const ENTRADA = '\0cartas-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = [
  'export * from ' + caminho('packages/core/src/cartasFiscal/index.ts') + ';',
  'export { desenharCartaDeBalanco, horaDoSelo, TAMANHO_DA_ASSINATURA, BYTE_RANGE_EM_BRANCO } from ' + caminho('apps/web/src/aplicativos/tarefas/telas/fiscal/cartas/cartaDeBalancoPdf.ts') + ';',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-cartas.mjs a partir de packages/core/src/cartasFiscal/index.ts e',
  '// apps/web/src/aplicativos/tarefas/telas/fiscal/cartas/cartaDeBalancoPdf.ts (com o pdf-lib dentro).',
  '// Mudou alguma dessas fontes? Rode `node scripts/robo-cartas.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    platform: 'browser',
    logLevel: 'warn',
    plugins: [{ name: 'entrada-do-robo', resolveId: id => (id === ENTRADA ? id : null), load: id => (id === ENTRADA ? codigo : null) }],
  });
  const { output } = await pacote.generate({ format: 'cjs', codeSplitting: false, minify: true, comments: false });
  await pacote.close();
  if (output.length !== 1) throw new Error('o pacote saiu em ' + output.length + ' arquivos (esperava 1)');
  return AVISO + output[0].code.replace(/\r\n/g, '\n');
}

const conteudo = await gerar();
if (process.argv.includes('--conferir')) {
  let atual = '';
  try { atual = readFileSync(SAIDA, 'utf8').replace(/\r\n/g, '\n'); } catch { /* não existe: velho */ }
  if (atual !== conteudo) {
    console.error('robo/gerado/cartas.js está velho em relação ao core e ao cartaDeBalancoPdf.ts: rode `node scripts/robo-cartas.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/cartas.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/cartas.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
