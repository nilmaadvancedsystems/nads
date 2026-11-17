// As empresas que a pessoa já abriu neste aparelho (12/11/2026, a troca de empresa no topo da Área do Cliente). Fica só no
// navegador (localStorage), nunca no banco: o link de cada empresa é o segredo dela, e quem tem os links já os tem no
// histórico. Sem acesso ao armazenamento (janela anônima, bloqueio), a lista fica vazia e a troca não aparece.
import type { PerfilGuardado } from './regras';

const CHAVE = 'nads-area-cliente|perfis';

export function lerPerfis(): PerfilGuardado[] {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(x) ? (x as PerfilGuardado[]) : [];
  } catch {
    return [];
  }
}

export function guardarPerfis(lista: readonly PerfilGuardado[]): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* sem armazenamento: a troca só não lembra */ }
}
