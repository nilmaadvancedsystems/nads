// De onde vêm os dados do site do admin. O login, o robô, o uso, os feedbacks e os agentes são os MESMOS repositórios da
// Tarefas (tarefas/dados/fonte.ts: as mesmas telas e os mesmos view-models); só o resumo diário da saúde do banco é daqui.
// No banco (VITE_FONTE=banco), o Firestore do Entregas; nos exemplos, na memória (nada vai para o banco).
import { noBanco } from '../../tarefas/dados/fonte';
import { criarSaudeDoBancoMemoria, type RepoSaudeDoBanco } from './saudeBanco';
import { criarSaudeDoBancoFirestore } from './saudeBanco.firestore';

let saudeDoBanco: RepoSaudeDoBanco | null = null;

/** O resumo diário da saúde do banco (robo/saudeBanco; só o admin lê). */
export function repoDaSaudeDoBanco(): RepoSaudeDoBanco {
  if (!saudeDoBanco) saudeDoBanco = noBanco ? criarSaudeDoBancoFirestore() : criarSaudeDoBancoMemoria();
  return saudeDoBanco;
}
