// Rodada 2: propriedades da Conferência (a ordem das linhas não muda o resultado, conta nova só mexe nela, reimportar não muda nada, um razão
// em dois arquivos é o mesmo razão, dobrar os valores mantém os status, virada de ano, o mesmo dado em layouts diferentes). Semente fixa, dados inventados.
import { describe, expect, it } from 'vitest';
import { conta, empresa, linha, nota } from '../__legado__/fixtures';
import { lerNotas, lerRazao, type Linhas } from '../arquivos';
import type { Empresa, Nota } from '../tipos';
import { agruparTotaisPorNatureza, comTipo } from './cfop';
import { linhasDoSaldo } from './conciliacao';
import { mesclarNotas, mesclarServicos, mesesSemNotas, soDoPeriodo } from './importacao';
import { filtroDoPeriodo, noPeriodo, periodoKey } from './periodo';
import { conferirConta, semPendencias, totaisVerificacao, type LinhaRazao } from './verificarConta';

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

const SEM_PERIODO = { dataDe: '', dataAte: '', meses: [] as string[] };
const CONTA = conta('70', 'Compras');
const chave = (e: Empresa) => Object.keys(agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas)))[0];
function empresaCom(notas: Nota[]): Empresa {
  const e = empresa({ entradas: notas, contas: [CONTA] });
  e.naturezaConta[chave(e)] = ['70'];
  return e;
}
const conferir = (notas: Nota[], razao: LinhaRazao[]) => { const e = empresaCom(notas); return conferirConta({ empresa: e, contas: [CONTA], razaoPorConta: { 70: razao }, cfopGrupo: chave(e), servTipo: null }); };
const resumo = (r: ReturnType<typeof conferirConta>) => ({
  faltando: r.faltando.map(n => n.numero).sort(),
  duplicada: r.duplicada.map(d => [d.numero, d.vezes, d.valor]).sort(),
  aMais: r.aMais.map(l => l.txt + '|' + l.data).sort(),
  peloValor: r.peloValor.map(p => p.nota.numero + '<' + p.linha.txt).sort(),
  ok: semPendencias(r), totais: totaisVerificacao(r),
});

function cenario(semente: number): { notas: Nota[]; razao: LinhaRazao[] } {
  const r = sorteador(semente);
  const notas: Nota[] = [];
  const razao: LinhaRazao[] = [];
  const qtd = 8 + Math.floor(r() * 12);
  for (let i = 0; i < qtd; i++) {
    const valor = [100, 100, 250.5, 77.77, 1000][Math.floor(r() * 5)];
    const data = String(1 + Math.floor(r() * 27)).padStart(2, '0') + '/07/2026';
    const numero = String(1000 + i);
    notas.push(nota('1102', '6', valor, numero, { data }));
    const q = r();
    if (q < 0.6) razao.push(linha(numero, valor, { data }));
    else if (q < 0.75) razao.push({ txt: 'pagamento banco ' + i, data, valor, sinal: 1, contra: '' });
    else if (q < 0.85) razao.push(linha(numero, valor, { data }), linha(numero, valor, { data }));
  }
  if (r() < 0.5) razao.push({ txt: 'ICMS a Recuperar', data: '10/07/2026', valor: 9, sinal: 1, contra: '' });
  if (r() < 0.5) razao.push({ txt: 'ajuste qualquer', data: '11/07/2026', valor: 33, sinal: 1, contra: '' });
  return { notas, razao };
}

describe('a ordem das linhas não muda o resultado', () => {
  it('permutar notas e razão (200 sementes): quem falta, duplica, sobra e casa pelo valor é sempre o mesmo', () => {
    for (let s = 1; s <= 200; s++) {
      const { notas, razao } = cenario(s);
      const base = resumo(conferir(notas, razao));
      const r = sorteador(s * 7);
      for (let k = 0; k < 4; k++) expect(resumo(conferir(embaralhar(notas, r), embaralhar(razao, r))), 'semente ' + s).toEqual(base);
    }
  });
  it('uma linha sem número para duas notas de mesmo valor: a nota que casa não depende da ordem do arquivo', () => {
    const a = nota('1102', '6', 100, '1', { data: '01/07/2026' }), b = nota('1102', '6', 100, '2', { data: '06/07/2026' });
    const l: LinhaRazao = { txt: 'pagamento banco', data: '04/07/2026', valor: 100, sinal: 1, contra: '' };
    expect(resumo(conferir([b, a], [l]))).toEqual(resumo(conferir([a, b], [l])));
    expect(conferir([b, a], [l]).faltando.map(n => n.numero)).toEqual(['2']);
  });
  it('a lista "Faltando" continua na ordem das notas', () => {
    const notas = [nota('1102', '6', 1, '9', { data: '09/07/2026' }), nota('1102', '6', 2, '3', { data: '03/07/2026' })];
    expect(conferir(notas, []).faltando.map(n => n.numero)).toEqual(['9', '3']);
  });
});

