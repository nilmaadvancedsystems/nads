'use strict';
// O e-mail de criar ou trocar a senha da Área do Cliente pelo robô do escritório (19/11/2026; o dono: "Sim, pelo robô",
// depois de o Firebase travar a mudança dos modelos de e-mail do projeto). Roda no robô da nuvem (o vigia).
//
// O site deixa o pedido em areaClienteSenhas { token, email, criadoEm } (sem login). Este robô:
//   - apaga o pedido na hora (a caixa só serve de entrada);
//   - confere o pedido (core: pedidoDeSenha) e os limites (3 por e-mail e 100 no total por dia);
//   - só manda se o login daquele e-mail tem o link nas permissões (o mesmo que a regra do banco confere) e não é da equipe;
//   - gera o código pelo Firebase (generatePasswordResetLink) e manda o e-mail da Nilma, em português, com o link da
//     página própria (/cliente/senha), pela caixa do robô e no freio de envios dele.
// E-mail sem acesso: nada sai e nada fica registrado com o e-mail (só a contagem no log).

const POR_EMAIL_POR_DIA = 3;
const TOTAL_POR_DIA = 100;
const diaIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** deps: { db, auth, log, ouvir, core, correio: { enviar, podeEnviar, contar }, agora } */
function iniciarSenhaDoCliente({ db, auth, log, ouvir, core, correio, agora = () => new Date() }) {
  const hoje = { dia: '', total: 0, porEmail: new Map() };
  const tratando = new Set();

  async function tratar(doc) {
    if (tratando.has(doc.id)) return 'ja';
    tratando.add(doc.id);
    try {
      const x = doc.data() || {};
      await doc.ref.delete().catch(() => {});
      const P = core();
      const p = P.pedidoDeSenha(x.token, x.email);
      if (!p) return 'torto';
      const dia = diaIso(agora());
      if (hoje.dia !== dia) { hoje.dia = dia; hoje.total = 0; hoje.porEmail.clear(); }
      if (hoje.total >= TOTAL_POR_DIA || (hoje.porEmail.get(p.email) || 0) >= POR_EMAIL_POR_DIA) return 'limite';
      hoje.porEmail.set(p.email, (hoje.porEmail.get(p.email) || 0) + 1);
      hoje.total++;
      // só quem tem o link no login (a mesma conta da regra do banco) e não é da equipe
      const user = await auth.getUserByEmail(p.email).catch(() => null);
      if (!user || !P.clienteAbreOLink(user.customClaims, p.token)) return 'sem acesso';
      if ((await db.collection('usuarios').doc(user.uid).get()).exists) return 'equipe';
      const link = P.linkDaPaginaDeSenha(await auth.generatePasswordResetLink(p.email));
      if (!link) { log('Senha do cliente: o Firebase não devolveu o código'); return 'sem codigo'; }
      const linkDoc = await db.collection('areasCliente').doc(p.token).get();
      const email = P.emailDeSenha(String((linkDoc.exists && linkDoc.get('nome')) || ''), link);
      if (!correio.podeEnviar(1)) { log('Senha do cliente: o freio de envios segurou um e-mail'); return 'freio'; }
      // o e-mail bonito (o desenho dos e-mails do escritório) e o texto puro junto
      const visual = require('./email-html').htmlDaSenha({ assunto: email.assunto, empresa: String((linkDoc.exists && linkDoc.get('nome')) || ''), link });
      await correio.enviar({ para: p.email, assunto: email.assunto, corpo: email.texto, html: visual.html, imagens: visual.imagens });
      correio.contar();
      log('Senha do cliente: e-mail de senha enviado (' + p.email.replace(/^(.).*(@.*)$/, '$1***$2') + ')');
      return 'enviado';
    } catch (e) {
      log('Senha do cliente: falhou -', e.message);
      return 'erro';
    } finally { tratando.delete(doc.id); }
  }

  const parar = ouvir('Senha do cliente: pedidos', () => db.collection('areaClienteSenhas'), snap => {
    for (const d of snap.docs) void tratar(d);
  }, log);
  return { tratar, parar };
}

module.exports = { iniciarSenhaDoCliente };
