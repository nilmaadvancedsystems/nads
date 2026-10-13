// O Simples Nacional pelos XMLs (Vitor, 13/10/2026: "1 — monofásico e ST", "2 — prévia do DAS", "3 — aviso de limite"
// e "4 — REINF a partir das NFS-e"). Puro: a tela só desenha. É PRÉVIA para conferir: o que vale é o PGDAS-D e a REINF.
//   - segregacaoDasSaidas: a receita de mercadorias do mês separada em monofásico (PIS/COFINS pagos na indústria, pelo
//     NCM) e com ICMS por substituição tributária (pelo CST/CSOSN ou pelo CFOP de ST), que se segregam no PGDAS-D.
//   - previaDoDas: a alíquota efetiva pelo RBT12 e pelo anexo (LC 123/2006, anexos da LC 155/2016) e o valor de cada
//     parcela, tirando da alíquota a parte do PIS/COFINS (monofásico), do ICMS (ST) e do ISS (retido).
//   - avisoDeLimite: o RBT12 perto do sublimite (R$ 3,6 mi), do teto (R$ 4,8 mi) ou do limite do MEI (R$ 81 mil).
//   - reinfDasNotas: as retenções das NFS-e do mês, como entram na REINF (R-2010 INSS dos tomados, R-2020 INSS dos
//     prestados, R-4020 IRRF e CSRF dos tomados).
import type { NotaDoSieg, NotasSieg } from './index';

const centavos = (v: number) => Math.round(v * 100) / 100;
const so = (v: unknown) => String(v || '').replace(/\D/g, '');

// ---------- 1) monofásico e ST ----------

/**
 * Os NCMs de tributação monofásica do PIS/COFINS, pelo começo do código (as listas da Lei 10.147/2000, da Lei 10.485/2002,
 * das bebidas frias e dos combustíveis). Lista resumida dos grupos mais comuns: o NCM que não está aqui conta como normal.
 */
export const MONOFASICOS: readonly { grupo: string; prefixos: readonly string[] }[] = [
  { grupo: 'Combustíveis', prefixos: ['2710', '2207', '2711'] },
  { grupo: 'Medicamentos', prefixos: ['3001', '3002', '3003', '3004', '30051010', '30063', '30066'] },
  { grupo: 'Perfumaria e higiene', prefixos: ['3303', '3304', '3305', '3306', '3307', '34011190', '96032100'] },
  { grupo: 'Pneus e câmaras', prefixos: ['4011', '4013'] },
  { grupo: 'Autopeças', prefixos: ['4009', '4010', '4016', '6813', '7007', '7009', '7320', '8301', '8407', '8408', '8409', '8413', '8414', '8415', '8421', '8431', '8433', '8481', '8482', '8483', '8505', '8507', '8511', '8512', '8527', '8536', '8539', '8544', '8707', '8708', '9026', '9029', '9031', '9032', '9401'] },
  { grupo: 'Veículos e máquinas', prefixos: ['8429', '8432', '8701', '8702', '8703', '8704', '8705', '8706', '8711'] },
  { grupo: 'Bebidas frias', prefixos: ['2201', '2202', '2203', '21069010'] },
];

export const grupoMonofasico = (ncm: string): string | null => {
  const n = so(ncm);
  if (!n) return null;
  return MONOFASICOS.find(g => g.prefixos.some(p => n.startsWith(p)))?.grupo || null;
};

// os códigos com ICMS ST (CSOSN 201/202/203/500; CST 10/30/60/70) e os CFOP de saída com ST (x401 a x405)
const CSOSN_ST = ['201', '202', '203', '500'];
const CST_ST = ['10', '30', '60', '70'];
const CSOSNS = ['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'];
export function temIcmsSt(cst: string, cfop: string): boolean {
  const c = so(cst);
  if (['401', '402', '403', '405'].includes(String(cfop || '').slice(1))) return true;
  if (c.length === 4 && CSOSNS.includes(c.slice(1))) return CSOSN_ST.includes(c.slice(1));
  if (c.length === 3 && CSOSNS.includes(c)) return CSOSN_ST.includes(c);
  if (c.length === 3) return CST_ST.includes(c.slice(1));
  return false;
}

