import type { areaCliente as ac } from '@nads/core';
import { describe, expect, it } from 'vitest';
import {
  bateNaBusca, comunicadosDoFiltro, empresasAlcancadas, empresasParaEscolher, filtroInicial, filtrosDosComunicados,
  periodoDoComunicado, regimesDasEmpresas, rotuloDoAlvo, situacaoDoComunicado, tipoDoAlvo,
} from './comunicadosDaArea';

const com = (id: string, publicarEm: string, ate: string, alvo: ac.AlvoDoComunicado = { todos: true }): ac.Comunicado =>
  ({ id, titulo: 'Aviso ' + id, texto: 'Texto do ' + id, alvo, publicarEm, ate, por: 'Vitor', atualizadoEm: '2026-11-20T10:00:00.000Z' });

const HOJE = '2026-11-26';
const lista = [
  com('a', '2026-11-01', '2026-11-30'), // no ar
  com('b', '2026-11-20', '2026-12-10'), // no ar, mais novo
  com('c', '2026-12-15', '2027-01-02'), // agendado
  com('d', '2026-12-01', '2026-12-05'), // agendado, entra antes
  com('e', '2026-10-01', '2026-10-31'), // encerrado
];

const EMPRESAS = [
  { codigo: 292, nome: 'Padaria São João', regime: 'Simples' },
  { codigo: 515, nome: 'A7 Mobile Ltda', regime: 'Presumido' },
  { codigo: 600, nome: 'Açougue Bom Corte', regime: 'Simples' },
  { codigo: null, nome: 'Sem código', regime: 'MEI' },
];

describe('a situação do comunicado', () => {
  it('agendado antes do início, no ar entre as datas (inclusive) e encerrado depois do fim', () => {
    expect(situacaoDoComunicado({ publicarEm: '2026-11-27', ate: '2026-12-01' }, HOJE)).toBe('agendado');
    expect(situacaoDoComunicado({ publicarEm: HOJE, ate: HOJE }, HOJE)).toBe('no ar');
    expect(situacaoDoComunicado({ publicarEm: '2026-11-01', ate: '2026-11-25' }, HOJE)).toBe('encerrado');
  });
});

describe('os filtros', () => {
  it('contam cada situação e o total', () => {
    expect(filtrosDosComunicados(lista, HOJE).map(f => [f.valor, f.conta])).toEqual([['no-ar', 2], ['agendados', 2], ['encerrados', 1], ['todos', 5]]);
  });
  it('abrem em No ar quando há algum; senão em Todos', () => {
    expect(filtroInicial(lista, HOJE)).toBe('no-ar');
    expect(filtroInicial([lista[4]], HOJE)).toBe('todos');
  });
  it('ordenam: no ar o mais novo primeiro, agendados o próximo primeiro, e Todos por situação', () => {
    expect(comunicadosDoFiltro(lista, 'no-ar', HOJE).map(c => c.id)).toEqual(['b', 'a']);
    expect(comunicadosDoFiltro(lista, 'agendados', HOJE).map(c => c.id)).toEqual(['d', 'c']);
    expect(comunicadosDoFiltro(lista, 'todos', HOJE).map(c => c.id)).toEqual(['b', 'a', 'd', 'c', 'e']);
  });
});

describe('o texto da lista', () => {
  it('o período em datas brasileiras', () => {
    expect(periodoDoComunicado('2026-12-01', '2027-01-02')).toBe('01/12/2026 – 02/01/2027');
    expect(periodoDoComunicado('2026-12-01', '2026-12-01')).toBe('01/12/2026');
  });
  it('o Para quem', () => {
    expect(rotuloDoAlvo({ todos: true })).toBe('Todos os clientes');
    expect(rotuloDoAlvo({ regimes: ['Simples', 'MEI'] })).toBe('Simples, MEI');
    expect(rotuloDoAlvo({ codigos: [292] }, c => (c === 292 ? 'Padaria São João' : undefined))).toBe('Padaria São João');
    expect(rotuloDoAlvo({ codigos: [999] })).toBe('Empresa 999');
    expect(rotuloDoAlvo({ codigos: [1, 2, 3] })).toBe('3 empresas');
    expect(tipoDoAlvo({ regimes: [] })).toBe('regimes');
  });
  it('a busca olha título, texto e quem publicou, sem acento', () => {
    expect(bateNaBusca(lista[0], 'aviso A')).toBe(true);
    expect(bateNaBusca(lista[0], 'vitor')).toBe(true);
    expect(bateNaBusca(lista[0], 'recesso')).toBe(false);
  });
});

describe('o alvo pelas empresas', () => {
  it('os regimes saem das empresas, sem repetir, mais os já marcados', () => {
    expect(regimesDasEmpresas(EMPRESAS)).toEqual(['MEI', 'Presumido', 'Simples']);
    expect(regimesDasEmpresas(EMPRESAS, ['Real'])).toEqual(['MEI', 'Presumido', 'Real', 'Simples']);
  });
  it('conta as empresas alcançadas', () => {
    expect(empresasAlcancadas({ todos: true }, EMPRESAS)).toBe(3);
    expect(empresasAlcancadas({ regimes: ['Simples'] }, EMPRESAS)).toBe(2);
    expect(empresasAlcancadas({ codigos: [292, 292, 515] }, EMPRESAS)).toBe(2);
  });
  it('o seletor busca por nome ou código, sem acento, e tira as já escolhidas', () => {
    expect(empresasParaEscolher(EMPRESAS, '', [])).toEqual([]);
    expect(empresasParaEscolher(EMPRESAS, 'acougue', []).map(e => e.codigo)).toEqual([600]);
    expect(empresasParaEscolher(EMPRESAS, '515', []).map(e => e.codigo)).toEqual([515]);
    expect(empresasParaEscolher(EMPRESAS, 'a', [515], 10).map(e => e.codigo)).toEqual([292, 600]);
  });
});
