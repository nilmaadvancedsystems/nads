// Combinações da conciliação balancete × notas: CFOP × valor × natureza da conta × período, com invariantes
// (soma preservada, sem erro de ponto flutuante, nenhuma nota contada duas vezes, independe da ordem, reprocessar não muda nada).
// Laços determinísticos, com semente fixa e dados inventados.
import { describe, expect, it } from 'vitest';
import { brl } from '../../formatos';
import { conta, empresa, nota, servico } from '../__legado__/fixtures';
import { colocarNaCategoria } from '../acoes';
import { SERV_CAT } from '../tabelas/servicos';
import { FILTRO_MOVIMENTO_VAZIO as VAZIO, type Conta, type Empresa, type Nota, type TipoServico } from '../tipos';
import { agruparTotaisPorNatureza, chaveNaturezaNota, comTipo, somaValores, tipoDoCfop } from './cfop';
import { gruposConciliacao, linhasDoSaldo, quaisMarcarSozinho, saldoDasContas, situacaoDaConta } from './conciliacao';
import { acharDivergencias, chaveResolvido } from './divergencias';
import { normalizarEmpresa } from './empresa';
import { foraDoPadraoFiscal } from './foraDoPadraoFiscal';
import { pendenciasFiscaisComLugar } from './pendenciasFiscais';
import { filtroDoPeriodo, noPeriodo, notasNoPeriodo, periodoKey } from './periodo';
import { montarRelatorio } from './relatorio';
import { conferirServicos } from './servicosConferencia';

function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar<T>(l: readonly T[], r: () => number): T[] {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const cent = (v: number) => Math.round(v * 100);

const CFOPS_ENTRADA = ['1102', '2102', '3102', '1101', '1201', '2202', '3201', '1353', '1403', '1556', '2551', '1949', '2949', '1933'];
const CFOPS_SAIDA = ['5102', '6102', '7102', '5101', '7101', '5202', '6202', '7201', '5353', '5405', '5910', '5949', '5933', '6922'];
const VALORES = [0.01, 0.02, 0.03, 0.07, 0.1, 0.2, 0.3, 1.1, 8.02, 8.03, 19.99, 100.01, 1234.56, 999999.99, 1234567.89, 9999999.99];

function empresaDeUmaNota(cfop: string, valor: number, saldo: number, extra: Partial<Conta> = {}): Empresa {
  const n = nota(cfop, '6', valor, '100');
  const lista = tipoDoCfop(cfop) === 'Entrada' ? 'entradas' : 'saidas';
  return empresa({ contas: [{ ...conta('70001', 'Conta de teste', saldo), ...extra }], [lista]: [n], naturezaConta: { [chaveNaturezaNota(n)]: ['70001'] } });
}

describe('uma nota × saldo: CFOP × valor × natureza da conta × analítica/sintética', () => {
  it('saldo igual à nota: ok, diferença nenhuma e nada pendente', () => {
    for (const cfop of [...CFOPS_ENTRADA, ...CFOPS_SAIDA]) for (const valor of VALORES) for (const dc of ['D', 'C'] as const) for (const sintetica of [false, true]) {
      const e = empresaDeUmaNota(cfop, valor, valor, { dc, sintetica });
      const r = montarRelatorio(e, VAZIO, '');
      expect(r.saldo.length, cfop + ' ' + valor).toBe(1);
      expect(r.saldo[0].situacao.tipo, cfop + ' ' + valor).toBe('ok');
      expect(pendenciasFiscaisComLugar(e, VAZIO), cfop + ' ' + valor).toEqual([]);
    }
  });

  it('um centavo de diferença nunca passa como ok, para mais ou para menos (ponto flutuante)', () => {
    const erradas: string[] = [];
    for (const cfop of ['1102', '5102', '7101']) for (const valor of VALORES) for (const sinal of [1, -1]) {
      const saldo = (cent(valor) + sinal) / 100;
      if (saldo <= 0) continue;
      const e = empresaDeUmaNota(cfop, valor, saldo);
      const s = montarRelatorio(e, VAZIO, '').saldo[0].situacao;
      if (s.tipo !== 'diferenca' || Math.abs(Math.abs(s.diferenca) - 0.01) > 1e-9) erradas.push(cfop + ': nota ' + valor + ' × saldo ' + saldo + ' = ' + JSON.stringify(s));
      expect(pendenciasFiscaisComLugar(e, VAZIO).length, cfop + ' ' + valor).toBe(s.tipo === 'diferenca' ? 1 : 0);
      expect(quaisMarcarSozinho(e, agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas)), [chaveNaturezaNota(e.entradas[0] || e.saidas[0])], VAZIO).length, cfop + ' ' + valor).toBe(0);
    }
    expect(erradas).toEqual([]);
  });

  it('varredura de centavos: soma e saldo com 1 centavo de distância sempre dão diferença', () => {
    const erradas: string[] = [];
    for (let c = 1; c <= 60000; c += 13) {
      const s = situacaoDaConta({ somaNotas: (c + 1) / 100, saldo: c / 100, revisao: null, conferidoManual: false, podeConferir: false });
      if (s.tipo !== 'diferenca') erradas.push(c + ': ' + s.tipo);
      const igual = situacaoDaConta({ somaNotas: c / 100, saldo: c / 100, revisao: null, conferidoManual: false, podeConferir: false });
      if (igual.tipo !== 'ok') erradas.push(c + ' igual: ' + igual.tipo);
    }
    expect(erradas).toEqual([]);
  });

  it('a diferença sai no centavo certo, sem resto de ponto flutuante', () => {
    for (const [soma, saldo, dif] of [[0.3, 0.1, 0.2], [1.1, 1.01, 0.09], [1234567.89, 1234567.8, 0.09], [8.03, 8.02, 0.01]]) {
      const s = situacaoDaConta({ somaNotas: soma, saldo, revisao: null, conferidoManual: false, podeConferir: false });
      expect(s).toEqual({ tipo: 'diferenca', diferenca: dif });
    }
  });

  it('nota sem valor: soma zero, sem pendência', () => {
    for (const cfop of ['1102', '5102']) for (const saldo of [0, 100]) {
      const e = empresaDeUmaNota(cfop, 0, saldo);
      expect(montarRelatorio(e, VAZIO, '').saldo[0].situacao.tipo).toBe('soma-zero');
      expect(pendenciasFiscaisComLugar(e, VAZIO)).toEqual([]);
    }
  });
});