/** CFOP de venda (receita): saída 5/6/7, grupos 1xx (vendas) e 4xx (vendas com ST). Devolução, remessa e o resto, fora. */
const ehVenda = (cfop: string) => /^[567](1(0[1-9]|1\d|2[0-5])|40[1-5])$/.test(String(cfop || ''));

export interface Segregacao {
  /** a receita de mercadorias do mês (os itens de venda das notas emitidas, sem as canceladas) */
  total: number;
  /** só monofásico (PIS/COFINS fora), só ST (ICMS fora), os dois, e o normal */
  monofasico: number; st: number; monofasicoESt: number; normal: number;
  porGrupo: { grupo: string; valor: number; ncms: string[] }[];
  /** itens de venda sem NCM (não deu para saber) */
  semNcm: number;
}

export function segregacaoDasSaidas(x: NotasSieg | null): Segregacao {
  const r: Segregacao = { total: 0, monofasico: 0, st: 0, monofasicoESt: 0, normal: 0, porGrupo: [], semNcm: 0 };
  if (!x) return r;
  const grupos = new Map<string, { valor: number; ncms: Set<string> }>();
  for (const n of x.emitidas) {
    if (n.cancelada || !(n.tipo === 'NF-e' || n.tipo === 'NFC-e')) continue;
    for (const it of n.itens || []) {
      if (!ehVenda(it.cfop)) continue;
      const v = Number(it.valor) || 0;
      r.total += v;
      if (!so(it.ncm)) r.semNcm++;
      const g = grupoMonofasico(it.ncm);
      const st = temIcmsSt(it.cst, it.cfop);
      if (g && st) r.monofasicoESt += v; else if (g) r.monofasico += v; else if (st) r.st += v; else r.normal += v;
      if (g) {
        const gg = grupos.get(g) || { valor: 0, ncms: new Set<string>() };
        gg.valor += v; gg.ncms.add(so(it.ncm));
        grupos.set(g, gg);
      }
    }
  }
  for (const k of ['total', 'monofasico', 'st', 'monofasicoESt', 'normal'] as const) r[k] = centavos(r[k]);
  r.porGrupo = [...grupos].map(([grupo, g]) => ({ grupo, valor: centavos(g.valor), ncms: [...g.ncms].sort() })).sort((a, b) => b.valor - a.valor);
  return r;
}

// ---------- 2) prévia do DAS ----------

export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V';
type Tributo = 'IRPJ' | 'CSLL' | 'COFINS' | 'PIS' | 'CPP' | 'IPI' | 'ICMS' | 'ISS';
interface Faixa { ate: number; aliquota: number; deduzir: number; reparte: Partial<Record<Tributo, number>> }

