#!/usr/bin/env node
// A DANFSe no robô (15/10/2026: a NFS-e autorizada por e-mail ao cliente). O robô (robo/, CommonJS, roda na VM) precisa do
// mesmo PDF que o botão "Baixar DANFSe" do nads desenha — sem copiar o desenho. Este script junta num arquivo só, em
// CommonJS, o que já existe: o core (nfse.dadosDaDanfse e o texto do e-mail) e o desenharDanfse de danfsePdf.ts, com o
// pdf-lib e o qrcode dentro. Sai em robo/gerado/danfse.js, que vai para o repositório (a VM só faz git pull).
//
// O empacotador é o rolldown que já vem com o Vite 8 (o Vite 8 não usa mais o esbuild; não há dependência nova).
//
//   node scripts/robo-danfse.mjs              gera de novo
//   node scripts/robo-danfse.mjs --conferir   só confere (o npm run verificar chama): falha se o gerado ficou velho
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(raiz, 'robo', 'gerado', 'danfse.js');
const ENTRADA = '\0danfse-do-robo';
const caminho = rel => JSON.stringify(path.join(raiz, rel).split(path.sep).join('/'));

// o que o robô usa: o PDF (bytes) a partir do XML da nota, os dados da DANFSe e o texto do e-mail
const codigo = [
  'import { dadosDaDanfse } from ' + caminho('packages/core/src/nfse/danfse.ts') + ';',
  'import { camposDaNota, configDoEmail, emailValido, mensagemDaNota, EMAIL_PADRAO, AVISO_SEM_VALOR } from ' + caminho('packages/core/src/nfse/email.ts') + ';',
  'import { desenharDanfse } from ' + caminho('apps/web/src/aplicativos/tarefas/telas/financeiro/danfsePdf.ts') + ';',
  'export { dadosDaDanfse, desenharDanfse, camposDaNota, configDoEmail, emailValido, mensagemDaNota, EMAIL_PADRAO, AVISO_SEM_VALOR };',
  '/** O PDF da DANFSe (Uint8Array) a partir do XML da NFS-e autorizada. */',
  'export async function pdfDaDanfse(xml, municipios) { return desenharDanfse(dadosDaDanfse(xml, municipios)); }',
].join('\n');

const AVISO = [
  '// GERADO — NÃO EDITE. Feito por scripts/robo-danfse.mjs a partir de packages/core/src/nfse/{danfse,email}.ts e',
  '// apps/web/src/aplicativos/tarefas/telas/financeiro/danfsePdf.ts (com o pdf-lib e o qrcode dentro).',
  '// Mudou alguma dessas fontes? Rode `node scripts/robo-danfse.mjs` e commite este arquivo junto.',
  '',
].join('\n');

async function gerar() {
  const pacote = await rolldown({
    input: ENTRADA,
    // 'browser': o qrcode sem o pngjs/fs (só o create, puro); o que sai não usa nada do navegador e roda no Node
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
    console.error('robo/gerado/danfse.js está velho em relação ao core e ao danfsePdf.ts: rode `node scripts/robo-danfse.mjs` e commite.');
    process.exit(1);
  }
  console.log('robo/gerado/danfse.js em dia.');
} else {
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, conteudo);
  console.log('robo/gerado/danfse.js gerado (' + Math.round(conteudo.length / 1024) + ' KB).');
}
