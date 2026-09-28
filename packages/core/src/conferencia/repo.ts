// O que as telas da Conferência podem pedir e gravar. A tela nunca sabe onde o dado mora.
// Implementações: repo.memoria.ts (exemplos, só no navegador) e, no app,
// apps/web/src/dados/conferencia.firestore.ts (o mesmo banco da conferencia-nilma.web.app).
import { slug } from '../formatos';
import type { Empresa, EmpresaDaLista } from './tipos';

/** A empresa que a URL aponta. codigo = o da URL (o mesmo nome pode ter dois códigos). */
export interface EmpresaNaRota { nome: string; codigo: number | null; rota: string }

export interface RepoConferencia {
  /** true = dados de exemplo (nada vai para o banco). */
  readonly exemplos: boolean;
  /** Já carregou? Antes disso nada pode ser gravado (evita regravar empresa vazia). */
  pronto(): boolean;
  /** Lista da tela de entrada: as empresas da lista + as que já têm dado guardado. */
  listarEmpresas(): EmpresaDaLista[];
  /** Empresa pelo nome (null se nunca foi aberta). */
  obter(nome: string): Empresa | null;
  /** Empresa pelo pedaço da URL: o código do ERP (ex.: "292") ou, sem código, o slug do nome. */
  empresaPelaRota(rota: string): EmpresaNaRota | null;
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

/**
 * Pedaço da URL de uma empresa: o código do ERP; sem código na lista, o slug do nome.
 * Quando o mesmo nome tem dois códigos (ex.: 79 e 145), vale o primeiro — os dois abrem os
 * mesmos dados, como no original (os dados são guardados pelo nome).
 */
export function rotaDaEmpresa(lista: readonly EmpresaDaLista[], nome: string): string {
  const c = lista.find(x => x.nome === nome && x.codigo != null);
  return c ? String(c.codigo) : slug(nome);
}

/** Resolve a URL: número = código da lista; senão, slug de um nome da lista ou do banco. */
export function empresaPelaRota(lista: readonly EmpresaDaLista[], nomesGuardados: string[], rota: string): EmpresaNaRota | null {
  if (/^\d+$/.test(rota)) {
    const c = lista.find(x => x.codigo != null && String(x.codigo) === rota);
    return c ? { nome: c.nome, codigo: c.codigo, rota } : null;
  }
  const nome = nomesGuardados.concat(lista.map(x => x.nome)).find(n => slug(n) === rota);
  if (!nome) return null;
  const r = rotaDaEmpresa(lista, nome);
  return { nome, codigo: /^\d+$/.test(r) ? Number(r) : null, rota: r };
}
