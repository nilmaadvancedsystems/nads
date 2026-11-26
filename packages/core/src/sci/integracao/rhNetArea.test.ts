import { describe, expect, it } from 'vitest';
import { cadastroParaArea, cadastrosParaArea, cpfMascarado } from './index';

// a admissão completa como o RH NET devolve (só os campos que importam aqui; nomes, CPF e valores de mentira)
const socio = { funcionario_contribuinte_id: 15, nome: 'JOSE  DA SILVA', cpf: '529.982.247-25', tipo_colaborador: 'contribuinte', categoria_esocial_id: 723, entrada_data: '2026-02-01', situacao: 'integrado', salario_base: 5000, v_funcao_id: 1 };
const novo = { funcionario_contribuinte_id: 99, nome: 'MARIA EXEMPLO', cpf: '52998224725', tipo_colaborador: 'funcionario', admissao_data: '2026-12-01', situacao: 'nao_liberado', v_funcao_id: 9 };

describe('RH NET na Área do Cliente (25/11/2026)', () => {
  it('mascara o CPF como a Área', () => {
    expect(cpfMascarado('529.982.247-25')).toBe('***.982.247-**');
    expect(cpfMascarado('123')).toBe('');
  });

  it('o sócio do pró-labore: sem salário, com a situação em português simples', () => {
    const c = cadastroParaArea(socio, new Map([[1, 'Sócio']]));
    expect(c).toEqual({ id: 'rh15', nome: 'JOSE DA SILVA', cpf: '***.982.247-**', tipo: 'Sócio – pró-labore', entrada: '2026-02-01', situacao: 'Na folha' });
    expect(JSON.stringify(c)).not.toMatch(/5000|salario/);
  });

  it('o funcionário: a função pelo cadastro, senão "Funcionário"; o não liberado aguarda o escritório', () => {
    expect(cadastroParaArea(novo, new Map([[9, 'Auxiliar administrativo']]))).toMatchObject({ tipo: 'Auxiliar administrativo', entrada: '2026-12-01', situacao: 'Aguardando o escritório' });
    expect(cadastroParaArea(novo)?.tipo).toBe('Funcionário');
  });

  it('o desligado e o torto não vão; a lista sai em ordem de nome, sem repetir', () => {
    expect(cadastroParaArea({ ...novo, desligamento_data: '2026-12-10' })).toBeNull();
    expect(cadastroParaArea({ nome: 'sem id' })).toBeNull();
    expect(cadastrosParaArea([novo, socio, socio]).map(c => c.id)).toEqual(['rh15', 'rh99']);
  });
});

describe('os cargos da empresa no RH NET para a admissão da Área (26/11/2026)', () => {
  it('sem repetir (nem por maiúscula), em ordem, sem vazio', async () => {
    const { cargosParaArea } = await import('./index');
    expect(cargosParaArea([{ nome: 'Vendedor' }, { nome: '  Auxiliar   administrativo ' }, { nome: 'VENDEDOR' }, { nome: '' }])).toEqual(['Auxiliar administrativo', 'Vendedor']);
    expect(cargosParaArea(null)).toEqual([]);
  });
});
