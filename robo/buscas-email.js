// "Buscar no e-mail" do nads (Vitor, 13/10/2026: na tela de Bancos, o extrato que não está no Drive pode estar num e-mail;
// a pessoa filtra pelo remetente e pelo período recebido e clica para buscar).
//
// A tela grava um pedido em buscasEmail. Dois tipos:
//   { tipo: 'buscar', remetente, de: 'aaaa-mm-dd', ate: 'aaaa-mm-dd', status: 'pendente', criadoPor, criadoPorUid }
//     → o robô pesquisa nas caixas do robô e do contábil os e-mails com anexo (PDF, OFX, planilha) do remetente no período
//       e responde no próprio pedido: { status: 'pronto', resultados: [{ caixa, mensagemId, anexoId, nome, tamanho, de,
//       assunto, em, trecho }] } (no máximo MAX_RESULTADOS; trecho = o começo do corpo, para a tela achar o mês);
//   { tipo: 'trazer', caixa, mensagemId, anexoId, nome, status: 'pendente', ... }
//     → o robô confere que o anexo é um dos que ele mesmo listou numa busca desta pessoa, baixa e põe o conteúdo em
//       pedaços em buscasEmail/{id}/partes/{n} ({ n, bytes }: binário, 26/10/2026; antes { dados: base64 }); { status: 'pronto',
//       partes, tamanho, formato: 'bytes' }.
// Mais rápido (Vitor, 26/10/2026: "anexar o arquivo está demorando muito"): os pedaços em binário (o base64 era 33% maior),
// gravados 4 de cada vez (antes, um depois do outro), e o trazer não espera as buscas (duas filas; o trazer, 2 de cada vez).
// Nada fica guardado: o pedido e os pedaços somem em DURA_MS. Só admin ou contábil pede (regras do Firestore); cada um
// lê só o seu. Nada é enviado, apagado ou marcado no Gmail.
const { ouvir } = require('./ouvinte');
const { cabecalho } = require('./leituras-gmail');
const { consertarAcentos } = require('./acentos');
const { podeLer } = require('./gmail-client');