describe('dobrar todos os valores mantém os status', () => {
  it('300 sementes', () => {
    for (let s = 1; s <= 300; s++) {
      const { notas, razao } = cenario(s);
      const estado = (r: ReturnType<typeof conferirConta>) => [r.faltando.length, r.duplicada.length, r.aMais.length, r.peloValor.length, semPendencias(r)];
      const dobro = conferir(notas.map(n => ({ ...n, valor: n.valor * 2 })), razao.map(l => ({ ...l, valor: l.valor * 2 })));
      const base = conferir(notas, razao);
      expect(estado(dobro), 'semente ' + s).toEqual(estado(base));
      expect(totaisVerificacao(dobro).diferenca).toBeCloseTo(totaisVerificacao(base).diferenca * 2, 2);
    }
  });
});

describe('conta nova só mexe nela', () => {
  it('as linhas das outras contas ficam iguais', () => {
    const base = () => {
      const e = empresa({ entradas: [nota('1102', '6', 100, '1'), nota('1556', '7', 50, '2')], contas: [conta('70', 'Compras', 100), conta('71', 'Uso', 40)] });
      const ks = Object.keys(agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas)));
      e.naturezaConta[ks[0]] = ['70'];
      e.naturezaConta[ks[1]] = ['71'];
      return e;
    };
    const linhas = (e: Empresa) => { const g = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas)); return linhasDoSaldo(e, g, Object.keys(g), SEM_PERIODO, ''); };
    const antes = linhas(base());
    const e = base();
    e.contas.push(conta('72', 'Nova', 30));
    e.entradas.push(nota('1933', '9', 30, '3'));
    const g = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas));
    e.naturezaConta[Object.keys(g).find(k => g[k].cfops.includes('1933')) as string] = ['72'];
    const depois = linhas(e);
    expect(depois.filter(l => l.contas[0] !== '72')).toEqual(antes);
    expect(depois.find(l => l.contas[0] === '72')?.situacao).toEqual({ tipo: 'ok' });
  });
});

describe('reimportar', () => {
  it('o mesmo arquivo lido e mesclado duas vezes não muda nada, em qualquer ordem', () => {
    const cab = ['Dt. Escritura', 'Número', 'CFOP', 'Lanc', 'Nome', 'CNPJ', 'Valor Contábil'];
    for (let s = 1; s <= 40; s++) {
      const r = sorteador(s);
      const linhas: Linhas = Array.from({ length: 30 }, (_, i) => [String(1 + (i % 27)).padStart(2, '0') + '/07/2026', String(100 + (i % 12)), '1102', '6', 'F' + (i % 12), r() < 0.5 ? '11222333000100' : r() < 0.5 ? '99888777000100' : '', ['10,00', '20,00'][Math.floor(r() * 2)]]);
      const uma = mesclarNotas([], lerNotas([cab, ...linhas]), 'novas');
      const duas = mesclarNotas(uma.notas, lerNotas([cab, ...embaralhar(linhas, r)]), 'novas');
      expect(duas.notas, 'semente ' + s).toEqual(uma.notas);
      expect([duas.adicionadas, duas.atualizadas], 'semente ' + s).toEqual([0, 0]);
    }
  });
  it('serviços: o ISS guardado fica quando o relatório não traz a coluna', () => {
    const ex = { data: '05/07/2026', comp: '2026-07', numero: '1', lanc: '5', codPart: '', cnpj: '', nome: 'F', valor: 100, iss: 7 };
    const { iss: _iss, ...semColuna } = ex;
    void _iss;
    const m = mesclarServicos([ex], [semColuna], 'novas');
    expect(m.notas[0].iss).toBe(7);
    expect(m.atualizadas).toBe(0);
  });
});

describe('um razão em dois arquivos é o mesmo razão', () => {
  it('em qualquer ponto de corte, a leitura e a conferência dão o mesmo', () => {
    const cab = ['Data', 'Histórico', 'Valor', 'Contrapartida'];
    const ls: Linhas = Array.from({ length: 12 }, (_, i) => ['0' + (1 + (i % 9)) + '/07/2026', 'conf NF-e ? - ' + (100 + i) + '-11222333000100-FORN', String(i + 1) + ',00', '21101']);
    const notas = ls.map((_, i) => nota('1102', '6', i + 1, String(100 + i), { data: ls[i][0] }));
    const inteiro = lerRazao([cab, ...ls]);
    for (let corte = 1; corte < ls.length; corte++) {
      const partes = [...lerRazao([cab, ...ls.slice(0, corte)]), ...lerRazao([cab, ...ls.slice(corte)])];
      expect(partes, 'corte ' + corte).toEqual(inteiro);
      expect(resumo(conferir(notas, partes)), 'corte ' + corte).toEqual(resumo(conferir(notas, inteiro)));
    }
  });
});