describe('somas sem resto de ponto flutuante', () => {
  it('somaValores fecha no centavo, com qualquer quantidade', () => {
    for (const v of [0.1, 0.2, 0.07, 1.1, 19.99]) for (let n = 1; n <= 200; n += 3) {
      const soma = somaValores(Array.from({ length: n }, () => ({ valor: v })));
      expect(soma, v + ' × ' + n).toBe(Math.round(cent(v) * n) / 100);
    }
  });
  it('dez notas de 0,10 batem com saldo de 1,00', () => {
    const notas = Array.from({ length: 10 }, (_, i) => nota('1102', '6', 0.1, String(i + 1)));
    const e = empresa({ contas: [conta('70001', 'Compras', 1)], entradas: notas, naturezaConta: { [chaveNaturezaNota(notas[0])]: ['70001'] } });
    const r = montarRelatorio(e, VAZIO, '');
    expect(r.totEnt).toBe(1);
    expect(r.saldo[0].somaNotas).toBe(1);
    expect(r.saldo[0].situacao.tipo).toBe('ok');
  });
  it('saldo de várias contas somado no centavo', () => {
    const e = empresa({ contas: [conta('1', 'A', 0.1), conta('2', 'B', 0.2)] });
    expect(saldoDasContas(e, ['1', '2'])).toBe(0.3);
  });
  it('o gráfico por mês fecha com os totais', () => {
    const notas = Array.from({ length: 30 }, (_, i) => nota(i % 2 ? '1102' : '5102', '6', 0.1, String(i + 1), { data: String((i % 28) + 1).padStart(2, '0') + '/' + (i % 3 ? '12/2025' : '01/2026') }));
    const e = empresa({ entradas: notas.filter(n => n.cfop === '1102'), saidas: notas.filter(n => n.cfop === '5102') });
    const r = montarRelatorio(e, VAZIO, '');
    expect(r.meses.length).toBe(2);
    for (const m of r.meses) { expect(m.ent).toBe(cent(m.ent) / 100); expect(m.sai).toBe(cent(m.sai) / 100); }
    expect(r.meses.reduce((s, m) => s + cent(m.ent), 0)).toBe(cent(r.totEnt));
    expect(r.meses.reduce((s, m) => s + cent(m.sai), 0)).toBe(cent(r.totSai));
  });
});

