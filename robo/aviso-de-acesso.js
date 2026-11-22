'use strict';
// O aviso de acesso novo e o "Não fui eu" (plano do Acessórias, ficha E21; o dono, 22/11/2026: "pode fazer tudo"). Roda no
// robô da nuvem (o vigia), com os avisos no celular (avisos-push.js):
//   - nadsSessoes criada nas últimas 24 h e ainda sem avisadoEm: avisa a própria pessoa (o computador, o dia e a hora; "se
//     não foi você, abra o nads › sua foto › Meus acessos › Não fui eu") e grava avisadoEm;
//   - nadsAlertas novo (o "Não fui eu" da Minha página, que já encerrou o acesso): avisa os admins e grava avisadoEm.
// Cada um avisa uma vez só. Os textos são do core (usuarios/regras/liberacao.ts).

const LINK = 'https://nilma-nads.web.app/';
const JANELA_MS = 24 * 60 * 60 * 1000;

/** deps: { db, log, avisos: { enviar, enviarPara }, core, agora, ouvir } */
function iniciarAvisoDeAcesso({ db, log, avisos, core, agora = () => Date.now(), ouvir = require('./ouvinte').ouvir }) {
  if (!avisos) { log('aviso de acesso novo desligado (sem avisos no celular)'); return null; }
  const vistas = new Set();
  const vistos = new Set();
  async function sessaoNova(d) {
    const s = d.data() || {};
    if (vistas.has(d.id) || s.avisadoEm || !s.uid) return false;
    const em = Date.parse(s.liberadoEm || '');
    if (!em || agora() - em > JANELA_MS) return false;
    vistas.add(d.id);
    const t = core().textoDoAvisoDeAcesso({ computador: String(s.computador || ''), liberadoEm: String(s.liberadoEm) });
    try {
      await avisos.enviarPara([s.uid], t.titulo, t.corpo, 'nads-acesso-' + d.id, LINK);
      await d.ref.update({ avisadoEm: new Date(agora()).toISOString() });
      log('aviso de acesso novo:', s.nome || s.uid);
      return true;
    } catch (e) { vistas.delete(d.id); log('aviso de acesso novo não saiu:', e.message); return false; }
  }
  async function alertaNovo(d) {
    const a = d.data() || {};
    if (vistos.has(d.id) || a.avisadoEm || a.tipo !== 'nao-fui-eu') return false;
    vistos.add(d.id);
    const t = core().textoDoAlertaNaoFuiEu(a);
    try {
      await avisos.enviar('admin', '', t.titulo, t.corpo, 'nads-alerta-' + d.id, LINK);
      await d.ref.update({ avisadoEm: new Date(agora()).toISOString() });
      log('"Não fui eu":', a.nome || a.uid, '-', a.computador || '');
      return true;
    } catch (e) { vistos.delete(d.id); log('aviso do "Não fui eu" não saiu:', e.message); return false; }
  }
  const desde = () => new Date(agora() - JANELA_MS).toISOString();
  const parar1 = ouvir('acessos novos do nads', () => db.collection('nadsSessoes').where('liberadoEm', '>=', desde()).limit(50), snap => { for (const d of snap.docs) void sessaoNova(d); }, log);
  const parar2 = ouvir('"Não fui eu" do nads', () => db.collection('nadsAlertas').where('em', '>=', desde()).limit(20), snap => { for (const d of snap.docs) void alertaNovo(d); }, log);
  log('aviso de acesso novo e "Não fui eu": ligado');
  return { sessaoNova, alertaNovo, parar: () => { try { parar1(); parar2(); } catch (e) { /* já parado */ } } };
}

module.exports = { iniciarAvisoDeAcesso };
