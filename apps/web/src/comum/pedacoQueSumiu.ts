// O pedaço do site que sumiu: uma aba aberta antes de uma publicação pede um arquivo .js da versão anterior, que a
// hospedagem já não tem ("Failed to fetch dynamically imported module", "Importing a module script failed", ...).
// O único jeito é recarregar a página (pega a versão nova). Recarrega uma vez só a cada 30 s: se o pedaço faltar de
// verdade, o erro aparece, sem ficar recarregando sem parar. Usado no main.tsx (vite:preloadError) e no ErroDaTela
// (o pedaço de uma tela, carregado pelo lazy da rota).
const CHAVE = 'nads-recarregou';
const INTERVALO_MS = 30_000;

const MENSAGENS = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** O erro é de um pedaço do site (.js/.css) que não carregou. */
export function ehPedacoQueSumiu(erro: unknown): boolean {
  if (!erro) return false;
  const texto = erro instanceof Error ? erro.name + ' ' + erro.message : typeof erro === 'string' ? erro : '';
  return MENSAGENS.test(texto);
}

/** Não recarregou nos últimos 30 s (só lê; quem recarrega é o recarregarUmaVez). */
export function podeRecarregarSozinho(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(CHAVE) || 0) >= INTERVALO_MS;
  } catch { return false; }
}

/** Recarrega a página, se não recarregou nos últimos 30 s; devolve se recarregou. */
export function recarregarUmaVez(): boolean {
  if (!podeRecarregarSozinho()) return false;
  try { sessionStorage.setItem(CHAVE, String(Date.now())); } catch { return false; }
  window.location.reload();
  return true;
}
