// O balancete calculado pelo nads (27/11/2026: "vire um segundo sistema contabil ... que fique exatamente como o balancete da empresa").
// Dados fictícios.
import { describe, expect, it } from 'vitest';
import { balanceteCalculado, balanceteMesAMes, type BalanceteSci, type ContaDoBalanceteSci, type LancamentoDaConsulta } from './index';

const conta = (classificacao: string, codigo: string, nome: string, v: Partial<ContaDoBalanceteSci> = {}): ContaDoBalanceteSci =>
  ({ classificacao, codigo, nome, analitica: true, anterior: 0, debito: 0, credito: 0, atual: 0, ...v });
const l = (data: string, debito: string, credito: string, valor: number, extra: Partial<LancamentoDaConsulta> = {}): LancamentoDaConsulta => ({
  data, debito, credito, valor, historico: '', complemento: '', documento: '', tipo: '', participanteD: '', participanteC: '', lancadoEm: '', alteradoEm: '', ...extra,
});

describe('o balancete calculado pelo nads', () => {
  const b: BalanceteSci = {
    empresa: '', cnpj: '', inicio: '2026-01-01', fim: '2026-12-31', contas: [
      conta('01', '1', 'ATIVO', { analitica: false, anterior: 100000, debito: 80000, credito: 30000, atual: 150000 }),
      conta('01.1.1.01.001', '5', 'Caixa', { anterior: 100000, debito: 50000, credito: 30000, atual: 120000 }),
      conta('01.1.2.01.001', '16', 'Clientes', { debito: 30000, atual: 30000 }),
      conta('01.1.2.01.000000900', '16', 'CLIENTE', { analitica: false, participante: true, debito: 30000, atual: 30000 }),
      conta('03', '300', 'RECEITAS', { analitica: false, credito: 80000, atual: -80000 }),
      conta('03.1.1.01.001', '265', 'Vendas', { credito: 80000, atual: -80000 }),
    ],
  };

  it('soma os lançamentos do período em cada conta, com o saldo anterior do SCI; a sintética é a soma das filhas', () => {
    const ls = [
      l('2025-12-31', '5', '265', 99999), // antes do período: já está no saldo anterior
      l('2026-03-10', '5', '265', 50000),
      l('2026-04-10', '16', '265', 30000, { participanteD: '900' }),
      l('2026-05-10', '410', '5', 30000),
    ];
    const r = balanceteCalculado(b, ls);
    const por = (c: string) => r.contas.find(x => x.classificacao === c)!;
    expect([por('01.1.1.01.001').debito, por('01.1.1.01.001').credito, por('01.1.1.01.001').atual, por('01.1.1.01.001').confere]).toEqual([50000, 30000, 120000, true]);
    expect(por('01.1.2.01.000000900')).toMatchObject({ debito: 30000, atual: 30000, confere: true });
    expect(por('01')).toMatchObject({ anterior: 100000, debito: 80000, credito: 30000, atual: 150000, confere: true });
    expect(por('03')).toMatchObject({ credito: 80000, atual: -80000, confere: true });
    expect(r.divergentes).toBe(0);
    // a 410 não está no balancete
    expect(r.foraDoBalancete).toEqual([{ codigo: '410', debito: 30000, credito: 0, lancamentos: 1 }]);
  });

  it('aponta a conta que não bate com o SCI', () => {
    const r = balanceteCalculado(b, [l('2026-03-10', '5', '265', 50000)]);
    const caixa = r.contas.find(x => x.codigo === '5')!;
    expect(caixa).toMatchObject({ debito: 50000, credito: 0, atual: 150000, confere: false, doSci: { atual: 120000 } });
    expect(r.divergentes).toBeGreaterThan(0);
  });

  // 27/11/2026: "o que esta em aberto e os saldos, mes a mes de cada conta do balancete"
  it('mês a mês: o saldo no fim de cada mês, o movimento e o em aberto das provisões; a sintética soma', () => {
    const bm: BalanceteSci = {
      empresa: '', cnpj: '', inicio: '2026-01-01', fim: '2026-03-31', contas: [
        conta('02', '50', 'PASSIVO', { analitica: false }),
        conta('02.1.1.03.001', '200', 'Simples', { anterior: -10000 }),
      ],
    };
    const r = balanceteMesAMes(bm, [
      l('2026-01-31', '284', '200', 30000),
      l('2026-02-20', '200', '5', 30000),
      l('2026-02-28', '284', '200', 40000),
    ]);
    expect(r.meses).toEqual(['2026-01', '2026-02', '2026-03']);
    const s200 = r.linhas.find(x => x.codigo === '200')!;
    expect(s200.meses.map(m => [m.debito, m.credito, m.saldo, m.aberto])).toEqual([[0, 30000, -40000, 0], [30000, 40000, -50000, 40000], [0, 0, -50000, 0]]);
    expect(r.linhas.find(x => x.codigo === '50')!.meses.map(m => [m.saldo, m.aberto])).toEqual([[-40000, 0], [-50000, 40000], [-50000, 0]]);
  });
});
