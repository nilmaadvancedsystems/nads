// O freio de consumo do banco (07/11/2026). Em 04-05/11 o banco gravou ~220 mil documentos por hora durante um dia
// inteiro e em 06/11 leu 2,4 milhões numa hora, e ninguém soube até olhar a conta. Este módulo conta, em cada processo
// de robô, as leituras e gravações do Firestore por minuto e por TAREFA (o módulo que fez a operação), e:
//
//   - passou do teto na janela (padrão: mais de 20 mil leituras ou 5 mil gravações em 10 min, somando as tarefas do
//     processo), a tarefa que mais gastou é PAUSADA por 15 min: as leituras e gravações dela falham com um erro claro
//     ("pausada pelo freio de consumo") e os módulos já tratam erro de banco como queda de rede (tentam depois);
//   - manda UM aviso no celular dos admins (o mesmo envio do aviso-de-falha.js), no máximo 1 por hora por processo, e
//     registra no log e no painel do robô;
//   - de hora em hora, uma linha no log com o que cada tarefa gastou (vai para a aba Registros da Central dos robôs).
//
// Como conta: embrulha uma vez, no processo, os métodos do SDK por onde passam todas as consultas, leituras de documento,
// ouvintes e gravações (Query._get, Firestore.getAll, onSnapshot, WriteBatch._commit...). A tarefa de cada operação vem
// do AsyncLocalStorage: o que o módulo faz dentro de `tarefa('nome', () => iniciar...())` (os relógios, as promessas e as
// respostas dos ouvintes que ele criou) conta para 'nome'. O resto conta para a tarefa padrão do processo ('geral' nos
// processos principais, que não é pausada: só avisa; o módulo do processo nos satélites do robo-modulo.js).
// Contas aproximadas (o Google cobra 1 leitura por consulta vazia, 1 por 1000 na contagem; o stream e o listDocuments
// ficam de fora): servem para frear o que dispara, não para a fatura.
//
// Regra deste módulo: NUNCA derrubar o robô. Erro no próprio contador é engolido; se o SDK mudar e um método não existir,
// aquele ponto só deixa de ser contado.
//
//   require('./consumo').instalar(db, { log });                              // uma vez, no processo do robô
//   const { tarefa } = require('./consumo');
//   tarefa('mapa-do-drive', () => require('./drive-indice').iniciarIndiceDrive(db, log));
//   tarefa('backup', () => ..., { tetoLeituras: 400000 });                   // tarefa grande de propósito: teto próprio
'use strict';
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const TETO_LEITURAS = 20000;
const TETO_GRAVACOES = 5000;
const JANELA_MS = 10 * 60 * 1000;
const PAUSA_MS = 15 * 60 * 1000;
const AVISO_A_CADA_MS = 60 * 60 * 1000;
const RESUMO_A_CADA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;
const ESPERA_DO_ERRO_MS = 2000;   // o erro da tarefa pausada chega depois de 2 s: um laço sem espera não gira a seco
const GERAL = 'geral';
const FREIO = 'freio';            // o próprio aviso do freio (nunca pausa)

// ---------- o contador (puro: o teste-consumo.js roda sem banco) ----------

/**
 * o: { agora() ms, tetoLeituras, tetoGravacoes, janelaMs, pausaMs, avisoMs, naoPausar: Set (as tarefas que só avisam),
 *      aoDisparar(ev) }. ev: { tarefa, leituras, gravacoes, total: { leituras, gravacoes }, pausada, ate, avisar }.
 * contar(tarefa, leituras, gravacoes) soma no minuto e confere o teto; pausadaAte(tarefa) → ms (0 = livre).
 */
