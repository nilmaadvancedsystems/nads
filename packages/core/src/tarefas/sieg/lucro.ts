// O Lucro Presumido e o Lucro Real pelos XMLs (Vitor, 13/10/2026: "agora monte a rotina do lucro presumido e real"). Puro:
// a tela só desenha. É PRÉVIA para conferir: o que vale é a escrituração no Alterdata, a EFD e a DCTFWeb.
//   - receitasDoMes: a receita de mercadorias (os itens de venda das notas emitidas), as devoluções, a parte sem PIS/COFINS
//     (CST 04 a 09 do PIS; sem o CST, pelo NCM monofásico), o ICMS destacado (sai da base do PIS/COFINS, Tema 69 do STF),
//     os serviços (NFS-e emitidas) e o que os tomadores retiveram.
//   - creditosDoMes (só no Real): as compras das notas recebidas (pelo CFOP de venda do fornecedor), sem os monofásicos e
//     sem o ICMS (Lei 14.592/2023), e os fretes (CT-e).
//   - pisCofins: cumulativo no Presumido (0,65% e 3%), não cumulativo no Real (1,65% e 7,6%, menos os créditos).
//   - icmsDoMes: os débitos (o ICMS destacado nas saídas), os créditos (compras, devoluções e as entradas emitidas pela
//     empresa), o ST retido (substituto) e o IPI.
//   - irpjCsll: a presunção (8% / 12% mercadorias, 32% serviços, ou a da atividade) sobre a receita, o IRPJ de 15% com o
//     adicional de 10% (acima de R$ 20 mil por mês) e a CSLL de 9%, menos o que foi retido. No Presumido, o trimestre; no
//     Real, a estimativa do mês.
import { grupoMonofasico } from './simples';
import type { ItemDoXml, NotaDoSieg, NotasSieg } from './index';

const centavos = (v: number) => Math.round(v * 100) / 100;
const vivas = (l: readonly NotaDoSieg[]) => l.filter(n => !n.cancelada);
const mercadoria = (n: NotaDoSieg) => n.tipo === 'NF-e' || n.tipo === 'NFC-e';

/** CFOP de venda (receita; e, numa nota recebida, a compra): saída 5/6/7, grupos 1xx e 4xx. */
export const ehVenda = (cfop: string) => /^[567](1(0[1-9]|1\d|2[0-5])|40[1-5])$/.test(String(cfop || ''));
/** Devolução de venda: a nota de entrada da empresa (1/2/3) ou a nota do cliente que devolve (5/6). */
const devolucaoNaEmitida = (cfop: string) => /^[123](20[12]|41[01])$/.test(String(cfop || ''));
const devolucaoNaRecebida = (cfop: string) => /^[56](20[12]|41[01])$/.test(String(cfop || ''));
/** CST do PIS sem a contribuição: monofásico (04), ST (05), alíquota zero (06), isenção (07), sem incidência (08), suspensão (09). */
const CST_PIS_SEM = ['04', '05', '06', '07', '08', '09'];
const semPisCofins = (it: ItemDoXml) => (it.cstPis ? CST_PIS_SEM.includes(it.cstPis) : !!grupoMonofasico(it.ncm));

/** O resumo dos XMLs é o novo (com o ICMS de cada item)? Os antigos não têm: baixe de novo. */
export const temImpostosNoXml = (x: Pick<NotasSieg, 'resumo' | 'itensCortados'> | null | undefined) => !!x && (x.resumo || 1) >= 2 && !x.itensCortados;

export interface ReceitasDoMes {
  /** os itens de venda das notas emitidas */
  mercadorias: number;
  /** as devoluções de venda (saem da receita) */
  devolucoes: number;
  /** a parte da receita sem PIS/COFINS (monofásico, ST, alíquota zero, isenta…) */
  semPisCofins: number;
  /** o ICMS destacado nos itens com PIS/COFINS (sai da base) */
  icmsDestacado: number;
  /** as NFS-e emitidas */
  servicos: number;
  /** o que os tomadores retiveram nas NFS-e emitidas */
  retidos: { irrf: number; csll: number; pis: number; cofins: number };
}

