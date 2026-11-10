// A única forma de abrir o banco do Entregas nesta página (09/11/2026): quem abre primeiro define a configuração, então
// todos passam por aqui. O cache local fica no IndexedDB (dividido entre as abas): recarregar a página não paga de novo os
// documentos que não mudaram. O que chega na tela continua vindo do servidor (ouvirSemDadoVelho.firestore.ts).
import type { FirebaseApp } from 'firebase/app';
import { clearIndexedDbPersistence, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, type Firestore } from 'firebase/firestore';

const TAMANHO_DO_CACHE = 250 * 1024 * 1024;

export function abrirBancoDoEntregas(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // 250 MB (10/11/2026, consumo do banco): no padrão de 40 MB, os pedaços grandes (os zips do SIEG, as partes do mapa do
      // Drive, os razões do "onde parou", os lançamentos do Financeiro) enchiam o cache e o Firebase jogava fora os clientes e
      // o cadastro, que voltavam inteiros do servidor a cada página nova
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: TAMANHO_DO_CACHE }),
    });
  } catch {
    return getFirestore(app); // já aberto nesta página
  }
}

/** Ao sair da conta: apaga o que ficou guardado neste computador e recarrega (com outra aba aberta, o Firebase recusa; segue). */
export async function apagarCacheDoEntregas(db: Firestore): Promise<void> {
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* outra aba aberta: fica para quando ela fechar */ }
  try { window.location.reload(); } catch { /* fora do navegador */ }
}
