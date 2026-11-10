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
//      Os controles (10/11/2026): 'refazer' (o pedido que deu erro volta para a fila), 'cancelar-item' e 'na-frente' (um
//      pedido da fila, pelo id), 'pedir-cliente' (um pedido novo nas filas que já existem, para um cliente e uma competência)
//      e 'parar-tudo' / 'retomar-tudo' (todos os robôs pausáveis da máquina). O id do item, o cliente e a competência têm o
//      formato conferido aqui e só viram leitura e gravação de documento; nada disso vira comando de sistema.
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
const horarios = require('./horarios');

let catalogo = { maquinas: [], robos: [] };
try { catalogo = require('../packages/core/src/robos/catalogo.json'); } catch (e) { /* sem o catálogo (cópia só do robo/): nenhum robô conhecido, tudo é recusado */ }

// ---------- a LISTA FECHADA (a autoridade é ESTA; o catálogo do site só mostra; o teste-central.js confere as duas) ----------
const ACOES = Object.freeze(['pausar', 'retomar', 'rodar-agora', 'limpar-fila', 'reiniciar', 'atualizar', 'assistir', 'refazer', 'cancelar-item', 'na-frente', 'pedir-cliente', 'parar-tudo', 'retomar-tudo']);
const ACOES_DA_MAQUINA = Object.freeze(['reiniciar', 'atualizar', 'parar-tudo', 'retomar-tudo']);
const ACOES_DE_ITEM = Object.freeze(['refazer', 'cancelar-item', 'na-frente']);
const CAPACIDADE_DA_ACAO = Object.freeze({ refazer: 'refazer', 'cancelar-item': 'cancelar', 'na-frente': 'naFrente' });

// o formato do que vem junto do comando: o id de um documento do Firestore, o código do cliente, a competência
const ITEM_OK = /^[A-Za-z0-9_-]{1,128}$/;
const CLIENTE_OK = /^\d{1,9}$/;
const COMPETENCIA_OK = /^20\d{2}-(0[1-9]|1[0-2])$/;
/** a pausa marcada volta em no máximo 7 dias (uma hora errada não deixa o robô parado para sempre) */
const PAUSA_MAXIMA_MS = 7 * 24 * 36e5;

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
const NIVEL_DA_ACAO = Object.fromEntries((catalogo.acoes || []).map(a => [a.id, a.nivel]));
const UID_OK = /^[A-Za-z0-9_-]{1,128}$/;
const AGENDA_A_CADA_MS = 15 * 1000;

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

/** A chave do "repetido": o mesmo pedido (ação + robô + tarefa + item, cliente e competência, quando há) desta máquina. */
const chaveDoComando = c => [c.acao, c.robo || '', c.tarefa || ''].concat([c.item, c.cliente, c.competencia].filter(Boolean)).join('|');

