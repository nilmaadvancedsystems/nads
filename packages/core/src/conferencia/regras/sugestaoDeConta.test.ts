import { describe, expect, it } from 'vitest';
import { conta } from '../__legado__/fixtures';
import { sugestaoDaNatureza } from './sugestaoDeConta';

// um plano de exemplo (os nomes do escritório; os códigos são inventados)
const PLANO = [
  conta('90001', 'Vendas de Mercadorias', 0, 'Receita', 'C'),
  conta('90002', 'Vendas de Mercadorias do Estabelecimento', 0, 'Receita', 'C'),
  conta('90004', 'Venda de Produção do Estabelecimento', 0, 'Receita', 'C'),
  conta('90005', '(-) Devoluções de Vendas de Produtos', 0, 'Receita', 'D'),
  conta('80001', 'Adiantamentos de clientes', 0, 'Passivo', 'C'),
  conta('70001', '( - ) Devoluções de Compras de Merc a Vista/Prazo', 0, 'Despesa', 'C'),
  conta('70002', 'Bonificação', 0, 'Despesa', 'D'),
];

describe('sugestaoDaNatureza', () => {
  it('venda de produção (5101, 6116 a entrega da encomenda): a conta de venda de produção do plano', () => {
    expect(sugestaoDaNatureza(['5101', '6101', '7101'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '90004' } });
    expect(sugestaoDaNatureza(['6116'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '90004' } });
  });
  it('revenda (6102): a conta de vendas de mercadorias de nome mais curto, sem a de produção', () => {
    expect(sugestaoDaNatureza(['6102'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '90001' } });
  });
  it('simples faturamento da entrega futura (5922): Adiantamento de clientes', () => {
    expect(sugestaoDaNatureza(['5922'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '80001' } });
  });
  it('remessa em comodato (6908) e outras saídas (5949): não vai para o Contábil', () => {
    expect(sugestaoDaNatureza(['6908'], 'Saída', PLANO)?.tipo).toBe('nao-contabil');
    expect(sugestaoDaNatureza(['5949'], 'Saída', PLANO)?.tipo).toBe('nao-contabil');
  });
  it('bonificação dada (5910) e devolução de compra (5202): as contas de despesa e de devolução', () => {
    expect(sugestaoDaNatureza(['5910'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '70002' } });
    expect(sugestaoDaNatureza(['5202'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '70001' } });
  });
  it('sem a conta de produção no plano: avisa que falta (não cai em Vendas de mercadorias)', () => {
    const s = sugestaoDaNatureza(['5101'], 'Saída', PLANO.filter(c => c.codigo !== '90004'));
    expect(s?.tipo).toBe('falta-conta');
    expect(s?.pede).toBe('Venda de produção do estabelecimento');
  });
  it('devolução de venda na entrada (1202): a dedução da receita; CFOP sem regra: nenhuma sugestão', () => {
    expect(sugestaoDaNatureza(['1202'], 'Entrada', PLANO)).toMatchObject({ tipo: 'conta', conta: { codigo: '90005' } });
    expect(sugestaoDaNatureza(['5929'], 'Saída', PLANO)).toBeNull();
  });
});
