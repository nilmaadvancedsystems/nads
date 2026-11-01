// A faxina do banco (01/11/2026: o banco do Entregas chegou a 1.009 MB de 1 GB, a cota grátis). Uma vez por dia o robô da
// nuvem apaga os PEDAÇOS DE ARQUIVO que já foram usados — nunca o documento de cima, que continua com o status, quem e
// quando (e serve para não baixar de novo o mesmo arquivo, pelo md5):
//
//   extratosRecebidos/{id}/partes   o extrato em Base64, depois de importado ou ignorado no Extratudo (só o 'novo' é lido)
//                                   e com mais de DIAS.extratos dias; o original continua no e-mail ou no Drive;
//   pedidosFgts/{id}/telas e ao-vivo  as fotos da tela do robô do FGTS (para ver onde parou), DIAS.fgtsTelas dias depois de
//                                   o pedido terminar (pronto, erro, captcha, cancelado). O PDF da guia (arquivo/pdf) NÃO
//                                   sai: a Área do Cliente mostra a guia por ele;
//   feedbacks/{id}/partes           o arquivo do bug, quando o feedback está 'feito' há mais de DIAS.feedbacks dias (pela
//                                   data de criação; o status não guarda quando mudou).
//
// O documento de cima ganha partesApagadasEm (o robô não procura de novo). FAXINA_BANCO=simular só escreve no log o que
// apagaria; FAXINA_BANCO=desligada não roda. Regra do módulo: NUNCA derrubar o robô (todo erro vira uma linha no log).
'use strict';

const DIAS = { extratos: 7, fgtsTelas: 14, feedbacks: 30 };
const UM_DIA_MS = 864e5;
const CONFERE_A_CADA_MS = 36e5;
const VALIDADE_MS = 23 * 36e5;
const PRIMEIRA_ESPERA_MS = 15 * 60 * 1000;   // depois da saúde do banco (5 min), para não somar as leituras
const MAX_PAIS_POR_VEZ = 200;
const FIM_DO_FGTS = ['pronto', 'erro', 'captcha', 'cancelado'];
const DOC_DO_ESTADO = ['robo', 'faxinaBanco'];

// ---------- funções puras (teste-robo.js) ----------

/** A data (ms) de um campo ISO ou Timestamp do Firestore; NaN quando não tem. */
function quando(v) {
  if (!v) return NaN;
  if (typeof v === 'string') return Date.parse(v);
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return NaN;
}

/**
 * O que a faxina faz com um documento de cima: { apagar: ['partes'...], motivo } ou null (fica como está). Só olha o
 * próprio documento (as subcoleções a apagar são as da lista; quem chama confere se existem).
 */
function oQueApagar(colecao, dados, agora) {
  const d = dados || {};
  if (d.partesApagadasEm) return null;
  const velho = (campo, dias) => { const t = quando(d[campo]); return Number.isFinite(t) && agora - t > dias * UM_DIA_MS; };
  if (colecao === 'extratosRecebidos') {
    if (!['importado', 'ignorado'].includes(d.status)) return null;
    if (!velho(d.importadoEm ? 'importadoEm' : 'em', DIAS.extratos)) return null;
    return { apagar: ['partes'], motivo: 'extrato ' + d.status + ' há mais de ' + DIAS.extratos + ' dias' };
  }
  if (colecao === 'pedidosFgts') {
    if (!FIM_DO_FGTS.includes(d.status)) return null;
    if (!velho(d.fimEm ? 'fimEm' : 'criadoEm', DIAS.fgtsTelas)) return null;
    return { apagar: ['telas', 'ao-vivo'], motivo: 'pedido do FGTS ' + d.status + ' há mais de ' + DIAS.fgtsTelas + ' dias' };
  }
  if (colecao === 'feedbacks') {
    if (d.status !== 'feito') return null;
    if (!velho('criadoEm', DIAS.feedbacks)) return null;
    return { apagar: ['partes'], motivo: 'feedback feito, de mais de ' + DIAS.feedbacks + ' dias' };
  }
  return null;
}

/** O modo pelo ambiente: 'apagar' (o padrão), 'simular' ou 'desligada'. */
function modoDaFaxina(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (['simular', 'simulacao', 'simulação', 'teste'].includes(v)) return 'simular';
  if (['desligada', 'desligado', 'nao', 'não', 'off', '0'].includes(v)) return 'desligada';
  return 'apagar';
}