// ---------- empresa mista: muitas notas, meses, naturezas que dividem conta ----------
const MESES = ['11/2025', '12/2025', '01/2026', '02/2026'];
const CONTAS = ['60010', '60020', '60030', '60040', '60050', '60060', '60070'];

function empresaMista(semente: number): { e: Empresa; ligadas: Nota[]; soltas: Nota[] } {
  const r = sorteador(semente);
  const notas: Nota[] = [];
  const naturezaConta: Record<string, string[]> = {};
  const centavos: Record<string, number> = {};
  const todos = [...CFOPS_ENTRADA, ...CFOPS_SAIDA];
  const pegar = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)];
  const ligadas: Nota[] = [];
  const soltas: Nota[] = [];
  for (let i = 0; i < 150; i++) {
    const cfop = pegar(todos);
    const valor = r() < 0.5 ? pegar(VALORES) : Math.floor(r() * 1_000_000) / 100;
    const data = String(1 + Math.floor(r() * 28)).padStart(2, '0') + '/' + pegar(MESES);
    const n = nota(cfop, r() < 0.8 ? '6' : '7', valor, String(1000 + i), { data });
    notas.push(n);
    const k = chaveNaturezaNota(n);
    if (k.charCodeAt(0) % 11 === 0) { soltas.push(n); continue; }
    ligadas.push(n);
    if (!naturezaConta[k]) {
      const c1 = pegar(CONTAS);
      naturezaConta[k] = r() < 0.2 ? [c1, pegar(CONTAS)] : [c1];
    }
    centavos[naturezaConta[k][0]] = (centavos[naturezaConta[k][0]] || 0) + cent(valor);
  }
  const contas = CONTAS.map(c => conta(c, 'Conta ' + c, (centavos[c] || 0) / 100));
  const e = empresa({ contas, entradas: notas.filter(n => tipoDoCfop(n.cfop) === 'Entrada'), saidas: notas.filter(n => tipoDoCfop(n.cfop) === 'Saída'), naturezaConta });
  return { e, ligadas, soltas };
}

const relatorioComparavel = (e: Empresa) => {
  const r = montarRelatorio(e, VAZIO, '');
  return { ...r, marcarSozinho: r.marcarSozinho.map(x => x.chave).sort() };
};

