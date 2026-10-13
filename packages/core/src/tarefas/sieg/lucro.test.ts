import { describe, expect, it } from 'vitest';
import type { NotasSieg } from './index';
import { creditosDoMes, icmsDoMes, irpjCsll, mesesDoTrimestre, pisCofins, receitaParaIrpj, receitasDoMes, temImpostosNoXml } from './lucro';

const eu = { doc: '11222333000181', nome: 'EU' };
const outro = { doc: '44555666000172', nome: 'OUTRO' };
const x: NotasSieg = {
  codigo: '1', competencia: '2026-09', em: '', pasta: '', arquivos: 0, novos: 0, resumo: 2,
  emitidas: [
    { tipo: 'NF-e', chave: 'A', numero: '1', serie: '1', data: '', emitente: eu, destinatario: outro, valor: 1500, itens: [
      { ncm: '21069090', cfop: '5102', cst: '000', cest: '', valor: 1000, icms: 180, cstPis: '01' },
      { ncm: '22021000', cfop: '5405', cst: '060', cest: '', valor: 500, cstPis: '04' },
    ] },
    { tipo: 'NF-e', chave: 'B', numero: '2', serie: '1', data: '', emitente: eu, destinatario: outro, valor: 100, itens: [
      { ncm: '21069090', cfop: '1202', cst: '000', cest: '', valor: 100, icms: 18 },
    ] },
    { tipo: 'NF-e', chave: 'C', numero: '3', serie: '1', data: '', emitente: eu, destinatario: outro, valor: 900, cancelada: true, itens: [
      { ncm: '21069090', cfop: '5102', cst: '000', cest: '', valor: 900, icms: 162 },
    ] },
    { tipo: 'NFS-e', chave: '', numero: '7', serie: '', data: '', emitente: eu, destinatario: outro, valor: 2000, retencoes: [{ imposto: 'IRRF', valor: 30 }, { imposto: 'CSLL', valor: 20 }, { imposto: 'PIS', valor: 13 }, { imposto: 'COFINS', valor: 60 }] },
  ],
  recebidas: [
    { tipo: 'NF-e', chave: 'D', numero: '9', serie: '1', data: '', emitente: outro, destinatario: eu, valor: 800, itens: [
      { ncm: '21069090', cfop: '6102', cst: '000', cest: '', valor: 600, icms: 72 },
      { ncm: '30049099', cfop: '6102', cst: '000', cest: '', valor: 200 },
    ] },
    { tipo: 'CT-e', chave: 'E', numero: '5', serie: '1', data: '', emitente: outro, destinatario: eu, valor: 50 },
  ],
};

describe('o Presumido e o Real pelos XMLs (13/10/2026)', () => {
  it('a receita do mês: vendas, devoluções, sem PIS/COFINS, ICMS destacado, serviços e retidos', () => {
    const r = receitasDoMes(x);
    expect(r).toEqual({ mercadorias: 1500, devolucoes: 100, semPisCofins: 500, icmsDestacado: 180, servicos: 2000, retidos: { irrf: 30, csll: 20, pis: 13, cofins: 60 } });
    expect(temImpostosNoXml(x)).toBe(true);
    expect(temImpostosNoXml({ ...x, resumo: undefined })).toBe(false);
  });
  it('PIS/COFINS: cumulativo no Presumido; no Real, com os créditos das compras (sem monofásico e sem ICMS) e dos fretes', () => {
    const r = receitasDoMes(x);
    // base = 1500 − 100 − 500 − 180 + 2000 = 2720
    const p = pisCofins('Presumido', r);
    expect(p.base).toBe(2720);
    expect(p.debito).toEqual({ pis: 17.68, cofins: 81.6 });
    expect(p.aPagar).toEqual({ pis: 4.68, cofins: 21.6 });
    const c = creditosDoMes(x);
    expect(c).toEqual({ compras: 528, monofasicos: 200, fretes: 50, base: 578 });
    const real = pisCofins('Real', r, c);
    expect(real.debito).toEqual({ pis: 44.88, cofins: 206.72 });
    expect(real.credito).toEqual({ pis: 9.54, cofins: 43.93 });
    expect(real.aPagar).toEqual({ pis: 22.34, cofins: 102.79 });
  });
  it('ICMS: débitos das saídas, créditos das compras e das devoluções, menos o saldo anterior', () => {
    const i = icmsDoMes(x, 10);
    expect(i).toMatchObject({ debitos: 180, creditos: 90, saldoAnterior: 10, aPagar: 80, saldoCredor: 0, notasDeCompra: 1 });
    expect(icmsDoMes(x, 200).saldoCredor).toBe(110);
  });
  it('IRPJ/CSLL do trimestre: presunção, adicional acima de R$ 60 mil, retidos e cotas', () => {
    const m = (c: string, merc: number, serv: number) => ({ competencia: c, mercadorias: merc, servicos: serv, irrf: 100, csll: 50 });
    const t = irpjCsll([m('2026-07', 300000, 50000), m('2026-08', 300000, 50000), m('2026-09', 300000, 50000)], { mercadorias: 'comercio', servicos: 'servicos' });
    // base IRPJ = 900000 × 8% + 150000 × 32% = 120000; CSLL = 900000 × 12% + 150000 × 32% = 156000
    expect(t.base).toEqual({ irpj: 120000, csll: 156000 });
    expect([t.irpj, t.adicional, t.csll]).toEqual([18000, 6000, 14040]);
    expect(t.aPagar).toEqual({ irpj: 23700, csll: 13890 });
    expect(t.cotas).toEqual({ irpj: 3, csll: 3 });
    expect(t.acimaDaLc224).toBe(false);
    expect(receitaParaIrpj('2026-09', receitasDoMes(x))).toEqual({ competencia: '2026-09', mercadorias: 1400, servicos: 2000, irrf: 30, csll: 20 });
    expect(mesesDoTrimestre('2026-09')).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(mesesDoTrimestre('2026-10')).toEqual([]);
  });
});
