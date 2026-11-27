#!/usr/bin/env node
// O WhatsApp do robô pronto para o chip (27/11/2026, robo/whatsapp.js e os envios que o chamam). O robô (robo/, CommonJS,
// roda na VM) usa a mesma regra da tela, sem copiar: as chaves de config/whatsapp, as mensagens, a trava, as respostas e o
// menu do autoatendimento (packages/core/src/robos/whatsappAtendimento.ts) e o mesmoNumero (robos/whatsapp.ts). Sai em
// robo/gerado/whatsapp.js, que vai para o repositório (a VM só faz git pull). O mesmo jeito do scripts/robo-financeiro.mjs.
//
//   node scripts/robo-whatsapp.mjs              gera de novo
//   node scripts/robo-whatsapp.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'whatsapp.js');
const ENTRADA = '\0whatsapp-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

const codigo = [
  'export * from ' + caminho('packages/core/src/robos/whatsappAtendimento.ts') + ';',
  'export { mesmoNumero } from ' + caminho('packages/core/src/robos/whatsapp.ts') + ';',
  // a tarefa para a equipe (27/11/2026): quem vê a tarefa e o nome para achar o responsável
  'export { pessoasDaTarefa } from ' + caminho('packages/core/src/tarefas/regras/delegadas.ts') + ';',
  'export { chaveDoNome } from ' + caminho('packages/core/src/tarefas/regras/insights.ts') + ';',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-whatsapp.mjs a partir de packages/core/src/robos/whatsappAtendimento.ts e do',
  '// mesmoNumero de packages/core/src/robos/whatsapp.ts. Mudou alguma dessas fontes? Rode `node scripts/robo-whatsapp.mjs` e',
  '// commite este arquivo junto.',
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
    console.error('robo/gerado/whatsapp.js está velho em relação ao core: rode `node scripts/robo-whatsapp.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/whatsapp.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/whatsapp.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
