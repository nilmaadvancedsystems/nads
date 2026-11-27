// Testes das notas de serviço nas saídas do SIEG (27/11/2026: a Zelo, 602, só emite NFS-e e o faturamento vinha zerado;
// "resolve todas as empresas que possam vir a ter esse problema"). Rode:  node teste-sieg-servicos.js   (sem rede e sem banco)
'use strict';
const S = require('./sieg');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) { falhas++; console.log('FALHOU:', nome, '\n  obtido:  ', JSON.stringify(obtido), '\n  esperado:', JSON.stringify(esperado)); }
}

const emitidas = [
  { tipo: 'NF-e', modelo: '55', serie: '1', numero: 5, valor: 100 },
  { tipo: 'NFS-e', valor: 20000.5 },
  { tipo: 'NFS-e', valor: 7351.89 },
  { tipo: 'NFS-e', valor: 9, cancelada: true },
];
igual('as NFS-e do mês, sem as canceladas', S.servicosDoResumo(emitidas), { notas: 2, valor: 27352.39 });
igual('sem NFS-e: null', S.servicosDoResumo([emitidas[0]]), null);
igual('sem lista: null', S.servicosDoResumo(undefined), null);
igual('a saída do mês leva as séries e as notas de serviço', S.saidasParaGravar({ codigo: '602' }, emitidas), {
  codigo: '602', series: [{ modelo: '55', serie: '1', numeros: [5], canceladas: [], valor: 100 }], servicos: { notas: 2, valor: 27352.39 },
});
igual('só venda: sem o campo servicos', Object.keys(S.saidasParaGravar({ codigo: '1' }, [emitidas[0]])).sort(), ['codigo', 'series']);

console.log(falhas ? falhas + ' FALHA(S) em ' + total + ' verificações' : 'OK - ' + total + ' verificações');
process.exit(falhas ? 1 : 0);