function criarContador(opcoes) {
  const o = Object.assign({
    agora: Date.now, tetoLeituras: TETO_LEITURAS, tetoGravacoes: TETO_GRAVACOES, janelaMs: JANELA_MS,
    pausaMs: PAUSA_MS, avisoMs: AVISO_A_CADA_MS, naoPausar: new Set([GERAL]), aoDisparar: () => {},
  }, opcoes || {});
  const minutos = new Map();       // minuto → Map(tarefa → { l, g })
  const tetos = new Map();         // tarefa → { tetoLeituras, tetoGravacoes } (a tarefa com teto próprio é medida sozinha)
  const pausas = new Map();        // tarefa → até (ms)
  const hora = new Map();          // tarefa → { l, g } desde o último resumo
  let ultimoAviso = -Infinity;
  let disparando = false;
  const nMinutos = Math.max(1, Math.round(o.janelaMs / MINUTO_MS));

  function janela(agora) {
    const m = Math.floor(agora / MINUTO_MS);
    for (const k of minutos.keys()) if (k <= m - nMinutos) minutos.delete(k);
    const soma = new Map();
    for (const porTarefa of minutos.values()) {
      for (const [t, v] of porTarefa) { const s = soma.get(t) || { l: 0, g: 0 }; s.l += v.l; s.g += v.g; soma.set(t, s); }
    }
    return soma;
  }

  function zerar(tarefa) { for (const porTarefa of minutos.values()) porTarefa.delete(tarefa); }

  function disparar(tarefa, gasto, total, agora) {
    zerar(tarefa);   // o que já foi contado não dispara de novo; se outra tarefa também passou, a próxima conta pega ela
    const pausada = !o.naoPausar.has(tarefa);
    const ate = pausada ? agora + o.pausaMs : 0;
    if (pausada) pausas.set(tarefa, ate);
    const avisar = agora - ultimoAviso >= o.avisoMs;
    if (avisar) ultimoAviso = agora;
    const ev = { tarefa, leituras: gasto.l, gravacoes: gasto.g, total: { leituras: total.l, gravacoes: total.g }, pausada, ate, avisar };
    disparando = true;
    try { o.aoDisparar(ev); } catch (e) { /* quem avisa não derruba quem conta */ } finally { disparando = false; }
    return ev;
  }

  /** Confere os tetos agora; devolve os disparos (para o teste). */
  function conferir(agora = o.agora()) {
    const disparos = [];
    if (disparando) return disparos;
    const soma = janela(agora);
    const total = { l: 0, g: 0 };
    for (const [t, v] of soma) {
      const teto = tetos.get(t);
      if (teto) {
        if (v.l > teto.tetoLeituras || v.g > teto.tetoGravacoes) disparos.push(disparar(t, v, v, agora));
        continue;
      }
      total.l += v.l; total.g += v.g;
    }
    if (total.l > o.tetoLeituras || total.g > o.tetoGravacoes) {
      // a culpada: quem mais pesou, pela fração do teto (leitura e gravação na mesma régua)
      let culpada = null, peso = -1;
      for (const [t, v] of soma) {
        if (tetos.has(t)) continue;
        const p = v.l / o.tetoLeituras + v.g / o.tetoGravacoes;
        if (p > peso) { peso = p; culpada = t; }
      }
      if (culpada != null) disparos.push(disparar(culpada, soma.get(culpada), total, agora));
    }
    return disparos;
  }

  return {
    contar(tarefa, leituras, gravacoes) {
      const l = Math.max(0, Number(leituras) || 0), g = Math.max(0, Number(gravacoes) || 0);
      if (!l && !g) return [];
      const t = String(tarefa || GERAL);
      const agora = o.agora();
      const m = Math.floor(agora / MINUTO_MS);
      if (!minutos.has(m)) minutos.set(m, new Map());
      const porTarefa = minutos.get(m);
      const v = porTarefa.get(t) || { l: 0, g: 0 };
      v.l += l; v.g += g;
      porTarefa.set(t, v);
      const h = hora.get(t) || { l: 0, g: 0 };
      h.l += l; h.g += g;
      hora.set(t, h);
      return conferir(agora);
    },
    conferir,
    /** Até quando a tarefa está pausada (ms); 0 = livre. */
    pausadaAte(tarefa) {
      const ate = pausas.get(String(tarefa || GERAL));
      if (!ate) return 0;
      if (ate <= o.agora()) { pausas.delete(String(tarefa || GERAL)); return 0; }
      return ate;
    },
    /** Teto próprio de uma tarefa (ela sai da soma do processo e é medida sozinha). */
    definirTeto(tarefa, t) {
      if (!t) return;
      tetos.set(String(tarefa), { tetoLeituras: Number(t.tetoLeituras) || o.tetoLeituras, tetoGravacoes: Number(t.tetoGravacoes) || o.tetoGravacoes });
    },
    /** Os últimos minutos da janela: [{ minuto (ISO), leituras, gravacoes, porTarefa: { t: { leituras, gravacoes } } }]. */
    porMinuto(agora = o.agora()) {
      janela(agora);
      return [...minutos.entries()].sort((a, b) => a[0] - b[0]).map(([m, porTarefa]) => {
        const linha = { minuto: new Date(m * MINUTO_MS).toISOString(), leituras: 0, gravacoes: 0, porTarefa: {} };
        for (const [t, v] of porTarefa) { linha.leituras += v.l; linha.gravacoes += v.g; linha.porTarefa[t] = { leituras: v.l, gravacoes: v.g }; }
        return linha;
      });
    },
    /** O que cada tarefa gastou desde o último resumo, e zera. [{ tarefa, leituras, gravacoes }], do maior para o menor. */
    resumoDaHora() {
      const r = [...hora.entries()].map(([tarefa, v]) => ({ tarefa, leituras: v.l, gravacoes: v.g }))
        .sort((a, b) => (b.leituras + b.gravacoes) - (a.leituras + a.gravacoes));
      hora.clear();
      return r;
    },
  };
}

