// A aprovação do arquivo que o cliente mandou (27/11/2026: "nao tem botao de aprovar"; o dono escolheu "Conferido e cliente
// vê"). Roda no robô da nuvem (vigia-robo.js), para não depender do robô do PC.
//
// A equipe grava areaClienteAprovacoes/{id do recebido} { por, porUid, em, tratada: false } (a regra do banco só deixa
// criar). O robô:
//   1. confere o recebido (areaClienteRecebidos/{id}) e o link dele;
//   2. marca o recebido como aprovado ({ aprovado: { por, em } }: a equipe vê o selo e ele sai dos "Novos");
//   3. marca o recibo do cliente (areasCliente/{token}/envios/{id}.aprovado.em: "Aprovado pelo escritório" na Área);
//   4. passa a aprovação para tratada. Recebido que não existe, já recusado ou aprovação torta: tratada sem mexer em nada.
const { ouvir } = require('./ouvinte');

const tokenValido = t => typeof t === 'string' && /^[0-9a-f]{40}$/.test(t);

/** A aprovação lida (a mesma regra do core, areaCliente/recusa.ts aprovacaoLida); null = torta. */
function aprovacaoLida(x) {
  const o = x && typeof x === 'object' ? x : {};
  if (typeof o.porUid !== 'string' || !o.porUid) return null;
  return { por: typeof o.por === 'string' ? o.por.slice(0, 80) : '', em: typeof o.em === 'string' ? o.em : '' };
}

/** O que fazer com a aprovação diante do recebido: { recebido, recibo } a gravar, ou null (sem efeito). */
function efeitoDaAprovacao(aprovacao, recebido, agora) {
  const a = aprovacaoLida(aprovacao);
  if (!a || !recebido || !tokenValido(recebido.token) || recebido.recusa) return null;
  const em = a.em || agora;
  return { token: recebido.token, recebido: { aprovado: { por: a.por, em } }, recibo: { aprovado: { em } } };
}

function iniciarAprovacoesDaArea(db, log) {
  const tratando = new Set();
  async function tratar(doc) {
    if (tratando.has(doc.id)) return;
    tratando.add(doc.id);
    try {
      const agora = new Date().toISOString();
      const recRef = db.collection('areaClienteRecebidos').doc(doc.id);
      const rec = (await recRef.get()).data() || null;
      const ef = efeitoDaAprovacao(doc.data(), rec, agora);
      if (!ef) { await doc.ref.set({ tratada: true, tratadaEm: agora, semEfeito: true }, { merge: true }); return; }
      await db.collection('areasCliente').doc(ef.token).collection('envios').doc(doc.id).set(ef.recibo, { merge: true });
      await recRef.set(ef.recebido, { merge: true });
      await doc.ref.set({ tratada: true, tratadaEm: agora }, { merge: true });
      log('Área do Cliente: aprovado', rec.nome || doc.id, '(' + (rec.codigo || '?') + ')');
    } catch (err) {
      log('Área do Cliente: a aprovação ficou para depois -', doc.id, err.message);
    } finally { tratando.delete(doc.id); }
  }
  ouvir('Área do Cliente: aprovações', () => db.collection('areaClienteAprovacoes').where('tratada', '==', false).limit(20), snap => { for (const d of snap.docs) void tratar(d); }, log);
  log('aprovações da Área do Cliente: ligado');
}

module.exports = { iniciarAprovacoesDaArea, efeitoDaAprovacao, aprovacaoLida };
