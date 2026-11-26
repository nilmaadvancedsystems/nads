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
    } });
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