describe('empresa mista (50 sementes)', () => {
  it('balancete e notas batem: tudo ok, soma e quantidade preservadas', () => {
    for (let s = 1; s <= 50; s++) {
      const { e, ligadas } = empresaMista(s);
      const r = montarRelatorio(e, VAZIO, '');
      for (const l of r.saldo) expect(['ok', 'soma-zero'], 'semente ' + s + ' ' + l.titulo).toContain(l.situacao.tipo);
      expect(r.saldo.reduce((t, l) => t + l.qtdNotas, 0), 'semente ' + s).toBe(ligadas.length);
      expect(r.saldo.reduce((t, l) => t + cent(l.somaNotas), 0), 'semente ' + s).toBe(ligadas.reduce((t, n) => t + cent(n.valor), 0));
      expect(pendenciasFiscaisComLugar(e, VAZIO), 'semente ' + s).toEqual([]);
    }
  });
  it('a ordem das linhas não muda o resultado', () => {
    for (let s = 1; s <= 50; s++) {
      const { e } = empresaMista(s);
      const r = sorteador(s * 7);
      const outra = { ...e, entradas: embaralhar(e.entradas, r), saidas: embaralhar(e.saidas, r) };
      expect(relatorioComparavel(outra), 'semente ' + s).toEqual(relatorioComparavel(e));
    }
  });
  it('reprocessar não muda nada (nem a empresa)', () => {
    for (let s = 1; s <= 20; s++) {
      const { e } = empresaMista(s);
      const antes = JSON.stringify(e);
      expect(relatorioComparavel(e)).toEqual(relatorioComparavel(e));
      expect(JSON.stringify(e)).toBe(antes);
      expect(normalizarEmpresa(normalizarEmpresa(e))).toEqual(normalizarEmpresa(e));
    }
  });
  it('conciliação: cada natureza num grupo só', () => {
    for (let s = 1; s <= 30; s++) {
      const { e } = empresaMista(s);
      const chaves = Object.keys(agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas)));
      const comps = gruposConciliacao(e, chaves);
      const todas = comps.flatMap(c => c.naturezas);
      expect(new Set(todas).size, 'semente ' + s).toBe(todas.length);
      const contas = comps.flatMap(c => c.contas);
      expect(new Set(contas).size, 'semente ' + s).toBe(contas.length);
    }
  });
  it('um centavo a mais num saldo só acusa a linha daquela conta', () => {
    for (let s = 1; s <= 20; s++) {
      const { e } = empresaMista(s);
      const r0 = montarRelatorio(e, VAZIO, '');
      const alvo = r0.saldo.find(l => l.situacao.tipo === 'ok');
      if (!alvo) continue;
      const x = alvo.contas.find(c => e.contas.some(a => a.codigo === c)) as string;
      const e2 = { ...e, contas: e.contas.map(a => (a.codigo === x ? { ...a, valor: (cent(a.valor) + 1) / 100 } : a)) };
      const r2 = montarRelatorio(e2, VAZIO, '');
      expect(r2.saldo.filter(l => l.situacao.tipo === 'diferenca').map(l => l.contas), 'semente ' + s).toEqual([alvo.contas]);
    }
  });
  it('período de vários meses, virada de ano: cada nota em exatamente um mês, nenhuma perdida', () => {
    for (let s = 1; s <= 15; s++) {
      const { e } = empresaMista(s);
      const todas = comTipo(e.entradas, e.saidas);
      const comps = ['2025-11', '2025-12', '2026-01', '2026-02'];
      let total = 0;
      let soma = 0;
      for (const m of comps) {
        const f = filtroDoPeriodo([m]);
        const dentro = notasNoPeriodo(e, f);
        expect(dentro.every(n => n.comp === m)).toBe(true);
        total += dentro.length;
        soma += dentro.reduce((t, n) => t + cent(n.valor), 0);
      }
      expect(total).toBe(todas.length);
      expect(soma).toBe(todas.reduce((t, n) => t + cent(n.valor), 0));
      const inteiro = filtroDoPeriodo(comps);
      expect(notasNoPeriodo(e, inteiro).length).toBe(todas.length);
      expect(notasNoPeriodo(e, filtroDoPeriodo(comps.slice().reverse())).length).toBe(todas.length);
    }
  });
  it('mês sem movimento: relatório vazio sem quebrar', () => {
    const { e } = empresaMista(3);
    const r = montarRelatorio(e, filtroDoPeriodo(['2024-05']), '');
    expect([r.qtdNotas, r.totEnt, r.totSai, r.saldo.length]).toEqual([0, 0, 0, 0]);
    expect(pendenciasFiscaisComLugar(e, filtroDoPeriodo(['2024-05']))).toEqual([]);
  });
});

describe('período: limites e chave', () => {
  it('primeiro e último dia de cada mês, fevereiro bissexto e virada de ano', () => {
    const casos: [string, number, number][] = [['2024-02', 2024, 29], ['2025-02', 2025, 28], ['2025-12', 2025, 31], ['2026-01', 2026, 31], ['2026-04', 2026, 30]];
    for (const [m, ano, ult] of casos) {
      const f = filtroDoPeriodo([m]);
      const mes = m.slice(5);
      for (const d of [1, ult]) expect(noPeriodo({ data: String(d).padStart(2, '0') + '/' + mes + '/' + ano, comp: m }, f), m + ' ' + d).toBe(true);
      expect(f.dataAte).toBe(ult + '/' + mes + '/' + ano);
    }
  });
  it('a chave do período não depende da ordem dos meses', () => {
    expect(periodoKey(filtroDoPeriodo(['2026-01', '2025-12']))).toBe(periodoKey(filtroDoPeriodo(['2025-12', '2026-01'])));
  });
});

