'use strict';
// O acesso por pessoa à Área do Cliente (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por
// pessoa"; desenho em docs/acessorias/desenho-senha-por-pessoa.md). Roda no robô da nuvem (o vigia), que tem o Admin SDK.
//
// A equipe cadastra a pessoa no nads (areaClientePessoas/{id}: codigo, nome, email, ativo). Este robô:
//   - acha o link de cada empresa (areasClientePorEmpresa/{codigo}.token: trocar o link não tira a senha);
//   - para cada e-mail, cria o login no Firebase SEM senha (a pessoa cria a dela pelo "Criar ou trocar a senha" da tela de
//     entrar, o e-mail do próprio Firebase) e põe no login as permissões { cliente: true, a: [tokens] } (core:
//     permissoesPorEmail), que a regra do banco confere;
//   - tirou a pessoa (ativo false) ou ela ficou sem empresa: a lista vazia e as sessões derrubadas (revokeRefreshTokens);
//   - responde na ficha: situacao 'pronto' (já entra) ou 'erro' (com o motivo).
// NUNCA mexe numa conta da equipe (quem tem usuarios/{uid}): a ficha fica com erro e o login dela não muda.
// Leituras: dois ouvintes pequenos (as fichas e os ponteiros das empresas); a conta só quando algo muda.

const crypto = require('crypto');
const ESPERA_MS = 5000;

/** deps: { db, auth (getAuth() do firebase-admin), log, ouvir, core: () => o pacote gerado } */
function iniciarAcessoCliente({ db, auth, log, ouvir, core }) {
  const fichas = new Map();     // id -> { codigo, nome, email, ativo, situacao, erro, uid }
  const tokenDe = new Map();    // codigo -> token
  const aplicado = new Map();   // email -> JSON das permissões já gravadas (para não chamar o Auth à toa)
  let prontos = { fichas: false, ponteiros: false };
  let relogio = null;
  let rodando = false, deNovo = false;

  const agendar = () => { if (!prontos.fichas || !prontos.ponteiros) return; clearTimeout(relogio); relogio = setTimeout(() => void rodar(), ESPERA_MS); };

  async function responder(id, campos) {
    const f = fichas.get(id);
    if (!f || (f.situacao === campos.situacao && (f.erro || '') === (campos.erro || '') && (!campos.uid || f.uid === campos.uid))) return;
    try { await db.collection('areaClientePessoas').doc(id).update(Object.assign({ respondidoEm: new Date().toISOString() }, campos)); }
    catch (e) { log('Acesso do cliente: não deu para responder na ficha', id, '-', e.message); }
  }

  async function rodar() {
    if (rodando) { deNovo = true; return; }
    rodando = true;
    try {
      const P = core();
      const lista = [...fichas.entries()].map(([id, f]) => ({ id, email: f.email, ativo: f.ativo !== false, tokens: tokenDe.has(Number(f.codigo)) ? [tokenDe.get(Number(f.codigo))] : [] }));
      const porEmail = P.permissoesPorEmail(lista);
      for (const [email, perm] of porEmail) {
        const minhas = lista.filter(f => P.normalizarEmail(f.email) === email);
        const chave = JSON.stringify(perm);
        if (aplicado.get(email) === chave && minhas.every(f => fichas.get(f.id).situacao === (f.ativo ? 'pronto' : fichas.get(f.id).situacao))) continue;
        try {
          let user = await auth.getUserByEmail(email).catch(e => (e && e.code === 'auth/user-not-found' ? null : Promise.reject(e)));
          // a ficha ativa de empresa sem link: avisa na ficha (a pessoa ainda não tem o que abrir)
          for (const f of minhas) if (f.ativo && !f.tokens.length) await responder(f.id, { situacao: 'erro', erro: 'A empresa ainda não tem link na Área do Cliente.' });
          // sem link nenhum e sem login: nada a criar
          if (!user && !perm.a.length) { aplicado.set(email, chave); continue; }
          // a conta da equipe nunca vira cliente
          if (user && (await db.collection('usuarios').doc(user.uid).get()).exists) {
            for (const f of minhas) await responder(f.id, { situacao: 'erro', erro: 'Este e-mail é de alguém da equipe do escritório. Use outro e-mail.' });
            aplicado.set(email, chave);
            continue;
          }
          if (!user) user = await auth.createUser({ email, emailVerified: false, disabled: false });
          // a conta que já existia sem a marca de cliente não foi o robô que fez (auditoria de segurança, 24/11/2026): pode ser de
          // um estranho que se adiantou com o e-mail do cliente. Senha aleatória e sessões derrubadas antes dos links; a pessoa
          // cria a senha dela pelo Pedir senha (core areaCliente/acessoPorPessoa.ts, contaPrecisaZerar)
          else if (perm.a.length && P.contaPrecisaZerar(user.customClaims)) {
            await auth.updateUser(user.uid, { password: crypto.randomBytes(32).toString('base64url') });
            await auth.revokeRefreshTokens(user.uid);
            log('Acesso do cliente:', email, '- a conta já existia sem ser do robô: senha zerada');
          }
          if (!P.mesmasPermissoes(user.customClaims, perm)) {
            // a lista de antes, lida ANTES de gravar a nova
            const antes = user.customClaims && Array.isArray(user.customClaims.a) ? user.customClaims.a.slice() : [];
            await auth.setCustomUserClaims(user.uid, perm);
            // tirou alguma empresa (ou todas): as sessões abertas caem e o login volta a pedir senha
            if (antes.some(t => !perm.a.includes(t))) await auth.revokeRefreshTokens(user.uid);
            log('Acesso do cliente:', email, '->', perm.a.length, perm.a.length === 1 ? 'link' : 'links');
          }
          for (const f of minhas) if (f.ativo) await responder(f.id, { situacao: f.tokens.length ? 'pronto' : 'erro', erro: f.tokens.length ? '' : 'A empresa ainda não tem link na Área do Cliente.', uid: user.uid });
          aplicado.set(email, chave);
        } catch (e) {
          log('Acesso do cliente:', email, 'falhou -', e.message);
          for (const f of minhas) if (f.ativo) await responder(f.id, { situacao: 'erro', erro: 'O robô não conseguiu criar o acesso (' + String(e.code || e.message).slice(0, 80) + ').' });
        }
      }
    } finally {
      rodando = false;
      if (deNovo) { deNovo = false; agendar(); }
    }
  }

  const pararFichas = ouvir('Acesso do cliente: pessoas', () => db.collection('areaClientePessoas'), snap => {
    fichas.clear();
    for (const d of snap.docs) {
      const x = d.data() || {};
      if (!x.email || !x.codigo) continue;
      fichas.set(d.id, { codigo: Number(x.codigo), nome: String(x.nome || ''), email: String(x.email), ativo: x.ativo !== false, situacao: String(x.situacao || ''), erro: String(x.erro || ''), uid: String(x.uid || '') });
    }
    prontos.fichas = true;
    agendar();
  }, log);
  const pararPonteiros = ouvir('Acesso do cliente: links das empresas', () => db.collection('areasClientePorEmpresa'), snap => {
    tokenDe.clear();
    for (const d of snap.docs) { const t = d.get('token'); if (typeof t === 'string') tokenDe.set(Number(d.id), t); }
    prontos.ponteiros = true;
    agendar();
  }, log);

  return { rodar, parar: () => { clearTimeout(relogio); pararFichas(); pararPonteiros(); } };
}

module.exports = { iniciarAcessoCliente };
