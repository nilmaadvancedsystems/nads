// Testes do envio agendado dos lotes do DP e do Fiscal (plano do Acessórias, 17/11/2026, ficha E17; frase do dono:
// "Seguir"). Rode antes de publicar:  node teste-envio-agendado.js
// Não acessa o banco. As dependências de fora (firebase-admin, pdf-parse…) que faltarem nesta máquina viram um módulo vazio
// só aqui, porque estas funções não as usam.
const Module = require('module');
const fs = require('fs');
const path = require('path');
const carregar = Module._load;
Module._load = function (pedido, pai, ...resto) {
  try { return carregar.call(this, pedido, pai, ...resto); } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND' && !pedido.startsWith('.')) return new Proxy({}, { get: () => () => ({}) });
    throw e;
  }
};
const L = require('./lote-dp');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

const agora = Date.parse('2026-11-17T14:00:00-03:00');
igual('agendado no futuro espera', L.agendadoNoFuturo({ status: 'disparar', agendadoPara: '2026-11-20T08:00:00-03:00' }, agora), true);
igual('agendado no passado sai', L.agendadoNoFuturo({ status: 'disparar', agendadoPara: '2026-11-17T13:59:00-03:00' }, agora), false);
igual('sem agendamento sai na hora (como sempre)', L.agendadoNoFuturo({ status: 'disparar' }, agora), false);
igual('agendamento torto não segura o lote', L.agendadoNoFuturo({ status: 'disparar', agendadoPara: 'amanhã' }, agora), false);
igual('pelo instante, não pelo fuso: 08:00 de Brasília é 11:00 UTC', [
  L.agendadoNoFuturo({ agendadoPara: '2026-11-20T08:00:00-03:00' }, Date.parse('2026-11-20T10:59:59Z')),
  L.agendadoNoFuturo({ agendadoPara: '2026-11-20T08:00:00-03:00' }, Date.parse('2026-11-20T11:00:00Z')),
], [true, false]);
igual('olha a fila de 5 em 5 minutos', L.OLHAR_AGENDADOS_MS, 5 * 60 * 1000);

// os dois lotes: pulam o agendado antes de disparar, olham a fila de tempo em tempo e não apagam o agendado na limpeza
for (const arquivo of ['lote-dp.js', 'lote-fiscal.js']) {
  const t = fs.readFileSync(path.join(__dirname, arquivo), 'utf8');
  const pula = t.indexOf('continue;   // agendado: espera a hora (ficha E17)');
  igual(arquivo + ': pula o agendado antes do dispararLote', pula > 0 && pula < t.indexOf('await dispararLote(db, doc.ref, lote, deps)', pula - 400), true);
  igual(arquivo + ': olha a fila de tempo em tempo', /setInterval\(\(\) => \{ void atender\(\); \}, (L\.)?OLHAR_AGENDADOS_MS\)/.test(t), true);
  igual(arquivo + ': a limpeza dos 3 dias poupa o agendado', t.includes("if (!(d.get('status') === 'disparar' && AGENDADO(d.data()))) await db.recursiveDelete(d.ref);"), true);
}

console.log(falhas ? falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
process.exitCode = falhas ? 1 : 0;
