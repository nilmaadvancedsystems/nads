// O mural de avisos no banco do Entregas (coleção nadsAvisos; regra em firestore.rules): toda a equipe no nads lê; só o
// admin e o diretor criam, fixam e apagam. Sem a regra no ar, o banco recusa: o mural fica vazio e publicar avisa o erro.
import { collection, deleteDoc as deleteDocBruto, doc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto } from 'firebase/firestore';
import { tarefas as t } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoAvisos } from './avisos';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

const texto = (v: unknown) => (v == null ? '' : String(v));

export function criarAvisosFirestore(): RepoAvisos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregados: boolean; avisos: t.AvisoDoEscritorio[] } | null = null;
  return {
    exemplos: false,
    lista() {
      if (!estado) {
        estado = { carregados: false, avisos: [] };
        onSnapshot(query(collection(db, 'nadsAvisos'), orderBy('em', 'desc'), limit(50)), s => {
          estado = { carregados: true, avisos: s.docs.map(d => { const x = d.data(); return { id: d.id, texto: texto(x.texto), por: texto(x.por), em: texto(x.em), fixado: x.fixado === true }; }) };
          mudou();
        }, e => {
          console.warn('O mural de avisos não abriu:', e instanceof Error ? e.message : e);
          estado = { carregados: true, avisos: [] };
          mudou();
        });
      }
      return estado;
    },
    async publicar(textoDoAviso, por) {
      const problema = t.problemaDoAviso(textoDoAviso);
      if (problema) throw new Error(problema);
      await setDoc(doc(collection(db, 'nadsAvisos')), { texto: t.limparAviso(textoDoAviso), por, em: new Date().toISOString(), fixado: false });
    },
    async fixar(id, fixado) { await updateDoc(doc(db, 'nadsAvisos', id), { fixado }); },
    async apagar(id) { await deleteDoc(doc(db, 'nadsAvisos', id)); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