export function receitasDoMes(x: NotasSieg | null): ReceitasDoMes {
  const r: ReceitasDoMes = { mercadorias: 0, devolucoes: 0, semPisCofins: 0, icmsDestacado: 0, servicos: 0, retidos: { irrf: 0, csll: 0, pis: 0, cofins: 0 } };
  if (!x) return r;
  for (const n of vivas(x.emitidas)) {
    if (n.tipo === 'NFS-e') {
      r.servicos += Number(n.valor) || 0;
      for (const rt of n.retencoes || []) {
        const k = ({ IRRF: 'irrf', CSLL: 'csll', PIS: 'pis', COFINS: 'cofins' } as Record<string, 'irrf' | 'csll' | 'pis' | 'cofins'>)[rt.imposto];
        if (k) r.retidos[k] += Number(rt.valor) || 0;
      }
      continue;
    }
    if (!mercadoria(n)) continue;
    for (const it of n.itens || []) {
      if (ehVenda(it.cfop)) {
        r.mercadorias += it.valor;
        if (semPisCofins(it)) r.semPisCofins += it.valor;
        else r.icmsDestacado += it.icms || 0;
      } else if (devolucaoNaEmitida(it.cfop)) r.devolucoes += it.valor;
    }
  }
  for (const n of vivas(x.recebidas)) {
    if (!mercadoria(n)) continue;
    for (const it of n.itens || []) if (devolucaoNaRecebida(it.cfop)) r.devolucoes += it.valor;
  }
  return {
    mercadorias: centavos(r.mercadorias), devolucoes: centavos(r.devolucoes), semPisCofins: centavos(r.semPisCofins),
    icmsDestacado: centavos(r.icmsDestacado), servicos: centavos(r.servicos),
    retidos: { irrf: centavos(r.retidos.irrf), csll: centavos(r.retidos.csll), pis: centavos(r.retidos.pis), cofins: centavos(r.retidos.cofins) },
  };
}

export interface CreditosDoMes {
  /** as compras (itens com CFOP de venda do fornecedor), sem os monofásicos e sem o ICMS */
  compras: number;
  /** as compras de monofásicos (sem crédito na revenda) */
  monofasicos: number;
  /** os fretes (CT-e recebidos): dão crédito quando são da compra ou da venda */
  fretes: number;
  /** compras + fretes */
  base: number;
}

export function creditosDoMes(x: NotasSieg | null): CreditosDoMes {
  let compras = 0, monofasicos = 0, fretes = 0;
  for (const n of vivas(x?.recebidas || [])) {
    if (n.tipo === 'CT-e') { fretes += Number(n.valor) || 0; continue; }
    if (!mercadoria(n)) continue;
    for (const it of n.itens || []) {
      if (!ehVenda(it.cfop)) continue;
      if (grupoMonofasico(it.ncm)) monofasicos += it.valor;
      else compras += it.valor - (it.icms || 0);
    }
  }
  return { compras: centavos(compras), monofasicos: centavos(monofasicos), fretes: centavos(fretes), base: centavos(compras + fretes) };
}

export type RegimeDoLucro = 'Presumido' | 'Real';
export const ALIQUOTAS_PIS_COFINS: Record<RegimeDoLucro, { pis: number; cofins: number }> = {
  Presumido: { pis: 0.65, cofins: 3 },
  Real: { pis: 1.65, cofins: 7.6 },
};

export interface PisCofins {
  regime: RegimeDoLucro;
  /** a base: mercadorias − devoluções − sem PIS/COFINS − ICMS destacado, mais os serviços */
  base: number;
  aliquotas: { pis: number; cofins: number };
  debito: { pis: number; cofins: number };
  /** no Real: os créditos das entradas (zero no Presumido) */
  credito: { pis: number; cofins: number };
  retido: { pis: number; cofins: number };
  /** o DARF (nunca negativo) e o saldo credor que fica para o mês seguinte (Real) */
  aPagar: { pis: number; cofins: number };
  saldoCredor: { pis: number; cofins: number };
}

