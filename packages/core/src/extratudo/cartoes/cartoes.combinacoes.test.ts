// Testes combinatórios do Cartões: laços determinísticos (semente fixa), faturas fictícias montadas nas posições do PDF.
// Invariantes: nada perdido nem duplicado, soma do detalhe = total, parcelas, estornos e a virada de ano.
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
const um = <T,>(r: Sorte, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function embaralhar<T>(r: Sorte, xs: readonly T[]): T[] {
  const o = [...xs];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const CENTAVOS = [1, 2, 7, 29, 57, 99, 100, 101, 1005, 1115, 123456, 99999, 100000, 1000001, 123456789];
const brl = (c: number) => (c < 0 ? '-' : '') + String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(Math.abs(c) % 100).padStart(2, '0');
const c100 = (n: number) => Math.round(n * 100);

function montar(linhas: [number, string][][], yInicial = 800): PedacoDaFatura[] {
  let y = yInicial;
  return linhas.flatMap(partes => { y -= 12; return partes.map(([x, texto]) => ({ x, y, texto })); });
}

const topo = (venc: string): [number, string][][] => [[[206, 'EXTRATO DE CARTÃO DE CRÉDITO']], [[98, 'Cliente:'], [143, 'EMPRESA FICTICIA LTDA']], [[98, 'Conta Cartão:'], [176, '756000']], [[98, 'Fatura'], [375, 'Vencimento: ' + venc]], [[260, 'MOVIMENTOS']]];

describe('a leitura da fatura', () => {
  it('todos os lançamentos, no centavo; o total bate com a soma; o ano certo na virada', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = semente(seed);
      const venc = um(r, ['10/01/2026', '03/02/2026', '15/12/2025', '28/02/2026']);
      const [, mesV] = venc.split('/').map(Number);
      const n = entre(r, 1, 25);
      const gastos = Array.from({ length: n }, (_, i) => {
        const mes = ((mesV + 11 - entre(r, 0, 2)) % 12) + 1;
        return { dia: String(entre(r, 1, 9)).padStart(2, '0') + '/' + String(mes).padStart(2, '0'), desc: 'LOJA ' + i + ' ' + um(r, ['01/03', '02/12', 'À VISTA']), c: (r() < 0.15 ? -1 : 1) * um(r, CENTAVOS), i };
      });
      const soma = gastos.reduce((s, g) => s + g.c, 0);
      const pagina = montar([...topo(venc), [[201, 'GASTOS DE FULANO DE TAL (1111)']], ...gastos.map((g): [number, string][] => [[98, g.dia], [220, g.desc], [440, brl(g.c)]]),
        [[187, 'DEMONSTRATIVO DE PAGAMENTO EM R$']], [[98, 'Total da Fatura'], [453, brl(soma)]]]);
      const f = lerFatura([pagina]);
      expect(f.itens.map(i => c100(i.valor))).toEqual(gastos.map(g => g.c));
      expect(f.itens.map(i => i.descricao)).toEqual(gastos.map(g => g.desc));
      expect(c100(f.total as number)).toBe(soma);
      for (const [i, it] of f.itens.entries()) {
        const [dd, mm] = gastos[i].dia.split('/');
        expect(it.data.slice(5)).toBe(mm + '-' + dd);
        expect(it.portador).toBe('FULANO DE TAL (1111)');
        // nada depois do vencimento
        expect(it.data <= f.vencimento).toBe(true);
      }
      expect(lerFatura([pagina])).toEqual(f);
    }
  });

  it('pedaços da mesma linha com y fracionado (500,49 e 500,51) continuam a mesma linha', () => {
    for (const [a, b] of [[500.49, 500.51], [500.51, 500.49], [500.5, 500.5], [499.9, 500.4]]) {
      const pagina: PedacoDaFatura[] = [
        ...montar(topo('10/02/2026')),
        { x: 98, y: a, texto: '05/01' }, { x: 220, y: b, texto: 'LOJA X' }, { x: 440, y: b, texto: '10,00' },
      ];
      expect(lerFatura([pagina]).itens.map(i => [i.descricao, i.valor])).toEqual([['LOJA X', 10]]);
    }
  });

  it('o que não é fatura é recusado; fatura sem lançamento também', () => {
    expect(() => lerFatura([montar([[[98, 'Extrato qualquer']]])])).toThrow(/Não é uma fatura/);
    expect(() => lerFatura([montar(topo('10/02/2026'))])).toThrow(/nenhum lançamento/);
  });

  it('o gasto do mês do vencimento, depois do dia dele, é do ano anterior; dezembro numa fatura de janeiro também', () => {
    const f = lerFatura([montar([...topo('10/01/2026'), [[98, '20/12'], [220, 'A'], [440, '1,00']], [[98, '20/01'], [220, 'B'], [440, '2,00']], [[98, '05/01'], [220, 'C'], [440, '3,00']]])]);
    expect(f.itens.map(i => i.data)).toEqual(['2025-12-20', '2025-01-20', '2026-01-05']);
  });
});

