// O cofre no banco do Entregas (07/10/2026): cofreConfig/atual (a versão da chave e a recuperação), cofreChaves/{id} (a
// chave pública de cada pessoa e a cópia dela da chave do cofre) e cofre/{empresa} (os segredos embaralhados). As regras
// deixam todo o escritório ler e gravar; o que é segredo já chega embaralhado (nem o banco consegue ler).
import type { cofre } from '@nads/core';
import { collection, deleteDoc as apagarBruto, doc, onSnapshot, setDoc as gravarBruto, writeBatch } from 'firebase/firestore';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoCofre } from './cofre';

const setDoc = guardar(gravarBruto) as typeof gravarBruto;
const deleteDoc = guardar(apagarBruto) as typeof apagarBruto;
/** o Firestore não aceita undefined */
const limpo = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function criarCofreFirestore(eu: () => { uid: string; nome: string } | null): RepoCofre {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let config: cofre.ConfigDoCofre | null = null;
  let pessoas: cofre.ChaveDaPessoa[] = [];
  let itens = new Map<string, cofre.DocDoCofre>();
  const chegou = { config: false, chaves: false, itens: false };
  let erro = '';
  let ligado = false;
  const falhou = (e: Error) => { erro = e.message; chegou.config = chegou.chaves = chegou.itens = true; mudou(); };
  function ligar() {
    if (ligado) return;
    ligado = true;
    onSnapshot(doc(db, 'cofreConfig', 'atual'), s => { config = s.exists() ? (s.data() as cofre.ConfigDoCofre) : null; chegou.config = true; mudou(); }, falhou);
    onSnapshot(collection(db, 'cofreChaves'), s => { pessoas = s.docs.map(d => ({ ...(d.data() as cofre.ChaveDaPessoa), id: d.id })); chegou.chaves = true; mudou(); }, falhou);
    onSnapshot(collection(db, 'cofre'), s => { itens = new Map(s.docs.map(d => [d.id, d.data() as cofre.DocDoCofre])); chegou.itens = true; mudou(); }, falhou);
  }
  return {
    exemplos: false,
    eu,
    carregado: () => { ligar(); return chegou.config && chegou.chaves && chegou.itens; },
    erro: () => erro,
    config: () => config,
    pessoas: () => pessoas,
    itens: () => itens,
    async criar(c, primeira) {
      const b = guardarLote(writeBatch(db));
      b.set(doc(db, 'cofreConfig', 'atual'), limpo(c));
      b.set(doc(db, 'cofreChaves', primeira.id), limpo(primeira));
      await b.commit();
    },
    registrarChave: c => setDoc(doc(db, 'cofreChaves', c.id), limpo(c)),
    liberar: (id, trancada, versao, por) => setDoc(doc(db, 'cofreChaves', id), { trancada, versao, liberadoPor: por, liberadoEm: new Date().toISOString() }, { merge: true }),
    apagarChave: id => deleteDoc(doc(db, 'cofreChaves', id)),
    salvar: (id, d) => setDoc(doc(db, 'cofre', id), limpo(d)),
    async salvarVarios(lista) {
      // o Firestore aceita até 500 por lote
      for (let i = 0; i < lista.length; i += 400) {
        const b = guardarLote(writeBatch(db));
        for (const x of lista.slice(i, i + 400)) b.set(doc(db, 'cofre', x.id), limpo(x.doc));
        await b.commit();
      }
    },
    salvarConfig: c => setDoc(doc(db, 'cofreConfig', 'atual'), limpo(c)),
    async trocarChave(c, chaves, novos) {
      const b = guardarLote(writeBatch(db));
      b.set(doc(db, 'cofreConfig', 'atual'), limpo(c));
      for (const k of chaves) b.set(doc(db, 'cofreChaves', k.id), { trancada: k.trancada, versao: c.versao }, { merge: true });
      for (const i of novos) b.set(doc(db, 'cofre', i.id), limpo(i.doc));
      await b.commit();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
