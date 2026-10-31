// A legislação do DP cadastrada no nads (Vitor, 14/10/2026: "coloque o botão de cadastro de legislação"): as novas e as do
// Toriba editadas (que ficam por cima do texto do core), em legislacaoDp/{id} do Entregas (o DP e o admin gravam; a equipe
// lê). Interface + a versão de exemplo; a do banco é legislacaoDp.firestore.ts.
import { formatos } from '@nads/core';

/** O documento do banco: id 'toriba-<n>' = uma das do Toriba editada; outro id = uma nova. */
export interface LegislacaoNoBanco {
  id: string;
  assunto: string;
  texto: string;
  observacoes: string;
  /** 'aaaa-mm-dd' */
  data: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

export type LegislacaoParaSalvar = Pick<LegislacaoNoBanco, 'assunto' | 'texto' | 'observacoes'> & { id?: string; data?: string };

export interface RepoLegislacaoDp {
  exemplos: boolean;
  /** as do banco (pedir já começa a ouvir) */
  lista(): { carregada: boolean; lista: readonly LegislacaoNoBanco[] };
  /** sem id: uma nova; devolve o id */
  salvar(l: LegislacaoParaSalvar): Promise<string>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

// o dia em Brasília (o ISO é UTC: depois das 21h dava amanhã; 31/10/2026)
const hoje = () => formatos.diaEmBrasilia();

export function criarLegislacaoDpMemoria(): RepoLegislacaoDp {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let lista: LegislacaoNoBanco[] = [];
  return {
    exemplos: true,
    lista: () => ({ carregada: true, lista }),
    async salvar(l) {
      const id = l.id || 'ex-' + Date.now();
      const doc: LegislacaoNoBanco = { id, assunto: l.assunto, texto: l.texto, observacoes: l.observacoes, data: l.data || hoje(), atualizadoEm: new Date().toISOString(), atualizadoPor: 'exemplo' };
      lista = [...lista.filter(x => x.id !== id), doc];
      ver++;
      for (const f of ouvintes) f();
      return id;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
