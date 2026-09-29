// De onde vêm as contas do Creditor (VITE_FONTE):
//   "banco"    → o Firestore da Conferência: o balancete da empresa (só leitura) e as contas salvas
//                (ver ../../../dados/creditor.firestore.ts);
//   "exemplos" → balancetes de exemplo, e as contas salvas só neste navegador.
// O Drive (o relatório da competência): no banco, o do escritório pelo Entregas
// (../../../dados/drive.firestore.ts); nos exemplos, uma pasta de exemplo na empresa 901.
// Os repositórios são criados uma vez, quando alguém abre o Creditor.
import { creditor as cr } from '@nads/core';
import { criarRepoCreditorFirestore, type RepoCreditorFirestore } from '../../../dados/creditor.firestore';
import { criarDriveFirestore } from '../../../dados/drive.firestore';

const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: cr.RepoCreditor | null = null;
let drive: cr.RepoDrive | null = null;

export function driveDoCreditor(): cr.RepoDrive {
  if (!drive) drive = noBanco ? criarDriveFirestore() : cr.criarDriveMemoria();
  return drive;
}

export function repoDoCreditor(): cr.RepoCreditor {
  if (!repo) repo = noBanco ? criarRepoCreditorFirestore() : cr.criarRepoCreditorMemoria();
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: cr.RepoCreditor, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoCreditorFirestore).definirAviso(aviso);
}
