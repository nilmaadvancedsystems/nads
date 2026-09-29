import { describe, expect, it } from 'vitest';
import type { DiaSaldo } from '../tipos';
import { gerarLancamentos, HISTORICO_PADRAO, resumoDoAjuste } from './lancamentos';

const dia = (d: number, saldo: number): DiaSaldo => ({ data: new Date(2026, 0, d), saldo });

describe('gerarLancamentos', () => {
  it('ajuste no dia negativo e estorno no próximo dia presente no relatório', () => {
    // 5 negativo, 7 (pula o 6, que não está no relatório) positivo
    const res = gerarLancamentos([dia(5, -100.5), dia(7, 20)], '10509', '90503', HISTORICO_PADRAO);
    expect(res.projetado).toBe(false);
    expect(res.lancamentos).toEqual([
      { data: new Date(2026, 0, 5), debito: '10509', credito: '90503', valor: 100.5, historico: '92029', tipo: 'Ajuste', obs: 'Positivação do saldo negativo de 05/01/2026', projetado: false },
      { data: new Date(2026, 0, 7), debito: '90503', credito: '10509', valor: 100.5, historico: '92029', tipo: 'Estorno', obs: 'Estorno do ajuste de 05/01/2026', projetado: false },
    ]);
  });

  it('dias negativos seguidos: estorno do anterior vem antes do novo ajuste', () => {
    const res = gerarLancamentos([dia(5, -1), dia(6, -2), dia(7, 0)], 'B', 'C', 'H');
    expect(res.lancamentos.map(l => [l.data.getDate(), l.tipo, l.valor])).toEqual([
      [5, 'Ajuste', 1], [6, 'Estorno', 1], [6, 'Ajuste', 2], [7, 'Estorno', 2],
    ]);
  });

  it('fim negativo numa sexta: estorno projetado na segunda, com a observação do original', () => {
    const res = gerarLancamentos([dia(1, 5), dia(2, -30)], 'B', 'C', 'H');
    expect(res.projetado).toBe(true);
    const ultimo = res.lancamentos[res.lancamentos.length - 1];
    expect(ultimo).toEqual({
      data: new Date(2026, 0, 5), debito: 'C', credito: 'B', valor: 30, historico: 'H', tipo: 'Estorno',
      obs: 'Estorno do ajuste de 02/01/2026 (data projetada — fora do período do relatório)', projetado: true,
    });
  });

  it('nenhum negativo (zero não é negativo) e lista vazia', () => {
    expect(gerarLancamentos([dia(5, 0), dia(6, 10)], 'B', 'C', 'H')).toEqual({ lancamentos: [], projetado: false });
    expect(gerarLancamentos([], 'B', 'C', 'H')).toEqual({ lancamentos: [], projetado: false });
  });
});

describe('resumoDoAjuste', () => {
  it('conta só os ajustes no total e nos dias negativos', () => {
    const dias = [dia(5, -0.1), dia(6, -0.2), dia(7, 1)];
    const res = gerarLancamentos(dias, 'B', 'C', 'H');
    expect(resumoDoAjuste(res, dias)).toEqual({ diasAnalisados: 3, diasNegativos: 2, totalAjustado: 0.1 + 0.2, qtdLancamentos: 4 });
  });
  it('sem lançamentos', () => {
    const dias = [dia(5, 1)];
    expect(resumoDoAjuste(gerarLancamentos(dias, 'B', 'C', 'H'), dias)).toEqual({ diasAnalisados: 1, diasNegativos: 0, totalAjustado: 0, qtdLancamentos: 0 });
  });
});
