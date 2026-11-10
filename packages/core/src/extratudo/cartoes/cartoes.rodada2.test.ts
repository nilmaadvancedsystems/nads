// 2ª rodada do Cartões: faturas com parcelas, estornos, virada de ano do fechamento, várias páginas e várias contas, moeda estrangeira e
// IOF. A 1ª rodada cobriu valores, anulações e o ano por mês. Faturas fictícias, nas posições do PDF, sementes fixas.
import { describe, expect, it } from 'vitest';
import { comprasDaFatura, lancamentosDaFatura, lerFatura, pagamentoNoExtrato, type FaturaDoCartao, type ItemDaFatura, type PedacoDaFatura } from '.';

function semente(inicial: number): () => number {
  let s = inicial | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Sorte = () => number;
const entre = (r: Sorte, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
function embaralhar<T>(r: Sorte, xs: readonly T[]): T[] {
  const o = [...xs];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const c100 = (n: number) => Math.round(n * 100);
const brl = (c: number) => (c < 0 ? '-' : '') + String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(Math.abs(c) % 100).padStart(2, '0');

type L = [number, string][];
function montar(linhas: L[], yInicial = 800): PedacoDaFatura[] {
  let y = yInicial;
  return linhas.flatMap(partes => { y -= 12; return partes.map(([x, texto]) => ({ x, y, texto })); });
}
const topo = (venc: string, conta = '7560001'): L[] => [[[206, 'EXTRATO DE CARTÃO DE CRÉDITO']], [[98, 'Cliente:'], [143, 'EMPRESA FICTICIA LTDA']], [[98, 'Conta Cartão:'], [176, conta]], [[98, 'Fatura'], [375, 'Vencimento: ' + venc]], [[260, 'MOVIMENTOS']]];
const compra = (dia: string, desc: string, c: number): L => [[98, dia], [220, desc], [440, brl(c)]];
const portador = (nome: string): L => [[201, 'GASTOS DE ' + nome]];
const fim = (total: number): L[] => [[[187, 'DEMONSTRATIVO DE PAGAMENTO EM R$']], [[98, 'Total da Fatura'], [453, brl(total)]]];

describe('parcelas', () => {
  it('as parcelas de compras diferentes no mesmo valor ficam todas; a descrição guarda o 01/03', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), portador('FULANO (1)'), compra('05/01', 'LOJA A 01/03', 10000), compra('05/12', 'LOJA A 02/03', 10000), compra('05/11', 'LOJA A 03/03', 10000), ...fim(30000)])]);
    expect(f.itens.map(i => [i.data, i.descricao, i.valor])).toEqual([['2026-01-05', 'LOJA A 01/03', 100], ['2025-12-05', 'LOJA A 02/03', 100], ['2025-11-05', 'LOJA A 03/03', 100]]);
    const c = comprasDaFatura(f);
    expect(c.compras.length).toBe(3);
    expect(c.diferenca).toBe(0);
  });

  it('a descrição da parcela quebrada, com o número da parcela em pedaço separado na linha de baixo, não se perde', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), [[230, 'EMBALAGENS NORTE']], [[98, '23/01'], [453, '1.960,00']], [[278, '01/02'], [320, 'CLAROS']], ...fim(196000)])]);
    expect(f.itens.map(i => i.descricao)).toEqual(['EMBALAGENS NORTE 01/02 CLAROS']);
  });

  it('a parcela de 12 meses atrás no mesmo mês do vencimento (o dia antes do vencimento) é do ano da fatura; a de depois, do anterior', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), compra('09/02', 'A 12/12', 100), compra('11/02', 'B 12/12', 100), ...fim(200)])]);
    expect(f.itens.map(i => i.data)).toEqual(['2026-02-09', '2025-02-11']);
  });
});

