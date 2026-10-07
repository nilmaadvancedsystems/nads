// A chave privada do cofre neste navegador (07/10/2026: "como o WhatsApp"): fica no IndexedDB, como uma CryptoKey que não
// pode ser exportada (nem o próprio nads consegue tirar ela daqui). Cada navegador é um "aparelho": o id da chave é o uid
// da pessoa com o número do aparelho.
const BANCO = 'nads-cofre';
const LOJA = 'chaves';
const APARELHO = 'nads-cofre-aparelho';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(LOJA); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}

export async function lerChavePrivada(id: string): Promise<CryptoKey | null> {
  try {
    const db = await abrir();
    return await new Promise(ok => {
      const r = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(id);
      r.onsuccess = () => ok((r.result as CryptoKey) || null);
      r.onerror = () => ok(null);
    });
  } catch { return null; }
}

export async function guardarChavePrivada(id: string, chave: CryptoKey): Promise<void> {
  const db = await abrir();
  await new Promise<void>((ok, falha) => {
    const t = db.transaction(LOJA, 'readwrite');
    t.objectStore(LOJA).put(chave, id);
    t.oncomplete = () => ok();
    t.onerror = () => falha(t.error);
  });
}

/** O id da chave deste navegador: o uid da pessoa + o número do aparelho (guardado neste navegador). */
export function idDaChave(uid: string): string {
  let ap = '';
  try { ap = localStorage.getItem(APARELHO) || ''; } catch { /* sem armazenamento */ }
  if (!ap) {
    ap = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(APARELHO, ap); } catch { /* fica só nesta sessão */ }
  }
  return (uid + '-' + ap).replace(/[^A-Za-z0-9_-]/g, '_');
}
