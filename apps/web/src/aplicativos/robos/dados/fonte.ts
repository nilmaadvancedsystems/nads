// De onde vêm os dados da Central dos robôs: no banco (VITE_FONTE=banco), o Firestore do Entregas; nos exemplos, na
// memória (nada vai para o banco). O login é o mesmo da Tarefas (tarefas/dados/sessao.ts).
import { noBanco } from '../../tarefas/dados/fonte';
import { criarAjustesMemoria, type RepoAjustes } from './ajustes';
import { criarAjustesFirestore } from './ajustes.firestore';
import { criarCentralMemoria, type RepoCentral } from './central';
import { criarCentralFirestore } from './central.firestore';

let central: RepoCentral | null = null;
let ajustes: RepoAjustes | null = null;

export function repoDosAjustes(): RepoAjustes {
  if (!ajustes) ajustes = noBanco ? criarAjustesFirestore() : criarAjustesMemoria();
  return ajustes;
}

export function repoDaCentral(): RepoCentral {
  if (!central) central = noBanco ? criarCentralFirestore() : criarCentralMemoria();
  return central;
}
