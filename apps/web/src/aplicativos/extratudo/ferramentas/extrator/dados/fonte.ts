// De onde vêm os dados do Extrator (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `extrator` (ver ../../../dados/extrator.firestore.ts),
//                com a lista de empresas do escritório;
//   "exemplos" → empresas de exemplo (901, 902, 903), guardadas só neste navegador.
// O Drive (o extrato da competência na pasta da empresa): no banco, o do escritório pelo Entregas (o mesmo
// login e o mesmo robô do Creditor, ver ../../../dados/drive.firestore.ts); nos exemplos, a pasta de exemplo
// da empresa 901. O repositório e o Drive são criados uma vez, quando alguém abre o Extratudo.
import { creditor, type extrator } from '@nads/core';
import { criarDriveFirestore } from '../../../dados/drive.firestore';
import { avisarErrosDoExtrator, repoDoExtrator as repoDaTarefa } from '../../../../tarefas/dados/extrator';
import { ligadoAoBanco } from '../../../../../comum/modoDesenvolvedor';

export const noBanco = ligadoAoBanco(); // no modo desenvolvedor, os dados de exemplo (nada vai para o banco)

let drive: creditor.RepoDrive | null = null;

export function driveDoExtrator(): creditor.RepoDrive {
  if (!drive) drive = noBanco ? criarDriveFirestore() : creditor.criarDriveMemoria();
  return drive;
}

/** O mesmo repositório da Tarefa (um só no site). */
export function repoDoExtrator(): extrator.RepoExtrator {
  return repoDaTarefa();
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: extrator.RepoExtrator, aviso: (mensagem: string) => void): void {
  avisarErrosDoExtrator(r, aviso);
}
