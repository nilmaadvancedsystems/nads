import { describe, expect, it } from 'vitest';
import { conta, empresa, nota } from '../__legado__/fixtures';
import { FILTRO_MOVIMENTO_VAZIO } from '../tipos';
import { agruparTotaisPorNatureza, comTipo } from './cfop';
import { contasForaDoBalancete, gruposConciliacao, linhasDoSaldo, nomeComumContas, podeConferir, quaisMarcarSozinho, saldoDasContas, situacaoDaConta, type EntradaSituacao } from './conciliacao';
import { periodoKey } from './periodo';

const base: EntradaSituacao = { somaNotas: 100, saldo: 100, revisao: null, conferidoManual: false, podeConferir: false };

describe('situacaoDaConta', () => {
  it('soma das notas abaixo de 0,005 = soma zero', () => {
    expect(situacaoDaConta({ ...base, somaNotas: 0.004, saldo: 50 }).tipo).toBe('soma-zero');
  });
  it('sem saldo = fora do balancete', () => {
    expect(situacaoDaConta({ ...base, saldo: null }).tipo).toBe('fora-do-balancete');
  });
  it('diferença menor que 1 centavo = ok', () => {
    expect(situacaoDaConta({ ...base, saldo: 99.995 }).tipo).toBe('ok');
    expect(situacaoDaConta({ ...base, saldo: 99.98 }).tipo).toBe('diferenca');
  });
  it('revisão ok vence a diferença', () => {
    expect(situacaoDaConta({ ...base, saldo: 90, revisao: 'ok' })).toEqual({ tipo: 'ok-pela-revisao', diferenca: 10 });
  });
  it('conferido só quando a conta pode ser conferida', () => {
    expect(situacaoDaConta({ ...base, saldo: 90, conferidoManual: true, podeConferir: true }).tipo).toBe('conferido');
    expect(situacaoDaConta({ ...base, saldo: 90, revisao: 'conferido', podeConferir: true }).tipo).toBe('conferido');
    expect(situacaoDaConta({ ...base, saldo: 90, conferidoManual: true, podeConferir: false })).toEqual({ tipo: 'diferenca', diferenca: 10 });
  });
});

describe('gruposConciliacao', () => {
  it('naturezas que dividem conta somam juntas; uma natureza com duas contas', () => {
    const e = empresa({ naturezaConta: { A: ['1'], B: ['1', '2'], C: ['3'], D: ['2'] } });
    expect(gruposConciliacao(e, ['A', 'B', 'C', 'D', 'X'])).toEqual([
      { naturezas: ['A', 'B', 'D'], contas: ['1', '2'] },
      { naturezas: ['C'], contas: ['3'] },
    ]);
  });
});

describe('nomeComumContas', () => {
  it('à prazo / à vista viram o nome comum', () => {
    expect(nomeComumContas(['Compras de Mercadorias à Prazo', 'Compras de Mercadorias à Vista'])).toBe('Compras de Mercadorias');
  });
  it('plural não atrapalha; nomes diferentes ou um só = null', () => {
    expect(nomeComumContas(['Compra de Mercadoria a prazo', 'Compras de Mercadorias à vista'])).toBe('Compra de Mercadoria');
    expect(nomeComumContas(['Fretes', 'Compras'])).toBeNull();
    expect(nomeComumContas(['Compras'])).toBeNull();
  });
});

describe('podeConferir', () => {
  const e = empresa({ contas: [conta('31105', 'Energia Elétrica'), conta('66015', 'Fretes e Carretos')] });
  it('energia elétrica sim, fretes não', () => {
    expect(podeConferir(e, ['31105'])).toBe(true);
    expect(podeConferir(e, ['66015'])).toBe(false);
  });
  it('a descrição da natureza também conta', () => {
    expect(podeConferir(e, ['66015'], ['Locação de sistemas'])).toBe(true);
  });
});

describe('quaisMarcarSozinho', () => {
  const e = empresa({
    contas: [conta('66005', 'Compras', 30), conta('31122', 'Uso e Consumo', 5), conta('66015', 'Fretes', 99)],
    entradas: [nota('1102', '6', 10, '1'), nota('1403', '6', 20, '2'), nota('1556', '215', 5, '3'), nota('1353', '14', 7, '4')],
    naturezaConta: { 'Compra para comercialização': ['66005'], 'Uso e Consumo': ['31122'], 'Frete Comercial (entrada)': ['66015'] },
  });
  const g = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas));
  const pk = periodoKey(FILTRO_MOVIMENTO_VAZIO);
  it('marca só o que bate com o balancete', () => {
    const r = quaisMarcarSozinho(e, g, Object.keys(g), FILTRO_MOVIMENTO_VAZIO);
    expect(r.map(x => x.chave).sort()).toEqual([pk + '||Compra para comercialização', pk + '||Uso e Consumo']);
    expect(r.find(x => x.chave.endsWith('Compra para comercialização'))?.texto).toBe('1102, 1403 — Compra para comercialização');
  });
  it('respeita os recusados e os já marcados', () => {
    const e2 = { ...e, confAutoRecusados: [pk + '||Uso e Consumo'], confMarcados: [pk + '||Compra para comercialização'] };
    expect(quaisMarcarSozinho(e2, g, Object.keys(g), FILTRO_MOVIMENTO_VAZIO)).toEqual([]);
  });
  it('Ok pela revisão também marca (a 2910 da 292)', () => {
    const e2 = { ...e, verifConta: { [pk + '||66015']: 'ok' as const } };
    expect(quaisMarcarSozinho(e2, g, Object.keys(g), FILTRO_MOVIMENTO_VAZIO).map(x => x.chave)).toContain(pk + '||Frete Comercial (entrada)');
  });
  it('sem balancete não marca nada', () => {
    expect(quaisMarcarSozinho({ ...e, contas: [] }, g, Object.keys(g), FILTRO_MOVIMENTO_VAZIO)).toEqual([]);
  });
});

describe('contas somadas com uma fora do balancete (ex.: 70002 + 70006)', () => {
  const COMPRA = 'Compra para comercialização';
  // a 70002 está no Cadastro mas não veio no balancete lido
  const e = empresa({
    contas: [conta('70006', 'Compras de Mercadorias a Prazo', 290890.5)],
    entradas: [nota('1102', '6', 290890.5, '100')],
    naturezaConta: { [COMPRA]: ['70002', '70006'] },
  });
  it('soma só as contas que estão no balancete', () => {
    expect(saldoDasContas(e, ['70002', '70006'])).toBe(290890.5);
    expect(contasForaDoBalancete(e, ['70002', '70006'])).toEqual(['70002']);
  });
  it('nenhuma no balancete: continua "fora do balancete"', () => {
    expect(saldoDasContas(e, ['70002'])).toBeNull();
  });
  it('a linha do Relatório confere com o saldo da que está no balancete', () => {
    const grupos = agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas));
    const [l] = linhasDoSaldo(e, grupos, Object.keys(grupos), FILTRO_MOVIMENTO_VAZIO, '');
    expect(l.saldo).toBe(290890.5);
    expect(l.contasFora).toEqual(['70002']);
    expect(l.situacao.tipo).toBe('ok');
  });
});
