import { describe, expect, it } from 'vitest';
import { lancamentosParaOSistema } from './lancamentosParaOSistema';
import { lancamentosDaPlanilha } from './planilha';

describe('os lançamentos do que falta no razão, pelo padrão do razão (Vitor, 13/10/2026)', () => {
  // o razão da conciliação do Alterdata: Contrapartida, Descrição (o nome) e Descrição histórico (o texto do banco)
  const { lancamentos: razao } = lancamentosDaPlanilha([
    ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo'],
    ['Falso', 'Não conciliado', '02/01/2026', '', '35010', 'IOF', '-4,61', '', 'IOF/2-1 DÉB.IOF', ''],
    ['Falso', 'Não conciliado', '02/01/2026', '', '35003', 'Despesas Bancarias', '-50,00', '', '15392469 DÉB.TARIFA TD', ''],
    ['Falso', 'Não conciliado', '05/01/2026', '', '10101', 'Caixa', '700,00', '', '000.755 CHQ COOP/AG.DEP.EM CONTA', ''],
  ], 'sistema', 2026);

  it('o razão guarda a contrapartida e o texto do banco', () => {
    expect(razao[0]).toMatchObject({ historico: 'IOF', conta: '35010', complemento: 'IOF/2-1 DÉB.IOF' });
  });

  it('a contrapartida do histórico parecido; saída D contrapartida / C banco; entrada D banco / C contrapartida', () => {
    const s = lancamentosParaOSistema([
      { data: '2026-02-03', valor: -712, historico: 'IOF/3-2 DÉB.IOF' },
      { data: '2026-02-04', valor: -5000, historico: '15553398 DÉB.TARIFA TD' },
      { data: '2026-02-05', valor: 90000, historico: '000.801 CHQ COOP/AG.DEP.EM CONTA' },
    ], razao, '10506');
    expect(s.map(x => [x.linha.data, x.linha.debito, x.linha.credito, x.linha.valor, x.origem])).toEqual([
      ['03/02/2026', '35010', '10506', 7.12, 'padrao'],
      ['04/02/2026', '35003', '10506', 50, 'padrao'],
      ['05/02/2026', '10506', '10101', 900, 'padrao'],
    ]);
  });

  it('sem histórico parecido: a conta mais usada naquele sentido, marcada para conferir', () => {
    const [x] = lancamentosParaOSistema([{ data: '2026-02-06', valor: 12345, historico: 'PIX RECEBIDO FULANO' }], razao, '10506');
    expect([x.conta, x.origem]).toEqual(['10101', 'mais-usada']);
  });
});
