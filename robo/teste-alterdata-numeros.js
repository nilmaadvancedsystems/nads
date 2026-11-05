// O teste da leitura do balancete e do razão do Alterdata (alterdata-numeros.js): node robo/teste-alterdata-numeros.js
'use strict';
const assert = require('assert');
const XLSX = require('xlsx');
const { lerBalancete, lerRazao, emPedacos, campos } = require('./alterdata-numeros');

// o balancete: as colunas do Xlsx Dados do Alterdata (C = descrição com recuo e [código], E/F/G/H = anterior, D, C, saldo)
const linhas = [
  ['', '', '   ATIVO - [1]', '', '       838.417,97D', '      1.181.772,07', '      1.052.850,01', '       967.340,03D'],
  ['', '', '     CAIXA   - [00101]', '', '       147.589,62D', '             36,26', '         26.439,75', '       121.186,13D'],
  ['', '', '       Caixa Geral - [10101]', '', '147.589,62D', '36,26', '26.439,75', '121.186,13D'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '       Juros Recebidos - [97304]', '', '258,94C', '0,00', '52,73', '311,67C'],
];
const ws = XLSX.utils.aoa_to_sheet(linhas);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Balancete');
const bal = lerBalancete(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
assert.strictEqual(bal.length, 4);
assert.deepStrictEqual(bal.map(c => c.codigo), ['1', '00101', '10101', '97304']);
assert.deepStrictEqual(bal.map(c => c.sintetica), [true, true, false, false]);
assert.deepStrictEqual(bal[2], { codigo: '10101', nome: 'Caixa Geral', nivel: 7, anterior: 147589.62, anteriorDc: 'D', debito: 36.26, credito: 26439.75, saldo: 121186.13, dc: 'D', sintetica: false });
assert.strictEqual(bal[3].dc, 'C');
assert.strictEqual(bal[3].saldo, 311.67);

// o razão: o CSV do Alterdata em ISO-8859-1, com ';', aspas e o saldo com o sinal ao contrário (− devedor)
const csv = [
  'ContaCurto;ContaNome;ContaCompleto;Data;Historico;ContraPartida;Documento;Lote;Debito;Credito;SaldoAnterior;Saldo',
  '60501;"(-) Devolução de vendas ";41205001;21/11/2025;"NF ""64369""; SUPERMERCADO";85085;"64369";452;417,21;0,00;-1481,73;-1898,94;',
  '60501;"(-) Devolução de vendas ";41205001;25/11/2025;"NF 1409699";85085;"1409699";452;71,88;0,00;-1481,73;-1970,82;',
  '97304;"Juros Recebidos";51101;30/11/2025;"Juros";10503;"";410;0,00;1.052,73;258,94;1311,67;',
  '',
].join('\r\n');
const raz = lerRazao(Buffer.from(csv, 'latin1'));
assert.strictEqual(raz.lancamentos.length, 3);
assert.deepStrictEqual(raz.lancamentos[0], { conta: '60501', data: '2025-11-21', historico: 'NF "64369"; SUPERMERCADO', contra: '85085', documento: '64369', lote: '452', debito: 417.21, credito: 0, saldo: 1898.94 });
assert.strictEqual(raz.contas.length, 2);
assert.deepStrictEqual(raz.contas[0], { conta: '60501', nome: '(-) Devolução de vendas', completo: '41205001', anterior: 1481.73, debito: 489.09, credito: 0, saldo: 1970.82, n: 2 });
for (const c of raz.contas) assert.ok(Math.abs(c.anterior + c.debito - c.credito - c.saldo) < 0.005, 'o saldo da conta ' + c.conta + ' não fecha');
assert.throws(() => lerRazao(Buffer.from('a;b;c\n1;2;3', 'latin1')), /cabeçalho do Alterdata/);
assert.deepStrictEqual(campos('1;"a;b";"x""y"'), ['1', 'a;b', 'x"y']);

// os pedaços: cada um abaixo do limite, nada perdido
const muitos = Array.from({ length: 5000 }, (_, i) => ({ i, t: 'x'.repeat(300) }));
const ped = emPedacos(muitos, 200 * 1000);
assert.ok(ped.length > 1);
assert.strictEqual(ped.flat().length, 5000);
for (const p of ped) assert.ok(JSON.stringify(p).length <= 200 * 1000 + 400);

console.log('ok: balancete (' + bal.length + ' contas), razão (' + raz.lancamentos.length + ' lançamentos, ' + raz.contas.length + ' contas fecham), pedaços (' + ped.length + ')');
