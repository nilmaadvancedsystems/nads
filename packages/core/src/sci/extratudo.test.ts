// O Extratudo manda as linhas conciliadas do extrato para os Lançamentos do minimum (25/11/2026). Dados fictícios.
import { describe, expect, it } from 'vitest';
import { idDoExtrato, lancamentosDoExtrato, type LinhaDoExtratoConciliada } from './index';

const linha = (x: Partial<LinhaDoExtratoConciliada>): LinhaDoExtratoConciliada => ({
  chave: 'a', data: '2026-10-05', valor: 12345, historico: 'PIX RECEBIDO FULANO', codHistorico: ' 2000 ', documento: '77', conta: '1120', contaDoBanco: '1005', ...x,
});

describe('lancamentosDoExtrato', () => {
  it('o que entrou debita o banco; o que saiu credita o banco; o valor sempre positivo', () => {
    const [entrou, saiu] = lancamentosDoExtrato('sicoob1', [linha({ chave: 'e' }), linha({ chave: 's', valor: -500, conta: '4101' })], []);
    expect(entrou).toMatchObject({ id: idDoExtrato('sicoob1', 'e'), debito: '1005', credito: '1120', valor: 12345, complemento: 'PIX RECEBIDO FULANO', documento: '77', historico: '2000' });
    expect(saiu).toMatchObject({ debito: '4101', credito: '1005', valor: 500 });
  });

  it('não manda duas vezes a mesma linha, nem a sem conta, sem a conta do banco ou sem valor', () => {
    const ja = lancamentosDoExtrato('b', [linha({ chave: 'x' })], []);
    const deNovo = lancamentosDoExtrato('b', [linha({ chave: 'x' }), linha({ chave: 'y', conta: null }), linha({ chave: 'z', contaDoBanco: ' ' }), linha({ chave: 'w', valor: 0 })], ja);
    expect(deNovo).toEqual([]);
    // a mesma chave noutro banco é outra linha
    expect(lancamentosDoExtrato('outro', [linha({ chave: 'x' })], ja)).toHaveLength(1);
  });
});
