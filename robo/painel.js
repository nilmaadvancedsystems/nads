// O painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo, arquivando e afins").
// Um módulo pequeno que os dois robôs usam para PUBLICAR o que estão fazendo; o nads mostra em Cadastro › Painel do robô.
//
//   robo/painelPC  (o arquivador deste PC)   o batimento, a cada minuto: a máquina, a versão do código, desde quando está
//   robo/painelVM  (o vigia da nuvem)        ligado, o que está fazendo agora, os módulos que ligaram, as filas de pedidos
//                                            (quantos esperando, quantos em andamento e o mais antigo) e, no PC, o que foi
//                                            arquivado hoje e no mês.
//   roboAtividade/{id}                       uma linha por coisa feita (arquivou, emitiu a guia, baixou os XMLs, deu erro),
//                                            com expiraEm; o próprio robô apaga as de mais de 7 dias.
//
// Quem lê: só o admin e o diretor (firestore.rules do Entregas). Quem grava: o robô, pelo Admin SDK.
//
// Regra deste módulo: NUNCA derrubar o robô. Toda função engole o próprio erro (no máximo uma linha no log), e antes do
// iniciar() nada vai para o banco (os testes e os scripts avulsos que carregam os módulos não gravam nada; as atividades
// de antes do iniciar esperam numa fila curta e saem junto com o primeiro batimento).
//
// Uso:
//   const painel = require('./painel');
//   painel.iniciar(db, { robo: 'pc', log, filas: painel.FILAS.pc });
//   painel.fazendo('fgts', 'Emitindo FGTS 3/10 — EMPRESA');   ...   painel.fazendo('fgts', null);
//   painel.atividade('fgts', 'Emitiu a guia do FGTS de EMPRESA (10/2026)', 'guia 123 · R$ 1.234,56');
//   painel.erro('fgts', 'A guia do FGTS de EMPRESA não saiu', 'o login no FGTS Digital não foi');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const A_CADA_MS = 60 * 1000;
const DIAS_GUARDADOS = 7;
const DIA_MS = 24 * 36e5;
const LIMPAR_A_CADA_MS = 6 * 36e5;
const LIMPAR_POR_VEZ = 300;
// o freio: um laço que registra a mesma coisa sem parar não pode virar milhares de gravações
const MAX_POR_JANELA = 60;
const JANELA_MS = 10 * 60 * 1000;
const REPETIDA_MS = 60 * 1000;
const MAX_ANTES_DE_INICIAR = 20;
const MAX_AGORA = 8;
const MAX_TEXTO = 200;
const MAX_DETALHE = 500;
// as filas consultadas (as que não têm ouvinte) a cada 15 min (era 5; 10/11/2026, consumo do banco)
const CONSULTA_A_CADA_MS = 15 * 60 * 1000;
const LIMITE_DA_FILA = 200;

const COLECAO = 'roboAtividade';
const DOCS = { pc: 'painelPC', vm: 'painelVM' };
const NOMES = { pc: 'Robô do PC', vm: 'Robô da nuvem' };

/** Os tipos de atividade (o filtro do painel). Tipo fora da lista vira 'robo'. */
const TIPOS = ['robo', 'arquivamento', 'fgts', 'alterdata', 'sieg', 'area-cliente', 'gmail', 'cobranca', 'envios', 'nfse', 'sefaz', 'extratos'];

/**
 * As filas que cada robô atende. esperando/andamento: os status de cada lado (sem status nenhum, todo documento da
 * coleção está esperando: as caixas de entrada da Área do Cliente). consultar: lê de 5 em 5 minutos só a data, em vez de
 * ouvir (as caixas de arquivos guardam o arquivo inteiro no documento).
 */
