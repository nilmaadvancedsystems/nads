import { describe, expect, it } from 'vitest';
import { ehCartaoCnpj, lerCartaoCnpj } from './cartaoCnpj';

// um cartão inventado, no formato que o PDF da Receita dá (uma linha por linha da página)
const CARTAO = [
  'REPÚBLICA FEDERATIVA DO BRASIL',
  'CADASTRO NACIONAL DA PESSOA JURÍDICA',
  'NÚMERO DE INSCRIÇÃO DATA DE INSCRIÇÃO NO CNPJ',
  'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO',
  '12.345.678/0001-90 03/02/2025',
  'CADASTRAL',
  'MATRIZ',
  'NOME EMPRESARIAL DATA DE CONSTITUIÇÃO',
  'PADARIA EXEMPLO LTDA 03/02/2025',
  'TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA) PORTE',
  'PAO BOM EPP',
  'CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL',
  '10.91-1-02 - Fabricação de produtos de padaria e confeitaria',
  'CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA',
  '206-2 - Sociedade Empresária Limitada',
  'LOGRADOURO NÚMERO COMPLEMENTO',
  'RUA DAS FLORES 10 ********',
  'CEP BAIRRO/DISTRITO MUNICÍPIO UF',
  '39.550-000 CENTRO TAIOBEIRAS MG',
  'SITUAÇÃO CADASTRAL DATA DA SITUAÇÃO CADASTRAL',
  'ATIVA 03/02/2025',
].join('\n');

describe('cartão CNPJ', () => {
  it('lê o CNPJ, a razão social, a fantasia, a atividade, a UF, a abertura e a situação', () => {
    const d = lerCartaoCnpj(CARTAO);
    expect(d).toMatchObject({
      cnpj: '12345678000190', razaoSocial: 'PADARIA EXEMPLO LTDA', fantasia: 'PAO BOM', cnae: '10.91-1-02',
      cnaeDescricao: 'Fabricação de produtos de padaria e confeitaria', uf: 'MG', abertura: '2025-02-03', situacao: 'ATIVA', regime: '',
    });
  });
  it('a fantasia em asteriscos fica vazia; o MEI mantém o número na razão social, como a Receita', () => {
    const d = lerCartaoCnpj(CARTAO.replace('PADARIA EXEMPLO LTDA', '12.345.678 FULANO DE TAL').replace('PAO BOM EPP', '******** ME'));
    expect(d?.razaoSocial).toBe('12.345.678 FULANO DE TAL');
    expect(d?.fantasia).toBe('');
  });
  it('outro PDF não é cartão CNPJ', () => {
    expect(ehCartaoCnpj('DOCUMENTO DE ARRECADAÇÃO 12.345.678/0001-90')).toBe(false);
    expect(lerCartaoCnpj('qualquer coisa')).toBeNull();
  });
});
