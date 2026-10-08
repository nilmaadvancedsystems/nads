// Os XMLs do mês pelo PORTAL do SIEG (Vitor, 08/10/2026: "tem clientes com 1000 xml de uma vez, quero que ele vá no site
// e baixe"). A API baixa 50 por chamada, 2 chamadas por minuto; o portal entrega o mês inteiro de um tipo de nota num .zip
// só (o cliente 380 de setembro: 850 XMLs em 72 s).
//
// Como entra: um Chrome com perfil próprio do robô (%LOCALAPPDATA%\nads-robo\sieg-perfil), onde a pessoa entrou uma vez
// com o login do SIEG (node sieg-portal.js entrar). O robô nunca guarda nem digita senha: só reaproveita a sessão desse
// perfil. Quando o SIEG pede login de novo, devolve o erro SEM_LOGIN e o sieg.js baixa pela API.
//
// O caminho no portal (gravado em 08/10/2026 com a pessoa baixando um cliente à mão):
//   POST app.sieg.com/api/v1/client-details/docs-fiscals/{empresa}-{doc}/xmls/download/period
//        { fiscalDocumentType: 10 NF-e | 20 CT-e | 30 NFC-e | 40 CF-e SAT | 60 NFS-e, cnpjRole: 1 (todos), periodType: 1
//          (emissão), startDate, endDate (aaaa-mm-dd), includeEvents, folderStructure: 1 (sem pastas), fileType: 1 (XML) }
//   → 200 com o .zip, ou 204 sem documentos.
const fs = require('fs');
const path = require('path');
const sx = require('./sieg-xmls');

const PERFIL = path.join(process.env.LOCALAPPDATA || __dirname, 'nads-robo', 'sieg-perfil');
const CHROME = process.env.SIEG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// o código da Nilma no SIEG (a primeira parte do id do cliente no portal)
const EMPRESA = process.env.SIEG_EMPRESA || '12865';
const APP = 'https://app.sieg.com';
const TIPOS = [['NF-e', 10], ['NFC-e', 30], ['CT-e', 20], ['NFS-e', 60], ['CF-e', 40]];
const SEM_LOGIN = 'o portal do SIEG pediu login de novo';

const soDigitos = v => String(v || '').replace(/\D/g, '');
const ultimoDia = comp => { const [a, m] = comp.split('-').map(Number); return comp + '-' + String(new Date(a, m, 0).getDate()).padStart(2, '0'); };

/** A sessão do perfil do robô: abre o Chrome escondido, confere se ainda está logado e devolve os cookies do app. */
async function cookiesDoPortal() {
  if (!fs.existsSync(PERFIL)) throw new Error(SEM_LOGIN + ' (o perfil do robô ainda não existe)');
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: PERFIL, ignoreDefaultArgs: ['--enable-automation'], args: ['--lang=pt-BR'] });
  try {
    const pg = await browser.newPage();
    await pg.goto(APP + '/api/v1/entitlements/features', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const texto = await pg.evaluate(() => document.body ? document.body.innerText : '');
    if (/auth\.sieg\.com/.test(pg.url()) || !/^\s*\{/.test(texto)) throw new Error(SEM_LOGIN);
    const cookies = await pg.cookies(APP);
    return cookies.map(c => c.name + '=' + c.value).join('; ');
  } finally { await browser.close().catch(() => {}); }
}

/** Um tipo de nota do mês, pelo "baixar período" do portal: o .zip, ou null sem documentos. */
async function zipDoPeriodo(cookie, doc, tipo, competencia) {
  const id = EMPRESA + '-' + doc;
  const r = await fetch(APP + '/api/v1/client-details/docs-fiscals/' + encodeURIComponent(id) + '/xmls/download/period', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: APP, Referer: APP + '/detalhes-do-cliente/docs-fiscais?id=' + id },
    body: JSON.stringify({ clientId: id, fiscalDocumentType: tipo, cnpjRole: 1, periodType: 1, startDate: competencia + '-01', endDate: ultimoDia(competencia), includeEvents: true, folderStructure: 1, fileType: 1 }),
    signal: AbortSignal.timeout(10 * 60000),
  });
  if (r.status === 204) return null;
  if (r.status === 401 || r.status === 403) throw new Error(SEM_LOGIN);
  if (!r.ok) throw new Error('o portal do SIEG respondeu ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('o portal do SIEG não mandou um .zip');
  return buf;
}

/**
 * Todos os XMLs do mês pelo portal, no mesmo formato do xmlsDoMes da API: { arquivos, resumo, contagem }. A nota é
 * emitida quando o emitente é o cliente; o resto é recebida.
 */
async function xmlsPeloPortal(doc, competencia, aoAndar, lerZip) {
  doc = soDigitos(doc);
  if (aoAndar) await aoAndar('Entrando no portal do SIEG');
  const cookie = await cookiesDoPortal();
  const arquivos = new Map();
  const resumo = { emitidas: [], recebidas: [] };
  const contagem = { emitidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 }, recebidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 } };
  const canceladas = new Set();
  for (const [nome, tipo] of TIPOS) {
    if (aoAndar) await aoAndar('Portal · ' + nome + ' (' + arquivos.size + ' XMLs até agora)');
    const zip = await zipDoPeriodo(cookie, doc, tipo, competencia);
    if (!zip) continue;
    for (const x of lerZip(zip)) {
      arquivos.set(sx.nomeDoArquivo(x), x);
      const r = sx.resumoDaNota(x);
      if (!r) continue;
      if (r.cancela) { canceladas.add(r.cancela); continue; }
      const grupo = soDigitos(r.emitente && r.emitente.doc) === doc ? 'emitidas' : 'recebidas';
      resumo[grupo].push(r);
      const chave = r.tipo.replace('-', '');
      if (chave in contagem[grupo]) contagem[grupo][chave]++;
    }
  }
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g]) if (n.chave && canceladas.has(n.chave)) n.cancelada = true;
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem };
}

/** node sieg-portal.js entrar: abre o Chrome do robô, visível, para a pessoa entrar no SIEG (a sessão fica no perfil). */
async function entrar() {
  fs.mkdirSync(PERFIL, { recursive: true });
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, userDataDir: PERFIL, defaultViewport: null, ignoreDefaultArgs: ['--enable-automation'], args: ['--start-maximized', '--lang=pt-BR'] });
  const [pg] = await browser.pages();
  await pg.goto('https://hub.sieg.com', { waitUntil: 'domcontentloaded' });
  console.log('Entre com o login do SIEG na janela e feche-a quando terminar.');
  await new Promise(r => browser.on('disconnected', r));
}

if (require.main === module && process.argv[2] === 'entrar') entrar().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { xmlsPeloPortal, SEM_LOGIN, PERFIL };
