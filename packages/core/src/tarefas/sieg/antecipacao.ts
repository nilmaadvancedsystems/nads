// A antecipação do ICMS do Espírito Santo (Heverton, 22/10/2026: a planilha "Antecipação ICMS-ES", do cliente 585). Uma
// linha por NF-e de entrada interestadual (e, dentro da nota, por CFOP, CST e alíquota), com as contas da aba CÁLCULO:
//   base da antecipação = o valor da operação (o produto, as despesas e o IPI);
//   ICMS interno        = ARRED(base × alíquota interna ÷ 100; 2)        (a interna do ES: 17%, editável);
//   antecipação         = ARRED(ICMS interno − ICMS destacado na nota; 2).
// As notas vêm dos XMLs do SIEG (siegNotas: as recebidas, NF-e, sem as canceladas; o item com o CFOP 6xxx do fornecedor).
// A situação de cada linha (A conferir, Conferido, Revisar, Dispensado, Não se aplica) é marcada na tela e fica no cadastro
// da empresa; o RESUMO conta as situações e soma por mês; o RELATÓRIO é o documento para imprimir (A4 deitado).
import type { ItemDoXml, NotaDoSieg, NotasSieg } from './index';

export type SituacaoDaAntecipacao = 'a-conferir' | 'conferido' | 'revisar' | 'dispensado' | 'nao-se-aplica';
export const SITUACOES_DA_ANTECIPACAO: readonly { id: SituacaoDaAntecipacao; rotulo: string }[] = [
  { id: 'a-conferir', rotulo: 'A conferir' }, { id: 'conferido', rotulo: 'Conferido' }, { id: 'revisar', rotulo: 'Revisar' },
  { id: 'dispensado', rotulo: 'Dispensado' }, { id: 'nao-se-aplica', rotulo: 'Não se aplica' },
];
export const rotuloDaSituacao = (s: SituacaoDaAntecipacao) => SITUACOES_DA_ANTECIPACAO.find(x => x.id === s)?.rotulo || s;
/** as que não entram no "a recolher" */
const FORA_DO_RECOLHER: readonly SituacaoDaAntecipacao[] = ['dispensado', 'nao-se-aplica'];

/** a alíquota interna do ES (a padrão da aba PARÂMETROS) */
export const ALIQUOTA_INTERNA_ES = 17;
/** as alíquotas interestaduais: a estimada (nota baixada antes do resumo 3, sem a alíquota no item) vai para a mais perto */
const INTERESTADUAIS = [4, 7, 12];

/** o arredondamento da planilha (ARRED: metade para longe do zero), em centavos */
export function arred(x: number): number {
  const s = x < 0 ? -1 : 1;
  return (s * Math.round(Math.abs(x) * 100 + 1e-7)) / 100;
}

/** As contas de uma linha (as colunas J, K e L da aba CÁLCULO). */
export function contaDaAntecipacao(valorOperacao: number, icmsDestacado: number, aliquotaInterna: number): { base: number; icmsInterno: number; antecipacao: number } {
  const base = arred(valorOperacao);
  const icmsInterno = arred((base * aliquotaInterna) / 100);
  return { base, icmsInterno, antecipacao: arred(icmsInterno - arred(icmsDestacado)) };
}

/** o CFOP da entrada que o fornecedor de fora do estado manda (6102 → 2102; a venda com ST → 2403); '' se não é interestadual */
export function cfopDeEntrada(cfopDoFornecedor: string): string {
  const c = String(cfopDoFornecedor || '').replace(/\D/g, '');
  if (!/^6\d{3}$/.test(c)) return '';
  if (['6101', '6102', '6105', '6106'].includes(c)) return '2102';
  if (['6401', '6402', '6403', '6404'].includes(c)) return '2403';
  return '2' + c.slice(1);
}

