// O "onde parou" da Tarefa no banco do Entregas (Vitor, 16/10/2026: "aplique todas as suas sugestões" — guardar no banco,
// não no navegador): nadsGuardado/{empresa}/itens/{id}, um documento por chave do guardado (comum/guardado.ts), com a
// chave, quando foi gravado e o valor em texto (o JSON). A empresa é o nome em slug (o mesmo das outras coleções do nads).
// Precisa da regra nadsGuardado no firestore.rules do Entregas; sem ela, o banco recusa e fica o do navegador.
// O que passa do tamanho de um documento (o limite é 1 MB) vai em pedaços (Vitor, 26/10/2026: "ao atualizar a página, o
// razão upado some" — o razão do BB de um posto, 1,2 MB, ficava só no navegador, que também não tinha espaço): o
// documento da chave leva o 1º pedaço e quantos são; os outros ficam em {id}~1, {id}~2…, com o mesmo "em". Os pedaços vão
// antes e o documento da chave por último; ao ler, só vale quando todos os pedaços daquela gravação chegaram.
import { collection, deleteDoc as apagarBruto, doc, getDocs, setDoc as gravarBruto } from 'firebase/firestore';
import type { EntradaGuardada, RemotoDoGuardado } from '../../../comum/guardado';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(gravarBruto) as typeof gravarBruto;
const deleteDoc = guardar(apagarBruto) as typeof apagarBruto;

/** O tamanho de cada pedaço (em caracteres do JSON; com acento, um caractere pode ocupar 2 bytes no documento). */
const PEDACO = 400_000;
/** O maior valor que vai para o banco (em caracteres do JSON): 40 pedaços. */
const MAIOR = PEDACO * 40;

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
      type Doc = { chave?: unknown; em?: unknown; v?: unknown; partes?: unknown; parte?: unknown };
      const docs = s.docs.map(d => d.data() as Doc).filter(x => typeof x.chave === 'string' && typeof x.em === 'number');
      // os pedaços de cada gravação ('chave|em' → o texto de cada parte)
      const pedacos = new Map<string, Map<number, string>>();
      for (const x of docs) {
        if (typeof x.parte !== 'number' || typeof x.v !== 'string') continue;
        const k = x.chave + '|' + x.em;
        pedacos.set(k, (pedacos.get(k) || new Map()).set(x.parte, x.v));
      }
      return docs.filter(x => typeof x.parte !== 'number').map(x => {
        let v: unknown = null;
        try {
          if (typeof x.v === 'string') {
            const n = typeof x.partes === 'number' ? x.partes : 1;
            const dela = pedacos.get(x.chave + '|' + x.em);
            const resto = Array.from({ length: n - 1 }, (_, i) => dela?.get(i + 1));
            // falta um pedaço (a gravação não terminou): não vale
            v = resto.every(t => typeof t === 'string') ? JSON.parse(x.v + resto.join('')) : null;
          }
        } catch { v = null; }
        return { chave: x.chave as string, em: x.em as number, v } satisfies EntradaGuardada;
      // o que não deu para remontar (pedaço faltando, texto estragado) não volta: senão apagaria o deste navegador
      }).filter(x => x.v != null);
    },
    gravar(escopo, e) {
      const ref = doc(db, 'nadsGuardado', escopo, 'itens', idDaChave(e.chave));
      if (e.v == null) { void deleteDoc(ref).catch(falhou); return; }
      const texto = JSON.stringify(e.v);
      if (texto.length > MAIOR) { falhou(new Error('grande demais (' + texto.length + ' caracteres)')); return; }
      const partes = Math.max(1, Math.ceil(texto.length / PEDACO));
      const pedaco = (i: number) => texto.slice(i * PEDACO, (i + 1) * PEDACO);
      // os pedaços primeiro; o documento da chave (que diz quantos são) por último
      const resto = Array.from({ length: partes - 1 }, (_, i) =>
        setDoc(doc(db, 'nadsGuardado', escopo, 'itens', idDaChave(e.chave) + '~' + (i + 1)), { chave: e.chave, em: e.em, parte: i + 1, v: pedaco(i + 1), por: quem() }));
      void Promise.all(resto)
        .then(() => setDoc(ref, { chave: e.chave, em: e.em, v: pedaco(0), ...(partes > 1 ? { partes } : {}), por: quem() }))
        .catch(falhou);
    },
  };
}
