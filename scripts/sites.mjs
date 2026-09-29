#!/usr/bin/env node
// Um site (link) por aplicativo, no projeto conferencia-nilma. Cada site é gerado só com o seu
// aplicativo (VITE_APLICATIVO) e com dados de exemplo (--mode exemplos: nada vai para o banco).
// Quem ainda não existe no nads ganha a página "Em construção".
//
//   npm run sites -- conciliadorzinho creditor     publica só esses
//   npm run sites -- todos                          publica os seis
//
// Publica SÓ a hospedagem desses sites (--only hosting:<site>); o nads-nilma não é tocado.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const web = path.join(raiz, 'apps', 'web');

/** id → site do Firebase, nome e se já é um aplicativo do nads (false = "Em construção"). */
const SITES = {
  'concilia-ai': { site: 'concilia-ai-nilma', nome: 'Concilia aí', pronto: true },
  conciliadorzinho: { site: 'conciliadorzinho-nilma', nome: 'Conciliadorzinho', pronto: true },
  'cheque-especial': { site: 'cheque-especial-nilma', nome: 'Cheque especial', pronto: true },
  creditor: { site: 'creditor-nilma', nome: 'Creditor', pronto: true },
  tarefas: { site: 'tarefas-nilma', nome: 'Tarefas', pronto: false },
  extrator: { site: 'extrator-nilma', nome: 'Extrator', pronto: true },
};

const pedidos = process.argv.slice(2);
const ids = pedidos.includes('todos') ? Object.keys(SITES) : pedidos;
const invalidos = ids.filter(id => !SITES[id]);
if (!ids.length || invalidos.length) {
  console.error('sites: diga quais (' + Object.keys(SITES).join(', ') + ') ou "todos".' + (invalidos.length ? ' Não conheço: ' + invalidos.join(', ') : ''));
  process.exit(1);
}

for (const id of ids) {
  const { nome, pronto } = SITES[id];
  const saida = path.join(web, 'dist-sites', id);
  fs.rmSync(saida, { recursive: true, force: true });
  if (pronto) {
    console.log('sites: gerando ' + nome + '…');
    execSync('npx vite build --mode exemplos --outDir ' + JSON.stringify(saida) + ' --emptyOutDir', {
      cwd: web, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, VITE_APLICATIVO: id },
    });
  } else {
    fs.mkdirSync(saida, { recursive: true });
    const html = fs.readFileSync(path.join(web, 'sites', 'em-construcao.html'), 'utf8').split('__NOME__').join(nome);
    fs.writeFileSync(path.join(saida, 'index.html'), html);
  }
}

const alvo = ids.map(id => 'hosting:' + SITES[id].site).join(',');
console.log('sites: publicando ' + alvo);
execSync('firebase deploy --only ' + alvo + ' --project conferencia-nilma', { cwd: web, stdio: 'inherit' });
for (const id of ids) console.log('  ' + SITES[id].nome + ': https://' + SITES[id].site + '.web.app');
