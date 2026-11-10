// Os alertas dos robôs (10/11/2026, Central dos robôs › Ajustes › Alertas), no documento config/robosAlertas: quem é avisado
// no celular quando um robô dá erro, uma máquina fica sem sinal ou o disco enche. Vem DESLIGADO: sem o documento, com
// `ligado` diferente de true ou sem ninguém escolhido, não sai aviso nenhum e o robô só lê este documento, a cada 5 min.
// Usa o aviso no celular que já existe (avisos-push.js). O limite de repetição fica em robosAlertasEstado/{maquina}, para
// valer também depois de um reinício.
//   nuvem     olha os erros, o disco de todas as máquinas e o sinal do servidor e do PC
//   servidor  olha só o sinal da nuvem (a nuvem não consegue avisar que ela mesma caiu)
'use strict';

let catalogo = { maquinas: [], robos: [] };
try { catalogo = require('../packages/core/src/robos/catalogo.json'); } catch (e) { /* cópia só do robo/: nenhum alerta */ }

const LIM = (catalogo.limites || {}).alertas || { repetirMin: [15, 1440], maxPorHora: [1, 30], semSinalMin: [15, 1440], discoLimite: [50, 99], padrao: { repetirMin: 60, maxPorHora: 6, semSinalMin: 15, discoLimite: 90 } };
const TICK_MS = 5 * 60 * 1000;
const HORA_MS = 36e5;
const LINK = 'https://robos.nilmacontabilidade.com/robos';
const UID_OK = /^[A-Za-z0-9_-]{1,128}$/;
const MAQUINAS = catalogo.maquinas.map(m => m.id);
const ROBOS = catalogo.robos.map(r => r.id);

const noLimite = (v, [min, max], padrao) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : padrao; };
const daLista = (v, validos) => (Array.isArray(v) ? [...new Set(v.map(String))].filter(x => validos.includes(x)) : []);

/** O documento conferido: o que não fecha volta ao padrão, e o padrão é desligado. */
function lerAlertas(bruto) {
  const d = bruto && typeof bruto === 'object' ? bruto : {};
  const e = d.erro || {}, s = d.semSinal || {}, q = d.disco || {};
  return {
    ligado: d.ligado === true,
    pessoas: (Array.isArray(d.pessoas) ? [...new Set(d.pessoas.map(String))].filter(x => UID_OK.test(x)) : []).slice(0, 30),
    erro: { ligado: e.ligado === true, robos: daLista(e.robos, ROBOS) },
    semSinal: { ligado: s.ligado === true, minutos: noLimite(s.minutos, LIM.semSinalMin, LIM.padrao.semSinalMin), maquinas: daLista(s.maquinas, MAQUINAS) },
    disco: { ligado: q.ligado === true, limite: noLimite(q.limite, LIM.discoLimite, LIM.padrao.discoLimite), maquinas: daLista(q.maquinas, MAQUINAS) },
    repetirMin: noLimite(d.repetirMin, LIM.repetirMin, LIM.padrao.repetirMin),
    maxPorHora: noLimite(d.maxPorHora, LIM.maxPorHora, LIM.padrao.maxPorHora),
    atualizadoEm: String(d.atualizadoEm || ''),
  };
}

const nomeDaMaquina = id => (catalogo.maquinas.find(m => m.id === id) || {}).nome || id;
const roboDaAtividade = a => catalogo.robos.find(r => (r.tipos || []).includes(a.tipo)) || null;

/** Um aviso por robô, com o primeiro erro e quantos houve. Lista de robôs vazia = todos. */
function eventosDeErro(atividades, cfg) {
  const porRobo = new Map();
  for (const a of atividades) {
    if (a.erro !== true) continue;
    const r = roboDaAtividade(a);
    if (!r || (cfg.erro.robos.length && !cfg.erro.robos.includes(r.id))) continue;
    if (!porRobo.has(r.id)) porRobo.set(r.id, { r, itens: [] });
    porRobo.get(r.id).itens.push(a);
  }
  return [...porRobo.values()].map(({ r, itens }) => ({
    chave: 'erro-' + r.id,
    titulo: r.nome + ': ' + (itens.length === 1 ? 'erro' : itens.length + ' erros'),
    corpo: String(itens[0].texto || '').slice(0, 200),
  }));
}

/** Sinal e disco. `sinalDe`: as máquinas cujo sinal esta olha; `discoDe`: as cujo disco esta olha. */
function eventosDeMaquinas(estados, cfg, agora, sinalDe, discoDe) {
  const saida = [];
  for (const id of MAQUINAS) {
    const e = estados[id];
    if (!e) continue;
    const idade = agora - Date.parse(String(e.em || ''));
    if (!Number.isFinite(idade)) continue;
    const quieta = idade >= cfg.semSinal.minutos * 60000;
    if (cfg.semSinal.ligado && sinalDe.includes(id) && cfg.semSinal.maquinas.includes(id) && quieta) {
      saida.push({ chave: 'sinal-' + id, titulo: nomeDaMaquina(id) + ' sem sinal', corpo: 'Sem notícia há ' + Math.round(idade / 60000) + ' min.' });
    }
    const disco = Number((e.sinais || {}).disco);
    if (cfg.disco.ligado && discoDe.includes(id) && cfg.disco.maquinas.includes(id) && !quieta && Number.isFinite(disco) && disco >= cfg.disco.limite) {
      saida.push({ chave: 'disco-' + id, titulo: nomeDaMaquina(id) + ': disco enchendo', corpo: 'Disco em ' + Math.round(disco) + '% (limite ' + cfg.disco.limite + '%).' });
    }
  }
  return saida;
}