// ---------- com o banco ----------

/**
 * Uma faxina: devolve { pedacos, bytes (aproximado, pelo tamanho do Base64), pais, porMotivo, erros, simulado }.
 * opcoes: { modo, agora }.
 */
async function faxinar(db, log, opcoes) {
  const o = Object.assign({ modo: 'apagar', agora: Date.now() }, opcoes);
  const r = { pedacos: 0, bytes: 0, pais: 0, porMotivo: {}, erros: [], simulado: o.modo === 'simular' };
  const consultas = [
    ['extratosRecebidos', db.collection('extratosRecebidos').where('status', 'in', ['importado', 'ignorado'])],
    ['pedidosFgts', db.collection('pedidosFgts').where('status', 'in', FIM_DO_FGTS)],
    ['feedbacks', db.collection('feedbacks').where('status', '==', 'feito')],
  ];
  for (const [colecao, consulta] of consultas) {
    try {
      const snap = await consulta.get();
      for (const doc of snap.docs) {
        if (r.pais >= MAX_PAIS_POR_VEZ) break;
        const plano = oQueApagar(colecao, doc.data(), o.agora);
        if (!plano) continue;
        let achou = 0;
        for (const sub of plano.apagar) {
          const pedacos = await doc.ref.collection(sub).get();
          for (const p of pedacos.docs) {
            const x = p.data() || {};
            const arquivo = x.dados || x.imagem || x.base64;   // texto em Base64 ou bytes (o arquivo do feedback)
            r.bytes += arquivo && typeof arquivo.length === 'number' ? arquivo.length : 0;
            achou++;
            if (!r.simulado) await p.ref.delete();
          }
        }
        r.pais++;
        r.pedacos += achou;
        r.porMotivo[plano.motivo] = (r.porMotivo[plano.motivo] || 0) + achou;
        if (!r.simulado) await doc.ref.update({ partesApagadasEm: new Date(o.agora).toISOString() });
      }
    } catch (err) {
      r.erros.push(colecao + ': ' + (err && err.message ? err.message : String(err)));
    }
  }
  if (r.pedacos || r.erros.length) log('faxina do banco' + (r.simulado ? ' (SIMULAÇÃO, nada apagado)' : '') + ': ' + r.pedacos + ' pedaço(s), ~' + (r.bytes / 1048576).toFixed(1) + ' MB, de ' + r.pais + ' documento(s)' + (Object.keys(r.porMotivo).length ? ' — ' + Object.entries(r.porMotivo).map(([m, n]) => n + ' de ' + m).join('; ') : '') + (r.erros.length ? '; erros: ' + r.erros.join(' | ') : ''));
  return r;
}

/** Liga a faxina: uma por dia (o último dia feito fica em robo/faxinaBanco). */
function iniciarFaxinaDoBanco(db, log) {
  const modo = modoDaFaxina(process.env.FAXINA_BANCO);
  if (modo === 'desligada') { log('faxina do banco desligada (FAXINA_BANCO)'); return; }
  const ref = db.collection(DOC_DO_ESTADO[0]).doc(DOC_DO_ESTADO[1]);
  let rodando = false;
  async function talvez() {
    if (rodando) return;
    rodando = true;
    try {
      const d = await ref.get();
      const em = d.exists ? Date.parse(d.data().em || '') : NaN;
      if (Number.isFinite(em) && Date.now() - em < VALIDADE_MS) return;
      const r = await faxinar(db, log, { modo });
      await ref.set({ em: new Date().toISOString(), modo, pedacos: r.pedacos, bytes: r.bytes, pais: r.pais, porMotivo: r.porMotivo, erros: r.erros.slice(0, 10) });
    } catch (err) {
      log('faxina do banco falhou -', err && err.message ? err.message : String(err));
    } finally { rodando = false; }
  }
  setTimeout(talvez, PRIMEIRA_ESPERA_MS);
  setInterval(talvez, CONFERE_A_CADA_MS);
  log('faxina do banco ligada' + (modo === 'simular' ? ' em SIMULAÇÃO' : '') + ' (os pedaços de arquivo já usados, uma vez por dia)');
}

module.exports = { iniciarFaxinaDoBanco, faxinar, oQueApagar, modoDaFaxina, quando, DIAS, FIM_DO_FGTS };
