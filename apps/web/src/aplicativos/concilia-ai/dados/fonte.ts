// De onde vêm os dados da Conferência (VITE_FONTE):
//   "banco"    → o mesmo Firestore da conferencia-nilma.web.app (site publicado, `npm run dev:banco`)
//   "exemplos" → empresas de exemplo em memória, nada vai para o banco (`npm run dev`, prévias)
// O repositório só é criado quando alguém abre a Conferência, e uma vez só.
// A trava (29/10/2026): no banco, só entra quem tem a conta do Entregas com o papel que libera a Conferência.
import { conferencia, demo } from '@nads/core';
import type { PortaDaTrava } from '../../../comum/trava/useTrava';
import { criarRepoConferenciaFirestore, type RepoConferenciaFirestore } from './conferencia.firestore';
import { criarSessaoEntregas } from './entregas.firestore';

export const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: conferencia.RepoConferencia | null = null;
let sessao: PortaDaTrava | null = null;

/** O login do Entregas que a trava confere (só no banco; nos exemplos, null: não há login). */
export function sessaoDaConferencia(): PortaDaTrava | null {
  if (!noBanco) return null;
  if (!sessao) sessao = criarSessaoEntregas();
  return sessao;
}

export function repoDaConferencia(): conferencia.RepoConferencia {
  // a empresa de teste (Personaly Company) fica neste navegador; o resto, no banco (ou nos exemplos)
  if (!repo) repo = demo.conferenciaComDemo(noBanco ? criarRepoConferenciaFirestore() : conferencia.criarRepoConferenciaMemoria());
  return repo;
}

/** Os erros do banco (salvar/conectar) vão para o toast da tela. */
export function avisarErrosDoBanco(r: conferencia.RepoConferencia, aviso: Parameters<RepoConferenciaFirestore['definirAviso']>[0]): void {
  if (noBanco) (r as RepoConferenciaFirestore).definirAviso(aviso);
}
