// A baixa das vendas no caixa, com dados fictícios.
import { describe, expect, it } from 'vitest';
import { baixaPadrao, baixasDaConsulta, lancamentosDoShaderParaOSci, planoDoSci, problemasDoLancamento, type LancamentoDaConsulta } from './index';

const p113 = planoDoSci('90113');
const p011 = planoDoSci('90011');
const l = (c: Partial<LancamentoDaConsulta>): LancamentoDaConsulta => ({
  data: '2026-10-29', debito: '', credito: '', valor: 0, historico: '', complemento: '', documento: '', tipo: 'Lançamento on-line fiscal',
  participanteD: '', participanteC: '', lancadoEm: '', alteradoEm: '', ...c,
});
const venda = (nota: string, cliente: string, nome: string, valor: number, data = '2026-10-29') =>
  l({ data, debito: '16', credito: '265', valor, historico: '29', complemento: nota + ' - ' + nome + ' ', documento: nota, participanteD: cliente });

describe('a baixa das vendas no caixa', () => {
  it('o padrão: o caixa (CX) do plano e o histórico 477', () => {
    expect(baixaPadrao(p113)).toEqual({ caixa: '5', historico: '477' });
    expect(baixaPadrao(p011)).toEqual({ caixa: '51', historico: '477' });
  });

  it('cada venda vira D caixa × C a conta de clientes, com o cliente a crédito, a mesma data, valor e nota', () => {
    const r = baixasDaConsulta([venda('101', '900', 'CLIENTE FICTICIO LTDA', 123450), venda('102', '901', 'OUTRO CLIENTE SA', 5000, '2026-10-27')], p113, baixaPadrao(p113));
    expect(r).toMatchObject({ jaBaixadas: 0, outras: 0 });
    expect(r.baixas).toEqual([
      { data: '2026-10-29', debito: '5', credito: '16', valor: 123450, historico: '477', complemento: '101 - CLIENTE FICTICIO LTDA', documento: '101', participanteD: '', participanteC: '900' },
      { data: '2026-10-27', debito: '5', credito: '16', valor: 5000, historico: '477', complemento: '102 - OUTRO CLIENTE SA', documento: '102', participanteD: '', participanteC: '901' },
    ]);
    // a baixa passa nas regras do minimum (a CD só a crédito, com o cliente)
    for (const b of r.baixas) expect(problemasDoLancamento(b, p113)).toEqual([]);
  });

  it('a venda já baixada na consulta e as outras linhas ficam fora', () => {
    const ls = [
      venda('101', '900', 'CLIENTE FICTICIO LTDA', 123450),
      venda('102', '901', 'OUTRO CLIENTE SA', 5000),
      // a baixa da 102 já está no SCI
      l({ debito: '5', credito: '16', valor: 5000, historico: '477', documento: '102', participanteC: '901' }),
      // a provisão e a folha não são vendas
      l({ debito: '284', credito: '200', valor: 270000 }),
      l({ credito: '169', valor: 140000, tipo: 'Lançamento on-line folha' }),
    ];
    const r = baixasDaConsulta(ls, p113, baixaPadrao(p113));
    expect(r.baixas.map(b => b.documento)).toEqual(['101']);
    expect(r).toMatchObject({ jaBaixadas: 1, outras: 2 });
  });

  it('o caixa e o histórico trocados; sem a nota, fica o complemento da venda', () => {
    const r = baixasDaConsulta([l({ debito: '16', credito: '265', valor: 100, complemento: 'venda balcão', participanteD: '900' })], p113, { caixa: ' 7 ', historico: '1000' });
    expect(r.baixas[0]).toMatchObject({ debito: '7', historico: '1000', complemento: 'venda balcão', documento: '' });
  });

  it('vai para a planilha do SCI com o CNPJ da empresa', () => {
    const r = baixasDaConsulta([venda('101', '900', 'CLIENTE FICTICIO LTDA', 123450)], p113, baixaPadrao(p113));
    const [s] = lancamentosDoShaderParaOSci(r.baixas, p113, '11222333000181');
    expect(s).toMatchObject({ debito: '5', credito: '16', participanteC: '900', nomeD: 'Caixa', nomeC: 'Clientes nacionais', problemas: [] });
  });
});
