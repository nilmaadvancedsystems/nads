// A única forma de abrir o banco do Entregas nesta página (09/11/2026): quem abre primeiro define a configuração, então
// todos passam por aqui. O cache local fica no IndexedDB (dividido entre as abas): recarregar a página não paga de novo os
// documentos que não mudaram. O que chega na tela continua vindo do servidor (ouvirSemDadoVelho.firestore.ts).
import type { FirebaseApp } from 'firebase/app';
import { clearIndexedDbPersistence, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate, type Firestore } from 'firebase/firestore';

export function abrirBancoDoEntregas(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
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
