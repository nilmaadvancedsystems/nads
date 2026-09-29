// De onde vêm os dados do Extrator (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `extrator` (ver ../../../dados/extrator.firestore.ts),
//                com a lista de empresas do escritório;
//   "exemplos" → empresas de exemplo (901, 902, 903), guardadas só neste navegador.
// O Drive (o extrato da competência na pasta da empresa): no banco, o do escritório pelo Entregas (o mesmo
// login e o mesmo robô do Creditor, ver ../../../dados/drive.firestore.ts); nos exemplos, a pasta de exemplo
// da empresa 901. O repositório e o Drive são criados uma vez, quando alguém abre o Extratudo.
import { creditor, empresas, extrator } from '@nads/core';
import { criarDriveFirestore } from '../../../dados/drive.firestore';
import { criarRepoExtratorFirestore, type RepoExtratorFirestore } from '../../../dados/extrator.firestore';

export const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: extrator.RepoExtrator | null = null;
let drive: creditor.RepoDrive | null = null;

export function driveDoExtrator(): creditor.RepoDrive {
  if (!drive) drive = noBanco ? criarDriveFirestore() : creditor.criarDriveMemoria();
  return drive;
}

export function repoDoExtrator(): extrator.RepoExtrator {
  if (!repo) repo = noBanco ? criarRepoExtratorFirestore(empresas.EMPRESAS) : extrator.criarRepoExtratorMemoria({ exemplos: true });
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: extrator.RepoExtrator, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoExtratorFirestore).definirAviso(aviso);
}
