// A pausa dos robôs de fila, dentro de cada processo (10/11/2026). A Central dos robôs manda pausar (robo/central.js, no
// processo principal da máquina); no NILMA-SERVER o FGTS, o SIEG e o Alterdata rodam em processos próprios (robo-modulo.js)
// e o recado chega pelo canal do satelites.js. Cada fila olha aqui antes de pegar o próximo pedido: pausado, não pega
// nada novo e o que está no meio termina. Quem guarda a pausa (e a hora de voltar) é a central, em robosMaquinas.
'use strict';

const pausados = new Set();
const aoRetomar = new Map();   // robo -> função que põe a fila para andar de novo

const estaPausado = robo => pausados.has(String(robo));

/** Liga ou desliga a pausa de um robô neste processo; ao retomar, acorda a fila dele. */
function definir(robo, pausar) {
  const r = String(robo);
  const antes = pausados.has(r);
  if (pausar) pausados.add(r); else pausados.delete(r);
  if (antes && !pausar) {
    const f = aoRetomar.get(r);
    if (f) { try { f(); } catch (e) { /* a fila olha de novo no próximo pedido */ } }
  }
}

/** Quem põe a fila para andar quando o robô é retomado. */
function quandoRetomar(robo, f) { if (typeof f === 'function') aoRetomar.set(String(robo), f); }

module.exports = { estaPausado, definir, quandoRetomar };
