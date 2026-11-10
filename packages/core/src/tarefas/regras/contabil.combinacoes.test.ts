// Testes combinatórios das etapas contábeis da Tarefa: o razão em qualquer ordem, centavos e milhões, virada de ano, regime
// e mês em que cada etapa entra. Laços determinísticos (semente fixa) e dados inventados, sem cliente real.
import { afterEach, describe, expect, it } from 'vitest';
import { conferirAdiantamentoSalarial, dataDoAdiantamentoSalarial, pagamentosQueFaltam } from './adiantamentoSalarial';
import { rotuloCurtoCompetencia, rotuloDoPeriodo, competenciasDoPeriodo, rotaDoPeriodo } from './competencias';
import { contratosDoRazao, emprestimosNoPeriodo, emprestimosParaOCadastro, mesesDevedores, numeroDoContrato } from './emprestimos';
import { etapaNoMes, execucaoNova, progresso, proximaEtapa, situacaoDa, usarRegimesDoCadastro } from './execucao';
import { conferirFgts, type GuiaDoFgts } from './fgts';
import { lancamentosDosHonorarios, pagamentosDosHonorarios, type CobrancaDeHonorario } from './honorarios';
import { conferirInss, type GuiaDoInss } from './inss';
import { lerRazao, mesesDoRazao, razaoContraOBalancete, type RazaoDaConta } from './razao';
import { conferirSimples, competenciaDoDas } from './simples';
import { resumoPorEtapaDasEmpresas } from './visao';
import { ROTINA_CONTABIL } from '../rotinas/contabil';
import { ROTINA_FISCAL } from '../rotinas/fiscal';
import { ROTINA_LCDPR } from '../rotinas/lcdpr';
import { rotinaDaEmpresa } from '../rotinas/rotinaDo';
import type { Execucao, Rotina } from '../tipos';

const cent = (n: number) => Math.round(n * 100) / 100;
/** o gerador determinístico (mulberry32) */
function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function embaralhar<T>(lista: readonly T[], semente: number): T[] {
  const r = gerador(semente), v = lista.slice();
  for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
  return v;
}

