// Os feedbacks sobre a empresa (Vitor, 19/10/2026): o recado do sênior para a equipe na ficha da empresa, com a prioridade.
// As regras (quem escreve, quem resolve, a ordem) estão no core (empresas.feedbacks). Aqui ficam a interface e a versão de
// exemplo, em memória; a do banco é feedbacksDaEmpresa.firestore.ts (coleção feedbacksEmpresa do Entregas).
import { empresas, formatos } from '@nads/core';
import type { ListaAoVivo } from './areaCliente';

type Feedback = empresas.feedbacks.FeedbackDaEmpresa;

export interface FeedbackNovo { empresa: string; codigo: number | null; texto: string; prioridade: empresas.feedbacks.Prioridade }

export interface RepoFeedbacksDaEmpresa {
  exemplos: boolean;
  /** quem está: o uid e o nome (no banco, a conta do Entregas; nos exemplos, o nome escolhido, que também faz de uid) */
  eu(): { uid: string; nome: string } | null;
  /** os abertos de todas as empresas (o selo da lista do Cadastro); pedir já começa a ouvir */
  abertos(): ListaAoVivo<Feedback>;
  /** todos os da empresa (abertos e resolvidos), pelo id do cadastro */
  daEmpresa(empresa: string): ListaAoVivo<Feedback>;
  enviar(f: FeedbackNovo): Promise<void>;
  /** marca como resolvido (true) ou reabre (false) */
  resolver(id: string, resolvido: boolean): Promise<void>;
  apagar(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

// ─── a versão de exemplo, em memória (nada vai para o banco; some ao recarregar) ────────────────────────────────

const ha = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

/** Uns feedbacks para ver a tela nos exemplos (empresas da lista do escritório). */
function exemplos(): Feedback[] {
  const de = (codigo: number) => {
    const e = empresas.EMPRESAS.find(x => x.codigo === codigo);
    return { empresa: formatos.slug(e?.nome || String(codigo)), codigo };
  };
  const base = { resolvido: false, resolvidoPor: '', resolvidoEm: '' };
  return [
    { id: 'fx-1', ...de(462), ...base, prioridade: 'alta', texto: 'O cliente atrasa o extrato do Sicoob todo mês: cobrar até o dia 5, senão a Tarefa para na Importação.', autorUid: 'Vitor', autorNome: 'Vitor', criadoEm: ha(2) },
    { id: 'fx-2', ...de(462), ...base, prioridade: 'baixa', texto: 'Prefere falar pelo WhatsApp do financeiro, não pelo e-mail.', autorUid: 'Fernando', autorNome: 'Fernando', criadoEm: ha(9) },
    { id: 'fx-3', ...de(462), prioridade: 'media', texto: 'As notas de serviço vinham sem retenção; conferido com o cliente e corrigido em setembro.', autorUid: 'Nilma', autorNome: 'Nilma', criadoEm: ha(30), resolvido: true, resolvidoPor: 'Nilma', resolvidoEm: ha(12) },
    { id: 'fx-4', ...de(292), ...base, prioridade: 'media', texto: 'Mudou de banco em outubro (Itaú para Sicredi): conferir as contas no Cadastro antes de importar.', autorUid: 'Fernando', autorNome: 'Fernando', criadoEm: ha(4) },
  ];
}

export function criarFeedbacksDaEmpresaMemoria(quem: () => string): RepoFeedbacksDaEmpresa {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lista = exemplos();
  // as listas só mudam de objeto quando a lista muda (a tela relê a cada versão)
  let cache: { ver: number; abertos: ListaAoVivo<Feedback>; porEmpresa: Map<string, ListaAoVivo<Feedback>> } | null = null;
  const atual = () => {
    if (!cache || cache.ver !== ver) cache = { ver, abertos: { carregada: true, lista: lista.filter(f => !f.resolvido), erro: '' }, porEmpresa: new Map() };
    return cache;
  };
  return {
    exemplos: true,
    eu: () => { const nome = quem(); return nome ? { uid: nome, nome } : null; },
    abertos: () => atual().abertos,
    daEmpresa(empresa) {
      const c = atual();
      let l = c.porEmpresa.get(empresa);
      if (!l) { l = { carregada: true, lista: lista.filter(f => f.empresa === empresa), erro: '' }; c.porEmpresa.set(empresa, l); }
      return l;
    },
    async enviar(f) {
      const nome = quem();
      if (!nome) throw new Error('escolha quem você é');
      lista = [{ id: 'f' + Date.now(), ...f, autorUid: nome, autorNome: nome, criadoEm: new Date().toISOString(), resolvido: false, resolvidoPor: '', resolvidoEm: '' }, ...lista];
      mudou();
    },
    async resolver(id, resolvido) {
      lista = lista.map(f => (f.id === id ? { ...f, resolvido, resolvidoPor: resolvido ? quem() : '', resolvidoEm: resolvido ? new Date().toISOString() : '' } : f));
      mudou();
    },
    async apagar(id) {
      lista = lista.filter(f => f.id !== id);
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
