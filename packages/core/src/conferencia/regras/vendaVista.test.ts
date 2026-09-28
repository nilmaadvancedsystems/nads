import { describe, expect, it } from 'vitest';
import { ehCfopVenda, ehVendaVista } from './vendaVista';

describe('ehVendaVista', () => {
  it('CPF (11 dígitos) é à vista', () => {
    expect(ehVendaVista({ nome: 'MARIA', doc: '123.456.789-01' })).toBe(true);
  });
  it('"consumidor final" no nome é à vista, mesmo com CNPJ', () => {
    expect(ehVendaVista({ nome: 'Consumidor Final', doc: '11222333000100' })).toBe(true);
  });
  it('sem nome e sem documento é à vista', () => {
    expect(ehVendaVista({ nome: '', doc: '' })).toBe(true);
    expect(ehVendaVista({ nome: '', doc: '000.000.000-00' })).toBe(true);
  });
  it('CNPJ com nome é a prazo', () => {
    expect(ehVendaVista({ nome: 'MERCADO LTDA', doc: '11.222.333/0001-00' })).toBe(false);
  });
});

describe('ehCfopVenda', () => {
  it('5102 é venda; 5551 (ativo imobilizado) e 1102 não', () => {
    expect(ehCfopVenda({ cfop: '5102' })).toBe(true);
    expect(ehCfopVenda({ cfop: '5551' })).toBe(false);
    expect(ehCfopVenda({ cfop: '1102' })).toBe(false);
  });
  it('bonificação (5910) não é venda; 5405 é', () => {
    expect(ehCfopVenda({ cfop: '5910' })).toBe(false);
    expect(ehCfopVenda({ cfop: '5405' })).toBe(true);
  });
});
