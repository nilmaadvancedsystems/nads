// De onde vêm as contas do Creditor (VITE_FONTE):
//   "banco"    → o Firestore da Conferência: o balancete da empresa (só leitura) e as contas salvas
//                (ver ../../../dados/creditor.firestore.ts);
//   "exemplos" → balancetes de exemplo, e as contas salvas só neste navegador.
// O repositório é criado uma vez, quando alguém abre o Creditor.
import { creditor as cr } from '@nads/core';
import { criarRepoCreditorFirestore, type RepoCreditorFirestore } from '../../../dados/creditor.firestore';

const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: cr.RepoCreditor | null = null;

export function repoDoCreditor(): cr.RepoCreditor {
  if (!repo) repo = noBanco ? criarRepoCreditorFirestore() : cr.criarRepoCreditorMemoria();
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: cr.RepoCreditor, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoCreditorFirestore).definirAviso(aviso);
}
