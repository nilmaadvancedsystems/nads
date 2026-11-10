// O batimento que só grava o que mudou (batimento.js, 10/11/2026). node teste-batimento.js
const { criarBatimento, assinatura } = require('./batimento');
let ok = 0, falha = 0;
const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const MIN = 60000;

let t = 1000 * MIN;
const b = criarBatimento({ agora: () => t });
igual('a primeira grava', b.vale({ em: 'a', x: 1 }), true);
t += MIN;
igual('só a hora mudou: não grava', b.vale({ em: 'b', x: 1 }), false);
t += 3 * MIN;
igual('ainda sem mudança aos 4 min', b.vale({ em: 'c', x: 1 }), false);
t += MIN;
igual('5 min sem mudança: grava (estou vivo)', b.vale({ em: 'd', x: 1 }), true);
t += 10 * 1000;
igual('mudou há 10 s da última: espera o freio', b.vale({ em: 'e', x: 2 }), false);
t += 50 * 1000;
igual('a mudança que esperou sai na volta seguinte', b.vale({ em: 'f', x: 2 }), true);
t += MIN;
igual('mudou de novo depois do freio: grava na hora', b.vale({ em: 'g', x: 3 }), true);
b.falhou();
t += 1000;
igual('a gravação falhou: a próxima grava', b.vale({ em: 'h', x: 3 }), true);

const c = criarBatimento({ agora: () => t, ignorar: ['em', 'sinais', 'vigia.em'] });
c.vale({ em: 1, sinais: { cpu: 10 }, vigia: { em: 1, pc: 'x' } });
t += MIN;
igual('os campos ignorados (e o caminho a.b) não contam', c.vale({ em: 2, sinais: { cpu: 80 }, vigia: { em: 2, pc: 'x' } }), false);
igual('o resto conta', c.vale({ em: 3, sinais: { cpu: 80 }, vigia: { em: 3, pc: 'y' } }), true);
igual('a assinatura não mexe no documento', (() => { const d = { em: 1, a: { em: 2 } }; assinatura(d, new Set(['em', 'a.em'])); return d; })(), { em: 1, a: { em: 2 } });

console.log(falha ? '\n' + falha + ' falha(s), ' + ok + ' ok' : 'batimento: ' + ok + ' ok');
process.exit(falha ? 1 : 0);
