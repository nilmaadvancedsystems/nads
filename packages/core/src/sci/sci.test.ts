// nads → SCI: lê a planilha de importação do nads (a de verdade, gerada pelo creditor/arquivos/gerar.ts), troca as contas
// pelo de/para e escreve a planilha do SCI (Importar + Conferir). Dados fictícios.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { planilhaDeImportacao } from '../extratudo/creditor/arquivos/gerar';
import {
  COLUNAS_DO_SCI, centavos, dataIso, documentoComMascara, lancamentosParaOSci, lerDePara, lerPlanilhaDoNads,
  classificacaoNormal, conferirComOBalancete, deParaPeloPlano, lerBalanceteDoSci, naturezaDaConta, saldosInvertidos, valorDoBalancete, juntarDePara, mapaDoDePara, planilhaDoDePara, planoDoSci, resumoDoDePara,
  loteDaOrigem, loteDoMes, mesPrincipal, nomeDaPlanilhaSci, planilhaDoSci, planilhaDoSciDaTela, resumoDoSci,
} from './index';

const CNPJ = '11222333000181';

const doNads = planilhaDeImportacao([
  { automatico: '', data: '05/11/2026', debito: '2950', credito: '1201', valor: 1500, codHistorico: '116', historico: 'PAGTO  ALUGUEL\nNOVEMBRO', documento: '123' },
  { automatico: '', data: '10/11/2026', debito: '2101', credito: '1201', valor: 830.4, codHistorico: '', historico: 'PAGTO NF 456', documento: '' },
  { automatico: '', data: '30/11/2026', debito: '1201', credito: '7777', valor: 12.35, codHistorico: '117', historico: 'RENDIMENTO', documento: '' },
]);

function xlsx(aoa: (string | number)[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'A');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

function abas(bytes: Uint8Array): Record<string, unknown[][]> {
  const wb = XLSX.read(bytes, { type: 'array', raw: true });
  return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: '' })]));
}

describe('a leitura', () => {
  it('lê a planilha de importação do nads, pulando as 4 linhas vazias', () => {
    const l = lerPlanilhaDoNads(doNads, 'lancatudo_10_bb_2026-11.xls');
    expect(l).toHaveLength(3);
    expect(l[0]).toEqual({ data: '2026-11-05', debito: '2950', credito: '1201', valor: 150000, codHistorico: '116', complemento: 'PAGTO  ALUGUEL\nNOVEMBRO', documento: '123', origem: 'lancatudo_10_bb_2026-11.xls' });
    expect(l[1].valor).toBe(83040);
    expect(l[1].codHistorico).toBe('');
  });

  it('entende data e valor nos jeitos do Excel e do texto', () => {
    expect(dataIso(46331)).toBe('2026-11-05');
    expect(dataIso('5/11/2026')).toBe('2026-11-05');
    expect(dataIso('2026-11-05')).toBe('2026-11-05');
    expect(dataIso('ontem')).toBe('');
    expect(centavos(830.4)).toBe(83040);
    expect(centavos('1.500,00')).toBe(150000);
    expect(centavos('1500.5')).toBe(150050);
    expect(centavos('')).toBeNaN();
  });

  it('lê o de/para pulando os títulos', () => {
    const m = lerDePara(xlsx([['Conta no nads', 'Conta no SCI', 'Nome'], [2950, 41001, 'ALUGUEL'], ['1201', '11202', 'BANCO EXEMPLO'], [2101, 21101, 'FORNECEDORES'], ['', '', '']]));
    expect(m.size).toBe(3);
    expect(m.get('2950')).toEqual({ codigo: '41001', nome: 'ALUGUEL' });
  });
});

