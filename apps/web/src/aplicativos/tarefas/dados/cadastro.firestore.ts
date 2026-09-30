// O Cadastro da Tarefas no banco do Entregas (projeto entregas-2e5e2, com o login de lá; 30/09/2026), coleção
// `cadastro` (regra própria no firestore.rules do Entregas: quem é da equipe lê e grava; só admin apaga).
//   cadastro/{slug(nome)}              → { nome, codigo, bancos?, contasPadrao?, historico, atualizadoEm }
//   cadastro/{slug(nome)}/plano/atual  → { contas, origem, arquivo?, importadoEm, por? }
// O Extrator e o Creditor (no Extratudo) leem daqui. A lógica (só a empresa aberta, nada gravado antes de ela
// chegar) está no core (empresas.cadastro.criarRepoCadastro); aqui é só a porta.
// Lê também, sem gravar, quando a pessoa pede o plano "do balancete": o que a Conferência guardou
// (empresas/{slug}, ainda no banco da Conferência) e o de Clientes › Balancetes do Entregas (balancetes/{código}).
// E, só leitura, os bancos de cada cliente que o Entregas já sabe (clientes: bancos e contasBancarias, que o robô
// aprende pelo Drive e pelos extratos).
import { formatos, type empresas } from '@nads/core';
import { collection, doc, getDoc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import { bancoDaConferencia } from './tarefas.firestore';

export function portaCadastroFirestore(): empresas.cadastro.PortaCadastro {
  const db = bancoDoEntregas();
  return {
    ouvirCadastro: (id, chegou, falhou) => onSnapshot(doc(db, 'cadastro', id), s => chegou(s.exists() ? s.data() : null), falhou),
    ouvirPlano: (id, chegou, falhou) => onSnapshot(doc(db, 'cadastro', id, 'plano', 'atual'), s => chegou(s.exists() ? s.data() : null), falhou),
    ouvirTodos: (chegou, falhou) => onSnapshot(collection(db, 'cadastro'), s => chegou(s.docs.map(d => ({ id: d.id, doc: d.data() }))), falhou),
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

/** O balancete que o Entregas guardou em Clientes › Balancetes (balancetes/{código}; só leitura). */
export async function balanceteNoEntregas(codigo: number): Promise<Record<string, unknown> | null> {
  const s = await getDoc(doc(bancoDoEntregas(), 'balancetes', String(codigo)));
  return s.exists() ? s.data() : null;
}

/** Os clientes do Entregas (só leitura), para os bancos que o Entregas já sabe de cada um. */
export async function clientesNoEntregas(): Promise<Record<string, unknown>[]> {
  const s = await getDocs(collection(bancoDoEntregas(), 'clientes'));
  return s.docs.map(d => d.data());
}
