// O login pelo nome (Vitor, 12/11/2026: "deixe logar com o usuário ou e-mail"): o nome vira nome@nilma.local, mas quem
// trocou o e-mail de entrada (ou o próprio nome) não está mais lá. Aqui o robô mantém loginPorNome/{chave do nome} =
// { email, uid } a partir da equipe (usuarios), e a tela de entrada do nads lê o índice antes de entrar. Também é por
// ele que o convite sabe que um nome já tem dono (o nome é único). A regra do banco deixa qualquer um ler UM documento
// (get, nunca list) e ninguém gravar: só o robô, com o Admin SDK.
const { ouvir } = require('./ouvinte');

const COLECAO = 'loginPorNome';

/** A mesma chave do nads (packages/core usuarios.chaveDoNome): sem acento, minúsculo, o que não é letra/número vira ponto. */
const chaveDoNome = nome => String(nome || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '');

const avisados = new Set();   // o aviso de nome repetido sai uma vez só (a presença traz a equipe toda hora)

/** O índice que a equipe pede: um nome, uma conta; nome repetido fica com a conta mais antiga (e o robô avisa no log). */
function indiceDaEquipe(docs, log) {
  const indice = new Map();
  for (const d of docs) {
    const u = d.data() || {};
    const chave = chaveDoNome(u.nome);
    const email = String(u.email || '').trim().toLowerCase();
    if (!chave || !email) continue;
    const criadoEm = String(u.criadoEm || '');
    const antes = indice.get(chave);
    if (antes) {
      if (!avisados.has(chave)) { avisados.add(chave); log('login pelo nome: o nome "' + chave + '" está em duas contas; fica a mais antiga'); }
      if (antes.criadoEm && (!criadoEm || criadoEm >= antes.criadoEm)) continue;
    }
    indice.set(chave, { email, uid: d.id, criadoEm });
  }
  return indice;
}

function iniciarLoginPorNome(db, log) {
  let gravado = null;          // o que está no banco: chave → "email|uid"
  let ultimo = null;           // a última equipe que chegou
  let ocupado = false;
  let deNovo = false;
  async function sincronizar() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        if (!gravado) {
          gravado = new Map();
          for (const d of (await db.collection(COLECAO).get()).docs) gravado.set(d.id, String(d.get('email') || '') + '|' + String(d.get('uid') || ''));
        }
        const quer = indiceDaEquipe(ultimo || [], log);
        const lote = db.batch();
        let mudou = 0;
        for (const [chave, v] of quer) {
          if (gravado.get(chave) === v.email + '|' + v.uid) continue;
          lote.set(db.collection(COLECAO).doc(chave), { email: v.email, uid: v.uid, em: new Date().toISOString() });
          gravado.set(chave, v.email + '|' + v.uid); mudou++;
        }
        for (const chave of [...gravado.keys()]) {
          if (quer.has(chave)) continue;
          lote.delete(db.collection(COLECAO).doc(chave));
          gravado.delete(chave); mudou++;
        }
        if (mudou) { await lote.commit(); log('login pelo nome: índice atualizado (' + mudou + ' nome(s))'); }
      } while (deNovo);
    } catch (err) {
      gravado = null;          // na próxima, relê o que está no banco
      log('login pelo nome: não atualizei o índice:', err.message);
    } finally { ocupado = false; }
  }
  // a presença (nadsVistoEm) muda o tempo todo: o snapshot só traz o que mudou, e só se grava quando nome ou e-mail mudam
  ouvir('Login pelo nome', () => db.collection('usuarios'), snap => { ultimo = snap.docs; void sincronizar(); }, log);
  log('login pelo nome (índice loginPorNome): ligado');
}

module.exports = { iniciarLoginPorNome, chaveDoNome, indiceDaEquipe };
