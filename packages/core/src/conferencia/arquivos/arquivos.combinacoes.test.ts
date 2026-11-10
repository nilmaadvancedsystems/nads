// Combinações da leitura dos arquivos: tipo de célula do Excel (número, data, texto, vazia) × formato × colunas fora de ordem
// × acentos e máscaras. As planilhas são montadas de verdade (xlsx e xls) e lidas pelo mesmo caminho do arquivo escolhido à mão.
// Laços determinísticos, com semente fixa e dados inventados.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { lerBalancete, lerBalanceteDinamicoComoContas, lerBalanceteDoArquivo, lerNotas, lerPlanilha, lerRazao, lerServicos, type Linhas } from './index';
import { lerBalanceteDinamico } from '../../extratudo/clientes';

function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cel = string | { n: number; z?: string };
const serial = (dia: number, mes: number, ano: number) => (Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86400000;

function planilha(linhas: Cel[][], bookType: 'xlsx' | 'biff8'): ArrayBuffer {
  const ws: XLSX.WorkSheet = {};
  linhas.forEach((l, r) => l.forEach((c, col) => {
    if (c === '') return;
    const ref = XLSX.utils.encode_cell({ r, c: col });
    ws[ref] = typeof c === 'string' ? { t: 's', v: c } : { t: 'n', v: c.n, ...(c.z ? { z: c.z } : {}) };
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length - 1, c: Math.max(...linhas.map(l => l.length)) - 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'P');
  return XLSX.write(wb, { bookType, type: 'array' }) as ArrayBuffer;
}

const TIPOS = ['xlsx', 'biff8'] as const;
const FORMATOS_VALOR = [undefined, '0.00', '#,##0.00', '"R$" #,##0.00', '#,##0.00;(#,##0.00)', '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-'];
const VALORES = [0.01, 0.1, 1.1, 19.99, 999.99, 1000, 1234.5, 999999.99, 1234567.89];
const FORMATOS_DATA = ['m/d/yy', 'dd/mm/yyyy', 'yyyy-mm-dd', 'dd/mm/yyyy hh:mm', 'd-mmm-yy', 'mm-dd-yy'];

describe('lerPlanilha: célula do Excel', () => {
  it('número formatado vira o valor certo (nunca 1,23450 no lugar de 1.234,50)', () => {
    const erradas: string[] = [];
    for (const tipo of TIPOS) for (const z of FORMATOS_VALOR) for (const v of VALORES) for (const sinal of [1, -1]) {
      const rows = lerPlanilha(planilha([['CFOP', 'Valor Contábil', 'Número', 'Dt. Escritura'], ['1102', { n: v * sinal, z }, '1', '05/07/2026']], tipo));
      const n = lerNotas(rows);
      if (n.length !== 1 || Math.abs(n[0].valor - v * sinal) > 1e-9) erradas.push([tipo, z, v * sinal, JSON.stringify(rows[1]), n[0]?.valor].join(' | '));
    }
    expect(erradas).toEqual([]);
  });
  it('data do Excel, em qualquer formato, vira dd/mm/aaaa com a competência certa (dia e mês não trocam)', () => {
    const erradas: string[] = [];
    for (const tipo of TIPOS) for (const z of FORMATOS_DATA) for (const [d, m, a] of [[1, 2, 2026], [3, 4, 2026], [13, 1, 2026], [31, 12, 2025], [29, 2, 2024]]) {
      const rows = lerPlanilha(planilha([['CFOP', 'Valor Contábil', 'Número', 'Dt. Escritura'], ['1102', '10,00', '1', { n: serial(d, m, a), z }]], tipo));
      const [nota] = lerNotas(rows);
      const esperado = String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + a;
      if (nota.data !== esperado || nota.comp !== a + '-' + String(m).padStart(2, '0')) erradas.push([tipo, z, esperado, nota.data, nota.comp].join(' | '));
    }
    expect(erradas).toEqual([]);
  });
  it('serviço com data do Excel não some', () => {
    for (const tipo of TIPOS) for (const z of FORMATOS_DATA) {
      const rows = lerPlanilha(planilha([['Data', 'Nr.', 'Lanc', 'Nome do Fornecedor', 'Valor do Documento'], [{ n: serial(13, 1, 2026), z }, '7', '527', 'GRÁFICA', { n: 1234.5, z: '#,##0.00' }]], tipo));
      const r = lerServicos(rows, 'tomados');
      expect(r.notas.map(n => [n.data, n.comp, n.valor]), tipo + ' ' + z).toEqual([['13/01/2026', '2026-01', 1234.5]]);
    }
  });
  it('CSV: data e valor continuam como vieram (dia e mês não trocam, nem o valor com vírgula)', () => {
    const buf = (t: string) => { const b = new TextEncoder().encode(t); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
    for (const sep of [';', ',', '\t']) {
      const aspas = sep === ',' ? '"' : '';
      const celula = (s: string) => aspas + s + aspas;
      const csv = [['CFOP', 'Valor Contábil', 'Número', 'Dt. Escritura'], ['1102', '1.234,56', '1', '05/07/2026'], ['1102', '12,50', '2', '31/12/2025'], ['5102', '1234.5', '3', '01/02/2026']].map(l => l.map(celula).join(sep)).join('\n');
      const n = lerNotas(lerPlanilha(buf(csv)));
      expect(n.map(x => [x.valor, x.comp, x.data]), JSON.stringify(sep)).toEqual([[1234.56, '2026-07', '05/07/2026'], [12.5, '2025-12', '31/12/2025'], [1234.5, '2026-02', '01/02/2026']]);
    }
  });
  it('código com zeros e máscara de CNPJ continuam como estão', () => {
    for (const tipo of TIPOS) {
      const rows = lerPlanilha(planilha([['Lanc', 'CNPJ', 'CFOP'], [{ n: 182, z: '00000' }, { n: 1222333000100, z: '00000000000000' }, { n: 1102 }]], tipo));
      expect(rows[1], tipo).toEqual(['00182', '01222333000100', '1102']);
    }
  });
  it('balancete com saldo numérico formatado (normal e dinâmico)', () => {
    for (const tipo of TIPOS) {
      const m = lerBalancete(lerPlanilha(planilha([['', '', 'ATIVO [1]', '', '', '', '', { n: 1234.5, z: '#,##0.00" D"' }], ['', '', '        Caixa [11]', '', '', '', '', { n: 1234.5, z: '#,##0.00' }]], tipo)));
      expect(m['1'], tipo).toMatchObject({ valor: 1234.5, dc: 'D' });
      expect(m['11'], tipo).toMatchObject({ valor: 1234.5 });
      const d = lerBalanceteDoArquivo(lerPlanilha(planilha([
        ['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '07/2026'],
        ['1', '1', 'ATIVO', { n: 1234.5, z: '#,##0.00' }, { n: 2234.5, z: '#,##0.00' }],
        ['2', '2', 'PASSIVO', { n: -1234.5, z: '#,##0.00' }, { n: -2234.5, z: '#,##0.00' }],
      ], tipo)));
      expect(d.contas['1'], tipo).toMatchObject({ valor: 2234.5, dc: 'D' });
      expect(d.contas['2'], tipo).toMatchObject({ valor: 2234.5, dc: 'C' });
    }
  });
});

// ---------- colunas fora de ordem ----------
function permutar(rows: string[][], ordem: number[]): string[][] {
  return rows.map(r => ordem.map(i => r[i] ?? ''));
}
function ordens(q: number, s: number): number[] {
  const r = sorteador(s);
  const a = Array.from({ length: q }, (_, i) => i);
  for (let i = q - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

describe('lerNotas: colunas fora de ordem, células vazias, acentos, máscaras', () => {
  const cab = ['Dt. Escritura', 'Número', 'CFOP', 'Lançamento', 'Nome Forn/Cliente', 'CNPJ/CPF', 'Descrição do CFOP', 'Valor Contábil', 'Exportado', 'NCM', 'CST', 'CSOSN', 'CEST'];
  const linhas = [
    ['05/07/2026', '0042', '1102', '00006', 'FORN Á', '11.222.333/0001-00', 'Compra', '1.234,56', 'Sim', '21069090', '000', '', '0300700'],
    ['06/07/2026', '43', '5.405', '1', 'CLIENTE', '', '', '0,01', 'N', '', '', '102', ''],
    ['07/07/2026', '44', '6102/01', '227', '', '123.456.789-01', '', '9.999.999,99', '', '', '', '', ''],
    ['', '', 'Total', '', '', '', '', '11.234,56', '', '', '', '', ''],
  ];
  it('as 60 permutações dão as mesmas notas', () => {
    const base = lerNotas([cab, ...linhas]);
    expect(base.map(n => n.cfop)).toEqual(['1102', '5405', '6102']);
    expect(base.map(n => n.valor)).toEqual([1234.56, 0.01, 9999999.99]);
    expect(base.map(n => n.lanc)).toEqual(['00006', '1', '227']);
    for (let s = 1; s <= 60; s++) {
      const o = ordens(cab.length, s);
      expect(lerNotas(permutar([cab, ...linhas], o)), 'permutação ' + s).toEqual(base);
    }
  });
  it('CST de regime normal e CSOSN do Simples: cada linha fica com o que tem', () => {
    const n = lerNotas([cab, ...linhas]);
    expect(n.map(x => x.cst)).toEqual(['000', '102', undefined]);
  });
  it('CFOP com máscara (5.102) e número com ".0" do Excel', () => {
    const n = lerNotas([['CFOP', 'Lanc', 'Valor', 'Número', 'Nome', 'Data', 'CNPJ'], ['5.102', '1.0', '10,00', '4101.0', 'X', '05/07/2026', '11222333000100.0']]);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ cfop: '5102', lanc: '1', numero: '4101', doc: '11222333000100' });
  });
  it('título com a palavra CFOP antes do cabeçalho de verdade não derruba o arquivo', () => {
    const n = lerNotas([['Relatório de notas por CFOP'], ['CFOP', 'Lanc', 'Valor Contábil', 'Número', 'Nome', 'Data'], ['1102', '6', '10,00', '1', 'X', '05/07/2026']]);
    expect(n).toHaveLength(1);
  });
  it('sem valor na linha: fica de fora e nada quebra', () => {
    for (const v of ['', 'abc', '-']) {
      const n = lerNotas([['CFOP', 'Lanc', 'Valor', 'Número', 'Nome', 'Data'], ['1102', '6', v, '1', 'X', '05/07/2026']]);
      expect(n, v).toEqual([]);
    }
    expect(lerNotas([['CFOP', 'Lanc', 'Valor', 'Número', 'Nome', 'Data'], ['1102', '6', '0,00', '1', 'X', '05/07/2026']])).toHaveLength(1);
  });
});

describe('lerServicos: colunas fora de ordem, canceladas, retenções', () => {
  const cab = ['Data', 'Nr. Documento', 'Lançamento', 'CNPJ', 'Nome do Fornecedor', 'Valor do Documento', 'ISS Valor', 'ISS Valor Retido', 'IRRF', 'INSS', 'PIS', 'COFINS', 'CSLL', 'Cancelada', 'Exportado', 'Conta Contábil'];
  const ls = [
    ['05/07/2026', '000123', '0527', '11222333000100', 'DEDETIZADORA', '350,00', '7,00', '0,00', '1,50', '', '2,28', '10,50', '3,50', 'N', 'S', '22015'],
    ['06/07/2026', '124', '42', '', 'ESCRITÓRIO', '1.100,00', '', '', '', '', '', '', '', 'S', '', ''],
    ['07/07/2026', '125', '42', '', 'ESCRITÓRIO 2', '100,00', '', '', '', '', '', '', '', 'Sim', '', ''],
    ['total', '', '', '', '', '1.450,00', '', '', '', '', '', '', '', '', '', ''],
  ];
  it('as 60 permutações dão as mesmas notas e os mesmos totais', () => {
    const base = lerServicos([cab, ...ls], 'tomados');
    expect(base.canceladas).toBe(2);
    expect(base.notas).toHaveLength(1);
    expect(base.notas[0]).toMatchObject({ numero: '123', lanc: '527', valor: 350, iss: 7, irrf: 1.5, pis: 2.28, cofins: 10.5, csll: 3.5, conta: '22015' });
    for (let s = 1; s <= 60; s++) {
      expect(lerServicos(permutar([cab, ...ls], ordens(cab.length, s)), 'tomados'), 'permutação ' + s).toEqual(base);
    }
  });
  it('tomados vale o Valor do Documento e prestados o Valor Base, com as duas colunas no arquivo e em qualquer ordem', () => {
    const c = ['Data', 'Nr.', 'Nome do Participante', 'Valor Base', 'Valor do Documento'];
    const l = ['05/07/2026', '7', 'X', '800,00', '1.000,00'];
    for (const o of [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [0, 1, 2, 4, 3]]) {
      expect(lerServicos(permutar([c, l], o), 'tomados').notas[0].valor, o.join()).toBe(1000);
      expect(lerServicos(permutar([c, l], o), 'prestados').notas[0].valor, o.join()).toBe(800);
    }
  });
  it('data como texto com hora ou sem os zeros não some, e o número com ".0" é limpo', () => {
    for (const d of ['05/07/2026 00:00:00', '5/7/2026', '05/07/26', '05-07-2026']) {
      const r = lerServicos([['Data', 'Nr.', 'Nome do Fornecedor', 'Valor do Documento', 'Conta Contábil'], [d, '4101.0', 'X', '10,00', '22015.0']], 'tomados');
      expect(r.notas.map(n => [n.data, n.comp, n.numero, n.conta]), d).toEqual([['05/07/2026', '2026-07', '4101', '22015']]);
    }
  });
  it('linha de total e sem data continuam fora', () => {
    const r = lerServicos([['Data', 'Nr.', 'Nome do Fornecedor', 'Valor do Documento'], ['Total geral', '', '', '10,00'], ['', '', 'X', '10,00']], 'tomados');
    expect(r.notas).toEqual([]);
  });
});

describe('lerRazao: colunas fora de ordem', () => {
  it('mesmas linhas em qualquer ordem de coluna (o texto junta na ordem das colunas de histórico)', () => {
    const cab = ['Data', 'Histórico', 'Valor', 'Contrapartida'];
    const ls = [['05/07/2026', 'conf NF 100-11222333000100-FORN', '-1.234,56', '21101'], ['06/07/2026', 'Pago', '0,01', '']];
    const base = lerRazao([cab, ...ls]);
    expect(base.map(l => [l.valor, l.sinal])).toEqual([[1234.56, -1], [0.01, 1]]);
    for (let s = 1; s <= 24; s++) expect(lerRazao(permutar([cab, ...ls], ordens(cab.length, s))), 'permutação ' + s).toEqual(base);
  });
});

describe('Balancete: natureza × saldo invertido × grupo', () => {
  const linha = (desc: string, saldo: string) => ['', '', desc, '', '', '', '', saldo];
  it('saldo devedor, credor, invertido, zero e sem letra', () => {
    const m = lerBalancete([
      linha('ATIVO [1]', '100,00 D'),
      linha('        Caixa [11]', '0,01 C'),
      linha('PASSIVO [2]', '50,00 C'),
      linha('        Fornecedores [21]', '10,00 D'),
      linha('        Salários [22]', '0,00 C'),
      linha('        Empréstimos [23]', '1.234.567,89'),
    ]);
    expect(m['11']).toMatchObject({ valor: 0.01, dc: 'C', grupo: 'Ativo' });
    expect(m['21']).toMatchObject({ valor: 10, dc: 'D', grupo: 'Passivo' });
    expect(m['22']).toMatchObject({ valor: 0, dc: 'C' });
    expect(m['23']).toMatchObject({ valor: 1234567.89, dc: 'D' });
  });
  it('palavra com ATIVO no meio não muda o grupo (ADMINISTRATIVOS, OPERATIVOS, INATIVOS)', () => {
    const m = lerBalancete([
      linha('ATIVO [1]', '100,00 D'),
      linha('CUSTOS E DESPESAS [4]', '50,00 D'),
      linha('   GASTOS ADMINISTRATIVOS [41]', '50,00 D'),
      linha('        Papelaria [4101]', '50,00 D'),
      linha('   DESPESAS COM INATIVOS [42]', '10,00 D'),
      linha('        Pensão [4201]', '10,00 D'),
    ]);
    expect(m['4101'].grupo).toBe('Despesa');
    expect(m['4201'].grupo).toBe('Despesa');
  });
  it('analítica × sintética pelo recuo, em qualquer profundidade', () => {
    const m = lerBalancete([linha('ATIVO [1]', '1,00 D'), linha('   CIRCULANTE [11]', '1,00 D'), linha('        Caixa [111]', '1,00 D'), linha('PASSIVO [2]', '1,00 C')]);
    expect([m['1'].sintetica, m['11'].sintetica, m['111'].sintetica, m['2'].sintetica]).toEqual([true, true, false, false]);
  });
});

describe('Balancete dinâmico: sinal × meses', () => {
  const montar = (cab: string[], m: (i: number) => number[]): Linhas => {
    const contas: [string, string, string][] = [['1', '1', 'ATIVO'], ['10', '1.1', 'Caixa'], ['2', '2', 'PASSIVO'], ['20', '2.1', 'Fornecedores'], ['3', '3', 'RECEITAS'], ['30', '3.1', 'Vendas'], ['4', '4', 'DESPESAS'], ['40', '4.1', 'Aluguel']];
    return [['Código', 'Classificação', 'Descrição', ...cab], ...contas.map((c, i) => [...c, ...m(i).map(String)])];
  };
  // devedor +, credor − (o de sempre)
  const BASE = [100, 100, -60, -60, -90, -90, 50, 50];
  const SINAIS: [string, (i: number) => 1 | -1][] = [
    ['de sempre', () => 1],
    ['pela natureza', i => (i >= 2 && i <= 5 ? -1 : 1)],
    ['invertido', () => -1],
  ];
  const ESPERADO: Record<string, { valor: number; dc: 'D' | 'C' }> = { 10: { valor: 100, dc: 'D' }, 20: { valor: 60, dc: 'C' }, 30: { valor: 90, dc: 'C' }, 40: { valor: 50, dc: 'D' } };

  it('qualquer dos três sinais vira devedor/credor certo', () => {
    for (const [nome, s] of SINAIS) {
      const d = lerBalanceteDinamicoComoContas(montar(['Saldo Anterior', '07/2026'], i => [0, BASE[i] * s(i)]));
      for (const c of Object.keys(ESPERADO)) expect(d!.contas[c], nome + ' ' + c).toMatchObject(ESPERADO[c]);
    }
  });
  it('virada de ano e meses à frente zerados: fica o último mês com saldo', () => {
    const d = lerBalanceteDinamicoComoContas(montar(['11/2025', '12/2025', '01/2026', '02/2026'], i => [1, 2, BASE[i], 0]));
    expect(d!.mes).toBe('2026-01');
    expect(d!.contas['10']).toMatchObject({ valor: 100, dc: 'D' });
  });
  it('colunas dos meses fora de ordem: o último mês é o de maior competência, não a última coluna', () => {
    const d = lerBalanceteDinamicoComoContas(montar(['02/2026', '12/2025', '01/2026'], i => [BASE[i], 7, 8]));
    expect(d!.mes).toBe('2026-02');
    expect(d!.contas['10']).toMatchObject({ valor: 100, dc: 'D' });
  });
});

describe('a célula que o acerto da data e do número não pode estragar', () => {
  const JAN = serial(1, 1, 2026), FEV = serial(1, 2, 2026);
  const dinamico = planilha([
    ['Código', 'Classificação', 'Descrição', { n: JAN, z: 'mm/yyyy' }, { n: FEV, z: 'mm/yyyy' }],
    ['1', '1', 'ATIVO', { n: 100 }, { n: 200 }],
    ['2', '1.1', 'CAIXA', { n: 100 }, { n: 200 }],
  ], 'xlsx');
  const celula = (c: Cel) => lerPlanilha(planilha([['A', 'B'], [c, '1']], 'xlsx'))[1][0];

  it('o cabeçalho do dinâmico em célula de data mm/yyyy continua sendo o mês, nas duas leituras', () => {
    const rows = lerPlanilha(dinamico);
    expect(rows[0].slice(3)).toEqual(['01/2026', '02/2026']);
    const lido = lerBalanceteDoArquivo(rows);
    expect(Object.keys(lido.contas)).toEqual(['1', '2']);
    expect(lido.dinamico).toEqual({ mes: '2026-02' });
    expect(lerBalanceteDinamico(rows).meses).toEqual(['2026-01', '2026-02']);
  });
  it.each([['mm/yy', '01/26'], ['yyyy-mm', '2026-01'], ['mmm/yy', 'Jan/26']])('o formato %s, sem o dia, fica como está', (z, visto) => {
    expect(celula({ n: serial(15, 1, 2026), z })).toBe(visto);
  });
  it.each(['m/d/yy', 'dd/mm/yyyy', 'yyyy-mm-dd'])('o formato %s, com o dia, vira dd/mm/aaaa', z => {
    expect(celula({ n: serial(15, 1, 2026), z })).toBe('15/01/2026');
  });
  it.each([
    [12345678, '00000\\-000', '12345-678'], [1234, '000\\-0', '123-4'], [123456, '00000\\-0', '12345-6'],
    [1, '"Sim";"Sim";"Não"', 'Sim'], [0, '#,##0.00;-#,##0.00;"-"', '-'], [1234.5, '#,##0.00', '1234.50'],
  ])('%d com a máscara %s sai %s', (n, z, visto) => {
    expect(celula({ n, z })).toBe(visto);
  });
  it('a nota de valor zero mostrado como traço continua de fora', () => {
    const rows = lerPlanilha(planilha([['CFOP', 'Valor Contábil', 'Número', 'Data'], ['5102', { n: 0, z: '#,##0.00;-#,##0.00;"-"' }, '1', '05/10/2026'], ['5102', { n: 10 }, '2', '05/10/2026']], 'xlsx'));
    expect(lerNotas(rows).map(n => n.numero)).toEqual(['2']);
  });
});
