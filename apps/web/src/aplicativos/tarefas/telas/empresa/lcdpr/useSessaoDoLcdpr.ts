// A sessão do LCDPR: os lançamentos importados, os arquivos lidos, a seleção, a busca e o filtro. Como na página antiga
// do Entregas, nada disso é gravado (nem no banco, nem no navegador): são recriados reimportando os relatórios do SIEG.
// Fica fora da tela para sobreviver à troca de página do LCDPR (Lançamentos → Categorias → volta); recarregar a página zera.
import type { lcdpr } from '@nads/core';
import { useSyncExternalStore } from 'react';

/** Um arquivo lido: o nome, quando, quantos entraram, o que deu errado e quais lançamentos vieram dele (o Desfazer). */
export interface ImportacaoDoLcdpr { id: string; arquivo: string; bytes: number; em: string; quantos: number; erro: string; ids: number[]; desfeita: string }

export interface SessaoDoLcdpr {
  lancamentos: readonly lcdpr.Lancamento[];
  importacoes: readonly ImportacaoDoLcdpr[];
  selecionados: ReadonlySet<number>;
  busca: string;
  soRevisar: boolean;
}

let sessao: SessaoDoLcdpr = { lancamentos: [], importacoes: [], selecionados: new Set(), busca: '', soRevisar: false };
let proximo = 1;
const ouvintes = new Set<() => void>();

export const lerSessao = () => sessao;
/** O id do próximo lançamento (não repete na sessão). */
export const novoIdDeLancamento = () => proximo++;
export function mudarSessao(f: (s: SessaoDoLcdpr) => SessaoDoLcdpr): void {
  sessao = f(sessao);
  for (const o of ouvintes) o();
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

/** A sessão, ao vivo. */
export function useSessaoDoLcdpr(): SessaoDoLcdpr {
  return useSyncExternalStore(assinar, lerSessao, lerSessao);
}
