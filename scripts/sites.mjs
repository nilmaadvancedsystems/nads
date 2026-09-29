#!/usr/bin/env node
// Um site (link) por aplicativo, no projeto conferencia-nilma. Cada site é gerado só com o seu
// aplicativo (VITE_APLICATIVO). Por padrão com dados de exemplo (--mode exemplos: nada vai para o
// banco); quem já foi ligado ao banco a pedido do Vitor usa --mode banco (hoje: o Extratudo e a Tarefas).
// Quem ainda não existe no nads ganha a página "Em construção"; os links antigos (que viraram parte
// de outro aplicativo) levam para o novo.
//
//   npm run sites -- extratudo conciliadorzinho     publica só esses
//   npm run sites -- todos                          publica todos
//   npm run sites -- tarefas --canal=exemplos --exemplos
//                                                   prévia com dados de exemplo (link próprio, expira em 7 dias;
//                                                   não mexe no site no ar nem no banco)
//
// Publica SÓ a hospedagem desses sites (--only hosting:<site>); o nads-nilma não é tocado.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const web = path.join(raiz, 'apps', 'web');
const url = site => 'https://' + site + '.web.app';

/**
 * id → site do Firebase e o que vai nele:
 *   app       — o aplicativo do nads (VITE_APLICATIVO=id); banco: true = ligado ao banco
 *   construcao — a página "Em construção"
 *   mudou     — leva para outro aplicativo (o id dele)
 */
const SITES = {
  'concilia-ai': { site: 'concilia-ai-nilma', nome: 'Concilia aí', tipo: 'app' },
  conciliadorzinho: { site: 'conciliadorzinho-nilma', nome: 'Conciliadorzinho', tipo: 'app' },
  extratudo: { site: 'extratudo-nilma', nome: 'Extratudo', tipo: 'app', banco: true },
  tarefas: { site: 'tarefas-nilma', nome: 'Tarefas', tipo: 'app', banco: true },
  // viraram ferramentas do Extratudo
  extrator: { site: 'extrator-nilma', nome: 'Extrator', tipo: 'mudou', para: 'extratudo' },
  'cheque-especial': { site: 'cheque-especial-nilma', nome: 'Cheque especial', tipo: 'mudou', para: 'extratudo' },
  creditor: { site: 'creditor-nilma', nome: 'Creditor', tipo: 'mudou', para: 'extratudo' },
};

const argumentos = process.argv.slice(2);
const canal = (argumentos.find(a => a.startsWith('--canal=')) || '').slice('--canal='.length);
const soExemplos = argumentos.includes('--exemplos');
const pedidos = argumentos.filter(a => !a.startsWith('--'));
const ids = pedidos.includes('todos') ? Object.keys(SITES) : pedidos;
const invalidos = ids.filter(id => !SITES[id]);
if (!ids.length || invalidos.length) {
  console.error('sites: diga quais (' + Object.keys(SITES).join(', ') + ') ou "todos".' + (invalidos.length ? ' Não conheço: ' + invalidos.join(', ') : ''));
  process.exit(1);
}

if (soExemplos && !canal) {
  console.error('sites: --exemplos só com --canal (o site no ar do ' + ids.join(', ') + ' não pode perder o banco).');
  process.exit(1);
}

const pagina = (arquivo, trocas) => Object.entries(trocas).reduce((t, [a, b]) => t.split(a).join(b), fs.readFileSync(path.join(web, 'sites', arquivo), 'utf8'));

for (const id of ids) {
  const s = SITES[id];
  const saida = path.join(web, 'dist-sites', id);
  fs.rmSync(saida, { recursive: true, force: true });
  if (s.tipo === 'app') {
    const banco = s.banco && !soExemplos;
    console.log('sites: gerando ' + s.nome + (banco ? ' (ligado ao banco)' : ' (dados de exemplo)') + '…');
    execSync('npx vite build --mode ' + (banco ? 'banco' : 'exemplos') + ' --outDir ' + JSON.stringify(saida) + ' --emptyOutDir', {
      cwd: web, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, VITE_APLICATIVO: id },
    });
    continue;
  }
  fs.mkdirSync(saida, { recursive: true });
  const html = s.tipo === 'construcao'
    ? pagina('em-construcao.html', { __NOME__: s.nome })
    : pagina('mudou.html', { __NOME__: s.nome, __NOVO__: SITES[s.para].nome, __DESTINO__: url(SITES[s.para].site) });
  fs.writeFileSync(path.join(saida, 'index.html'), html);
}

if (canal) {
  // prévia (canal do Firebase Hosting): um link à parte, que some sozinho; o site no ar não muda
  for (const id of ids) {
    console.log('sites: prévia "' + canal + '" do ' + SITES[id].nome + ' (expira em 7 dias)');
    execSync('firebase hosting:channel:deploy ' + canal + ' --only ' + SITES[id].site + ' --expires 7d --project conferencia-nilma', { cwd: web, stdio: 'inherit' });
  }
  process.exit(0);
}
const alvo = ids.map(id => 'hosting:' + SITES[id].site).join(',');
console.log('sites: publicando ' + alvo);
execSync('firebase deploy --only ' + alvo + ' --project conferencia-nilma', { cwd: web, stdio: 'inherit' });
for (const id of ids) {
  const s = SITES[id];
  console.log('  ' + s.nome + ': ' + url(s.site) + (s.tipo === 'mudou' ? '  → leva para o ' + SITES[s.para].nome : ''));
}
