import { describe, expect, it } from 'vitest';
import { empresa, nota } from '../__legado__/fixtures';
import { chaveResolvido } from './divergencias';
import { foraDoPadraoFiscal } from './foraDoPadraoFiscal';

// 1102: padrão 6 (3 × 2 = 60%) → notas 2 e 4 fora do padrão
const base = () => empresa({ entradas: ['6', '182', '6', '182', '6'].map((l, i) => nota('1102', l, 100 + i, String(i + 1))) });

describe('fora do padrão do CFOP (Relatório › Entradas/Saídas)', () => {
  it('sem marca: tudo pendente, um grupo por natureza', () => {
    const r = foraDoPadraoFiscal(base(), 'entradas', 'cfop');
    expect(r.temDivergencias).toBe(true);
    expect(r.corrigidos).toEqual([]);
    expect(r.pendentes).toHaveLength(1);
    expect(r.pendentes[0].titulo).toBe('1102 — Compra para comercialização');
    expect(r.pendentes[0].itens.map(d => d.nota.numero)).toEqual(['2', '4']);
    expect(r.pendentes[0].total).toBe(101 + 103);
  });
  it('uma corrigida: separa, e o checkbox do grupo cobre todas as notas da natureza', () => {
    const e = base();
    const r0 = foraDoPadraoFiscal(e, 'entradas', 'cfop');
    e.divResolvidos = [chaveResolvido('entradas', r0.pendentes[0].itens[0].chave)];
    const r = foraDoPadraoFiscal(e, 'entradas', 'cfop');
    expect(r.pendentes[0].itens.map(d => d.nota.numero)).toEqual(['4']);
    expect(r.corrigidos[0].itens.map(d => d.nota.numero)).toEqual(['2']);
    expect(r.qtdCorrigidos).toBe(1);
    expect(r.pendentes[0].chavesDaNatureza).toHaveLength(2);
    expect(r.corrigidos[0].chavesDaNatureza).toEqual(r.pendentes[0].chavesDaNatureza);
  });
  it('sem nota fora do padrão', () => {
    expect(foraDoPadraoFiscal(empresa({}), 'saidas', 'valor')).toEqual({ temDivergencias: false, pendentes: [], corrigidos: [], qtdCorrigidos: 0 });
  });
});
