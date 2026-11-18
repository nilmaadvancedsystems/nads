// Testes do lembrete de vencimento ao cliente (plano do Acessórias, 17/11/2026, ficha lembrete-de-vencimento; frase do
// dono: "Seguir"). Rode antes de publicar:  node teste-lembrete-guia.js
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
const L = require('./lembrete-guia');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- 1. a trava ----------
igual('começa travado', L.LIBERADO_PARA_CLIENTES, false);
igual('travado: só para o escritório, dizendo para quem iria', L.destinoComTrava(['cliente@empresa.com']), { para: ['nilmacontabilidade@gmail.com'], teste: true, seria: ['cliente@empresa.com'] });
igual('liberado: para o cliente', L.destinoComTrava(['cliente@empresa.com'], { liberado: true }), { para: ['cliente@empresa.com'], teste: false });

// ---------- 2. não manda duas vezes no dia ----------
igual('o link avisado hoje não recebe de novo', L.jaAvisado({ dia: '2026-11-17', tokens: ['t1'] }, '2026-11-17', 't1'), true);
igual('o de ontem recebe hoje', L.jaAvisado({ dia: '2026-11-16', tokens: ['t1'] }, '2026-11-17', 't1'), false);
igual('outro link recebe', L.jaAvisado({ dia: '2026-11-17', tokens: ['t1'] }, '2026-11-17', 't2'), false);

// ---------- 3. o ajuste: vem desligado ----------
const temPacote = (() => { try { require('./gerado/danfse'); return true; } catch (e) { return false; } })();
if (temPacote) {
  igual('sem ajuste gravado: desligado, 2 dias antes, 100 por dia', L.lerAjuste(undefined), { ligado: false, dias: [2, 1, 0], maxPorDia: 100 });
  igual('ligado com 1 dia e 20 por dia', L.lerAjuste({ ligado: true, diasAntes: 1, maxPorDia: 20 }), { ligado: true, dias: [1, 0], maxPorDia: 20 });
  igual('ligado só com "true" de verdade', L.lerAjuste({ ligado: 'sim' }).ligado, false);
}

// ---------- 3b. a escolha de cada empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente") ----------
const fonte = fs.readFileSync(path.join(__dirname, 'lembrete-guia.js'), 'utf8');
igual('a escolha da empresa vem do Cadastro e manda nos dias', [fonte.includes("P.lembreteDaEmpresa(cad ? cad.get('lembreteVencimento') : null, ajuste)"), fonte.includes('P.guiasParaLembrar(guias, agora, daEmpresa.dias, abertas)')], [true, true]);
igual('com o geral desligado, só as empresas com "Mandar"', fonte.includes("where('lembreteVencimento.modo', '==', 'sim')"), true);
if (temPacote) {
  const P = require('./gerado/danfse');
  igual('não mandar vale sobre o geral ligado', P.lembreteDaEmpresa({ modo: 'nao' }, { ligado: true, dias: [2, 1, 0] }).ligado, false);
  igual('mandar vale com o geral desligado, nos dias dela', P.lembreteDaEmpresa({ modo: 'sim', diasAntes: 1 }, { ligado: false, dias: [2, 1, 0] }), { ligado: true, dias: [1, 0] });
}

// ---------- 4. o vigia liga o lembrete, e só ele (a nuvem) ----------
const vigia = fs.readFileSync(path.join(__dirname, 'vigia-robo.js'), 'utf8');
igual('o vigia inicia o lembrete', vigia.includes("require('./lembrete-guia').iniciarLembreteDeGuias({ db, log, correio })"), true);
const doPc = ['area-cliente.js', 'arquivador.js'].filter(a => fs.existsSync(path.join(__dirname, a)) && fs.readFileSync(path.join(__dirname, a), 'utf8').includes('lembrete-guia'));
igual('o robô do PC não manda lembrete (não duplica)', doPc, []);

console.log(falhas ? falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
process.exitCode = falhas ? 1 : 0;
