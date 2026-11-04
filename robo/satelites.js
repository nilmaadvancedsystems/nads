// Os robôs do NILMA-SERVER em processos próprios (04/11/2026), ligados e vigiados pelo arquivador: cada um roda em
// robo-modulo.js, o que ele manda para o painel chega aqui pelo canal e vai para o painel do arquivador (o único que
// escreve o robo/painelPC), e o que ele escreve no log entra no arquivador.log. Caiu: volta em 30 s. O arquivador
// saindo, os filhos saem juntos (o 'disconnect' do lado deles).
'use strict';
const path = require('path');
const { fork } = require('child_process');
const painel = require('./painel');

const NOMES = { sieg: 'SIEG', fgts: 'FGTS Digital' };
const VOLTA_MS = 30 * 1000;
const filhos = new Map();
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
  // as linhas do filho no log do arquivador (cada uma já vem com a data e o [sieg] / [fgts])
  const repassar = fluxo => { let resto = ''; fluxo.on('data', b => { resto += b; const l = resto.split('\n'); resto = l.pop(); for (const x of l) if (x.trim()) process.stdout.write(x + '\n'); }); };
  repassar(filho.stdout);
  repassar(filho.stderr);
  filho.on('message', msg => { painel.deSatelite(msg); });
  filho.on('exit', codigo => {
    if (filhos.get(qual) === filho) filhos.delete(qual);
    if (parando) return;
    // 3 = já existe outro desse módulo rodando (não liga de novo por cima)
    if (codigo === 3) { log(NOMES[qual] + ': já havia outro processo; não liguei de novo'); return; }
    log(NOMES[qual] + ': o processo saiu (código ' + codigo + '); volta em ' + VOLTA_MS / 1000 + ' s');
    painel.modulo(qual, NOMES[qual], false, 'reiniciando');
    setTimeout(() => ligarUm(qual, log), VOLTA_MS).unref();
  });
  filho.on('error', err => log(NOMES[qual] + ': o processo não abriu:', err.message));
}

/** Liga os módulos (ex.: ['sieg', 'fgts']), cada um no seu processo. */
function ligar(quais, log) {
  for (const q of quais) { painel.modulo(q, NOMES[q] || q, true, 'processo próprio'); ligarUm(q, log); }
}

/** Ao desligar o arquivador: avisa os filhos (eles também saem sozinhos quando o canal fecha). */
function parar() {
  parando = true;
  for (const f of filhos.values()) { try { f.kill(); } catch (e) { /* já saiu */ } }
}

module.exports = { ligar, parar, NOMES };
