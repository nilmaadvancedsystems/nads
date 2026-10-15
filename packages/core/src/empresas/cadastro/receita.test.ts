import { describe, expect, it } from 'vitest';
import { cnpjFormatado, cnpjValido, dadosDaReceita } from './receita';

describe('o cadastro pelo CNPJ (13/10/2026)', () => {
  it('confere os dígitos do CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
    expect(cnpjFormatado('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('lê a resposta da Receita: o nome, a situação e o regime (Simples, MEI ou fora)', () => {
    const base = { cnpj: '11222333000181', razao_social: 'Empresa Teste Ltda', nome_fantasia: 'TESTE', descricao_situacao_cadastral: 'ATIVA',
      cnae_fiscal: 4711302, cnae_fiscal_descricao: 'Comércio varejista', municipio: 'MONTES CLAROS', uf: 'mg', data_inicio_atividade: '2020-01-02' };
    expect(dadosDaReceita({ ...base, opcao_pelo_simples: true, opcao_pelo_mei: false })).toEqual({
      cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE LTDA', fantasia: 'TESTE', situacao: 'ATIVA', regime: 'Simples',
      cnae: '4711-3/02', cnaeDescricao: 'Comércio varejista', municipio: 'MONTES CLAROS', uf: 'MG', abertura: '2020-01-02', endereco: null,
    });
    // o endereço para a nota fiscal (15/10/2026: tomador CNPJ exige o endereço nacional, E1358)
    expect(dadosDaReceita({ ...base, codigo_municipio_ibge: 3143302, cep: '39400-001', descricao_tipo_de_logradouro: 'RUA', logradouro: 'Dom Pedro II', numero: '120', bairro: 'Centro' })?.endereco)
      .toEqual({ cMun: '3143302', cep: '39400001', logradouro: 'RUA DOM PEDRO II', numero: '120', bairro: 'CENTRO' });
    expect(dadosDaReceita({ ...base, codigo_municipio_ibge: 3143302, cep: '39400001', logradouro: 'RUA DOM PEDRO II', numero: '' })?.endereco)
      .toEqual({ cMun: '3143302', cep: '39400001', logradouro: 'RUA DOM PEDRO II', numero: 'S/N', bairro: 'CENTRO' });
    expect(dadosDaReceita({ ...base, opcao_pelo_simples: true, opcao_pelo_mei: true })?.regime).toBe('MEI');
    expect(dadosDaReceita({ ...base, opcao_pelo_simples: false })?.regime).toBe('');
    expect(dadosDaReceita({ message: 'CNPJ não encontrado' })).toBeNull();
  });
});
