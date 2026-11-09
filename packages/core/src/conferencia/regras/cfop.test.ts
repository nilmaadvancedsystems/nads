import { describe, expect, it } from 'vitest';
import { nota } from '../__legado__/fixtures';
import { agruparTotaisPorNatureza, chaveNaturezaNota, chaveNota, comTipo, DESC_AMBOS, tipoDoCfop, tituloDoGrupo } from './cfop';

describe('tipoDoCfop', () => {
  it('1, 2, 3 = entrada; 5, 6, 7 = saída; resto = null', () => {
    expect(['1102', '2102', '3102'].map(tipoDoCfop)).toEqual(['Entrada', 'Entrada', 'Entrada']);
    expect(['5102', '6102', '7101'].map(tipoDoCfop)).toEqual(['Saída', 'Saída', 'Saída']);
    expect([tipoDoCfop('4102'), tipoDoCfop(''), tipoDoCfop(null)]).toEqual([null, null, null]);
    expect(tipoDoCfop(' 5102')).toBe('Saída');
  });
});

describe('chaveNaturezaNota', () => {
  it('descrição oficial vira a chave', () => {
    expect(chaveNaturezaNota({ cfop: '1102', desc: 'outra' })).toBe('Compra para comercialização');
  });
  it('Frete Comercial existe nos dois tipos: separa entrada e saída', () => {
    expect(DESC_AMBOS['Frete Comercial']).toBe(true);
    expect(chaveNaturezaNota({ cfop: '1353', desc: '' })).toBe('Frete Comercial (entrada)');
    expect(chaveNaturezaNota({ cfop: '5353', desc: '' })).toBe('Frete Comercial (saída)');
  });
  it('sem descrição oficial usa a do arquivo, e sem nenhuma "cfop:"', () => {
    expect(chaveNaturezaNota({ cfop: '1000', desc: 'Do arquivo' })).toBe('Do arquivo');
    expect(chaveNaturezaNota({ cfop: '1000', desc: '' })).toBe('cfop:1000');
  });
});

describe('o mercado externo (Vitor, 09/11/2026)', () => {
  it('o 7xxx com a descrição de um 5xxx ou 6xxx fica numa natureza só dele', () => {
    const g = agruparTotaisPorNatureza(comTipo([], [nota('5101', '1', 10, '1'), nota('6101', '1', 20, '2'), nota('7101', '1', 30, '3')]));
    expect(Object.keys(g).sort()).toEqual(['Venda de produção do estabelecimento', 'Venda de produção do estabelecimento (mercado externo)']);
    expect(g['Venda de produção do estabelecimento'].cfops.sort()).toEqual(['5101', '6101']);
    expect(tituloDoGrupo(g['Venda de produção do estabelecimento (mercado externo)'])).toBe('7101 — Venda de produção do estabelecimento (mercado externo)');
  });
  it('o 7xxx com descrição só dele não muda de chave', () => {
    expect(chaveNaturezaNota({ cfop: '7501', desc: '' })).toBe('Exportação de mercadorias recebidas com fim específico de exportação');
  });
});

describe('agruparTotaisPorNatureza', () => {
  it('1102 + 2102 + 1403 caem na mesma natureza', () => {
    const g = agruparTotaisPorNatureza(comTipo([nota('1102', '6', 10, '1'), nota('2102', '6', 20, '2'), nota('1403', '6', 30, '3'), nota('1556', '215', 5, '4')], []));
    expect(Object.keys(g).sort()).toEqual(['Compra para comercialização', 'Uso e Consumo']);
    const c = g['Compra para comercialização'];
    expect(c.cfops).toEqual(['1102', '2102', '1403']);
    expect(c.itens.length).toBe(3);
    expect(c.tipo).toBe('Entrada');
  });
  it('frete de entrada e de saída ficam em grupos separados', () => {
    const g = agruparTotaisPorNatureza(comTipo([nota('1353', '14', 10, '1')], [nota('5353', '15', 20, '2')]));
    expect(g['Frete Comercial (entrada)'].tipo).toBe('Entrada');
    expect(g['Frete Comercial (saída)'].tipo).toBe('Saída');
  });
});

describe('chaveNota', () => {
  it('cfop|número|data|valor com 2 casas', () => {
    expect(chaveNota({ cfop: '1102', numero: '10', data: '05/07/2026', valor: 12.3 })).toBe('1102|10|05/07/2026|12.30');
  });
});
