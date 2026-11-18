// As solicitações que a empresa já avaliou neste aparelho (plano do Acessórias, 18/11/2026, ficha
// avaliacao-do-atendimento): a nota dada, para mostrar "Obrigado pela avaliação" em vez das estrelas. Fica no
// localStorage, por empresa (o token do link), como os lidos do sino (sinoLido.ts). A nota que vale é a do escritório
// (o robô grava no chamado); isto é só a lembrança do aparelho. Sem armazenamento, as estrelas voltam (avaliar de novo
// substitui).
const CHAVE = 'nads-area-cliente|avaliadas';
const MAXIMO_POR_EMPRESA = 100;
const MAXIMO_DE_EMPRESAS = 30;

type Guardado = [token: string, notas: Record<string, number>][];

function ler(): Guardado {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    if (!Array.isArray(x)) return [];
    return x.filter((p): p is [string, Record<string, unknown>] => Array.isArray(p) && typeof p[0] === 'string' && !!p[1] && typeof p[1] === 'object')
      .map(([t, n]) => [t, Object.fromEntries(Object.entries(n).filter(([, v]) => typeof v === 'number' && v >= 1 && v <= 5)) as Record<string, number>]);
  } catch {
    return [];
  }
}

/** As notas que esta empresa já deu neste aparelho (id do chamado -> nota). */
export function notasDadas(token: string): Record<string, number> {
  return { ...(ler().find(([t]) => t === token)?.[1] ?? {}) };
}

/** Guarda a nota (a última vale). */
export function guardarNota(token: string, chamadoId: string, nota: number): void {
  try {
    const todas = ler();
    const antes = todas.find(([t]) => t === token)?.[1] ?? {};
    const sem = Object.entries(antes).filter(([id]) => id !== chamadoId).slice(-(MAXIMO_POR_EMPRESA - 1));
    const notas = Object.fromEntries([...sem, [chamadoId, nota]]);
    localStorage.setItem(CHAVE, JSON.stringify([[token, notas], ...todas.filter(([t]) => t !== token)].slice(0, MAXIMO_DE_EMPRESAS)));
  } catch { /* sem armazenamento: não lembra */ }
}
