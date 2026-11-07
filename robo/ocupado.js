// Sair com calma (07/11/2026). De 03 a 07/11 o atualizador matou o robô do NILMA-SERVER 59 vezes (Stop-Process -Force a
// cada publicação) e a máquina da nuvem 12: o pedido do SIEG recomeçou 5 vezes, o Contábil do Alterdata foi reaberto, o
// backup da nuvem falhou e o arquivador releu os índices (~2 min) a cada vez. Aqui fica o "estou ocupado" de todos os robôs
// e o jeito de sair sem largar o trabalho no meio:
//
//   - O QUE ESTÁ EM ANDAMENTO vem do painel (painel.fazendo, que quase todo robô já chama: SIEG, FGTS, Alterdata,
//     arquivador, Gmail, SEFAZ) e das marcas daqui (ocupado.marcar, para o que não aparece no painel: o backup, os lotes,
//     o reprocesso). Nada de mexer em cada robô: o que o painel mostra como trabalho conta; o que é só informação
//     ("modo: produção", "Esperando o G:") não conta (NAO_CONTA).
//   - O PEDIDO PARA SAIR chega pelo arquivo robo/sair.pedido (o atualizador do servidor escreve) ou pelo SIGTERM (o
//     systemctl stop da nuvem). Daí em diante o processo não pega trabalho novo (o ouvinte.js para de entregar), espera o
//     que está em andamento terminar, até LIMITE_MS (10 min), e sai sozinho. Só depois disso o atualizador força.
//   - A PROVA DE VIDA: robo/robo-vivo-<nome>.json, a cada 30 s: o processo, o que está fazendo e os arquivos do robô que
//     ele carregou. O atualizador lê para saber se o robô entende o pedido, se está ocupado e se o que mudou importa.
//
//   const ocupado = require('./ocupado');
//   ocupado.iniciar({ nome: 'arquivador', log, sair: () => desligar(), vigiarPedido: true });
//   ocupado.marcar('backup', 'Backup do dia');  ...  ocupado.marcar('backup', null);
//   if (ocupado.parando()) return;   // antes de pegar um pedido novo
'use strict';
const fs = require('fs');
const path = require('path');

const PASTA = __dirname;
const PEDIDO = path.join(PASTA, 'sair.pedido');
const LIMITE_MS = Math.max(1, Number(process.env.ROBO_SAIDA_LIMITE_MIN) || 10) * 60 * 1000;
const OLHAR_PEDIDO_MS = 5000;
const VIVO_A_CADA_MS = 30 * 1000;
const DRENAR_A_CADA_MS = 2000;
// o sinal deixado por um atualizador que caiu no meio não segura a partida do robô para sempre
const ATUALIZACAO_VALE_MS = 30 * 60 * 1000;
// a versão do combinado com o atualizador (robo/atualizar-robo.js): 1 = entende o sair.pedido
const PROTOCOLO = 1;

/** O que o painel mostra mas não é trabalho em andamento (sair agora não perde nada). */
const NAO_CONTA = [
  // o modo, o ritmo do Drive, a pasta de controle e a leitura da pasta (que só recomeça na próxima partida)
  { chave: /^arquivador-novo-(modo|controle|ritmo|leitura)$/ },
  // a rotina das 9h roda em outro processo; o G: fora é o vigia do Drive esperando
  { chave: /^(rotina|drive)$/ },
  { texto: /^\s*(esperando|arquivamento esperando)\b/i },
];

/** Um item do painel ({ chave, texto }) é trabalho em andamento? */
function contaComoOcupado(item) {
  if (!item || !item.texto) return false;
  const chave = String(item.chave || '');
  const texto = String(item.texto);
  return !NAO_CONTA.some(r => (r.chave ? r.chave.test(chave) : true) && (r.texto ? r.texto.test(texto) : true));
}

/**
 * Espera o que está em andamento terminar. o: { ocupados() → [{chave, texto}], filhosVivos() → número, limiteMs,
 * aCadaMs, relogio() → ms, dormir(ms) → Promise, log }. Devolve { livre, esperouMs, pendentes }.
 */
