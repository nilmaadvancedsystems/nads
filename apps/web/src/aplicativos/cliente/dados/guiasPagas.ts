// As guias que o cliente marcou como pagas neste aparelho (26/11/2026; o dono: "isso ja passou, tem como eu fazer um jeito
// de remover isso da tela em algum botao? caso a pessoa ja tenha pago por exemplo"). O "Já paguei" tira a guia do "A pagar"
// (no Início e na aba Guias) sem esperar o extrato: fica guardado aqui (localStorage), por empresa (o token do link), como
// o lido do sino (sinoLido.ts). Sem acesso ao armazenamento (janela anônima, bloqueio), a tela funciona igual, só não lembra.
const CHAVE = 'nads-area-cliente|guias-pagas';
/** quantas guias por empresa e quantas empresas guardar */
const MAXIMO_DE_GUIAS = 300;
const MAXIMO_DE_EMPRESAS = 30;

type Guardado = [token: string, ids: string[]][];

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

/** As guias que esta empresa marcou como pagas neste aparelho. */
export function guiasPagasAqui(token: string): Set<string> {
  return new Set(ler().find(([t]) => t === token)?.[1] ?? []);
}

/** Guarda (a empresa mais recente na frente; as mais antigas saem do fim). Devolve o conjunto novo. */
export function guardarGuiaPaga(token: string, id: string): Set<string> {
  const antes = ler().filter(([t]) => t !== token);
  const ids = [...new Set([id, ...(ler().find(([t]) => t === token)?.[1] ?? [])])].slice(0, MAXIMO_DE_GUIAS);
  try { localStorage.setItem(CHAVE, JSON.stringify([[token, ids], ...antes].slice(0, MAXIMO_DE_EMPRESAS))); } catch { /* sem armazenamento: vale só agora */ }
  return new Set(ids);
}
