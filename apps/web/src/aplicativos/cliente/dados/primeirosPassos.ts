// Os primeiros passos da Área do Cliente (15/11/2026: "Pode fazer", a lista do Notion, do Asana e do Stripe): uma lista
// curta na Visão geral que a pessoa vai marcando ao fazer, em vez de ler um tour comprido. O que dá para saber pelos
// dados vale em qualquer aparelho (mandou um documento, fez um pedido); o resto (o tour, as telas abertas) fica guardado
// neste navegador, como o tutorial visto. Some quando tudo está feito ou quando a pessoa oculta. Aqui só a regra e a
// memória; a tela só desenha.

/** o que a pessoa faz ao tocar no item */
export type AcaoDoPrimeiroPasso = 'tour' | 'guias' | 'enviar' | 'pedido' | 'empresa';

export interface PrimeiroPasso { id: AcaoDoPrimeiroPasso; rotulo: string; feito: boolean }

export interface Guardado {
  /** as telas que a pessoa já abriu */
  vistas: string[];
  /** concluiu o tour de boas-vindas (o "Concluir", não o "Pular") */
  tour: boolean;
  /** tocou no "x" */
  oculto: boolean;
}

const VAZIO: Guardado = { vistas: [], tour: false, oculto: false };

/** A lista, só com os itens das telas que a área tem; null quando não há o que mostrar (oculta ou tudo feito). */
export function primeirosPassos(e: { abas: readonly string[]; guardado: Guardado; temEnvio: boolean; temPedido: boolean }):
  { itens: PrimeiroPasso[]; feitos: number } | null {
  if (e.guardado.oculto) return null;
  const tem = (aba: string) => e.abas.includes(aba);
  const viu = (aba: string) => e.guardado.vistas.includes(aba);
  const itens: PrimeiroPasso[] = [
    { id: 'tour' as const, rotulo: 'Fazer o tour', feito: e.guardado.tour },
    ...(tem('guias') ? [{ id: 'guias' as const, rotulo: 'Ver as guias', feito: viu('guias') }] : []),
    { id: 'enviar' as const, rotulo: 'Mandar um documento', feito: e.temEnvio },
    ...(tem('chamados') ? [{ id: 'pedido' as const, rotulo: 'Fazer um pedido', feito: e.temPedido }] : []),
    ...(tem('empresa') ? [{ id: 'empresa' as const, rotulo: 'Conferir os dados', feito: viu('empresa') }] : []),
  ];
  const feitos = itens.filter(i => i.feito).length;
  return feitos === itens.length ? null : { itens, feitos };
}

// ---------- a memória neste navegador (por empresa: o token do link) ----------
const CHAVE = 'nads-area-cliente|primeiros-passos';

function todos(): Record<string, Guardado> {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, Guardado> : {};
  } catch {
    return {};
  }
}

export function lerPrimeirosPassos(token: string): Guardado {
  const g = todos()[token];
  return g ? { vistas: Array.isArray(g.vistas) ? g.vistas.filter(v => typeof v === 'string') : [], tour: g.tour === true, oculto: g.oculto === true } : VAZIO;
}

function guardar(token: string, muda: (g: Guardado) => Guardado): Guardado {
  const novo = muda(lerPrimeirosPassos(token));
  try {
    // as 30 empresas mais recentes
    const resto = Object.entries(todos()).filter(([t]) => t !== token).slice(0, 29);
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries([[token, novo], ...resto])));
  } catch { /* sem armazenamento: vale só nesta visita */ }
  return novo;
}

/** a pessoa abriu uma tela (só guarda se for nova) */
export function marcarTelaVista(token: string, aba: string): Guardado {
  const g = lerPrimeirosPassos(token);
  return g.vistas.includes(aba) ? g : guardar(token, x => ({ ...x, vistas: [...x.vistas, aba] }));
}

export const marcarTourConcluido = (token: string): Guardado => guardar(token, x => ({ ...x, tour: true }));
export const ocultarPrimeirosPassos = (token: string): Guardado => guardar(token, x => ({ ...x, oculto: true }));
