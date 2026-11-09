// Teste do OCR com o trabalhador morto (09/11/2026: o reprocesso de 07/11 caiu em 1050/1339 com "Cannot read properties of
// null (reading 'postMessage')" em tesseract.js/src/worker/node/send.js:11 ← arquivador-ocr.js:122).
//   node teste-arquivador-ocr.js            (o trabalhador falso, que imita o tesseract.js 7, e depois o Tesseract de verdade)
//   node teste-arquivador-ocr.js --falso    (só o falso, rápido)
//   node teste-arquivador-ocr.js --antigo <arquivo>   (roda o cenário da queda contra outra versão do arquivador-ocr.js)
// Cada cenário roda num processo filho: a queda de verdade (rejeição não tratada) mata o filho, e o teste vê.
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

let falhas = 0, total = 0;
const ok = (nome, cond, info) => { total++; if (!cond) { falhas++; console.log('FALHOU:', nome, info ? '\n  ' + info : ''); } };

// ---------------------------------------------------------------------------------------------------------------------
// o filho: troca o tesseract.js por um falso que se comporta como o 7.0.0 (createWorker.js + worker/node/send.js)
// ---------------------------------------------------------------------------------------------------------------------
function instalarFalso(cfg) {
  const EventEmitter = require('events');
  const st = { criados: 0, terminados: 0, n: 0 };   // n: as leituras pedidas, contadas em todos os trabalhadores (o roteiro)
  const createWorker = async () => {
    st.criados++;
    if (cfg.criacaoFalha && st.criados <= cfg.criacaoFalha) throw new Error('falha ao criar (falso)');
    if (cfg.criacaoTrava && st.criados <= cfg.criacaoTrava) return new Promise(() => {});
    const cru = new EventEmitter();
    let worker = cru;   // o tesseract.js põe null no terminate()
    const pendentes = new Map();
    // send.js do tesseract.js: async; com worker null, a rejeição não chega a ninguém (e o job fica esperando para sempre)
    const send = async (w, pacote) => { w.postMessage(pacote); };
    cru.postMessage = pacote => {
      const roteiro = (cfg.roteiro || [])[pacote.n] || cfg.padrao || { ms: 5, conf: 90, texto: 'CNPJ 12.345.678/0001-90 TEXTO' };
      if (roteiro.nunca) return;
      // a resposta já a caminho é entregue mesmo depois do terminate() (a mensagem que já estava na porta)
      setTimeout(() => { const p = pendentes.get(pacote.n); pendentes.delete(pacote.n); if (!p) return; if (roteiro.rejeita) p.rej(roteiro.rejeita); else p.res({ data: { text: roteiro.texto || 'texto', confidence: roteiro.conf } }); }, roteiro.ms);
    };
    const w = {
      worker: cru,
      recognize: async () => {
        await Promise.resolve();   // o await loadImage(image)
        const id = st.n++;
        return new Promise((res, rej) => { pendentes.set(id, { res, rej }); send(worker, { n: id }); });
      },
      terminate: async () => { if (worker !== null) { st.terminados++; worker = null; setImmediate(() => cru.emit('exit', 1)); } },
    };
    st.ultimo = w;
    return w;
  };
  require.cache[require.resolve('tesseract.js')] = { id: 'tesseract.js', filename: require.resolve('tesseract.js'), loaded: true, exports: { createWorker } };
  return st;
}

