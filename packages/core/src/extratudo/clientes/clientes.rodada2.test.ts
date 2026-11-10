// 2ª rodada da etapa Clientes/Fornecedores: propriedades do razão (permutar, reimportar, dividir, parcial) e as baixas (1×N, N×1, a
// mais, mesmo número, nomes, virada de ano). A 1ª rodada (combinacoes) cobriu os formatos de número e as linhas soltas. Dados
// fictícios, sementes fixas.
import { describe, expect, it } from 'vitest';
import type { LancamentoDoRazao, RazaoDaConta } from '../../tarefas/regras/razao';
import {
  chaveDoItem, clientesDoDinamico, comBaixa, conferirFechamento, conferirRazaoDoCliente, credoresNoPeriodo, docDoDocumento, faltaDaNota, participanteDeOutraConta, quitadoPelasBaixas,
  razaoDaMarca, razaoComPendencia, situacaoDe, sugestoesDeBaixa, tipoDoRazao, type BalanceteDinamico, type LadoDaConta, type LancamentoDoBanco, type LinhaDinamico, type MarcaDoCliente, type RazaoConferido,
} from './index';
import { mesmoNomeDeCliente } from '../creditor/regras/clientes';

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
const c100 = (n: number) => Math.round(n * 100);

// ─── os lançamentos ──────────────────────────────────────────────────────────

/** [data, valor em centavos no sinal do Alterdata do cliente (venda −, recebimento +), histórico, conta] */
type Ev = [string, number, string, string?];
const DOC = '11222333000144';
const venda = (nf: string, nome = 'CLIENTE FICTICIO') => 'Pelas vendas conf. Nota Fiscal nº - ' + nf + '-' + DOC + '-' + nome;
const receb = (nf: string, dup = '001') => 'Recebimento de clientes ' + nf + ' -DUP.' + dup;

/** O razão dos eventos, com o Saldo corrido na ordem que vierem (a grade exportada por outra coluna). */
function razaoDe(evs: readonly Ev[], saldoInicial = 0, sinal: 1 | -1 = 1): RazaoDaConta {
  let s = saldoInicial * sinal;
  const trocar = (h: string) => (sinal === 1 ? h : h.replace('Pelas vendas', 'Pela compra').replace('Recebimento de clientes', 'Pagamento a fornecedores'));
  const lancamentos: LancamentoDoRazao[] = evs.map(([data, valor, historico, c]) => {
    s += sinal * valor;
    return { data, contrapartida: c === 'Caixa' ? '10101' : '10503', nomeContrapartida: c || 'Banco', valor: sinal * valor / 100, codigoHistorico: '', historico: trocar(historico), saldo: s / 100 };
  });
  return { lancamentos, saldoInicial: saldoInicial * sinal / 100, saldoFinal: s / 100, inicio: lancamentos[0]?.data || '', fim: lancamentos[lancamentos.length - 1]?.data || '' };
}

const MESES = ['2025-11', '2025-12', '2026-01', '2026-02'];
const novaData = (r: Sorte, mes = um(r, MESES)) => mes + '-' + String(entre(r, 1, 28)).padStart(2, '0');

/** Notas, parciais, adiantamentos, a mais, devoluções e pagamentos soltos. */
function eventosGerados(r: Sorte): Ev[] {
  const evs: Ev[] = [];
  const n = entre(r, 1, 10);
  for (let i = 0; i < n; i++) {
    const nf = String(1000 + i * 37);
    const v = entre(r, 100, 500000);
    evs.push([novaData(r), -v, venda(nf)]);
    const partes = entre(r, 0, 3);
    let resta = v;
    for (let k = 1; k <= partes; k++) {
      const p = k === partes && r() < 0.5 ? resta + (r() < 0.2 ? entre(r, 1, 900) : 0) : Math.max(1, Math.floor(resta * r()));
      resta -= p;
      evs.push([novaData(r), p, receb(nf, String(k).padStart(3, '0')), um(r, ['Banco', 'Banco', 'Caixa'])]);
    }
  }
  for (let i = entre(r, 0, 2); i > 0; i--) evs.push([novaData(r), entre(r, 1, 90000), 'Transferência Pix recebida ' + i, 'Banco Z']);
  if (r() < 0.3) evs.push([novaData(r), entre(r, 1, 90000), 'Devolução de venda conf. Nota Fiscal nº - 99' + entre(r, 10, 99) + '-' + DOC + '-CLIENTE FICTICIO //NF: 1000']);
  return evs;
}

