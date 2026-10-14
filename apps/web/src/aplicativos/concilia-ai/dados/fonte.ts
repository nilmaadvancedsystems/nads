// De onde vêm os dados da Conferência (VITE_FONTE):
//   "banco"    → o mesmo Firestore da conferencia-nilma.web.app (site publicado, `npm run dev:banco`)
//   "exemplos" → empresas de exemplo em memória, nada vai para o banco (`npm run dev`, prévias)
// O repositório só é criado quando alguém abre a Conferência, e uma vez só.
import { conferencia, demo, usuarios } from '@nads/core';
import { sessaoDaTarefas } from '../../tarefas/dados/fonte';
import { criarAlterdataMemoria, type QuemPedeAlterdata, type RepoAlterdata } from './alterdata';
import { criarAlterdataFirestore } from './alterdata.firestore';
import { criarRepoConferenciaFirestore, type RepoConferenciaFirestore } from './conferencia.firestore';
import { ligadoAoBanco } from '../../../comum/modoDesenvolvedor';

export const noBanco = ligadoAoBanco(); // no modo desenvolvedor, os dados de exemplo (nada vai para o banco)

let repo: conferencia.RepoConferencia | null = null;

export function repoDaConferencia(): conferencia.RepoConferencia {
  // a empresa de teste (Personaly Company) fica neste navegador; o resto, no banco (ou nos exemplos)
  if (!repo) repo = demo.conferenciaComDemo(noBanco ? criarRepoConferenciaFirestore() : conferencia.criarRepoConferenciaMemoria());
  return repo;
}

/** Os erros do banco (salvar/conectar) vão para o toast da tela. */
export function avisarErrosDoBanco(r: conferencia.RepoConferencia, aviso: Parameters<RepoConferenciaFirestore['definirAviso']>[0]): void {
  if (noBanco) (r as RepoConferenciaFirestore).definirAviso(aviso);
}

/** Só o contábil e o admin pedem balancete ao robô do Alterdata (as regras do banco conferem de novo). */
const podePedirBalancete = (papeis: readonly usuarios.Papel[]) => papeis.includes('contabil') || papeis.includes('admin');

/**
 * Quem está pedindo. No banco, a conta do Entregas (o login da Tarefas; no site da Conferência sozinha ninguém entrou, e o
 * botão não aparece). Nos exemplos, a pessoa escolhida na lista da equipe (operador.tsx guarda o nome neste navegador); sem
 * ninguém escolhida, vale como contábil, para a tela poder ser testada.
 */
function quemPedeAlterdata(): QuemPedeAlterdata | null {
  if (noBanco) {
    const u = sessaoDaTarefas()?.estado().usuario;
    return u ? { nome: u.nome, uid: u.uid, podePedir: podePedirBalancete(u.papeis) } : null;
  }
  let nome: string | null = null;
  try { nome = localStorage.getItem('nads-tarefas-operador'); } catch { /* sem armazenamento */ }
  const u = usuarios.EQUIPE_EXEMPLO.find(x => x.nome === nome);
  return u ? { nome: u.nome, uid: u.nome, podePedir: podePedirBalancete(u.papeis) } : { nome: 'exemplo', uid: 'exemplo', podePedir: true };
}

let alterdata: RepoAlterdata | null = null;

/** O balancete gerado no Alterdata pelo robô do PC (14/10/2026): os pedidos da Importação e o estado do robô. */
export function repoDoAlterdata(): RepoAlterdata {
  if (!alterdata) alterdata = noBanco ? criarAlterdataFirestore(quemPedeAlterdata) : criarAlterdataMemoria(quemPedeAlterdata);
  return alterdata;
}
