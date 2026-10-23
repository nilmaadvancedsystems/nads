// A gestão do Financeiro (22/10/2026, os itens 2, 5, 6 e 7 da lista do Painel): os devedores dos honorários, o reajuste
// anual, o resultado por conta (o mês contra o anterior e o do ano passado) e o caixa no formato da conferência do
// Extrator (a conciliação com o extrato do banco). Puro: sem banco e sem tela.
import type { LancamentoDoArquivo } from '../extratudo/extrator/tipos';
import { competenciaAnterior, type ContratoDeHonorario, type RecebimentoDeHonorario } from './honorarios';
import type { LancamentoDeCaixa } from './index';

const emCentavos = (v: number) => Math.round(v * 100);

/** o mês seguinte (AAAA-MM) */
function proximoMes(c: string): string {
  const a = Number(c.slice(0, 4)), m = Number(c.slice(5, 7));
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}
/** o mês anterior (AAAA-MM) */
export const mesAnterior = (c: string) => competenciaAnterior(c + '-01');

// ─── 2. Os devedores ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Devedor {
  contrato: ContratoDeHonorario;
  /** as competências em aberto (AAAA-MM), da mais antiga à mais nova */
  meses: string[];
  /** o valor do contrato vezes os meses em aberto */
  total: number;
}
export interface Inadimplencia {
  /** a primeira competência que conta: a do primeiro recebimento marcado no nads (antes disso, não havia controle) */
  inicio: string;
  /** a última que conta: a do mês passado (o honorário de setembro se paga em outubro) */
  ate: string;
  /** quem deve, do que deve mais meses ao que deve menos (e depois pelo valor) */
  devedores: Devedor[];
  total: number;
  /** os contratos ativos com valor que estão em dia */
  emDia: number;
}

/**
 * Quem está devendo honorários e quantos meses. Não há vencimento (honorarios.ts): conta como em aberto cada competência
 * sem recebimento, do início do controle (o primeiro recebimento marcado) ou do mês antes de o contrato ser criado até o
 * mês passado. Só os contratos ativos e com valor.
 */
export function inadimplencia(contratos: readonly ContratoDeHonorario[], recebimentos: readonly RecebimentoDeHonorario[], hoje: string): Inadimplencia {
  const ate = competenciaAnterior(hoje);
  const inicio = recebimentos.reduce((m, r) => (r.competencia < m ? r.competencia : m), ate);
  const pagos = new Set(recebimentos.map(r => r.contratoId + '|' + r.competencia));
  const devedores: Devedor[] = [];
  let emDia = 0;
  for (const c of contratos) {
    if (!c.ativo || !(c.valor > 0)) continue;
    const doContrato = c.criadoEm ? competenciaAnterior(c.criadoEm.slice(0, 10)) : inicio;
    const meses: string[] = [];
    for (let m = doContrato > inicio ? doContrato : inicio; m <= ate; m = proximoMes(m)) if (!pagos.has(c.id + '|' + m)) meses.push(m);
    if (meses.length) devedores.push({ contrato: c, meses, total: (emCentavos(c.valor) * meses.length) / 100 });
    else emDia++;
  }
  devedores.sort((a, b) => b.meses.length - a.meses.length || b.total - a.total || a.contrato.nome.localeCompare(b.contrato.nome, 'pt-BR'));
  return { inicio, ate, devedores, total: devedores.reduce((s, d) => s + emCentavos(d.total), 0) / 100, emDia };
}

// ─── 5. O reajuste ──────────────────────────────────────────────────────────────────────────────────────────────────

export type ArredondamentoDoReajuste = 'centavo' | 'real' | 'cinco';
export const ARREDONDAMENTOS: { valor: ArredondamentoDoReajuste; rotulo: string }[] = [
  { valor: 'centavo', rotulo: 'No centavo' }, { valor: 'real', rotulo: 'No real' }, { valor: 'cinco', rotulo: 'De 5 em 5 reais' },
];

/** o valor com o reajuste (pct = 4,5 para 4,5%), arredondado para cima no real ou de 5 em 5 */
export function valorReajustado(valor: number, pct: number, arredondar: ArredondamentoDoReajuste = 'centavo'): number {
  const centavos = Math.round(emCentavos(valor) * (1 + pct / 100));
  if (arredondar === 'real') return Math.ceil(centavos / 100);
  if (arredondar === 'cinco') return Math.ceil(centavos / 500) * 5;
  return centavos / 100;
}

export interface LinhaDoReajuste { contrato: ContratoDeHonorario; atual: number; novo: number }

/** a prévia do reajuste: os contratos ativos com valor, com o valor de hoje e o novo (por nome) */
export function previaDoReajuste(contratos: readonly ContratoDeHonorario[], pct: number, arredondar: ArredondamentoDoReajuste = 'centavo'): LinhaDoReajuste[] {
  return contratos.filter(c => c.ativo && c.valor > 0)
    .map(c => ({ contrato: c, atual: c.valor, novo: valorReajustado(c.valor, pct, arredondar) }))
    .sort((a, b) => a.contrato.nome.localeCompare(b.contrato.nome, 'pt-BR'));
}

// ─── 6. O resultado por conta: em resultado.ts (o comparativo e o ano mês a mês, pela árvore do plano) ─────────────────────

// ─── 7. A conciliação com o extrato ─────────────────────────────────────────────────────────────────────────────────

/** os lançamentos do caixa entre de e ate, no formato da conferência do Extrator (centavos; + entrada, − saída) */
export function caixaParaConferir(lancamentos: readonly LancamentoDeCaixa[], de: string, ate: string): LancamentoDoArquivo[] {
  return lancamentos.filter(l => l.data >= de && l.data <= ate).map(l => ({
    id: 'caixa:' + l.id, idArquivo: 'caixa', lado: 'sistema' as const, data: l.data,
    valor: l.tipo === 'E' ? emCentavos(l.valor) : -emCentavos(l.valor), historico: l.descricao,
  }));
}
