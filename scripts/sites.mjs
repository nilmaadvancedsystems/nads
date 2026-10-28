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
import { Buffer } from 'node:buffer';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const web = path.join(raiz, 'apps', 'web');
const url = site => 'https://' + site + '.web.app';
const SITE_DO_NADS = /^https:\/\/[a-z0-9-]+\.web\.app$/;

// a pasta principal do nads (a cópia limpa de publicar é um worktree: as peças guardadas ficam na principal, a mesma para
// todas; Vitor, 28/10/2026: "corrige isso pra não ficar acontecendo" — publicado de uma cópia, o site perdia as peças antigas)
const principal = (() => {
  try {
    const comum = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: raiz, encoding: 'utf8' }).trim();
    return path.basename(comum) === '.git' ? path.dirname(comum) : raiz;
  } catch { return raiz; }
})();

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
  // o catálogo de componentes de todo o nads (Vitor, 02/10/2026): as mesmas peças do sistema, com dados de exemplo
  componentes: { site: 'componentes-nilma', nome: 'Componentes', tipo: 'app' },
  // a Área do Cliente (Vitor, 16/10/2026): enquanto não tem o site próprio (cliente.nilmacontabilidade.com), só como prévia
  // com dados de exemplo, no site do catálogo (link à parte, expira sozinho)
  'cliente-previa': { site: 'componentes-nilma', nome: 'Área do Cliente (prévia)', tipo: 'app', aplicativo: 'cliente', soCanal: true, pasta: 'componentes' },
  // o site próprio da Área do Cliente (cliente.nilmacontabilidade.com), ligado ao banco do Entregas (17/10/2026): lê só o
  // espelho do link (areasCliente/{token}) e o pacote leva só a Área do Cliente (vite.config.ts, nads-rotas-proprias)
  cliente: { site: 'cliente-nilma', nome: 'Área do Cliente', tipo: 'app', aplicativo: 'cliente', banco: true },
  // o site só para admin (Vitor, 21/10/2026; admin.nilmacontabilidade.com): o robô, o uso do sistema, a saúde do banco, a
  // cota, os feedbacks e o sistema e agentes. O pacote leva só o site do admin (vite.config.ts, nads-rotas-proprias)
  admin: { site: 'admin-nilma', nome: 'Admin', tipo: 'app', banco: true },
  extratudo: { site: 'extratudo-nilma', nome: 'Extratudo', tipo: 'app', banco: true },
  tarefas: { site: 'tarefas-nilma', nome: 'Tarefas', tipo: 'app', banco: true },
  // extrato do banco → .xls, sem banco de dados (Vitor, 06/10/2026)
  conversor: { site: 'conversor-nilma', nome: 'Conversor', tipo: 'app' },
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
  // as peças (assets/) das versões anteriores ficam no site por 30 dias: uma aba aberta antes da publicação pede os
  // pedaços da versão dela (o leitor de PDF, por exemplo) e, sem eles, dava "Failed to fetch dynamically imported
  // module" (Vitor, 01/10/2026). Guardadas em dist-sites/.assets-<site>, com a data de quando saíram pela 1ª vez.
  // na pasta principal, mesmo publicando de uma cópia; antes de gerar, as peças do que está no ar entram também (de onde
  // quer que tenha sido publicado)
  const guardadas = path.join(principal, 'apps', 'web', 'dist-sites', '.assets-' + (s.pasta || id));
  if (s.tipo === 'app' && !canal) {
    guardarPecas(path.join(saida, 'assets'), guardadas);
    await guardarPecasDoAr(url(s.site), guardadas);
  }
  fs.rmSync(saida, { recursive: true, force: true });
  if (s.tipo === 'app') {
    const banco = s.banco && !soExemplos;
    console.log('sites: gerando ' + s.nome + (banco ? ' (ligado ao banco)' : ' (dados de exemplo)') + '…');
    execSync('npx vite build --mode ' + (banco ? 'banco' : 'exemplos') + ' --outDir ' + JSON.stringify(saida) + ' --emptyOutDir', {
      cwd: web, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, VITE_APLICATIVO: s.aplicativo || id, ...(s.env || {}) },
    });
    if (!canal) devolverPecas(guardadas, path.join(saida, 'assets'));
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
/**
 * As peças da versão que está no ar, baixadas do próprio site (28/10/2026): do index.html, cada .js e .css que ele cita e,
 * dentro deles, os pedaços que eles importam ("./Executor-abc.js", "assets/x.css"). Só as que ainda não estão guardadas.
 * O site devolve o index.html (200) para arquivo que não existe: o que vier em HTML não é peça. Sem rede, segue sem elas.
 */
