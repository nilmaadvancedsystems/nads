// O nome da empresa para mostrar (13/11/2026): a razão social trocada no Cadastro › Empresa vale no lugar do nome da
// lista. O nome da lista continua a chave (o slug dele acha os dados da empresa); a razão social é só para a tela e a
// busca. Quem sabe as razões trocadas é o cadastro (no site, o dados/fonte.ts liga com usarRazoesSociais).
import type { EmpresaDoEscritorio } from './tipos';

let razaoDe: (nome: string) => string = () => '';

/** Liga a razão social trocada no cadastro (pelo nome-chave da empresa; '' = não foi trocada). */
export function usarRazoesSociais(fn: (nome: string) => string): void {
  razaoDe = fn;
}

/** O nome para mostrar: a razão social trocada no cadastro; sem ela, o nome da lista. */
export function nomeParaMostrar(e: Pick<EmpresaDoEscritorio, 'nome'> | string): string {
  const nome = typeof e === 'string' ? e : e.nome;
  return razaoDe(nome) || nome;
}