async function drenar(o) {
  const relogio = o.relogio || Date.now;
  const inicio = relogio();
  let avisouEm = -Infinity;
  for (;;) {
    let ocup = [];
    try { ocup = (o.ocupados ? o.ocupados() : []) || []; } catch (e) { ocup = []; }
    let filhos = 0;
    try { filhos = o.filhosVivos ? Number(o.filhosVivos()) || 0 : 0; } catch (e) { filhos = 0; }
    const passou = relogio() - inicio;
    const pendentes = ocup.map(x => x.texto).concat(filhos ? [filhos + ' robô(s) em processo próprio terminando'] : []);
    if (!pendentes.length) return { livre: true, esperouMs: passou, pendentes: [] };
    if (passou >= o.limiteMs) return { livre: false, esperouMs: passou, pendentes };
    if (o.log && passou - avisouEm >= 60 * 1000) {
      avisouEm = passou;
      o.log('saindo com calma: esperando ' + pendentes.join(' · ') + ' (faltam até ' + Math.ceil((o.limiteMs - passou) / 60000) + ' min)');
    }
    await o.dormir(Math.min(o.aCadaMs || DRENAR_A_CADA_MS, Math.max(1, o.limiteMs - passou)));
  }
}

/** O pedido para sair (robo/sair.pedido), se é para ESTE processo (escrito depois que ele ligou). */
function lerPedido(ligadoEmMs, arquivo = PEDIDO) {
  try {
    const s = fs.statSync(arquivo);
    if (s.mtimeMs < ligadoEmMs - 2000) return null;
    let motivo = 'atualização';
    try { const j = JSON.parse(fs.readFileSync(arquivo, 'utf8')); if (j && j.motivo) motivo = String(j.motivo); } catch (e) { /* vazio ou texto */ }
    return { motivo, em: s.mtimeMs };
  } catch (e) { return null; }
}

/** Há uma atualização em andamento (o sinal recente)? Devolve o mtime ou 0. */
function atualizacaoEmCurso(agoraMs = Date.now(), arquivo = PEDIDO) {
  try { const s = fs.statSync(arquivo); return agoraMs - s.mtimeMs < ATUALIZACAO_VALE_MS ? s.mtimeMs : 0; } catch (e) { return 0; }
}

/**
 * Na partida, ANTES de carregar o resto do robô: se a atualização está no meio (o reset do git pode levar minutos), espera
 * ela acabar sem ler código pela metade. Síncrono de propósito (vem antes de qualquer require). Devolve true se esperou:
 * aí quem chamou sai e o laço liga de novo, inteiro no código novo.
 */
