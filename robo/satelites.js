// Os robôs do NILMA-SERVER em processos próprios (04/11/2026), ligados e vigiados pelo arquivador: cada um roda em
// robo-modulo.js, o que ele manda para o painel chega aqui pelo canal e vai para o painel do arquivador (o único que
// escreve o robo/painelPC), e o que ele escreve no log entra no arquivador.log. Caiu: volta em 30 s. O arquivador
// saindo, os filhos saem juntos (o 'disconnect' do lado deles).
'use strict';
const path = require('path');
const { fork } = require('child_process');
const painel = require('./painel');

const NOMES = { sieg: 'SIEG', fgts: 'FGTS Digital', alterdata: 'Alterdata' };
const VOLTA_MS = 30 * 1000;
// a queda logo depois de ligar volta cada vez mais devagar (07/11/2026: cada partida relê a fila e os pedidos presos do
// banco; um módulo que cai ao ligar religava a cada 30 s para sempre): 30 s, 1, 2, 4, 8 e depois de 10 em 10 min. O que
// ficou de pé mais de 10 min volta a cair "pela primeira vez".
const VOLTA_MAXIMA_MS = 10 * 60 * 1000;
const FICOU_DE_PE_MS = 10 * 60 * 1000;
/** A espera antes de religar, pela n-ésima queda seguida (0 = a primeira): 30 s, 1, 2, 4, 8, 10, 10... min. */
const esperaDaVolta = n => Math.min(VOLTA_MAXIMA_MS, VOLTA_MS * Math.pow(2, Math.max(0, n)));
const quedas = new Map();   // qual -> quedas seguidas (logo depois de ligar)
const filhos = new Map();
const pausados = new Set();   // os módulos que a Central dos robôs pausou (o filho que religa volta pausado)
let parando = false;

function ligarUm(qual, log) {
  if (parando) return;
  const filho = fork(path.join(__dirname, 'robo-modulo.js'), [qual], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { NADS_PAINEL_SATELITE: '1' }),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  filhos.set(qual, filho);
  if (pausados.has(qual)) { try { filho.send({ pausa: true }); } catch (e) { /* o pai manda de novo na próxima pausa */ } }
  const ligadoEm = Date.now();
  // as linhas do filho no log do arquivador (cada uma já vem com a data e o [sieg] / [fgts])
  const repassar = fluxo => { let resto = ''; fluxo.on('data', b => { resto += b; const l = resto.split('\n'); resto = l.pop(); for (const x of l) if (x.trim()) process.stdout.write(x + '\n'); }); };
  repassar(filho.stdout);
  repassar(filho.stderr);
  // o que o filho pôs no "fazendo" do painel: quando ele sai, sai junto (07/11/2026: um "SIEG: baixando" de um filho que
  // caiu ficava no painel e contava como ocupado para sempre)
  const chaves = new Set();
  filho.on('message', msg => {
    if (msg && msg.painel === 'fazendo' && Array.isArray(msg.args)) { if (msg.args[1]) chaves.add(String(msg.args[0])); else chaves.delete(String(msg.args[0])); }
    painel.deSatelite(msg);
  });
  filho.on('exit', codigo => {
    if (filhos.get(qual) === filho) filhos.delete(qual);
    for (const k of chaves) painel.fazendo(k, null);
    if (parando) return;
    // 3 = já existe outro desse módulo rodando (não liga de novo por cima)
    if (codigo === 3) { log(NOMES[qual] + ': já havia outro processo; não liguei de novo'); return; }
    const seguidas = Date.now() - ligadoEm < FICOU_DE_PE_MS ? (quedas.get(qual) || 0) + 1 : 0;
    quedas.set(qual, seguidas);
    const espera = esperaDaVolta(seguidas - 1);
    log(NOMES[qual] + ': o processo saiu (código ' + codigo + '); volta em ' + (espera < 60000 ? Math.round(espera / 1000) + ' s' : Math.round(espera / 60000) + ' min') + (seguidas > 1 ? ' (' + seguidas + ' quedas seguidas)' : ''));
    painel.modulo(qual, NOMES[qual], false, 'reiniciando');
    setTimeout(() => ligarUm(qual, log), espera).unref();
  });
  filho.on('error', err => log(NOMES[qual] + ': o processo não abriu:', err.message));
}

/** Liga os módulos (ex.: ['sieg', 'fgts']), cada um no seu processo. */
function ligar(quais, log) {
  for (const q of quais) { painel.modulo(q, NOMES[q] || q, true, 'processo próprio'); ligarUm(q, log); }
}

/** A pausa da Central dos robôs chegando a um módulo (vale também para o filho que religar depois). */
function pausar(qual, sim) {
  if (sim) pausados.add(qual); else pausados.delete(qual);
  const f = filhos.get(qual);
  if (f && f.connected) f.send({ pausa: !!sim });
}

/** Ao desligar o arquivador: avisa os filhos (eles também saem sozinhos quando o canal fecha). */
function parar() {
  parando = true;
  for (const f of filhos.values()) { try { f.kill(); } catch (e) { /* já saiu */ } }
}

/**
 * Saindo com calma (07/11/2026, ocupado.js): pede a cada filho que termine o que está fazendo e saia, e não liga de novo
 * quem sair. O arquivador espera vivos() chegar a zero antes de sair.
 */
function pedirSaida(motivo) {
  parando = true;
  for (const f of filhos.values()) { try { if (f.connected) f.send({ sair: String(motivo || 'pedido') }); } catch (e) { /* já saiu */ } }
}

/** Quantos filhos ainda estão rodando. */
function vivos() { return filhos.size; }

module.exports = { ligar, parar, pausar, pedirSaida, vivos, esperaDaVolta, NOMES };