export function pisCofins(regime: RegimeDoLucro, r: ReceitasDoMes, creditos?: CreditosDoMes | null): PisCofins {
  const a = ALIQUOTAS_PIS_COFINS[regime];
  const base = centavos(Math.max(0, r.mercadorias - r.devolucoes - r.semPisCofins - r.icmsDestacado) + r.servicos);
  const de = (pct: number, v: number) => centavos((v * pct) / 100);
  const debito = { pis: de(a.pis, base), cofins: de(a.cofins, base) };
  const credito = regime === 'Real' && creditos ? { pis: de(a.pis, creditos.base), cofins: de(a.cofins, creditos.base) } : { pis: 0, cofins: 0 };
  const retido = { pis: r.retidos.pis, cofins: r.retidos.cofins };
  const liquido = (k: 'pis' | 'cofins') => centavos(debito[k] - credito[k] - retido[k]);
  return {
    regime, base, aliquotas: a, debito, credito, retido,
    aPagar: { pis: Math.max(0, liquido('pis')), cofins: Math.max(0, liquido('cofins')) },
    saldoCredor: { pis: Math.max(0, -liquido('pis')), cofins: Math.max(0, -liquido('cofins')) },
  };
}

export interface IcmsDoMes {
  debitos: number;
  /** compras (o ICMS destacado pelo fornecedor), devoluções de venda e as entradas emitidas pela empresa */
  creditos: number;
  saldoAnterior: number;
  /** o ICMS a recolher (nunca negativo) e o saldo credor para o mês seguinte */
  aPagar: number;
  saldoCredor: number;
  /** o ICMS-ST retido nas saídas (a empresa como substituta): guia própria */
  stRetido: number;
  /** o IPI das saídas e o das compras (só a indústria apura) */
  ipiSaidas: number; ipiEntradas: number;
  /** as notas de compra que entraram no crédito: uso e consumo e ativo não dão crédito direto (confira) */
  notasDeCompra: number;
}

export function icmsDoMes(x: NotasSieg | null, saldoAnterior = 0): IcmsDoMes {
  let debitos = 0, creditos = 0, st = 0, ipiS = 0, ipiE = 0, notasDeCompra = 0;
  for (const n of vivas(x?.emitidas || [])) {
    if (!mercadoria(n)) continue;
    for (const it of n.itens || []) {
      if (/^[567]/.test(it.cfop)) { debitos += it.icms || 0; st += it.st || 0; ipiS += it.ipi || 0; }
      else creditos += it.icms || 0;
    }
  }
  for (const n of vivas(x?.recebidas || [])) {
    if (!mercadoria(n)) continue;
    let compra = false;
    for (const it of n.itens || []) {
      if (ehVenda(it.cfop) || devolucaoNaRecebida(it.cfop)) { creditos += it.icms || 0; ipiE += it.ipi || 0; compra = true; }
    }
    if (compra) notasDeCompra++;
  }
  const saldo = centavos(debitos - creditos - saldoAnterior);
  return {
    debitos: centavos(debitos), creditos: centavos(creditos), saldoAnterior: centavos(saldoAnterior),
    aPagar: Math.max(0, saldo), saldoCredor: Math.max(0, -saldo),
    stRetido: centavos(st), ipiSaidas: centavos(ipiS), ipiEntradas: centavos(ipiE), notasDeCompra,
  };
}

// ---------- IRPJ e CSLL ----------

/** As presunções (art. 15 e 20 da Lei 9.249/1995): o IRPJ e a CSLL de cada atividade. */
export const PRESUNCOES = [
  { id: 'comercio', rotulo: 'Comércio e indústria', irpj: 8, csll: 12 },
  { id: 'combustivel', rotulo: 'Revenda de combustíveis', irpj: 1.6, csll: 12 },
  { id: 'servicos', rotulo: 'Serviços em geral', irpj: 32, csll: 32 },
  { id: 'carga', rotulo: 'Transporte de carga e serviços hospitalares', irpj: 8, csll: 12 },
  { id: 'passageiros', rotulo: 'Transporte de passageiros', irpj: 16, csll: 12 },
] as const;
export type Presuncao = (typeof PRESUNCOES)[number]['id'];
const presuncao = (id: Presuncao) => PRESUNCOES.find(p => p.id === id) || PRESUNCOES[0];