/** Os anexos da LC 123/2006 (redação da LC 155/2016, em vigor desde 2018): faixas, alíquota nominal, parcela a deduzir e a repartição (%). */
export const ANEXOS: Record<Anexo, { nome: string; faixas: Faixa[] }> = {
  I: { nome: 'Anexo I — Comércio', faixas: [
    { ate: 180000, aliquota: 4, deduzir: 0, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34 } },
    { ate: 360000, aliquota: 7.3, deduzir: 5940, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 41.5, ICMS: 34 } },
    { ate: 720000, aliquota: 9.5, deduzir: 13860, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42, ICMS: 33.5 } },
    { ate: 1800000, aliquota: 10.7, deduzir: 22500, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42, ICMS: 33.5 } },
    { ate: 3600000, aliquota: 14.3, deduzir: 87300, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 12.74, PIS: 2.76, CPP: 42, ICMS: 33.5 } },
    { ate: 4800000, aliquota: 19, deduzir: 378000, reparte: { IRPJ: 13.5, CSLL: 10, COFINS: 28.27, PIS: 6.13, CPP: 42.1, ICMS: 0 } },
  ] },
  II: { nome: 'Anexo II — Indústria', faixas: [
    { ate: 180000, aliquota: 4.5, deduzir: 0, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 } },
    { ate: 360000, aliquota: 7.8, deduzir: 5940, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 } },
    { ate: 720000, aliquota: 10, deduzir: 13860, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 } },
    { ate: 1800000, aliquota: 11.2, deduzir: 22500, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 } },
    { ate: 3600000, aliquota: 14.7, deduzir: 85500, reparte: { IRPJ: 5.5, CSLL: 3.5, COFINS: 11.51, PIS: 2.49, CPP: 37.5, IPI: 7.5, ICMS: 32 } },
    { ate: 4800000, aliquota: 30, deduzir: 720000, reparte: { IRPJ: 8.5, CSLL: 7.5, COFINS: 20.96, PIS: 4.54, CPP: 23.5, IPI: 35, ICMS: 0 } },
  ] },
  III: { nome: 'Anexo III — Serviços', faixas: [
    { ate: 180000, aliquota: 6, deduzir: 0, reparte: { IRPJ: 4, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 } },
    { ate: 360000, aliquota: 11.2, deduzir: 9360, reparte: { IRPJ: 4, CSLL: 3.5, COFINS: 14.05, PIS: 3.05, CPP: 43.4, ISS: 32 } },
    { ate: 720000, aliquota: 13.5, deduzir: 17640, reparte: { IRPJ: 4, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 } },
    { ate: 1800000, aliquota: 16, deduzir: 35640, reparte: { IRPJ: 4, CSLL: 3.5, COFINS: 13.64, PIS: 2.96, CPP: 43.4, ISS: 32.5 } },
    { ate: 3600000, aliquota: 21, deduzir: 125640, reparte: { IRPJ: 4, CSLL: 3.5, COFINS: 12.82, PIS: 2.78, CPP: 43.4, ISS: 33.5 } },
    { ate: 4800000, aliquota: 33, deduzir: 648000, reparte: { IRPJ: 35, CSLL: 15, COFINS: 16.03, PIS: 3.47, CPP: 30.5, ISS: 0 } },
  ] },
  IV: { nome: 'Anexo IV — Serviços (sem CPP)', faixas: [
    { ate: 180000, aliquota: 4.5, deduzir: 0, reparte: { IRPJ: 18.8, CSLL: 15.2, COFINS: 17.67, PIS: 3.83, ISS: 44.5 } },
    { ate: 360000, aliquota: 9, deduzir: 8100, reparte: { IRPJ: 19.8, CSLL: 15.2, COFINS: 20.55, PIS: 4.45, ISS: 40 } },
    { ate: 720000, aliquota: 10.2, deduzir: 12420, reparte: { IRPJ: 20.8, CSLL: 15.2, COFINS: 19.73, PIS: 4.27, ISS: 40 } },
    { ate: 1800000, aliquota: 14, deduzir: 39780, reparte: { IRPJ: 17.8, CSLL: 19.2, COFINS: 18.9, PIS: 4.1, ISS: 40 } },
    { ate: 3600000, aliquota: 22, deduzir: 183780, reparte: { IRPJ: 18.8, CSLL: 19.2, COFINS: 18.08, PIS: 3.92, ISS: 40 } },
    { ate: 4800000, aliquota: 33, deduzir: 828000, reparte: { IRPJ: 53.5, CSLL: 21.5, COFINS: 20.55, PIS: 4.45, ISS: 0 } },
  ] },
  V: { nome: 'Anexo V — Serviços (fator R abaixo de 28%)', faixas: [
    { ate: 180000, aliquota: 15.5, deduzir: 0, reparte: { IRPJ: 25, CSLL: 15, COFINS: 14.1, PIS: 3.05, CPP: 28.85, ISS: 14 } },
    { ate: 360000, aliquota: 18, deduzir: 4500, reparte: { IRPJ: 23, CSLL: 15, COFINS: 14.1, PIS: 3.05, CPP: 27.85, ISS: 17 } },
    { ate: 720000, aliquota: 19.5, deduzir: 9900, reparte: { IRPJ: 24, CSLL: 15, COFINS: 14.92, PIS: 3.23, CPP: 23.85, ISS: 19 } },
    { ate: 1800000, aliquota: 20.5, deduzir: 17100, reparte: { IRPJ: 21, CSLL: 15, COFINS: 15.74, PIS: 3.41, CPP: 23.85, ISS: 21 } },
    { ate: 3600000, aliquota: 23, deduzir: 62100, reparte: { IRPJ: 23, CSLL: 12.5, COFINS: 14.1, PIS: 3.05, CPP: 23.85, ISS: 23.5 } },
    { ate: 4800000, aliquota: 30.5, deduzir: 540000, reparte: { IRPJ: 35, CSLL: 15.5, COFINS: 16.44, PIS: 3.56, CPP: 29.5, ISS: 0 } },
  ] },
};