/** Quais eventos saem agora, respeitando a repetição por assunto e o máximo por hora de todos juntos. */
function decidir(cfg, eventos, estado, agora) {
  const chaves = estado.chaves || {};
  const recentes = (Array.isArray(estado.envios) ? estado.envios : []).filter(t => agora - Date.parse(t) < HORA_MS);
  let cabem = Math.max(0, cfg.maxPorHora - recentes.length);
  const enviar = [];
  for (const ev of eventos) {
    const ultima = Date.parse(String(chaves[ev.chave] || ''));
    if (Number.isFinite(ultima) && agora - ultima < cfg.repetirMin * 60000) continue;
    if (cabem <= 0) break;
    cabem--;
    enviar.push(ev);
  }
  return enviar;
}

/** Depois de enviar: guarda quando cada assunto saiu (e esquece o que tem mais de 7 dias, para o documento não crescer). */
function estadoDepois(estado, enviados, agora, vistoEm) {
  const iso = new Date(agora).toISOString();
  const chaves = {};
  for (const [k, v] of Object.entries(estado.chaves || {})) if (agora - Date.parse(v) < 7 * 864e5) chaves[k] = v;
  for (const ev of enviados) chaves[ev.chave] = iso;
  const envios = (Array.isArray(estado.envios) ? estado.envios : []).filter(t => agora - Date.parse(t) < HORA_MS).concat(enviados.map(() => iso));
  return { chaves, envios, vistoEm };
}

/** Liga o vigia dos alertas nesta máquina (nuvem ou servidor); devolve como parar. `enviarPara` é trocado nos testes. */
function iniciarAlertas({ db, maquina, log = () => {}, enviarPara = null }) {
  if (maquina !== 'nuvem' && maquina !== 'servidor') return { parar() {}, tique: async () => {} };
  const naNuvem = maquina === 'nuvem';
  const sinalDe = naNuvem ? MAQUINAS.filter(m => m !== 'nuvem') : ['nuvem'];
  const discoDe = naNuvem ? MAQUINAS : [];
  let rodando = false;
  let envio = enviarPara;
  // o estado (o que já saiu e até onde já viu) fica na memória entre as voltas e vai ao banco quando sai um aviso ou a cada
  // 30 min (10/11/2026, consumo do banco: era uma leitura e uma gravação a cada 5 min, 288 gravações por dia sem aviso nenhum)
  let estadoNaMemoria = null;
  let guardadoEm = 0;
  const GUARDAR_A_CADA_MS = 30 * 60 * 1000;
  const mandar = (...a) => {
    if (!envio) envio = require('./avisos-push').criarEnvio(db, log).enviarPara;   // só aqui: sem alerta ligado, nem carrega o envio
    return envio(...a);
  };

  async function tique(agora = Date.now()) {
    if (rodando) return;
    rodando = true;
    try {
      const cfg = lerAlertas((await db.collection('config').doc('robosAlertas').get()).data());
      if (!cfg.ligado || !cfg.pessoas.length) return;
      const ref = db.collection('robosAlertasEstado').doc(maquina);
      const estado = estadoNaMemoria || (await ref.get()).data() || {};
      const eventos = [];
      const querMaquinas = (cfg.semSinal.ligado && sinalDe.length) || (cfg.disco.ligado && discoDe.length);
      if (querMaquinas) {
        const ids = [...new Set([...sinalDe, ...discoDe])];
        const estados = {};
        for (const id of ids) { const s = await db.collection('robosMaquinas').doc(id).get(); if (s.exists) estados[id] = s.data(); }
        eventos.push(...eventosDeMaquinas(estados, cfg, agora, sinalDe, discoDe));
      }
      // nada de antes: nem do tempo em que estava desligado, nem de antes de alguém mexer na configuração
      const antesDeTudo = new Date(agora - TICK_MS).toISOString();
      const desde = [estado.vistoEm || antesDeTudo, cfg.atualizadoEm].filter(Boolean).sort().pop();
      let vistoEm = estado.vistoEm || antesDeTudo;
      if (naNuvem && cfg.erro.ligado) {
        const snap = await db.collection('roboAtividade').where('em', '>', desde).limit(200).get();
        const atividades = snap.docs.map(d => d.data());
        eventos.unshift(...eventosDeErro(atividades, cfg));
      }
      vistoEm = new Date(agora).toISOString();
      const saem = decidir(cfg, eventos, estado, agora);
      const enviados = [];
      for (const ev of saem) {
        try { await mandar(cfg.pessoas, ev.titulo, ev.corpo, 'robo-' + ev.chave, LINK); enviados.push(ev); }
        catch (err) { log('alertas: o aviso "' + ev.titulo + '" não saiu -', String((err && err.message) || err)); }
      }
      const depois = estadoDepois(estado, enviados, agora, vistoEm);
      estadoNaMemoria = depois;
      if (enviados.length || (naNuvem && agora - guardadoEm >= GUARDAR_A_CADA_MS)) { guardadoEm = agora; await ref.set(depois); }
    } catch (err) {
      log('alertas: não consegui conferir -', String((err && err.message) || err));
    } finally { rodando = false; }
  }

  const relogio = setInterval(() => { void tique(); }, TICK_MS);
  if (typeof relogio.unref === 'function') relogio.unref();
  return { parar: () => clearInterval(relogio), tique };
}

module.exports = { lerAlertas, eventosDeErro, eventosDeMaquinas, decidir, estadoDepois, iniciarAlertas };