describe('estornos', () => {
  it('estorno parcial não anula a compra: entra como crédito e a soma bate', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), compra('05/01', 'LOJA A', 30000), compra('07/01', 'ESTORNO LOJA A', -10000), ...fim(20000)])]);
    const c = comprasDaFatura(f);
    expect(c.compras.map(i => i.valor)).toEqual([300, -100]);
    expect([c.soma, c.diferenca]).toEqual([200, 0]);
    const ls = lancamentosDaFatura(c, '2026-02-10', 'C', 'B');
    expect(ls.map(l => [l.debito, l.credito, l.valor])).toEqual([['C', 'B', 300], ['B', 'C', 100]]);
  });

  it('estorno total anula a compra do mesmo portador, mesmo com outra igual de outro portador', () => {
    const f = lerFatura([montar([...topo('10/02/2026'),
      portador('ANA (1)'), compra('05/01', 'POSTO X', 5000),
      portador('BIA (2)'), compra('06/01', 'POSTO X', 5000), compra('08/01', 'ESTORNO POSTO', -5000), ...fim(5000)])]);
    const c = comprasDaFatura(f);
    expect(c.compras.map(i => i.portador)).toEqual(['ANA (1)']);
    expect(c.soma).toBe(50);
  });

  it('estorno de compra de outra fatura (sem par): crédito no razão, ninguém some', () => {
    const c = comprasDaFatura(lerFatura([montar([...topo('10/02/2026'), compra('05/01', 'LOJA A', 30000), compra('07/01', 'ESTORNO LOJA B', -7000), ...fim(23000)])]));
    expect(c.compras.length).toBe(2);
    expect(c.deFora).toEqual([]);
  });

  it('em qualquer ordem: a soma, a diferença e o que fica de fora em número', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed);
      const itens: ItemDaFatura[] = [];
      for (let i = entre(r, 1, 12); i > 0; i--) { const v = entre(r, 1, 300) * 100; itens.push({ data: '2026-01-05', descricao: 'L' + i, valor: v / 100, portador: 'A' }); if (r() < 0.4) itens.push({ data: '2026-01-06', descricao: 'E' + i, valor: -v / 100, portador: r() < 0.5 ? 'A' : 'B' }); }
      const soma = itens.reduce((t, i) => t + c100(i.valor), 0);
      const fat = (xs: ItemDaFatura[]): FaturaDoCartao => ({ contaCartao: '1', cliente: 'X', vencimento: '2026-02-10', total: soma / 100, itens: xs });
      const a = comprasDaFatura(fat(itens));
      const b = comprasDaFatura(fat(embaralhar(r, itens)));
      expect([b.soma, b.diferenca, b.compras.length]).toEqual([a.soma, a.diferenca, a.compras.length]);
      expect(a.diferenca).toBe(0);
    }
  });
});

describe('a virada de ano do fechamento', () => {
  it.each([
    ['05/01/2027', [['28/12', '2026-12-28'], ['02/01', '2027-01-02'], ['05/01', '2027-01-05'], ['06/01', '2026-01-06'], ['31/10', '2026-10-31']]],
    ['31/12/2026', [['31/12', '2026-12-31'], ['01/01', '2026-01-01'], ['25/11', '2026-11-25']]],
    ['01/03/2026', [['28/02', '2026-02-28'], ['01/03', '2026-03-01'], ['02/03', '2025-03-02']]],
  ])('vencimento %s', (venc, casos) => {
    const f = lerFatura([montar([...topo(venc), ...casos.map(([d], i) => compra(d, 'LOJA ' + i, 100)), ...fim(100 * casos.length)])]);
    expect(f.itens.map(i => i.data)).toEqual(casos.map(([, iso]) => iso));
  });

  it('o pagamento em janeiro de uma fatura de dezembro acha o débito na janela', () => {
    const f: FaturaDoCartao = { contaCartao: '1', cliente: 'X', vencimento: '2026-12-30', total: 100, itens: [] };
    expect(pagamentoNoExtrato(f, 100, [{ data: '2027-01-02', valor: -10000, historico: 'DEB FATURA CARTAO', banco: 'Sicoob' }])?.diasDoVencimento).toBe(3);
  });

  it('a fatura com crédito (total negativo ou zero) não paga nada: o crédito no extrato não vira o pagamento dela', () => {
    const f: FaturaDoCartao = { contaCartao: '1', cliente: 'X', vencimento: '2026-02-10', total: -50, itens: [] };
    expect(pagamentoNoExtrato(f, -50, [{ data: '2026-02-11', valor: 5000, historico: 'PIX RECEBIDO', banco: 'Sicoob' }])).toBeNull();
    expect(pagamentoNoExtrato(f, 0, [{ data: '2026-02-11', valor: 0, historico: 'x', banco: 'Sicoob' }])).toBeNull();
  });
});