function esperarAtualizacao(log, o = {}) {
  const agora = o.relogio || Date.now;
  const dormir = o.dormirSync || (ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
  if (!atualizacaoEmCurso(agora(), o.arquivo)) return false;
  try { (log || console.log)('atualização do robô em andamento: espero ela terminar antes de ligar'); } catch (e) { /* segue */ }
  while (atualizacaoEmCurso(agora(), o.arquivo)) dormir(o.aCadaMs || 3000);
  return true;
}

/** Os arquivos do robô que este processo carregou (sieg.js, painel.js...), relativos à pasta robo/, com barras normais. */
function modulosCarregados(cache = require.cache, pasta = PASTA) {
  const raiz = pasta.endsWith(path.sep) ? pasta : pasta + path.sep;
  return Object.keys(cache)
    .filter(f => f.startsWith(raiz) && !f.includes(path.sep + 'node_modules' + path.sep))
    .map(f => f.slice(raiz.length).split(path.sep).join('/'))
    .sort();
}

// ---------- o estado deste processo ----------
const marcas = new Map();     // chave -> { chave, texto, desde }
const aoPararFns = [];
const st = { nome: '', log: console.log, ligadoEm: Date.now(), parandoDesde: 0, motivo: '', sair: null, filhosVivos: null, promessa: null, timers: [] };

/** O que não passa pelo painel (o backup, um lote, o reprocesso). texto null = terminou. */
function marcar(chave, texto) {
  try {
    const k = String(chave);
    if (!texto) { marcas.delete(k); return; }
    const antes = marcas.get(k);
    marcas.set(k, { chave: k, texto: String(texto), desde: antes ? antes.desde : new Date().toISOString() });
  } catch (e) { /* nunca derruba o robô */ }
}

/** O trabalho em andamento neste processo (o do painel que conta e as marcas). */
function agora() {
  let doPainel = [];
  try { const p = require('./painel'); if (typeof p.fazendoAgora === 'function') doPainel = p.fazendoAgora() || []; } catch (e) { doPainel = []; }
  return doPainel.concat(Array.from(marcas.values())).filter(contaComoOcupado);
}

/** Já pediram para este processo sair? (então não pegue trabalho novo) */
function parando() { return !!st.parandoDesde; }

/** Chamada uma vez quando o pedido de saída chega (ex.: parar o arquivador novo, avisar os filhos). */
function aoParar(f) { if (typeof f === 'function') aoPararFns.push(f); }

function arquivoVivo(nome = st.nome) { return path.join(PASTA, 'robo-vivo-' + nome + '.json'); }

function gravarVivo() {
  if (!st.nome) return;
  try {
    const dados = {
      nome: st.nome, pid: process.pid, protocolo: PROTOCOLO, ligadoEm: new Date(st.ligadoEm).toISOString(), em: new Date().toISOString(),
      parando: parando(), motivo: st.motivo || null, ocupado: agora(), modulos: modulosCarregados(),
    };
    const arq = arquivoVivo();
    fs.writeFileSync(arq + '.tmp', JSON.stringify(dados));
    fs.renameSync(arq + '.tmp', arq);
  } catch (e) { /* sem disco: o atualizador trata como robô antigo */ }
}

/**
 * Começa a sair com calma: não pega trabalho novo, espera o que está em andamento (até o limite) e chama o sair().
 * Chamar de novo devolve a mesma promessa.
 */
function pedirParada(motivo, opcoes = {}) {
  if (st.promessa) return st.promessa;
  st.parandoDesde = Date.now();
  st.motivo = String(motivo || 'pedido');
  const limiteMs = opcoes.limiteMs || LIMITE_MS;
  const log = st.log || console.log;
  try { log('pedido para sair (' + st.motivo + '): não pego trabalho novo e espero o que está em andamento (até ' + Math.round(limiteMs / 60000) + ' min)'); } catch (e) { /* segue */ }
  for (const f of aoPararFns) { try { f(st.motivo); } catch (e) { /* segue */ } }
  gravarVivo();
  st.promessa = drenar({
    ocupados: agora, filhosVivos: st.filhosVivos, limiteMs, aCadaMs: DRENAR_A_CADA_MS,
    dormir: ms => new Promise(r => setTimeout(r, ms)), log,
  }).then(r => {
    try {
      log(r.livre ? 'nada em andamento (esperei ' + Math.round(r.esperouMs / 1000) + ' s): saindo'
        : 'passou de ' + Math.round(limiteMs / 60000) + ' min e ainda tem ' + r.pendentes.join(' · ') + ': saindo assim mesmo');
    } catch (e) { /* segue */ }
    return st.sair ? st.sair(r) : r;
  });
  return st.promessa;
}

/**
 * Liga o "estou ocupado" deste processo. o: { nome ('arquivador', 'sieg', 'vigia'...), log, sair(r) (o desligar do robô,
 * depois da espera), filhosVivos() (os processos-filhos que ainda não saíram), vigiarPedido (olha o robo/sair.pedido) }.
 */
function iniciar(o = {}) {
  st.nome = String(o.nome || 'robo').replace(/[^\w-]+/g, '_');
  st.log = o.log || console.log;
  st.sair = o.sair || null;
  st.filhosVivos = o.filhosVivos || null;
  gravarVivo();
  const vivo = setInterval(gravarVivo, VIVO_A_CADA_MS);
  if (vivo.unref) vivo.unref();
  st.timers.push(vivo);
  if (o.vigiarPedido) {
    const olhar = setInterval(() => { if (!parando()) { const p = lerPedido(st.ligadoEm); if (p) void pedirParada(p.motivo); } }, OLHAR_PEDIDO_MS);
    if (olhar.unref) olhar.unref();
    st.timers.push(olhar);
  }
  // o atualizador não confunde um processo que saiu com um vivo
  process.on('exit', () => {
    try { const arq = arquivoVivo(); if (JSON.parse(fs.readFileSync(arq, 'utf8')).pid === process.pid) fs.unlinkSync(arq); } catch (e) { /* segue */ }
  });
}

module.exports = {
  iniciar, marcar, agora, parando, aoParar, pedirParada, esperarAtualizacao,
  // para o atualizador e o teste
  contaComoOcupado, drenar, lerPedido, atualizacaoEmCurso, modulosCarregados, arquivoVivo,
  PEDIDO, PASTA, LIMITE_MS, PROTOCOLO, NAO_CONTA, ATUALIZACAO_VALE_MS,
};
