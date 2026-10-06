// O Cadastro da empresa (Tarefas › Cadastro) no Extratudo: um repositório só para as ferramentas (o Extrator
// lê e grava as contas bancárias; o Creditor lê o plano e grava as contas padrão). No banco, a coleção
// `cadastro` (ver cadastro.firestore.ts); nos exemplos, neste navegador. Criado quando alguém precisa dele.
import { demo, empresas } from '@nads/core';
import { portaCadastroFirestore } from './cadastro.firestore';
import { ligadoAoBanco } from '../../../comum/modoDesenvolvedor';

const noBanco = ligadoAoBanco(); // no modo desenvolvedor, os dados de exemplo (nada vai para o banco)

let repo: empresas.cadastro.RepoCadastro | null = null;

export function repoDoCadastro(): empresas.cadastro.RepoCadastro {
  if (!repo) {
    repo = noBanco
      ? empresas.cadastro.criarRepoCadastro(demo.portaCadastroComDemo(portaCadastroFirestore()), false)
      : empresas.cadastro.criarRepoCadastro(demo.portaCadastroComDemo(empresas.cadastro.portaCadastroMemoria()), true);
  }
  return repo;
}

/** O código do ERP pela empresa (o documento do cadastro nasce com ele). */
export function codigoDaEmpresa(nome: string): number | null {
  if (demo.ehEmpresaDemo(nome)) return demo.EMPRESA_DEMO.codigo;
  return empresas.EMPRESAS.find(x => x.nome === nome)?.codigo ?? null;
}
