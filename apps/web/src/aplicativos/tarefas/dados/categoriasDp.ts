// As categorias novas de obrigações do DP (Vitor, 07/10/2026: "uma opção onde posso criar novas categorias"): a lista
// em config/dpCategorias do Entregas (o admin grava; todos leem). Interface + a versão de exemplo; a do banco é
// categoriasDp.firestore.ts.
import type { empresas } from '@nads/core';

export interface RepoCategoriasDp {
  exemplos: boolean;
  /** a lista (pedir já começa a ouvir) */
  lista(): { carregada: boolean; lista: readonly empresas.CategoriaDoDp[] };
  salvar(lista: readonly empresas.CategoriaDoDp[]): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarCategoriasDpMemoria(): RepoCategoriasDp {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let lista: readonly empresas.CategoriaDoDp[] = [];
  return {
    exemplos: true,
    lista: () => ({ carregada: true, lista }),
    async salvar(nova) { lista = [...nova]; ver++; for (const f of ouvintes) f(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