const FILAS = {
  pc: [
    { id: 'arquivamento', nome: 'Arquivamento', colecao: 'solicitacoesArquivo', esperando: ['pendente', 'aguardando'], andamento: ['processando'] },
    { id: 'fgts', nome: 'FGTS Digital', colecao: 'pedidosFgts', esperando: ['pendente'], andamento: ['trabalhando', 'verificacao', 'login'] },
    { id: 'alterdata', nome: 'Alterdata (balancete e razão)', colecao: 'pedidosAlterdata', esperando: ['pendente'], andamento: ['trabalhando'] },
    { id: 'sieg', nome: 'SIEG', colecao: 'pedidosSieg', esperando: ['pendente'], andamento: ['processando'] },
    { id: 'area-chamados', nome: 'Chamados da Área do Cliente', colecao: 'areaClienteChamados', consultar: true },
    { id: 'area-envios', nome: 'Arquivos da Área do Cliente', colecao: 'areaClienteEnvios', consultar: true },
    { id: 'mensagens', nome: 'Mensagens ao Claude da rotina', colecao: 'arquivadorMensagens', esperando: ['pendente', 'aguardando'], andamento: ['respondendo'] },
    { id: 'pedidos-arquivador', nome: 'Pedidos do Arquivador (abrir, arquivar em…)', colecao: 'pedidosArquivador', esperando: ['pendente'], andamento: ['trabalhando'] },
  ],
  vm: [
    { id: 'gmail', nome: 'Gmail e cobranças', colecao: 'solicitacoesEmail', esperando: ['pendente'], andamento: ['processando'] },
    { id: 'nfse', nome: 'NFS-e dos honorários', colecao: 'nfseEmissoes', esperando: ['pedida', 'cancelamento-pedido'], andamento: ['enviando', 'processando'], campoData: 'pedidoEm' },
    { id: 'sefaz', nome: 'Situação na SEFAZ', colecao: 'pedidosSituacao', esperando: ['pendente'], andamento: ['processando'] },
    { id: 'envios', nome: 'Envios do nads (Claudio Secretario)', colecao: 'enviosSecretario', esperando: ['pendente'], andamento: ['gravando'] },
    // extratosRecebidos NÃO é fila do robô: o Gmail/Drive só depositam e quem importa é o Extrator, quando alguém o abre
    // (aparecia sempre "atrasada" sem o robô ter o que fazer; tirada em 22/10/2026).
  ],
};

// ---------- funções puras (o teste-painel.js roda sem banco) ----------

/** O texto numa linha só, cortado com reticências. */
function cortar(t, max) {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Uma data do banco (texto ISO, Date, Timestamp do Firestore ou milissegundos) em ISO; '' se não der. */
function isoDe(v) {
  try {
    if (!v) return '';
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : ''; }
    if (typeof v === 'number') return new Date(v).toISOString();
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : '';
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
  } catch (e) { /* data estranha: fica sem */ }
  return '';
}

/** Quantos esperando e em andamento numa fila, e o pedido mais antigo (ISO). `dados`: os documentos (só os dados). */
function contarFila(dados, cfg) {
  const andamentos = cfg.andamento || [];
  const esperas = cfg.esperando || [];
  let esperando = 0, andamento = 0, maisAntigoEm = '';
  for (const d of dados || []) {
    const s = String((d && d.status) || '');
    if (andamentos.includes(s)) andamento++;
    else if (!esperas.length || esperas.includes(s)) esperando++;
    else continue;
    const em = isoDe(d[cfg.campoData || 'criadoEm']) || isoDe(d.criadoEm) || isoDe(d.em);
    if (em && (!maisAntigoEm || em < maisAntigoEm)) maisAntigoEm = em;
  }
  return { esperando, andamento, maisAntigoEm };
}

/**
 * O freio das atividades: no máximo MAX_POR_JANELA a cada JANELA_MS, e a mesma (tipo + texto) só uma vez por minuto.
 * Devolve { pode(chave, agoraMs) → boolean, descartadas() → número }.
 */
function criarFreio(max = MAX_POR_JANELA, janela = JANELA_MS, repetida = REPETIDA_MS) {
  const vezes = [];
  const ultimas = new Map();
  let descartadas = 0;
  return {
    pode(chave, agora) {
      while (vezes.length && agora - vezes[0] > janela) vezes.shift();
      const antes = ultimas.get(chave);
      if ((antes != null && agora - antes < repetida) || vezes.length >= max) { descartadas++; return false; }
      vezes.push(agora);
      ultimas.set(chave, agora);
      if (ultimas.size > 500) for (const [k, t] of ultimas) if (agora - t > repetida) ultimas.delete(k);
      return true;
    },
    descartadas: () => descartadas,
  };
}

