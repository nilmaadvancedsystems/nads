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
const ESCALA = 2.2;   // ~200 dpi numa página A4: o Tesseract lê bem a partir de ~150 dpi

let pdfjs = null;
let trabalhador = null;

async function carregarPdfjs() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/** Um trabalhador do Tesseract por processo, reaproveitado (criar custa ~1–2 s). */
async function obterTrabalhador() {
  if (trabalhador) return trabalhador;
  const { createWorker } = require('tesseract.js');
  // o pacote de idioma traz por.traineddata.gz; langPath é a pasta, gzip: true, e nada de cache fora daqui
  const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/por/package.json')), '4.0.0_best_int');
  trabalhador = await createWorker('por', 1, { langPath, gzip: true, cacheMethod: 'none', logger: () => {}, errorHandler: () => {} });
  return trabalhador;
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

const comPrazo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('OCR passou de ' + Math.round(ms / 1000) + ' s')), ms))]);
const util = t => String(t || '').replace(/[^A-Za-zÀ-ú0-9]/g, '').length;

/**
 * Texto das primeiras páginas por OCR: { paginas: [texto…], total, confianca (0–100, média do Tesseract), ms, erro }.
 * Página 1 sempre; a 2 só se a 1 trouxe pouco texto. Página lida mal (< 55%) tenta de novo de lado (90° e 270°) e
 * fica com a melhor leitura. Nunca lança: erro e tempo esgotado voltam em `erro`, com `paginas` vazio.
 */
async function ocrDoPdf(buffer, opcoes) {
  const o = Object.assign({ paginas: PAGINAS, tempoMs: TEMPO_MS }, opcoes);
  const inicio = Date.now();
  let tarefa = null;
  try {
    return await comPrazo((async () => {
      const lib = await carregarPdfjs();
      tarefa = lib.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false });
      const doc = await tarefa.promise;
      const w = await obterTrabalhador();
      const paginas = [];
      const confs = [];
      for (let i = 1; i <= Math.min(o.paginas, doc.numPages); i++) {
        if (i > 1 && util(paginas.join('')) >= 400) break;   // a página 1 já trouxe o cabeçalho
        let melhor = null;
        for (const rot of [0, 90, 270]) {
          const r = await w.recognize(await renderizar(doc, i, rot));
          const c = typeof r.data.confidence === 'number' ? r.data.confidence : 0;
          if (!melhor || c > melhor.c) melhor = { t: r.data.text || '', c, rot };
          if (melhor.c >= 55) break;
        }
        paginas.push(melhor.t);
        confs.push(melhor.c);
      }
      return { paginas, total: doc.numPages, confianca: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0, ms: Date.now() - inicio };
    })(), o.tempoMs);
  } catch (e) {
    // tempo esgotado: o trabalhador pode ter ficado no meio de uma página; descarta e cria outro na próxima vez
    if (/OCR passou/.test(e.message) && trabalhador) { const t = trabalhador; trabalhador = null; t.terminate().catch(() => {}); }
    return { paginas: [], total: 0, confianca: 0, ms: Date.now() - inicio, erro: e.message };
  } finally { if (tarefa) tarefa.destroy().catch(() => {}); }
}

async function encerrar() { if (trabalhador) { const t = trabalhador; trabalhador = null; await t.terminate().catch(() => {}); } }

module.exports = { ocrDoPdf, encerrar, PAGINAS, TEMPO_MS };
