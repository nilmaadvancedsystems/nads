import { describe, expect, it } from 'vitest';
import { contasGovDasLinhas, cpfMascarado, idDaContaGov } from './planilha';

describe('a planilha de senhas gov.br', () => {
  const linhas = [
    ['Lista de Senhas Cadastradas', 'Lista de Senhas Cadastradas'],
    [],
    ['ID', '', 'Cidadão', '', '', 'CPF', 'Senha', 'Observações', '', 'Nível'],
    ['1', '', 'FULANA DE TAL', '', '', '123.456.789-01', 'senha-a', 'mãe', 'do sócio', 'Prata'],
    ['2', '', 'SEM SENHA', '', '', '98765432100', '', '', '', 'Bronze'],
    ['3', '', 'CPF ERRADO', '', '', '12', 'x', '', '', ''],
    ['4', '', 'FULANA DE TAL', '', '', '12345678901', 'senha-b', '', '', 'Ouro'],
    ['5', '', 'BELTRANO', '', '', '1234567890', 'senha-c', '', '', 'Bronze'],
  ];
  it('acha o cabeçalho, pula sem CPF ou sem senha e fica com a última de cada CPF', () => {
    const r = contasGovDasLinhas(linhas);
    expect(r.erro).toBeUndefined();
    expect(r.ignoradas).toBe(2);
    expect(r.contas.map(c => [c.nome, c.cpf, c.senha, c.nivel])).toEqual([
      ['BELTRANO', '01234567890', 'senha-c', 'Bronze'],
      ['FULANA DE TAL', '12345678901', 'senha-b', 'Ouro'],
    ]);
  });
  it('sem as colunas CPF e Senha, avisa', () => {
    expect(contasGovDasLinhas([['a', 'b'], ['1', '2']]).erro).toMatch(/CPF e Senha/);
  });
  it('o id não mostra o CPF e é sempre o mesmo para o mesmo CPF', async () => {
    const a = await idDaContaGov('123.456.789-01');
    expect(a).toBe(await idDaContaGov('12345678901'));
    expect(a).not.toContain('12345678901');
    expect(cpfMascarado('12345678901')).toBe('***.***.789-01');
  });
});