/** Uma linha da antecipação, antes das contas (o que vem dos XMLs). */
export interface LinhaDaAntecipacao {
  /** a chave da nota, o CFOP de entrada, o CST e a alíquota: o que fica gravado com a situação */
  id: string;
  chave: string; numero: string;
  /** dd/mm/aaaa (a emissão) */
  data: string;
  /** o mês dos XMLs (AAAA-MM) */
  competencia: string;
  fornecedor: { doc: string; nome: string };
  /** o CFOP de entrada (o do fornecedor fica em cfopDoFornecedor) */
  cfop: string; cfopDoFornecedor: string;
  cst: string;
  valorOperacao: number; baseNf: number; aliquotaInterestadual: number; icmsDestacado: number;
  /** a alíquota foi estimada pelo ICMS e pela base (a nota foi baixada antes de o robô guardar a alíquota) */
  aliquotaEstimada: boolean;
  ncms: string[];
  /** a situação que a linha começa (sem marca na tela) e por quê */
  sugestao: SituacaoDaAntecipacao; motivo: string;
}

const temSt = (it: ItemDoXml, cfop: string) => (Number(it.st) || 0) > 0 || /^64\d\d$/.test(cfop);

function aliquotaDoItem(it: ItemDoXml): { aliquota: number; estimada: boolean } {
  if (it.aliq) return { aliquota: Number(it.aliq), estimada: false };
  const icms = Number(it.icms) || 0;
  if (!icms) return { aliquota: 0, estimada: false };
  const base = Number(it.bc) || (Number(it.valor) || 0) + (Number(it.desp) || 0);
  if (!base) return { aliquota: 0, estimada: true };
  const p = (icms / base) * 100;
  const perto = INTERESTADUAIS.find(a => Math.abs(a - p) <= 0.6);
  return { aliquota: perto ?? arred(p), estimada: true };
}

/**
 * As linhas das notas de entrada interestaduais dos meses (os resumos do "Baixar XMLs do SIEG"): as NF-e recebidas, sem as
 * canceladas, e de cada uma os itens com o CFOP 6xxx, juntos por CFOP de entrada, CST e alíquota (como a planilha: a nota
 * 213719 tem três linhas, uma por CST). Uma nota que aparece em dois meses entra uma vez só. Na ordem da data e do número.
 */
export function linhasDaAntecipacao(meses: readonly (NotasSieg | null | undefined)[]): LinhaDaAntecipacao[] {
  const vistas = new Set<string>();
  const linhas: LinhaDaAntecipacao[] = [];
  for (const x of meses) {
    if (!x) continue;
    for (const n of x.recebidas) {
      if (n.tipo !== 'NF-e' || n.cancelada) continue;
      const qual = n.chave || n.emitente.doc + '|' + n.numero + '|' + n.serie;
      if (vistas.has(qual)) continue;
      vistas.add(qual);
      linhas.push(...linhasDaNota(n, x.competencia));
    }
  }
  return linhas.sort((a, b) => dataIso(a.data).localeCompare(dataIso(b.data)) || Number(a.numero) - Number(b.numero) || a.id.localeCompare(b.id));
}