describe('várias páginas e várias contas', () => {
  it('o cabeçalho repetido em cada página não vira lançamento; o portador continua na página seguinte', () => {
    const p1 = montar([...topo('10/02/2026'), portador('ANA (1)'), compra('05/01', 'LOJA A', 1000)]);
    const p2 = montar([...topo('10/02/2026'), compra('06/01', 'LOJA B', 2000), compra('07/01', 'LOJA C', 3000), ...fim(6000)]);
    const f = lerFatura([p1, p2]);
    expect(f.itens.map(i => [i.descricao, i.portador])).toEqual([['LOJA A', 'ANA (1)'], ['LOJA B', 'ANA (1)'], ['LOJA C', 'ANA (1)']]);
    expect(comprasDaFatura(f).diferenca).toBe(0);
  });

  it('linhas vazias não atrapalham', () => {
    const p = montar([...topo('10/02/2026'), [[98, '   ']], compra('05/01', 'LOJA A', 1000), [[300, '']], ...fim(1000)]);
    expect(lerFatura([p]).itens.map(i => i.valor)).toEqual([10]);
  });

  it('dois cartões da mesma conta (portadores) somam na mesma fatura', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), portador('ANA (1)'), compra('05/01', 'A', 1000), portador('BIA (2)'), compra('06/01', 'B', 2000), ...fim(3000)])]);
    expect(f.itens.map(i => i.portador)).toEqual(['ANA (1)', 'BIA (2)']);
    expect(comprasDaFatura(f).diferenca).toBe(0);
  });

  it('duas contas de cartão no mesmo PDF: recusa com a mensagem, em vez de ler só a primeira e parecer que fechou', () => {
    const p1 = montar([...topo('10/02/2026', '7560001'), compra('05/01', 'LOJA A', 1000), ...fim(1000)]);
    const p2 = montar([...topo('10/02/2026', '7560002'), compra('06/01', 'LOJA B', 2000), ...fim(2000)]);
    expect(() => lerFatura([p1, p2])).toThrow(/mais de uma conta/);
  });

  it('a mesma conta repetida em todas as páginas continua aceita', () => {
    const p1 = montar([...topo('10/02/2026', '7560001'), compra('05/01', 'LOJA A', 1000)]);
    const p2 = montar([...topo('10/02/2026', '7560001'), compra('06/01', 'LOJA B', 2000), ...fim(3000)]);
    expect(lerFatura([p1, p2]).contaCartao).toBe('7560001');
  });
});

