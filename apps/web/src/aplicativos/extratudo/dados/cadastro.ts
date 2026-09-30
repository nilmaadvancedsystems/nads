// O Cadastro da empresa (Tarefas › Cadastro) no Extratudo: um repositório só para as ferramentas (o Extrator
// lê e grava as contas bancárias; o Creditor lê o plano e grava as contas padrão). No banco, a coleção
// `cadastro` (ver cadastro.firestore.ts); nos exemplos, neste navegador. Criado quando alguém precisa dele.
import { empresas } from '@nads/core';
import { portaCadastroFirestore } from './cadastro.firestore';

const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: empresas.cadastro.RepoCadastro | null = null;

export function repoDoCadastro(): empresas.cadastro.RepoCadastro {
  if (!repo) {
    repo = noBanco
      ? empresas.cadastro.criarRepoCadastro(portaCadastroFirestore(), false)
      : empresas.cadastro.criarRepoCadastroMemoria();
  }
  return repo;
}

/** O código do ERP pela empresa (o documento do cadastro nasce com ele). */
export function codigoDaEmpresa(nome: string): number | null {
  return empresas.EMPRESAS.find(x => x.nome === nome)?.codigo ?? null;
}