function linhasDaNota(n: NotaDoSieg, competencia: string): LinhaDaAntecipacao[] {
  const grupos = new Map<string, LinhaDaAntecipacao & { st: boolean }>();
  for (const it of n.itens || []) {
    const cfop = cfopDeEntrada(it.cfop);
    if (!cfop) continue;
    const { aliquota, estimada } = aliquotaDoItem(it);
    const id = (n.chave || n.numero) + '|' + cfop + '|' + it.cst + '|' + aliquota;
    const g = grupos.get(id) || {
      id, chave: n.chave, numero: n.numero, data: n.data, competencia, fornecedor: n.emitente, cfop, cfopDoFornecedor: it.cfop, cst: it.cst,
      valorOperacao: 0, baseNf: 0, aliquotaInterestadual: aliquota, icmsDestacado: 0, aliquotaEstimada: false, ncms: [], sugestao: 'a-conferir' as SituacaoDaAntecipacao, motivo: '', st: false,
    };
    const valor = Number(it.valor) || 0, desp = Number(it.desp) || 0, icms = Number(it.icms) || 0;
    g.valorOperacao += valor + desp + (Number(it.ipi) || 0);
    g.baseNf += Number(it.bc) || (icms ? valor + desp : 0);
    g.icmsDestacado += icms;
    g.aliquotaEstimada ||= estimada;
    g.st ||= temSt(it, it.cfop);
    if (it.ncm && !g.ncms.includes(it.ncm)) g.ncms.push(it.ncm);
    grupos.set(id, g);
  }
  return [...grupos.values()].map(({ st, ...g }) => {
    const l = { ...g, valorOperacao: arred(g.valorOperacao), baseNf: arred(g.baseNf), icmsDestacado: arred(g.icmsDestacado) };
    if (st) return { ...l, sugestao: 'nao-se-aplica' as const, motivo: 'Com ICMS-ST na nota' };
    if (l.cfop !== '2102') return { ...l, sugestao: 'nao-se-aplica' as const, motivo: 'CFOP ' + l.cfop + ': não é compra para comercialização' };
    return l;
  });
}

const dataIso = (d: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d); return m ? m[3] + '-' + m[2] + '-' + m[1] : d; };

/** A marca da situação de uma linha (gravada no cadastro da empresa). */
export interface MarcaDaAntecipacao { situacao: SituacaoDaAntecipacao; por: string; em: string }

/** Uma linha com as contas e a situação. */
export interface LinhaCalculada extends LinhaDaAntecipacao {
  aliquotaInterna: number; baseAntecipacao: number; icmsInterno: number; antecipacao: number;
  situacao: SituacaoDaAntecipacao;
  /** quem marcou e quando (sem = a situação é a sugerida) */
  marca: MarcaDaAntecipacao | null;
}

export function calcularAntecipacao(linhas: readonly LinhaDaAntecipacao[], aliquotaInterna: number, marcas: Readonly<Record<string, MarcaDaAntecipacao>> = {}): LinhaCalculada[] {
  return linhas.map(l => {
    const c = contaDaAntecipacao(l.valorOperacao, l.icmsDestacado, aliquotaInterna);
    const marca = marcas[l.id] || null;
    return { ...l, aliquotaInterna, baseAntecipacao: c.base, icmsInterno: c.icmsInterno, antecipacao: c.antecipacao, situacao: marca?.situacao || l.sugestao, marca };
  });
}

/** O total de um grupo de linhas. */
export interface TotaisDaAntecipacao {
  linhas: number; notas: number;
  valorOperacao: number; baseNf: number; icmsDestacado: number; baseAntecipacao: number; icmsInterno: number;
  /** a soma da coluna Antecipação (todas as linhas, como a planilha) */
  antecipacao: number;
  /** sem as linhas Dispensado e Não se aplica */
  aRecolher: number;
}

export function totaisDaAntecipacao(linhas: readonly LinhaCalculada[]): TotaisDaAntecipacao {
  const soma = (f: (l: LinhaCalculada) => number, ls: readonly LinhaCalculada[] = linhas) => arred(ls.reduce((t, l) => t + f(l), 0));
  return {
    linhas: linhas.length, notas: new Set(linhas.map(l => l.chave || l.numero)).size,
    valorOperacao: soma(l => l.valorOperacao), baseNf: soma(l => l.baseNf), icmsDestacado: soma(l => l.icmsDestacado),
    baseAntecipacao: soma(l => l.baseAntecipacao), icmsInterno: soma(l => l.icmsInterno), antecipacao: soma(l => l.antecipacao),
    aRecolher: soma(l => l.antecipacao, linhas.filter(l => !FORA_DO_RECOLHER.includes(l.situacao))),
  };
}