describe('os lançamentos do SCI', () => {
  const linhas = lerPlanilhaDoNads(doNads, 'lancatudo.xls');
  const dePara = lerDePara(xlsx([[2950, 41001, 'ALUGUEL'], [1201, 11202, 'BANCO EXEMPLO'], [2101, 21101, 'FORNECEDORES']]));

  it('troca as contas, põe o lote do mês, o CNPJ com máscara e aponta o que impede a importação', () => {
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, dePara });
    expect(s[0]).toMatchObject({ debito: '41001', credito: '11202', nomeD: 'ALUGUEL', nomeC: 'BANCO EXEMPLO', valor: 150000, historico: '116', complemento: 'PAGTO ALUGUEL NOVEMBRO', lote: 'NADS2611', cnpjEmpresa: '11.222.333/0001-81', problemas: [] });
    expect(s[1].problemas).toEqual(['sem histórico']);
    expect(s[2].problemas).toEqual(['a conta 7777 não tem par no SCI']);
  });

  it('o histórico padrão completa os que vieram sem código; sem de/para as contas vão como vieram', () => {
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, historicoPadrao: '116', lote: 'LANC2611' });
    expect(s.map(l => l.problemas)).toEqual([[], [], []]);
    expect(s[1]).toMatchObject({ debito: '2101', historico: '116', lote: 'LANC2611' });
  });

  it('recusa CNPJ inválido, mesma conta nos dois lados e linha sem valor', () => {
    const s = lancamentosParaOSci([{ data: '2026-11-01', debito: '5', credito: '5', valor: 0, codHistorico: '1', complemento: '', documento: '', origem: 'x' }], { cnpjEmpresa: '11222333000100' });
    expect(s[0].problemas).toEqual(['débito e crédito na mesma conta', 'sem valor', 'CNPJ da empresa inválido']);
  });

  it('resume por origem e soma só os prontos', () => {
    const r = resumoDoSci(lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, dePara }));
    expect(r).toMatchObject({ total: 3, prontos: 1, comProblema: 2, valorPronto: 150000, meses: ['2026-11'] });
    expect(r.porOrigem).toEqual([{ origem: 'lancatudo.xls', linhas: 3, comProblema: 2 }]);
  });
});

