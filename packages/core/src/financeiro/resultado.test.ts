import { describe, expect, it } from 'vitest';
import { colunasComparativas, colunasDoAno, lancamentosDaConta, planilhaDoResultado, resultadoEmColunas, variacao, type ContaDoPlano, type LancamentoDeCaixa } from './index';

const conta = (id: string, codigo: string, descricao: string, pai: string | null): ContaDoPlano => ({ id, codigo, descricao, tipo: 'DESPESA', nivel: codigo.split('.').length, pai, ativo: true, movimentavel: !!pai });
const plano = [conta('g', '5', 'Despesas', null), conta('a', '5.1', 'Aluguel', 'g'), conta('b', '5.2', 'Luz', 'g'), conta('r', '4', 'Receitas', null), conta('h', '4.1', 'Honorários', 'r')];
const l = (id: string, data: string, tipo: 'E' | 'S', valor: number, c?: string): LancamentoDeCaixa => ({ id, data, descricao: 'x' + id, valor, tipo, conta: c, origem: 'nads', criadoEm: '', criadoPor: '' });
const lanc = [l('1', '2026-01-10', 'S', 100, 'a'), l('2', '2026-02-10', 'S', 50.5, 'b'), l('3', '2026-02-11', 'S', 10), l('4', '2026-02-12', 'E', 1000, 'h'), l('5', '2025-02-01', 'S', 80, 'a')];

describe('o resultado em colunas', () => {
  it('as colunas do ano e do comparativo', () => {
    expect(colunasDoAno(2026).map(c => c.de + '..' + c.ate).slice(1, 2)).toEqual(['2026-02-01..2026-02-28']);
    expect(colunasComparativas('mes', '2026-01').map(c => c.rotulo)).toEqual(['jan/2026', 'dez/2025', 'jan/2025']);
    expect(colunasComparativas('trimestre', '2026-05').map(c => [c.rotulo, c.de, c.ate])).toEqual([['2º tri/2026', '2026-04-01', '2026-06-30'], ['1º tri/2026', '2026-01-01', '2026-03-31'], ['2º tri/2025', '2025-04-01', '2025-06-30']]);
    expect(colunasComparativas('ano', '2026-05').map(c => c.rotulo)).toEqual(['2026', '2025']);
  });
  it('soma pela árvore do plano, com o subtotal do grupo e o sem conta', () => {
    const r = resultadoEmColunas(lanc, plano, colunasDoAno(2026));
    const g = r.saidas[0];
    expect([g.rotulo, g.valores[0], g.valores[1], g.total]).toEqual(['5 Despesas', 100, 50.5, 150.5]);
    expect(g.filhos.map(f => [f.rotulo, f.fundo, f.total])).toEqual([['5.1 Aluguel', 1, 100], ['5.2 Luz', 1, 50.5]]);
    expect(r.saidas[1]).toMatchObject({ rotulo: 'Sem conta', total: 10 });
    expect(r.totais.saidas.slice(0, 2)).toEqual([100, 60.5]);
    expect(r.totais.resultado.slice(0, 2)).toEqual([-100, 939.5]);
    expect(r.entradas.map(e => e.rotulo)).toEqual(['4 Receitas']);
  });
  it('os lançamentos da conta (com os de baixo) e a variação', () => {
    expect(lancamentosDaConta(lanc, plano, 'g', 'S', '2026-01-01', '2026-12-31').map(x => x.id)).toEqual(['1', '2']);
    expect(lancamentosDaConta(lanc, plano, '', 'S', '2026-01-01', '2026-12-31').map(x => x.id)).toEqual(['3']);
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(5, 0)).toBeNull();
    expect(variacao(-50, -100)).toBe(50);
  });
  it('a planilha sai', () => {
    expect(planilhaDoResultado(resultadoEmColunas(lanc, plano, colunasDoAno(2026)), 'Resultado 2026', true).length).toBeGreaterThan(1000);
  });
});