describe('a mesma conta impressa de outro jeito não é outra conta', () => {
  const V = '10/02/2026';
  const comConta = (...conta: [number, string][]): L[] => [[[206, 'EXTRATO DE CARTÃO DE CRÉDITO']], [[98, 'Conta Cartão:'], ...conta], [[98, 'Fatura'], [375, 'Vencimento: ' + V]]];
  const p1 = () => montar([...topo(V, '7563144207668'), compra('05/01', 'LOJA A', 1000)]);

  it.each([
    ['o dígito à parte', [[176, '756314420766-8']]],
    ['zeros na frente', [[176, '0007563144207668']]],
    ['em dois pedaços do PDF', [[176, '756314'], [210, '4207668']]],
    ['mascarada', [[176, '7563****7668']]],
  ] as [string, [number, string][]][])('%s, em página antes do DEMONSTRATIVO', (_, conta) => {
    const f = lerFatura([p1(), montar([...comConta(...conta), compra('06/01', 'LOJA B', 2000), ...fim(3000)])]);
    expect([f.contaCartao, f.itens.length]).toEqual(['7563144207668', 2]);
  });

  it('o final da conta impresso depois do DEMONSTRATIVO', () => {
    const f = lerFatura([montar([...topo(V, '7563144207668'), compra('05/01', 'LOJA A', 1000), ...fim(1000), [[98, 'Conta Cartão:'], [176, '4207668']]])]);
    expect(f.itens.length).toBe(1);
  });

  it('o rótulo sem número não pega a data da compra na linha de baixo', () => {
    const f = lerFatura([p1(), montar([[[98, 'Conta Cartão:']], compra('06/01', 'LOJA B', 2000), ...fim(3000)])]);
    expect([f.contaCartao, f.itens.length]).toEqual(['7563144207668', 2]);
  });

  it('dois números antes do DEMONSTRATIVO: tudo é lido e o total confere, nada some', () => {
    const f = lerFatura([p1(), montar([...topo(V, '7563144207669'), compra('06/01', 'LOJA B', 2000), ...fim(3000)])]);
    expect(comprasDaFatura(f).diferenca).toBe(0);
  });

  it('a segunda conta depois do DEMONSTRATIVO continua recusada, mesmo do mesmo tamanho', () => {
    const p2 = montar([...topo(V, '7563144207669'), compra('06/01', 'LOJA B', 2000), ...fim(2000)]);
    expect(() => lerFatura([montar([...topo(V, '7563144207668'), compra('05/01', 'LOJA A', 1000), ...fim(1000)]), p2])).toThrow(/mais de uma conta de cartão \(7563144207668, 7563144207669\)/);
  });
});

describe('moeda estrangeira e IOF', () => {
  it('a compra em dólar: vale o valor em reais (o último), o dólar fica na descrição; o IOF é um lançamento', () => {
    const f = lerFatura([montar([...topo('10/02/2026'),
      [[98, '05/01'], [220, 'AMAZON US'], [340, 'USD 20,00'], [440, '108,40']],
      [[260, 'COTACAO DOLAR 5,42']],
      compra('05/01', 'IOF COMPRA INTERNACIONAL', 379),
      ...fim(11219)])]);
    expect(f.itens.map(i => [i.descricao, i.valor])).toEqual([['AMAZON US USD 20,00', 108.4], ['IOF COMPRA INTERNACIONAL', 3.79]]);
    const c = comprasDaFatura(f);
    expect([c.soma, c.diferenca]).toEqual([112.19, 0]);
  });

  it('a linha da cotação (só texto) não vira descrição do lançamento que tem a sua', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), compra('05/01', 'NETFLIX', 5000), [[230, 'USD 10,00 COTACAO 5,00']], compra('06/01', 'SPOTIFY', 2000), ...fim(7000)])]);
    expect(f.itens.map(i => i.descricao)).toEqual(['NETFLIX', 'SPOTIFY']);
  });

  it('o estorno da compra internacional e o IOF devolvido: pares que se anulam, a soma fecha', () => {
    const f = lerFatura([montar([...topo('10/02/2026'), compra('05/01', 'AMAZON US', 10000), compra('05/01', 'IOF COMPRA INTERNACIONAL', 350), compra('08/01', 'ESTORNO AMAZON US', -10000), compra('08/01', 'ESTORNO IOF', -350), compra('09/01', 'LOJA', 700), ...fim(700)])]);
    const c = comprasDaFatura(f);
    expect(c.compras.map(i => i.descricao)).toEqual(['LOJA']);
    expect(c.diferenca).toBe(0);
  });
});