async function filho(cenario, modulo) {
  const cfgs = {
    // a queda de 07/11: a 1ª leitura da imagem (confiança baixa, 50 ms) passa do prazo (30 ms); o trabalhador é descartado,
    // a resposta chega mesmo assim e o laço da rotação chama recognize() de novo no trabalhador morto
    queda: { roteiro: [{ ms: 50, conf: 10 }, { ms: 5, conf: 90, texto: 'CNPJ 12.345.678/0001-90' }], prazo: 30 },
    // a thread morre no meio da leitura (o recognize nunca responde): o arquivo volta logo, sem esperar o prazo
    threadMorre: { roteiro: [{ nunca: true }], prazo: 5000, matar: 'exit' },
    erroNaThread: { roteiro: [{ nunca: true }], prazo: 5000, matar: 'error' },
    // o Tesseract rejeita a leitura (texto solto, não um Error)
    rejeita: { roteiro: [{ ms: 5, rejeita: 'Error attempting to read image.' }], prazo: 5000 },
    // a criação falha / trava: o arquivo volta com erro, sem lançar e sem prender a fila
    criacaoFalha: { criacaoFalha: 1, prazo: 5000 },
    criacaoTrava: { criacaoTrava: 1, prazo: 5000 },
  };
  const cfg = cfgs[cenario];
  process.env.OCR_JUNTOS = cenario === 'fila' ? '1' : (process.env.OCR_JUNTOS || '2');
  process.env.OCR_CRIAR_MS = '300';
  const st = instalarFalso(cenario === 'fila' ? { roteiro: [{ nunca: true }], padrao: { ms: 5, conf: 90 } } : cfg);
  const O = require(modulo);
  const saida = { cenario };
  process.on('unhandledRejection', e => { console.log(JSON.stringify({ cenario, queda: String(e && e.message || e) })); process.exit(3); });
  const img = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  if (cenario === 'fila') {
    // um trabalhador só: o 1º arquivo prende o trabalhador e a thread morre; o 2º (na fila) tem de ser atendido
    const a = O.ocrDaImagem(img, { tempoMs: 5000 });
    const b = O.ocrDaImagem(img, { tempoMs: 5000 });
    await new Promise(r => setTimeout(r, 20));
    st.ultimo.worker.emit('exit', 1);
    const t0 = Date.now();
    const [ra, rb] = await Promise.all([a, b]);
    Object.assign(saida, { a: ra.erro || null, b: rb.erro || null, bTexto: (rb.paginas || []).join(''), ms: Date.now() - t0, criados: st.criados });
  } else {
    const t0 = Date.now();
    const p = O.ocrDaImagem(img, { tempoMs: cfg.prazo });
    if (cfg.matar) { await new Promise(r => setTimeout(r, 20)); st.ultimo.worker.emit(cfg.matar, cfg.matar === 'error' ? new Error('RuntimeError: memory access out of bounds') : 1); }
    const r1 = await p;
    saida.r1 = { erro: r1.erro || null, texto: (r1.paginas || []).join(''), ms: Date.now() - t0 };
    await new Promise(r => setTimeout(r, 120));   // a resposta atrasada chega, o laço tardio roda
    const r2 = await O.ocrDaImagem(img, { tempoMs: 5000 });
    saida.r2 = { erro: r2.erro || null, texto: (r2.paginas || []).join('') };
    const pdf = await O.ocrDoPdf(Buffer.from('isto não é um PDF'), { tempoMs: 5000 });
    saida.pdfRuim = { erro: !!pdf.erro };
    saida.criados = st.criados; saida.terminados = st.terminados;
    if (O.situacao) saida.situacao = O.situacao();
  }
  await O.encerrar();
  console.log(JSON.stringify(saida));
  process.exit(0);
}

