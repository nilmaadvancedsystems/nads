// Achar o cabeçalho (colunas Data e Saldo).
// Origem: cheque_especial.html — normalizeHeader (~L518) e findColumns (~L524).
import type { Colunas } from '../tipos';

/** Minúsculas, sem acento e só letras/dígitos ("Saldo (R$)" → "saldor"). */
export function normalizarCabecalho(s: unknown): string {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Procura nas 10 primeiras linhas a primeira que tem as colunas "Data" e "Saldo" (exatas,
 * depois de normalizar). Se o nome se repete na linha, vale a última coluna.
 */
export function acharColunas(linhas: unknown[][]): Colunas | null {
  const maxLinhas = Math.min(linhas.length, 10);
  for (let r = 0; r < maxLinhas; r++) {
    const linha = linhas[r] || [];
    let colData = -1;
    let colSaldo = -1;
    for (let c = 0; c < linha.length; c++) {
      const h = normalizarCabecalho(linha[c]);
      if (h === 'data') colData = c;
      if (h === 'saldo') colSaldo = c;
    }
    if (colData >= 0 && colSaldo >= 0) return { linhaCabecalho: r, colData, colSaldo };
  }
  return null;
}
