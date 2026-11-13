// As solicitações de reunião no banco do Entregas (coleção nadsSolicitacoes; 13/11/2026). Quem pede lê as suas (porUid);
// quem aprova (o Diretor e o Dono) lê todas. A regra ainda não está no ar: até o Vitor aprovar, o banco recusa e a lista fica
// vazia (no modo desenvolvedor nada grava mesmo).
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where, type QuerySnapshot } from 'firebase/firestore';
import { tarefas } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { solicitacaoNova, type RepoSolicitacoes } from './solicitacoes';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

const COLECAO = 'nadsSolicitacoes';
type Solicitacao = tarefas.solicitacoes.SolicitacaoDeReuniao;
const texto = (v: unknown) => (v == null ? '' : String(v));

function lerSolicitacoes(s: QuerySnapshot): Solicitacao[] {
  return s.docs.map(d => {
    const x = d.data();
    const situacao = x.situacao === 'aprovada' || x.situacao === 'recusada' ? x.situacao : 'pendente';
    return {
      id: d.id, titulo: texto(x.titulo), texto: texto(x.texto), quando: texto(x.quando), por: texto(x.por), porUid: texto(x.porUid), em: texto(x.em), situacao,
      ...(x.link ? { link: texto(x.link) } : {}),
      ...(x.decididoPor ? { decididoPor: texto(x.decididoPor), decididoEm: texto(x.decididoEm) } : {}),
      ...(x.observacao ? { observacao: texto(x.observacao) } : {}),
    };
  });
}

export function criarSolicitacoesFirestore(quem: () => { uid: string; nome: string } | null): RepoSolicitacoes {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const estados = new Map<string, { carregadas: boolean; solicitacoes: Solicitacao[] }>();
  const eu = () => { const q = quem(); if (!q) throw new Error('entre com a sua conta'); return q; };
  return {
    exemplos: false,
    lista(todas) {
      const uid = quem()?.uid || '';
      const chave = todas ? '*' : uid;
      const ja = estados.get(chave);
      if (ja) return ja;
      estados.set(chave, { carregadas: false, solicitacoes: [] });
      const q = todas ? query(collection(db, COLECAO), orderBy('em', 'desc'), limit(100)) : query(collection(db, COLECAO), where('porUid', '==', uid));
      onSnapshot(q, s => { estados.set(chave, { carregadas: true, solicitacoes: tarefas.solicitacoes.ordenarSolicitacoes(lerSolicitacoes(s)) }); mudou(); },
        e => { console.warn('As solicitações não abriram:', e instanceof Error ? e.message : e); estados.set(chave, { carregadas: true, solicitacoes: [] }); mudou(); });
      return estados.get(chave)!;
    },
    async solicitar(p) {
      const problema = tarefas.solicitacoes.problemaDaSolicitacao(p);
      if (problema) throw new Error(problema);
      const ref = doc(collection(db, COLECAO));
      const { id: _id, ...dados } = solicitacaoNova(p, eu(), ref.id, new Date().toISOString());
      await setDoc(ref, dados);
    },
    async decidir(id, aprovar, observacao) {
      const atual = [...estados.values()].flatMap(e => e.solicitacoes).find(s => s.id === id);
      if (!atual) throw new Error('a solicitação não existe mais');
      const decidida = tarefas.solicitacoes.decidir(atual, aprovar, observacao, eu().nome, new Date().toISOString());
      await updateDoc(doc(db, COLECAO, id), { situacao: decidida.situacao, decididoPor: decidida.decididoPor, decididoEm: decidida.decididoEm, ...(decidida.observacao ? { observacao: decidida.observacao } : {}) });
      return decidida;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
