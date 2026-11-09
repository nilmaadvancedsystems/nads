// OCR do arquivador novo, para o PDF escaneado (sem camada de texto). Autorizado pelo Vitor em 21/10/2026.
//
// A rotina antiga "lia a imagem" do escaneado (Dicionário §12); o arquivador novo, sem o Claude, não lia nada e mandava
// para NÃO IDENTIFICADOS. Aqui a página vira imagem (pdfjs-dist, que no Node desenha com o @napi-rs/canvas, sem
// compilar nada) e o texto sai do Tesseract (tesseract.js) com o português do pacote @tesseract.js-data/por — tudo
// local, nada baixado em tempo de execução.
//
// Regras de uso (o arquivador-regras.js trata o resultado como menos confiável, no máximo 0,90):
//   - só entra quando o PDF não tem texto (ou quase nada);
//   - só as primeiras páginas (OCR_PAGINAS, padrão 2);
//   - tempo-limite por arquivo (OCR_TEMPO_MS, padrão 90 s): passou disso, desiste e o arquivo segue sem texto.
'use strict';
const path = require('path');

const PAGINAS = +(process.env.OCR_PAGINAS || 2);
const TEMPO_MS = +(process.env.OCR_TEMPO_MS || 90000);
const JUNTOS = Math.max(1, +(process.env.OCR_JUNTOS || 3));   // trabalhadores ao mesmo tempo (26/10/2026; o PC tem 4 núcleos)
const ESCALA = 2.2;   // ~200 dpi numa página A4: o Tesseract lê bem a partir de ~150 dpi

const CRIAR_MS = +(process.env.OCR_CRIAR_MS || 60000);   // criar um trabalhador leva ~1–2 s; travou na criação, desiste

let pdfjs = null;
const livres = [];       // os trabalhadores parados
const fila = [];         // quem espera um trabalhador: { ok, falha }
let criados = 0;

async function carregarPdfjs() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

// O TRABALHADOR MORTO (09/11/2026; o reprocesso de 07/11 caiu em 1050/1339 com "Cannot read properties of null (reading
// 'postMessage')", e o db74c813 não bastou). No tesseract.js 7, depois do terminate() o trabalhador fica com worker = null e
// QUALQUER recognize() a seguir manda a mensagem por uma função async (send.js) que falha sozinha: a rejeição não chega ao
// recognize (que fica esperando para sempre) e derruba o processo (rejeição não tratada). Acontecia assim: o arquivo passou
// do prazo → o trabalhador foi descartado (terminate) → a resposta da página que já estava a caminho chegou mesmo assim → o
// laço da rotação seguiu e chamou recognize() de novo no trabalhador morto. E a thread que morre sozinha (falta de memória
// no WASM) deixava o recognize esperando até o prazo, e o evento 'error' dela, sem ninguém ouvindo, também derrubava.
// Agora cada trabalhador vem embrulhado: { w, morto, morte }.
//   - morto vira true ANTES do terminate, e todo recognize passa por reconhecer(), que confere: o trabalho que passou do
//     prazo e continua rodando sozinho para ali, com um erro comum (engolido), sem tocar no trabalhador morto;
//   - a thread que sai ou dá erro ('exit'/'error', com quem ouça) marca morto e rejeita `morte`, que corre junto com o
//     trabalho: o arquivo daquele trabalhador volta na hora com `erro`, o trabalhador é descartado e o próximo é criado novo;
//   - qualquer erro do OCR fica naquele arquivo (volta em `erro`, nunca lança) e descarta o trabalhador (recriar custa ~1 s).
function embrulhar(w) {
  const t = { w, morto: false, motivo: null, morte: null };
  let matar;
  t.morte = new Promise((_, rej) => { matar = rej; });
  t.morte.catch(() => {});
  t.marcar = motivo => { if (t.morto) return; t.morto = true; t.motivo = motivo; matar(new Error('trabalhador do OCR morreu (' + motivo + ')')); };
  const cru = w && w.worker;
  if (cru && typeof cru.on === 'function') {
    cru.on('error', e => t.marcar('erro na thread: ' + (e && e.message ? e.message : String(e))));
    cru.once('exit', c => t.marcar('a thread saiu' + (c != null ? ' com ' + c : '')));
  }
  return t;
}
/** recognize() só no trabalhador vivo (o morto lança aqui, antes de chegar ao tesseract.js). */
async function reconhecer(t, img, op) {
  if (t.morto) throw new Error('trabalhador do OCR morreu (' + t.motivo + ')');
  return t.w.recognize(img, op);
}

