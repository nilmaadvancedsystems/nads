// config/sciPlanos no banco do Entregas (26/11/2026): os planos de contas do SCI que o escritório adiciona ou atualiza em
// Cadastro › Integração SCI (a regra do config: lê quem é membro, grava o admin). Ao chegar, entram no core no lugar dos do nads.
import { sci } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import { planosDoDocumento, type PlanoSciGravado, type RepoPlanosSci } from './planosSci';
import { guardar } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;

export function criarPlanosSciFirestore(quem: () => string): RepoPlanosSci {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregada: boolean; planos: readonly PlanoSciGravado[] } = { carregada: false, planos: [] };
  let ouvindo = false;
  return {
    exemplos: false,
    atual() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(doc(db, 'config', 'sciPlanos'), s => {
          const planos = planosDoDocumento(s.data());
          sci.usarPlanosDoBanco(planos);
          estado = { carregada: true, planos };
          mudou();
        }, () => { estado = { carregada: true, planos: [] }; mudou(); });
      }
      return estado;
    },
    async salvar(id, linhas, arquivo) {
      // só o plano mandado muda (merge): os outros ficam como estão
      await setDoc(doc(db, 'config', 'sciPlanos'), { planos: { [id]: { texto: sci.textoDoPlanoSci(linhas), contas: linhas.length, arquivo: arquivo.slice(0, 200), por: quem().slice(0, 100), em: new Date().toISOString() } } }, { merge: true });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
