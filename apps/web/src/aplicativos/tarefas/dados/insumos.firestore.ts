// Os Insumos no banco do Entregas (12/11/2026), nas regras de lá:
//   - carteiraInsumos/{id}: {uid, nome, competencia, data, tipo, nomeDoTipo?, preco?, quantidade, cliente, codigo, criadoEm} — a
//     pessoa lê os dela, cria em nome dela e muda e apaga os dela; o Diretor e o Financeiro (podeNoFinanceiroNads) leem todos e
//     apagam. O nomeDoTipo e o preco (15/11/2026) são os do insumo no dia do registro.
//   - carteiraConfig/insumos: {lista: [{id, nome, preco}], atualizadoEm, atualizadoPor} — a lista dos insumos e os preços:
//     todos no nads leem, só o Financeiro grava (15/11/2026: "o preço do insumo é o financeiro que decide, e quais insumos são").
import { carteira } from '@nads/core';
import { addDoc as addDocBruto, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where, type Unsubscribe } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { QuemNaCarteira } from './carteira';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoInsumos } from './insumos';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardar(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const texto = (v: unknown) => (v == null ? '' : String(v));
const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Sem permissão no banco (as regras dos Insumos já foram publicadas?).' : err.message);

function insumoDoBanco(id: string, d: Record<string, unknown>): carteira.Insumo {
  return {
    id, uid: texto(d.uid), nome: texto(d.nome), competencia: texto(d.competencia), data: texto(d.data),
    tipo: carteira.ehTipoDeInsumo(d.tipo) ? d.tipo : 'impressao', nomeDoTipo: texto(d.nomeDoTipo), preco: typeof d.preco === 'number' ? d.preco : 0, quantidade: typeof d.quantidade === 'number' ? d.quantidade : Number(d.quantidade) || 0,
    cliente: texto(d.cliente), codigo: typeof d.codigo === 'number' ? d.codigo : null, criadoEm: texto(d.criadoEm),
  };
}

export function criarInsumosFirestore(quem: QuemNaCarteira): RepoInsumos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const vazia = (): ListaAoVivo<carteira.Insumo> => ({ carregada: false, lista: [], erro: '' });

  // os da pessoa: ouvidos uma vez por login (trocou de conta, recomeça)
  let de = '';
  let parada: Unsubscribe | null = null;
  let meus = vazia();
  function ouvirOsMeus() {
    const uid = quem()?.uid || '';
    if (uid === de) return;
    de = uid;
    parada?.();
    parada = null;
    meus = vazia();
    if (!uid) return;
    parada = onSnapshot(query(collection(db, 'carteiraInsumos'), where('uid', '==', uid)), s => {
      meus = { carregada: true, lista: s.docs.map(x => insumoDoBanco(x.id, x.data())).sort(carteira.porDataDoInsumo), erro: '' }; mudou();
    }, err => { meus = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
  }

  // o Diretor e o Financeiro: os do mês de todos, ouvidos quando a tela pede (uma escuta por mês)
  const doMes = new Map<string, ListaAoVivo<carteira.Insumo>>();
  function insumosDoMes(c: string) {
    if (!doMes.has(c)) {
      doMes.set(c, vazia());
      onSnapshot(query(collection(db, 'carteiraInsumos'), where('competencia', '==', c)), s => {
        doMes.set(c, { carregada: true, lista: s.docs.map(x => insumoDoBanco(x.id, x.data())).sort(carteira.porDataDoInsumo), erro: '' }); mudou();
      }, err => { doMes.set(c, { carregada: true, lista: [], erro: erroDe(err) }); mudou(); });
    }
    return doMes.get(c)!;
  }

  // a lista do Financeiro (carteiraConfig/insumos; 15/11/2026): sem ela gravada (ou sem a regra no ar), valem Impressão,
  // Envelope e Caixa sem preço, e o registro vai como antes (sem o nome e o preço), para a regra de antes aceitar
  let tipos: ListaAoVivo<carteira.TipoConfigurado> & { comLista: boolean } = { carregada: false, lista: [...carteira.INSUMOS_PADRAO], erro: '', comLista: false };
  let ouvindoTipos = false;
  function ouvirTipos() {
    if (ouvindoTipos) return;
    ouvindoTipos = true;
    onSnapshot(doc(db, 'carteiraConfig', 'insumos'), s => {
      const lista = Array.isArray(s.data()?.lista) ? (s.data()!.lista as Record<string, unknown>[]) : [];
      const lidos = lista.filter(x => carteira.ehTipoDeInsumo(x.id)).map(x => ({ id: String(x.id), nome: texto(x.nome), preco: typeof x.preco === 'number' ? x.preco : 0 }));
      tipos = lidos.length ? { carregada: true, lista: lidos, erro: '', comLista: true } : { carregada: true, lista: [...carteira.INSUMOS_PADRAO], erro: '', comLista: false };
      mudou();
    }, () => { tipos = { carregada: true, lista: [...carteira.INSUMOS_PADRAO], erro: '', comLista: false }; mudou(); });
  }

  return {
    exemplos: false,
    meuUid: () => quem()?.uid || '',
    tipos: () => { ouvirTipos(); return tipos; },
    async salvarTipos(lista) {
      const q = quem();
      if (!q) throw new Error('Entre com a conta do Entregas.');
      await setDoc(doc(db, 'carteiraConfig', 'insumos'), {
        lista: lista.map(t => ({ id: t.id, nome: t.nome.trim().slice(0, 80), preco: Math.round(t.preco * 100) / 100 })), atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome.slice(0, 100),
      });
    },
    meusInsumos: () => { ouvirOsMeus(); return meus; },
    insumosDoMes,
    async salvarInsumo(x, id) {
      const q = quem();
      if (!q) throw new Error('Entre com a conta do Entregas.');
      ouvirTipos();
      const p = carteira.comPreco(x, tipos.lista);
      const campos = {
        competencia: x.data.slice(0, 7), data: x.data, tipo: x.tipo, quantidade: x.quantidade, cliente: x.cliente.trim().slice(0, 150), codigo: x.codigo,
        // o nome e o preço do dia só com a lista do Financeiro gravada (a regra nova); sem ela, como antes
        ...(tipos.comLista ? { nomeDoTipo: p.nomeDoTipo.slice(0, 80), preco: p.preco } : {}),
      };
      if (id) await updateDoc(doc(db, 'carteiraInsumos', id), campos);
      else await addDoc(collection(db, 'carteiraInsumos'), { ...campos, uid: q.uid, nome: q.nome, criadoEm: new Date().toISOString() });
    },
    async apagarInsumo(id) { await deleteDoc(doc(db, 'carteiraInsumos', id)); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
