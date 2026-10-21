// Os parcelamentos no banco do Entregas: parcelamentos/{id} (a regra: lê e grava quem é membro; criar exige
// criadoPorUid == a pessoa, o clienteId, o órgão da lista, as parcelas, a 1ª parcela AAAA-MM, aberto e pagas; salvar não
// muda o cliente nem quem criou). Os mesmos campos da página Parcelamentos do Entregas.
import { entregas as e } from '@nads/core';
import { collection, doc, onSnapshot, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoParcelamentos } from './parcelamentos';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, finge que gravou
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

export function criarParcelamentosFirestore(quem: () => e.Quem | null): RepoParcelamentos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const porCliente = new Map<string, { carregados: boolean; lista: e.Parcelamento[]; erro: string }>();
  const pessoa = () => { const q = quem(); if (!q) throw new Error('entre com a conta do Entregas'); return q; };
  return {
    exemplos: false,
    doCliente(clienteId) {
      if (!porCliente.has(clienteId)) {
        porCliente.set(clienteId, { carregados: false, lista: [], erro: '' });
        onSnapshot(query(collection(db, 'parcelamentos'), where('clienteId', '==', clienteId)), s => {
          porCliente.set(clienteId, { carregados: true, lista: s.docs.map(d => e.parcelamentoDoDocumento(d.id, d.data())).sort((a, b) => Number(b.aberto) - Number(a.aberto) || a.primeira.localeCompare(b.primeira)), erro: '' });
          mudou();
        }, err => { porCliente.set(clienteId, { carregados: true, lista: [], erro: err.message }); mudou(); });
      }
      return porCliente.get(clienteId)!;
    },
    async criar(clienteId, clienteNome, campos) {
      const q = pessoa();
      const agora = new Date().toISOString();
      await setDoc(doc(collection(db, 'parcelamentos')), { ...campos, clienteId, clienteNome, pagas: {}, criadoEm: agora, criadoPor: q.nome, criadoPorUid: q.uid, atualizadoEm: agora, atualizadoPor: q.nome });
    },
    async salvar(id, campos) {
      const q = pessoa();
      await updateDoc(doc(db, 'parcelamentos', id), { ...campos, atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