const DURA_MS = 30 * 60 * 1000;
const MAX_RESULTADOS = 40;
const MAX_MENSAGENS = 60;
// o pedaço em binário (o documento do Firestore vai até 1 MiB)
const PEDACO = 900000;
const JUNTOS = 4;
const MAX_ANEXO = 15 * 1024 * 1024;
const CAIXAS = ['robo', 'contabil'];
const EXTENSOES = /\.(pdf|ofx|xlsx?|csv|txt)$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// a data do Gmail (after/before usam aaaa/mm/dd; o before não inclui o dia)
const paraGmail = iso => iso.replace(/-/g, '/');
const diaSeguinte = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** A busca do Gmail: anexo, o remetente (endereço ou nome) e o período recebido. */
function consultaDaBusca(p) {
  const partes = ['has:attachment'];
  const rem = String(p.remetente || '').replace(/["()]/g, ' ').trim();
  if (rem) partes.push('from:(' + rem + ')');
  if (DATA.test(p.de || '')) partes.push('after:' + paraGmail(p.de));
  if (DATA.test(p.ate || '')) partes.push('before:' + paraGmail(diaSeguinte(p.ate)));
  return partes.join(' ');
}

function anexosDe(part, acc) {
  if (!part) return acc;
  if (part.filename && part.body && part.body.attachmentId && EXTENSOES.test(part.filename)) {
    acc.push({ nome: part.filename, tamanho: Number(part.body.size || 0), anexoId: part.body.attachmentId });
  }
  (part.parts || []).forEach(p => anexosDe(p, acc));
  return acc;
}

function iniciarBuscasEmail(db, log, getGmail) {
  const pedidos = db.collection('buscasEmail');

  async function buscar(ref, p) {
    if (!String(p.remetente || '').trim() && !(DATA.test(p.de || '') && DATA.test(p.ate || ''))) throw new Error('informe o remetente ou o período');
    const q = consultaDaBusca(p);
    const resultados = [];
    for (const caixa of CAIXAS) {
      // só a caixa que o robô tem permissão de ler
      if (!podeLer(caixa)) continue;
      let gmail;
      try { gmail = getGmail(caixa); } catch (e) { continue; }
      if (!gmail) continue;
      const lista = (await gmail.users.messages.list({ userId: 'me', q, maxResults: MAX_MENSAGENS })).data.messages || [];
      for (const m of lista) {
        if (resultados.length >= MAX_RESULTADOS) break;
        const msg = (await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })).data;
        const headers = (msg.payload && msg.payload.headers) || [];
        const em = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : '';
        for (const a of anexosDe(msg.payload, [])) {
          if (resultados.length >= MAX_RESULTADOS) break;
          resultados.push({ caixa, mensagemId: m.id, anexoId: a.anexoId, nome: a.nome, tamanho: a.tamanho, de: cabecalho(headers, 'From'), assunto: consertarAcentos(cabecalho(headers, 'Subject')), em, trecho: consertarAcentos(String(msg.snippet || '')).slice(0, 300) });
        }
      }
    }
    resultados.sort((a, b) => String(b.em).localeCompare(String(a.em)));
    await ref.update({ status: 'pronto', resultados, prontoEm: new Date().toISOString() });
    log('busca no e-mail:', q, '→', resultados.length, 'anexo(s) para', p.criadoPor || 'alguém');
  }

  async function trazer(ref, p) {
    // só um anexo que o robô listou numa busca desta pessoa (o pedido não vira um jeito de baixar qualquer anexo)
    const buscas = await pedidos.where('criadoPorUid', '==', p.criadoPorUid || '-').where('tipo', '==', 'buscar').get();
    const listado = buscas.docs.some(d => ((d.data() || {}).resultados || []).some(r => r.mensagemId === p.mensagemId && r.anexoId === p.anexoId && r.caixa === p.caixa));
    if (!listado) throw new Error('este anexo não está numa busca sua (busque de novo)');
    const gmail = getGmail(CAIXAS.includes(p.caixa) ? p.caixa : 'robo');
    const a = (await gmail.users.messages.attachments.get({ userId: 'me', messageId: p.mensagemId, id: p.anexoId })).data;
    const buffer = Buffer.from(String(a.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!buffer.length || buffer.length > MAX_ANEXO) throw new Error('anexo vazio ou grande demais');
    const n = Math.ceil(buffer.length / PEDACO);
    const gravar = i => ref.collection('partes').doc(String(i)).set({ n: i, bytes: buffer.subarray(i * PEDACO, (i + 1) * PEDACO) });
    for (let i = 0; i < n; i += JUNTOS) await Promise.all(Array.from({ length: Math.min(JUNTOS, n - i) }, (_, k) => gravar(i + k)));
    await ref.update({ status: 'pronto', partes: n, tamanho: buffer.length, formato: 'bytes', prontoEm: new Date().toISOString() });
    log('anexo do e-mail para o nads:', p.nome || p.anexoId, '(' + buffer.length + ' bytes) para', p.criadoPor || 'alguém');
  }

  async function atender(doc) {
    const ref = doc.ref;
    const p = doc.data() || {};
    try {
      await ref.update({ status: 'buscando' });
      if (p.tipo === 'trazer') await trazer(ref, p); else await buscar(ref, p);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      await ref.update({ status: 'erro', erro: msg, erroEm: new Date().toISOString() }).catch(() => {});
      log('busca no e-mail falhou:', msg);
    }
  }

  async function apagar(ref) {
    const ps = await ref.collection('partes').get();
    for (const d of ps.docs) await d.ref.delete();
    await ref.delete();
  }
  async function limpar() {
    try {
      const velhos = await pedidos.where('criadoEm', '<', new Date(Date.now() - DURA_MS).toISOString()).limit(100).get();
      for (const d of velhos.docs) await apagar(d.ref);
    } catch (e) {}
  }

  // duas filas: o trazer (a pessoa esperando o anexo) não fica atrás de uma busca; 2 anexos de cada vez
  const filas = { buscar: [], trazer: [] };
  const rodando = { buscar: 0, trazer: 0 };
  const LIMITE = { buscar: 1, trazer: 2 };
  function andar(t) {
    while (rodando[t] < LIMITE[t] && filas[t].length) {
      const d = filas[t].shift();
      rodando[t]++;
      atender(d).finally(() => { rodando[t]--; andar(t); });
    }
  }
  ouvir('buscas no e-mail', () => pedidos.where('status', '==', 'pendente'), snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type !== 'added') return;
      const t = (ch.doc.data() || {}).tipo === 'trazer' ? 'trazer' : 'buscar';
      filas[t].push(ch.doc); andar(t);
    });
  }, log);
  limpar();
  setInterval(limpar, 5 * 60 * 1000);
  log('buscar no e-mail pelo nads ligado (apaga em ' + Math.round(DURA_MS / 60000) + ' min)');
}

module.exports = { iniciarBuscasEmail, consultaDaBusca };
