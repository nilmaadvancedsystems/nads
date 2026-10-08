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

// a sessão fica na memória e no disco, junto do perfil (abrir o Chrome custa de 2 s a mais de 2 min: 08/10/2026, o 62
// esperou 2 min 41 s por ele); só abre o Chrome quando o portal recusa a guardada
const SESSAO = path.join(path.dirname(PERFIL), 'sieg-sessao.txt');
let sessao = null;

/** A sessão do perfil do robô: abre o Chrome escondido, confere se ainda está logado e devolve os cookies do app. */
// 3 tentativas antes de desistir do portal (08/10/2026: às 15:43 uma abertura falhou, o pedido caiu na API e levou
// 14 minutos): o Chrome às vezes não abre de primeira (o perfil ainda preso pelo anterior)
// uma abertura do Chrome por vez: os tipos que baixam juntos e pedem sessão nova esperam a mesma
let abrindo = null;
async function cookiesDoPortal(renovar) {
  if (abrindo) return abrindo;
  if (renovar) { sessao = null; try { fs.unlinkSync(SESSAO); } catch (_) { /* não tinha */ } }
  if (sessao) return sessao;
  try { sessao = fs.readFileSync(SESSAO, 'utf8').trim() || null; } catch (_) { /* ainda não guardou */ }
  if (sessao) return sessao;
  abrindo = (async () => {
    let erro;
    for (let i = 0; i < 3; i++) {
      try { return await abrirSessao(); } catch (err) { erro = err; await new Promise(r => setTimeout(r, 3000)); }
    }
    throw erro;
  })().finally(() => { abrindo = null; });
  return abrindo;
}

async function abrirSessao() {
  if (!fs.existsSync(PERFIL)) throw new Error(SEM_LOGIN + ' (o perfil do robô ainda não existe)');
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: PERFIL, ignoreDefaultArgs: ['--enable-automation'], args: ['--lang=pt-BR'] });
  try {
    const pg = await browser.newPage();
    await pg.goto(APP + '/api/v1/entitlements/features', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const texto = await pg.evaluate(() => document.body ? document.body.innerText : '');
    if (/auth\.sieg\.com/.test(pg.url()) || !/^\s*\{/.test(texto)) throw new Error(SEM_LOGIN + ' (' + pg.url().slice(0, 60) + ')');
    const cookies = await pg.cookies(APP);
    sessao = cookies.map(c => c.name + '=' + c.value).join('; ');
    try { fs.writeFileSync(SESSAO, sessao); } catch (_) { /* sem disco, fica só na memória */ }
    return sessao;
  } finally { await browser.close().catch(() => {}); }
}

/** Um tipo de nota do mês, pelo "baixar período" do portal: o .zip, ou null sem documentos. */
async function zipDoPeriodo(cookie, doc, tipo, competencia, sinal) {
  const id = EMPRESA + '-' + doc;
  const r = await fetch(APP + '/api/v1/client-details/docs-fiscals/' + encodeURIComponent(id) + '/xmls/download/period', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: APP, Referer: APP + '/detalhes-do-cliente/docs-fiscais?id=' + id },
    body: JSON.stringify({ clientId: id, fiscalDocumentType: tipo, cnpjRole: 1, periodType: 1, startDate: competencia + '-01', endDate: ultimoDia(competencia), includeEvents: true, folderStructure: 1, fileType: 1 }),
    signal: sinal ? AbortSignal.any([sinal, AbortSignal.timeout(10 * 60000)]) : AbortSignal.timeout(10 * 60000),
  });
  if (r.status === 204) return null;
  if (r.status === 401 || r.status === 403 || /auth\.sieg\.com/.test(r.url)) throw new Error(SEM_LOGIN);
  if (!r.ok) throw new Error('o portal do SIEG respondeu ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('o portal do SIEG não mandou um .zip');
  return buf;
}

// o ritmo do portal (08/10/2026: de 10 a 25 XMLs por segundo, mais uns 2 s para começar): só para a barra andar
const XMLS_POR_SEGUNDO = 12;

