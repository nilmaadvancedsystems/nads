import { describe, expect, it } from 'vitest';
import { conta } from '../__legado__/fixtures';
import { centrosDoPlano, sugestaoDaNatureza } from './sugestaoDeConta';

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
    expect(sugestaoDaNatureza(['5101', '6101', '7101'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '90004' }] });
    expect(sugestaoDaNatureza(['6116'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '90004' }] });
  });
  it('revenda (6102): a conta de vendas de mercadorias de nome mais curto, sem a de produção', () => {
    expect(sugestaoDaNatureza(['6102'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '90001' }] });
  });
  it('simples faturamento da entrega futura (5922): Adiantamento de clientes', () => {
    expect(sugestaoDaNatureza(['5922'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '80001' }] });
  });
  it('remessa em comodato (6908) e outras saídas (5949): não vai para o Contábil', () => {
    expect(sugestaoDaNatureza(['6908'], 'Saída', PLANO)?.tipo).toBe('nao-contabil');
    expect(sugestaoDaNatureza(['5949'], 'Saída', PLANO)?.tipo).toBe('nao-contabil');
  });
  it('bonificação dada (5910) e devolução de compra (5202): as contas de despesa e de devolução', () => {
    expect(sugestaoDaNatureza(['5910'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '70002' }] });
    expect(sugestaoDaNatureza(['5202'], 'Saída', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '70001' }] });
  });
  it('sem a conta de produção no plano: avisa que falta (não cai em Vendas de mercadorias)', () => {
    const s = sugestaoDaNatureza(['5101'], 'Saída', PLANO.filter(c => c.codigo !== '90004'));
    expect(s?.tipo).toBe('falta-conta');
    expect(s?.pede).toBe('Venda de produção do estabelecimento');
  });
  it('devolução de venda na entrada (1202): a dedução da receita; CFOP sem regra: nenhuma sugestão', () => {
    expect(sugestaoDaNatureza(['1202'], 'Entrada', PLANO)).toMatchObject({ tipo: 'conta', contas: [{ codigo: '90005' }] });
    expect(sugestaoDaNatureza(['5929'], 'Saída', PLANO)).toBeNull();
  });
});

// um plano com os centros de custo (cabeçalhos em maiúsculas, como no Alterdata; as contas na ordem do plano)
const comOrdem = (cs: ReturnType<typeof conta>[]) => cs.map((c, i) => ({ ...c, ordem: i }));
const COM_CENTROS = comOrdem([
  conta('60000', 'CUSTOS', 0, 'Despesa'),
  conta('61000', 'CUSTO DOS PRODUTOS VENDIDOS - CPV', 0, 'Despesa'),
  conta('61001', 'Compras Líquidas de Insumos a Prazo', 0, 'Despesa'),
  conta('61002', 'Fretes s/ Insumos', 0, 'Despesa'),
  conta('61003', '(-) Devolução de Compra Líquidas de Insumos', 0, 'Despesa'),
  conta('62000', 'CMV- CUSTOS DAS MERCADORIAS VENDIDAS', 0, 'Despesa'),
  conta('62001', 'Compras de Mercadorias para Revenda à Prazo', 0, 'Despesa'),
  conta('62002', 'Fretes s/ Compras de Mercadorias', 0, 'Despesa'),
  conta('62003', '(-) Devolução de Compras', 0, 'Despesa'),
  conta('63000', 'CUSTO DOS SERVIÇOS PRESTADOS', 0, 'Despesa'),
  conta('63001', 'Materiais Aplicados nos Serviços', 0, 'Despesa'),
  conta('64000', 'DESPESAS COM VENDAS', 0, 'Despesa'),
  conta('64001', 'Bonificação', 0, 'Despesa'),
  conta('64002', 'Fretes s/ Vendas', 0, 'Despesa'),
  conta('65000', 'DESPESAS ADMINISTRATIVAS', 0, 'Despesa'),
  conta('65001', 'Fretes e Carretos', 0, 'Despesa'),
]);

describe('centro de custo: CPV, CMV, CSP e o frete industrial × comercial', () => {
  it('centrosDoPlano: cada conta no centro do cabeçalho de cima; as administrativas fora', () => {
    const c = centrosDoPlano(COM_CENTROS);
    expect([c.get('61002'), c.get('62002'), c.get('63001'), c.get('64001'), c.get('65001')]).toEqual(['CPV', 'CMV', 'CSP', 'vendas', undefined]);
  });
  it('compra de insumos (1101) no CPV e de mercadorias (1102) no CMV', () => {
    expect(sugestaoDaNatureza(['1101', '2101'], 'Entrada', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '61001' }] });
    expect(sugestaoDaNatureza(['1102', '2102'], 'Entrada', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '62001' }] });
  });
  it('frete industrial (1352) no CPV e frete comercial (1353) no CMV, nunca no de vendas ou no administrativo', () => {
    expect(sugestaoDaNatureza(['1352'], 'Entrada', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '61002' }] });
    expect(sugestaoDaNatureza(['2353'], 'Entrada', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '62002' }] });
  });
  it('devolução de compra: 5201 do lado do CPV, 5202 do lado do CMV; bonificação dada nas despesas com vendas', () => {
    expect(sugestaoDaNatureza(['5201'], 'Saída', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '61003' }] });
    expect(sugestaoDaNatureza(['5202'], 'Saída', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '62003' }] });
    expect(sugestaoDaNatureza(['5910'], 'Saída', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '64001' }] });
  });
  it('compra para prestação de serviço (1126) no CSP', () => {
    expect(sugestaoDaNatureza(['1126'], 'Entrada', COM_CENTROS)).toMatchObject({ contas: [{ codigo: '63001' }] });
  });
  it('plano sem o CPV (só comércio): a compra de insumos diz que falta o centro', () => {
    const soComercio = COM_CENTROS.filter(c => !c.codigo.startsWith('61'));
    const s = sugestaoDaNatureza(['1101'], 'Entrada', soComercio);
    expect(s?.tipo).toBe('falta-conta');
    expect(s?.motivo).toContain('nem o centro CPV');
  });
});

describe('as duas contas: à vista e a prazo', () => {
  it('o plano com as compras de insumos à vista e a prazo: a sugestão traz as duas', () => {
    const plano = comOrdem([
      conta('61000', 'CUSTO DOS PRODUTOS VENDIDOS - CPV', 0, 'Despesa'),
      conta('61001', 'Compras de Insumos a Vista', 0, 'Despesa'),
      conta('61002', 'Compras de Insumos a Prazo', 0, 'Despesa'),
      conta('61003', 'Compras P/ Produção a Prazo', 0, 'Despesa'),
    ]);
    expect(sugestaoDaNatureza(['1101'], 'Entrada', plano)?.contas?.map(c => c.codigo)).toEqual(['61001', '61002']);
  });
  it('sem o par, só a conta', () => {
    expect(sugestaoDaNatureza(['1101'], 'Entrada', COM_CENTROS)?.contas?.map(c => c.codigo)).toEqual(['61001']);
  });
});
