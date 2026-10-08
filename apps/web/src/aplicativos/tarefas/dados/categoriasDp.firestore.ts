// As categorias novas de obrigações do DP no banco do Entregas: config/dpCategorias {lista, atualizadoEm, atualizadoPor}
// (a regra do config: lê quem é membro, grava o admin).
import { empresas } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoCategoriasDp } from './categoriasDp';
import { guardar } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

export function criarCategoriasDpFirestore(quem: () => string): RepoCategoriasDp {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregada: boolean; lista: readonly empresas.CategoriaDoDp[] } = { carregada: false, lista: [] };
  let ouvindo = false;
  return {
    exemplos: false,
    lista() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(db, 'config', 'dpCategorias'), s => { estado = { carregada: true, lista: empresas.categoriasDoDpDoDocumento(s.data()) }; mudou(); },
          () => { estado = { carregada: true, lista: [] }; mudou(); });
      }
      return estado;
    },
    async salvar(lista) {
      await setDoc(doc(db, 'config', 'dpCategorias'), { lista: lista.map(c => ({ ...c })), atualizadoEm: new Date().toISOString(), atualizadoPor: quem() });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