/**
 * Todos os XMLs do mês pelo portal, no mesmo formato do xmlsDoMes da API: { arquivos, resumo, contagem, doDrive }. A nota
 * é emitida quando o emitente é o cliente; o resto é recebida.
 *
 * Os tipos de nota baixam AO MESMO TEMPO (08/10/2026: "tá demorando em média 3 minutos, queria que demorasse 1"): o tempo
 * é o do maior .zip, não a soma. reaproveitar (opcional) é a conferência com o Drive, que roda junto: quando ela diz que
 * um tipo não mudou desde o último download ({ tipos, xmls }), o download dele é cancelado e entram os XMLs do Drive.
 *
 * aoAndar(texto, fracao): fracao vai de 0 a 1 ao longo do download. Cada tipo pesa o que a contagem espera dele
 * (esperado: { 'NF-e': 300 … }); enquanto o .zip não chega, a parte dele anda sozinha devagarinho, sem chegar ao fim.
 */
async function xmlsPeloPortal(doc, competencia, aoAndar, lerZip, soTipos, esperado, reaproveitar) {
  doc = soDigitos(doc);
  const andar = (t, f) => (aoAndar ? aoAndar(t, Math.max(0, Math.min(1, f))) : undefined);
  const arquivos = new Map();
  const resumo = { emitidas: [], recebidas: [] };
  const contagem = { emitidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 }, recebidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 } };
  const canceladas = new Set();
  const juntar = xmls => {
    for (const x of xmls) {
      arquivos.set(sx.nomeDoArquivo(x), x);
      const r = sx.resumoDaNota(x);
      if (!r) continue;
      if (r.cancela) { canceladas.add(r.cancela); continue; }
      const grupo = soDigitos(r.emitente && r.emitente.doc) === doc ? 'emitidas' : 'recebidas';
      resumo[grupo].push(r);
      const chave = r.tipo.replace('-', '');
      if (chave in contagem[grupo]) contagem[grupo][chave]++;
    }
  };
  const tipos = TIPOS.filter(([nome]) => !soTipos || soTipos.includes(nome));
  await andar('Entrando no portal do SIEG', 0);
  let cookie = await cookiesDoPortal();
  // o peso de cada tipo: as notas esperadas (com os eventos, uns 20% a mais) e um mínimo (o pedido sem nota leva ~1 s)
  const peso = nome => Math.max(3, ((esperado && esperado[nome]) || 0) * 1.2);
  const total = tipos.reduce((t, [nome]) => t + peso(nome), 0) || 1;
  const andamento = new Map(tipos.map(([nome]) => [nome, 0]));
  const inicio = Date.now();
  const somar = () => [...andamento].reduce((t, [nome, f]) => t + peso(nome) * f, 0) / total;
  const faltando = () => tipos.filter(([nome]) => andamento.get(nome) < 1).map(([nome]) => nome);
  const texto = () => {
    const f = faltando();
    return f.length ? 'Baixando ' + f.join(', ') + ' do portal' + (arquivos.size ? ' (' + arquivos.size + ' XMLs até agora)' : '') : 'Baixados ' + arquivos.size + ' XMLs';
  };
  // a barra anda enquanto o portal monta os .zip: 1 − e^(−t/T) por tipo, nunca chega ao fim antes da hora
  const relogio = setInterval(() => {
    const s = (Date.now() - inicio) / 1000;
    for (const [nome] of tipos) if (andamento.get(nome) < 1) andamento.set(nome, Math.min(0.95, 1 - Math.exp(-s / (2 + peso(nome) / XMLS_POR_SEGUNDO))));
    andar(texto(), somar());
  }, 1000);
  const cancelar = new Map(tipos.map(([nome]) => [nome, new AbortController()]));
  const doDrive = new Set();
  let xmlsDoDrive = [];
  // a conferência com o Drive, junto com os downloads: o tipo que não mudou para de baixar
  const conferido = reaproveitar ? reaproveitar.then(r => {
    for (const t of (r && r.tipos) || []) if (cancelar.has(t) && andamento.get(t) < 1) { doDrive.add(t); cancelar.get(t).abort(); }
    xmlsDoDrive = ((r && r.xmls) || []).filter(x => doDrive.has(sx.tipoDeNota(x)));
  }).catch(() => {}) : Promise.resolve();
  try {
    const baixar = async ([nome, tipo]) => {
      const sinal = cancelar.get(nome).signal;
      try {
        let zip;
        try { zip = await zipDoPeriodo(cookie, doc, tipo, competencia, sinal); }
        catch (err) {
          if (sinal.aborted) return;
          // a sessão guardada venceu: pega a do perfil (o Chrome) e tenta uma vez mais
          if (!err.message.startsWith(SEM_LOGIN)) throw err;
          cookie = await cookiesDoPortal(true);
          zip = await zipDoPeriodo(cookie, doc, tipo, competencia, sinal);
        }
        if (zip && !doDrive.has(nome)) juntar(lerZip(zip));
      } catch (err) { if (!sinal.aborted) throw err; }
      finally { andamento.set(nome, 1); andar(texto(), somar()); }
    };
    await Promise.all(tipos.map(baixar));
    await conferido;
  } finally { clearInterval(relogio); }
  if (xmlsDoDrive.length) juntar(xmlsDoDrive);
  await andar('Baixados ' + arquivos.size + ' XMLs', 1);
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g]) if (n.chave && canceladas.has(n.chave)) n.cancelada = true;
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem, doDrive: xmlsDoDrive.length, tiposDoDrive: [...doDrive] };
}