type Item = readonly [data: string, valor: number, historico?: string, contrapartida?: string];
const CABECALHO = ['Data', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo'];
/** O razão como o Alterdata exporta (o Saldo somado na ordem do arquivo), passando pelo leitor de verdade. */
function razaoDe(itens: readonly Item[], saldoInicial = 0): RazaoDaConta {
  let s = saldoInicial;
  const linhas = itens.map(([data, valor, h = '', c = '']) => { s = cent(s + valor); return [data.split('-').reverse().join('/'), c, '', valor, '', h, s]; });
  return lerRazao([CABECALHO, ...linhas]);
}
/** A mesma grade ordenada pelo Valor (o que o Vitor viu em 23/10/2026) e embaralhada. */
const ordens = (itens: readonly Item[]) => [
  [...itens].sort((a, b) => a[1] - b[1]),
  [...itens].sort((a, b) => b[1] - a[1]),
  ...[1, 2, 3, 4, 5].map(s => embaralhar(itens, s)),
];
const VALORES = [0.01, 0.02, 0.1, 0.29, 1.15, 1.1, 4.35, 19.99, 100.01, 1000.01, 1234.56, 99999.99, 1000000.01, 9876543.21];

afterEach(() => usarRegimesDoCadastro(() => ''));

// ─── Empréstimos ────────────────────────────────────────────────────────────────────────────────────────────────────

describe('empréstimos: o contrato no histórico', () => {
  it.each([
    ['Contrato 1246082.', '1246082'],
    ['Contrato 1246082, parcela', '1246082'],
    ['doc.1563830 Capital de Giro', '1563830'],
    ['doc. 1563830 Capital de Giro', '1563830'],
    ['CCB n° 01098198', '1098198'],
    ['01802448 DÉB.EMPRÉSTIMO', '1802448'],
    ['parc. 05/12 Contrato 900100', '900100'],
  ])('%s → %s', (h, n) => expect(numeroDoContrato(h)).toBe(n));

  it.each([
    ['Pago em 05/01/2026'], ['Vlr 123456,78'], ['Vlr 12345.67'], ['1.234.567,89'], ['Parcela 03/24'], ['1.23456 taxa'],
  ])('%s não é contrato', h => expect(numeroDoContrato(h)).toBeNull());
});

describe('empréstimos: as parcelas no histórico', () => {
  const contrato = (h: string) => contratosDoRazao(razaoDe([['2026-01-10', 1000, 'Liberação Contrato 900100'], ['2026-02-10', -1000, 'Contrato 900100 ' + h]])).contratos[0];
  it.each([['parc. 01/12', 12], ['PARC 03/24', 24], ['12 parcelas', 12], ['em 6 parcelas', 6]])('%s → %i parcelas', (h, n) => expect(contrato(h).parcelas).toBe(n));
  it.each([['pago em 05/01/2026'], ['venc 28/02/2028'], ['pago em 15/03']])('%s não diz o total de parcelas', h => expect(contrato(h).parcelas).toBeNull());

  it('uma data no histórico não acusa contrato quitado com saldo', () => {
    const k = contratosDoRazao(razaoDe([['2026-01-10', 1000, 'Liberação Contrato 900100'], ['2026-02-10', -400, 'Contrato 900100 pago em 05/01/2026']])).contratos[0];
    expect(k.saldo).toBe(600);
    expect(k.quitadoComSaldo).toBe(false);
  });

  it('pagou todas as parcelas e sobrou saldo: acusa', () => {
    const k = contratosDoRazao(razaoDe([
      ['2026-01-10', 1000, 'Liberação Contrato 900100'],
      ['2026-02-10', -400, 'Contrato 900100 parc. 01/02'],
      ['2026-03-10', -400, 'Contrato 900100 parc. 02/02'],
    ])).contratos[0];
    expect(k.quitadoComSaldo).toBe(true);
  });
});

describe('empréstimos: o razão em qualquer ordem', () => {
  const itens: Item[] = [
    ['2025-12-15', 120000, 'Liberação CCB n° 01098198', '10503'],
    ['2026-01-15', -10000.33, 'CCB n° 01098198 parc. 01/12', '10503'],
    ['2026-02-15', -10000.33, 'CCB n° 01098198 parc. 02/12', '10503'],
    ['2026-03-02', 50000, 'Liberação Contrato 1246082', '10503'],
    ['2026-03-15', 321.45, 'Juros CCB n° 01098198', '60101'],
    ['2026-04-02', -50000, 'Contrato 1246082 quitação', '10503'],
    ['2026-04-20', -0.01, 'Ajuste sem número', '10503'],
  ];
  const certo = contratosDoRazao(razaoDe(itens));
  const resumo = (c: typeof certo) => c.contratos.map(k => ({ numero: k.numero, inicio: k.inicio, fim: k.fim, liberado: k.liberado, liberadoEm: k.liberadoEm, saldo: k.saldo, pagas: k.pagas, parcelas: k.parcelas }));

  it('os contratos e o que vai para o Cadastro não mudam', () => {
    for (const o of ordens(itens)) {
      const c = contratosDoRazao(razaoDe(o));
      expect(resumo(c)).toEqual(resumo(certo));
      expect(emprestimosParaOCadastro(c.contratos, 'b1')).toEqual(emprestimosParaOCadastro(certo.contratos, 'b1'));
    }
  });

  it('o corte do período também não muda', () => {
    const ate = '2026-02';
    const base = contratosDoRazao(razaoDe(itens), ate);
    for (const o of ordens(itens)) expect(resumo(contratosDoRazao(razaoDe(o), ate))).toEqual(resumo(base));
  });

  it('nada se perde: a soma dos contratos e dos sem número é a soma do razão', () => {
    for (const v of VALORES) {
      const lista: Item[] = [['2026-01-05', v, 'Contrato 100001'], ['2026-01-06', v, 'Contrato 100002'], ['2026-02-05', -v, 'Contrato 100001'], ['2026-02-06', v * 3, 'sem número']];
      const c = contratosDoRazao(razaoDe(lista));
      const total = cent(lista.reduce((s, l) => s + cent(l[1]), 0));
      expect(cent(c.contratos.reduce((s, k) => s + k.saldo, 0) + c.somaSemNumero)).toBe(total);
      expect(c.contratos.reduce((s, k) => s + k.lancamentos.length, 0) + c.semNumero.length).toBe(lista.length);
    }
  });
});

describe('empréstimos: quando vale no período', () => {
  const emp = [{ numero: 'a', desde: '2025-11', ate: '2026-01' }, { numero: 'b', desde: '2026-02' }, { numero: 'c', desde: '2026-03', ate: '2026-03' }];
  it.each([
    [['2025-10'], []],
    [['2025-11'], ['a']],
    [['2025-12', '2026-01'], ['a']],
    [['2026-01', '2026-02'], ['a', 'b']],
    [['2026-02'], ['b']],
    [['2026-03'], ['b', 'c']],
    [[], []],
  ])('%j → %j', (meses, nums) => expect(emprestimosNoPeriodo(emp, meses as string[]).map(e => e.numero)).toEqual(nums));

  it('contrato quitado sai no mês do último lançamento; em aberto fica sem fim', () => {
    const c = contratosDoRazao(razaoDe([['2025-12-20', 500, 'Contrato 200001'], ['2026-01-20', -500, 'Contrato 200001'], ['2026-01-20', 500, 'Contrato 200002']]));
    expect(emprestimosParaOCadastro(c.contratos, 'b')).toEqual([
      { numero: '200001', banco: 'b', desde: '2025-12', ate: '2026-01' },
      { numero: '200002', banco: 'b', desde: '2026-01' },
    ]);
  });

  it('os lançamentos sem número que zeram um contrato são dele', () => {
    const c = contratosDoRazao(razaoDe([['2026-01-20', 700, 'Contrato 200001'], ['2026-02-20', -700, 'parcela ?']]));
    expect(c.contratos[0].completadoSemNumero).toBe(true);
    expect(emprestimosParaOCadastro(c.contratos, 'b')[0].ate).toBe('2026-01');
  });

  it('faltando um centavo para zerar, os sem número não são do contrato (a conta em centavos)', () => {
    const c = contratosDoRazao(razaoDe([['2026-01-20', 1000.01, 'Contrato 200001'], ['2026-02-20', -1000.02, 'parcela ?']]));
    expect(c.contratos[0].completadoSemNumero).toBe(false);
  });

  it('mês devedor: só o saldo negativo a partir de meio centavo', () => {
    expect(mesesDevedores([{ mes: 'a', saldoFinal: -0.01 }, { mes: 'b', saldoFinal: 0 }, { mes: 'c', saldoFinal: 5 }, { mes: 'd', saldoFinal: -0.004 }] as never)).toEqual(['a']);
  });
});

// ─── Adiantamento salarial ──────────────────────────────────────────────────────────────────────────────────────────

describe('adiantamento salarial', () => {
  it('o período antes do primeiro lançamento não derruba a tela', () => {
    const r = razaoDe([['2026-03-31', 500, 'Desconto folha']], 300);
    expect(pagamentosQueFaltam(r, '2026-01')).toEqual([]);
    expect(() => conferirAdiantamentoSalarial(r, ['2026-01'])).not.toThrow();
  });

  it('um centavo em aberto sem pagamento nenhum continua em aberto', () => {
    const r = razaoDe([['2026-01-31', 0.01, 'Desconto folha'], ['2026-02-28', 100, 'Desconto folha'], ['2026-02-15', -100, 'Adiantamento']]);
    expect(pagamentosQueFaltam(r, '2026-02').map(p => [p.mes, p.valor])).toEqual([['2026-01', 0.01]]);
  });

  it('dois valores em aberto no mesmo mês somam na coluna Falta', () => {
    const r = razaoDe([['2026-01-31', 400, 'Desconto folha']], 150.25);
    const faltam = pagamentosQueFaltam(r, '2026-01');
    expect(faltam.map(p => p.valor)).toEqual([150.25, 400]);
    expect(conferirAdiantamentoSalarial(r, ['2026-01'])[0].falta).toBe(550.25);
  });

  it('não depende da ordem do arquivo', () => {
    const itens: Item[] = [['2026-01-31', 400.1, 'Desc'], ['2026-02-13', -400.1, 'Pag'], ['2026-02-28', 200.2, 'Desc'], ['2026-03-13', -100.1, 'Pag'], ['2026-03-31', 300.3, 'Desc']];
    const base = pagamentosQueFaltam(razaoDe(itens), '2026-03');
    for (const o of ordens(itens)) expect(pagamentosQueFaltam(razaoDe(o), '2026-03')).toEqual(base);
  });

  it('o que falta é o saldo credor do razão, em centavos exatos', () => {
    for (let s = 1; s <= 200; s++) {
      const r = gerador(s);
      const itens: Item[] = [];
      for (let m = 1; m <= 6; m++) {
        const mes = '2026-0' + m;
        const desc = cent(Math.floor(r() * 500000) / 100 + 1000);
        itens.push([mes + '-28', desc, 'Desc']);
        // paga o mês inteiro ou um pedaço bem diferente: sem cair na tolerância do pago com atraso
        itens.push([mes + '-13', -cent(r() < 0.5 ? desc : desc * 0.37), 'Pag']);
      }
      const razao = razaoDe(itens);
      const saldo = razao.lancamentos[razao.lancamentos.length - 1].saldo;
      const falta = cent(pagamentosQueFaltam(razao, '2026-06').reduce((t, p) => t + p.valor, 0));
      expect(falta).toBe(saldo);
    }
  });

  it('o dia do pagamento fica no mês, no dia 15 ou antes dele e nunca em fim de semana', () => {
    for (const ano of [2026, 2027, 2028]) for (let m = 1; m <= 12; m++) {
      const mes = ano + '-' + String(m).padStart(2, '0');
      const d = dataDoAdiantamentoSalarial(mes);
      expect(d.slice(0, 7)).toBe(mes);
      expect(Number(d.slice(8))).toBeLessThanOrEqual(15);
      expect([0, 6]).not.toContain(new Date(d + 'T12:00:00').getDay());
    }
  });
});

// ─── Razão × balancete ──────────────────────────────────────────────────────────────────────────────────────────────

describe('o razão mês a mês', () => {
  it('um centavo de diferença do balancete passa, dois não, em qualquer tamanho de valor', () => {
    for (const v of [...VALORES, 3.33, 77.77, 1000, 5000.5, 70000.07]) {
      const r = razaoDe([['2026-01-10', cent(v + 0.01), 'x']]);
      expect(razaoContraOBalancete(r, { '2026-01': -v }, ['2026-01'])).toEqual([]);
      expect(razaoContraOBalancete(razaoDe([['2026-01-10', cent(v + 0.02), 'x']]), { '2026-01': -v }, ['2026-01'])).toHaveLength(1);
    }
  });

  it('o saldo de um mês emenda no do seguinte, com mês sem movimento e virada de ano', () => {
    const itens: Item[] = [['2025-11-10', 0.1, 'a'], ['2025-11-20', 0.2, 'b'], ['2026-01-05', -0.3, 'c'], ['2026-03-05', 1000000.01, 'd']];
    const meses = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
    for (const o of [itens, ...ordens(itens)]) {
      const ms = mesesDoRazao(razaoDe(o, 12.34), meses);
      expect(ms.map(m => m.saldoFinal)).toEqual([12.64, 12.64, 12.34, 12.34, 1000012.35]);
      for (let i = 1; i < ms.length; i++) expect(ms[i].saldoInicial).toBe(ms[i - 1].saldoFinal);
      expect(ms.reduce((t, m) => t + m.lancamentos.length, 0)).toBe(itens.length);
    }
  });
});

// ─── Simples, FGTS e INSS pelo razão ────────────────────────────────────────────────────────────────────────────────

describe('Simples a recolher', () => {
  const itens: Item[] = [
    ['2026-01-31', 1500.5, 'Provisão'],
    ['2026-02-20', -1500.5, 'Pago Simples referente 01/2026'],
    ['2026-02-28', 900.1, 'Provisão'],
    ['2026-03-20', -900.1, 'Pago Simples referente 02/2026'],
    ['2026-03-31', 1200.75, 'Provisão'],
    ['2026-04-30', 1300.25, 'Provisão fora do período'],
  ];
  const resumo = (c: ReturnType<typeof conferirSimples>) => ({ o: c.obrigacoes.map(x => [x.competencia, x.valor, x.situacao, x.anterior]), s: c.saldoDoRazao, e: c.saldoEsperado, d: c.diferenca });

  it('não depende da ordem do arquivo', () => {
    const base = resumo(conferirSimples(razaoDe(itens, 777.77), ['2026-03'], []));
    expect(base.s).toBe(1978.52);
    for (const o of ordens(itens)) expect(resumo(conferirSimples(razaoDe(o, 777.77), ['2026-03'], []))).toEqual(base);
  });

  it('o saldo anterior é do mês antes do primeiro lançamento, em qualquer ordem', () => {
    for (const o of ordens(itens)) {
      expect(conferirSimples(razaoDe(o, 50), ['2026-03'], []).obrigacoes.find(x => x.anterior)?.competencia).toBe('2025-12');
    }
  });

  it('dezembro vence em 20 de janeiro do ano seguinte', () => {
    const c = conferirSimples(razaoDe([['2025-12-31', 10, 'Provisão']]), ['2025-12'], []);
    expect(c.obrigacoes[0]).toMatchObject({ competencia: '2025-12', vencimento: '2026-01-20', situacao: 'depois' });
  });

  it('a baixa sugerida não passa do que saiu do banco', () => {
    const c = conferirSimples(razaoDe([['2026-01-31', 1000, 'Provisão']]), ['2026-02'], [
      { data: '2026-02-20', valor: -80000, historico: 'DB CONV RFB DAS SIMPLES REF 01/2026', banco: 'b' },
    ]);
    expect(c.obrigacoes[0].situacao).toBe('banco');
    expect(c.sugestoes.map(s => [s.tipo, s.valor])).toEqual([['pagamento', 800]]);
  });

  it('pago com juros: a baixa é o principal e os juros vêm à parte, somando o que saiu', () => {
    for (const v of [0.5, 100.01, 1234.56, 99999.99]) {
      const pago = cent(v * 1.1);
      const c = conferirSimples(razaoDe([['2026-01-31', v, 'Provisão']]), ['2026-03'], [
        { data: '2026-03-05', valor: -Math.round(pago * 100), historico: 'DB CONV RFB DAS SIMPLES REF 01/2026', banco: 'b' },
      ]);
      expect(cent(c.sugestoes.reduce((t, s) => t + s.valor, 0))).toBe(pago);
    }
  });

  it('a competência no histórico com o ano cortado, na virada do ano', () => {
    expect(competenciaDoDas('DAS REF DEZ202', '2026-01-20')).toBe('2025-12');
    expect(competenciaDoDas('DAS REF JAN2026', '2026-02-20')).toBe('2026-01');
    expect(competenciaDoDas('DAS REF 12/2025', '2026-01-20')).toBe('2025-12');
  });
});

describe('FGTS a recolher', () => {
  const guia = (competencia: string, total: number, vencimento: string): GuiaDoFgts => ({ numero: '1', competencia, vencimento, emissao: vencimento, total, trabalhadores: [] });
  const itens: Item[] = [['2026-01-31', 800.8, 'FGTS'], ['2026-02-20', -800.8, 'Pago'], ['2026-02-28', 900.9, 'FGTS'], ['2026-03-20', -900.9, 'Pago'], ['2026-03-31', 1000.1, 'FGTS']];

  it('o saldo no fim do período não depende da ordem do arquivo', () => {
    const base = conferirFgts(razaoDe(itens, 10), [], ['2026-02'], []).saldoDoRazao;
    expect(base).toBe(910.9);
    for (const o of ordens(itens)) expect(conferirFgts(razaoDe(o, 10), [], ['2026-02'], []).saldoDoRazao).toBe(base);
  });

  it('o mês antes do razão é o mesmo em qualquer ordem', () => {
    for (const o of ordens(itens)) {
      const c = conferirFgts(razaoDe(o), [guia('2025-12', 700, '2026-01-20'), guia('2026-01', 800.8, '2026-02-20')], ['2025-12', '2026-01'], []);
      expect(c.meses.map(m => m.foraDoRazao)).toEqual([true, false]);
    }
  });

  it('dois centavos de diferença ainda é o pagamento da guia, em qualquer tamanho de valor', () => {
    for (const v of [...VALORES, 999.98, 1000, 4096.02, 70000.05].filter(x => x > 0.02)) {
      const r = razaoDe([['2026-01-31', v, 'FGTS'], ['2026-02-20', -cent(v - 0.02), 'Pago']]);
      expect(conferirFgts(r, [guia('2026-01', v, '2026-02-20')], ['2026-01'], []).meses[0].situacao).toBe('ok');
    }
  });
});

describe('INSS a recolher', () => {
  const guia = (competencia: string, principal: number, total: number, pagaEm: string, numero = '1'): GuiaDoInss => ({ competencia, numero, vencimento: pagaEm, pagaEm, banco: '', itens: [], principal, total });
  const itens: Item[] = [['2026-01-31', 800.8, 'INSS segurados 01/2026'], ['2026-02-20', -800.8, 'Pago ref 01/2026'], ['2026-02-28', 900.9, 'INSS segurados 02/2026'], ['2026-03-20', -900.9, 'Pago ref 02/2026'], ['2026-03-31', 1000.1, 'INSS segurados 03/2026']];

  it('o saldo no fim do período não depende da ordem do arquivo', () => {
    const base = conferirInss(razaoDe(itens, 10), [], ['2026-02']).saldoDoRazao;
    expect(base).toBe(910.9);
    for (const o of ordens(itens)) expect(conferirInss(razaoDe(o, 10), [], ['2026-02']).saldoDoRazao).toBe(base);
  });

  it('a guia paga antes do início do razão fica de fora em qualquer ordem', () => {
    const base = conferirInss(razaoDe(itens), [guia('2025-12', 50, 50, '2026-01-10')], ['2026-01']);
    expect(base.baixas).toHaveLength(0);
    for (const o of ordens(itens)) expect(conferirInss(razaoDe(o), [guia('2025-12', 50, 50, '2026-01-10')], ['2026-01']).baixas).toHaveLength(0);
  });

  it('duas guias da mesma competência sem baixa: cada uma abate o principal dela', () => {
    const r = razaoDe([['2026-01-31', 300, 'INSS segurados 01/2026']]);
    const c = conferirInss(r, [guia('2026-01', 100, 110, '2026-02-10', '1'), guia('2026-01', 200, 200, '2026-02-12', '2')], ['2026-02']);
    expect(c.sugestoes.filter(s => s.tipo === 'baixa')).toHaveLength(2);
    expect(c.saldoAjustado).toBe(0);
  });
});

// ─── Honorários ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('honorários: as partidas', () => {
  const cob = (numero: string, valor: number, recebido: number, emissao = '2026-01-05', pagamento = '2026-02-10'): CobrancaDeHonorario =>
    ({ codigoCliente: 1, emissao, numero, vencimento: pagamento, pagamento, valor, recebido, aReceber: 0 });

  it('a provisão tem as duas contas, o histórico e a data da emissão, inclusive em 29/02', () => {
    for (const v of VALORES) {
      const [l] = lancamentosDosHonorarios([cob('000013074', v, 0, '2028-02-29')], ' 40101 ', ' 21501 ');
      expect(l).toMatchObject({ data: '29/02/2028', debito: '40101', credito: '21501', valor: v, documento: '13074' });
      expect(l.historico.trim()).not.toBe('');
    }
  });

  it('o que sai do banco é o que foi pago: igual, a mais (com os juros) ou a menos', () => {
    const banco = (c: CobrancaDeHonorario) => cent(pagamentosDosHonorarios([c], '21501', '40101', () => '10503').filter(l => l.credito === '10503').reduce((t, l) => t + l.valor, 0));
    for (const v of VALORES) {
      expect(banco(cob('1', v, v))).toBe(v);
      expect(banco(cob('1', v, 0))).toBe(v);
      expect(banco(cob('1', v, cent(v + 12.34)))).toBe(cent(v + 12.34));
      if (v >= 0.1) expect(banco(cob('1', v, cent(v * 0.9)))).toBe(cent(v * 0.9));
    }
  });

  it('juros em linha à parte, com débito e crédito preenchidos e sem linha de zero', () => {
    const ls = pagamentosDosHonorarios([cob('7', 100.1, 100.3)], '21501', '40101', () => ' 10503 ');
    expect(ls.map(l => [l.debito, l.credito, l.valor])).toEqual([['21501', '10503', 100.1], ['40101', '10503', 0.2]]);
    expect(pagamentosDosHonorarios([cob('7', 100.1, 100.1)], '21501', '40101', () => '10503')).toHaveLength(1);
  });
});