/** O que não pode mudar: o saldo, a nota em aberto, a mais, e o total das soltas. */
const resumo = (c: RazaoConferido) => ({
  saldo: c.saldo,
  aberto: Object.fromEntries(c.emAberto.map(n => [n.nf, n.aberto])),
  aMais: Object.fromEntries(c.aMais.map(n => [n.nf, n.aberto])),
  soltos: c100(c.semNota.reduce((t, x) => t + x.valor, 0)) + c100(c.pagaAnterior.reduce((t, x) => t + x.valor, 0)),
  devolucoes: c100(c.devolucoes.reduce((t, x) => t + x.valor, 0)),
  duplicadas: c.duplicados.length,
});

const ultimoMes = '2026-02';

describe('propriedades do razão', () => {
  it('permutar as linhas (a grade classificada por outra coluna) não muda o saldo nem as notas', () => {
    for (let seed = 1; seed <= 250; seed++) {
      const r = semente(seed);
      const evs = eventosGerados(r);
      for (const [lado, sinal] of [['clientes', 1], ['fornecedores', -1]] as [LadoDaConta, 1 | -1][]) {
        if (lado === 'fornecedores' && evs.some(e => /Transfer|Devolu/.test(e[2]))) continue;
        const certo = conferirRazaoDoCliente(razaoDe([...evs].sort((a, b) => a[0].localeCompare(b[0])), 0, sinal), ultimoMes, lado);
        for (let k = 0; k < 4; k++) {
          const c = conferirRazaoDoCliente(razaoDe(embaralhar(r, evs), 0, sinal), ultimoMes, lado);
          expect(resumo(c), 'seed ' + seed).toEqual(resumo(certo));
        }
      }
    }
  });

  it('o mesmo recebimento em Banco, Caixa e de novo no Banco conta igual em qualquer ordem (o que importa é o maior por conta)', () => {
    const base: Ev[] = [
      ['2026-01-02', -100000, venda('501')],
      ['2026-01-10', 30000, receb('501'), 'Banco'],
      ['2026-01-10', 30000, receb('501'), 'Banco'],
      ['2026-01-10', 30000, receb('501'), 'Caixa'],
    ];
    for (const perm of [[0, 1, 2, 3], [0, 3, 1, 2], [0, 1, 3, 2], [3, 1, 2, 0], [2, 3, 0, 1]]) {
      const c = conferirRazaoDoCliente(razaoDe(perm.map(i => base[i])), '2026-01');
      // dois recebimentos de verdade no Banco e a cópia no Caixa
      expect(c.emAberto.map(n => n.aberto), perm.join()).toEqual([400]);
      expect(c.saldo, perm.join()).toBe(400);
      expect(c.duplicados.map(d => d.nf), perm.join()).toEqual(['501']);
    }
  });

  it('o fornecedor com o mesmo recebimento repetido também independe da ordem', () => {
    const base: Ev[] = [['2026-01-02', -100000, venda('501')], ['2026-01-10', 30000, receb('501'), 'Banco'], ['2026-01-10', 30000, receb('501'), 'Banco'], ['2026-01-10', 30000, receb('501'), 'Caixa']];
    const a = conferirRazaoDoCliente(razaoDe(base, 0, -1), '2026-01', 'fornecedores');
    const b = conferirRazaoDoCliente(razaoDe([base[0], base[3], base[1], base[2]], 0, -1), '2026-01', 'fornecedores');
    expect(resumo(a)).toEqual(resumo(b));
    expect(a.saldo).toBe(400);
  });

  it('com saldo anterior, permutar pagamentos soltos do mesmo dia mantém o saldo e o total das soltas', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 13);
      const dia = '2026-01-' + String(entre(r, 1, 28)).padStart(2, '0');
      const evs: Ev[] = [['2026-01-01', -entre(r, 100, 90000), venda('701')]];
      for (let i = entre(r, 2, 6); i > 0; i--) evs.push([dia, entre(r, 1, 40000), 'Transferência Pix recebida ' + i, 'Banco Z']);
      const inicial = -entre(r, 1, 90000);
      const a = conferirRazaoDoCliente(razaoDe(evs, inicial), '2026-01');
      const b = conferirRazaoDoCliente(razaoDe([evs[0], ...embaralhar(r, evs.slice(1))], inicial), '2026-01');
      expect(b.saldo, 'seed ' + seed).toBe(a.saldo);
      expect(resumo(b).soltos, 'seed ' + seed).toBe(resumo(a).soltos);
    }
  });

  it('duas parcelas de mesmo valor no mesmo dia, uma no Banco e outra no Caixa, são dois recebimentos (não duplicidade)', () => {
    const c = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -90000, venda('501')],
      ['2026-01-10', 30000, receb('501', '001'), 'Banco'],
      ['2026-01-10', 30000, receb('501', '002'), 'Caixa'],
    ]), '2026-01');
    expect(c.duplicados).toEqual([]);
    expect(c.emAberto.map(n => n.aberto)).toEqual([300]);
    expect(c.saldo).toBe(300);
    expect(c.saldoDoRazao).toBe(300);
  });

  it('a parcela escrita com a barra ("501/002") também distingue; a mesma duplicata em duas contas continua duplicidade', () => {
    const barra = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -90000, venda('501')],
      ['2026-01-10', 30000, 'Recebimento de clientes 501/001 - X', 'Banco'],
      ['2026-01-10', 30000, 'Recebimento de clientes 501/002 - X', 'Caixa'],
    ]), '2026-01');
    expect(barra.duplicados).toEqual([]);
    expect(barra.saldo).toBe(300);
    const mesma = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -90000, venda('501')],
      ['2026-01-10', 30000, receb('501', '001'), 'Banco'],
      ['2026-01-10', 30000, receb('501', '001'), 'Caixa'],
    ]), '2026-01');
    expect(mesma.duplicados.map(d => d.nf)).toEqual(['501']);
    expect(mesma.saldo).toBe(600);
    // sem parcela num dos lados: não dá para dizer que são duas, continua duplicidade
    const semParcela = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -90000, venda('501')],
      ['2026-01-10', 30000, receb('501', '001'), 'Banco'],
      ['2026-01-10', 30000, 'Recebimento de clientes 501', 'Caixa'],
    ]), '2026-01');
    expect(semParcela.duplicados.map(d => d.nf)).toEqual(['501']);
  });

  it('reimportar o mesmo razão dá a mesma marca; guardada e relida no documento também', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const r = semente(seed * 3);
      const evs = eventosGerados(r);
      const a = razaoDaMarca('a.xls', conferirRazaoDoCliente(razaoDe(evs), ultimoMes));
      const b = razaoDaMarca('a.xls', conferirRazaoDoCliente(razaoDe(evs), ultimoMes));
      expect(b).toEqual(a);
      const doc = docDoDocumento({ contas: { '11501': { nome: 'X', saldo: 1, situacao: 'conferido', razao: a } } });
      expect(doc.contas['11501'].razao).toEqual(a);
      const denovo = docDoDocumento(JSON.parse(JSON.stringify(doc)));
      expect(denovo).toEqual(doc);
    }
  });

  it('dividir o razão em dois arquivos (ou em meses) e juntar dá o mesmo que um só', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 5);
      const evs = [...eventosGerados(r)].sort((a, b) => a[0].localeCompare(b[0]));
      const corte = entre(r, 0, evs.length);
      const umSo = conferirRazaoDoCliente(razaoDe(evs), ultimoMes);
      const juntos = razaoDe([...evs.slice(corte), ...evs.slice(0, corte)]);
      expect(resumo(conferirRazaoDoCliente(juntos, ultimoMes)), 'seed ' + seed).toEqual(resumo(umSo));
    }
  });

  it('a relação (sem o interno) soma o saldo, nas duas pontas, com adiantamento, a mais, devolução e pagamento solto', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = semente(seed * 7);
      const evs = eventosGerados(r).filter(e => !/DUP/.test(e[2]) || e[3] !== 'Caixa');
      const c = conferirRazaoDoCliente(razaoDe(evs), ultimoMes);
      const m = razaoDaMarca('a.xls', c);
      const soma = m.itens.filter(i => !i.interno).reduce((t, i) => t + c100(i.valor), 0);
      expect(soma, 'seed ' + seed).toBe(c100(c.saldo));
      if (!c.duplicados.length) expect(c.saldo).toBe(c.saldoDoRazao);
    }
  });

  it('a soma dos saldos dos clientes é o saldo da sintética e cada um bate com o razão dele', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed * 11);
      const contas = Array.from({ length: entre(r, 2, 6) }, (_, i) => ({ codigo: String(11500 + i), evs: eventosGerados(r).filter(e => e[3] !== 'Caixa') }));
      const saldos = contas.map(c => conferirRazaoDoCliente(razaoDe(c.evs), ultimoMes).saldo);
      const total = saldos.reduce((t, s) => t + c100(s), 0) / 100;
      const linhas: LinhaDinamico[] = [
        { codigo: '1150', classificacao: '1.1.2.01', descricao: 'CLIENTES', saldoAnterior: 0, saldos: { [ultimoMes]: total } },
        ...contas.map((c, i) => ({ codigo: c.codigo, classificacao: '1.1.2.01.' + String(i + 1).padStart(3, '0'), descricao: 'CLIENTE ' + i, saldoAnterior: 0, saldos: { [ultimoMes]: saldos[i] } })),
      ];
      const lista = clientesDoDinamico({ meses: [ultimoMes], linhas }, ultimoMes);
      expect(lista.map(x => x.saldo)).toEqual(saldos);
      expect(lista.reduce((t, x) => t + c100(x.saldo), 0)).toBe(c100(total));
    }
  });

  it('o mesmo valor recebido em 1, 2 ou 5 vezes deixa a nota igual', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 13);
      const v = entre(r, 500, 900000), pago = entre(r, 100, v);
      const base: Ev[] = [['2026-01-02', -v, venda('777')]];
      const emUm = conferirRazaoDoCliente(razaoDe([...base, ['2026-01-20', pago, receb('777')]]), '2026-01');
      for (const k of [2, 5]) {
        let resta = pago;
        const partes: Ev[] = [];
        for (let i = 1; i <= k; i++) { const p = i === k ? resta : Math.max(1, Math.floor(resta / (k - i + 1))); resta -= p; if (p > 0) partes.push(['2026-01-' + String(10 + i).padStart(2, '0'), p, receb('777', String(i).padStart(3, '0'))]); }
        const emVarios = conferirRazaoDoCliente(razaoDe([...base, ...partes]), '2026-01');
        expect(resumo(emVarios)).toEqual(resumo(emUm));
        const n = emVarios.emAberto[0];
        if (n) expect(n.pagos?.reduce((t, x) => t + c100(x.valor), 0)).toBe(pago);
      }
    }
  });
});