/** O RESUMO: os totais, a contagem por situação e os totais de cada mês (da data da nota). */
export interface ResumoDaAntecipacao extends TotaisDaAntecipacao {
  porSituacao: Record<SituacaoDaAntecipacao, number>;
  porMes: ({ mes: string } & TotaisDaAntecipacao)[];
}

export function resumoDaAntecipacao(linhas: readonly LinhaCalculada[]): ResumoDaAntecipacao {
  const porSituacao = Object.fromEntries(SITUACOES_DA_ANTECIPACAO.map(s => [s.id, linhas.filter(l => l.situacao === s.id).length])) as Record<SituacaoDaAntecipacao, number>;
  const meses = [...new Set(linhas.map(mesDaLinha))].sort();
  return { ...totaisDaAntecipacao(linhas), porSituacao, porMes: meses.map(mes => ({ mes, ...totaisDaAntecipacao(linhas.filter(l => mesDaLinha(l) === mes)) })) };
}

/** AAAA-MM da data da nota (sem data, o mês dos XMLs) */
export const mesDaLinha = (l: Pick<LinhaDaAntecipacao, 'data' | 'competencia'>) => dataIso(l.data).slice(0, 7) || l.competencia;

/** Os filtros do RELATÓRIO: o mês (AAAA-MM; vazio = todos) e a situação (vazia = todas). */
export function filtrarAntecipacao(linhas: readonly LinhaCalculada[], f: { mes?: string; situacao?: SituacaoDaAntecipacao | '' }): LinhaCalculada[] {
  return linhas.filter(l => (!f.mes || mesDaLinha(l) === f.mes) && (!f.situacao || l.situacao === f.situacao));
}

// ─── o RELATÓRIO para imprimir ───────────────────────────────────────────────

export interface EmpresaDoRelatorio { razaoSocial: string; cnpj: string; inscricaoEstadual: string; regime: string; endereco: string; municipio: string; responsavel: string }

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * O documento da aba RELATÓRIO (A4 deitado; o cabeçalho da tabela se repete em cada página): o título, os dados da empresa,
 * os filtros, as linhas (NF-e, data, CFOP, CST, valor, ICMS destacado, base, ICMS interno, antecipação e situação), o total,
 * o resumo do período (quantidade, valor e o a recolher), quem elaborou e a data da emissão.
 */