// ─── Quais etapas entram ────────────────────────────────────────────────────────────────────────────────────────────

const REGIMES = ['Simples', 'MEI', 'Presumido', 'Real', 'Isentas', 'Física', 'Domésticas', ''];
const COMPETENCIAS = [...Array.from({ length: 12 }, (_, i) => '2026-' + String(i + 1).padStart(2, '0')), '2028-02'];
const CODIGO = 99001;

describe('as etapas pelo regime e pelo mês', () => {
  for (const rotina of [ROTINA_CONTABIL, ROTINA_FISCAL]) {
    it(rotina.departamento + ': cada etapa entra só nos regimes e nos meses dela', () => {
      for (const regime of REGIMES) {
        usarRegimesDoCadastro(() => regime);
        for (const c of COMPETENCIAS) {
          const ex = execucaoNova('Empresa de teste', CODIGO, c, rotina.departamento);
          for (const e of rotina.etapas) {
            const peloRegime = !e.regimes || !regime || e.regimes.includes(regime);
            const peloMes = !e.meses || e.meses.includes(Number(c.slice(5, 7)));
            const esperado = !e.soQuandoAdicionada && peloRegime && peloMes;
            expect([regime, c, e.id, etapaNoMes(ex, e.id)]).toEqual([regime, c, e.id, esperado]);
            expect(situacaoDa(ex, e.id)).toBe(esperado ? 'pendente' : 'dispensada');
          }
        }
      }
    });
  }

  it('o progresso conta só as etapas do mês, e a soma nunca passa do total', () => {
    for (const regime of REGIMES) {
      usarRegimesDoCadastro(() => regime);
      for (const c of COMPETENCIAS) {
        const ex = execucaoNova('Empresa de teste', CODIGO, c, 'contabil');
        const p = progresso(ex, ROTINA_CONTABIL);
        expect(p.concluidas).toBe(0);
        expect(p.total).toBe(ROTINA_CONTABIL.etapas.filter(e => etapaNoMes(ex, e.id)).length);
      }
    }
  });

  it('o Estoque só em dezembro e o Simples só para o Simples', () => {
    usarRegimesDoCadastro(() => 'Presumido');
    const pres = execucaoNova('x', CODIGO, '2026-12', 'contabil');
    expect(etapaNoMes(pres, 'estoque')).toBe(true);
    expect(etapaNoMes({ ...pres, competencia: '2026-11' }, 'estoque')).toBe(false);
    const idSimples = ROTINA_CONTABIL.etapas.find(e => e.regimes?.includes('Simples'))!.id;
    expect(etapaNoMes(pres, idSimples)).toBe(false);
    usarRegimesDoCadastro(() => 'Simples');
    expect(etapaNoMes(pres, idSimples)).toBe(true);
  });

  it('a empresa do LCDPR só tem a rotina dele no Contábil; sem código, a do departamento', () => {
    expect(rotinaDaEmpresa('contabil', 62)).toBe(ROTINA_LCDPR);
    expect(rotinaDaEmpresa('fiscal', 62)).toBe(ROTINA_FISCAL);
    expect(rotinaDaEmpresa('contabil', null)).toBe(ROTINA_CONTABIL);
    expect(rotinaDaEmpresa('nada', 1)).toBeNull();
  });
});

