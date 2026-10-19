// Os feedbacks sobre a empresa no banco do Entregas (Vitor, 19/10/2026), coleção feedbacksEmpresa (regra em firestore.rules):
//   feedbacksEmpresa/{auto} { empresa, codigo, texto, prioridade, autorUid, autorNome, criadoEm, resolvido, resolvidoPor?, resolvidoEm? }
// A equipe do nads lê; o sênior, o diretor e o admin criam (com o próprio uid e a hora do servidor); o autor, o diretor e
// o admin marcam como resolvido (ou reabrem) e apagam. Duas escutas, cada uma num campo só (sem índice composto): os
// abertos de todas as empresas (o selo da lista) e os da empresa aberta (abertos e resolvidos).
import { empresas } from '@nads/core';
import {
  addDoc as addDocBruto, collection, deleteDoc as deleteDocBruto, deleteField, doc, onSnapshot, query, serverTimestamp,
  updateDoc as updateDocBruto, where, type Query,
} from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { ListaAoVivo } from './areaCliente';
import type { RepoFeedbacksDaEmpresa } from './feedbacksDaEmpresa';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado (o criar avisa que foi recusado)
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

type Feedback = empresas.feedbacks.FeedbackDaEmpresa;
type Quem = { uid: string; nome: string } | null;

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
/** o instante do banco como ISO (o Timestamp do Firestore; o que ainda não voltou do servidor vem estimado) */
const instante = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') return ((v as { toDate: () => Date }).toDate()).toISOString();
  return '';
};

function ler(id: string, x: Record<string, unknown>): Feedback | null {
  const t = texto(x.texto);
  const empresa = texto(x.empresa);
  if (!t || !empresa) return null;
  return {
    id, empresa, codigo: typeof x.codigo === 'number' ? x.codigo : null, texto: t,
    prioridade: empresas.feedbacks.ehPrioridade(x.prioridade) ? x.prioridade : 'media',
    autorUid: texto(x.autorUid), autorNome: texto(x.autorNome), criadoEm: instante(x.criadoEm),
    resolvido: x.resolvido === true, resolvidoPor: texto(x.resolvidoPor), resolvidoEm: instante(x.resolvidoEm),
  };
}

export function criarFeedbacksDaEmpresaFirestore(quem: () => Quem): RepoFeedbacksDaEmpresa {
  const db = bancoDoEntregas();
  const colecao = collection(db, 'feedbacksEmpresa');
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  /** Uma consulta ao vivo, que só começa a ouvir quando alguém pede (e conta o erro da regra, em vez de esconder). */
  function aoVivo(consulta: Query) {
    let estado: ListaAoVivo<Feedback> = { carregada: false, lista: [], erro: '' };
    let ouvindo = false;
    return () => {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(consulta, s => {
          // a hora do servidor que ainda não voltou vem estimada (o feedback novo aparece na hora, com a data certa)
          const lista = s.docs.map(d => ler(d.id, d.data({ serverTimestamps: 'estimate' }))).filter((x): x is Feedback => x != null);
          estado = { carregada: true, lista, erro: '' };
          mudou();
        }, e => { estado = { carregada: true, lista: [], erro: e.message }; mudou(); });
      }
      return estado;
    };
  }

  const abertos = aoVivo(query(colecao, where('resolvido', '==', false)));
  const porEmpresa = new Map<string, () => ListaAoVivo<Feedback>>();

  return {
    exemplos: false,
    eu: quem,
    abertos,
    daEmpresa(empresa) {
      let l = porEmpresa.get(empresa);
      if (!l) { l = aoVivo(query(colecao, where('empresa', '==', empresa))); porEmpresa.set(empresa, l); }
      return l();
    },
    async enviar(f) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      await addDoc(colecao, {
        empresa: f.empresa, codigo: f.codigo, texto: empresas.feedbacks.textoDoFeedback(f.texto), prioridade: f.prioridade,
        autorUid: q.uid, autorNome: q.nome, criadoEm: serverTimestamp(), resolvido: false,
      });
    },
    async resolver(id, resolvido) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      await updateDoc(doc(colecao, id), resolvido
        ? { resolvido: true, resolvidoPor: q.nome, resolvidoEm: serverTimestamp() }
        : { resolvido: false, resolvidoPor: deleteField(), resolvidoEm: deleteField() });
    },
    async apagar(id) { await deleteDoc(doc(colecao, id)); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