describe('a planilha do SCI', () => {
  it('Importar: títulos, os prontos e o Total; Conferir: os com problema e o motivo', () => {
    const s = lancamentosParaOSci(lerPlanilhaDoNads(doNads, 'lancatudo.xls'), { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    s[2].problemas.push('teste');
    const a = abas(planilhaDoSci(s));
    expect(Object.keys(a)).toEqual(['Importar', 'Conferir']);
    expect(a.Importar[0]).toEqual([...COLUNAS_DO_SCI]);
    expect(a.Importar[1]).toEqual([46331, 2950, 1201, 1500, 116, 'PAGTO ALUGUEL NOVEMBRO', '123', 'NADS2611', '11.222.333/0001-81', '', '', '', '', 'lancatudo.xls', 'pronto']);
    expect(a.Importar[2].slice(0, 5)).toEqual([46336, 2101, 1201, 830.4, 116]);
    expect(a.Importar[3][0]).toBe('Total');
    expect(a.Importar[3][3]).toBeCloseTo(2330.4, 2);
    expect(a.Importar).toHaveLength(4);
    expect(a.Conferir[1][14]).toBe('teste');
  });

  it('sem problema não tem a aba Conferir', () => {
    const s = lancamentosParaOSci(lerPlanilhaDoNads(doNads, 'x'), { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    expect(Object.keys(abas(planilhaDoSci(s)))).toEqual(['Importar']);
  });

  it('o botão das telas: da planilha do Alterdata para a do SCI, com o lote da origem', () => {
    const r = planilhaDoSciDaTela(doNads, 'creditor', { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    expect(r.nome).toBe('sci_11222333000181_2026-11_creditor.xlsx');
    expect(r.resumo).toMatchObject({ total: 3, prontos: 3 });
    expect(abas(r.bytes).Importar[1][7]).toBe('CRED2611');
    expect(loteDaOrigem('honorários', '2026-11')).toBe('HONO2611');
    expect(loteDaOrigem('', '2026-11')).toBe('NADS2611');
  });

  it('nome, lote e mês', () => {
    expect(nomeDaPlanilhaSci('11.222.333/0001-81', '2026-11')).toBe('sci_11222333000181_2026-11.xlsx');
    expect(loteDoMes('2026-11')).toBe('NADS2611');
    expect(mesPrincipal([{ data: '2026-10-31' }, { data: '2026-11-01' }, { data: '2026-11-02' }])).toBe('2026-11');
    expect(documentoComMascara('12345678909')).toBe('123.456.789-09');
  });
});

describe('o de/para pelo plano padrão do SCI (90113)', () => {
  const plano = planoDoSci('90113');
  // um plano do nads fictício, no jeito do Alterdata (a classificação sem os zeros da esquerda)
  const doNads = [
    { codigo: '1', nome: 'ATIVO', classificacao: '1', sintetica: true, ordem: 0 },
    { codigo: '100', nome: 'CAIXA', classificacao: '1.1.1.01.001', ordem: 1 },
    { codigo: '101', nome: 'BANCO DO BRASIL', classificacao: '1.1.1.02.001', ordem: 2 },
    { codigo: '300', nome: 'PRO LABORE', classificacao: '9.9.9.99.999', ordem: 3 },
    { codigo: '301', nome: 'ALUGUEL DE IMOVEL DA FILIAL', classificacao: '1.1.1.02.002', ordem: 4 },
    { codigo: '302', nome: 'CONTA QUE NAO EXISTE', classificacao: '', ordem: 5 },
  ];
  const pares = deParaPeloPlano(doNads, plano);

  it('casa pela classificação (sem zeros) com o nome parecido, depois pelo nome; o resto fica a conferir ou sem par', () => {
    expect(classificacaoNormal('01.1.1.02.001')).toBe('1.1.1.2.1');
    expect(pares.map(p => [p.codigo, p.como, p.sci?.codigo ?? p.sugestao?.codigo ?? null])).toEqual([
      ['100', 'classificacao', '5'],
      ['101', 'classificacao', '7'],
      ['300', 'nome', '457'],
      ['301', 'conferir', '8'],
      ['302', 'semPar', null],
    ]);
    expect(resumoDoDePara(pares)).toEqual({ classificacao: 2, nome: 1, conferir: 1, semPar: 1 });
  });

  it('o de/para só leva o que casou; a planilha volta pela leitura de sempre, sem a sugestão', () => {
    const mapa = mapaDoDePara(pares);
    expect([...mapa.keys()]).toEqual(['100', '101', '300']);
    const lido = lerDePara(planilhaDoDePara(pares));
    expect(lido.get('101')).toEqual({ codigo: '7', nome: 'Banco do Brasil S/A' });
    expect(lido.has('301')).toBe(false);
    expect(juntarDePara(mapa, new Map([['301', { codigo: '9', nome: 'conferido' }]])).get('301')?.codigo).toBe('9');
  });

  it('com o plano, a planilha aponta a conta que não existe, a sintética e a que pede participante', () => {
    const linhas = [
      { data: '2026-11-05', debito: '457', credito: '7', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-11-05', debito: '16', credito: '01.1.1.02.001', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-11-05', debito: '6', credito: '99999', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
    ];
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, planoSci: plano });
    expect(s[0]).toMatchObject({ problemas: [], nomeD: 'Pró-Labore', nomeC: 'Banco do Brasil S/A' });
    expect(s[1].problemas).toEqual(['a conta de débito 16 pede o cliente (participante)']);
    expect(s[2].problemas).toEqual(['a conta 6 (BANCOS CONTA MOVIMENTO) não recebe lançamento no SCI', 'a conta 99999 não existe no plano 90113 do SCI']);
  });
});

describe('o balancete do SCI de volta (formato a confirmar com o arquivo real)', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const csv = [
    '31/10/2026',
    'EMPRESA EXEMPLO LTDA;MONTES CLAROS/MG;11.222.333/0001-81',
    'Classificação;Código;Descrição;Saldo anterior;Débito;Crédito;Saldo atual',
    '01;1;ATIVO;1.000,00D;2.330,40;1.500,00;1.830,40D',
    '01.1.1.01.001;5;Caixa;1.000,00D;0,00;1.500,00;500,00C',
    '01.1.1.02.001;7;Banco do Brasil S/A;0,00;2.330,40;0,00;2.330,40D',
    '02;140;PASSIVO;0,00;830,40;0,00;830,40D',
    '02.1.1.01.001;148;Fornecedores;0,00;830,40;0,00;830,40D',
    '04.2.1.01.002;457;Pró-Labore;0,00;1.500,00;0,00;1.500,00D',
    '01.2.3.01.002;250;(-) Depreciação acumulada;0,00;0,00;100,00;100,00C',
    'Totais;;;;4.660,80;1.600,00;',
  ].join('\r\n');

  it('acha os títulos, a empresa e o CNPJ, e lê os valores com D/C', () => {
    const r = lerBalanceteDoSci(enc(csv), 'balancete.csv');
    expect(r.erro).toBeNull();
    const b = r.balancete!;
    expect(b).toMatchObject({ empresa: 'EMPRESA EXEMPLO LTDA', cnpj: '11.222.333/0001-81' });
    expect(b.contas).toHaveLength(7);
    expect(b.contas.find(c => c.codigo === '5')).toMatchObject({ analitica: true, anterior: 100000, debito: 0, credito: 150000, atual: -50000 });
    expect(b.contas.find(c => c.codigo === '1')?.analitica).toBe(false);
  });

  it('aponta o saldo contrário à natureza (caixa credor, fornecedor devedor), menos as redutoras', () => {
    const b = lerBalanceteDoSci(enc(csv)).balancete!;
    expect(saldosInvertidos(b).map(c => c.codigo)).toEqual(['5', '148']);
    expect(naturezaDaConta('03.1.1')).toBe('C');
  });

  it('entende também vírgula com aspas, sinal de menos e o D/C numa coluna ao lado', () => {
    const outro = [
      '"Classificacao","Codigo","Descricao","Saldo Anterior","","Debito","Credito","Saldo Atual",""',
      '"01.1.1.01.001","5","Caixa","1.000,00","D","0,00","1.500,00","500,00","C"',
      '"02.1.1.01.001","148","Fornecedores","-10,00","","0,00","0,00","-10,00",""',
    ].join('\n');
    const b = lerBalanceteDoSci(enc(outro), 'b.csv').balancete!;
    expect(b.contas.map(c => [c.codigo, c.anterior, c.atual])).toEqual([['5', 100000, -50000], ['148', -1000, -1000]]);
    expect(valorDoBalancete('(1.234,56)')).toBe(-123456);
  });

  it('confere o que o nads mandou com o movimento do SCI', () => {
    const b = lerBalanceteDoSci(enc(csv)).balancete!;
    const linhas = [
      { data: '2026-10-05', debito: '457', credito: '5', valor: 150000, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-10-10', debito: '148', credito: '7', valor: 83040, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-10-11', debito: '7', credito: '296', valor: 1000, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
    ];
    const r = conferirComOBalancete(lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ }), b, planoDoSci('90113'));
    const por = Object.fromEntries(r.map(c => [c.codigo, c.situacao]));
    // o 7 recebeu 2.330,40 a débito no SCI e o nads mandou 10,00 a débito e 830,40 a crédito: faltou o crédito
    expect(por).toEqual({ '5': 'bate', '7': 'faltou', '148': 'bate', '457': 'bate', '296': 'fora do balancete' });
  });

  it('diz o que falta quando o arquivo não é balancete', () => {
    expect(lerBalanceteDoSci(enc('a;b;c\n1;2;3'), 'x.csv').erro).toMatch(/títulos/);
  });
});
