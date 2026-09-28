// O que as telas da Conferência podem pedir e gravar. A tela nunca sabe onde o dado mora.
// Implementações: repo.memoria.ts (exemplos, só no navegador) e, no app,
// apps/web/src/dados/conferencia.firestore.ts (o mesmo banco da conferencia-nilma.web.app).
import type { Empresa, EmpresaDaLista } from './tipos';

export interface RepoConferencia {
  /** true = dados de exemplo (nada vai para o banco). */
  readonly exemplos: boolean;
  /** Já carregou? Antes disso nada pode ser gravado (evita regravar empresa vazia). */
  pronto(): boolean;
  /** Lista da tela de entrada: as empresas da lista + as que já têm dado guardado. */
  listarEmpresas(): EmpresaDaLista[];
  /** Empresa pelo nome (null se nunca foi aberta). */
  obter(nome: string): Empresa | null;
  /** Nome da empresa pelo slug da URL. */
  nomePorSlug(slug: string): string | null;
  /** Guarda a empresa inteira (as ações já devolvem a versão nova). */
  salvar(e: Empresa): void;
  /** Avisa quem está ouvindo a cada mudança. Devolve "parar de ouvir". */
  assinar(aoMudar: () => void): () => void;
  /** Número que muda a cada gravação (para o React saber que precisa redesenhar). */
  versao(): number;
  /** Volta os dados de exemplo ao estado inicial (só no modo exemplos). */
  restaurarExemplos(): void;
}

/** Lista da entrada: a lista fixa + as empresas guardadas que não estão nela (em ordem de nome). */
export function montarListaEmpresas(lista: readonly EmpresaDaLista[], nomesGuardados: string[]): EmpresaDaLista[] {
  const vistos: Record<string, 1> = {};
  const l = lista.map(c => { vistos[c.nome] = 1; return c; });
  for (const n of nomesGuardados.slice().sort()) if (!vistos[n]) l.push({ codigo: null, nome: n, regime: '' });
  return l;
}
