import { describe, expect, it } from 'vitest';
import { admissaoDoPedidoDaArea } from './index';

// o texto que a tela da Área monta (textoDaAdmissao); nome e CPF de mentira
const pedido = (extra: Record<string, string> = {}) => {
  const c: Record<string, string> = { 'Nome completo': 'Maria Exemplo', CPF: '529.982.247-25', Cargo: 'Vendedora', 'Salário': 'R$ 2.500,00', 'Início': '01/12/2026', Nascimento: '15/03/1995', PIS: '120.12345.67-8', 'Recebe por': 'Por hora (horista)', Contrato: 'Experiência (45 + 45 dias)', 'Observações': 'Começa às 8h', ...extra };
  return ['Admissão: ' + c['Nome completo'] + ' (' + c.Cargo + ')', '', ...Object.entries(c).filter(([, v]) => v).map(([k, v]) => k + ': ' + v)].join('\n');
};

describe('o pedido de admissão da Área do Cliente vira a admissão do RH NET (25/11/2026)', () => {
  it('lê os campos do texto da tela; a função quando o cargo bate com uma do RH NET', () => {
    const r = admissaoDoPedidoDaArea(pedido(), [{ id: 7, nome: 'VENDEDORA' }]);
    expect(r).toEqual({ admissao: {
      nome: 'Maria Exemplo', cpf: '52998224725', admissao: '2026-12-01', nascimento: '1995-03-15', pis: '12012345678', salario: 2500, funcaoId: 7,
      classe: 0, categoriaEsocial: 101, contratoTipo: 1, experienciaDias: 45, prorrogacaoDias: 45, remuneracao: 2,
      observacao: 'Pedido pela Área do Cliente. Cargo pedido: Vendedora. Contrato: Experiência (45 + 45 dias). Recebe: Por hora (horista). Observações: Começa às 8h',
    }, cidades: {} });
  });

  // (26/11/2026: "aqui os campos necessarios para a pre admissao de um funcionario")
  it('o contrato e o "recebe por" viram a classe, a categoria, o tipo de contrato e o tipo de funcionário do RH NET', () => {
    const de = (extra: Record<string, string>) => { const r = admissaoDoPedidoDaArea(pedido(extra)); if (!('admissao' in r)) throw new Error(r.erro); return r.admissao; };
    expect(de({ Contrato: 'Prazo indeterminado', 'Recebe por': 'Por mês (mensalista)' })).toMatchObject({ classe: 0, categoriaEsocial: 101, contratoTipo: 1, remuneracao: 0 });
    expect(de({ Contrato: 'Prazo indeterminado' }).experienciaDias).toBeUndefined();
    expect(de({ Contrato: 'Estágio' })).toMatchObject({ classe: 2, categoriaEsocial: 901, contratoTipo: null });
    expect(de({ Contrato: 'Aprendiz', 'Recebe por': 'Por dia (diarista)' })).toMatchObject({ categoriaEsocial: 103, contratoTipo: null, remuneracao: 1 });
    expect(de({ 'Recebe por': 'Por comissão' }).remuneracao).toBe(3);
    // o pedido antigo, sem os campos novos, ainda vai (mensalista, sem nascimento)
    expect(de({ Nascimento: '', PIS: '', 'Recebe por': '' })).toMatchObject({ remuneracao: 0 });
    expect(de({ Nascimento: '' }).nascimento).toBeUndefined();
  });

  it('sem a função cadastrada, o cargo fica só na observação', () => {
    const r = admissaoDoPedidoDaArea(pedido());
    expect('admissao' in r && r.admissao.funcaoId).toBeFalsy();
  });

  it('sem CPF, com CPF inválido ou sem a data, não vai (e diz por quê)', () => {
    expect(admissaoDoPedidoDaArea(pedido({ CPF: '' }))).toEqual({ erro: 'o pedido veio sem o CPF (o RH NET exige)' });
    expect(admissaoDoPedidoDaArea(pedido({ CPF: '111.111.111-11' }))).toEqual({ erro: 'o CPF não é válido' });
    expect(admissaoDoPedidoDaArea(pedido({ 'Início': '' }))).toEqual({ erro: 'o pedido veio sem a data de início' });
    expect(admissaoDoPedidoDaArea('qualquer coisa')).toEqual({ erro: 'o pedido veio sem o nome' });
  });
});