// ─── as baixas ───────────────────────────────────────────────────────────────

describe('as baixas das notas', () => {
  it('N recebimentos para 1 nota, em meses diferentes: o recorte do mês não conta o de depois', () => {
    const evs: Ev[] = [['2025-12-15', -100000, venda('900')], ['2025-12-20', 40000, receb('900', '001')], ['2026-01-20', 60000, receb('900', '002')]];
    expect(conferirRazaoDoCliente(razaoDe(evs), '2025-12').emAberto.map(n => n.aberto)).toEqual([600]);
    expect(conferirRazaoDoCliente(razaoDe(evs), '2026-01').emAberto).toEqual([]);
  });

  it('recebimento maior que a nota: fica a mais, com a diferença exata, e a nota não some da relação', () => {
    const c = conferirRazaoDoCliente(razaoDe([['2026-01-02', -10000, venda('300')], ['2026-01-05', 12345, receb('300')]]), '2026-01');
    expect(c.aMais.map(n => n.aberto)).toEqual([-23.45]);
    const m = razaoDaMarca('x', c);
    expect(m.itens.map(i => [i.nf, i.status, i.valor])).toEqual([['300', 'pagamento', -23.45]]);
    expect(razaoComPendencia(m)).toBe(true);
  });

  it('um recebimento para várias notas no histórico: o saldo fecha (a distribuição é dúvida de regra, ver o todo)', () => {
    const c = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -10000, venda('301')], ['2026-01-02', -20000, venda('302')], ['2026-01-02', -30000, venda('303')],
      ['2026-01-20', 60000, 'Recebimento de clientes 301, 302 e 303'],
    ]), '2026-01');
    expect(c.saldo).toBe(0);
    expect(c.saldoDoRazao).toBe(0);
    const m = razaoDaMarca('x', c);
    expect(m.itens.reduce((t, i) => t + c100(i.valor), 0)).toBe(0);
  });
  it.todo('PENDENTE (regra): recebimento que cita várias notas — hoje vai todo para a primeira (fica "a mais") e as outras ficam em aberto');

  it('mesmo número em duas séries na mesma conta: soma as duas e o saldo fecha', () => {
    const c = conferirRazaoDoCliente(razaoDe([
      ['2026-01-02', -10000, venda('500')], ['2026-01-03', -7000, venda('500')],
      ['2026-01-10', 10000, receb('500')],
    ]), '2026-01');
    expect(c.emAberto.map(n => [n.nf, n.vendido, n.recebido, n.aberto])).toEqual([['500', 170, 100, 70]]);
    expect(c.saldo).toBe(70);
  });

  it('mesmo número em clientes diferentes: cada razão com a sua nota, sem misturar', () => {
    const a = conferirRazaoDoCliente(razaoDe([['2026-01-02', -10000, venda('500', 'ALFA LTDA')], ['2026-01-10', 10000, receb('500')]]), '2026-01');
    const b = conferirRazaoDoCliente(razaoDe([['2026-01-02', -33300, venda('500', 'BETA LTDA')]]), '2026-01');
    expect(a.emAberto).toEqual([]);
    expect(b.emAberto.map(n => n.aberto)).toEqual([333]);
  });

  it('a nota de um ano com o recebimento no outro; o razão de dois exercícios com a mesma numeração soma por número', () => {
    const c = conferirRazaoDoCliente(razaoDe([['2025-12-30', -10000, venda('123')], ['2026-01-02', 4000, receb('123')]]), '2026-01');
    expect(c.emAberto.map(n => [n.nf, n.data, n.aberto])).toEqual([['123', '2025-12-30', 60]]);
  });

  it('virada de ano: o corte de dezembro não vê janeiro e o fim do mês vale para 28, 30 e 31', () => {
    const evs: Ev[] = [['2025-12-31', -10000, venda('123')], ['2026-01-01', 10000, receb('123')]];
    const dez = conferirRazaoDoCliente(razaoDe(evs), '2025-12');
    expect([dez.saldo, dez.saldoDoRazao]).toEqual([100, 100]);
    expect(conferirRazaoDoCliente(razaoDe(evs), '2026-01').saldo).toBe(0);
    const fev = conferirRazaoDoCliente(razaoDe([['2026-02-28', -100, venda('124')], ['2026-03-01', 100, receb('124')]]), '2026-02');
    expect(fev.saldo).toBe(1);
  });

  it('a chave do item (a escolha do "+", a baixa aceita) não muda ao reimportar sem novidade', () => {
    const evs: Ev[] = [['2026-01-02', -10000, venda('888')]];
    const k = (m: ReturnType<typeof razaoDaMarca>) => m.itens.map(chaveDoItem);
    expect(k(razaoDaMarca('a', conferirRazaoDoCliente(razaoDe(evs), '2026-01')))).toEqual(k(razaoDaMarca('b', conferirRazaoDoCliente(razaoDe(evs), '2026-01'))));
  });

  it('baixa aceita: duas parciais quitam; a que falta volta ao desfazer; Ok só quando todas as notas fecham', () => {
    const c = conferirRazaoDoCliente(razaoDe([['2026-01-02', -30000, venda('601')], ['2026-01-03', -10000, venda('602')]]), '2026-01');
    const razao = razaoDaMarca('a', c);
    const [i1, i2] = razao.itens;
    const pix = (d: string, v: number): LancamentoDoBanco => ({ data: d, valor: v, historico: 'PIX ' + d, banco: 'Sicoob' });
    let baixas = comBaixa(undefined, chaveDoItem(i1), pix('2026-01-10', 10000), true);
    baixas = comBaixa(baixas, chaveDoItem(i1), pix('2026-01-11', 20000), true);
    expect(faltaDaNota(i1.valor, baixas![chaveDoItem(i1)])).toBe(0);
    const marca: MarcaDoCliente = { nome: 'X', saldo: 400, situacao: 'pendente', razao, baixas };
    expect(quitadoPelasBaixas(marca)).toBe(false);
    baixas = comBaixa(baixas, chaveDoItem(i2), pix('2026-01-12', 10000), true);
    const com = { ...marca, baixas };
    expect(quitadoPelasBaixas(com)).toBe(true);
    expect(situacaoDe({ codigo: '1', nome: 'X', saldo: 400, noBalancete: null }, com)).toBe('ok');
    baixas = comBaixa(baixas, chaveDoItem(i2), pix('2026-01-12', 10000), false);
    expect(situacaoDe({ codigo: '1', nome: 'X', saldo: 400, noBalancete: null }, { ...marca, baixas })).toBe('conferido');
  });

  it.todo('PENDENTE (regra): o mesmo lançamento do banco pode ser aceito em duas notas (legítimo quando 1 recebimento paga N notas; a mais quando o valor só cobre uma)');
});