describe('virada de ano e competências fora de ordem', () => {
  it('o período é o mesmo em qualquer ordem dos meses', () => {
    const a = filtroDoPeriodo(['2026-01', '2025-11', '2025-12']);
    const b = filtroDoPeriodo(['2025-12', '2026-01', '2025-11']);
    expect(a).toEqual(b);
    expect([a.dataDe, a.dataAte]).toEqual(['01/11/2025', '31/01/2026']);
    expect(periodoKey(a)).toBe(periodoKey({ ...a, meses: a.meses.slice().reverse() }));
    expect(noPeriodo({ data: '31/12/2025', comp: '2025-12' }, a)).toBe(true);
    expect(noPeriodo({ data: '01/02/2026', comp: '2026-02' }, a)).toBe(false);
  });
  it('o relatório da conta na virada: a nota de dezembro casa com a linha de janeiro e o período corta o resto', () => {
    const notas = [nota('1102', '6', 50, '1', { data: '30/12/2025' }), nota('1102', '6', 60, '2', { data: '02/02/2026' })];
    const l: LinhaRazao = { txt: 'pagamento', data: '02/01/26', valor: 50, sinal: 1, contra: '' };
    const e = empresaCom(notas);
    const r = conferirConta({ empresa: e, contas: [CONTA], razaoPorConta: { 70: [l] }, cfopGrupo: chave(e), servTipo: null, periodo: filtroDoPeriodo(['2025-12', '2026-01']) });
    expect(r.faltando).toEqual([]);
    expect(r.peloValor.map(p => p.nota.numero)).toEqual(['1']);
    expect(r.somaFiscal).toBe(50);
  });
  it('soDoPeriodo e mesesSemNotas em meses fora de ordem', () => {
    const notas = ['2025-12', '2026-02', '2026-01'].map(comp => ({ comp }));
    expect(soDoPeriodo(notas, ['2026-01', '2025-12']).fora.map(n => n.comp)).toEqual(['2026-02']);
    expect(mesesSemNotas(notas, ['2026-03', '2025-12'])).toEqual(['2026-03']);
  });
});

describe('o mesmo dado em layouts diferentes dá as mesmas notas', () => {
  const dados = [['05/07/2026', '10', '1102', '6', 'FORN A', '100,00'], ['31/12/2025', '11', '1102', '6', 'FORN B', '1.234,56'], ['01/01/2026', '12', '5102', '1', 'CLIENTE', '0,01']];
  const padrao: Linhas = [['Dt. Escritura', 'Número', 'CFOP', 'Lanc', 'Nome Forn/Cliente', 'Valor Contábil'], ...dados];
  const base = lerNotas(padrao);
  const reordenar = (o: number[]) => (rows: Linhas) => rows.map(r => o.map(i => r[i]));
  const LAYOUTS: [string, (rows: Linhas) => Linhas][] = [
    ['colunas invertidas', reordenar([5, 4, 3, 2, 1, 0])],
    ['título e linhas soltas em cima', r => [['Empresa fictícia'], ['Período: 01/2026'], ['Notas por CFOP e valor'], ...r]],
    ['cabeçalho em maiúsculas e sem acento', r => [r[0].map(c => c.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')), ...r.slice(1)]],
    ['colunas extras no meio', r => r.map((l, i) => [l[0], i ? 'x' : 'Filial', ...l.slice(1), i ? '1,00' : 'Valor ICMS'])],
    ['total e subtotal entre as notas', r => [r[0], r[1], ['', '', '1102', '', 'Subtotal', '100,00'], ...r.slice(2), ['', '', 'Total geral', '', '', '9.999,99']]],
    ['cabeçalho repetido no meio', r => [r[0], r[1], r[0], ...r.slice(2)]],
    ['valor com R$', r => [r[0], ...r.slice(1).map(l => [...l.slice(0, 5), 'R$ ' + l[5]])]],
  ];
  it.each(LAYOUTS)('%s', (_, trocar) => {
    expect(lerNotas(trocar(padrao))).toEqual(base);
  });
  it('datas em ISO dão a mesma competência das dd/mm/aaaa', () => {
    const iso = padrao.map((l, i) => (i ? [l[0].split('/').reverse().join('-'), ...l.slice(1)] : l));
    expect(lerNotas(iso)).toEqual(base);
  });
});
