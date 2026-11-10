import { describe, expect, it } from 'vitest';
import { nomeDoResponsavelDoDp, planilhaDasConfiguracoesDoDp, type ClienteDaPlanilhaDoDp } from './configuracoesDoDp';

const obrigacoes = [
  { id: 'recibos', nome: 'Recibos de pagamento' },
  { id: 'folha', nome: 'Folha de pagamento' },
  { id: 'x-ferias', nome: 'Aviso de férias' },
];

const cliente = (m: Partial<ClienteDaPlanilhaDoDp> = {}): ClienteDaPlanilhaDoDp => ({
  codigo: 462, nome: '3M EMPREENDIMENTOS FLORESTAIS LTDA', documento: '45.430.962/0001-19', enquadramento: 'Simples',
  responsavel: 'NILMA', movimento: 'Pró-Labore', obrigacoes: ['recibos', 'folha'], reinfAutorizada: true,
  entrega: 'eContador', agrupamento: 'GRUPO FORESTRY DILMA', mudado: false, ...m,
});

describe('DP › Configurações em Excel', () => {
  it('o cabeçalho: os dados do cliente, uma coluna por obrigação (na ordem dada) e os parâmetros', () => {
    const { cabecalho } = planilhaDasConfiguracoesDoDp([], obrigacoes);
    expect(cabecalho).toEqual(['Cód.', 'Cliente', 'CNPJ/CPF', 'Enquadramento', 'Responsável', 'Movimento',
      'Recibos de pagamento', 'Folha de pagamento', 'Aviso de férias', 'REINF autorizada', 'Entrega', 'Agrupamento', 'Mudado no nads']);
  });

  it('cada obrigação vira Sim ou Não, inclusive a categoria criada no nads', () => {
    const { linhas } = planilhaDasConfiguracoesDoDp([cliente({ obrigacoes: ['folha', 'x-ferias'], mudado: true })], obrigacoes);
    expect(linhas[0]).toEqual([462, '3M EMPREENDIMENTOS FLORESTAIS LTDA', '45.430.962/0001-19', 'Simples', 'Nilma', 'Pró-Labore',
      'Não', 'Sim', 'Sim', 'Sim', 'eContador', 'GRUPO FORESTRY DILMA', 'Sim']);
  });

  it('sem CNPJ, sem responsável, sem agrupamento e sem REINF: as células ficam vazias ou Não', () => {
    const { linhas } = planilhaDasConfiguracoesDoDp([cliente({ documento: '', responsavel: '', agrupamento: '', reinfAutorizada: false, obrigacoes: [] })], obrigacoes);
    expect(linhas[0]).toEqual([462, '3M EMPREENDIMENTOS FLORESTAIS LTDA', '', 'Simples', 'Sem responsável', 'Pró-Labore',
      'Não', 'Não', 'Não', 'Não', 'eContador', '', 'Não']);
  });

  it('as linhas seguem a ordem recebida (a da tela)', () => {
    const { linhas } = planilhaDasConfiguracoesDoDp([cliente({ codigo: 515, nome: 'A7 MOBILE LTDA' }), cliente()], obrigacoes);
    expect(linhas.map(l => l[0])).toEqual([515, 462]);
  });

  it('o nome do responsável como se escreve', () => {
    expect(nomeDoResponsavelDoDp('FABIANA')).toBe('Fabiana');
    expect(nomeDoResponsavelDoDp('GUSTAVO.P')).toBe('Gustavo.P');
    expect(nomeDoResponsavelDoDp('')).toBe('Sem responsável');
  });
});