describe('o nome do cliente com variação', () => {
  it.each([
    ['MERCADO SÃO JOSÉ LTDA', 'mercado sao jose ltda'],
    ['Mercado  São   José', 'MERCADO SAO JOSE ME'],
    ['MERC. SAO JOSE', 'MERCADO SAO JOSE LTDA'],
    ['J. SILVA & CIA LTDA', 'J SILVA E CIA LTDA'],
    ['AÇOUGUE BOI-GORDO', 'ACOUGUE BOI GORDO'],
    ['COMERCIAL ÍTALO', 'COM ITALO LTDA'],
    ['  PADARIA ÁGUA BOA ', 'PADARIA AGUA BOA ME'],
  ])('%s é %s', (a, b) => {
    expect(mesmoNomeDeCliente(a, b)).toBe(true);
    expect(mesmoNomeDeCliente(b, a)).toBe(true);
    expect(participanteDeOutraConta([a], b)).toBeNull();
  });

  it.each([
    ['MERCADO BOM PRECO', 'PADARIA BOM PAO'],
    ['ALFA COMERCIO LTDA', 'BETA COMERCIO LTDA'],
  ])('%s não é %s', (a, b) => {
    expect(mesmoNomeDeCliente(a, b)).toBe(false);
    expect(participanteDeOutraConta([a], b)).toBe(a);
  });

  it('a sugestão de baixa acha o nome com acento, caixa e espaços diferentes', () => {
    const banco: LancamentoDoBanco[] = [{ data: '2026-01-05', valor: 5050, historico: 'PIX RECEBIDO  JOAO  ACOUGUE', banco: 'Sicoob' }];
    const s = sugestoesDeBaixa({ data: '2026-01-02', valor: 100, vendido: 100 }, 'João AÇOUGUE Ltda', banco, 1);
    expect(s.map(x => x.mesmoNome)).toEqual([true]);
  });
});

