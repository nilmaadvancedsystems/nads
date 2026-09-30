// Os endereços do nads que podem conversar entre si (a Tarefas e as ferramentas abertas dentro das etapas):
// *-nilma.web.app, as prévias deles e o próprio endereço, no desenvolvimento.
const NADS = /^https:\/\/[a-z0-9-]+-nilma(--[a-z0-9-]+)?\.web\.app$/;

/** Endereço do nads (ou o mesmo da página, no desenvolvimento)? */
export function origemConfiavel(origem: string): boolean {
  return origem === window.location.origin || NADS.test(origem);
}

/** O endereço da página de fora, quando esta está dentro de um iframe de uma página do nads. */
export function origemDoPai(): string | null {
  if (window.parent === window) return null;
  let origem: string | null = window.location.ancestorOrigins?.[0] || null;
  if (!origem) { try { origem = document.referrer ? new URL(document.referrer).origin : null; } catch { origem = null; } }
  return origem && origemConfiavel(origem) ? origem : null;
}
