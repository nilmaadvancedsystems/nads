// O Cadastro da empresa no banco, do jeito que o Extratudo usa: o MESMO Firestore da Conferência (projeto
// conferencia-nilma), coleção `cadastro`, que a Tarefas (Cadastro) edita. Regras abertas; nenhuma regra mudou.
//   cadastro/{slug(nome)}              → { nome, codigo, bancos?, contasPadrao?, historico, atualizadoEm }
//   cadastro/{slug(nome)}/plano/atual  → { contas, origem, arquivo?, importadoEm, por? }
// O Extrator lê e grava as contas bancárias ("Adicionar banco"); o Creditor lê o plano e grava as contas padrão.
// A lógica fica no core (empresas.cadastro.criarRepoCadastro); aqui é só a porta.
import type { empresas } from '@nads/core';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { bancoDaConferencia } from './extrator.firestore';

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