// o Tesseract de verdade: a thread é morta no meio de uma leitura; o arquivo volta com erro e o próximo lê com um trabalhador novo
async function filhoReal(modulo) {
  process.env.OCR_JUNTOS = '1';
  // guarda as threads criadas (o createWorker de verdade, só observado)
  const T = require('tesseract.js'), criar = T.createWorker, threads = [];
  T.createWorker = async (...a) => { const w = await criar(...a); threads.push(w.worker); return w; };
  const O = require(modulo);
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(900, 200); const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 200); g.fillStyle = '#000'; g.font = '36px sans-serif';
  g.fillText('CNPJ 12.345.678/0001-90', 30, 80); g.fillText('DOCUMENTO DE ARRECADACAO', 30, 150);
  const png = c.toBuffer('image/png');
  process.on('unhandledRejection', e => { console.log(JSON.stringify({ queda: String(e && e.message || e) })); process.exit(3); });
  const saida = {};
  const r0 = await O.ocrDaImagem(png);
  saida.r0 = (r0.paginas || []).join(' ').replace(/\s+/g, ' ').trim();
  // mata a thread do trabalhador que ficou parado, por fora (como se tivesse caído): o próximo arquivo não pode usar o morto
  saida.threads = threads.length;
  await threads[threads.length - 1].terminate();
  const r1 = await O.ocrDaImagem(png, { tempoMs: 60000 });
  saida.r1 = { erro: r1.erro || null, texto: (r1.paginas || []).join(' ').replace(/\s+/g, ' ').trim() };
  // e no meio de uma leitura: a thread cai enquanto lê
  // uma página grande, cheia de texto (leva segundos): a thread é morta 400 ms depois de começar
  const cg = createCanvas(2400, 3400); const gg = cg.getContext('2d');
  gg.fillStyle = '#fff'; gg.fillRect(0, 0, 2400, 3400); gg.fillStyle = '#000'; gg.font = '30px sans-serif';
  for (let y = 60; y < 3400; y += 44) gg.fillText('LINHA ' + y + ' RECIBO DE PAGAMENTO CNPJ 12.345.678/0001-90 VALOR R$ 1.234,56 COMPETENCIA 10/2026', 40, y);
  const p = O.ocrDaImagem(cg.toBuffer('image/png'), { tempoMs: 60000 });
  await new Promise(r => setTimeout(r, 400));
  const t0 = Date.now();
  await threads[threads.length - 1].terminate();
  const r2 = await p;
  saida.r2 = { erro: r2.erro || null, ms: Date.now() - t0 };
  const r3 = await O.ocrDaImagem(png, { tempoMs: 60000 });
  saida.r3 = { erro: r3.erro || null, texto: (r3.paginas || []).join(' ').replace(/\s+/g, ' ').trim() };
  await O.encerrar();
  console.log(JSON.stringify(saida));
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
const i = process.argv.indexOf('--filho');
if (i >= 0) {
  const modulo = path.resolve(process.argv[i + 2]);
  (process.argv[i + 1] === 'real' ? filhoReal(modulo) : filho(process.argv[i + 1], modulo)).catch(e => { console.log(JSON.stringify({ lancou: e.stack })); process.exit(4); });
} else {
  const ia = process.argv.indexOf('--antigo');
  const modulo = ia >= 0 ? process.argv[ia + 1] : path.join(__dirname, 'arquivador-ocr.js');
  const rodar = (cen, ms) => {
    const r = spawnSync(process.execPath, [__filename, '--filho', cen, modulo], { encoding: 'utf8', timeout: ms || 30000, cwd: __dirname });
    const linha = (r.stdout || '').trim().split(/\r?\n/).filter(l => l.startsWith('{')).pop();
    let j = null; try { j = JSON.parse(linha); } catch (e) { /* sem saída */ }
    return { status: r.status, j, bruto: (r.stdout || '') + (r.stderr || '').slice(-1500) };
  };
  if (ia >= 0) { const r = rodar('queda'); console.log('versão', modulo, '→ saída', r.status, r.j ? JSON.stringify(r.j) : r.bruto.slice(-600)); process.exit(0); }

  const q = rodar('queda');
  ok('a queda de 07/11 não derruba mais o processo', q.status === 0 && q.j && !q.j.queda, q.bruto.slice(-800));
  if (q.j && q.j.r1) {
    ok('o arquivo que passou do prazo volta com erro (só ele)', /OCR passou/.test(q.j.r1.erro || ''), JSON.stringify(q.j.r1));
    ok('o próximo arquivo é lido por um trabalhador NOVO', q.j.r2.erro === null && /CNPJ/.test(q.j.r2.texto) && q.j.criados === 2, JSON.stringify(q.j));
    ok('o PDF que nem abre volta com erro, sem lançar', q.j.pdfRuim.erro === true);
    ok('a conta fecha: um trabalhador vivo (parado), o morto fora, ninguém na fila', q.j.situacao && q.j.situacao.criados === 1 && q.j.situacao.livres === 1 && q.j.situacao.fila === 0 && q.j.terminados === 1, JSON.stringify(q.j));
  }
  for (const cen of ['threadMorre', 'erroNaThread']) {
    const r = rodar(cen);
    ok(cen + ': não cai', r.status === 0 && r.j && !r.j.queda, r.bruto.slice(-800));
    if (r.j && r.j.r1) {
      ok(cen + ': o arquivo volta na hora (sem esperar o prazo de 5 s)', /morreu/.test(r.j.r1.erro || '') && r.j.r1.ms < 1500, JSON.stringify(r.j.r1));
      ok(cen + ': o próximo lê com trabalhador novo', r.j.r2.erro === null && r.j.criados === 2, JSON.stringify(r.j));
    }
  }
  const rj = rodar('rejeita');
  ok('rejeição do Tesseract: só aquele arquivo, e o próximo lê', rj.status === 0 && rj.j && /read image/.test(rj.j.r1.erro || '') && rj.j.r2.erro === null && rj.j.criados === 2, rj.bruto.slice(-800));
  const cf = rodar('criacaoFalha');
  ok('a criação que falha: o arquivo volta com erro e o próximo cria de novo', cf.status === 0 && cf.j && /falha ao criar/.test(cf.j.r1.erro || '') && cf.j.r2.erro === null, cf.bruto.slice(-800));
  const ct = rodar('criacaoTrava');
  ok('a criação que trava: desiste no prazo e o próximo cria de novo', ct.status === 0 && ct.j && /não ficou pronto/.test(ct.j.r1.erro || '') && ct.j.r2.erro === null, ct.bruto.slice(-800));
  const fi = rodar('fila');
  ok('a fila não fica presa quando o único trabalhador morre', fi.status === 0 && fi.j && /morreu/.test(fi.j.a || '') && fi.j.b === null && /CNPJ|texto/.test(fi.j.bTexto) && fi.j.ms < 1500, fi.bruto.slice(-800));

  if (!process.argv.includes('--falso')) {
    const re = rodar('real', 180000);
    ok('Tesseract de verdade: não cai', re.status === 0 && re.j && !re.j.queda, re.bruto.slice(-1200));
    if (re.j && re.j.r0) {
      ok('Tesseract de verdade: lê o CNPJ', /12\.?345\.?678/.test(re.j.r0), re.j.r0);
      ok('Tesseract de verdade: a thread morta parada não é usada; lê com outra', re.j.r1.erro === null && /12\.?345\.?678/.test(re.j.r1.texto), JSON.stringify(re.j.r1));
      ok('Tesseract de verdade: a thread que cai no meio devolve o arquivo na hora', /morreu/.test(re.j.r2.erro || '') && re.j.r2.ms < 3000, JSON.stringify(re.j.r2));
      ok('Tesseract de verdade: depois da queda, o próximo lê', re.j.r3.erro === null && /12\.?345\.?678/.test(re.j.r3.texto), JSON.stringify(re.j.r3));
    }
  }
  console.log((falhas ? falhas + ' FALHA(S) de ' : 'ok: ') + total + ' verificações (OCR com o trabalhador morto)');
  process.exit(falhas ? 1 : 0);
}
