// Rodada 2 da leitura dos arquivos: os layouts que o leitor não entendia ou lia errado (coluna com outro nome, título em cima do cabeçalho,
// linha de total no meio, data e valor em texto, aba oculta, célula mesclada, balancete fora das colunas de sempre). Dados inventados.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { lerBalancete, lerBalanceteDinamicoComoContas, lerBalanceteDoArquivo, lerNotas, lerPlanilha, lerRazao, lerServicos, type Linhas } from './index';

type Cel = string | number | { n: number; z: string };
const serial = (dia: number, mes: number, ano: number) => (Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86400000;

function folha(linhas: Cel[][], merges: XLSX.Range[] = []): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  linhas.forEach((l, r) => l.forEach((c, col) => {
    if (c === '') return;
    const ref = XLSX.utils.encode_cell({ r, c: col });
    ws[ref] = typeof c === 'object' ? { t: 'n', v: c.n, z: c.z } : typeof c === 'number' ? { t: 'n', v: c } : { t: 's', v: c };
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(linhas.length - 1, 0), c: Math.max(...linhas.map(l => l.length), 1) - 1 } });
  if (merges.length) ws['!merges'] = merges;
  return ws;
}
function arquivo(abas: [string, XLSX.WorkSheet][], ocultas: number[] = [], bookType: 'xlsx' | 'biff8' = 'xlsx'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [nome, ws] of abas) XLSX.utils.book_append_sheet(wb, ws, nome);
  if (ocultas.length) wb.Workbook = { Sheets: abas.map((_, i) => ({ Hidden: ocultas.includes(i) ? 1 : 0 })) } as XLSX.WBProps as XLSX.WorkBook['Workbook'];
  return XLSX.write(wb, { bookType, type: 'array' }) as ArrayBuffer;
}
const csv = (t: string) => { const b = new TextEncoder().encode(t); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

const NOTAS = ['Dt. Escritura', 'Número', 'CFOP', 'Lanc', 'Nome Forn/Cliente', 'Valor Contábil'];
const NOTA = ['05/07/2026', '10', '1102', '6', 'FORN', '100,00'];
const SERV = ['Data', 'Nr. Documento', 'Lanc', 'Nome do Fornecedor', 'Valor do Documento'];
const RAZAO = ['Data', 'Histórico', 'Valor', 'Contrapartida'];
const campos = (rows: Linhas) => lerNotas(rows).map(n => [n.numero, n.valor, n.data, n.comp, n.nome]);

describe('a aba certa', () => {
  const dados = folha([NOTAS, NOTA]);
  it('a aba oculta ou vazia na frente não é a dos dados', () => {
    for (const tipo of ['xlsx', 'biff8'] as const) {
      expect(lerNotas(lerPlanilha(arquivo([['Vazia', folha([[]])], ['Dados', dados]], [], tipo))).map(n => n.numero), tipo + ' vazia').toEqual(['10']);
      expect(lerNotas(lerPlanilha(arquivo([['Oculta', folha([['CFOP', 'Valor'], ['5102', '9,00']])], ['Dados', dados]], [0], tipo))).map(n => n.numero), tipo + ' oculta').toEqual(['10']);
    }
  });
  it('a primeira aba com dados continua sendo a lida, mesmo com um resumo depois', () => {
    expect(lerNotas(lerPlanilha(arquivo([['Dados', dados], ['Resumo', folha([['CFOP', 'Valor'], ['1102', '999,00']])]]))).map(n => n.valor)).toEqual([100]);
  });
  it('com a oculta sozinha, ela é lida', () => {
    expect(lerPlanilha(arquivo([['Só', dados]], [0]))).toHaveLength(2);
  });
});

describe('célula mesclada', () => {
  const merge = (c: number, r1: number, r2: number): XLSX.Range => ({ s: { r: r1, c }, e: { r: r2, c } });
  it('a data mesclada na vertical vale para todas as notas dela', () => {
    for (const data of ['05/07/2026', { n: serial(5, 7, 2026), z: 'dd/mm/yyyy' }]) {
      const n = lerNotas(lerPlanilha(arquivo([['D', folha([['Dt. Escritura', 'Número', 'CFOP', 'Valor'], [data, '1', '1102', '10,00'], ['', '2', '1102', '20,00']], [merge(0, 1, 2)])]])));
      expect(n.map(x => [x.numero, x.data, x.comp])).toEqual([['1', '05/07/2026', '2026-07'], ['2', '05/07/2026', '2026-07']]);
    }
    const s = lerServicos(lerPlanilha(arquivo([['D', folha([['Data', 'Nr.', 'Nome do Fornecedor', 'Valor do Documento'], ['05/07/2026', '1', 'A', '10,00'], ['', '2', 'B', '20,00']], [merge(0, 1, 2)])]])), 'tomados');
    expect(s.notas.map(n => n.numero)).toEqual(['1', '2']);
  });
  it('o valor mesclado na vertical não se repete em cada linha, e a célula já preenchida fica', () => {
    const n = lerNotas(lerPlanilha(arquivo([['D', folha([['Data', 'Número', 'CFOP', 'Valor'], ['05/07/2026', '1', '1102', { n: 30, z: '#,##0.00' }], ['06/07/2026', '2', '1102', '']], [merge(3, 1, 2)])]])));
    expect(n.map(x => [x.numero, x.valor])).toEqual([['1', 30]]);
    const d = lerNotas(lerPlanilha(arquivo([['D', folha([['Data', 'Número', 'CFOP', 'Valor'], ['05/07/2026', '1', '1102', '1,00'], ['06/07/2026', '2', '1102', '2,00']], [merge(0, 1, 2)])]])));
    expect(d.map(x => x.data)).toEqual(['05/07/2026', '06/07/2026']);
  });
  it('o valor na segunda coluna de um cabeçalho mesclado não perde a linha', () => {
    const head = ['Data', 'Número', 'CFOP', 'Valor Contábil', '', 'Nome'];
    expect(lerNotas([head, ['05/07/2026', '1', '1102', '', '100,00', 'F'], ['05/07/2026', '2', '1102', '50,00', '', 'G']]).map(n => n.valor)).toEqual([100, 50]);
    expect(lerServicos([['Data', 'Nr.', 'Nome', 'Valor do Documento', ''], ['05/07/2026', '1', 'F', '', '10,00']], 'tomados').notas[0].valor).toBe(10);
    expect(lerRazao([['Data', 'Histórico', 'Valor', ''], ['05/07/2026', 'NF', '', '10,00']])[0].valor).toBe(10);
  });
  it('a coluna ao lado com título próprio nunca entra no lugar do valor', () => {
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor Contábil', 'Base'], ['05/07/2026', '1', '1102', '', '100,00']])).toEqual([]);
  });
});

describe('o cabeçalho', () => {
  it('título numa célula só, com as palavras do cabeçalho, não é o cabeçalho', () => {
    expect(campos([['Relatório de CFOP com valor total'], NOTAS, NOTA])).toEqual([['10', 100, '05/07/2026', '2026-07', 'FORN']]);
    expect(lerServicos([['Relatório: data e nome do prestador'], SERV, ['05/07/2026', '1', '2', 'F', '10,00']], 'tomados').notas).toHaveLength(1);
  });
  it('cabeçalho com quebra de linha na célula', () => {
    expect(campos([['Dt.\nEscritura', 'Número', 'CFOP', 'Valor\nContábil', 'Nome'], ['05/07/2026', '10', '1102', '118,00', 'F']])).toEqual([['10', 118, '05/07/2026', '2026-07', 'F']]);
  });
  it('razão: título com "histórico" em cima do cabeçalho não zera os valores', () => {
    expect(lerRazao([['Histórico da conta 70002'], RAZAO, ['05/07/2026', 'NF 123', '-10,00', '21101']])).toEqual([{ txt: 'NF 123', data: '05/07/2026', valor: 10, sinal: -1, contra: '21101' }]);
    expect(lerRazao([['Razão da conta 70002'], ['Data', 'Descrição', 'Valor'], ['05/07/2026', 'NF 123', '10,00']]).map(l => [l.txt, l.valor])).toEqual([['NF 123', 10]]);
  });
  it('razão sem nenhum cabeçalho conhecido continua na primeira linha', () => {
    expect(lerRazao([['a', 'b'], ['1', '2']]).map(l => l.txt)).toEqual(['1 2']);
  });
});

describe('colunas com outro nome', () => {
  const linha = ['05/07/2026', '10', '1102', '118,00', 'F'];
  it('o valor da nota não é o do imposto', () => {
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Base ICMS', 'Valor ICMS', 'Valor Total', 'Nome'], ['05/07/2026', '10', '1102', '100,00', '18,00', '118,00', 'F']])[0].valor).toBe(118);
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor ICMS', 'Valor da Nota'], ['05/07/2026', '10', '1102', '18,00', '118,00']])[0].valor).toBe(118);
  });
  it('"Valor Total" do imposto ou do desconto não passa na frente do valor da nota', () => {
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor Nota', 'Valor Total ICMS'], ['05/07/2026', '1', '1102', '100,00', '18,00']])[0].valor).toBe(100);
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor Mercadoria', 'Valor Total do Desconto'], ['05/07/2026', '1', '1102', '100,00', '5,00']])[0].valor).toBe(100);
  });
  it('o nome de sempre ganha do que parece', () => {
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor', 'Valor Contábil', 'Nome'], ['05/07/2026', '10', '1102', '10,00', '118,00', 'F']])[0].valor).toBe(118);
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor', 'Valor Total'], ['05/07/2026', '10', '1102', '10,00', '118,00']])[0].valor).toBe(10);
    expect(lerNotas([['Data', 'Número Item', 'Número', 'CFOP', 'Valor'], ['05/07/2026', '1', '10', '1102', '118,00']])[0].numero).toBe('10');
  });
  it.each(['Vl. Contábil', 'Vlr Contabil', 'VL CONTABIL'])('valor em %s', v => {
    expect(campos([['Data', 'Número', 'CFOP', v, 'Nome'], linha])[0][1]).toBe(118);
  });
  it.each(['Nº Nota', 'Nº', 'Nr. Documento', 'Num Doc', 'Documento', 'Nota Fiscal', 'NF-e'])('número da nota em %s', c => {
    expect(campos([['Data', c, 'CFOP', 'Valor', 'Nome'], linha])[0][0]).toBe('10');
    expect(lerServicos([['Data', c, 'Nome do Fornecedor', 'Valor do Documento'], ['05/07/2026', '77', 'F', '10,00']], 'tomados').notas[0].numero).toBe('77');
  });
  it('"Valor do Documento" e "CNPJ" nunca viram o número da nota', () => {
    expect(lerNotas([['Data', 'CNPJ', 'CFOP', 'Valor do Documento'], ['05/07/2026', '11222333000100', '1102', '10,00']])[0].numero).toBe('');
  });
  it('"Documento" com CPF ou CNPJ é do participante, e a nota fica sem número (como antes)', () => {
    const cab = ['Data', 'Documento', 'CFOP', 'Valor', 'Nome'];
    expect(lerNotas([cab, ['05/07/2026', '11222333000181', '1102', '10,00', 'F'], ['06/07/2026', '11.222.333/0001-81', '1102', '10,00', 'F'], ['06/07/2026', '123.456.789-09', '1102', '10,00', 'F']]).map(n => n.numero)).toEqual(['', '', '']);
    expect(lerServicos([['Data', 'Documento', 'Nome do Fornecedor', 'Valor do Documento'], ['05/07/2026', '11222333000181', 'F', '10,00']], 'tomados').notas[0].numero).toBe('');
    expect(lerNotas([cab, ['05/07/2026', '123456', '1102', '10,00', 'F']])[0].numero).toBe('123456');
  });
  it.each(['Dt Emissão', 'Dt. Entrada', 'DT LANC'])('data em %s', c => {
    expect(campos([[c, 'Número', 'CFOP', 'Valor', 'Nome'], linha])[0].slice(2, 4)).toEqual(['05/07/2026', '2026-07']);
  });
  it.each(['Fornecedor', 'Razão Social', 'Participante', 'Destinatário'])('participante em %s', c => {
    expect(campos([['Data', 'Número', 'CFOP', 'Valor', c], linha])[0][4]).toBe('F');
  });
  it('o código ou o documento do participante não é o nome dele', () => {
    expect(lerNotas([['Data', 'Número', 'CFOP', 'Valor', 'Cód. Fornecedor', 'CNPJ Cliente'], ['05/07/2026', '10', '1102', '1,00', '99', '11222333000100']])[0].nome).toBe('');
  });
  it('serviços com "Valor" ou "Valor Total": sem pegar o do imposto', () => {
    expect(lerServicos([['Data', 'Nr.', 'Nome', 'ISS Valor', 'Valor'], ['05/07/2026', '1', 'F', '0,50', '10,00']], 'tomados').notas[0].valor).toBe(10);
    expect(lerServicos([['Data', 'Nr.', 'Nome', 'Valor Total'], ['05/07/2026', '1', 'F', '10,00']], 'prestados').notas[0].valor).toBe(10);
  });
  it('tomados continua no Valor do Documento e prestados no Valor Base', () => {
    const c = ['Data', 'Nr.', 'Nome do Participante', 'Valor', 'Valor Base', 'Valor do Documento'];
    const l = ['05/07/2026', '7', 'X', '1,00', '800,00', '1.000,00'];
    expect(lerServicos([c, l], 'tomados').notas[0].valor).toBe(1000);
    expect(lerServicos([c, l], 'prestados').notas[0].valor).toBe(800);
  });
  it('contrapartida com outra grafia', () => {
    for (const c of ['Contra Partida', 'C/Partida', 'Contrapartida']) expect(lerRazao([['Data', 'Histórico', 'Valor', c], ['05/07/2026', 'NF', '10,00', '21']])[0].contra, c).toBe('21');
  });
});

describe('valor e data em texto', () => {
  it.each([['1.234,56-', -1234.56], ['1234,56 -', -1234.56], ['1 234,56', 1234.56], ['1 234 567,89', 1234567.89]])('valor %s', (v, esperado) => {
    expect(campos([NOTAS, [...NOTA.slice(0, 5), v]])[0][1]).toBe(esperado);
  });
  it('o traço sozinho continua sem valor, e 10,00 continua 10', () => {
    expect(campos([NOTAS, [...NOTA.slice(0, 5), '-']])).toEqual([]);
    expect(campos([NOTAS, [...NOTA.slice(0, 5), '10,00']])[0][1]).toBe(10);
  });
  it.each(['2026-07-05', '2026-07-05 00:00:00', '2026/07/05', '05.07.2026', '05.07.26'])('data %s na nota, no serviço e no razão', d => {
    expect(campos([NOTAS, [d, ...NOTA.slice(1)]])[0].slice(2, 4)).toEqual(['05/07/2026', '2026-07']);
    expect(lerServicos([SERV, [d, '1', '2', 'F', '10,00']], 'tomados').notas.map(n => [n.data, n.comp])).toEqual([['05/07/2026', '2026-07']]);
    expect(lerRazao([RAZAO, [d, 'NF', '10,00', '']])[0].data).toBe('05/07/2026');
  });
  it('dd/mm fica exatamente como veio (a chave das notas já guardadas não muda)', () => {
    for (const d of ['05/07/2026', '5/7/2026', '05-07-26', '05/07/2026 10:00:00']) expect(lerNotas([NOTAS, [d, ...NOTA.slice(1)]])[0].data, d).toBe(d);
  });
  it('a data americana não é "acertada": segue sem competência, para o aviso', () => {
    expect(lerNotas([NOTAS, ['05/13/2026', ...NOTA.slice(1)]]).map(n => [n.data, n.comp])).toEqual([['05/13/2026', '']]);
  });
  it('o texto que não é data continua como está, e o ISO com mês impossível não vira data', () => {
    expect(lerNotas([NOTAS, ['sem data', ...NOTA.slice(1)]])[0].data).toBe('sem data');
    expect(lerNotas([NOTAS, ['2026-13-05', ...NOTA.slice(1)]])[0].data).toBe('2026-13-05');
  });
  it('CSV com data ISO: a competência é a da data', () => {
    expect(lerNotas(lerPlanilha(csv('Dt. Escritura;Número;CFOP;Valor Contábil\n2026-07-05;10;1102;100,00\n'))).map(n => n.comp)).toEqual(['2026-07']);
  });
});

describe('linhas que não são lançamento', () => {
  it('o subtotal por CFOP não vira nota; a nota sem data de verdade continua', () => {
    expect(lerNotas([NOTAS, NOTA, ['', '', '1102', '', 'Total do CFOP', '100,00'], ['', '', '1102', '', 'SUBTOTAL', '100,00']]).map(n => n.numero)).toEqual(['10']);
    expect(lerNotas([NOTAS, ['', '77', '1102', '6', 'TOTAL COMERCIO LTDA', '1,00']]).map(n => n.numero)).toEqual(['77']);
    expect(lerNotas([NOTAS, ['', '', '1102', '6', 'FORN', '1,00']])).toHaveLength(1);
  });
  it('razão: total, saldo e transporte saem; o cabeçalho repetido também', () => {
    const r = lerRazao([RAZAO, ['05/07/2026', 'NF 123', '10,00', ''], ['', 'Total do dia', '10,00', ''], ['', 'Saldo anterior', '5,00', ''], ['', 'SALDO ATUAL', '15,00', ''], ['', 'A transportar', '15,00', ''], RAZAO, ['06/07/2026', 'NF 124', '1,00', '']]);
    expect(r.map(l => l.txt)).toEqual(['NF 123', 'NF 124']);
  });
  it('razão: o lançamento com data cujo histórico começa com "Total" ou "Saldo" fica', () => {
    const r = lerRazao([RAZAO, ['05/07/2026', 'Total pago a fornecedor NF 123', '10,00', ''], ['05/07/2026', 'Saldo de aluguel NF 9', '5,00', '']]);
    expect(r).toHaveLength(2);
  });
  it('razão: "Saldo anterior" com data, sozinho, não é lançamento', () => {
    expect(lerRazao([RAZAO, ['01/07/2026', 'Saldo anterior', '5,00', ''], ['05/07/2026', 'NF 1', '1,00', '']]).map(l => l.txt)).toEqual(['NF 1']);
  });
  it('razão: a linha sem data (o dia só na primeira) cujo histórico começa com Total, Saldo ou Transporte é lançamento', () => {
    const r = lerRazao([RAZAO, ['05/07/2026', 'PAGTO', '10,00', ''], ['', 'TRANSPORTE DE CARGAS NF 123', '20,00', ''], ['', 'TOTAL DISTRIBUIDORA NF 55', '30,00', ''], ['', 'SALDO NF 77 PARCELA', '40,00', ''], ['', 'Total pago NF 9', '1,00', '']]);
    expect(r.map(l => l.valor)).toEqual([10, 20, 30, 40, 1]);
  });
  it.each(['Total', 'TOTAL:', 'Subtotal', 'Total Geral', 'Total do mês', 'Total da conta 70002', 'Total 31/07/2026', 'Saldo', 'Saldo do dia', 'Saldo em 31/07/2026', 'Saldo anterior da conta', 'Transporte', 'Transporte da página anterior', 'A transportar'])('razão: "%s" sem data continua fora', t => {
    expect(lerRazao([RAZAO, ['05/07/2026', 'NF 1', '1,00', ''], ['', t, '9,00', '']]).map(l => l.txt)).toEqual(['NF 1']);
  });
  it('razão sem coluna de data: nada é cortado pelo texto', () => {
    expect(lerRazao([['Histórico', 'Valor'], ['Total pago', '10,00']])).toHaveLength(1);
  });
  it('razão: a linha de texto sem valor continua (o número da nota pode estar nela)', () => {
    expect(lerRazao([RAZAO, ['05/07/2026', 'Pagamento', '10,00', ''], ['', 'NF 124 continuação', '', '']]).map(l => [l.txt, l.valor])).toEqual([['Pagamento', 10], ['NF 124 continuação', 0]]);
  });
});

describe('razão: o lado do lançamento', () => {
  it('colunas Débito e Crédito no lugar de Valor', () => {
    const r = lerRazao([['Data', 'Histórico', 'Débito', 'Crédito', 'Saldo'], ['05/07/2026', 'NF 123', '10,00', '', '10,00'], ['06/07/2026', 'NF 124', '', '4,00', '6,00'], ['07/07/2026', 'Zerado', '0,00', '0,00', '6,00']]);
    expect(r.map(l => [l.txt, l.valor, l.sinal])).toEqual([['NF 123', 10, -1], ['NF 124', 4, 1], ['Zerado', 0, 1]]);
  });
  it('"Valor Débito" e "Valor Crédito" também; o saldo nunca entra', () => {
    expect(lerRazao([['Data', 'Histórico', 'Saldo', 'Valor Débito', 'Valor Crédito'], ['05/07/2026', 'NF', '99,00', '', '3,00']]).map(l => [l.valor, l.sinal])).toEqual([[3, 1]]);
    expect(lerRazao([['Data', 'Histórico', 'Saldo Valor', 'Valor'], ['05/07/2026', 'NF', '99,00', '10,00']])[0].valor).toBe(10);
  });
  it('"Conta Débito" e "Conta Crédito" são códigos: o Valor manda', () => {
    expect(lerRazao([['Data', 'Conta Débito', 'Conta Crédito', 'Histórico', 'Valor'], ['05/07/2026', '100', '200', 'NF', '7,00']]).map(l => [l.valor, l.sinal])).toEqual([[7, 1]]);
  });
  it.each(['Valor Lançamento', 'Valor R$', 'Vlr', 'Vl. Lançamento'])('"Débito" e "Crédito" com os códigos das contas: o %s manda', v => {
    expect(lerRazao([['Data', 'Débito', 'Crédito', 'Histórico', v], ['05/07/2026', '110', '210', 'NF', '7,00']]).map(l => [l.valor, l.sinal])).toEqual([[7, 1]]);
  });
  it('a coluna Valor continua mandando quando também há Débito e Crédito', () => {
    expect(lerRazao([['Data', 'Histórico', 'Valor', 'Débito', 'Crédito'], ['05/07/2026', 'NF', '-7,00', '7,00', '']]).map(l => [l.valor, l.sinal])).toEqual([[7, -1]]);
  });
  it('a letra D/C no valor dá o sinal, e o valor absoluto não muda', () => {
    expect(lerRazao([RAZAO, ['05/07/2026', 'A', '10,00 C', ''], ['05/07/2026', 'B', '10,00 D', ''], ['05/07/2026', 'C', '-10,00', '']]).map(l => [l.valor, l.sinal])).toEqual([[10, 1], [10, -1], [10, -1]]);
  });
});

describe('balancete normal fora das colunas de sempre', () => {
  const bl = (d: string, s: string) => ['', '', d, '', '', '', '', s];
  it('saldo em outra coluna, pelo título', () => {
    expect(lerBalancete([['Conta', '', 'Descrição', '', '', '', 'Saldo Atual'], ['', '', '        Caixa [11]', '', '', '', '10,00 D']])['11']).toMatchObject({ valor: 10, dc: 'D' });
  });
  it('descrição em outra coluna, e o saldo acompanha', () => {
    expect(lerBalancete([['', 'Descrição', '', '', '', '', 'Saldo atual'], ['', '        Caixa [11]', '', '', '', '', '10,00 D']])['11']).toMatchObject({ valor: 10 });
    expect(lerBalancete([['Caixa [11]', '', '', '', '', '20,00 D']])['11']).toMatchObject({ valor: 20 });
  });
  it('o título "Saldo Atual" fora da coluna H, com os saldos na H: fica a H (cabeçalho mesclado)', () => {
    const m = lerBalancete([['', '', 'Descrição', '', '', 'Saldo Atual', '', ''], bl('Caixa [11]', '5,00 D')]);
    expect(m['11']).toMatchObject({ valor: 5 });
  });
  it('coluna C com código e H com saldo: igual ao de sempre, mesmo com débito e crédito no meio', () => {
    expect(lerBalancete([['', '', 'Caixa [11]', '', '1,00', '2,00', '3,00', '4,00 C']])['11']).toMatchObject({ valor: 4, dc: 'C' });
  });
  it('recuo com espaço duro: o nível e a sintética certos', () => {
    const m = lerBalancete([bl('ATIVO [1]', '1,00 D'), bl('        Caixa [11]', '1,00 D')]);
    expect([m['1'].sintetica, m['11'].sintetica, m['11'].grupo]).toEqual([true, false, 'Ativo']);
  });
});

describe('balancete dinâmico', () => {
  const CAB = ['Código', 'Classificação', 'Descrição', 'Saldo Anterior'];
  const ler = (meses: string[], l: string[][]) => lerBalanceteDinamicoComoContas([[...CAB, ...meses], ...l])!;
  it('a letra do saldo diz o lado, mesmo contra a natureza do grupo', () => {
    const d = ler(['07/2026'], [['1', '1', 'ATIVO', '0', '100,00 D'], ['2', '1.1', 'Caixa', '0', '30,00 C'], ['3', '2', 'PASSIVO', '0', '100,00 C'], ['4', '2.1', 'Fornecedores', '0', '20,00 D'], ['5', '3', 'RECEITAS', '0', '9,00 C']]);
    expect(Object.values(d.contas).map(c => [c.codigo, c.valor, c.dc])).toEqual([['1', 100, 'D'], ['2', 30, 'C'], ['3', 100, 'C'], ['4', 20, 'D'], ['5', 9, 'C']]);
  });
  it.each([['7/2026', '2026-07'], ['07-2026', '2026-07'], ['2026-07', '2026-07'], ['01/07/2026', '2026-07'], ['Jul/2026', '2026-07'], ['jul-26', '2026-07'], ['Julho/2026', '2026-07'], ['dez/25', '2025-12']])('coluna do mês em %s', (t, mes) => {
    expect(ler([t], [['1', '1', 'ATIVO', '0', '100,00']]).mes).toBe(mes);
  });
  it('o que não é mês não vira coluna de mês', () => {
    expect(lerBalanceteDinamicoComoContas([[...CAB, '13/2026', 'Total'], ['1', '1', 'ATIVO', '0', '1,00', '2,00']])).toBeNull();
  });
  it('grupo de cima sem nome conhecido não herda a Receita: quem diz são os nomes de baixo', () => {
    const d = ler(['07/2026'], [['1', '1', 'ATIVO', '0', '100'], ['2', '3', 'RECEITAS', '0', '50'], ['3', '4', 'CONTAS TRANSITÓRIAS', '0', '-21'], ['4', '4.1', 'CUSTO NA ATIVIDADE', '0', '-20'], ['5', '4.1.1', 'Folha', '0', '20'], ['6', '4.2', 'PROVISÕES', '0', '-1'], ['7', '4.2.1', 'Provisão', '0', '1']]);
    expect(['2', '3', '4', '5', '6', '7'].map(c => d.contas[c].grupo)).toEqual(['Receita', 'Outros', 'Despesa', 'Despesa', 'Despesa', 'Despesa']);
  });
  it('sob um grupo conhecido, o nome de baixo não muda o grupo (o CSP dentro das Receitas)', () => {
    const d = ler(['07/2026'], [['2', '3', 'RECEITAS', '0', '50'], ['3', '3.6', 'CSP - CUSTOS DE SERVIÇOS', '0', '-5'], ['4', '3.6.1', 'Insumos', '0', '-5']]);
    expect(d.contas['3'].grupo).toBe('Receita');
    expect(d.contas['4'].grupo).toBe('Receita');
  });
  it('a linha Total, com ou sem o texto no código, não vira conta; o código numérico fica', () => {
    const d = ler(['07/2026'], [['1', '1', 'ATIVO', '0', '100'], ['Total', '', '', '0', '100'], ['', '', 'TOTAL', '0', '100']]);
    expect(Object.keys(d.contas)).toEqual(['1']);
  });
  it('o arquivo com a letra também chega pelo lerBalanceteDoArquivo', () => {
    const r = lerBalanceteDoArquivo([[...CAB, '07/2026'], ['2', '1.1', 'Caixa', '0', '30,00 C']]);
    expect(r.contas['2']).toMatchObject({ valor: 30, dc: 'C' });
    expect(r.dinamico).toEqual({ mes: '2026-07' });
  });
});
