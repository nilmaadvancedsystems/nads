// O Cadastro da Tarefas no banco: o MESMO Firestore da Conferência (projeto conferencia-nilma),
// coleção nova `cadastro` (regras abertas; nenhuma regra foi mudada).
//   cadastro/{slug(nome)}              → { nome, codigo, bancos?, contasPadrao?, historico, atualizadoEm }
//   cadastro/{slug(nome)}/plano/atual  → { contas, origem, arquivo?, importadoEm, por? }
// O Extrator e o Creditor (no Extratudo) leem daqui. A lógica (só a empresa aberta, nada gravado antes de ela
// chegar) está no core (empresas.cadastro.criarRepoCadastro); aqui é só a porta.
// Lê também, sem gravar, o balancete que a Conferência guardou (empresas/{slug}), quando a pessoa pede.
import { formatos, type empresas } from '@nads/core';
import { doc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { bancoDaConferencia } from './tarefas.firestore';

export function portaCadastroFirestore(): empresas.cadastro.PortaCadastro {
  const db = bancoDaConferencia();
  return {
    ouvirCadastro: (id, chegou, falhou) => onSnapshot(doc(db, 'cadastro', id), s => chegou(s.exists() ? s.data() : null), falhou),
    ouvirPlano: (id, chegou, falhou) => onSnapshot(doc(db, 'cadastro', id, 'plano', 'atual'), s => chegou(s.exists() ? s.data() : null), falhou),
    async gravar(id, cadastro, plano) {
      const b = writeBatch(db);
      b.set(doc(db, 'cadastro', id), cadastro);
      if (plano) b.set(doc(db, 'cadastro', id, 'plano', 'atual'), plano);
      await b.commit();
    },
  };
}

/** O documento da empresa na Conferência (só leitura: de onde sai o plano "do balancete"). */
export async function conferenciaNoBanco(nome: string): Promise<Record<string, unknown> | null> {
  const s = await getDoc(doc(bancoDaConferencia(), 'empresas', formatos.slug(nome)));
  return s.exists() ? s.data() : null;
}
