import { describe, expect, it } from 'vitest';
import { gruposDaNota, ratear, rateioDoCte, rateioDosNcms, repartir, tributacaoDoItem, valoresDaNota } from './rateio';
import type { NotaDoSieg } from './index';

const pessoa = { doc: '11111111000111', nome: 'X' };
const nfe = (itens: NotaDoSieg['itens'], extra: Partial<NotaDoSieg> = {}): NotaDoSieg => ({ tipo: 'NF-e', chave: 'k', numero: '1', serie: '1', data: '05/10/2026', emitente: pessoa, destinatario: pessoa, valor: 0, itens, ...extra });

describe('o Rateio de frete (a planilha RATEIO - FRETE, 22/10/2026)', () => {
  it('bate com a planilha: produtos 1.000, frete 500; 2102 = 600 (60%, frete 300) e 2403 = 400 (40%, frete 200)', () => {
    const r = ratear({ total: 1000, frete: 500, desconto: 0, linhas: [{ rotulo: '2102', valor: 600 }, { rotulo: '2403', valor: 400 }] });
    expect(r.linhas.map(l => [l.rotulo, l.pct, l.frete, l.base])).toEqual([['2102', 60, 300, 900], ['2403', 40, 200, 600]]);
    expect(r.soma).toMatchObject({ valor: 1000, pct: 100, frete: 500, base: 1500 });
    expect(r.foraDaLista).toBeNull();
  });
  it('bate com a segunda parte: o frete do COMPL. ST (200) pelos NCMs, sobre o total de 400; base = valor + IPI + frete', () => {
    const r = ratear({ total: 400, frete: 200, linhas: [{ rotulo: '39241000', valor: 200 }, { rotulo: '69120000', valor: 10 }, { rotulo: '70134900', valor: 100 }] });
    expect(r.linhas.map(l => [l.pct, l.frete])).toEqual([[50, 100], [2.5, 5], [25, 50]]);
    expect(r.linhas[0].base).toBe(300);
    // o que não está na lista (90 de 400) fica com o resto do frete
    expect(r.foraDaLista).toEqual({ valor: 90, frete: 45, desconto: 0 });
  });
  it('o desconto se reparte igual e entra na base', () => {
    const r = ratear({ total: 1000, frete: 500, desconto: 100, linhas: [{ rotulo: 'A', valor: 600, ipi: 30 }, { rotulo: 'B', valor: 400 }] });
    expect(r.linhas.map(l => [l.desconto, l.base])).toEqual([[60, 870], [40, 560]]);
    expect(r.soma.base).toBe(1430);
  });
  it('sem diferença de centavo: 100,00 de frete em três partes iguais', () => {
    const r = ratear({ frete: 100, desconto: 0.01, linhas: [{ rotulo: 'A', valor: 1 }, { rotulo: 'B', valor: 1 }, { rotulo: 'C', valor: 1 }] });
    expect(r.linhas.map(l => l.frete)).toEqual([33.34, 33.33, 33.33]);
    expect(r.soma.frete).toBe(100);
    expect(r.soma.desconto).toBe(0.01);
  });
  it('repartir: a soma é sempre o total, os restos maiores levam os centavos', () => {
    expect(repartir(10, [1, 2])).toEqual([3.33, 6.67]);
    expect(repartir(0.05, [0, 0])).toEqual([0, 0]);
    const p = repartir(1234.57, [17.3, 0.01, 999.99, 3.33, 41]);
    expect(Math.round(p.reduce((t, x) => t + x, 0) * 100)).toBe(123457);
  });
  it('a tributação do item: ST, monofásico (como no Simples), isento, outras e tributado', () => {
    expect(tributacaoDoItem({ cst: '060', cfop: '5405', ncm: '21069090' })).toBe('st');
    expect(tributacaoDoItem({ cst: '102', cfop: '2403', ncm: '63026000' })).toBe('st');
    expect(tributacaoDoItem({ cst: '500', cfop: '5405', ncm: '22021000' })).toBe('monofasico-st');
    expect(tributacaoDoItem({ cst: '000', cfop: '5102', ncm: '40111000' })).toBe('monofasico');
    expect(tributacaoDoItem({ cst: '040', cfop: '5102', ncm: '07019000' })).toBe('isento');
    expect(tributacaoDoItem({ cst: '300', cfop: '5102', ncm: '07019000' })).toBe('isento');
    expect(tributacaoDoItem({ cst: '090', cfop: '5102', ncm: '07019000' })).toBe('outras');
    expect(tributacaoDoItem({ cst: '102', cfop: '5102', ncm: '63026000' })).toBe('tributado');
    expect(tributacaoDoItem({ cst: '000', cfop: '2102', ncm: '39241000' })).toBe('tributado');
  });
  it('a nota do SIEG: os grupos pela tributação ou pelo CFOP, e o frete pelos NCMs do grupo', () => {
    const n = nfe([
      { ncm: '39241000', cfop: '2102', cst: '000', cest: '', valor: 600 },
      { ncm: '39241000', cfop: '2403', cst: '010', cest: '', valor: 200, ipi: 10 },
      { ncm: '69120000', cfop: '2403', cst: '010', cest: '', valor: 200 },
    ], { valor: 1510, frete: 500, desconto: 0 });
    expect(valoresDaNota(n)).toEqual({ total: 1000, frete: 500, desconto: 0, estimado: false });
    const g = gruposDaNota(n);
    expect(g.map(x => [x.rotulo, x.detalhe, x.valor, x.ipi])).toEqual([['Tributado', '2102', 600, 0], ['ICMS-ST', '2403', 400, 10]]);
    expect(gruposDaNota(n, 'cfop').map(x => [x.rotulo, x.detalhe])).toEqual([['2102', 'Tributado'], ['2403', 'ICMS-ST']]);
    const r = ratear({ total: 1000, frete: 500, linhas: g });
    expect(r.linhas.map(l => l.frete)).toEqual([300, 200]);
    const d = rateioDosNcms(g[1], 200, 0);
    expect(d.linhas.map(l => [l.rotulo, l.frete, l.base])).toEqual([['39241000', 100, 310], ['69120000', 100, 300]]);
  });
  it('o resumo antigo (sem o frete): estima pela diferença do valor da nota', () => {
    expect(valoresDaNota(nfe([{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 100, st: 5 }], { valor: 117.5 }))).toEqual({ total: 100, frete: 12.5, desconto: 0, estimado: true });
    expect(valoresDaNota(nfe([{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 100 }], { valor: 90 }))).toEqual({ total: 100, frete: 0, desconto: 10, estimado: true });
    expect(valoresDaNota(nfe([{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 100 }], { valor: 100 })).estimado).toBe(false);
  });
  it('pelo CT-e: o valor dele pelas NF-e que transporta e pelas tributações dos itens, fechando no centavo', () => {
    const a = nfe([{ ncm: '39241000', cfop: '2102', cst: '000', cest: '', valor: 600 }], { chave: 'A', numero: '10' });
    const b = nfe([{ ncm: '39241000', cfop: '2403', cst: '010', cest: '', valor: 300, ipi: 10 }, { ncm: '69120000', cfop: '2403', cst: '010', cest: '', valor: 100 }], { chave: 'B', numero: '11' });
    const r = rateioDoCte({ valor: 500 }, [a, b]);
    expect(r.notas.map(n => [n.numero, n.produtos, n.pct, n.frete])).toEqual([['10', 600, 60, 300], ['11', 400, 40, 200]]);
    expect(r.rateio.linhas.map(l => [l.rotulo, l.frete, l.base])).toEqual([['Tributado', 300, 900], ['ICMS-ST', 200, 610]]);
    expect(r.rateio.soma.frete).toBe(500);
    // um valor que não divide certo
    const x = rateioDoCte({ valor: 100 }, [a, b, nfe([{ ncm: '1', cfop: '2102', cst: '000', cest: '', valor: 333.33 }], { chave: 'C' })], 'tributacao', 100.01);
    expect(Math.round(x.notas.reduce((t, n) => t + n.frete, 0) * 100)).toBe(10001);
    expect(x.rateio.soma.frete).toBe(100.01);
  });
});
