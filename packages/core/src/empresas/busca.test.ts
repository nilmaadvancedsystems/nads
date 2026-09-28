import { describe, expect, it } from 'vitest';
import { buscarEmpresas, empresaDoEnter, empresaPelaRota, rotaDaEmpresa, EMPRESAS } from '.';

const L = [
  { codigo: 292, nome: 'FITO INDUSTRIA', regime: 'Presumido' },
  { codigo: 29, nome: 'ALFA 292 LTDA', regime: 'Simples' },
  { codigo: 1292, nome: 'BETA', regime: 'Simples' },
  { codigo: null, nome: 'SEM CÓDIGO LTDA', regime: '' },
];

describe('empresas', () => {
  it('código exato primeiro, depois começa com, depois o resto', () => {
    expect(buscarEmpresas(L, '29').map(x => x.codigo)).toEqual([29, 292, 1292]);
    expect(buscarEmpresas(L, '292').map(x => x.codigo)).toEqual([292, 29, 1292]);
    expect(buscarEmpresas(L, '  ')).toEqual([]);
  });
  it('Enter', () => {
    expect(empresaDoEnter(L, '292')).toBe(L[0]);
    expect(empresaDoEnter(L, 'beta')).toBe(L[2]);
    expect(empresaDoEnter(L, 'ltda')).toBe('varias');
    expect(empresaDoEnter(L, 'xyz')).toBe('nenhuma');
  });
  it('rota pelo código, ou pelo nome sem código', () => {
    expect(rotaDaEmpresa(L[0])).toBe('292');
    expect(rotaDaEmpresa(L[3])).toBe('sem-codigo-ltda');
    expect(empresaPelaRota(L, '292')).toBe(L[0]);
    expect(empresaPelaRota(L, 'sem-codigo-ltda')).toBe(L[3]);
    expect(empresaPelaRota(L, '999')).toBeNull();
  });
  it('a lista do escritório tem as empresas da Conferência', () => {
    expect(EMPRESAS.length).toBeGreaterThan(200);
  });
});
