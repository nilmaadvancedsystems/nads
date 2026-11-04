import { describe, expect, it } from 'vitest';
import { codigosDosParagrafos, paragrafosDoDocumento } from './codigosDoSimples';

// o bloco de uma empresa como vem do relatório em Word (números inventados)
const xml = '<w:document><w:body>'
  + '<w:p><w:r><w:t xml:space="preserve">Empresa: Padaria Exemplo LTDA      </w:t></w:r><w:r><w:t>Código: 1234</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>End: Rua A, Nº 1 – Centro</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>CNPJ: 11.222.333/0001-44</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>CPF do responsável: 123.456.789-01      Código de Acesso: 987654321098</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>Empresa: Sem Código &amp; Cia      Código: 77</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>CNPJ: 99.888.777/0001-66</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>CPF do responsável: 111.222.333-44      Código de Acesso: </w:t></w:r></w:p>'
  + '</w:body></w:document>';

describe('os códigos de acesso do Simples dos relatórios em Word', () => {
  it('junta os <w:t> de cada parágrafo e desfaz o &amp;', () => {
    const ps = paragrafosDoDocumento(xml);
    expect(ps).toHaveLength(7);
    expect(ps[0]).toBe('Empresa: Padaria Exemplo LTDA      Código: 1234');
    expect(ps[4]).toContain('Sem Código & Cia');
  });
  it('tira o código, o CNPJ, o CPF e o código de acesso de cada empresa', () => {
    const r = codigosDosParagrafos(paragrafosDoDocumento(xml));
    expect(r.itens).toEqual([{ empresa: 'Padaria Exemplo LTDA', codigo: 1234, cnpj: '11222333000144', cpf: '12345678901', acesso: '987654321098' }]);
    expect(r.semCodigo).toEqual(['Sem Código & Cia']);
  });
  it('a mesma empresa em dois relatórios fica uma só', () => {
    const ps = paragrafosDoDocumento(xml).slice(0, 4);
    expect(codigosDosParagrafos([...ps, ...ps]).itens).toHaveLength(1);
  });
});