function criarTrabalhador() {
  const { createWorker } = require('tesseract.js');
  // o pacote de idioma traz por.traineddata.gz; langPath é a pasta, gzip: true, e nada de cache fora daqui
  const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/por/package.json')), '4.0.0_best_int');
  let tm, atrasado = false;
  const p = Promise.resolve().then(() => createWorker('por', 1, { langPath, gzip: true, cacheMethod: 'none', logger: () => {}, errorHandler: () => {} }));
  // o que ficou pronto depois do prazo não serve a ninguém: fecha
  p.then(w => { if (atrasado) Promise.resolve(w.terminate()).catch(() => {}); }, () => {});
  const prazo = new Promise((_, rej) => { tm = setTimeout(() => rej(new Error('o trabalhador do OCR não ficou pronto em ' + Math.round(CRIAR_MS / 1000) + ' s')), CRIAR_MS); });
  return Promise.race([p, prazo]).then(w => { clearTimeout(tm); return embrulhar(w); }, e => { clearTimeout(tm); atrasado = true; throw e; });
}

/**
 * Até JUNTOS trabalhadores do Tesseract, reaproveitados (criar custa ~1–2 s); cada um lê um PDF por vez, então vários
 * escaneados são lidos ao mesmo tempo (26/10/2026: um por vez segurava o lote inteiro).
 */
async function obterTrabalhador() {
  while (livres.length) { const t = livres.pop(); if (!t.morto) return t; criados--; }   // o que morreu parado não volta
  if (criados < JUNTOS) {
    criados++;
    try { return await criarTrabalhador(); } catch (e) { criados--; acordar(); throw e; }
  }
  return new Promise((ok, falha) => fila.push({ ok, falha }));
}
/** A vaga abriu (trabalhador descartado, ou a criação falhou): o primeiro da fila tenta um trabalhador novo. */
function acordar() {
  if (!fila.length || criados >= JUNTOS) return;
  const prox = fila.shift();
  obterTrabalhador().then(prox.ok, prox.falha);
}
function devolver(t) {
  if (t.morto) { descartar(t); return; }
  const prox = fila.shift(); if (prox) prox.ok(t); else livres.push(t);
}
/** O trabalhador que passou do prazo, deu erro ou morreu: marca morto (antes de tudo), fecha e abre a vaga. */
function descartar(t) {
  if (t.descartado) return;
  t.descartado = true;
  t.marcar('descartado');
  criados--;
  try { Promise.resolve(t.w.terminate()).catch(() => {}); } catch (e) { /* já estava fechado */ }
  acordar();
}

/** A página i do PDF como PNG (rotacao em graus: 0, 90, 270 para página escaneada de lado). */
async function renderizar(doc, i, rotacao) {
  const pagina = await doc.getPage(i);
  try {
    const vp = pagina.getViewport({ scale: ESCALA, rotation: ((pagina.rotate || 0) + (rotacao || 0)) % 360 });
    const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
    await pagina.render({ canvasContext: context, viewport: vp, canvas }).promise;
    return canvas.toBuffer('image/png');
  } finally { pagina.cleanup(); }
}

// (05/11/2026) o trabalho que passou do prazo continua rodando sozinho e pode falhar depois (o trabalhador já foi descartado: "reading 'postMessage'"):
// essa falha tardia não tem quem a espere e derrubava o processo inteiro (rejeição não tratada); agora é engolida aqui
// (09/11/2026) e corre junto com a morte do trabalhador: a thread que caiu devolve o arquivo na hora, sem esperar o prazo
const comPrazo = (p, ms, t) => {
  p.catch(() => {});
  let tm;
  const prazo = new Promise((_, rej) => { tm = setTimeout(() => rej(new Error('OCR passou de ' + Math.round(ms / 1000) + ' s')), ms); });
  return Promise.race([p, prazo].concat(t ? [t.morte] : [])).finally(() => clearTimeout(tm));
};
const util = t => String(t || '').replace(/[^A-Za-zÀ-ú0-9]/g, '').length;
// o tesseract.js rejeita às vezes com um texto solto (não um Error)
const erroDe = e => (e && e.message ? e.message : String(e || 'erro desconhecido do OCR'));

