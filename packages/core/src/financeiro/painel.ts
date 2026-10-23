// O painel do Financeiro (22/10/2026: "no financeiro, faça um dashboard de entradas, saídas dentre outros"): as contas do
// caixa por mês (os últimos 12) e por conta do plano, e o saldo de hoje. Puro: sem banco e sem tela.
import type { ContaDoPlano, LancamentoDeCaixa, TipoDeLancamento } from './index';

const emCentavos = (v: number) => Math.round(v * 100);

/** os últimos n meses até o de hoje (AAAA-MM), do mais antigo para o mais novo */
export function ultimosMeses(hoje: string, n = 12): string[] {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = a * 12 + (m - 1) - i;
    meses.push(Math.floor(total / 12) + '-' + String((total % 12) + 1).padStart(2, '0'));
  }
  return meses;
}

export interface MesDoCaixa { mes: string; entradas: number; saidas: number; resultado: number }

/** as entradas, as saídas e o resultado (entradas − saídas) de cada mês */
export function caixaPorMes(lancamentos: readonly LancamentoDeCaixa[], meses: readonly string[]): MesDoCaixa[] {
  const soma = new Map(meses.map(m => [m, { e: 0, s: 0 }]));
  for (const l of lancamentos) {
    const x = soma.get(l.data.slice(0, 7));
    if (!x) continue;
    if (l.tipo === 'E') x.e += emCentavos(l.valor); else x.s += emCentavos(l.valor);
  }
  return meses.map(mes => {
    const x = soma.get(mes)!;
    return { mes, entradas: x.e / 100, saidas: x.s / 100, resultado: (x.e - x.s) / 100 };
  });
}

export interface TotalDaConta { conta: string | null; rotulo: string; total: number; pct: number }

/**
 * As entradas ou as saídas do período (de e ate inclusive) por conta do plano, da maior para a menor; passando do
 * limite, o resto vira "Outras contas"; sem conta, "Sem conta". pct = parte do total do período.
 */
export function totaisPorConta(lancamentos: readonly LancamentoDeCaixa[], tipo: TipoDeLancamento, de: string, ate: string,
  contas: ReadonlyMap<string, ContaDoPlano>, limite = 8): TotalDaConta[] {
  const soma = new Map<string, number>();
  let tudo = 0;
  for (const l of lancamentos) {
    if (l.tipo !== tipo || l.data < de || l.data > ate) continue;
    const k = l.conta && contas.has(l.conta) ? l.conta : '';
    soma.set(k, (soma.get(k) || 0) + emCentavos(l.valor));
    tudo += emCentavos(l.valor);
  }
  const rotulo = (k: string) => { const c = contas.get(k); return c ? c.codigo + ' ' + c.descricao : 'Sem conta'; };
  const lista = [...soma.entries()].sort((a, b) => b[1] - a[1]);
  const cabem = lista.length > limite ? lista.slice(0, limite - 1) : lista;
  const resto = lista.length > limite ? lista.slice(limite - 1).reduce((s, [, v]) => s + v, 0) : 0;
  const pct = (v: number) => (tudo ? Math.round((v / tudo) * 1000) / 10 : 0);
  const r: TotalDaConta[] = cabem.map(([k, v]) => ({ conta: k || null, rotulo: rotulo(k), total: v / 100, pct: pct(v) }));
  if (resto) r.push({ conta: null, rotulo: 'Outras contas', total: resto / 100, pct: pct(resto) });
  return r;
}

/** o saldo do caixa no fim de hoje (tudo o que entrou menos o que saiu até hoje, inclusive) */
export function saldoDeHoje(lancamentos: readonly LancamentoDeCaixa[], hoje: string): number {
  let c = 0;
  for (const l of lancamentos) if (l.data <= hoje) c += l.tipo === 'E' ? emCentavos(l.valor) : -emCentavos(l.valor);
  return c / 100;
}
