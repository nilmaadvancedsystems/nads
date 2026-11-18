// A ficha cadastral da empresa na Área do Cliente (plano do Acessórias, 17/11/2026, ficha dados-cadastrais).
import { describe, expect, it } from 'vitest';
import { fichaDoCliente } from './ficha';

const RECEITA = { razaoSocial: 'PADARIA BOA LTDA', cnae: '1091102', cnaeDescricao: 'Fabricação de produtos de padaria', abertura: '2015-03-02',
  endereco: 'RUA A, 10, CENTRO, TAIOBEIRAS/MG', socios: ['MARIA SOUZA', 'JOAO SILVA'], situacao: 'ATIVA' };
const CLIENTE = { documento: '12.345.678/0001-90', nomeFantasia: 'Padaria Boa', inscricaoEstadual: '0012345678', receita: RECEITA, cpf: '12345678901' };

describe('a ficha da empresa', () => {
  it('monta a ficha só com a lista branca', () => {
    expect(fichaDoCliente(CLIENTE, 'Simples')).toEqual({
      razaoSocial: 'PADARIA BOA LTDA', nomeFantasia: 'Padaria Boa', cnpj: '12345678000190', inscricaoEstadual: '0012345678', regime: 'Simples',
      cnae: '1091-1/02 - Fabricação de produtos de padaria', abertura: '2015-03-02', endereco: 'RUA A, 10, CENTRO, TAIOBEIRAS/MG',
      socios: [{ nome: 'MARIA SOUZA' }, { nome: 'JOAO SILVA' }],
    });
  });
  it('nunca leva CPF: o sócio com número fica de fora; nem situação, nem outro campo', () => {
    const f = fichaDoCliente({ ...CLIENTE, receita: { ...RECEITA, socios: ['MARIA SOUZA', '***123456** JOAO'] } }, 'Simples')!;
    expect(f.socios).toEqual([{ nome: 'MARIA SOUZA' }]);
    expect(JSON.stringify(f)).not.toContain('12345678901');
    expect(Object.keys(f)).not.toContain('situacao');
  });
  it('pessoa física (CPF) e cliente sem o retrato da Receita não têm ficha', () => {
    expect(fichaDoCliente({ ...CLIENTE, documento: '123.456.789-01' }, 'Física')).toBeNull();
    expect(fichaDoCliente({ ...CLIENTE, receita: null }, 'Simples')).toBeNull();
    expect(fichaDoCliente(null, 'Simples')).toBeNull();
  });
  it('o nome fantasia igual à razão social não repete; IE isento vira "Isento"', () => {
    const f = fichaDoCliente({ ...CLIENTE, nomeFantasia: 'padaria boa ltda', inscricaoEstadual: 'ISENTO' }, 'Simples')!;
    expect(f.nomeFantasia).toBeUndefined();
    expect(f.inscricaoEstadual).toBe('Isento');
  });
});
