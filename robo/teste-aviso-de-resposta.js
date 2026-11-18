// Testes do e-mail quando o escritório responde (plano do Acessórias, 17/11/2026, ficha aviso-de-resposta, parte B).
// Rode antes de publicar:  node teste-aviso-de-resposta.js
// Não acessa o banco nem o Gmail. As dependências de fora que faltarem nesta máquina viram um módulo vazio só aqui.
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
const A = require('./aviso-de-resposta');
const R = require('./area-cliente-regras');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- 1. a trava ----------
igual('começa travado', A.LIBERADO_PARA_CLIENTES, false);
igual('travado: só para o escritório', A.destinoComTrava(['cliente@x.com']), { para: ['nilmacontabilidade@gmail.com'], teste: true, seria: ['cliente@x.com'] });
igual('teto diário', A.MAX_POR_DIA, 40);

// ---------- 2. não avisa duas vezes: a marca é o instante da resposta avisada ----------
const c = { situacao: 'respondido', mensagens: [{ de: 'cliente', em: '2026-11-18T10:00:00.000Z' }, { de: 'escritorio', em: '2026-11-18T11:00:00.000Z' }, { de: 'escritorio', em: '2026-11-18T11:05:00.000Z', interna: true }] };
igual('a marca é a última resposta visível (a nota interna não conta)', A.marcaDoAviso(c, 'resposta', 'agora'), { avisoEnviadoEm: '2026-11-18T11:00:00.000Z' });
igual('concluído junto: marca a conclusão também', A.marcaDoAviso({ ...c, situacao: 'concluido' }, 'resposta', 'agora'), { avisoEnviadoEm: '2026-11-18T11:00:00.000Z', avisoConclusaoEm: 'agora' });
igual('só a conclusão', A.marcaDoAviso(c, 'conclusao', 'agora'), { avisoConclusaoEm: 'agora' });
const temPacote = (() => { try { require('./gerado/danfse'); return true; } catch (e) { return false; } })();
if (temPacote) {
  const P = require('./gerado/danfse');
  const depois = Object.assign({}, c, A.marcaDoAviso(c, 'resposta', '2026-11-18T12:00:00.000Z'));
  igual('depois de avisar, não avisa de novo', P.precisaAvisar(depois, new Date('2026-11-18T13:00:00.000Z')), null);
  igual('antes de avisar, avisa (15 min depois)', P.precisaAvisar(c, new Date('2026-11-18T11:20:00.000Z')), 'resposta');
}

// ---------- 2b. ao ligar, o passado não vira enxurrada ----------
const agora = Date.parse('2026-11-18T12:00:00.000Z');
igual('mexido há 1 dia: avisa', A.recente({ atualizadoEm: '2026-11-17T12:00:00.000Z' }, agora), true);
igual('mexido há 3 dias: não', A.recente({ atualizadoEm: '2026-11-15T12:00:00.000Z' }, agora), false);
igual('sem data: não', A.recente({}, agora), false);

// ---------- 3. o espelho do cliente não leva as marcas ----------
igual('a projeção do chamado é lista branca: as marcas do aviso não saem',
  ['avisoEnviadoEm', 'avisoConclusaoEm'].some(k => (R.CAMPOS_DO_ESPELHO.chamado || []).includes(k)), false);

// ---------- 4. o vigia liga o aviso, e só na nuvem ----------
const vigia = fs.readFileSync(path.join(__dirname, 'vigia-robo.js'), 'utf8');
const i = vigia.indexOf("require('./aviso-de-resposta').iniciarAvisoDeResposta");
igual('o vigia inicia o aviso', i > 0, true);
igual('só na nuvem', /if \(process\.env\.ROBO_NA_NUVEM\) \{\s*try \{ require\('\.\/aviso-de-resposta'\)/.test(vigia), true);

console.log(falhas ? falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
process.exitCode = falhas ? 1 : 0;
