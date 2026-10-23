// De onde vêm os dados do site do admin. O login, o robô, o uso, os feedbacks e os agentes são os MESMOS repositórios da
// Tarefas (tarefas/dados/fonte.ts: as mesmas telas e os mesmos view-models); o resumo diário da saúde do banco e o
// acompanhamento do arquivador novo são daqui.
// No banco (VITE_FONTE=banco), o Firestore do Entregas; nos exemplos, na memória (nada vai para o banco).
import { noBanco } from '../../tarefas/dados/fonte';
import { criarSaudeDoBancoMemoria, type RepoSaudeDoBanco } from './saudeBanco';
import { criarSaudeDoBancoFirestore } from './saudeBanco.firestore';
import { criarArquivadorNovoMemoria, type RepoArquivadorNovo } from './arquivadorNovo';
import { criarArquivadorNovoFirestore } from './arquivadorNovo.firestore';

let saudeDoBanco: RepoSaudeDoBanco | null = null;

/** O resumo diário da saúde do banco (robo/saudeBanco; só o admin lê). */
export function repoDaSaudeDoBanco(): RepoSaudeDoBanco {
  if (!saudeDoBanco) saudeDoBanco = noBanco ? criarSaudeDoBancoFirestore() : criarSaudeDoBancoMemoria();
  return saudeDoBanco;
}

let arquivadorNovo: RepoArquivadorNovo | null = null;

/** O acompanhamento do arquivador novo (robo/arquivadorNovo e o histórico do dia; só o admin lê). */
export function repoDoArquivadorNovo(): RepoArquivadorNovo {
  if (!arquivadorNovo) arquivadorNovo = noBanco ? criarArquivadorNovoFirestore() : criarArquivadorNovoMemoria();
  return arquivadorNovo;
}
