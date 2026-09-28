import { describe, expect, it } from 'vitest';
import { acharColunas, normalizarCabecalho } from './colunas';

describe('normalizarCabecalho', () => {
  it('minúsculas, sem acento e sem símbolo', () => {
    expect(normalizarCabecalho(' Dáta ')).toBe('data');
    expect(normalizarCabecalho('SALDO')).toBe('saldo');
    expect(normalizarCabecalho('Saldo (R$)')).toBe('saldor');
    expect(normalizarCabecalho(null)).toBe('');
    expect(normalizarCabecalho(12)).toBe('12');
  });
});

describe('acharColunas', () => {
  it('acha o cabeçalho depois de linhas de título', () => {
    const linhas = [['Extrato'], [], [null, 'Histórico', 'DATA', 'Saldo']];
    expect(acharColunas(linhas)).toEqual({ linhaCabecalho: 2, colData: 2, colSaldo: 3 });
  });

  it('nome repetido na linha: vale a última coluna', () => {
    expect(acharColunas([['Data', 'Saldo', 'Data', 'Saldo']])).toEqual({ linhaCabecalho: 0, colData: 2, colSaldo: 3 });
  });

  it('só olha as 10 primeiras linhas', () => {
    const linhas: unknown[][] = Array.from({ length: 10 }, () => ['x']);
    linhas.push(['Data', 'Saldo']);
    expect(acharColunas(linhas)).toBeNull();
    linhas.splice(0, 1);
    expect(acharColunas(linhas)).toEqual({ linhaCabecalho: 9, colData: 0, colSaldo: 1 });
  });

  it('nome tem de ser exato depois de normalizar', () => {
    expect(acharColunas([['Data do movimento', 'Saldo']])).toBeNull();
    expect(acharColunas([['Data', 'Saldo (R$)']])).toBeNull();
  });
});