describe('a próxima etapa', () => {
  const estado = { situacao: 'interrompida' as const, por: 'a', em: '2026-01-01T00:00:00Z', objecao: 'x' };

  it('a etapa interrompida que saiu do mês não prende a rotina', () => {
    const primeira = ROTINA_CONTABIL.etapas[0].id;
    const ex: Execucao = { ...execucaoNova('x', CODIGO, '2026-03', 'contabil'), etapas: { [primeira]: estado }, retiradas: [primeira] };
    expect(proximaEtapa(ex, ROTINA_CONTABIL)?.id).not.toBe(primeira);
    expect(progresso(ex, ROTINA_CONTABIL).interrompida).toBeNull();
  });

  it('o regime mudou depois de interrompida: a etapa do Simples não prende a Presumido', () => {
    const simples = ROTINA_CONTABIL.etapas.find(e => e.regimes?.includes('Simples'))!;
    const feitas = Object.fromEntries(ROTINA_CONTABIL.etapas.filter(e => e.id !== simples.id).map(e => [e.id, { situacao: 'feita' as const, por: 'a', em: '2026-01-01T00:00:00Z' }]));
    usarRegimesDoCadastro(() => 'Presumido');
    const ex: Execucao = { ...execucaoNova('x', CODIGO, '2026-12', 'contabil'), etapas: { ...feitas, [simples.id]: estado } };
    expect(proximaEtapa(ex, ROTINA_CONTABIL)).toBeNull();
  });

  it('a etapa interrompida do mês continua prendendo', () => {
    const primeira = ROTINA_CONTABIL.etapas[0].id;
    const ex: Execucao = { ...execucaoNova('x', CODIGO, '2026-03', 'contabil'), etapas: { [primeira]: estado } };
    expect(proximaEtapa(ex, ROTINA_CONTABIL)?.id).toBe(primeira);
    expect(progresso(ex, ROTINA_CONTABIL).interrompida?.id).toBe(primeira);
  });
});

