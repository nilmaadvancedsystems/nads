// Busca da escolha de empresa: por nome ou código do ERP.
// Origem: conferencia.html candidatosBusca/renderBusca e o Enter do #buscaTxt (~L1620-1668).
import { slug } from '../formatos';
import type { EmpresaDoEscritorio } from './tipos';

/** Empresas que batem com o texto: código exato primeiro, depois código que começa com ele, depois o resto. */
export function buscarEmpresas<T extends EmpresaDoEscritorio>(lista: readonly T[], texto: string): T[] {
  const q = texto.trim().toLowerCase();
  if (!q) return [];
  const peso = (x: T) => { const cod = x.codigo != null ? String(x.codigo) : ''; return cod === q ? 0 : cod.indexOf(q) === 0 ? 1 : 2; };
  return lista
    .filter(x => x.nome.toLowerCase().indexOf(q) > -1 || (x.codigo != null && String(x.codigo).indexOf(q) > -1))
    .map((x, i) => [x, i] as const)
    .sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1])
    .map(x => x[0]);
}

/**
 * Enter no campo: código exato entra direto; uma só empresa achada entra nela.
 * Devolve a empresa, ou o motivo de não entrar.
 */
export function empresaDoEnter<T extends EmpresaDoEscritorio>(lista: readonly T[], texto: string): T | 'varias' | 'nenhuma' | null {
  const q = texto.trim().toLowerCase();
  if (!q) return null;
  const exata = lista.find(x => x.codigo != null && String(x.codigo) === q);
  if (exata) return exata;
  const achadas = buscarEmpresas(lista, q);
  if (achadas.length === 1) return achadas[0];
  return achadas.length ? 'varias' : 'nenhuma';
}

/** Pedaço da URL da empresa: o código do ERP, ou o nome (slug) quando não tem código. */
export function rotaDaEmpresa(x: EmpresaDoEscritorio): string {
  return x.codigo != null ? String(x.codigo) : slug(x.nome);
}

/** A empresa de um pedaço de URL (código ou slug do nome). */
export function empresaPelaRota<T extends EmpresaDoEscritorio>(lista: readonly T[], rota: string): T | null {
  if (/^\d+$/.test(rota)) return lista.find(x => x.codigo != null && String(x.codigo) === rota) || null;
  return lista.find(x => slug(x.nome) === rota) || null;
}
