// nads → SCI: lê a planilha de importação do nads (a de verdade, gerada pelo creditor/arquivos/gerar.ts), troca as contas
// pelo de/para e escreve a planilha do SCI (Importar + Conferir). Dados fictícios.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { planilhaDeImportacao } from '../extratudo/creditor/arquivos/gerar';
import {
  COLUNAS_DO_SCI, centavos, dataIso, documentoComMascara, lancamentosParaOSci, lerDePara, lerPlanilhaDoNads,
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