describe('a visão de cima pelo regime', () => {
  const rotinaDe = (): Rotina => ROTINA_CONTABIL;
  const simples = ROTINA_CONTABIL.etapas.find(e => e.regimes?.includes('Simples'))!.id;

  it('a empresa de outro regime, sem execução, não fica pendente na etapa do Simples', () => {
    usarRegimesDoCadastro(c => (c === 1 ? 'Simples' : 'Presumido'));
    const r = resumoPorEtapaDasEmpresas([], [1, 2, 3], rotinaDe, '2026-05').find(x => x.etapa === simples)!;
    expect(r).toMatchObject({ total: 1, pendentes: 1 });
  });

  it('e com execução também não conta no total', () => {
    usarRegimesDoCadastro(c => (c === 1 ? 'Simples' : 'Presumido'));
    const r = resumoPorEtapaDasEmpresas([execucaoNova('b', 2, '2026-05', 'contabil')], [1, 2], rotinaDe, '2026-05').find(x => x.etapa === simples)!;
    expect(r).toMatchObject({ total: 1, pendentes: 1, dispensadas: 0 });
  });

  it('regime desconhecido entra, para nada sumir por engano; a etapa sem regime conta todas', () => {
    usarRegimesDoCadastro(() => '');
    const rs = resumoPorEtapaDasEmpresas([], [1, 2], rotinaDe, '2026-05');
    expect(rs.find(x => x.etapa === simples)).toMatchObject({ total: 2, pendentes: 2 });
    expect(rs.find(x => x.etapa === 'bancos')).toMatchObject({ total: 2, pendentes: 2 });
  });
});

