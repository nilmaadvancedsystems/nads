#!/usr/bin/env node
// O extrato do banco pela API no robô (19/11/2026, robo/extrato-pela-api.js). O robô (robo/, CommonJS, roda na VM) usa a
// mesma regra do Financeiro, sem copiar: a leitura da resposta do Sicoob e do CNAB do Efí, a emenda com o extrato manual e
// as importações (packages/core/src/financeiro/extratoPelaApi.ts), o id fixo das linhas e a conta do plano (banco.ts) e o
// slug do Cadastro. Sai em robo/gerado/financeiro.js, que vai para o repositório (a VM só faz git pull). O mesmo jeito do
// scripts/robo-danfse.mjs.
//
//   node scripts/robo-financeiro.mjs              gera de novo
//   node scripts/robo-financeiro.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'financeiro.js');
const ENTRADA = '\0financeiro-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = [
  'export * from ' + caminho('packages/core/src/financeiro/extratoPelaApi.ts') + ';',
  'export { linhasDoExtrato, contaDoPlanoParaOBanco, descricaoDaContaBancaria, EMPRESA_DO_ESCRITORIO } from ' + caminho('packages/core/src/financeiro/banco.ts') + ';',
  'export { slug } from ' + caminho('packages/core/src/formatos/index.ts') + ';',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-financeiro.mjs a partir de packages/core/src/financeiro/{extratoPelaApi,banco}.ts',
  '// e do slug de packages/core/src/formatos. Mudou alguma dessas fontes? Rode `node scripts/robo-financeiro.mjs` e commite este',
  '// arquivo junto.',
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
    console.error('robo/gerado/financeiro.js está velho em relação ao core: rode `node scripts/robo-financeiro.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/financeiro.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/financeiro.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