export function htmlDaAntecipacao(p: {
  empresa: EmpresaDoRelatorio; filtros: { mes: string; ano: string; situacao: string }; linhas: readonly LinhaCalculada[];
  aliquotaInterna: number; elaboradoPor: string; emitidoEm: Date;
}): string {
  const t = totaisDaAntecipacao(p.linhas);
  const e = p.empresa;
  const dado = (rotulo: string, valor: string) => `<div><span>${esc(rotulo)}</span><b>${esc(valor || '—')}</b></div>`;
  const linhas = p.linhas.map(l => `<tr><td class="t">${esc(l.numero)}</td><td class="t">${esc(l.data)}</td><td class="t">${esc(l.cfop)}</td><td class="t">${esc(l.cst)}</td><td>${brl(l.valorOperacao)}</td><td>${brl(l.icmsDestacado)}</td><td>${brl(l.baseAntecipacao)}</td><td>${brl(l.icmsInterno)}</td><td class="forte">${brl(l.antecipacao)}</td><td class="t">${esc(rotuloDaSituacao(l.situacao))}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Antecipação de ICMS — ${esc(e.razaoSocial)}</title>
<style>
  @page{size:A4 landscape;margin:9mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#000;font-size:8pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:13pt;margin:0}
  .sub{margin:0 0 3mm;color:#444}
  h2{font-size:8.5pt;margin:3mm 0 1.5mm;padding:1mm 1.5mm;background:#000;color:#fff;letter-spacing:.04em}
  .dados{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm}
  .dados div{display:flex;gap:2mm}
  .dados span{color:#444;min-width:30mm}
  .filtros{display:flex;gap:10mm}
  .filtros span{color:#444;margin-right:2mm}
  table{width:100%;border-collapse:collapse;margin-top:2mm}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-weight:700;padding:1mm;text-align:right}
  th.t{text-align:left}
  td{border-bottom:.2mm solid #999;padding:.8mm 1mm;text-align:right;white-space:nowrap}
  td.t{text-align:left}
  td.forte,tfoot td{font-weight:700}
  tfoot td{border-top:.4mm solid #000;border-bottom:0}
  .resumo{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:2mm;break-inside:avoid}
  .resumo div{border:.3mm solid #000;padding:2mm}
  .resumo span{display:block;color:#444}
  .resumo b{font-size:11pt}
  .pe{display:flex;justify-content:space-between;margin-top:6mm;break-inside:avoid}
  .nota{margin-top:3mm;color:#444;font-size:7pt}
</style></head><body>
<h1>RELATÓRIO DE ANTECIPAÇÃO DE ICMS — ESPÍRITO SANTO</h1>
<p class="sub">Relatório para conferência, acompanhamento e impressão · alíquota interna ${esc(String(p.aliquotaInterna).replace('.', ','))}%</p>
<h2>DADOS DA EMPRESA</h2>
<div class="dados">${dado('Razão Social:', e.razaoSocial)}${dado('CNPJ:', e.cnpj)}${dado('Inscrição Estadual:', e.inscricaoEstadual)}${dado('Regime Tributário:', e.regime)}${dado('Endereço:', e.endereco)}${dado('Município/UF:', e.municipio)}${dado('Responsável:', e.responsavel)}</div>
<h2>FILTROS DO RELATÓRIO</h2>
<div class="filtros"><div><span>Mês:</span><b>${esc(p.filtros.mes)}</b></div><div><span>Ano:</span><b>${esc(p.filtros.ano)}</b></div><div><span>Situação:</span><b>${esc(p.filtros.situacao)}</b></div></div>
<table><thead><tr><th class="t">NF-e</th><th class="t">Data</th><th class="t">CFOP</th><th class="t">CST</th><th>Valor Operação</th><th>ICMS Destacado</th><th>Base Antecipação</th><th>ICMS Interno</th><th>Antecipação</th><th class="t">Situação</th></tr></thead>
<tbody>${linhas}</tbody>
<tfoot><tr><td class="t" colspan="4">TOTAL DO RELATÓRIO</td><td>${brl(t.valorOperacao)}</td><td>${brl(t.icmsDestacado)}</td><td>${brl(t.baseAntecipacao)}</td><td>${brl(t.icmsInterno)}</td><td>${brl(t.antecipacao)}</td><td></td></tr></tfoot></table>
<h2>RESUMO DO PERÍODO SELECIONADO</h2>
<div class="resumo"><div><span>Quantidade de NF-e</span><b>${t.notas}</b> (${t.linhas} ${t.linhas === 1 ? 'linha' : 'linhas'})</div><div><span>Valor das operações</span><b>${brl(t.valorOperacao)}</b></div><div><span>Antecipação a recolher</span><b>${brl(t.aRecolher)}</b>${t.aRecolher !== t.antecipacao ? ' (sem Dispensado e Não se aplica)' : ''}</div></div>
<div class="pe"><span>Elaborado por: ${esc(p.elaboradoPor)}</span><span>Data da emissão: ${p.emitidoEm.toLocaleDateString('pt-BR')}</span></div>
<p class="nota">As notas vêm dos XMLs do SIEG (as NF-e de entrada interestaduais). Antes do recolhimento, confira o enquadramento da mercadoria, NCM, CFOP, CST, alíquota aplicável, base de cálculo e eventuais hipóteses de substituição tributária, isenção, não incidência ou dispensa.</p>
</body></html>`;
}
