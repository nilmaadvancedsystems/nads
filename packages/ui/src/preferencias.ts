// Preferências de quem usa, neste navegador (a Minha página › Aparência e telas, 02/10/2026): a barra lateral começa
// recolhida e as tabelas compactas. A barra lateral já guardava o estado em 'nads-barra-lateral-oculta' (casca.tsx);
// aqui ela muda na hora também (a casca ouve o evento 'nads-lateral').

const CHAVE_LATERAL = 'nads-barra-lateral-oculta';
const CHAVE_COMPACTAS = 'nads-tabelas-compactas';

function ler(chave: string): boolean {
  try { return localStorage.getItem(chave) === '1'; } catch { return false; }
}
function gravar(chave: string, v: boolean) {
  try { localStorage.setItem(chave, v ? '1' : '0'); } catch { /* sem storage: vale só agora */ }
}

export const lerLateralOculta = (): boolean => ler(CHAVE_LATERAL);
/** Recolhe (ou abre) a barra lateral, já na tela aberta e nas próximas. */
export function definirLateralOculta(oculta: boolean): void {
  gravar(CHAVE_LATERAL, oculta);
  window.dispatchEvent(new Event('nads-lateral'));
}

export const lerTabelasCompactas = (): boolean => ler(CHAVE_COMPACTAS);
/** Tabelas compactas (linhas mais baixas): a classe no <html>, já na tela aberta. */
export function definirTabelasCompactas(sim: boolean): void {
  gravar(CHAVE_COMPACTAS, sim);
  aplicarTabelasCompactas();
}
/** Aplica o que está guardado (ao abrir o app). */
export function aplicarTabelasCompactas(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('tabelas-compactas', lerTabelasCompactas());
}
