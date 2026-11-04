import { describe, expect, it } from 'vitest';
import { contasDoDiario, dataDoDiario, lerDiario, mesesDoDiario, razaoDoDiario, type PaginaDoPdf } from './diario';

// um diário sintético: a coluna da conta (x<150), o histórico (150–375), o documento (376–470), o Débito (470–530) e o
// Crédito (>=530). Os textos são fictícios ("Conta Teste", valores inventados).
const linha = (y: number, conta: string, hist: string, doc: string, valor: string, lado: 'D' | 'C'): PaginaDoPdf['items'] => [
  { s: conta, x: 50, y }, { s: hist, x: 200, y }, { s: doc, x: 400, y }, { s: valor, x: lado === 'D' ? 480 : 560, y },
];
const DIA1 = { s: '05 de janeiro de 2026', x: 50, y: 700 };
const PAGINA_1: PaginaDoPdf = {
  p: 1,
  items: [
    DIA1,
    ...linha(690, 'Conta Teste (10101)', 'Pagamento teste', '123', '100,00', 'D'),
    ...linha(670, 'Conta Outra (20202)', 'Pagamento teste', '123', '100,00', 'C'),
    ...linha(650, 'Conta Teste (10101)', 'Recebimento sintético', '124', '40,00', 'C'),
    ...linha(630, 'Conta Outra (20202)', 'Recebimento sintético', '124', '40,00', 'D'),
  ],
};
// a página seguinte não repete a data: vale a última (05/01)
const PAGINA_2: PaginaDoPdf = {
  p: 2,
  items: [...linha(700, 'Conta Teste (10101)', 'Lançamento sem par', '125', '7,50', 'D')],
};

describe('datas do diário', () => {
  it('converte "DD de <mês> de AAAA" em AAAA-MM-DD', () => {
    expect(dataDoDiario('15 de março de 2026')).toBe('2026-03-15');
    expect(dataDoDiario('01 de janeiro de 2026')).toBe('2026-01-01');
    expect(dataDoDiario('texto qualquer')).toBe('');
  });
});

describe('leitura do diário', () => {
  it('põe cada valor na conta da linha, com a data que vale', () => {
    const d = lerDiario([PAGINA_1, PAGINA_2]);
    expect(d.lancamentos).toHaveLength(5);
    expect(d.lancamentos[0]).toMatchObject({ data: '2026-01-05', lado: 'D', valor: 100, conta: '10101', nomeConta: 'Conta Teste', documento: '123' });
    expect(d.lancamentos[1]).toMatchObject({ lado: 'C', valor: 100, conta: '20202', nomeConta: 'Conta Outra' });
    // a página 2 sem data herda a última
    expect(d.lancamentos[4]).toMatchObject({ data: '2026-01-05', conta: '10101', valor: 7.5, pagina: 2 });
  });

  it('soma os totais, mostra a diferença e o período', () => {
    const d = lerDiario([PAGINA_1, PAGINA_2]);
    // débitos: 100 + 40 + 7,50 ; créditos: 100 + 40
    expect(d.totais).toEqual({ debito: 147.5, credito: 140 });
    expect(d.diferenca).toBe(7.5);
    expect(d.periodo).toEqual({ inicio: '2026-01-05', fim: '2026-01-05' });
    expect(d.paginas).toBe(2);
  });

  it('acha a contrapartida pela data, documento e valor (um para um)', () => {
    const d = lerDiario([PAGINA_1, PAGINA_2]);
    expect(d.lancamentos[0]).toMatchObject({ contrapartida: '20202', nomeContrapartida: 'Conta Outra' });
    expect(d.lancamentos[1]).toMatchObject({ contrapartida: '10101', nomeContrapartida: 'Conta Teste' });
    // o lançamento 125 não tem par
    expect(d.lancamentos[4].contrapartida).toBe('');
  });

  it('conta como sem código a linha que não tem conta entre parênteses', () => {
    const p: PaginaDoPdf = { p: 1, items: [DIA1, ...linha(690, 'Conta sem código', 'Histórico', '9', '5,00', 'D')] };
    const d = lerDiario([p]);
    expect(d.lancamentos[0].conta).toBe('');
    expect(d.semConta).toBe(1);
  });
});

describe('razão do diário (mesmo formato do XLS)', () => {
  const d = lerDiario([PAGINA_1, PAGINA_2]);

  it('débito na conta é negativo, crédito é positivo, e o saldo corre a partir do saldo inicial', () => {
    const r = razaoDoDiario(d.lancamentos, '10101', 500);
    expect(r).not.toBeNull();
    expect(r!.saldoInicial).toBe(500);
    expect(r!.lancamentos.map(l => l.valor)).toEqual([-100, 40, -7.5]);
    expect(r!.lancamentos.map(l => l.saldo)).toEqual([400, 440, 432.5]);
    expect(r!.saldoFinal).toBe(432.5);
    expect(r!.inicio).toBe('2026-01-05');
    expect(r!.fim).toBe('2026-01-05');
    expect(r!.conta).toBe('10101');
  });

  it('sem saldo inicial, começa em zero; a conta sem lançamento não tem razão', () => {
    expect(razaoDoDiario(d.lancamentos, '10101')!.saldoInicial).toBe(0);
    expect(razaoDoDiario(d.lancamentos, '99999')).toBeNull();
  });

  it('o razão de uma conta leva a contrapartida do lançamento', () => {
    const r = razaoDoDiario(d.lancamentos, '10101')!;
    expect(r.lancamentos[0]).toMatchObject({ contrapartida: '20202', nomeContrapartida: 'Conta Outra' });
  });

  it('lista as contas com lançamento e a quantidade', () => {
    expect(contasDoDiario(d.lancamentos)).toEqual({ '10101': 3, '20202': 2 });
  });
});

describe('meses cobertos pelo diário', () => {
  // datas sintéticas: só o ano-mês importa
  it('um mês está coberto quando algum lançamento tem data nele', () => {
    const meses = mesesDoDiario([
      { data: '2026-01-05' }, { data: '2026-01-31' }, { data: '2026-03-02' },
    ]);
    expect([...meses].sort()).toEqual(['2026-01', '2026-03']);
    expect(meses.has('2026-02')).toBe(false);
  });

  it('lançamento sem data não cobre mês nenhum', () => {
    expect(mesesDoDiario([{ data: '' }]).size).toBe(0);
  });

  it('sem diário, nenhum mês coberto', () => {
    expect(mesesDoDiario([]).size).toBe(0);
  });

  it('dois anos diferentes são meses diferentes', () => {
    const meses = mesesDoDiario([{ data: '2025-12-10' }, { data: '2026-12-10' }]);
    expect([...meses].sort()).toEqual(['2025-12', '2026-12']);
  });
});
