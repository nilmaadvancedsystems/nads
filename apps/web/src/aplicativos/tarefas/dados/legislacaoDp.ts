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
  /** excluída (Vitor, 04/11/2026): some da lista, mas o documento fica (o banco não deixa apagar), com quem e quando */
  excluida?: boolean;
  excluidaEm?: string;
  excluidaPor?: string;
}

export type LegislacaoParaSalvar = Pick<LegislacaoNoBanco, 'assunto' | 'texto' | 'observacoes'> & { id?: string; data?: string };

export interface RepoLegislacaoDp {
  exemplos: boolean;
  /** as do banco (pedir já começa a ouvir) */
  lista(): { carregada: boolean; lista: readonly LegislacaoNoBanco[] };
  /** sem id: uma nova; devolve o id */
  salvar(l: LegislacaoParaSalvar): Promise<string>;
  /** marca como excluída (o texto vai junto: a regra do banco pede assunto, texto e data em toda gravação) */
  excluir(l: LegislacaoParaSalvar & { id: string }): Promise<void>;
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
    async excluir(l) {
      const agora = new Date().toISOString();
      const doc: LegislacaoNoBanco = { id: l.id, assunto: l.assunto, texto: l.texto, observacoes: l.observacoes, data: l.data || hoje(), atualizadoEm: agora, atualizadoPor: 'exemplo', excluida: true, excluidaEm: agora, excluidaPor: 'exemplo' };
      lista = [...lista.filter(x => x.id !== l.id), doc];
      ver++;
      for (const f of ouvintes) f();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
