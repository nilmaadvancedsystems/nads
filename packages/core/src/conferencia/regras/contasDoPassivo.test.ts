import { describe, expect, it } from 'vitest';
import type { Conta } from '../tipos';
import { avisoPassivo, contasParaVincular, empresaNova } from './empresa';

const conta = (codigo: string, nome: string, grupo: Conta['grupo']) => ({ codigo, nome, valor: 0, dc: 'C', grupo }) as Conta;

describe('o Passivo no vínculo das naturezas (09/11/2026)', () => {
  const e = { ...empresaNova('Teste'), contas: [
    conta('100', 'Adiantamentos de clientes', 'Passivo'),
    conta('101', 'CLIENTES - ADIANT. RECEBIDOS', 'Passivo'),
    conta('102', 'Fornecedores', 'Passivo'),
    conta('103', 'Vendas', 'Receita'),
  ] };

  it('a lista traz o Adiantamento de clientes e deixa de fora o resto do Passivo', () => {
    expect(contasParaVincular(e, [], '').map(a => a.codigo).sort()).toEqual(['100', '101', '103']);
  });

  it('o Adiantamento de clientes não dá o aviso de vínculo errado; o resto do Passivo dá', () => {
    expect(avisoPassivo(e, ['100'])).toBeNull();
    expect(avisoPassivo(e, ['102'])).toContain('102');
  });
});
