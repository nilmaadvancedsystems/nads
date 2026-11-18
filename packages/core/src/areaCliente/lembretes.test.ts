// O lembrete de vencimento ao cliente (plano do Acessórias, 17/11/2026, ficha lembrete-de-vencimento). Datas fixas.
import { describe, expect, it } from 'vitest';
import type { GuiaDoCliente } from './guias';
import { diasDoLembrete, emailDoLembrete, guiasParaLembrar, lembreteDaEmpresa } from './lembretes';

const guia = (id: string, vencimento: string, mais: Partial<GuiaDoCliente> = {}): GuiaDoCliente =>
  ({ id, tipo: 'DAS', competencia: '2026-10', vencimento, valor: 100, situacao: 'a vencer', temPdf: true, ...mais });
const DIAS = [2, 1, 0];

describe('as guias para lembrar', () => {
  it('nos dias de antecedência, só as não abertas; a vencida não', () => {
    const terca = new Date(2026, 10, 17);
    const guias = [guia('a', '19/11/2026'), guia('b', '18/11/2026'), guia('c', '17/11/2026'), guia('d', '23/11/2026'), guia('e', '16/11/2026'), guia('f', '19/11/2026')];
    expect(guiasParaLembrar(guias, terca, DIAS, new Set(['f'])).map(g => g.id)).toEqual(['c', 'b', 'a']);
  });
  it('na sexta, também o que vence no fim de semana e na segunda', () => {
    const sexta = new Date(2026, 10, 13);
    const guias = [guia('sab', '14/11/2026'), guia('dom', '15/11/2026'), guia('seg', '16/11/2026'), guia('ter', '17/11/2026')];
    expect(guiasParaLembrar(guias, sexta, DIAS, new Set()).map(g => g.id)).toEqual(['sab', 'dom', 'seg']);
  });
  it('antes de feriado, até o próximo dia útil (20/11 é feriado: na quinta 19, também a do dia 23)', () => {
    const quinta = new Date(2026, 10, 19);
    expect(guiasParaLembrar([guia('seg', '23/11/2026'), guia('ter', '24/11/2026')], quinta, [0], new Set()).map(g => g.id)).toEqual(['seg']);
  });
  it('no fim de semana e no feriado não manda', () => {
    expect(guiasParaLembrar([guia('a', '16/11/2026')], new Date(2026, 10, 14), DIAS, new Set())).toEqual([]);
    expect(guiasParaLembrar([guia('a', '23/11/2026')], new Date(2026, 10, 20), DIAS, new Set())).toEqual([]);
  });
  it('os dias do ajuste', () => {
    expect(diasDoLembrete(2)).toEqual([2, 1, 0]);
    expect(diasDoLembrete(0)).toEqual([0]);
    expect(diasDoLembrete(99)).toHaveLength(11);
  });
  it('o e-mail: assunto, as guias e o link', () => {
    const e = emailDoLembrete('Padaria X', [guia('a', '19/11/2026', { tipo: 'DARF', tributo: 'INSS', valor: 655.3 })], 'https://cliente/x');
    expect(e.assunto).toBe('Guia vencendo - Padaria X');
    expect(e.texto).toContain('- DARF INSS: vence em 19/11/2026 (R$');
    expect(e.texto).toContain('https://cliente/x');
    expect(emailDoLembrete('P', [guia('a', '19/11/2026'), guia('b', '20/11/2026')], 'l').assunto).toBe('2 guias vencendo - P');
  });
});

// a escolha de cada empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente")
describe('o lembrete de cada empresa', () => {
  const geral = { ligado: false, dias: [2, 1, 0] };
  it('como o escritório, mandar e não mandar', () => {
    expect(lembreteDaEmpresa(undefined, geral)).toEqual({ ligado: false, dias: [2, 1, 0] });
    expect(lembreteDaEmpresa(undefined, { ...geral, ligado: true })).toEqual({ ligado: true, dias: [2, 1, 0] });
    expect(lembreteDaEmpresa({ modo: 'sim' }, geral)).toEqual({ ligado: true, dias: [2, 1, 0] });
    expect(lembreteDaEmpresa({ modo: 'sim', diasAntes: 1 }, geral)).toEqual({ ligado: true, dias: [1, 0] });
    expect(lembreteDaEmpresa({ modo: 'nao' }, { ...geral, ligado: true }).ligado).toBe(false);
  });
});

// a paga não lembra (ficha guia-paga-confirmada, 18/11/2026)
describe('o lembrete e a guia paga', () => {
  it('a guia paga pelo extrato não entra no lembrete', () => {
    const g = { id: 'das-2026-10-58', tipo: 'DAS' as const, competencia: '2026-10', vencimento: '20/11/2026', valor: 10, situacao: 'a vencer' as const, temPdf: true };
    const hoje = new Date(2026, 10, 17, 9, 0);
    expect(guiasParaLembrar([g], hoje, [3], new Set()).map(x => x.id)).toEqual(['das-2026-10-58']);
    expect(guiasParaLembrar([{ ...g, pagoEm: '16/11/2026' }], hoje, [3], new Set())).toEqual([]);
  });
});
