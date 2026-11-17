// O tutorial da Área do Cliente abre sozinho na primeira vez que a empresa abre a área neste aparelho (13/11/2026; antes,
// o cartão das boas-vindas). Fica só no navegador (localStorage), como a lista das empresas; sem acesso ao armazenamento
// (janela anônima, bloqueio), abre em toda visita, e o "Agora não" fecha.
const CHAVE = 'nads-area-cliente|tutorial';

function vistos(): string[] {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(x) ? x.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** já viu (ou pulou) o tutorial desta empresa (o token do link) neste aparelho */
export function jaViuOTutorial(token: string): boolean {
  return vistos().includes(token);
}

/** guarda que viu (no máximo as 30 últimas empresas) */
export function marcarTutorialVisto(token: string): void {
  try { localStorage.setItem(CHAVE, JSON.stringify([token, ...vistos().filter(t => t !== token)].slice(0, 30))); } catch { /* sem armazenamento */ }
}