const item = (r: Sorte, i: number, valor: number, descricao = 'COMPRA ' + i): ItemDaFatura => ({ data: '2026-01-' + String(entre(r, 1, 28)).padStart(2, '0'), descricao, valor: valor / 100, portador: um(r, ['', 'A (1)', 'B (2)']) });
const faturaCom = (itens: ItemDaFatura[], total: number | null = null): FaturaDoCartao => ({ contaCartao: '1', cliente: 'X', vencimento: '2026-02-10', total, itens });

describe('as compras da fatura', () => {
  it('nada perdido nem duplicado; um estorno anula um gasto só; a soma é a das compras', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = semente(seed * 3);
      const valores = Array.from({ length: entre(r, 0, 25) }, () => um(r, CENTAVOS));
      const itens: ItemDaFatura[] = valores.map((v, i) => item(r, i, v));
      // estornos (alguns com o par, outros sem) e o pagamento da fatura anterior
      const estornos = valores.filter(() => r() < 0.3).map((v, i) => item(r, 900 + i, -v, 'ESTORNO ' + i));
      const semPar = r() < 0.3 ? [item(r, 990, -777777, 'CREDITO SEM PAR')] : [];
      const pagamento = r() < 0.5 ? [item(r, 991, -123456, 'PAGAMENTO DEBITO EM CONTA')] : [];
      const todos = embaralhar(r, [...itens, ...estornos, ...semPar, ...pagamento]);
      const soma = todos.filter(i => !pagamento.includes(i)).reduce((s, i) => s + c100(i.valor), 0);
      const c = comprasDaFatura(faturaCom(todos, soma / 100));
      const fora = c.deFora.map(x => x.item);
      expect(c.compras.length + fora.length).toBe(todos.length);
      expect(new Set([...c.compras, ...fora]).size).toBe(todos.length);
      // o que sai anulado se cancela: o resto soma o total
      expect(c100(c.soma)).toBe(soma);
      expect(c.diferenca).toBe(0);
      expect(comprasDaFatura(faturaCom(todos, soma / 100))).toEqual(c);
      // partidas dobradas: cada linha D ≠ C, valor positivo no centavo
      for (const l of lancamentosDaFatura(c, '2026-02-10', 'CARTAO', 'BANCO')) {
        expect(l.debito).not.toBe(l.credito);
        expect(l.valor).toBe(c100(l.valor) / 100);
        expect(l.valor).toBeGreaterThanOrEqual(0);
        expect(l.data).toBe('10/02/2026');
      }
      const ls = lancamentosDaFatura(c, '2026-02-10', 'CARTAO', 'BANCO');
      expect(ls.reduce((s, l) => s + (l.debito === 'CARTAO' ? c100(l.valor) : -c100(l.valor)), 0)).toBe(soma);
    }
  });

  it('parcelas de mesmo valor não se anulam entre si; dois estornos iguais levam dois gastos', () => {
    const r = semente(5);
    const c = comprasDaFatura(faturaCom([item(r, 1, 1000, 'LOJA 01/03'), item(r, 2, 1000, 'LOJA 02/03'), item(r, 3, -1000, 'ESTORNO'), item(r, 4, -1000, 'ESTORNO')]));
    expect(c.compras).toEqual([]);
    expect(c.soma).toBe(0);
    const uma = comprasDaFatura(faturaCom([item(r, 1, 1000, 'LOJA 01/03'), item(r, 2, 1000, 'LOJA 02/03'), item(r, 3, -1000, 'ESTORNO')]));
    expect(uma.compras.length).toBe(1);
    expect(uma.soma).toBe(10);
  });
});

describe('o pagamento no extrato', () => {
  it('só o débito exato, dentro da janela; o que fala de cartão primeiro; na virada de ano', () => {
    const f = faturaCom([], 100);
    f.vencimento = '2026-01-02';
    const l = (data: string, valor: number, historico: string) => ({ data, valor, historico, banco: 'Sicoob' });
    expect(pagamentoNoExtrato(f, 100, [l('2025-12-28', -10000, 'DEB CARTAO')])?.diasDoVencimento).toBe(-5);
    expect(pagamentoNoExtrato(f, 100, [l('2025-12-01', -10000, 'DEB CARTAO')])).toBeNull();
    expect(pagamentoNoExtrato(f, 100, [l('2026-01-02', 10000, 'CRED')])).toBeNull();
    expect(pagamentoNoExtrato(f, 100, [l('2026-01-02', -10001, 'DEB')])).toBeNull();
    expect(pagamentoNoExtrato(f, 100, [l('2026-01-02', -10000, 'PIX X'), l('2026-01-05', -10000, 'FATURA SICOOBCARD')])?.data).toBe('2026-01-05');
    expect(pagamentoNoExtrato(f, 1234567.89, [l('2026-01-02', -123456789, 'X')])?.data).toBe('2026-01-02');
  });
});
