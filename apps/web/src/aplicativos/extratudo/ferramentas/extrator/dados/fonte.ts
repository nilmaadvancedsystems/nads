// De onde vêm os dados do Extrator (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `extrator` (ver ../../../dados/extrator.firestore.ts),
//                com a lista de empresas do escritório;
//   "exemplos" → empresas de exemplo (901, 902, 903), guardadas só neste navegador.
// O repositório é criado uma vez, quando alguém abre o Extratudo.
import { empresas, extrator } from '@nads/core';
import { criarRepoExtratorFirestore, type RepoExtratorFirestore } from '../../../dados/extrator.firestore';

export const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: extrator.RepoExtrator | null = null;

export function repoDoExtrator(): extrator.RepoExtrator {
  if (!repo) repo = noBanco ? criarRepoExtratorFirestore(empresas.EMPRESAS) : extrator.criarRepoExtratorMemoria({ exemplos: true });
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: extrator.RepoExtrator, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoExtratorFirestore).definirAviso(aviso);
}