/** O texto do aviso (puro). */
function textoDoAviso(ev, processo, maquina) {
  const n = x => Number(x || 0).toLocaleString('pt-BR');
  const onde = processo + (maquina ? ' (' + maquina + ')' : '');
  const quanto = n(ev.leituras) + ' leituras e ' + n(ev.gravacoes) + ' gravações em 10 min';
  const hora = ev.ate ? new Date(ev.ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return {
    titulo: 'Robô gastando demais o banco: ' + ev.tarefa,
    corpo: ev.pausada
      ? 'A tarefa "' + ev.tarefa + '" do ' + onde + ' fez ' + quanto + ' e ficou pausada até ' + hora + '. Se voltar a disparar, olhe o log do robô.'
      : 'O ' + onde + ' fez ' + quanto + ' (a maior parte fora de uma tarefa que dê para pausar: "' + ev.tarefa + '"). Nada foi pausado; olhe o log do robô.',
  };
}

// ---------- no processo do robô ----------

const als = new AsyncLocalStorage();
let st = null;   // { contador, log, processo, padrao, ... } depois do instalar()

const tarefaAtual = () => { const s = als.getStore(); return (s && s.tarefa) || (st ? st.padrao : GERAL); };

/** Roda fn() como a tarefa `nome` (tudo o que ela criar conta para ela). opcoes: { tetoLeituras, tetoGravacoes }. */
function tarefa(nome, fn, opcoes) {
  try { if (opcoes && st) st.contador.definirTeto(nome, opcoes); else if (opcoes) tetosAntes.set(String(nome), opcoes); } catch (e) { /* segue */ }
  return als.run({ tarefa: String(nome) }, fn);
}
const tetosAntes = new Map();   // os tetos pedidos antes do instalar()

function contar(t, l, g) { try { if (st) st.contador.contar(t, l, g); } catch (e) { /* nunca derruba */ } }

function erroDaPausa(t) {
  const ate = st ? st.contador.pausadaAte(t) : 0;
  if (!ate) return null;
  const e = new Error('consumo: a tarefa "' + t + '" está pausada pelo freio de consumo do banco até ' + new Date(ate).toLocaleTimeString('pt-BR'));
  e.code = 'consumo-pausada';
  return e;
}
const esperaDoErro = () => (st && st.esperaDoErroMs != null ? st.esperaDoErroMs : ESPERA_DO_ERRO_MS);
const falharDepois = e => new Promise((_, nao) => setTimeout(() => nao(e), esperaDoErro()));
const naContexto = (ctx, fn) => (ctx ? als.run(ctx, fn) : fn());

/** Quantas leituras um resultado de get custou: o tamanho da consulta, a contagem (1 a cada 1000) ou 1. */
function leiturasDe(r) {
  try {
    const x = r && r.result !== undefined ? r.result : r;
    if (x && typeof x.size === 'number') return Math.max(1, x.size);
    if (x && typeof x.data === 'function') {
      const d = x.data();
      if (d && typeof d.count === 'number') return Math.max(1, Math.ceil(d.count / 1000));
    }
  } catch (e) { /* conta 1 */ }
  return 1;
}

/** Troca proto[nome] por embrulho(original); devolve true quando trocou. */
function embrulhar(proto, nome, embrulho) {
  if (!proto || typeof proto[nome] !== 'function' || proto[nome].__consumo) return false;
  const original = proto[nome];
  const novo = embrulho(original);
  novo.__consumo = true;
  proto[nome] = novo;
  return true;
}

/** As classes do SDK, tiradas de uma instância (vale para a cópia do @google-cloud/firestore que o firebase-admin usa). */
function classesDo(db) {
  const c = {};
  try { c.Firestore = db.constructor; } catch (e) { /* segue */ }
  try { const col = db.collection('_consumo'); c.Query = Object.getPrototypeOf(col.constructor.prototype).constructor; c.DocumentReference = col.doc('x').constructor; try { c.AggregateQuery = col.count().constructor; } catch (e) { /* SDK antigo */ } } catch (e) { /* segue */ }
  try { c.WriteBatch = db.batch().constructor; } catch (e) { /* segue */ }
  try { c.Transaction = require('firebase-admin/firestore').Transaction; } catch (e) { /* segue */ }
  return c;
}

/** Embrulha os pontos do SDK. Devolve a lista do que foi embrulhado (para o log e o teste). */
function embrulharSdk(C) {
  const feitos = [];
  const leitura = (proto, nome, quantas) => embrulhar(proto, nome, original => function (...args) {
    const t = tarefaAtual();
    const e = erroDaPausa(t);
    if (e) return falharDepois(e);
    const p = original.apply(this, args);
    if (p && typeof p.then === 'function') p.then(r => contar(t, quantas ? quantas(args, r) : leiturasDe(r), 0), () => {});
    return p;
  }) && feitos.push(nome);
  // consultas (Query.get, CollectionReference.get e a consulta dentro da transação passam pelo _get) e contagens
  if (C.Query) leitura(C.Query.prototype, typeof C.Query.prototype._get === 'function' ? '_get' : 'get');
  if (C.AggregateQuery) leitura(C.AggregateQuery.prototype, typeof C.AggregateQuery.prototype._get === 'function' ? '_get' : 'get');
  // documentos (DocumentReference.get passa pelo getAll)
  const refs = args => args.filter(a => C.DocumentReference && a instanceof C.DocumentReference).length || 1;
  if (C.Firestore) leitura(C.Firestore.prototype, 'getAll', refs);
  // na transação, só o documento (a consulta já contou no _get); a pausa vale no commit
  if (C.Transaction) {
    for (const nome of ['get', 'getAll']) {
      embrulhar(C.Transaction.prototype, nome, original => function (...args) {
        const t = tarefaAtual();
        const n = nome === 'get' ? (C.DocumentReference && args[0] instanceof C.DocumentReference ? 1 : 0) : refs(args);
        const p = original.apply(this, args);
        if (n && p && typeof p.then === 'function') p.then(() => contar(t, n, 0), () => {});
        return p;
      }) && feitos.push('Transaction.' + nome);
    }
  }
  // gravações: set/update/create/delete do documento, o lote, a transação e o BulkWriter (recursiveDelete) usam o _commit
  if (C.WriteBatch) {
    const nome = typeof C.WriteBatch.prototype._commit === 'function' ? '_commit' : 'commit';
    embrulhar(C.WriteBatch.prototype, nome, original => function (...args) {
      const t = tarefaAtual();
      let n = 1;
      try { n = Array.isArray(this._ops) ? this._ops.length : (typeof this._opCount === 'number' ? this._opCount : 1); } catch (e) { /* 1 */ }
      if (n > 0) {
        const e = erroDaPausa(t);
        if (e) return falharDepois(e);
      }
      const p = original.apply(this, args);
      if (n > 0 && p && typeof p.then === 'function') p.then(() => contar(t, 0, n), () => {});
      return p;
    }) && feitos.push('WriteBatch.' + nome);
  }
  // ouvintes: a 1ª resposta conta os documentos; as seguintes, só o que mudou. A resposta roda na tarefa de quem ouviu
  const ouvinte = (proto, ehDoc) => embrulhar(proto, 'onSnapshot', original => function (aoChegar, aoErro, ...resto) {
    if (typeof aoChegar !== 'function') return original.call(this, aoChegar, aoErro, ...resto);
    // sem tarefa, a resposta roda como a tarefa padrão: o evento do gRPC pode vir no contexto de outra tarefa qualquer
    const t = tarefaAtual();
    const ctx = als.getStore() || { tarefa: t };
    const e = erroDaPausa(t);
    if (e) {
      const relogio = setTimeout(() => { if (typeof aoErro === 'function') naContexto(ctx, () => aoErro(e)); }, esperaDoErro());
      return () => clearTimeout(relogio);
    }
    let primeira = true;
    const chegou = snap => {
      try {
        const n = ehDoc ? 1 : primeira ? Math.max(1, snap.size || 0) : (typeof snap.docChanges === 'function' ? snap.docChanges().length : 1);
        primeira = false;
        contar(t, n, 0);
      } catch (err) { /* conta nada */ }
      return naContexto(ctx, () => aoChegar(snap));
    };
    const errou = typeof aoErro === 'function' ? err => naContexto(ctx, () => aoErro(err)) : aoErro;
    return original.call(this, chegou, errou, ...resto);
  }) && feitos.push((ehDoc ? 'DocumentReference' : 'Query') + '.onSnapshot');
  if (C.Query) ouvinte(C.Query.prototype, false);
  if (C.DocumentReference) ouvinte(C.DocumentReference.prototype, true);
  return feitos;
}

function nomeDoProcesso() {
  const base = path.basename(process.argv[1] || 'node', '.js');
  return base === 'robo-modulo' && process.argv[2] ? 'robô ' + process.argv[2] : base;
}

/**
 * Liga o contador neste processo (só uma vez). o: { log, processo, tarefa (a tarefa padrão: 'geral', que não pausa),
 * avisar(titulo, corpo) (padrão: o aviso de falha no celular dos admins), classes (o teste), agora, tetos... }.
 * Devolve { contador, embrulhados }.
 */
function instalar(db, opcoes) {
  try {
    if (st) return st;
    const o = opcoes || {};
    const log = o.log || ((...m) => console.log(new Date().toLocaleString('pt-BR'), '[consumo]', ...m));
    const processo = o.processo || nomeDoProcesso();
    const maquina = (() => { try { return require('os').hostname(); } catch (e) { return ''; } })();
    let envio;
    const avisar = o.avisar || ((titulo, corpo) => {
      if (envio === undefined) envio = require('./aviso-de-falha').envioPadrao(db, log);
      if (!envio) return Promise.resolve(0);
      return envio.enviar('admin', '', titulo, corpo, 'consumo-banco', require('./aviso-de-falha').LINK_SUPORTE);
    });
    const contador = criarContador({
      agora: o.agora || Date.now,
      tetoLeituras: o.tetoLeituras || TETO_LEITURAS, tetoGravacoes: o.tetoGravacoes || TETO_GRAVACOES,
      pausaMs: o.pausaMs || PAUSA_MS,
      // fora da tarefa culpada (pausada agora): o painel e o aviso gravam e leem como a tarefa 'freio', que não pausa
      aoDisparar: ev => als.run({ tarefa: FREIO }, () => {
        const txt = textoDoAviso(ev, processo, maquina);
        log('FREIO DE CONSUMO:', txt.corpo, '(no processo: ' + ev.total.leituras + ' leituras e ' + ev.total.gravacoes + ' gravações na janela)');
        try { require('./painel').erro('robo', txt.titulo, txt.corpo); } catch (e) { /* só o painel */ }
        if (ev.pausada) { const r = setTimeout(() => log('freio de consumo: a tarefa "' + ev.tarefa + '" voltou'), Math.max(0, ev.ate - Date.now()) + 1000); if (r.unref) r.unref(); }
        if (ev.avisar) Promise.resolve().then(() => avisar(txt.titulo, txt.corpo)).catch(err => log('freio de consumo: o aviso não saiu -', err && err.message));
      }),
      naoPausar: new Set([GERAL, FREIO]),
    });
    st = { contador, log, processo, padrao: String(o.tarefa || GERAL), embrulhados: [], esperaDoErroMs: o.esperaDoErroMs };
    for (const [t, teto] of tetosAntes) contador.definirTeto(t, teto);
    tetosAntes.clear();
    st.embrulhados = embrulharSdk(o.classes || classesDo(db));
    if (!o.semRelogio) {
      const r = setInterval(() => {
        const h = contador.resumoDaHora();
        const l = h.reduce((s, x) => s + x.leituras, 0), g = h.reduce((s, x) => s + x.gravacoes, 0);
        if (l || g) log('consumo do banco na última hora:', l, 'leituras e', g, 'gravações —', h.slice(0, 8).map(x => x.tarefa + ' ' + x.leituras + '/' + x.gravacoes).join(', '));
      }, RESUMO_A_CADA_MS);
      if (r.unref) r.unref();
    }
    log('freio de consumo ligado (' + processo + '; teto ' + textoDoTeto(o) + ' em 10 min; ' + st.embrulhados.length + ' pontos do banco contados)');
    return st;
  } catch (err) {
    try { (opcoes && opcoes.log ? opcoes.log : console.log)('freio de consumo não ligou:', err && err.message); } catch (e) { /* segue */ }
    return null;
  }
}
const textoDoTeto = o => (o.tetoLeituras || TETO_LEITURAS) + ' leituras / ' + (o.tetoGravacoes || TETO_GRAVACOES) + ' gravações';

/** Só para o teste: esquece o processo instalado (os métodos embrulhados continuam embrulhados). */
function _reiniciar() { st = null; tetosAntes.clear(); }

module.exports = {
  instalar, tarefa, tarefaAtual, criarContador, textoDoAviso, leiturasDe, embrulharSdk, classesDo,
  porMinuto: () => (st ? st.contador.porMinuto() : []),
  TETO_LEITURAS, TETO_GRAVACOES, JANELA_MS, PAUSA_MS, AVISO_A_CADA_MS, GERAL, _reiniciar,
};