/** A receita de um mês para o IRPJ/CSLL (o que a rotina guarda em cada mês). */
export interface ReceitaParaIrpj { competencia: string; mercadorias: number; servicos: number; irrf: number; csll: number }

/** O que guardar do mês: as mercadorias (sem as devoluções), os serviços e o IRRF/CSLL retidos. */
export const receitaParaIrpj = (competencia: string, r: ReceitasDoMes): ReceitaParaIrpj => ({
  competencia, mercadorias: centavos(Math.max(0, r.mercadorias - r.devolucoes)), servicos: r.servicos, irrf: r.retidos.irrf, csll: r.retidos.csll,
});

export interface IrpjCsll {
  meses: number;
  receita: { mercadorias: number; servicos: number; outras: number };
  base: { irpj: number; csll: number };
  irpj: number; adicional: number; csll: number;
  retido: { irpj: number; csll: number };
  aPagar: { irpj: number; csll: number };
  /** no Presumido: em até 3 cotas (cada uma de pelo menos R$ 1.000; abaixo de R$ 2.000, cota única) */
  cotas: { irpj: number; csll: number };
  /** a receita passou de R$ 1,25 milhão por trimestre (R$ 5 milhões no ano): a LC 224/2025 aumenta a presunção */
  acimaDaLc224: boolean;
}

/**
 * O IRPJ e a CSLL dos meses (o trimestre no Presumido; o mês na estimativa do Real): a presunção de cada parte, o IRPJ de
 * 15% mais o adicional de 10% acima de R$ 20 mil por mês, a CSLL de 9%, menos o retido. "outras" (as receitas
 * financeiras e os ganhos) entram inteiras na base.
 */
export function irpjCsll(meses: readonly ReceitaParaIrpj[], ativ: { mercadorias: Presuncao; servicos: Presuncao }, outras = 0): IrpjCsll {
  const soma = (k: 'mercadorias' | 'servicos' | 'irrf' | 'csll') => centavos(meses.reduce((s, m) => s + (m[k] || 0), 0));
  const merc = soma('mercadorias'), serv = soma('servicos');
  const pm = presuncao(ativ.mercadorias), ps = presuncao(ativ.servicos);
  const baseIr = centavos((merc * pm.irpj) / 100 + (serv * ps.irpj) / 100 + outras);
  const baseCs = centavos((merc * pm.csll) / 100 + (serv * ps.csll) / 100 + outras);
  const n = Math.max(1, meses.length);
  const irpj = centavos(baseIr * 0.15);
  const adicional = centavos(Math.max(0, baseIr - 20000 * n) * 0.1);
  const csll = centavos(baseCs * 0.09);
  const retido = { irpj: soma('irrf'), csll: soma('csll') };
  const aPagar = { irpj: Math.max(0, centavos(irpj + adicional - retido.irpj)), csll: Math.max(0, centavos(csll - retido.csll)) };
  const cotas = (v: number) => (v < 2000 ? 1 : Math.min(3, Math.floor(v / 1000)));
  return {
    meses: meses.length, receita: { mercadorias: merc, servicos: serv, outras: centavos(outras) },
    base: { irpj: baseIr, csll: baseCs }, irpj, adicional, csll, retido, aPagar,
    cotas: { irpj: cotas(aPagar.irpj), csll: cotas(aPagar.csll) },
    acimaDaLc224: merc + serv + outras > (1250000 * n) / 3,
  };
}

/** Os meses do trimestre que fecha nesta competência (AAAA-MM), ou [] se ela não fecha trimestre. */
export function mesesDoTrimestre(competencia: string): string[] {
  const [a, m] = competencia.split('-').map(Number);
  if (!a || ![3, 6, 9, 12].includes(m)) return [];
  return [m - 2, m - 1, m].map(x => a + '-' + String(x).padStart(2, '0'));
}