describe('o fechamento na virada de ano', () => {
  const l = (codigo: string, classificacao: string, descricao: string, saldos: Record<string, number>): LinhaDinamico => ({ codigo, classificacao, descricao, saldoAnterior: 0, saldos });
  const d: BalanceteDinamico = { meses: ['2025-11', '2025-12', '2026-01'], linhas: [
    l('1150', '1.1.2.01', 'CLIENTES', { '2025-11': -5, '2025-12': 0, '2026-01': -7 }),
    l('11501', '1.1.2.01.001', 'CLIENTE DE NOVEMBRO', { '2025-11': -5, '2025-12': 0, '2026-01': 0 }),
    l('11502', '1.1.2.01.002', 'CLIENTE DE JANEIRO', { '2025-11': 0, '2025-12': 0, '2026-01': -7 }),
  ] };

  it('o credor de cada lado da virada aparece, só nos meses pedidos', () => {
    expect(credoresNoPeriodo(d, '2026-01').map(c => c.codigo)).toEqual(['11501', '11502']);
    const f = conferirFechamento(d, ['2025-12', '2026-01']);
    expect(f.find(p => p.id === 'clientes')?.contas).toEqual([{ conta: '11502', nome: 'CLIENTE DE JANEIRO', meses: [{ mes: '2026-01', saldo: -7 }] }]);
  });

  it('os meses fora de ordem não escondem o credor do mês mais novo', () => {
    const f = conferirFechamento(d, ['2026-01', '2025-11']);
    expect(f.find(p => p.id === 'clientes')?.contas.map(c => c.conta).sort()).toEqual(['11501', '11502']);
  });

  it('a obrigação debaixo de "CONTAS A PAGAR" é da etapa dela, não é fornecedor', () => {
    const m = '2026-01';
    const c: BalanceteDinamico = { meses: [m], linhas: [
      l('2103', '2.1.03', 'CONTAS A PAGAR', { [m]: 0 }),
      l('21031', '2.1.03.001', 'SALARIOS A PAGAR', { [m]: 50 }),
      l('21032', '2.1.03.002', 'FORNECEDOR REAL LTDA', { [m]: -80 }),
      l('21033', '2.1.03.003', 'INSS A RECOLHER', { [m]: 30 }),
    ] };
    expect(tipoDoRazao(c, '21031')).toBe('salarios');
    expect(clientesDoDinamico(c, m, 'fornecedores').map(x => x.codigo)).toEqual(['21032']);
    const f = conferirFechamento(c, [m]);
    expect(f.find(p => p.id === 'fornecedores')).toBeUndefined();
    expect(f.find(p => p.id === 'passivo')?.contas.map(x => x.conta)).toEqual(['21031', '21033']);
  });
});

