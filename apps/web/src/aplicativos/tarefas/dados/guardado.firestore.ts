// O "onde parou" da Tarefa no banco do Entregas (Vitor, 16/10/2026: "aplique todas as suas sugestões" — guardar no banco,
// não no navegador): nadsGuardado/{empresa}/itens/{id}, um documento por chave do guardado (comum/guardado.ts), com a
// chave, quando foi gravado e o valor em texto (o JSON). A empresa é o nome em slug (o mesmo das outras coleções do nads).
// Precisa da regra nadsGuardado no firestore.rules do Entregas; sem ela, o banco recusa e fica o do navegador.
// O que passa de ~900 KB fica só no navegador (o limite de um documento é 1 MB).
import { collection, deleteDoc as apagarBruto, doc, getDocs, setDoc as gravarBruto } from 'firebase/firestore';
import type { EntradaGuardada, RemotoDoGuardado } from '../../../comum/guardado';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(gravarBruto) as typeof gravarBruto;
const deleteDoc = guardar(apagarBruto) as typeof apagarBruto;

/** O maior valor que vai para o banco (em caracteres do JSON). */
const MAIOR = 900_000;

/** O id do documento: um resumo da chave (FNV-1a), sem barra e curto. */
function idDaChave(chave: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < chave.length; i++) {
    const c = chave.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return 'g' + h1.toString(36) + h2.toString(36);
}

export function criarGuardadoFirestore(quem: () => string): RemotoDoGuardado {
  const db = bancoDoEntregas();
  let avisou = false;
  const falhou = (e: unknown) => {
    if (avisou) return;
    avisou = true;
    console.warn('O "onde parou" não foi para o banco (fica neste navegador):', e instanceof Error ? e.message : e);
  };
  return {
    async carregar(escopo) {
      const s = await getDocs(collection(db, 'nadsGuardado', escopo, 'itens'));
      return s.docs.map(d => d.data() as { chave?: unknown; em?: unknown; v?: unknown })
        .filter(x => typeof x.chave === 'string' && typeof x.em === 'number')
        .map(x => {
          let v: unknown;
          try { v = typeof x.v === 'string' ? JSON.parse(x.v) : null; } catch { v = null; }
          return { chave: x.chave as string, em: x.em as number, v } satisfies EntradaGuardada;
        });
    },
    gravar(escopo, e) {
      const ref = doc(db, 'nadsGuardado', escopo, 'itens', idDaChave(e.chave));
      if (e.v == null) { void deleteDoc(ref).catch(falhou); return; }
      const texto = JSON.stringify(e.v);
      if (texto.length > MAIOR) return;
      void setDoc(ref, { chave: e.chave, em: e.em, v: texto, por: quem() }).catch(falhou);
    },
  };
}
