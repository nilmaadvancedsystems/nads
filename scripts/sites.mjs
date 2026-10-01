#!/usr/bin/env node
// Um site (link) por aplicativo, no projeto conferencia-nilma (e, a pedido do Vitor em 2026-09-29, o
// Extratudo também num site do projeto do Entregas, entregas-2e5e2). Cada site é gerado só com o seu
// aplicativo (VITE_APLICATIVO). O banco não muda com o projeto do site: o Extratudo do Entregas grava no
// mesmo Firestore da Conferência. Por padrão com dados de exemplo (--mode exemplos: nada vai para o
// banco); quem já foi ligado ao banco a pedido do Vitor usa --mode banco (hoje: o Extratudo e a Tarefas).
// Quem ainda não existe no nads ganha a página "Em construção"; os links antigos (que viraram parte
// de outro aplicativo) levam para o novo.
//
//   npm run sites -- extratudo conciliadorzinho     publica só esses
//   npm run sites -- extratudo-entregas             o Extratudo no projeto do Entregas (cria o site na 1ª vez)
//   npm run sites -- todos                          publica todos
//   npm run sites -- tarefas --canal=exemplos --exemplos
//                                                   prévia com dados de exemplo (link próprio, expira em 7 dias;
//                                                   não mexe no site no ar nem no banco)
//
// Publica SÓ a hospedagem desses sites (--only hosting:<site>); o nads-nilma não é tocado, e no projeto do
// Entregas só o site do Extratudo (o site das Pendências, entregas-2e5e2, nunca entra aqui).
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
 * projeto: o projeto do Firebase do site (padrão: conferencia-nilma); aplicativo: qual aplicativo do nads
 * vai nele, quando não é o próprio id
 */
const PROJETO_PADRAO = 'conferencia-nilma';
const SITES = {
  'concilia-ai': { site: 'concilia-ai-nilma', nome: 'Concilia aí', tipo: 'app' },
  // o Concilia aí só para conferir entradas, ligado ao banco da Conferência (Vitor, 01/10/2026): só como prévia (link à parte)
  'conferir-entradas': { site: 'concilia-ai-nilma', nome: 'Concilia aí — Conferir entradas', tipo: 'app', banco: true, aplicativo: 'concilia-ai', env: { VITE_SO_ENTRADAS: '1' }, soCanal: true, pasta: 'concilia-ai' },
  conciliadorzinho: { site: 'conciliadorzinho-nilma', nome: 'Conciliadorzinho', tipo: 'app' },
  extratudo: { site: 'extratudo-nilma', nome: 'Extratudo', tipo: 'app', banco: true },
  tarefas: { site: 'tarefas-nilma', nome: 'Tarefas', tipo: 'app', banco: true },
  'extratudo-entregas': { site: 'extratudo-entregas', nome: 'Extratudo (Entregas)', tipo: 'app', banco: true, aplicativo: 'extratudo', projeto: 'entregas-2e5e2' },
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

const soPrevia = ids.filter(id => SITES[id].soCanal);
if (soPrevia.length && !canal) {
  console.error('sites: ' + soPrevia.join(', ') + ' só sai como prévia (use --canal=<nome>): o site no ar não pode virar ele.');
  process.exit(1);
}
// quanto tempo a prévia fica no ar (--expira=30d; o Firebase aceita até 30 dias)
const expira = (argumentos.find(a => a.startsWith('--expira=')) || '--expira=7d').slice('--expira='.length);

if (soExemplos && !canal) {
  console.error('sites: --exemplos só com --canal (o site no ar do ' + ids.join(', ') + ' não pode perder o banco).');
  process.exit(1);
}

const pagina = (arquivo, trocas) => Object.entries(trocas).reduce((t, [a, b]) => t.split(a).join(b), fs.readFileSync(path.join(web, 'sites', arquivo), 'utf8'));

for (const id of ids) {
  const s = SITES[id];
  // a pasta que o site publica (firebase.json); a prévia de outro aplicativo no mesmo site usa a pasta dele
  const saida = path.join(web, 'dist-sites', s.pasta || id);
  fs.rmSync(saida, { recursive: true, force: true });
  if (s.tipo === 'app') {
    const banco = s.banco && !soExemplos;
    console.log('sites: gerando ' + s.nome + (banco ? ' (ligado ao banco)' : ' (dados de exemplo)') + '…');
    execSync('npx vite build --mode ' + (banco ? 'banco' : 'exemplos') + ' --outDir ' + JSON.stringify(saida) + ' --emptyOutDir', {
      cwd: web, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, VITE_APLICATIVO: s.aplicativo || id, ...(s.env || {}) },
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
    console.log('sites: prévia "' + canal + '" do ' + SITES[id].nome + ' (expira em ' + expira + ')');
    execSync('firebase hosting:channel:deploy ' + canal + ' --only ' + SITES[id].site + ' --expires ' + expira + ' --project ' + (SITES[id].projeto || PROJETO_PADRAO), { cwd: web, stdio: 'inherit' });
  }
  process.exit(0);
}
/** Site de outro projeto: cria na primeira vez (o nome do site é único no Firebase inteiro). */
function garantirSite(projeto, site) {
  if (projeto === PROJETO_PADRAO) return;
  const lista = execSync('firebase hosting:sites:list --json --project ' + projeto, { cwd: web, encoding: 'utf8' });
  if (lista.includes('/sites/' + site + '"')) return;
  console.log('sites: criando o site ' + site + ' no projeto ' + projeto);
  execSync('firebase hosting:sites:create ' + site + ' --project ' + projeto, { cwd: web, stdio: 'inherit' });
}

// um deploy por projeto
const porProjeto = {};
for (const id of ids) (porProjeto[SITES[id].projeto || PROJETO_PADRAO] ||= []).push(id);
for (const [projeto, doProjeto] of Object.entries(porProjeto)) {
  for (const id of doProjeto) garantirSite(projeto, SITES[id].site);
  const alvo = doProjeto.map(id => 'hosting:' + SITES[id].site).join(',');
  console.log('sites: publicando ' + alvo + ' (projeto ' + projeto + ')');
  execSync('firebase deploy --only ' + alvo + ' --project ' + projeto, { cwd: web, stdio: 'inherit' });
}
for (const id of ids) {
  const s = SITES[id];
  console.log('  ' + s.nome + ': ' + url(s.site) + (s.tipo === 'mudou' ? '  → leva para o ' + SITES[s.para].nome : ''));
}