// (26/11/2026: "quero verificacao na tela de registro, que nao deixa nem passar") o cadastro completo que o RH NET exige para liberar
describe('o cadastro completo da admissão da Área vai ao RH NET', () => {
  it('lê a pessoa, o documento, o endereço e a jornada; as cidades ficam para o robô achar o código IBGE', async () => {
    const { admissaoDoPedidoDaArea, corpoDaAdmissao, codigoIbgeDaCidade } = await import('./index');
    const r = admissaoDoPedidoDaArea(pedido({
      Sexo: 'Feminino', 'Estado civil': 'Casado(a)', 'Raça/cor': 'Parda', Escolaridade: 'Médio completo', 'Nome da mãe': 'Ana Exemplo',
      'Cidade de nascimento': 'Montes Claros/MG', RG: 'MG-12.345.678', 'Órgão emissor': 'ssp', 'UF do RG': 'mg', 'Emissão do RG': '10/01/2015',
      Celular: '(38) 99876-5432', CEP: '39400-000', 'Tipo de logradouro': 'Avenida', Logradouro: 'Brasil', 'Número': '100', Bairro: 'Centro',
      Cidade: 'Montes Claros/MG', 'Horas por semana': '44', 'Trabalha à noite': 'Não',
    }));
    if (!('admissao' in r)) throw new Error(r.erro);
    expect(r.admissao).toMatchObject({ sexo: 0, estadoCivil: 1, etnia: 3, grauInstrucao: 7, maeNome: 'Ana Exemplo', rg: 'MG-12.345.678', rgOrgao: 'ssp', rgUf: 'MG',
      rgEmissao: '2015-01-10', celular: '38998765432', horasSemana: 44, horarioNoturno: false,
      endereco: { cep: '39400000', logradouroTipo: 2, logradouro: 'Brasil', numero: '100', bairro: 'Centro' } });
    expect(r.cidades).toEqual({ nascimento: { nome: 'Montes Claros', uf: 'MG' }, endereco: { nome: 'Montes Claros', uf: 'MG', cep: '39400000' } });
    const corpo = corpoDaAdmissao(590, { ...r.admissao, nascimentoCidadeIbge: 3143302, endereco: { ...r.admissao.endereco!, cidadeIbge: 3143302 } });
    expect(corpo).toMatchObject({
      sexo: 0, estado_civil_id: 1, etnia_id: 3, grau_instrucao_id: 7, nacionalidade_id: 105, pais_nacionalidade_id: 105, nascimento_cidade_id: 3143302,
      rg_orgao_emissor: 'SSP', rg_uf: 'MG', rg_emissao: '2015-01-10', endereco_cep: '39400-000', endereco_logradouro_id: 2, endereco: 'BRASIL',
      endereco_numero: '100', endereco_bairro: 'CENTRO', endereco_cidade_id: 3143302, hora_semanal: 44, hora_mensal: 220, hora_diaria: 7.33,
      horario_noturno: 0, fgts_ocorrencia_id: 1, forma_pagamento: 0, ddd_celular: '38', celular: '998765432',
    });
    expect(codigoIbgeDaCidade([{ id: 3143302, nome: 'Montes Claros' }, { id: 3100104, nome: 'Abadia dos Dourados' }], 'montes  claros')).toBe(3143302);
    expect(codigoIbgeDaCidade([{ id: 3143302, nome: 'Montes Claros' }], 'Outra')).toBe(0);
  });
});