/** A alíquota efetiva (%): (RBT12 × nominal − parcela a deduzir) ÷ RBT12; no começo da atividade (RBT12 0), a nominal da 1ª faixa. */
export function aliquotaEfetiva(anexo: Anexo, rbt12: number): { faixa: number; nominal: number; efetiva: number; reparte: Faixa['reparte'] } {
  const fs = ANEXOS[anexo].faixas;
  const i = Math.max(0, fs.findIndex(f => rbt12 <= f.ate));
  const f = rbt12 > fs[fs.length - 1].ate ? fs[fs.length - 1] : fs[i];
  const efetiva = rbt12 > 0 ? ((rbt12 * f.aliquota) / 100 - f.deduzir) / rbt12 * 100 : f.aliquota;
  return { faixa: fs.indexOf(f) + 1, nominal: f.aliquota, efetiva: Math.round(efetiva * 10000) / 10000, reparte: f.reparte };
}

/** Uma parcela da receita do mês: o anexo e o que sai da alíquota (o PIS/COFINS do monofásico, o ICMS da ST, o ISS retido). */
export interface ParcelaDaReceita { rotulo: string; anexo: Anexo; valor: number; semPisCofins?: boolean; semIcms?: boolean; semIss?: boolean }

export interface PreviaDoDas {
  rbt12: number;
  parcelas: (ParcelaDaReceita & { faixa: number; nominal: number; efetiva: number; aplicada: number; das: number })[];
  total: number;
  /** quanto a segregação economizou (o DAS sem tirar nada − o DAS com a segregação) */
  economia: number;
}

export function previaDoDas(rbt12: number, parcelas: readonly ParcelaDaReceita[]): PreviaDoDas {
  const linhas = parcelas.filter(p => p.valor > 0).map(p => {
    const a = aliquotaEfetiva(p.anexo, rbt12);
    const fora = (p.semPisCofins ? (a.reparte.PIS || 0) + (a.reparte.COFINS || 0) : 0) + (p.semIcms ? a.reparte.ICMS || 0 : 0) + (p.semIss ? a.reparte.ISS || 0 : 0);
    const aplicada = a.efetiva * (1 - fora / 100);
    return { ...p, faixa: a.faixa, nominal: a.nominal, efetiva: a.efetiva, aplicada: Math.round(aplicada * 10000) / 10000, das: centavos((p.valor * aplicada) / 100) };
  });
  const total = centavos(linhas.reduce((s, l) => s + l.das, 0));
  const cheio = centavos(linhas.reduce((s, l) => s + (l.valor * l.efetiva) / 100, 0));
  return { rbt12, parcelas: linhas, total, economia: centavos(cheio - total) };
}

// ---------- 3) aviso de limite ----------

export const SUBLIMITE = 3600000;
export const TETO = 4800000;
export const LIMITE_MEI = 81000;

