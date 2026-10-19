// De onde vêm os dados da Conferência (VITE_FONTE):
//   "banco"    → o mesmo Firestore da conferencia-nilma.web.app (site publicado, `npm run dev:banco`)
//   "exemplos" → empresas de exemplo em memória, nada vai para o banco (`npm run dev`, prévias)
// O repositório só é criado quando alguém abre a Conferência, e uma vez só.
import { conferencia, demo } from '@nads/core';
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
