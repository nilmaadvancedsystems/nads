// Combinações da ferramenta Cheque especial (semente fixa, sem dado de cliente): leitura do saldo, fechamento do dia e
// ajuste + estorno.
import { describe, expect, it } from 'vitest';
import type { DiaSaldo } from '../tipos';
import { gerarLancamentos, resumoDoAjuste } from './lancamentos';
import { numeroDoTexto, saldoDaCelula } from './saldo';
import { saldosDeFechamento } from './saldosDiarios';
import { dataDaCelula } from './datas';

function sorteador(semente: number) {
  let s = semente >>> 0;
  const n = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { n, ate: (m: number) => Math.floor(n() * m) };
}
const br = (c: number) => { const s = String(c).padStart(3, '0'); return s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s.slice(-2); };
const VALORES = [1, 10, 99, 100, 101, 12345, 100000, 123456789, 999999999];

describe('numeroDoTexto e saldoDaCelula', () => {
  const r = sorteador(3);
  const lista = [...VALORES, ...Array.from({ length: 300 }, () => 1 + r.ate(10 ** (1 + r.ate(9))))];
  const negativos: ((s: string) => string)[] = [s => '-' + s, s => s + '-', s => '(' + s + ')', s => '- ' + s, s => s + ' -', s => '-R$ ' + s, s => '- R$ ' + s, s => 'R$ -' + s, s => 'R$ (' + s + ')', s => '−' + s, s => '−R$ ' + s];
  it('todo jeito de escrever o negativo', () => {
    for (const c of lista) for (const f of negativos) expect(numeroDoTexto(f(br(c))), f(br(c))).toBeCloseTo(-c / 100, 6);
  });
  it('o saldo com sufixo C/D, com e sem inverter, sem erro de centavo', () => {
    for (const c of lista) {
      expect(saldoDaCelula(br(c) + ' C', false)).toBe(c / 100);
      expect(saldoDaCelula(br(c) + 'D', false)).toBe(-c / 100);
      expect(saldoDaCelula(br(c) + ' C', true)).toBe(-c / 100);
      expect(saldoDaCelula(br(c) + ' d', true)).toBe(c / 100);
      expect(saldoDaCelula(c / 100, false)).toBe(c / 100);
      expect(saldoDaCelula(-c / 100, true)).toBe(c / 100);
    }
  });
  it('zero nunca é negativo; texto sem número ignora a linha', () => {
    for (const v of ['0,00', '0,00 D', '-0,00', 0, -0]) expect(Object.is(saldoDaCelula(v, false), 0), String(v)).toBe(true);
    for (const v of ['abc', '', null, undefined, 'Total', '1-2', NaN, Infinity]) expect(saldoDaCelula(v, false)).toBeNull();
  });
});

describe('dataDaCelula: texto da exportação', () => {
  const iso = (d: Date | null) => (d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null);
  it('dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa e aaaa-mm-dd (com hora ou não)', () => {
    for (const s of ['05/01/2026', '05-01-2026', '05.01.2026', '2026-01-05', '2026-01-05T10:00:00', '05/01/2026 10:00', '5/1/26']) expect(iso(dataDaCelula(s)), s).toBe('2026-01-05');
  });
  it('número escrito não vira data', () => {
    for (const s of ['1.234,56', '500,00', 'Total']) expect(dataDaCelula(s), s).toBeNull();
  });
});

describe('saldo de fechamento do dia', () => {
  const cols = { linhaCabecalho: 0, colData: 0, colSaldo: 1 };
  const cab = ['Data', 'Saldo'];
  it('crescente: vale a última linha do dia; decrescente: a primeira (a mais nova vem em cima)', () => {
    const cres = [cab, ['05/01/2026', 100], ['05/01/2026', -50], ['06/01/2026', 10], ['06/01/2026', 0]];
    const decr = [cab, ['06/01/2026', 0], ['06/01/2026', 10], ['05/01/2026', -50], ['05/01/2026', 100]];
    const ver = (l: unknown[][]) => saldosDeFechamento(l, cols, false).map(x => x.saldo);
    expect(ver(cres)).toEqual([-50, 0]);
    expect(ver(decr)).toEqual([-50, 0]);
  });
  it('uma linha por dia: a ordem do relatório não importa', () => {
    const r = sorteador(9);
    for (let s = 0; s < 40; s++) {
      const dias = Array.from({ length: 20 }, (_, i) => [String(i + 1).padStart(2, '0') + '/01/2026', (r.n() < 0.5 ? -1 : 1) * (1 + r.ate(100000)) / 100]);
      expect(saldosDeFechamento([cab, ...dias.slice().reverse()], cols, false)).toEqual(saldosDeFechamento([cab, ...dias], cols, false));
    }
  });
});

describe('gerarLancamentos', () => {
  const dia = (d: number, m = 1, a = 2026) => new Date(a, m - 1, d);
  it('ajuste + estorno somam zero, dia negativo a dia negativo, com virada de mês e de ano', () => {
    const r = sorteador(21);
    for (let s = 0; s < 80; s++) {
      const inicio = [dia(25, 12, 2025), dia(25, 1), dia(25, 2, 2024), dia(26, 2)][s % 4];
      const dias: DiaSaldo[] = Array.from({ length: 12 }, (_, i) => ({ data: new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i), saldo: r.n() < 0.15 ? 0 : (r.n() < 0.5 ? -1 : 1) * (1 + r.ate(9999999)) / 100 }));
      const res = gerarLancamentos(dias, 'B', 'C', '92029');
      const aj = res.lancamentos.filter(l => l.tipo === 'Ajuste'), es = res.lancamentos.filter(l => l.tipo === 'Estorno');
      expect(aj.length).toBe(es.length);
      expect(aj.length).toBe(dias.filter(d => d.saldo < 0).length);
      aj.forEach((a, i) => {
        expect(es[i].valor).toBe(a.valor);
        expect([a.debito, a.credito, es[i].debito, es[i].credito]).toEqual(['B', 'C', 'C', 'B']);
        expect(es[i].data.getTime()).toBeGreaterThan(a.data.getTime());
      });
      expect(res.projetado).toBe(dias[dias.length - 1].saldo < 0);
      expect(resumoDoAjuste(res, dias).diasNegativos).toBe(aj.length);
    }
  });
  it('o último dia negativo cai numa sexta: o estorno projetado vai para a segunda', () => {
    const r = gerarLancamentos([{ data: dia(30), saldo: -10 }], 'B', 'C', 'H');
    expect(r.lancamentos[1].data).toEqual(dia(2, 2));
    expect(r.projetado).toBe(true);
  });
});
