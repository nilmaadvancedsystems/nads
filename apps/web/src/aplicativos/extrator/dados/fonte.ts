// De onde vêm os dados do Extrator (VITE_FONTE):
//   "exemplos" → empresas de exemplo (901, 902, 903), guardadas só neste navegador;
//   "banco"    → a lista de empresas do escritório, com os lançamentos guardados só neste navegador.
// O Extrator ainda não grava no Firestore: ligar o banco é decisão pendente
// (docs/aplicativos/extrator/mapa.md). O repositório é criado uma vez, quando alguém abre o Extrator.
import { empresas, extrator } from '@nads/core';

const exemplos = import.meta.env.VITE_FONTE !== 'banco';

let repo: extrator.RepoExtrator | null = null;

export function repoDoExtrator(): extrator.RepoExtrator {
  if (!repo) repo = extrator.criarRepoExtratorMemoria(exemplos ? { exemplos: true } : { exemplos: false, lista: empresas.EMPRESAS });
  return repo;
}
