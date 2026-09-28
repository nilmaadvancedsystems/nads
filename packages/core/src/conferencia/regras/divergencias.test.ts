import { describe, expect, it } from 'vitest';
import { empresa, nota } from '../__legado__/fixtures';
import type { Empresa } from '../tipos';
import { acharDivergencias, padraoPorCfop } from './divergencias';

/** Entradas no CFOP 1102 com esses lançamentos, na ordem. */
const comLancs = (...lancs: string[]): Empresa => empresa({ entradas: lancs.map((l, i) => nota('1102', l, 100 + i, String(i + 1))) });

describe('padrão por CFOP (≥ 3 notas e ≥ 60%)', () => {
  it('2 notas: não há padrão', () => {
    expect(acharDivergencias(comLancs('6', '182'), 'entradas')).toEqual([]);
  });
  it('3 notas, 2 × 1 (66%): a diferente fica fora do padrão', () => {
    const e = comLancs('6', '6', '182');
    expect(padraoPorCfop(e, 'entradas')['1102']).toEqual({ lanc: '6', qtd: 2, total: 3 });
    const d = acharDivergencias(e, 'entradas');
    expect(d.map(x => x.nota.lanc)).toEqual(['182']);
    expect(d[0]).toMatchObject({ padrao: '6', qtdPadrao: 2, totalCfop: 3 });
  });
  it('5 notas, 3 × 2 (60%): as duas diferentes ficam fora', () => {
    expect(acharDivergencias(comLancs('6', '182', '6', '182', '6'), 'entradas').map(x => x.nota.numero)).toEqual(['2', '4']);
  });
  it('4 notas, 2 × 2 (50%): nenhuma', () => {
    expect(acharDivergencias(comLancs('6', '6', '182', '182'), 'entradas')).toEqual([]);
  });
});

describe('venda à vista', () => {
  const V = 'Venda de mercadoria adquirida ou recebida de terceiros';
  const saidas = [
    nota('5102', '1', 10, '1', { nome: 'MARIA', doc: '12345678901' }),
    nota('5102', '2', 11, '2', { nome: 'JOAO', doc: '123.456.789-02' }),
    nota('5102', '2', 12, '3', { nome: 'MERCADO A LTDA' }),
    nota('5102', '1', 13, '4', { nome: 'MERCADO B LTDA' }),
  ];
  it('ligada com à vista e a prazo: CPF confere com o à vista, CNPJ com o a prazo', () => {
    const e = empresa({ saidas, vendaVista: { ativo: true, lancs: { [V]: '1' }, prazo: { [V]: '2' } } });
    const d = acharDivergencias(e, 'saidas');
    expect(d.map(x => [x.nota.numero, x.padrao, x.origem, x.cadastrado])).toEqual([['2', '1', 'vista', true], ['4', '2', 'prazo', true]]);
  });
  it('sem o a prazo: CNPJ com o lançamento à vista é apontado (cnpjVista)', () => {
    const e = empresa({ saidas, vendaVista: { ativo: true, lancs: { [V]: '1' }, prazo: {} } });
    const d = acharDivergencias(e, 'saidas');
    expect(d.find(x => x.nota.numero === '4')?.origem).toBe('cnpjVista');
    expect(d.find(x => x.nota.numero === '2')?.origem).toBe('vista');
  });
  it('desligada: CPF segue a maioria do CFOP como qualquer nota', () => {
    const e = empresa({ saidas, vendaVista: { ativo: false, lancs: { [V]: '1' } } });
    expect(padraoPorCfop(e, 'saidas')['5102'].total).toBe(4);
    expect(acharDivergencias(e, 'saidas')).toEqual([]);
  });
});
