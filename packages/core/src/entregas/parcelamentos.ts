// Os parcelamentos dos clientes (Heverton, 20/10/2026: "Cadastro = Fiscal (inserir)": "Parcelamento (inserir dados)"):
// os mesmos da página Parcelamentos do Entregas (a coleção parcelamentos), para o robô continuar marcando a parcela paga
// pelo comprovante (robo/parcela-paga.js) e avisando os atrasados. Aqui: os tipos, a conferência do documento, a
// validação do que se digita e a próxima parcela.

export const ORGAOS_DO_PARCELAMENTO = [
  { id: 'pgfn', sigla: 'PGFN', rotulo: 'PGFN · Dívida ativa' },
  { id: 'simples', sigla: 'SN', rotulo: 'Simples Nacional' },
  { id: 'receita', sigla: 'RFB', rotulo: 'Receita Federal' },
  { id: 'estadual', sigla: 'SEF', rotulo: 'Estado (ICMS)' },
  { id: 'municipal', sigla: 'PREF', rotulo: 'Prefeitura' },
  { id: 'outro', sigla: '•••', rotulo: 'Outro' },
] as const;
export type OrgaoDoParcelamento = (typeof ORGAOS_DO_PARCELAMENTO)[number]['id'];
export const SITUACOES_DO_PARCELAMENTO = [
  { id: 'ativo', rotulo: 'Em dia / pagando' }, { id: 'quitado', rotulo: 'Quitado' }, { id: 'rescindido', rotulo: 'Rescindido' }, { id: 'cancelado', rotulo: 'Cancelado' },
] as const;
export type SituacaoDoParcelamento = (typeof SITUACOES_DO_PARCELAMENTO)[number]['id'];

export interface Parcelamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  orgao: OrgaoDoParcelamento;
  modalidade: string;
  numero: string;
  parcelas: number;
  /** AAAA-MM da 1ª parcela */
  primeira: string;
  valorParcela: number;
  /** o dia do vencimento (1 a 31) ou 'util' (o último dia útil) */
  dia: number | 'util';
  status: SituacaoDoParcelamento;
  aberto: boolean;
  /** os meses pagos (AAAA-MM) */
  pagas: string[];
  obs: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

const texto = (v: unknown) => (v == null ? '' : String(v));
const ORGAOS = ORGAOS_DO_PARCELAMENTO.map(o => o.id) as readonly string[];
const SITUACOES = SITUACOES_DO_PARCELAMENTO.map(s => s.id) as readonly string[];

/** o documento parcelamentos/{id} conferido */
export function parcelamentoDoDocumento(id: string, d: Record<string, unknown>): Parcelamento {
  const dia = d.dia === 'util' ? 'util' : Math.min(31, Math.max(1, Math.round(Number(d.dia)) || 1));
  return {
    id, clienteId: texto(d.clienteId), clienteNome: texto(d.clienteNome),
    orgao: (ORGAOS.includes(texto(d.orgao)) ? texto(d.orgao) : 'outro') as OrgaoDoParcelamento,
    modalidade: texto(d.modalidade), numero: texto(d.numero),
    parcelas: Math.max(1, Math.round(Number(d.parcelas)) || 1), primeira: texto(d.primeira),
    valorParcela: Number(d.valorParcela) || 0, dia,
    status: (SITUACOES.includes(texto(d.status)) ? texto(d.status) : 'ativo') as SituacaoDoParcelamento,
    aberto: d.aberto !== false,
    pagas: d.pagas && typeof d.pagas === 'object' ? Object.keys(d.pagas as Record<string, unknown>).filter(k => /^\d{4}-\d{2}$/.test(k)).sort() : [],
    obs: texto(d.obs), atualizadoEm: texto(d.atualizadoEm), atualizadoPor: texto(d.atualizadoPor),
  };
}

/** a competência n meses depois de AAAA-MM */
export function mesMais(c: string, n: number): string {
  const [a, m] = c.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** a próxima parcela em aberto: o número, o mês e o vencimento (dd/mm/aaaa); null = todas pagas (ou encerrado) */
export function proximaParcela(p: Parcelamento): { numero: number; mes: string; vencimento: string } | null {
  if (!p.aberto || !/^\d{4}-\d{2}$/.test(p.primeira)) return null;
  const pagas = new Set(p.pagas);
  for (let i = 0; i < p.parcelas; i++) {
    const mes = mesMais(p.primeira, i);
    if (pagas.has(mes)) continue;
    const [a, m] = mes.split('-').map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    let dia = p.dia === 'util' ? ultimo : Math.min(p.dia, ultimo);
    if (p.dia === 'util') { while ([0, 6].includes(new Date(a, m - 1, dia).getDay())) dia--; }
    return { numero: i + 1, mes, vencimento: String(dia).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + a };
  }
  return null;
}

/** o valor digitado (1.234,56 ou 1234.56) */
export function valorDaParcelaDigitado(v: string): number | null {
  const s = String(v || '').trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export interface ParcelamentoDigitado { orgao: string; modalidade: string; numero: string; parcelas: string; primeira: string; valor: string; dia: string; obs: string; status?: string }

/**
 * Confere o que se digitou e devolve os campos do documento (os mesmos do Entregas), ou o erro. primeira: "mm/aaaa"
 * ou "aaaa-mm"; dia: 1 a 31 ou "util".
 */
export function camposDoParcelamento(f: ParcelamentoDigitado): { erro: string } | { campos: Record<string, unknown> } {
  const n = Math.round(Number(f.parcelas));
  if (!(n >= 1 && n <= 600)) return { erro: 'Quantas parcelas? (1 a 600)' };
  const p = String(f.primeira || '').trim();
  const ym = /^\d{4}-\d{2}$/.test(p) ? p : /^(\d{1,2})\/(\d{4})$/.test(p) ? p.replace(/^(\d{1,2})\/(\d{4})$/, (_, m, a) => a + '-' + String(m).padStart(2, '0')) : '';
  if (!ym || Number(ym.slice(5)) < 1 || Number(ym.slice(5)) > 12) return { erro: 'O mês da 1ª parcela: mm/aaaa (ex.: 01/2026).' };
  const v = valorDaParcelaDigitado(f.valor);
  if (v == null) return { erro: 'O valor da parcela (ex.: 350,00).' };
  const dia = f.dia === 'util' ? 'util' : Math.round(Number(f.dia));
  if (dia !== 'util' && !(dia >= 1 && dia <= 31)) return { erro: 'O dia do vencimento: 1 a 31, ou o último dia útil.' };
  const orgao = ORGAOS.includes(f.orgao) ? f.orgao : 'outro';
  const status = f.status && SITUACOES.includes(f.status) ? f.status : 'ativo';
  return { campos: { orgao, modalidade: f.modalidade.trim().slice(0, 120), numero: f.numero.trim().slice(0, 60), parcelas: n, primeira: ym, valorParcela: v, dia, obs: f.obs.trim().slice(0, 4000), status, aberto: status === 'ativo' } };
}