/** A competência é de um mês que ainda não começou? (AAAA-MM, pelo relógio de quem confere) */
function competenciaNoFuturo(competencia, agora) {
  const d = new Date(agora);
  return competencia > d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** A hora de voltar ('ate', ISO) serve? '' = serve (ou não veio); senão, o motivo. */
function motivoDaHora(ate, agora) {
  if (ate == null || ate === '') return '';
  const t = Date.parse(String(ate));
  if (!Number.isFinite(t)) return 'A hora de voltar não é uma data válida.';
  if (t <= agora) return 'A hora de voltar já passou.';
  if (t - agora > PAUSA_MAXIMA_MS) return 'A pausa marcada vai até 7 dias, no máximo.';
  return '';
}

/** Os robôs com a pausa marcada já vencida (o mapa de robosMaquinas.pausados: { robo: { por, em, ate } }). */
function pausasVencidas(pausados, agora) {
  return Object.keys(pausados || {}).filter(robo => {
    const t = Date.parse(String((pausados[robo] || {}).ate || ''));
    return Number.isFinite(t) && t <= agora;
  });
}

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
    if ((acao === 'parar-tudo' || acao === 'retomar-tudo') && !robosDaMaquina(ctx.maquina).some(r => r.pausavel && (!ctx.pausaveis || ctx.pausaveis.has(r.id)))) return { fazer: false, motivo: 'Nenhum robô desta máquina sabe pausar.' };
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
    if (ACOES_DE_ITEM.includes(acao)) {
      if (!ITEM_OK.test(String(c.item || ''))) return { fazer: false, motivo: 'O item da fila veio num formato que não aceito.' };
      if (!(r.itens && r.itens[CAPACIDADE_DA_ACAO[acao]])) return { fazer: false, motivo: 'A fila do ' + r.nome + ' não deixa isso por aqui.' };
    }
    if (acao === 'pedir-cliente') {
      const tipo = String(c.tarefa || '');
      if (!(r.pedidos || []).some(p => p.id === tipo)) return { fazer: false, motivo: 'Pedido desconhecido para o ' + r.nome + ': ' + tipo.slice(0, 40) + '.' };
      if (!CLIENTE_OK.test(String(c.cliente || ''))) return { fazer: false, motivo: 'O código do cliente veio num formato que não aceito.' };
      if (!COMPETENCIA_OK.test(String(c.competencia || ''))) return { fazer: false, motivo: 'A competência veio num formato que não aceito (AAAA-MM).' };
      if (competenciaNoFuturo(String(c.competencia), ctx.agora)) return { fazer: false, motivo: 'A competência ainda não começou.' };
    }
  }
  if (acao === 'pausar' || acao === 'parar-tudo') {
    const m = motivoDaHora(c.ate, ctx.agora);
    if (m) return { fazer: false, motivo: m };
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

/**
 * Um robô que sabe pausar (ex.: o atendente de IA do PC). pausar/retomar: funções (podem ser async). Quem registra depois
 * de a central ler as pausas guardadas (um módulo que liga mais tarde) já entra pausado, se estava.
 */
function registrarPausa(robo, f) {
  if (!(f && typeof f.pausar === 'function' && typeof f.retomar === 'function')) return;
  pausas.set(String(robo), f);
  if (st && (st.pausados[robo] || st.foraDoHorario.has(String(robo)))) Promise.resolve().then(() => f.pausar()).catch(err => st && st.log('central: não consegui pausar de novo o', robo, '-', mensagemDe(err)));
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

// ---------- quem pode o quê (usuarios/{uid}.roles e robosPermissoes/{uid}: { papel, robos }) ----------
const PAPEIS = ['ver', 'comandar', 'administrar'];

/** A permissão de quem pediu. Conta desativada ou sem cadastro não tem nenhuma; o papel 'admin' do nads pode tudo. */
async function permissaoDe(uid) {
  const nada = { admin: false, papel: '', robos: [] };
  if (!UID_OK.test(String(uid || ''))) return nada;
  const [u, p] = await Promise.all([st.db.collection('usuarios').doc(uid).get(), st.db.collection('robosPermissoes').doc(uid).get()]);
  const dados = u.exists ? u.data() || {} : null;
  if (!dados || dados.ativo === false) return nada;
  const permissao = p.exists ? p.data() || {} : {};
  return {
    admin: Array.isArray(dados.roles) && dados.roles.includes('admin'),
    papel: PAPEIS.includes(permissao.papel) ? permissao.papel : '',
    robos: Array.isArray(permissao.robos) ? permissao.robos.map(String) : [],
  };
}

/** Só olhar = só o "ao vivo" dos registros; comandar = as ações de robô, só nos robôs dele; administrar = tudo, inclusive as máquinas. */
function podeFazer(p, acao, robo) {
  if (!p) return false;
  if (p.admin || p.papel === 'administrar') return true;
  const nivel = NIVEL_DA_ACAO[acao];
  if (nivel === 'ver') return PAPEIS.includes(p.papel);
  return nivel === 'comandar' && p.papel === 'comandar' && !!robo && p.robos.includes(String(robo));
}

/** Recusa de um comando depois de aceito (o item sumiu, já começou...): o comando fica 'recusado' com a mensagem, não 'erro'. */
class Recusa extends Error {}

/** O pedido parecido na fila: o mesmo cliente e mês já esperando ou andando (e a guia do FGTS que já saiu). */
const MESMO_PEDIDO = {
  fgts: { campo: 'cnpj', iguais: ['competencia', 'modo'], jaSaiu: true },
  alterdata: { campo: 'codigo', iguais: ['competencia', 'tipo'] },
  sieg: { campo: 'codigo', iguais: ['competencia', 'tipo'] },
};

/** O que devolve o pedido à fila, em cada robô (os mesmos campos que o próprio robô limpa quando devolve um pedido). */
const CAMPOS_DE_REFAZER = {
  fgts: () => ({ status: 'pendente', erro: '', aviso: '', fimEm: '', inicioEm: '', passos: [], tentativas: 0, avisadoErroEm: null }),
  alterdata: em => ({ status: 'pendente', erro: '', fimEm: '', inicioEm: '', passos: [], tentativas: 0, esperas: 0, onde: '', esperandoContabil: '', arquivos: {}, mesmoQue: '', andamento: { pct: 0, etapa: 'pedido de novo', clique: '', em } }),
  sieg: () => ({ status: 'pendente', erro: null, erroEm: null, andamento: '' }),
};

/** O erro que não se refaz daqui, com o motivo (a importação no Contábil pode ter lançado metade; os XMLs do cliente já foram apagados). */
const NAO_REFAZ = {
  alterdata: d => (d.tipo === 'importar' ? 'A importação de lançamentos não se refaz por aqui: confira no Contábil o que entrou e importe de novo pela tela.' : ''),
  sieg: d => (d.tipo === 'xmlsCliente' ? 'Os XMLs que o cliente mandou não ficam guardados: envie de novo pela tela do Fiscal.' : ''),
};

const quemNaCentral = c => ({ criadoEm: new Date().toISOString(), criadoPor: 'Central dos robôs (' + (c.porNome || 'admin') + ')', criadoPorUid: c.por });
const mesAno = comp => comp.slice(5) + '/' + comp.slice(0, 4);

/**
 * Os pedidos "para um cliente": o MESMO documento que as telas do nads criam nas filas que já existem (pedidosFgts,
 * pedidosSieg, pedidosAlterdata; o cliente vem do cadastro, não da tela). A autoridade é esta lista.
 */
const PEDIDOS_POR_CLIENTE = {
  'fgts:guia': { precisaDocumento: true, modelo: (cli, c) => ({ status: 'pendente', modo: 'emitir', cnpj: cli.documento, codigo: cli.codigo, empresa: cli.nome, competencia: c.competencia }) },
  'fgts:ensaio': { precisaDocumento: true, modelo: (cli, c) => ({ status: 'pendente', modo: 'ensaio', cnpj: cli.documento, codigo: cli.codigo, empresa: cli.nome, competencia: c.competencia }) },
  'sieg:xmls': { modelo: (cli, c) => ({ status: 'pendente', tipo: 'xmls', codigo: cli.codigo, competencia: c.competencia }) },
  'sieg:saidas': { modelo: (cli, c) => ({ status: 'pendente', codigo: cli.codigo, competencia: c.competencia }) },
  'sieg:contagem': { modelo: (cli, c) => ({ status: 'pendente', tipo: 'contagem', codigo: cli.codigo, competencia: c.competencia }) },
  'alterdata:mensal': { modelo: (cli, c) => ({ status: 'pendente', tipo: 'mensal', codigo: Number(cli.codigo), empresa: cli.nome.slice(0, 200), competencia: c.competencia }) },
};

/** O cliente ativo do cadastro, pelo código (o cadastro em memória de 10 min do clientes-cache). */
async function clienteDoCadastro(codigo) {
  const soDigitos = v => String(v == null ? '' : v).replace(/\D/g, '');
  let achou = null;
  (await require('./clientes-cache').clientesAtivos(st.db)).forEach(d => {
    const x = d.data() || {};
    if (!achou && soDigitos(x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem) === codigo) achou = x;
  });
  if (!achou) throw new Recusa('Não achei o cliente ' + codigo + ' entre os ativos do cadastro.');
  return { codigo, nome: String(achou.nome || achou.razaoSocial || ''), documento: soDigitos(achou.documento) };
}

/** Procura o pedido igual já na fila (ou a guia que já saiu); ignorar: o próprio pedido, no refazer. null = pode. */
async function pedidoIgual(r, modelo, ignorar) {
  const cfg = MESMO_PEDIDO[r.id];
  if (!cfg) return null;
  const snap = await st.db.collection(r.itens.colecao).where(cfg.campo, '==', modelo[cfg.campo]).limit(200).get();
  const naFila = [...r.itens.esperando, ...r.itens.andamento];
  for (const doc of snap.docs) {
    if (doc.id === ignorar) continue;
    const o = doc.data() || {};
    if (!cfg.iguais.every(k => (o[k] || '') === (modelo[k] || ''))) continue;
    if (naFila.includes(String(o.status || ''))) return 'Já existe um pedido igual na fila deste robô (' + o.status + ').';
    if (cfg.jaSaiu && o.status === 'pronto' && o.modo === 'emitir') return 'Esta guia já saiu em outro pedido' + (o.fimEm ? ' (' + new Date(o.fimEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ')' : '') + '; se precisar de outra, peça pela tela do DP.';
  }
  return null;
}

/** Confere o item que ainda espera na fila (dentro da transação) e devolve a situação; o resto é recusa com a mensagem. */
function itemQueEspera(s, r, verbo) {
  if (!s.exists) throw new Recusa('Este pedido não existe mais na fila.');
  const status = String((s.data() || {}).status || '');
  if (r.itens.andamento.includes(status)) throw new Recusa('Este pedido já está em andamento (' + status + '): não dá mais para ' + verbo + ' por aqui.');
  if (!r.itens.esperando.includes(status)) throw new Recusa('Este pedido já saiu da fila (' + (status || 'sem situação') + ').');
}

/** Cancela um pedido que ainda espera: nada é apagado; fica 'cancelado', com quem cancelou. */
async function cancelarItem(c) {
  const r = roboDaMaquina(st.maquina, c.robo);
  const ref = st.db.collection(r.itens.colecao).doc(String(c.item));
  return st.db.runTransaction(async t => {
    itemQueEspera(await t.get(ref), r, 'cancelar');
    t.update(ref, { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: c.porNome || 'admin', canceladoPorUid: c.por });
    return 'Cancelado: o pedido ficou marcado como cancelado.';
  });
}

/** Passa um pedido que ainda espera para a frente da fila (a fila do robô lê naFrenteEm). */
async function passarNaFrente(c) {
  const r = roboDaMaquina(st.maquina, c.robo);
  const ref = st.db.collection(r.itens.colecao).doc(String(c.item));
  return st.db.runTransaction(async t => {
    itemQueEspera(await t.get(ref), r, 'mudar de lugar');
    t.update(ref, { naFrenteEm: new Date().toISOString(), naFrentePor: c.porNome || 'admin' });
    return 'Passou na frente: é o próximo da fila.';
  });
}

/** Devolve à fila só o pedido que deu erro (o mesmo documento: quem acompanha pela tela do nads vê o pedido andar de novo). */
async function refazerItem(c) {
  const r = roboDaMaquina(st.maquina, c.robo);
  const ref = st.db.collection(r.itens.colecao).doc(String(c.item));
  const antes = await ref.get();
  if (!antes.exists) throw new Recusa('Este pedido não existe mais.');
  const d = antes.data() || {};
  if (String(d.status || '') !== 'erro') throw new Recusa('Só dá para refazer o que está com erro; este pedido está "' + (d.status || 'sem situação') + '".');
  const naoRefaz = NAO_REFAZ[r.id] && NAO_REFAZ[r.id](d);
  if (naoRefaz) throw new Recusa(naoRefaz);
  const igual = await pedidoIgual(r, d, antes.id);
  if (igual) throw new Recusa(igual);
  const em = new Date().toISOString();
  return st.db.runTransaction(async t => {
    const s = await t.get(ref);
    if (!s.exists || String((s.data() || {}).status || '') !== 'erro') throw new Recusa('Este pedido mudou enquanto eu conferia; olhe a fila e peça de novo se ainda precisar.');
    t.update(ref, Object.assign(CAMPOS_DE_REFAZER[r.id](em), { refeitoEm: em, refeitoPor: c.porNome || 'admin', refeitoPorUid: c.por }));
    return 'Pedido de novo: voltou para a fila do ' + r.nome + '.';
  });
}

/** Um pedido novo para um cliente e competência, na fila que o robô já atende. */
async function pedirCliente(c) {
  const r = roboDaMaquina(st.maquina, c.robo);
  const receita = PEDIDOS_POR_CLIENTE[r.id + ':' + c.tarefa];
  if (!receita) throw new Error('Esta máquina ainda não sabe fazer esse pedido.');
  const cli = await clienteDoCadastro(String(c.cliente));
  if (receita.precisaDocumento && !/^(\d{11}|\d{14})$/.test(cli.documento)) throw new Recusa('O cliente ' + cli.codigo + ' está sem CNPJ ou CPF válido no cadastro.');
  const modelo = receita.modelo(cli, c);
  const igual = await pedidoIgual(r, modelo, '');
  if (igual) throw new Recusa(igual);
  await st.db.collection(r.itens.colecao).add(Object.assign(modelo, quemNaCentral(c)));
  return 'Pedido na fila do ' + r.nome + ': ' + cli.codigo + (cli.nome ? ' ' + cli.nome : '') + ' (' + mesAno(String(c.competencia)) + ').';
}

/** "às 18:30" ou "em 12/11 às 18:30", no fuso do escritório. */
function quandoVolta(ate) {
  const d = new Date(ate);
  const fuso = { timeZone: 'America/Sao_Paulo' };
  const hora = d.toLocaleTimeString('pt-BR', Object.assign({ hour: '2-digit', minute: '2-digit' }, fuso));
  const mesmoDia = d.toLocaleDateString('pt-BR', fuso) === new Date().toLocaleDateString('pt-BR', fuso);
  return (mesmoDia ? '' : 'em ' + d.toLocaleDateString('pt-BR', Object.assign({ day: '2-digit', month: '2-digit' }, fuso)) + ' ') + 'às ' + hora;
}

async function pausarRobo(robo, c) {
  await pausas.get(robo).pausar();
  const p = { por: c.porNome || '', em: new Date().toISOString() };
  if (c.ate) p.ate = new Date(c.ate).toISOString();
  st.pausados[robo] = p;
}
async function retomarRobo(robo) {
  if (!st.foraDoHorario.has(robo)) await pausas.get(robo).retomar();
  delete st.pausados[robo];
}

/** Todos os robôs pausáveis desta máquina de uma vez. O que falhar num não segura os outros; todos falharam = erro. */
async function emTodos(c, mexer, palavra) {
  const robos = robosDaMaquina(st.maquina).filter(r => r.pausavel && pausas.has(r.id));
  const feitos = [], falhas = [];
  for (const r of robos) {
    try { await mexer(r.id, c); feitos.push(r.nome); }
    catch (err) { falhas.push(r.nome + ': ' + mensagemDe(err)); }
  }
  void publicarEstado();
  if (!feitos.length && falhas.length) throw new Error(falhas.join(' · '));
  return palavra + ': ' + feitos.join(', ') + (c.ate && c.acao === 'parar-tudo' ? '; voltam ' + quandoVolta(c.ate) : '') + '.' + (falhas.length ? ' Não consegui: ' + falhas.join(' · ') : '');
}

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
      await pausarRobo(c.robo, c);
      void publicarEstado();
      return c.ate ? 'Pausado: volta sozinho ' + quandoVolta(c.ate) + '.' : 'Pausado: não pega trabalho novo até alguém retomar.';
    }
    case 'retomar': {
      await retomarRobo(c.robo);
      void publicarEstado();
      return 'Retomado.';
    }
    case 'parar-tudo': return emTodos(c, pausarRobo, 'Pausados');
    case 'retomar-tudo': return emTodos(c, retomarRobo, 'Retomados');
    case 'refazer': return refazerItem(c);
    case 'cancelar-item': return cancelarItem(c);
    case 'na-frente': return passarNaFrente(c);
    case 'pedir-cliente': return pedirCliente(c);
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
  const recusar = async motivo => {
    try {
      await st.db.runTransaction(async t => {
        const s = await t.get(doc.ref);
        if (s.exists && (s.data() || {}).status === 'pendente') t.update(doc.ref, { status: 'recusado', mensagem: motivo, respondidoEm: new Date().toISOString(), host: os.hostname() });
      });
    } catch (err) { logUmaVez('recusar', 'não consegui recusar o comando -', mensagemDe(err)); }
    st.log('central: recusei', c.acao, c.robo || '', '-', motivo);
  };
  if (!conf.fazer) return recusar(conf.motivo);
  // quem pediu pode? a regra do banco já conferiu, e o robô confere de novo; sem conseguir ler, não faz
  let semPoder = '';
  try { if (!podeFazer(await permissaoDe(c.por), c.acao, c.robo)) semPoder = 'Quem pediu não tem permissão para isso nesta central.'; }
  catch (err) { semPoder = 'Não consegui conferir quem pediu; peça de novo em instantes.'; logUmaVez('permissao', 'não consegui ler a permissão -', mensagemDe(err)); }
  if (semPoder) return recusar(semPoder);
  let meu = false;
  try { meu = await pegar(doc.ref); } catch (err) { logUmaVez('pegar', 'não consegui pegar o comando -', mensagemDe(err)); return; }
  if (!meu) return;
  if (c.acao !== 'assistir') { st.recentes.set(chaveDoComando(c), agora); st.log('central:', c.acao, c.robo || st.maquina, c.tarefa || '', 'pedido por', c.porNome || c.por); }
  try {
    const msg = await fazer(c);
    if (c.acao === 'assistir') { await doc.ref.delete().catch(() => {}); return; }
    await responder(doc.ref, { status: 'feito', mensagem: String(msg || 'Feito.').slice(0, MAX_MENSAGEM) });
  } catch (err) {
    const recusado = err instanceof Recusa;
    await responder(doc.ref, { status: recusado ? 'recusado' : 'erro', mensagem: limparSegredos(mensagemDe(err)) });
    st.log('central: ' + (recusado ? 'recusei' : 'erro em'), c.acao, c.robo || '', '-', mensagemDe(err));
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
    sinais: sinaisDaMaquina(st.raiz), semGancho,
  };
  // só depois de ler as pausas guardadas: publicar antes apagaria a pausa de quem estava pausado
  if (!desligado && st.pausadosLidos) doc.pausados = st.pausados;
  if (!desligado) doc.foraDoHorario = [...st.foraDoHorario];
  // mergeFields, não merge: com merge o Firestore junta os mapas e um robô retomado continuaria em 'pausados' enquanto outro
  // estivesse pausado; assim cada campo publicado é trocado por inteiro
  return st.db.collection('robosMaquinas').doc(st.maquina).set(doc, { mergeFields: Object.keys(doc) })
    .catch(err => logUmaVez('estado', (semPermissao(err) ? 'sem permissão para gravar o estado da máquina' : 'não consegui gravar o estado da máquina') + ' -', mensagemDe(err)));
}

/** As pausas guardadas no banco (sobrevivem ao reinício): a que venceu com o robô desligado não volta; as outras pausam de novo. */
function lerPausasGuardadas() {
  if (!st) return Promise.resolve();
  return st.db.collection('robosMaquinas').doc(st.maquina).get().then(s => {
    if (!st) return;
    const guardadas = (s.exists && (s.data() || {}).pausados) || {};
    const agora = Date.now();
    for (const [robo, quem] of Object.entries(guardadas)) {
      if (!roboDaMaquina(st.maquina, robo) || st.pausados[robo]) continue;
      if (pausasVencidas({ [robo]: quem }, agora).length) { st.log('[' + robo + '] central: a pausa marcada venceu com o robô desligado; segue trabalhando'); continue; }
      st.pausados[robo] = quem;
      if (pausas.has(robo)) Promise.resolve().then(() => pausas.get(robo).pausar()).catch(err => st && st.log('central: não consegui pausar de novo o', robo, '-', mensagemDe(err)));
    }
    st.pausadosLidos = true;
  }).catch(err => logUmaVez('ler-estado', 'não consegui ler o estado da máquina -', mensagemDe(err)));
}

/** A pausa marcada: venceu a hora, o robô volta sozinho (a hora está em robosMaquinas, então vale depois de reiniciar). */
/**
 * Os horários (config/robosHorarios, robo/horarios.js): fora da janela o robô de fila fica pausado do mesmo jeito da pausa
 * à mão, mas é outra marca: a volta da janela não solta quem foi pausado por alguém, e retomar à mão não solta quem está
 * fora da janela. Sem configuração, nada muda.
 */
async function conferirHorarios(agora = Date.now()) {
  if (!st || st.conferindoHorarios) return;
  st.conferindoHorarios = true;
  let mudou = false;
  try {
    await st.horarios.atualizar(agora);
    for (const r of robosDaMaquina(st.maquina)) {
      const gancho = pausas.get(r.id);
      if (!gancho || !r.pausavel || !r.horario) continue;
      const fora = !horarios.dentroDoHorario(st.horarios.horario(r.id), agora);
      if (fora === st.foraDoHorario.has(r.id)) continue;
      try {
        if (!st.pausados[r.id]) await (fora ? gancho.pausar() : gancho.retomar());
        if (fora) st.foraDoHorario.add(r.id); else st.foraDoHorario.delete(r.id);
        mudou = true;
        st.log('[' + r.id + '] central: ' + (fora ? 'fora do horário; não pega trabalho novo' : 'dentro do horário; voltou a pegar trabalho'));
      } catch (err) { logUmaVez('horario-' + r.id, 'não consegui aplicar o horário do', r.id, '-', mensagemDe(err)); }
    }
  } finally { if (st) st.conferindoHorarios = false; }
  if (mudou) void publicarEstado();
}

async function conferirPausas(agora = Date.now()) {
  if (!st || st.conferindoPausas) return;
  st.conferindoPausas = true;
  let mudou = false;
  try {
    for (const robo of pausasVencidas(st.pausados, agora)) {
      try {
        const gancho = pausas.get(robo);
        if (gancho && !st.foraDoHorario.has(robo)) await gancho.retomar();
        delete st.pausados[robo];
        mudou = true;
        st.log('[' + robo + '] central: a pausa marcada venceu; voltou a pegar trabalho');
      } catch (err) { logUmaVez('retomar-' + robo, 'não consegui retomar o', robo, '-', mensagemDe(err)); }
    }
  } finally { if (st) st.conferindoPausas = false; }
  if (mudou) void publicarEstado();
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
      vistos: new Set(), recentes: new Map(), pausados: {}, pausadosLidos: false, conferindoPausas: false, timers: [], restaurar: [], paradas: [],
      foraDoHorario: new Set(), conferindoHorarios: false,
    };
    st.horarios = horarios.criarLeitor(o.db, m => logUmaVez('horarios', m));
    st.espelho = criarEspelho({
      maquina,
      gravar: (robo, doc) => st.db.collection('robosRegistros').doc(robo).set(doc)
        .catch(err => logUmaVez('registros', (semPermissao(err) ? 'sem permissão para o espelho do log' : 'não consegui gravar o espelho do log') + ' -', mensagemDe(err))),
    });
    interceptarLog(st.espelho);
    // os pausados de antes (a pausa vale até alguém retomar ou até a hora marcada, mesmo com o robô reiniciado); sem conseguir
    // ler agora, tenta de novo a cada minuto
    lerPausasGuardadas().finally(() => { void conferirHorarios().catch(err => logUmaVez('agenda', 'erro no horário -', mensagemDe(err))).finally(() => publicarEstado()); });
    st.timers.push(setInterval(() => { if (!st.pausadosLidos) void lerPausasGuardadas(); void publicarEstado(); }, ESTADO_A_CADA_MS));
    st.timers.push(setInterval(() => {
      void conferirPausas().catch(err => logUmaVez('agenda', 'erro na pausa marcada -', mensagemDe(err)));
      void conferirHorarios().catch(err => logUmaVez('agenda', 'erro no horário -', mensagemDe(err)));
    }, AGENDA_A_CADA_MS));
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
    st.alertas = require('./alertas').iniciarAlertas({ db: o.db, maquina, log: st.log, enviarPara: o.enviarAlerta || null });
    st.paradas.push(st.alertas.parar);
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
  pausasVencidas, motivoDaHora, ITEM_OK, CLIENTE_OK, COMPETENCIA_OK, PEDIDOS_POR_CLIENTE,
  podeFazer,
  sinaisDaMaquina, TAREFAS, _atender: atender, _conferirPausas: conferirPausas, _conferirHorarios: conferirHorarios, _st: () => st,
};