/* global fetch, AbortSignal -- os do Node 18+ */
async function guardarPecasDoAr(site, para) {
  // só o próprio site que está sendo publicado (a trava das conexões confere isto)
  if (!SITE_DO_NADS.test(site)) return;
  const PECA = /(?:\.\/|\/?assets\/)([\w.~-]+\.(?:js|css|woff2?|ttf|png|svg|jpe?g|webp|wasm|mjs))(?=["'`?#)\s])/g;
  const baixar = async caminho => {
    const r = await fetch(site + '/' + caminho, { signal: AbortSignal.timeout(20000) });
    if (!r.ok || /text\/html/.test(r.headers.get('content-type') || '')) return null;
    return Buffer.from(await r.arrayBuffer());
  };
  try {
    const html = await (await fetch(site + '/', { signal: AbortSignal.timeout(20000) })).text();
    const fila = [...new Set([...html.matchAll(PECA)].map(m => m[1]))];
    const vistas = new Set(fila);
    fs.mkdirSync(para, { recursive: true });
    let novas = 0;
    while (fila.length && vistas.size < 5000) {
      const lote = fila.splice(0, 8);
      await Promise.all(lote.map(async nome => {
        const destino = path.join(para, nome);
        let dados = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
        if (!dados) {
          dados = await baixar('assets/' + nome).catch(() => null);
          if (!dados) return;
          fs.writeFileSync(destino, dados);
          novas++;
        }
        if (/\.(js|mjs|css)$/.test(nome)) for (const m of dados.toString('utf8').matchAll(PECA)) if (!vistas.has(m[1])) { vistas.add(m[1]); fila.push(m[1]); }
      }));
    }
    if (novas) console.log('sites: ' + novas + ' peças do que está no ar em ' + site + ' guardadas (para as abas abertas antes)');
  } catch (e) { console.log('sites: não li as peças de ' + site + ' (' + (e && e.message) + '); segue com as guardadas'); }
}

/** Guarda as peças da versão que está no ar (só as que ainda não estavam guardadas: a data é a de quando saíram). */
function guardarPecas(de, para) {
  if (!fs.existsSync(de)) return;
  fs.mkdirSync(para, { recursive: true });
  for (const f of fs.readdirSync(de)) {
    const destino = path.join(para, f);
    if (!fs.existsSync(destino)) { try { fs.copyFileSync(de + path.sep + f, destino); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  }
}
/** Põe de volta as peças antigas que a versão nova não tem; as de mais de 30 dias saem de vez. */
function devolverPecas(de, para) {
  if (!fs.existsSync(de)) return;
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let devolvidas = 0;
  for (const f of fs.readdirSync(de)) {
    const origem = path.join(de, f);
    // outra publicação ao mesmo tempo pode ter tirado a peça no meio (28/10/2026: o ENOENT do copyfile): segue sem ela
    try {
      if (fs.statSync(origem).mtimeMs < limite) { fs.rmSync(origem, { force: true }); continue; }
      const destino = path.join(para, f);
      if (!fs.existsSync(destino)) { fs.copyFileSync(origem, destino); devolvidas++; }
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (devolvidas) console.log('sites: ' + devolvidas + ' peças de versões anteriores continuam no site (abas abertas antes desta publicação)');
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