/** O aviso do RBT12 (Simples) ou da receita do ano (MEI): null quando está longe (abaixo de 90% do limite). */
export function avisoDeLimite(regime: string, rbt12: number): { nivel: 'atencao' | 'passou'; texto: string } | null {
  if (!(rbt12 > 0)) return null;
  const real = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (regime === 'MEI') {
    if (rbt12 > LIMITE_MEI) return { nivel: 'passou', texto: 'Passou do limite do MEI (' + real(LIMITE_MEI) + '): ' + real(rbt12) + '. Veja o desenquadramento.' };
    if (rbt12 >= LIMITE_MEI * 0.9) return { nivel: 'atencao', texto: 'Perto do limite do MEI: ' + real(rbt12) + ' de ' + real(LIMITE_MEI) + '.' };
    return null;
  }
  if (regime !== 'Simples') return null;
  if (rbt12 > TETO) return { nivel: 'passou', texto: 'Passou do teto do Simples (' + real(TETO) + '): ' + real(rbt12) + '. Veja a exclusão.' };
  if (rbt12 >= TETO * 0.9) return { nivel: 'atencao', texto: 'Perto do teto do Simples: ' + real(rbt12) + ' de ' + real(TETO) + '.' };
  if (rbt12 > SUBLIMITE) return { nivel: 'passou', texto: 'Passou do sublimite (' + real(SUBLIMITE) + '): ICMS e ISS saem do DAS e vão por fora.' };
  if (rbt12 >= SUBLIMITE * 0.9) return { nivel: 'atencao', texto: 'Perto do sublimite: ' + real(rbt12) + ' de ' + real(SUBLIMITE) + ' (acima dele, ICMS e ISS saem do DAS).' };
  return null;
}

// ---------- 4) REINF a partir das NFS-e ----------

export interface LinhaDaReinf { evento: 'R-2010' | 'R-2020' | 'R-4020'; doc: string; nome: string; notas: number; base: number; inss: number; irrf: number; pis: number; cofins: number; csll: number }

const ret = (n: NotaDoSieg, imposto: string) => (n.retencoes || []).filter(r => r.imposto === imposto).reduce((t, r) => t + (Number(r.valor) || 0), 0);

/**
 * As retenções das NFS-e do mês como entram na REINF: R-2010 (INSS retido nos serviços tomados, por prestador), R-2020
 * (INSS retido nos serviços prestados, por tomador) e R-4020 (IRRF e PIS/COFINS/CSLL retidos nos tomados, por beneficiário).
 */
export function reinfDasNotas(x: NotasSieg | null): LinhaDaReinf[] {
  if (!x) return [];
  const por = new Map<string, LinhaDaReinf>();
  const somar = (evento: LinhaDaReinf['evento'], p: { doc: string; nome: string }, n: NotaDoSieg, campos: Partial<Record<'inss' | 'irrf' | 'pis' | 'cofins' | 'csll', number>>) => {
    const k = evento + '|' + so(p.doc);
    const l = por.get(k) || { evento, doc: so(p.doc), nome: p.nome, notas: 0, base: 0, inss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0 };
    l.notas++; l.base = centavos(l.base + (Number(n.valor) || 0));
    for (const [c, v] of Object.entries(campos)) l[c as 'inss'] = centavos(l[c as 'inss'] + (v || 0));
    por.set(k, l);
  };
  for (const n of x.recebidas) {
    if (n.cancelada || n.tipo !== 'NFS-e') continue;
    const inss = ret(n, 'INSS');
    if (inss > 0) somar('R-2010', n.emitente, n, { inss });
    const irrf = ret(n, 'IRRF'), pis = ret(n, 'PIS'), cofins = ret(n, 'COFINS'), csll = ret(n, 'CSLL');
    if (irrf + pis + cofins + csll > 0) somar('R-4020', n.emitente, n, { irrf, pis, cofins, csll });
  }
  for (const n of x.emitidas) {
    if (n.cancelada || n.tipo !== 'NFS-e') continue;
    const inss = ret(n, 'INSS');
    if (inss > 0) somar('R-2020', n.destinatario, n, { inss });
  }
  const ordem = { 'R-2010': 0, 'R-2020': 1, 'R-4020': 2 };
  return [...por.values()].sort((a, b) => ordem[a.evento] - ordem[b.evento] || b.base - a.base);
}

/** A receita de serviços do mês (NFS-e emitidas, sem as canceladas) e quanto dela teve o ISS retido pelo tomador. */
export function servicosDoMes(x: NotasSieg | null): { total: number; issRetido: number } {
  if (!x) return { total: 0, issRetido: 0 };
  let total = 0, issRetido = 0;
  for (const n of x.emitidas) {
    if (n.cancelada || n.tipo !== 'NFS-e') continue;
    total += Number(n.valor) || 0;
    if (ret(n, 'ISS') > 0) issRetido += Number(n.valor) || 0;
  }
  return { total: centavos(total), issRetido: centavos(issRetido) };
}