describe('contas somadas', () => {
  it('saldo devedor e credor numa conta só de cada: o título e a conta da revisão não dependem da ordem das naturezas', () => {
    const notas = [nota('1102', '6', 100, '1'), nota('1403', '6', 50, '2'), nota('1556', '6', 30, '3')];
    const nat = (i: number) => chaveNaturezaNota(notas[i]);
    const e = empresa({ contas: [conta('70006', 'Compras a Prazo', 100), conta('70002', 'Compras à Vista', 80)], entradas: notas, naturezaConta: { [nat(0)]: ['70006', '70002'], [nat(2)]: ['70002'] } });
    const grupos = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas));
    const a = linhasDoSaldo(e, grupos, Object.keys(grupos), VAZIO, '');
    const b = linhasDoSaldo(e, grupos, Object.keys(grupos).reverse(), VAZIO, '');
    expect(b).toEqual(a);
    expect(a[0].contas).toEqual(['70002', '70006']);
  });
});

describe('fora do padrão do CFOP', () => {
  const LANC = (variante: number, base: string) => [base, base.padStart(5, '0'), base + '.0'][variante % 3];

  it('o mesmo lançamento com máscara diferente (zeros, .0) não é fora do padrão', () => {
    for (let q = 3; q <= 12; q++) for (const cfop of ['1102', '5102', '2949']) {
      const lista = tipoDoCfop(cfop) === 'Entrada' ? 'entradas' : 'saidas';
      const e = empresa({ [lista]: Array.from({ length: q }, (_, i) => nota(cfop, LANC(i, '182'), 10, String(i + 1))) });
      expect(acharDivergencias(e, lista), cfop + ' × ' + q).toEqual([]);
    }
  });
  it('a maioria com zeros e uma nota sem os zeros: é o mesmo lançamento', () => {
    for (const minoria of ['182', '182.0', '0182', ' 182 ']) for (const maioria of ['00182', '182']) {
      if (minoria === maioria) continue;
      const notas = [...Array.from({ length: 4 }, (_, i) => nota('1102', maioria, 10, String(i + 1))), nota('1102', minoria, 10, '9')];
      expect(acharDivergencias(empresa({ entradas: notas }), 'entradas'), maioria + ' × ' + minoria).toEqual([]);
    }
    // e um lançamento de verdade diferente continua acusando
    const notas = [...Array.from({ length: 4 }, (_, i) => nota('1102', '00182', 10, String(i + 1))), nota('1102', '183', 10, '9')];
    expect(acharDivergencias(empresa({ entradas: notas }), 'entradas').map(d => d.padrao)).toEqual(['00182']);
  });
  it('a maioria (≥ 60%, ao menos 3 notas) define o padrão, em toda proporção', () => {
    for (let total = 1; total <= 20; total++) for (let dom = 1; dom <= total; dom++) {
      const notas = Array.from({ length: total }, (_, i) => nota('1102', i < dom ? '6' : '7', 10, String(i + 1)));
      const e = empresa({ entradas: notas });
      const divs = acharDivergencias(e, 'entradas');
      const maioria = Math.max(dom, total - dom);
      const temPadrao = total >= 3 && maioria / total >= 0.6;
      expect(divs.length, dom + '/' + total).toBe(temPadrao ? total - maioria : 0);
    }
  });
  it('corrigidos + pendentes = divergências, total preservado e ordem das notas não importa', () => {
    for (let s = 1; s <= 25; s++) {
      const r = sorteador(s);
      const entradas: Nota[] = [];
      for (let i = 0; i < 80; i++) {
        const cfop = ['1102', '1403', '2102', '1556'][Math.floor(r() * 4)];
        entradas.push(nota(cfop, r() < 0.75 ? '6' : String(7 + Math.floor(r() * 3)), Math.floor(r() * 100000) / 100, String(i + 1)));
      }
      const e = empresa({ entradas });
      const divs = acharDivergencias(e, 'entradas');
      const metade = divs.filter((_, i) => i % 2).map(d => chaveResolvido('entradas', d.chave));
      const e2 = { ...e, divResolvidos: metade };
      const f = foraDoPadraoFiscal(e2, 'entradas', 'cfop');
      const qtd = (g: typeof f.pendentes) => g.reduce((t, x) => t + x.itens.length, 0);
      expect(qtd(f.pendentes) + qtd(f.corrigidos), 'semente ' + s).toBe(divs.length);
      expect(f.qtdCorrigidos).toBe(metade.length);
      const soma = (g: typeof f.pendentes) => g.reduce((t, x) => t + cent(x.total), 0);
      expect(soma(f.pendentes) + soma(f.corrigidos), 'semente ' + s).toBe(divs.reduce((t, d) => t + cent(d.nota.valor), 0));
      const ch = (l: { chave: string }[]) => l.map(d => d.chave).sort();
      expect(ch(acharDivergencias({ ...e, entradas: embaralhar(entradas, r) }, 'entradas')), 'semente ' + s).toEqual(ch(divs));
    }
  });
});