describe('as competências', () => {
  it('o período atravessa a virada do ano e fevereiro bissexto, em qualquer sentido', () => {
    expect(competenciasDoPeriodo('2025-11..2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(competenciasDoPeriodo('2026-02..2025-11')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(competenciasDoPeriodo('2028-02')).toEqual(['2028-02']);
    expect(competenciasDoPeriodo('2026-13')).toEqual([]);
    expect(rotaDoPeriodo('2026-02', '2025-12')).toBe('2025-12..2026-02');
    expect(rotuloDoPeriodo(['2025-12', '2026-01'])).toBe('Dezembro/2025 a Janeiro/2026');
  });

  it('o rótulo curto aceita a competência 13 (o 13º salário), como o longo', () => {
    expect(rotuloCurtoCompetencia('2026-12')).toBe('dez 2026');
    expect(rotuloCurtoCompetencia('2026-13')).toBe('13º 2026');
  });
});

describe('o número do contrato com outro número colado num ponto', () => {
  it.each([
    ['Pagto parcela DOC.55555 contrato 1246082', '1246082'], ['NF.12345 CONTRATO 777777', '777777'], ['Ref.20260 Contrato 99999', '99999'],
    ['doc.1563830', '1563830'], ['doc. 1563830 Capital de Giro', '1563830'], ['Contrato 1246082.', '1246082'],
  ])('%s → %s', (h, n) => expect(numeroDoContrato(h)).toBe(n));
  it('o valor com centavos continua não sendo contrato', () => expect(numeroDoContrato('Pagamento 123456,78')).toBeNull());
});
