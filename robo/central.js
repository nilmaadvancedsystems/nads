// A Central dos robôs, do lado do robô (07/11/2026; o site é o robos-nilma, apps/web/src/aplicativos/robos). Cada
// máquina (servidor, nuvem, PC do escritório) liga UMA central, no processo principal dela, que faz três coisas:
//
//   1. ESCUTA OS COMANDOS DESTA MÁQUINA (robosComandos, maquina == esta, status == 'pendente') e só faz o que está na
//      LISTA FECHADA abaixo (ACOES). Nada vindo do banco vira comando de sistema: a ação é um nome; o que ela faz é o
//      código daqui (os ganchos). Recusa o comando velho (mais de 5 min), o do futuro, o repetido (o mesmo pedido no
//      último minuto) e o de robô/tarefa que esta máquina não conhece. Pega o comando numa transação (pendente → aceito;
//      duas centrais nunca fazem o mesmo) e responde no próprio documento: aceito → feito | erro, ou recusado, com a
//      mensagem. O documento fica como histórico (quem pediu, o quê, a resposta) por 30 dias; o 'assistir' (o "ao vivo"
//      da aba Registros) é apagado logo depois de atendido.
//   2. ESPELHA O LOG: as últimas 200 linhas de cada robô desta máquina em robosRegistros/{robo} (pela marca da linha:
//      [sieg], [fgts], [arquivo]...; sem marca, o robô "da casa" da máquina). Linha cortada em 300 caracteres, documento
//      com no máximo 60 KB, segredos tirados (token, senha, chave, Bearer...). Grava só quando mudou, e no máximo uma
//      vez a cada 2 min; com a aba Registros aberta no site (o comando 'assistir', vale 5 min), a cada 10 s.
//   3. PUBLICA O ESTADO DA MÁQUINA a cada minuto em robosMaquinas/{maquina}: o batimento, a versão, os sinais baratos
//      (CPU e memória pelo os, disco pelo fs.statfs, tempo ligada) e os robôs pausados.
//
// Regra deste módulo (a mesma do painel.js): NUNCA derrubar o robô. Sem permissão no banco (as regras novas ainda não
// publicadas) ou sem rede, loga UMA vez por hora e segue.
//
//   require('./central').iniciarCentral({ db, maquina: 'servidor', log });
//   require('./central').registrarPausa('ia', { pausar: async () => {...}, retomar: async () => {...} });
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

let catalogo = { maquinas: [], robos: [] };
try { catalogo = require('../packages/core/src/robos/catalogo.json'); } catch (e) { /* sem o catálogo (cópia só do robo/): nenhum robô conhecido, tudo é recusado */ }

// ---------- a LISTA FECHADA (a autoridade é ESTA; o catálogo do site só mostra; o teste-central.js confere as duas) ----------
const ACOES = Object.freeze(['pausar', 'retomar', 'rodar-agora', 'limpar-fila', 'reiniciar', 'atualizar', 'assistir']);
const ACOES_DA_MAQUINA = Object.freeze(['reiniciar', 'atualizar']);

const VALIDADE_MS = 5 * 60 * 1000;
const FUTURO_MS = 60 * 1000;
const REPETIDO_MS = 60 * 1000;
const HISTORICO_DIAS = 30;
const DIA_MS = 24 * 36e5;
const LINHAS = 200;
const MAX_LINHA = 300;
const MAX_BYTES = 60 * 1024;
const AO_VIVO_MS = 10 * 1000;
const DEVAGAR_MS = 2 * 60 * 1000;
const AO_VIVO_DURA_MS = 5 * 60 * 1000;
const ESTADO_A_CADA_MS = 60 * 1000;
const TRAVADO_MS = 30 * 60 * 1000;
const MAX_MENSAGEM = 300;

// ---------- funções puras (o teste-central.js roda sem banco) ----------