/**
 * Os XMLs de qualquer origem (o .zip do Drive, os que o cliente mandou) no mesmo formato do download: { arquivos, resumo,
 * contagem }. Emitida = o emitente é o cliente; o resto, recebida. As canceladas vêm marcadas.
 */
function montarXmls(doc, xmls) {
  doc = soDigitos(doc);
  const arquivos = new Map();
  const resumo = { emitidas: [], recebidas: [] };
  const contagem = { emitidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 }, recebidas: { NFe: 0, NFCe: 0, CTe: 0, NFSe: 0, CFe: 0 } };
  const canceladas = new Set();
  for (const x of xmls) {
    const nome = sx.nomeDoArquivo(x);
    if (arquivos.has(nome)) continue;
    arquivos.set(nome, x);
    const r = sx.resumoDaNota(x);
    if (!r) continue;
    if (r.cancela) { canceladas.add(r.cancela); continue; }
    const grupo = soDigitos(r.emitente && r.emitente.doc) === doc ? 'emitidas' : 'recebidas';
    resumo[grupo].push(r);
    const chave = r.tipo.replace('-', '');
    if (chave in contagem[grupo]) contagem[grupo][chave]++;
  }
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g]) if (n.chave && canceladas.has(n.chave)) n.cancelada = true;
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem };
}

/**
 * Dos XMLs que o cliente mandou, só os dele (08/10/2026: "importar os XMLs que os clientes mandam"): a nota em que ele é o
 * emitente, o destinatário ou o tomador, e o evento (cancelamento) de uma dessas notas ou com o CNPJ dele na chave.
 */
function soDoCliente(doc, xmls) {
  doc = soDigitos(doc);
  const notas = [];
  const eventos = [];
  const chaves = new Set();
  for (const x of xmls) {
    if (!sx.tipoDoXml(x)) continue;
    const r = sx.resumoDaNota(x);
    if (r && r.cancela) { eventos.push([x, r.cancela]); continue; }
    if (!r) { eventos.push([x, ((/<(?:\w+:)?ch(?:NFe|CTe)>(\d{44})</.exec(x)) || [])[1] || '']); continue; }
    const dele = [r.emitente, r.destinatario].some(p => p && soDigitos(p.doc) === doc);
    if (!dele) continue;
    notas.push(x);
    if (r.chave) chaves.add(r.chave);
  }
  const deles = eventos.filter(([, chave]) => chave && (chaves.has(chave) || chave.slice(6, 20) === doc)).map(([x]) => x);
  return [...notas, ...deles];
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

module.exports = { xmlsPeloPortal, montarXmls, soDoCliente, SEM_LOGIN, PERFIL };
