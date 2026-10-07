// Os feedbacks do nads (Vitor, 07/10/2026: "uma função de feedbacks, onde a pessoa pode tirar a foto e explicar o que
// quer melhorar"): o print da tela (a imagem já comprimida), o texto, a tela onde estava, a versão e quem mandou. O admin
// vê todos em Cadastro › Feedbacks e marca como visto ou feito. Interface + a versão de exemplo; a do banco é
// feedback.firestore.ts (coleção feedbacks do Entregas).

export type SituacaoDoFeedback = 'novo' | 'visto' | 'feito';

export interface Feedback {
  id: string;
  texto: string;
  /** o print, em data URL (JPEG comprimido) — vazio se não mandou imagem */
  imagem: string;
  /** a tela onde a pessoa estava (o caminho) */
  tela: string;
  versao: string;
  nome: string;
  email: string;
  /** ISO */
  criadoEm: string;
  status: SituacaoDoFeedback;
}

export interface RepoFeedback {
  exemplos: boolean;
  enviar(f: { texto: string; imagem: string; tela: string; versao: string }): Promise<void>;
  /** todos os feedbacks (só o admin lê); pedir já começa a ouvir */
  todos(): { carregados: boolean; lista: Feedback[] };
  marcar(id: string, status: SituacaoDoFeedback): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarFeedbackMemoria(quem: () => string): RepoFeedback {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista: Feedback[] = [];
  return {
    exemplos: true,
    async enviar(f) {
      lista = [{ id: 'f' + Date.now(), ...f, nome: quem(), email: '', criadoEm: new Date().toISOString(), status: 'novo' }, ...lista];
      mudou();
    },
    todos: () => ({ carregados: true, lista }),
    async marcar(id, status) { lista = lista.map(x => (x.id === id ? { ...x, status } : x)); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