const robosDaMaquina = maquina => (catalogo.robos || []).filter(r => r.maquina === maquina);
const roboDaMaquina = (maquina, id) => robosDaMaquina(maquina).find(r => r.id === id) || null;

/** Tira da linha o que parece segredo (token, senha, chave de API, Bearer, cookie, base64 comprido). */
function limparSegredos(texto) {
  return String(texto == null ? '' : texto)
    .replace(/\b(bearer|basic)\s+[\w\-.~+/=]{8,}/gi, '$1 ***')
    .replace(/\b(token|access_token|refresh_token|id_token|senha|password|passwd|secret|segredo|client_secret|api[_-]?key|chave|authorization|cookie|set-cookie)(["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, '$1$2***')
    .replace(/\bAIza[\w-]{20,}/g, '***')
    .replace(/\bya29\.[\w\-.]+/g, '***')
    .replace(/\b(sk|pk|rk)-[\w-]{16,}/g, '***')
    .replace(/[A-Za-z0-9+_-]{40,}={0,2}/g, '***');
}

/** Uma linha do log pronta para o espelho: sem a cor do terminal, sem segredo, numa linha só, cortada. */
function linhaParaEspelho(texto) {
  const s = limparSegredos(String(texto || '').replace(/\x1b\[[0-9;]*m/g, '')).replace(/\s+/g, ' ').trim();
  return s.length > MAX_LINHA ? s.slice(0, MAX_LINHA - 1) + '…' : s;
}

/** De qual robô é a linha (pela 1ª marca [xxx]); sem marca conhecida, o robô "da casa" (tag '') da máquina. */
function roboDaLinha(maquina, linha) {
  const robos = robosDaMaquina(maquina);
  const m = /\[([a-z][\w-]*)\]/i.exec(String(linha || ''));
  const tag = m ? m[1].toLowerCase() : '';
  const comTag = tag && robos.find(r => (r.tags || []).includes(tag));
  if (comTag) return comTag.id;
  const daCasa = robos.find(r => (r.tags || []).includes(''));
  return daCasa ? daCasa.id : '';
}

const ehErro = linha => /\b(erro|error|falhou|falha|exception|não consegui|nao consegui)\b/i.test(linha);

/** A chave do "repetido": o mesmo pedido (ação + robô + tarefa) desta máquina. */
const chaveDoComando = c => [c.acao, c.robo || '', c.tarefa || ''].join('|');

/**
 * Confere um comando antes de fazer. ctx: { maquina, agora (ms), vistos: Set de ids já tratados, recentes: Map chave → ms,
 * tarefas: Set 'robo:tarefa' que esta máquina sabe rodar, pausaveis: Set de robôs com gancho de pausa }.
 * Devolve { fazer: true } | { fazer: false, ignorar: true } (não é para esta central: nem responde) | { fazer: false, motivo }.
 */
function conferirComando(id, c, ctx) {
  if (!c || typeof c !== 'object') return { fazer: false, ignorar: true };
  if (ctx.vistos && ctx.vistos.has(id)) return { fazer: false, ignorar: true };
  if (c.status !== 'pendente') return { fazer: false, ignorar: true };
  if (c.maquina !== ctx.maquina) return { fazer: false, ignorar: true };
  const acao = String(c.acao || '');
  if (!ACOES.includes(acao)) return { fazer: false, motivo: 'Ação fora da lista fechada: ' + acao.slice(0, 40) + '.' };
  const em = Date.parse(String(c.em || ''));
  if (!Number.isFinite(em)) return { fazer: false, motivo: 'Comando sem data.' };
  if (ctx.agora - em > VALIDADE_MS) return { fazer: false, motivo: 'Comando velho (mais de 5 min): peça de novo se ainda precisar.' };
  if (em - ctx.agora > FUTURO_MS) return { fazer: false, motivo: 'Comando com a data no futuro.' };
  if (!c.por || typeof c.por !== 'string') return { fazer: false, motivo: 'Comando sem quem pediu.' };
  const robo = String(c.robo || '');
  if (ACOES_DA_MAQUINA.includes(acao)) {
    if (robo && !roboDaMaquina(ctx.maquina, robo)) return { fazer: false, motivo: 'Robô desconhecido nesta máquina: ' + robo.slice(0, 40) + '.' };
  } else {
    const r = roboDaMaquina(ctx.maquina, robo);
    if (!r) return { fazer: false, motivo: 'Robô desconhecido nesta máquina: ' + robo.slice(0, 40) + '.' };
    if (acao === 'rodar-agora') {
      const tarefa = String(c.tarefa || '');
      if (!(r.tarefas || []).some(t => t.id === tarefa)) return { fazer: false, motivo: 'Tarefa desconhecida para o ' + r.nome + ': ' + tarefa.slice(0, 40) + '.' };
      if (ctx.tarefas && !ctx.tarefas.has(r.id + ':' + tarefa)) return { fazer: false, motivo: 'Esta máquina ainda não sabe rodar essa tarefa.' };
    }
    if ((acao === 'pausar' || acao === 'retomar') && !(r.pausavel && (!ctx.pausaveis || ctx.pausaveis.has(r.id)))) return { fazer: false, motivo: 'O ' + r.nome + ' ainda não sabe pausar.' };
    if (acao === 'limpar-fila' && !(r.limpavel && r.fila)) return { fazer: false, motivo: 'A fila do ' + r.nome + ' não se limpa por aqui.' };
  }
  if (acao !== 'assistir') {
    const antes = ctx.recentes && ctx.recentes.get(chaveDoComando(c));
    if (antes != null && ctx.agora - antes < REPETIDO_MS) return { fazer: false, motivo: 'Repetido: o mesmo pedido foi feito há menos de 1 min.' };
  }
  return { fazer: true };
}

/** O pedido parado em andamento há mais de 30 min? (a data mais nova entre as que os robôs gravam) */
function travado(d, andamento, agora) {
  if (!d || !andamento.includes(String(d.status || ''))) return false;
  const datas = ['atualizadoEm', 'iniciadoEm', 'inicioEm', 'comecouEm', 'em', 'criadoEm'].map(k => {
    const v = d[k];
    if (!v) return NaN;
    if (typeof v === 'string') return Date.parse(v);
    if (typeof v === 'number') return v;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    return NaN;
  }).filter(Number.isFinite);
  if (!datas.length) return false;
  return agora - Math.max(...datas) > TRAVADO_MS;
}

/** O documento do espelho: as últimas LINHAS, cortando do começo até caber em MAX_BYTES. */
function docDoEspelho(robo, maquina, linhas, emIso, aoVivoAte) {
  let l = linhas.slice(-LINHAS);
  const tamanho = () => Buffer.byteLength(JSON.stringify(l), 'utf8');
  while (l.length && tamanho() > MAX_BYTES - 1024) l = l.slice(Math.ceil(l.length / 10));
  return { robo, maquina, em: emIso, linhas: l, aoVivoAte: aoVivoAte ? new Date(aoVivoAte).toISOString() : '' };
}

/**
 * O espelho do log (sem banco: quem grava é `gravar(robo, doc)`, que devolve uma promessa). linha(texto) entra no robô
 * certo; tique(agora) grava o que mudou, respeitando o ritmo (10 s ao vivo, 2 min fora).
 */
function criarEspelho({ maquina, gravar }) {
  const buf = new Map();      // robo -> [{em, texto, nivel}]
  const sujo = new Set();
  const gravadoEm = new Map();
  const aoVivoAte = new Map();
  return {
    linha(texto, agora = Date.now()) {
      const t = linhaParaEspelho(texto);
      if (!t) return '';
      const robo = roboDaLinha(maquina, t);
      if (!robo) return '';
      const l = buf.get(robo) || [];
      l.push({ em: new Date(agora).toISOString(), texto: t, nivel: ehErro(t) ? 'erro' : 'info' });
      if (l.length > LINHAS) l.splice(0, l.length - LINHAS);
      buf.set(robo, l);
      sujo.add(robo);
      return robo;
    },
    aoVivo(robo, agora = Date.now()) { aoVivoAte.set(robo, agora + AO_VIVO_DURA_MS); sujo.add(robo); },
    /** grava o que está sujo e no ritmo; devolve os robôs gravados agora */
    tique(agora = Date.now()) {
      const feitos = [];
      for (const robo of Array.from(sujo)) {
        const vivo = (aoVivoAte.get(robo) || 0) > agora;
        if (agora - (gravadoEm.get(robo) || 0) < (vivo ? AO_VIVO_MS : DEVAGAR_MS)) continue;
        sujo.delete(robo);
        gravadoEm.set(robo, agora);
        feitos.push(robo);
        try {
          const p = gravar(robo, docDoEspelho(robo, maquina, buf.get(robo) || [], new Date(agora).toISOString(), vivo ? aoVivoAte.get(robo) : 0));
          if (p && typeof p.catch === 'function') p.catch(() => { /* quem grava loga */ });
        } catch (e) { /* quem grava loga */ }
      }
      return feitos;
    },
    linhas: robo => (buf.get(robo) || []).slice(),
  };
}

// ---------- os sinais baratos da máquina ----------
let cpuAntes = null;
function amostraCpu() {
  const t = os.cpus().reduce((a, c) => { const x = c.times; a.ocioso += x.idle; a.total += x.user + x.nice + x.sys + x.idle + x.irq; return a; }, { ocioso: 0, total: 0 });
  const antes = cpuAntes;
  cpuAntes = t;
  if (!antes || t.total <= antes.total) return null;
  return Math.round(100 * (1 - (t.ocioso - antes.ocioso) / (t.total - antes.total)));
}
function sinaisDaMaquina(raiz) {
  const s = { cpu: null, memoria: null, disco: null, discoLivreGb: null, ligadaHa: null };
  try { s.cpu = amostraCpu(); } catch (e) { /* sem cpu */ }
  try { s.memoria = Math.round(100 * (1 - os.freemem() / os.totalmem())); } catch (e) { /* segue */ }
  try { s.ligadaHa = Math.round(os.uptime()); } catch (e) { /* segue */ }
  try {
    if (typeof fs.statfsSync === 'function') {
      const d = fs.statfsSync(raiz || path.parse(__dirname).root);
      const total = d.blocks * d.bsize;
      const livre = d.bavail * d.bsize;
      if (total > 0) { s.disco = Math.round(100 * (1 - livre / total)); s.discoLivreGb = Math.round(livre / 1e9); }
    }
  } catch (e) { /* segue */ }
  return s;
}

// ---------- os ganchos (o que cada ação faz de verdade) ----------
const pausas = new Map();   // robo -> { pausar, retomar }

/** Um robô que sabe pausar (ex.: o atendente de IA do PC). pausar/retomar: funções (podem ser async). */
function registrarPausa(robo, f) {
  if (f && typeof f.pausar === 'function' && typeof f.retomar === 'function') pausas.set(String(robo), f);
}

/** As tarefas que "rodar agora" sabe fazer: viram um pedido na fila que o robô já atende (o mesmo do botão do nads). */
const TAREFAS = {
  'arquivador:arquivar-agora': (db, c) => db.collection('solicitacoesArquivo').add({
    status: 'pendente', modo: 'PRODUCAO', criadoEm: new Date().toISOString(), criadoPor: 'Central dos robôs (' + (c.porNome || 'admin') + ')', criadoPorUid: c.por,
  }).then(() => 'Pedido na fila do arquivamento.'),
  'vigia:ler-gmail': (db, c) => db.collection('solicitacoesEmail').add({
    tipo: 'verificar', dias: 3, status: 'pendente', criadoEm: new Date().toISOString(), criadoPor: 'Central dos robôs (' + (c.porNome || 'admin') + ')', criadoPorUid: c.por,
  }).then(() => 'Pedido na fila do Gmail (últimos 3 dias).'),
};

/** O reinício educado da frente do atualizador (robo/ocupado.js). Sem ele nesta versão, não faz nada (e diz). */
function reinicioEducado(motivo) {
  let ocupado = null;
  try { ocupado = require('./ocupado'); } catch (e) { ocupado = null; }
  if (!ocupado || typeof ocupado.pedirParada !== 'function') throw new Error('O reinício educado (ocupado.js) ainda não está nesta versão do robô.');
  let vivo = false;
  try { vivo = typeof ocupado.arquivoVivo === 'function' && fs.existsSync(ocupado.arquivoVivo()); } catch (e) { vivo = false; }
  if (!vivo) throw new Error('Este processo não liga o reinício educado (ocupado.iniciar); reinicie pela máquina.');
  void ocupado.pedirParada(motivo);
  return 'Pedido para sair com calma: termina o que está fazendo (até 10 min), sai e o laço liga de novo.';
}

/** A atualização pelo atualizador da frente do reinício: no servidor, o sinal de urgência que ele lê. */
function atualizarAgora(maquina, motivo) {
  if (maquina !== 'servidor') throw new Error(maquina === 'nuvem' ? 'Na nuvem, a atualização é pelo metadado robo-versao (a publicação faz).' : 'O PC do escritório não se atualiza por aqui.');
  if (!fs.existsSync(path.join(__dirname, 'atualizar-robo.js'))) throw new Error('O atualizador novo (atualizar-robo.js) ainda não está nesta máquina.');
  const dados = process.env.NADS_DADOS || 'D:\\nads-dados';
  if (!fs.existsSync(dados)) throw new Error('Não achei a pasta de dados do robô (' + dados + ').');
  // o conteúdo é só um texto para quem olhar a pasta; o atualizador lê a existência do arquivo
  fs.writeFileSync(path.join(dados, 'atualizar-urgente'), 'pedido pela Central dos robôs: ' + String(motivo).slice(0, 120) + '\n');
  return 'Pedido entregue ao atualizador: ele traz o código novo na próxima volta da tarefa, com o reinício educado.';
}

// ---------- a central ----------
let st = null;

const logs = new Map();
function logUmaVez(chave, ...m) {
  const t = logs.get(chave) || 0;
  if (Date.now() - t < 36e5) return;
  logs.set(chave, Date.now());
  try { (st && st.log ? st.log : console.log)('central:', ...m); } catch (e) { /* nem o log */ }
}
const mensagemDe = err => String((err && err.message) || err || 'erro').slice(0, MAX_MENSAGEM);
const semPermissao = err => /permission|insufficient|PERMISSION_DENIED/i.test(mensagemDe(err));

function interceptarLog(espelho) {
  for (const nome of ['stdout', 'stderr']) {
    const fluxo = process[nome];
    const original = fluxo.write.bind(fluxo);
    let resto = '';
    fluxo.write = function (pedaco, ...args) {
      try {
        resto += typeof pedaco === 'string' ? pedaco : Buffer.isBuffer(pedaco) ? pedaco.toString('utf8') : '';
        if (resto.length > 64 * 1024) resto = resto.slice(-64 * 1024);
        const linhas = resto.split('\n');
        resto = linhas.pop();
        for (const l of linhas) if (l.trim()) espelho.linha(l);
      } catch (e) { /* o espelho nunca segura o log */ }
      return original(pedaco, ...args);
    };
    st.restaurar.push(() => { fluxo.write = original; });
  }
}

async function responder(ref, parcial) {
  try { await ref.update(Object.assign({ respondidoEm: new Date().toISOString() }, parcial)); }
  catch (err) { logUmaVez('responder', 'não consegui responder o comando -', mensagemDe(err)); }
}

/** Pega o comando (pendente → aceito) numa transação; false se outro já pegou ou se mudou. */
async function pegar(ref) {
  return st.db.runTransaction(async t => {
    const s = await t.get(ref);
    if (!s.exists || (s.data() || {}).status !== 'pendente') return false;
    t.update(ref, { status: 'aceito', mensagem: 'Recebi.', respondidoEm: new Date().toISOString(), host: os.hostname() });
    return true;
  });
}

async function fazer(c) {
  const motivo = (c.porNome || 'admin') + ' pela Central dos robôs';
  switch (c.acao) {
    case 'assistir':
      st.espelho.aoVivo(c.robo);
      return 'Ao vivo por 5 min.';
    case 'pausar': {
      await pausas.get(c.robo).pausar();
      st.pausados[c.robo] = { por: c.porNome || '', em: new Date().toISOString() };
      void publicarEstado();
      return 'Pausado: não pega trabalho novo até alguém retomar.';
    }
    case 'retomar': {
      await pausas.get(c.robo).retomar();
      delete st.pausados[c.robo];
      void publicarEstado();
      return 'Retomado.';
    }
    case 'rodar-agora': return TAREFAS[c.robo + ':' + c.tarefa](st.db, c);
    case 'limpar-fila': return limparFila(c);
    case 'reiniciar': return st.ganchos.reiniciar(motivo);
    case 'atualizar': return st.ganchos.atualizar(st.maquina, motivo);
    default: throw new Error('Ação fora da lista fechada.');
  }
}

async function limparFila(c) {
  const r = roboDaMaquina(st.maquina, c.robo);
  const painel = require('./painel');
  const filas = (painel.FILAS && painel.FILAS[st.maquina === 'nuvem' ? 'vm' : 'pc']) || [];
  const cfg = filas.find(f => f.id === r.fila);
  if (!cfg || !(cfg.andamento || []).length) throw new Error('Não achei a fila do ' + r.nome + ' nesta máquina.');
  const snap = await st.db.collection(cfg.colecao).where('status', 'in', cfg.andamento).limit(200).get();
  const agora = Date.now();
  const presos = snap.docs.filter(d => travado(d.data(), cfg.andamento, agora));
  if (!presos.length) return 'Nada travado: nenhum pedido parado há mais de 30 min.';
  const lote = st.db.batch();
  const em = new Date().toISOString();
  for (const d of presos) lote.update(d.ref, { status: 'erro', erro: 'Travado em andamento; liberado pela Central dos robôs (' + (c.porNome || 'admin') + '). Peça de novo se ainda precisar.', erroEm: em, liberadoPelaCentralEm: em });
  await lote.commit();
  return presos.length === 1 ? '1 pedido travado virou erro.' : presos.length + ' pedidos travados viraram erro.';
}

async function atender(doc) {
  const id = doc.id;
  const c = doc.data() || {};
  const agora = Date.now();
  const tarefas = new Set(Object.keys(TAREFAS));
  const conf = conferirComando(id, c, { maquina: st.maquina, agora, vistos: st.vistos, recentes: st.recentes, tarefas, pausaveis: new Set(pausas.keys()) });
  if (conf.ignorar) return;
  st.vistos.add(id);
  if (st.vistos.size > 2000) st.vistos = new Set(Array.from(st.vistos).slice(-1000));
  if (!conf.fazer) {
    try {
      await st.db.runTransaction(async t => {
        const s = await t.get(doc.ref);
        if (s.exists && (s.data() || {}).status === 'pendente') t.update(doc.ref, { status: 'recusado', mensagem: conf.motivo, respondidoEm: new Date().toISOString(), host: os.hostname() });
      });
    } catch (err) { logUmaVez('recusar', 'não consegui recusar o comando -', mensagemDe(err)); }
    st.log('central: recusei', c.acao, c.robo || '', '-', conf.motivo);
    return;
  }
  let meu = false;
  try { meu = await pegar(doc.ref); } catch (err) { logUmaVez('pegar', 'não consegui pegar o comando -', mensagemDe(err)); return; }
  if (!meu) return;
  if (c.acao !== 'assistir') { st.recentes.set(chaveDoComando(c), agora); st.log('central:', c.acao, c.robo || st.maquina, c.tarefa || '', 'pedido por', c.porNome || c.por); }
  try {
    const msg = await fazer(c);
    if (c.acao === 'assistir') { await doc.ref.delete().catch(() => {}); return; }
    await responder(doc.ref, { status: 'feito', mensagem: String(msg || 'Feito.').slice(0, MAX_MENSAGEM) });
  } catch (err) {
    await responder(doc.ref, { status: 'erro', mensagem: limparSegredos(mensagemDe(err)) });
    st.log('central: erro em', c.acao, c.robo || '', '-', mensagemDe(err));
  }
}

/** O reinício educado está ligado neste processo? (o ocupado.js existe e o ocupado.iniciar gravou o arquivo vivo) */
function reinicioLigado() {
  try {
    const ocupado = require('./ocupado');
    return typeof ocupado.pedirParada === 'function' && typeof ocupado.arquivoVivo === 'function' && fs.existsSync(ocupado.arquivoVivo());
  } catch (e) { return false; }
}

function publicarEstado(desligado) {
  if (!st) return Promise.resolve();
  const agoraIso = new Date().toISOString();
  const semGancho = [];
  // reiniciar só com o ocupado.js E este processo ligado nele (o arquivo robo-vivo-<nome>.json do ocupado.iniciar)
  if (st.ganchos.reiniciar === reinicioEducado && !reinicioLigado()) semGancho.push('reiniciar');
  if (st.maquina !== 'servidor' || !fs.existsSync(path.join(__dirname, 'atualizar-robo.js'))) semGancho.push('atualizar');
  const doc = desligado ? { desligadoEm: agoraIso } : {
    maquina: st.maquina, host: os.hostname(), em: agoraIso, ligadoEm: st.ligadoEm, versao: st.versao, desligadoEm: null,
    sinais: sinaisDaMaquina(st.raiz), pausados: st.pausados, semGancho,
  };
  return st.db.collection('robosMaquinas').doc(st.maquina).set(doc, { merge: true })
    .catch(err => logUmaVez('estado', (semPermissao(err) ? 'sem permissão para gravar o estado da máquina' : 'não consegui gravar o estado da máquina') + ' -', mensagemDe(err)));
}

async function limparHistorico() {
  // só o servidor limpa (uma central só apaga; a consulta é de um campo só, sem índice composto)
  if (!st || st.maquina !== 'servidor') return;
  try {
    const limite = new Date(Date.now() - HISTORICO_DIAS * DIA_MS).toISOString();
    const snap = await st.db.collection('robosComandos').where('em', '<', limite).limit(200).get();
    if (snap.empty) return;
    const lote = st.db.batch();
    snap.docs.forEach(d => lote.delete(d.ref));
    await lote.commit();
  } catch (err) { logUmaVez('historico', 'não consegui apagar os comandos velhos -', mensagemDe(err)); }
}

/**
 * Liga a central desta máquina. o: { db, maquina: 'servidor' | 'nuvem' | 'escritorio', log, raiz (o disco medido),
 * ganchos: { reiniciar(motivo), atualizar(maquina, motivo) } (os padrões usam o ocupado.js e o atualizador) }.
 * Chamar de novo não faz nada. Devolve parar().
 */
function iniciarCentral(o) {
  try {
    if (st || !o || !o.db) return () => {};
    const maquina = ['servidor', 'nuvem', 'escritorio'].includes(o.maquina) ? o.maquina : null;
    if (!maquina) { (o.log || console.log)('central: máquina desconhecida', o.maquina); return () => {}; }
    let versao = 'desconhecida';
    try { versao = require('./painel').versaoDoCodigo(); } catch (e) { /* segue */ }
    st = {
      db: o.db, maquina, log: o.log || console.log, raiz: o.raiz || '', versao, ligadoEm: new Date().toISOString(),
      ganchos: Object.assign({ reiniciar: reinicioEducado, atualizar: atualizarAgora }, o.ganchos || {}),
      vistos: new Set(), recentes: new Map(), pausados: {}, timers: [], restaurar: [], paradas: [],
    };
    st.espelho = criarEspelho({
      maquina,
      gravar: (robo, doc) => st.db.collection('robosRegistros').doc(robo).set(doc)
        .catch(err => logUmaVez('registros', (semPermissao(err) ? 'sem permissão para o espelho do log' : 'não consegui gravar o espelho do log') + ' -', mensagemDe(err))),
    });
    interceptarLog(st.espelho);
    // os pausados de antes (a pausa vale até alguém retomar, mesmo com o robô reiniciado)
    st.db.collection('robosMaquinas').doc(maquina).get().then(s => {
      const p = (s.exists && (s.data() || {}).pausados) || {};
      for (const [robo, quem] of Object.entries(p)) {
        if (!pausas.has(robo)) continue;
        st.pausados[robo] = quem;
        Promise.resolve().then(() => pausas.get(robo).pausar()).catch(err => st.log('central: não consegui pausar de novo o', robo, '-', mensagemDe(err)));
      }
    }).catch(err => logUmaVez('ler-estado', 'não consegui ler o estado da máquina -', mensagemDe(err)))
      .finally(() => { void publicarEstado(); });
    st.timers.push(setInterval(() => { void publicarEstado(); }, ESTADO_A_CADA_MS));
    st.timers.push(setInterval(() => { try { st.espelho.tique(); } catch (e) { /* segue */ } }, 5000));
    st.timers.push(setTimeout(() => { void limparHistorico(); }, 3 * 60 * 1000));
    st.timers.push(setInterval(() => { void limparHistorico(); }, 12 * 36e5));
    for (const t of st.timers) if (t && typeof t.unref === 'function') t.unref();
    // os comandos desta máquina (duas igualdades: não precisa de índice composto)
    const { ouvir } = require('./ouvinte');
    st.paradas.push(ouvir('central: comandos',
      () => st.db.collection('robosComandos').where('maquina', '==', maquina).where('status', '==', 'pendente'),
      snap => { for (const d of snap.docs) void atender(d).catch(err => logUmaVez('atender', 'erro atendendo comando -', mensagemDe(err))); },
      m => logUmaVez('ouvir', m)));
    st.log('central dos robôs ligada (' + maquina + ')');
    const parar = () => desligarCentral();
    return parar;
  } catch (err) {
    try { (o && o.log ? o.log : console.log)('central dos robôs não ligou:', mensagemDe(err)); } catch (e) { /* segue */ }
    return () => {};
  }
}

/** Ao fechar: para de ouvir, devolve o log ao normal e marca a máquina como desligada. */
function desligarCentral() {
  if (!st) return Promise.resolve();
  st.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
  st.paradas.forEach(p => { try { p(); } catch (e) { /* segue */ } });
  st.restaurar.forEach(f => { try { f(); } catch (e) { /* segue */ } });
  const fim = publicarEstado(true);
  st = null;
  return fim;
}

module.exports = {
  iniciarCentral, desligarCentral, registrarPausa,
  // para o teste
  ACOES, ACOES_DA_MAQUINA, VALIDADE_MS, REPETIDO_MS, LINHAS, MAX_BYTES, AO_VIVO_MS, DEVAGAR_MS, TRAVADO_MS,
  conferirComando, limparSegredos, linhaParaEspelho, roboDaLinha, criarEspelho, docDoEspelho, travado, chaveDoComando,
  sinaisDaMaquina, TAREFAS, _atender: atender, _st: () => st,
};
