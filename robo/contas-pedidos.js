// A troca do e-mail de entrada (Vitor, 12/11/2026: "coloca email aqui pro diretor conseguir mudar tbm"): o Diretor ou o
// Dono pede no nads (Cadastro › Usuários › Acesso), ou a pessoa troca o próprio (Minha conta); pedidosConta com status 'fila'. Aqui, com o Admin SDK, o robô confere
// quem pediu, troca o login no Firebase Auth e o usuarios/{uid}.email, e marca 'feito' ou 'erro'. O navegador não tem
// como trocar o login de outra pessoa; o serviço de contas (Apps Script) só redefine senha e exclui acesso.
const { getAuth } = require('firebase-admin/auth');
const { ouvir } = require('./ouvinte');

const COLECAO = 'pedidosConta';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Quem pode pedir: o nível Diretor ou Dono, com o papel admin, e a conta ativa (a mesma conta que a regra do banco faz). */
const podePedir = d => !!d && (d.nivel === 'diretor' || d.nivel === 'dono') && Array.isArray(d.roles) && d.roles.includes('admin') && d.ativo !== false;

async function atenderUm(db, ref, log) {
  const p = (await ref.get()).data() || {};
  if (p.status !== 'fila') return;
  const falhar = msg => ref.update({ status: 'erro', erro: msg, feitoEm: new Date().toISOString() });
  try {
    if (p.acao !== 'trocarEmail') return await falhar('Pedido desconhecido.');
    const quem = (await db.collection('usuarios').doc(String((p.pedidoPor && p.pedidoPor.uid) || '-')).get()).data();
    // o próprio e-mail, qualquer um com a conta ativa (Vitor, 12/11/2026: "deixa o próprio usuário alterar o e-mail dele também")
    const proprio = !!quem && quem.ativo !== false && String(p.uidAlvo || '') === String(p.pedidoPor.uid);
    if (!proprio && !podePedir(quem)) return await falhar('Só o Diretor ou o Dono troca o e-mail de outra pessoa.');
    const alvoRef = db.collection('usuarios').doc(String(p.uidAlvo || '-'));
    const alvo = (await alvoRef.get()).data();
    if (!alvo) return await falhar('Não achei a pessoa.');
    if (!proprio && alvo.nivel === 'dono' && quem.nivel !== 'dono') return await falhar('O e-mail do Dono, só o Dono troca.');
    const email = String(p.emailNovo || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return await falhar('O e-mail não é válido.');
    const auth = getAuth();
    try {
      const outro = await auth.getUserByEmail(email);
      if (outro.uid !== p.uidAlvo) return await falhar('Esse e-mail já é o login de outra pessoa.');
    } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
    await auth.updateUser(String(p.uidAlvo), { email });
    await alvoRef.update({ email });
    await ref.update({ status: 'feito', emailAntigo: String(alvo.email || ''), feitoEm: new Date().toISOString() });
    log('contas: o e-mail de', alvo.nome, 'foi trocado (pedido de', quem.nome + ')');
  } catch (err) {
    log('contas: não troquei o e-mail do pedido', ref.id + ':', err.message);
    await falhar(String(err.message || err).slice(0, 300)).catch(() => {});
  }
}

function iniciarPedidosDeConta(db, log) {
  let ocupado = false;
  let deNovo = false;
  async function atender() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('status', '==', 'fila').get();
        for (const d of snap.docs) await atenderUm(db, d.ref, log);
      } while (deNovo);
    } catch (err) { log('contas: não li os pedidos:', err.message); } finally { ocupado = false; }
  }
  ouvir('Pedidos de conta', () => db.collection(COLECAO).where('status', '==', 'fila'), () => { void atender(); }, log);
  log('pedidos de conta (troca de e-mail): ligado');
}

module.exports = { iniciarPedidosDeConta, podePedir };