/**
 * Texto das primeiras páginas por OCR: { paginas: [texto…], total, confianca (0–100, média do Tesseract), ms, erro }.
 * Página 1 sempre; a 2 só se a 1 trouxe pouco texto. Página lida mal (< 55%) tenta de novo de lado (90° e 270°) e
 * fica com a melhor leitura. Nunca lança: erro e tempo esgotado voltam em `erro`, com `paginas` vazio.
 */
async function ocrDoPdf(buffer, opcoes) {
  const o = Object.assign({ paginas: PAGINAS, tempoMs: TEMPO_MS }, opcoes);
  const inicio = Date.now();
  let tarefa = null, w = null, noOcr = false;
  try {
    w = await obterTrabalhador();   // fora do prazo: a espera na fila não conta (e o trabalhador sempre volta)
    return await comPrazo((async () => {
      const lib = await carregarPdfjs();
      tarefa = lib.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false });
      const doc = await tarefa.promise;
      const paginas = [];
      const confs = [];
      for (let i = 1; i <= Math.min(o.paginas, doc.numPages); i++) {
        if (i > 1 && util(paginas.join('')) >= 400) break;   // a página 1 já trouxe o cabeçalho
        let melhor = null;
        for (const rot of [0, 90, 270]) {
          const img = await renderizar(doc, i, rot);
          noOcr = true;
          const r = await reconhecer(w, img);
          noOcr = false;
          const c = typeof r.data.confidence === 'number' ? r.data.confidence : 0;
          if (!melhor || c > melhor.c) melhor = { t: r.data.text || '', c, rot };
          if (melhor.c >= 55) break;
        }
        paginas.push(melhor.t);
        confs.push(melhor.c);
      }
      return { paginas, total: doc.numPages, confianca: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0, ms: Date.now() - inicio };
    })(), o.tempoMs, w);
  } catch (e) {
    // tempo esgotado (o trabalhador pode ter ficado no meio de uma página), trabalhador morto ou erro do Tesseract: descarta
    // e cria outro na próxima vez; o erro do PDF em si (o pdfjs não abriu) não é do trabalhador, que volta para a fila
    if (w && (noOcr || w.morto || /OCR passou/.test(erroDe(e)))) descartar(w);
    return { paginas: [], total: 0, confianca: 0, ms: Date.now() - inicio, erro: erroDe(e) };
  } finally { if (tarefa) tarefa.destroy().catch(() => {}); if (w && !w.descartado) devolver(w); }
}

/**
 * Texto de uma IMAGEM (.jpg/.png) por OCR, com os mesmos trabalhadores e o mesmo prazo do PDF (27/10/2026, Vitor: os
 * comprovantes escaneados do Posto Berizal vêm como "Imagem (10).jpg"): { paginas: [texto], total: 1, confianca, ms, erro }.
 * Leitura ruim (< 55%) tenta de novo com a rotação automática do Tesseract e fica com a melhor. Nunca lança.
 */
async function ocrDaImagem(buffer, opcoes) {
  const o = Object.assign({ tempoMs: TEMPO_MS }, opcoes);
  const inicio = Date.now();
  let w = null;
  try {
    w = await obterTrabalhador();
    return await comPrazo((async () => {
      let melhor = null;
      for (const op of [{}, { rotateAuto: true }]) {
        const r = await reconhecer(w, buffer, op);
        const c = typeof r.data.confidence === 'number' ? r.data.confidence : 0;
        if (!melhor || c > melhor.c) melhor = { t: r.data.text || '', c };
        if (melhor.c >= 55) break;
      }
      return { paginas: [melhor.t], total: 1, confianca: Math.round(melhor.c), ms: Date.now() - inicio };
    })(), o.tempoMs, w);
  } catch (e) {
    if (w) descartar(w);   // aqui todo erro é do Tesseract (ou do prazo): trabalhador novo para o próximo
    return { paginas: [], total: 0, confianca: 0, ms: Date.now() - inicio, erro: erroDe(e) };
  } finally { if (w && !w.descartado) devolver(w); }
}

async function encerrar() {
  const ws = livres.splice(0);
  criados -= ws.length;
  await Promise.all(ws.map(t => { t.descartado = true; t.marcar('encerrado'); return Promise.resolve(t.w.terminate()).catch(() => {}); }));
}
/** Para o painel e os testes: quantos trabalhadores existem, quantos parados, quantos esperando. */
const situacao = () => ({ criados, livres: livres.length, fila: fila.length });

module.exports = { ocrDoPdf, ocrDaImagem, encerrar, situacao, PAGINAS, TEMPO_MS, JUNTOS };