describe('o recebimento sem a duplicata, junto dos que citam', () => {
  const H = 'Recebimento de clientes 9078';
  const venda: LancamentoDoRazao = { data: '2026-03-01', historico: 'Venda - 9078-11222333000144-NOME', valor: -300, saldo: 0, contrapartida: 'V', nomeContrapartida: 'Vendas', codigoHistorico: '' };
  const rec = (h: string, conta: string): LancamentoDoRazao => ({ data: '2026-03-10', historico: h, valor: 100, saldo: 0, contrapartida: conta, nomeContrapartida: '', codigoHistorico: '' });
  const conferir = (ls: LancamentoDoRazao[]) => conferirRazaoDoCliente({ saldoInicial: 0, lancamentos: ls } as unknown as RazaoDaConta, '2026-03');

  it.each([
    ['depois', [rec(H + ' -DUP.001', 'Banco'), rec(H + ' -DUP.002', 'Banco'), rec(H, 'Caixa')]],
    ['antes', [rec(H, 'Caixa'), rec(H + ' -DUP.001', 'Banco'), rec(H + ' -DUP.002', 'Banco')]],
  ] as [string, LancamentoDoRazao[]][])('a cópia no Caixa, %s das duplicatas do Banco, continua acusada', (_, ls) => {
    const r = conferir([venda, ...ls]);
    expect(r.duplicados.length).toBe(1);
    expect(r.emAberto.map(n => n.aberto)).toEqual([100]);
  });

  it('as duas duplicatas citadas, em contas diferentes, seguem sendo dois recebimentos', () => {
    const r = conferir([venda, rec(H + ' -DUP.001', 'Banco'), rec(H + ' -DUP.002', 'Caixa')]);
    expect(r.duplicados).toEqual([]);
    expect(r.emAberto.map(n => n.aberto)).toEqual([100]);
  });
});
