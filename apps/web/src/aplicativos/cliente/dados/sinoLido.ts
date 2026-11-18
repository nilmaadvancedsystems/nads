// O "lido" do sino da Área do Cliente que não volta a cada visita (plano do Acessórias, 17/11/2026, ficha
// aviso-de-resposta, parte A; frase do dono: "Seguir para a 2" / "pode ir fazendo"). Antes o "Marcar como lidas" valia só
// na página: recarregou, voltava tudo. Agora os avisos lidos ficam guardados neste aparelho (localStorage), por empresa
// (o token do link), como o tutorial (tutorialVisto.ts). Sem acesso ao armazenamento (janela anônima, bloqueio), a tela
// funciona igual, só não lembra.
// O aviso de resposta já leva o número de mensagens no id ('c-<chamado>-<n>'): uma resposta nova do escritório no mesmo
// pedido muda o id e o aviso aparece de novo. Não é chat (R4): o aviso só aponta para a solicitação.
const CHAVE = 'nads-area-cliente|sino';
/** quantos avisos lidos por empresa e quantas empresas guardar */
export const MAXIMO_DE_LIDAS = 200;
export const MAXIMO_DE_EMPRESAS = 30;

type Guardado = [token: string, lidas: string[]][];

function ler(): Guardado {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    if (!Array.isArray(x)) return [];
    return x.filter((p): p is [string, string[]] => Array.isArray(p) && typeof p[0] === 'string' && Array.isArray(p[1]))
      .map(([t, ids]) => [t, ids.filter((i): i is string => typeof i === 'string')]);
  } catch {
    return [];
  }
}

/** Os avisos que esta empresa já leu neste aparelho. */
export function lidasDoSino(token: string): Set<string> {
  return new Set(ler().find(([t]) => t === token)?.[1] ?? []);
}

/** Guarda os lidos desta empresa (os mais novos primeiro; no máximo 200 por empresa e as 30 últimas empresas). */
export function guardarLidas(token: string, ids: readonly string[]): void {
  try {
    const unicos = [...new Set(ids)].slice(-MAXIMO_DE_LIDAS);
    const outras = ler().filter(([t]) => t !== token);
    localStorage.setItem(CHAVE, JSON.stringify([[token, unicos], ...outras].slice(0, MAXIMO_DE_EMPRESAS)));
  } catch { /* sem armazenamento: não lembra */ }
}

/** Dos lidos, só os que ainda aparecem no sino (o resto é aviso que já sumiu e não precisa ficar guardado). */
export function soAsQueAindaExistem(lidas: ReadonlySet<string>, avisos: readonly { id: string }[]): string[] {
  return avisos.map(a => a.id).filter(id => lidas.has(id));
}