describe('serviços: tipo × categoria × valor', () => {
  const montar = (tipo: TipoServico, catId: string, nome: string, valor: number, saldo: number): Empresa => {
    const campo = tipo === 'tomados' ? 'servTomados' : 'servPrestados';
    const lanc = SERV_CAT[tipo].find(c => c.id === catId)!.lanc;
    let e = empresa({ contas: [conta('80001', 'Conta do serviço', saldo)], [campo]: [servico('10', nome, valor, lanc)], naturezaConta: { ['serv|' + tipo + '|' + (catId === 'geral' ? '*' : 'cat:' + catId)]: ['80001'] } });
    if (catId !== 'geral') e = colocarNaCategoria(e, tipo, catId, nome);
    return e;
  };
  const CASOS: [TipoServico, string, string][] = [
    ...SERV_CAT.tomados.filter(c => !c.travado).map(c => ['tomados', c.id, 'PRESTADOR ' + c.id.toUpperCase()] as [TipoServico, string, string]),
    ['tomados', 'honorario', 'NILMA CONTABILIDADE LTDA'],
    ['prestados', 'geral', 'CLIENTE ÁGUA E CIA'],
  ];
  it('saldo igual: ok; um centavo: diferença; total preservado', () => {
    for (const [tipo, cat, nome] of CASOS) for (const valor of VALORES) {
      const ok = conferirServicos(montar(tipo, cat, nome, valor, valor), tipo, VAZIO, 'nome');
      expect(ok.saldo.map(l => l.situacao.tipo), tipo + ' ' + cat + ' ' + valor).toEqual(['ok']);
      expect(ok.pendentes, tipo + ' ' + cat + ' ' + valor).toEqual([]);
      expect(ok.totais.valor).toBe(valor);
      const dif = conferirServicos(montar(tipo, cat, nome, valor, (cent(valor) + 1) / 100), tipo, VAZIO, 'nome');
      expect(dif.saldo[0].situacao.tipo, tipo + ' ' + cat + ' ' + valor).toBe('diferenca');
    }
  });
  it('um participante chamado como propriedade do objeto não quebra a conferência', () => {
    for (const nome of ['Constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      const r = conferirServicos(empresa({ contas: [conta('80001', 'X', 10)], servTomados: [servico('10', nome, 10, '527')], naturezaConta: { 'serv|tomados|*': ['80001'] } }), 'tomados', VAZIO, 'nome');
      expect(r.saldo.map(l => l.situacao.tipo), nome).toEqual(['ok']);
      expect(r.qtdParticipantes, nome).toBe(1);
      expect(r.pendentes, nome).toEqual([]);
    }
  });
  it('total das notas e somas sem resto de ponto flutuante', () => {
    const notas = Array.from({ length: 10 }, (_, i) => servico(String(i + 1), 'PRESTADOR', 0.1, '527'));
    const r = conferirServicos(empresa({ contas: [conta('80001', 'X', 1)], servTomados: notas, naturezaConta: { 'serv|tomados|*': ['80001'] } }), 'tomados', VAZIO, 'nome');
    expect(r.totais.valor).toBe(1);
    expect(r.saldo[0].somaNotas).toBe(1);
    expect(r.saldo[0].situacao.tipo).toBe('ok');
  });
  it('a diferença de pendência aparece no centavo, sem -0,00', () => {
    const e = montar('tomados', 'geral', 'PRESTADOR', 0.3, 0.1);
    expect(pendenciasFiscaisComLugar(e, VAZIO)[0].texto).toContain(brl(0.2));
  });
});
