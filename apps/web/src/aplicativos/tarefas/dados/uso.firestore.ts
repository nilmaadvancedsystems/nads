// O mapa de uso do sistema no banco do Entregas (Gustavo, 20/10/2026):
//   config/uso   { ligado, atualizadoEm, atualizadoPor }   o interruptor (a regra do config: lê quem é membro, grava o admin)
//   uso/{dia}    { dia, telas, pessoas, atualizadoEm }      os contadores do dia, somados com increment (um documento por
//                dia, nunca um por clique). A regra de uso/ ainda não está publicada: até lá a gravação falha e é
//                descartada em silêncio (o que se juntou volta para a memória e tenta de novo na próxima vez).
import { uso } from '@nads/core';
import { collection, doc, getDocs, increment, onSnapshot, query, setDoc as setDocBruto, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoUso } from './uso';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

/** os contadores como increment; mapa vazio fica de fora (no merge, um mapa vazio apagaria o que já estava) */
function comIncremento(m: Record<string, number>): Record<string, ReturnType<typeof increment>> | null {
  const r = Object.fromEntries(Object.entries(m).map(([k, n]) => [k, increment(n)]));
  return Object.keys(r).length ? r : null;
}

export function criarUsoFirestore(quem: () => string): RepoUso {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado = { carregado: false, ligado: false };
  let ouvindo = false;
  return {
    exemplos: false,
    ligado() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(db, 'config', 'uso'), s => { estado = { carregado: true, ligado: s.data()?.ligado === true }; mudou(); },
          () => { estado = { carregado: true, ligado: false }; mudou(); });
      }
      return estado;
    },
    async ligar(ligado) {
      await setDoc(doc(db, 'config', 'uso'), { ligado, atualizadoEm: new Date().toISOString(), atualizadoPor: quem() });
    },
    async somar(delta) {
      const telas: Record<string, Record<string, unknown>> = {};
      for (const [tela, t] of Object.entries(delta.telas)) {
        const x: Record<string, unknown> = {};
        if (t.v) x.v = increment(t.v);
        const c = comIncremento(t.c), p = comIncremento(t.p), q = comIncremento(t.q);
        if (c) x.c = c;
        if (p) x.p = p;
        if (q) x.q = q;
        if (Object.keys(x).length) telas[tela] = x;
      }
      if (!Object.keys(telas).length) return;
      const pessoas = comIncremento(delta.pessoas);
      await setDoc(doc(db, 'uso', delta.dia), { dia: delta.dia, telas, ...(pessoas ? { pessoas } : {}), atualizadoEm: new Date().toISOString() }, { merge: true });
    },
    async dias(lista) {
      if (!lista.length) return [];
      const ordenados = [...lista].sort();
      const s = await getDocs(query(collection(db, 'uso'), where('dia', '>=', ordenados[0]), where('dia', '<=', ordenados[ordenados.length - 1])));
      return s.docs.map(d => uso.usoDoDocumento(d.id, d.data()));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