/** A versão do código que está rodando: o commit (curto) e a data dele; na nuvem, também a robo-versao do metadado. */
function versaoDoCodigo(pasta = __dirname) {
  let v = '';
  try {
    const s = execFileSync('git', ['-C', pasta, 'log', '-1', '--format=%h %cI'], { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const [hash, data] = s.split(' ');
    if (hash) v = hash + (data ? ' de ' + data.slice(0, 10).split('-').reverse().join('/') : '');
  } catch (e) { /* sem git: fica a da nuvem, se houver */ }
  try {
    const nuvem = fs.readFileSync('/opt/robo/versao', 'utf8').trim();
    if (nuvem) v = v ? v + ' · ' + nuvem : nuvem;
  } catch (e) { /* não é a máquina da nuvem */ }
  return v || 'desconhecida';
}

/** O documento do batimento (robo/painelPC ou robo/painelVM). */
function montarBatimento(s, agoraIso) {
  return Object.assign({}, s.extra, {
    robo: s.robo,
    nome: NOMES[s.robo] || s.robo,
    maquina: s.maquina,
    versao: s.versao,
    ligadoEm: s.ligadoEm,
    em: agoraIso,
    desligadoEm: null,
    agora: s.agora.slice(0, MAX_AGORA),
    modulos: s.modulos,
    filas: s.filas,
    // o último trabalho e o último erro de cada tipo (a tela Saúde dos robôs; 07/11/2026): vale mesmo quando a atividade
    // dos últimos 7 dias já passou das 150 linhas que a tela lê
    ultimos: s.ultimos || {},
  });
}

// ---------- o estado deste processo ----------
let st = null;
const agora = new Map();          // chave -> { chave, texto, desde }
const provedores = new Map();     // chave -> () => texto | null (lido a cada batimento)
const modulos = new Map();        // id -> { id, nome, ligado, motivo }
const filas = new Map();          // id -> { id, nome, esperando, andamento, maisAntigoEm, erro }
let extra = {};
let antesDeIniciar = [];
const freio = criarFreio();
const logs = new Map();
const ultimos = new Map();        // tipo -> { trabalho: { em, texto }, erro: { em, texto, detalhe } }

const isoAgora = () => new Date().toISOString();
function logUmaVez(chave, ...m) {
  // a mesma falha (sem rede, sem permissão) no máximo uma vez por hora no log
  const t = logs.get(chave) || 0;
  if (Date.now() - t < 36e5) return;
  logs.set(chave, Date.now());
  try { (st && st.log ? st.log : console.log)('painel:', ...m); } catch (e) { /* nem o log */ }
}

function oQueEstaFazendo() {
  const lista = Array.from(agora.values());
  for (const [chave, f] of provedores) {
    let texto = null;
    try { texto = f(); } catch (e) { texto = null; }
    if (texto && !agora.has(chave)) lista.push({ chave, texto: cortar(texto, MAX_TEXTO), desde: '' });
  }
  return lista;
}

/** Grava o batimento agora. `estado` (opcional) entra junto e fica para os próximos (ex.: { arquivados }). */
function batimento(estado) {
  try {
    if (estado && typeof estado === 'object') extra = Object.assign({}, extra, estado);
    if (!st) return Promise.resolve();
    const doc = montarBatimento({
      robo: st.robo, maquina: st.maquina, versao: st.versao, ligadoEm: st.ligadoEm, extra,
      agora: oQueEstaFazendo(), modulos: Array.from(modulos.values()), filas: Array.from(filas.values()),
      ultimos: Object.fromEntries(ultimos),
    }, isoAgora());
    // só o que mudou, ou a cada 5 min (batimento.js): o relógio olha de minuto em minuto
    if (!st.batida.vale(doc)) return Promise.resolve();
    return st.ref.set(doc).catch(err => { st.batida.falhou(); logUmaVez('batimento', 'não consegui bater o ponto do painel -', err.message); });
  } catch (e) { return Promise.resolve(); }
}

/** Junta ao estado publicado (sem gravar na hora: sai no próximo batimento). */
function estado(parcial) {
  try { if (parcial && typeof parcial === 'object') extra = Object.assign({}, extra, parcial); } catch (e) { /* segue */ }
}

/** O que o robô está fazendo agora, por chave (um módulo pode ter uma coisa só). texto null/'' = terminou. */
function fazendo(chave, texto) {
  try {
    const k = String(chave);
    if (!texto) { agora.delete(k); return; }
    const t = cortar(texto, MAX_TEXTO);
    const antes = agora.get(k);
    agora.set(k, { chave: k, texto: t, desde: antes ? antes.desde : isoAgora() });
  } catch (e) { /* segue */ }
}

/** Um "fazendo" que o próprio módulo responde a cada batimento (quando ele já guarda a situação numa variável). */
function fazendoPor(chave, f) {
  try { if (typeof f === 'function') provedores.set(String(chave), f); } catch (e) { /* segue */ }
}

/** Um módulo do robô ligou (ou não, e por quê). */
function modulo(id, nome, ligado, motivo) {
  try { modulos.set(String(id), { id: String(id), nome: cortar(nome, 60), ligado: !!ligado, motivo: cortar(motivo || '', 200) }); } catch (e) { /* segue */ }
}

function gravarAtividade(linha) {
  try {
    st.db.collection(COLECAO).add(Object.assign({}, linha, { robo: st.robo, maquina: st.maquina, expiraEm: new Date(Date.parse(linha.em) + DIAS_GUARDADOS * DIA_MS) }))
      .catch(err => logUmaVez('atividade', 'não consegui registrar a atividade -', err.message));
  } catch (e) { /* segue */ }
}

/**
 * Uma coisa que o robô fez. tipo: um de TIPOS; texto: a frase curta ("Emitiu a guia do FGTS de X"); detalhe: o que
 * ajuda (o número da guia, a pasta, a mensagem do erro). opcoes.erro = true para os erros (o painel destaca).
 */
function atividade(tipo, texto, detalhe, opcoes) {
  try {
    const t = TIPOS.includes(tipo) ? tipo : 'robo';
    const linha = { em: isoAgora(), tipo: t, texto: cortar(texto, MAX_TEXTO), detalhe: cortar(detalhe || '', MAX_DETALHE), erro: !!(opcoes && opcoes.erro) };
    if (opcoes && opcoes.aviso) linha.aviso = true;   // aviso: algo que a pessoa corrige no cadastro, não é falha do robô
    if (opcoes && opcoes.pedido) linha.pedido = String(opcoes.pedido).slice(0, 128);   // o pedido da fila deste erro (o "Refazer" da Central dos robôs)
    if (!linha.texto) return;
    lembrarUltimo(t, linha, opcoes);
    if (!freio.pode(t + '|' + linha.texto + '|' + linha.detalhe, Date.now())) return;
    if (!st) { if (antesDeIniciar.length < MAX_ANTES_DE_INICIAR) antesDeIniciar.push(linha); return; }
    gravarAtividade(linha);
  } catch (e) { /* segue */ }
}

/**
 * Guarda o último trabalho e o último erro do tipo (vão no próximo batimento). Aviso (algo que a pessoa corrige no cadastro)
 * não conta como erro do robô, nem como trabalho; o "ligou/desligou" do próprio robô também não conta como trabalho.
 */
function lembrarUltimo(tipo, linha, opcoes) {
  try {
    if (opcoes && opcoes.aviso) return;
    const u = ultimos.get(tipo) || {};
    if (linha.erro) u.erro = { em: linha.em, texto: linha.texto, detalhe: cortar(linha.detalhe, 200) };
    else if (tipo !== 'robo') u.trabalho = { em: linha.em, texto: linha.texto };
    ultimos.set(tipo, u);
  } catch (e) { /* segue */ }
}

/** O mesmo que atividade, marcado como erro. opcoes.pedido: o id do pedido da fila que deu este erro. */
function erro(tipo, texto, detalhe, opcoes) { atividade(tipo, texto, detalhe, Object.assign({}, opcoes, { erro: true })); }

// ---------- as filas ----------
function ouvirFila(cfg) {
  const publicar = dados => {
    filas.set(cfg.id, Object.assign({ id: cfg.id, nome: cfg.nome, erro: '' }, contarFila(dados, cfg)));
  };
  filas.set(cfg.id, { id: cfg.id, nome: cfg.nome, esperando: 0, andamento: 0, maisAntigoEm: '', erro: '' });
  const col = st.db.collection(cfg.colecao);
  const status = [...(cfg.esperando || []), ...(cfg.andamento || [])];
  const consulta = () => (status.length ? col.where('status', 'in', status) : col).limit(LIMITE_DA_FILA);
  if (cfg.consultar) {
    const ler = () => consulta().select('status', cfg.campoData || 'criadoEm').get()
      .then(s => publicar(s.docs.map(d => d.data())))
      .catch(err => { filas.set(cfg.id, Object.assign({}, filas.get(cfg.id), { erro: cortar(err.message, 120) })); logUmaVez('fila-' + cfg.id, 'fila', cfg.nome, '-', err.message); });
    ler();
    st.timers.push(setInterval(ler, CONSULTA_A_CADA_MS));
    return;
  }
  const { ouvir } = require('./ouvinte');
  st.paradas.push(ouvir('painel: fila ' + cfg.nome, consulta, snap => publicar(snap.docs.map(d => d.data())), m => logUmaVez('ouvir-' + cfg.id, m)));
}

// ---------- a limpeza ----------
async function limpar() {
  if (!st) return 0;
  try {
    const limite = new Date(Date.now() - DIAS_GUARDADOS * DIA_MS).toISOString();
    const snap = await st.db.collection(COLECAO).where('em', '<', limite).limit(LIMPAR_POR_VEZ).get();
    if (snap.empty) return 0;
    const lote = st.db.batch();
    snap.docs.forEach(d => lote.delete(d.ref));
    await lote.commit();
    return snap.size;
  } catch (err) { logUmaVez('limpar', 'não consegui apagar as atividades velhas -', err.message); return 0; }
}

/**
 * Liga o painel: o batimento a cada minuto, as filas e a limpeza. opcoes: { robo: 'pc' | 'vm', log, filas, versao }.
 * Chamar de novo não faz nada.
 */
function iniciar(db, opcoes) {
  try {
    if (st || !db) return;
    const o = opcoes || {};
    const robo = o.robo === 'vm' ? 'vm' : 'pc';
    st = {
      db, robo, log: o.log || console.log, ref: db.collection('robo').doc(DOCS[robo]),
      maquina: os.hostname(), versao: o.versao || versaoDoCodigo(), ligadoEm: isoAgora(), timers: [], paradas: [],
      batida: require('./batimento').criarBatimento(o.batimento),
    };
    for (const cfg of o.filas || []) { try { ouvirFila(cfg); } catch (err) { logUmaVez('fila-' + cfg.id, 'fila', cfg.nome, 'não ligou -', err.message); } }
    batimento();
    st.timers.push(setInterval(() => { batimento(); }, A_CADA_MS));
    // as atividades de antes do iniciar (os módulos que ligaram primeiro)
    const fila = antesDeIniciar;
    antesDeIniciar = [];
    fila.forEach(gravarAtividade);
    atividade('robo', NOMES[robo] + ' ligou em ' + st.maquina, 'versão ' + st.versao);
    st.timers.push(setTimeout(() => { void limpar(); }, 2 * 60 * 1000));
    st.timers.push(setInterval(() => { void limpar(); }, LIMPAR_A_CADA_MS));
    for (const t of st.timers) if (t && typeof t.unref === 'function') t.unref();
    st.log('painel do robô ligado (' + DOCS[robo] + ', versão ' + st.versao + ')');
  } catch (err) {
    try { (opcoes && opcoes.log ? opcoes.log : console.log)('painel do robô não ligou:', err.message); } catch (e) { /* segue */ }
  }
}

/** Ao fechar: avisa o painel na hora (desligado) e registra. Devolve a promessa das gravações (espere até ~3 s). */
function desligar() {
  try {
    if (!st) return Promise.resolve();
    st.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    st.paradas.forEach(p => { try { p(); } catch (e) { /* segue */ } });
    const em = isoAgora();
    const linha = { em, tipo: 'robo', texto: NOMES[st.robo] + ' desligou', detalhe: st.maquina, erro: false };
    return Promise.all([
      st.ref.set({ desligadoEm: em, agora: [] }, { merge: true }),
      st.db.collection(COLECAO).add(Object.assign({}, linha, { robo: st.robo, maquina: st.maquina, expiraEm: new Date(Date.now() + DIAS_GUARDADOS * DIA_MS) })),
    ]).catch(() => {});
  } catch (e) { return Promise.resolve(); }
}

/**
 * Um robô num processo próprio (o SIEG e o FGTS do NILMA-SERVER, 04/11/2026: "quero que todas funcione junto, sem fila"):
 * o processo-filho não grava o painel, manda ao pai (o arquivador, que é o único que escreve o robo/painelPC) pelo canal
 * do child_process. O pai aplica com deSatelite(). Assim a tela do painel não muda e não há dois escritores no documento.
 */
function deSatelite(msg) {
  try {
    if (!msg || !msg.painel || !Array.isArray(msg.args)) return false;
    const f = { fazendo, modulo, atividade, estado }[msg.painel];
    if (!f) return false;
    f(...msg.args);
    return true;
  } catch (e) { return false; }
}

const SATELITE = process.env.NADS_PAINEL_SATELITE === '1' && typeof process.send === 'function';
const aoPai = (tipo, args) => { try { if (process.connected) process.send({ painel: tipo, args }); } catch (e) { /* o pai saiu */ } };
const provedoresDoFilho = new Map();
let relogioDoFilho = null;

/** O que este processo está fazendo agora ([{ chave, texto, desde }]), para o "estou ocupado" (ocupado.js, 07/11/2026). */
function fazendoAgora() { try { return oQueEstaFazendo(); } catch (e) { return []; } }

module.exports = SATELITE ? {
  iniciar: () => {}, batimento: () => Promise.resolve(), desligar: () => Promise.resolve(), limpar: () => Promise.resolve(),
  estado: parcial => aoPai('estado', [parcial]),
  // guarda também aqui (o filho sabe na hora o que está fazendo, sem esperar o pai) e manda ao pai
  fazendo: (chave, texto) => { fazendo(chave, texto); aoPai('fazendo', [chave, texto || null]); },
  // no filho os provedores são lidos na hora (o pai só recebe a cada 30 s)
  fazendoAgora: () => {
    const lista = Array.from(agora.values());
    for (const [chave, f] of provedoresDoFilho) { let t = null; try { t = f(); } catch (e) { t = null; } if (t && !agora.has(chave)) lista.push({ chave, texto: cortar(t, MAX_TEXTO), desde: '' }); }
    return lista;
  },
  // o "fazendo" que o módulo responde: o filho pergunta a cada 30 s e manda o texto
  fazendoPor: (chave, f) => {
    provedoresDoFilho.set(String(chave), f);
    if (!relogioDoFilho) {
      relogioDoFilho = setInterval(() => { for (const [k, g] of provedoresDoFilho) { let t = null; try { t = g(); } catch (e) { t = null; } aoPai('fazendo', [k, t || null]); } }, 30000);
      if (relogioDoFilho.unref) relogioDoFilho.unref();
    }
  },
  modulo: (id, nome, ligado, motivo) => aoPai('modulo', [id, nome, ligado, motivo]),
  atividade: (tipo, texto, detalhe, opcoes) => aoPai('atividade', [tipo, texto, detalhe, opcoes]),
  erro: (tipo, texto, detalhe, opcoes) => aoPai('atividade', [tipo, texto, detalhe, Object.assign({}, opcoes, { erro: true })]),
  deSatelite, SATELITE,
  FILAS, TIPOS, COLECAO, DOCS,
  cortar, isoDe, contarFila, criarFreio, versaoDoCodigo, montarBatimento,
} : {
  iniciar, batimento, estado, fazendo, fazendoPor, fazendoAgora, modulo, atividade, erro, desligar, limpar, deSatelite, SATELITE,
  FILAS, TIPOS, COLECAO, DOCS,
  // para o teste
  cortar, isoDe, contarFila, criarFreio, versaoDoCodigo, montarBatimento,
};
