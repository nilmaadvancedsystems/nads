// Testes combinatórios do LCDPR: a regra que vence na nota, o histórico pelo modelo, as datas das planilhas e os grupos para
// revisar. Dados inventados, sem cliente real.
import { describe, expect, it } from 'vitest';
import { aplicarModelo, classificarNota, gruposParaRevisar } from './classificar';
import { dataDaCelula, numeroDaCelula } from './relatorios';
import type { Lancamento, RegraNcm } from './tipos';

const regra = (prefixo: string, conta: string) => ({ prefixo, conta, codHist: '1', historico: 'h ' + conta }) as RegraNcm;

describe('a regra que vence na nota', () => {
  const regras = [regra('1001', 'A'), regra('2002', 'B')];

  it('no empate vence a que apareceu primeiro, mesmo com a soma quebrada do ponto flutuante', () => {
    // 0,1 + 0,2 dá 0,30000000000000004 e 0,3 sozinho perde: aqui as duas são 0,30
    expect(classificarNota([{ ncm: '20020000', valor: 0.3 }, { ncm: '10010000', valor: 0.1 }, { ncm: '10010000', valor: 0.2 }], regras)?.conta).toBe('B');
    expect(classificarNota([{ ncm: '10010000', valor: 0.1 }, { ncm: '10010000', valor: 0.2 }, { ncm: '20020000', valor: 0.3 }], regras)?.conta).toBe('A');
  });

  it('vence a maior parte da nota, não a primeira linha, em centavos e em milhões', () => {
    for (const v of [0.01, 1.15, 1234.56, 9999999.99]) {
      expect(classificarNota([{ ncm: '10010000', valor: v }, { ncm: '20020000', valor: Math.round((v + 0.01) * 100) / 100 }], regras)?.conta).toBe('B');
    }
  });

  it('o resultado da soma não depende da ordem das linhas quando não há empate', () => {
    const linhas = [{ ncm: '10010000', valor: 10 }, { ncm: '20020000', valor: 7 }, { ncm: '20020000', valor: 4 }];
    for (const o of [linhas, [...linhas].reverse(), [linhas[1], linhas[0], linhas[2]]]) expect(classificarNota(o, regras)?.conta).toBe('B');
  });

  it('sem regra ou sem NCM, nada', () => {
    expect(classificarNota([{ ncm: '30030000', valor: 5 }, { ncm: '', valor: 5 }], regras)).toBeNull();
    expect(classificarNota([], regras)).toBeNull();
  });
});

describe('o histórico pelo modelo', () => {
  it.each([['A $& B'], ['CIA $$ LTDA'], ["O $' X"], ['O $` Y'], ['$1']])('o nome %s entra como está', nome => {
    expect(aplicarModelo('NF {{doc}} {{fornecedor}}', { documento: '12', fornecedor: nome, cnpj: '' })).toBe('NF 12 ' + nome);
  });
  it('repete o campo e põe a máscara do CNPJ e do CPF', () => {
    expect(aplicarModelo('{{doc}}-{{doc}} {{cnpj}}', { documento: '9', fornecedor: '', cnpj: '12345678000199' })).toBe('9-9 12.345.678/0001-99');
    expect(aplicarModelo('{{cnpj}}', { documento: '', fornecedor: '', cnpj: '12345678901' })).toBe('123.456.789-01');
  });
});

describe('as datas e os números da planilha', () => {
  it.each([['31/02/2026'], ['30/02/2028'], ['29/02/2025'], ['31/04/2026'], ['2026-02-30'], ['00/01/2026'], ['01/13/2026'], ['nada'], ['']])('%s não é data', s => expect(dataDaCelula(s)).toBe(''));
  it.each([
    ['29/02/2028', '2028-02-29'], ['28/02/2026', '2026-02-28'], ['31/12/2025', '2025-12-31'], ['1/1/2026', '2026-01-01'], ['2026-01-31T00:00:00', '2026-01-31'], [46054, '2026-02-01'],
  ])('%s → %s', (v, d) => expect(dataDaCelula(v)).toBe(d));
  it.each([['1.234,56', 1234.56], ['R$ 0,01', 0.01], [9876543.21, 9876543.21], ['', 0], ['x', 0]])('%s → %d', (v, n) => expect(numeroDaCelula(v)).toBe(n));
});

describe('os grupos para revisar', () => {
  const lanc = (id: number, valor: number, revisar = true) => ({ id, valor, revisar, fornecedor: 'Fornecedor A', ncm: '10010000', data: '', documento: '', cnpj: '', categoria: '', contaDeved: '', contaCred: '', codHist: '', historico: '', imovel: '', tipoDoc: '', tipoLanc: '', produto: '', origem: 'NF' }) as unknown as Lancamento;

  it('a soma do grupo sai em centavos exatos e cada lançamento entra uma vez', () => {
    const g = gruposParaRevisar([lanc(1, 0.1), lanc(2, 0.2), lanc(3, 5, false)]);
    expect(g).toHaveLength(1);
    expect(g[0].ids).toEqual([1, 2]);
    expect(g[0].valor).toBe(0.3);
  });
});
