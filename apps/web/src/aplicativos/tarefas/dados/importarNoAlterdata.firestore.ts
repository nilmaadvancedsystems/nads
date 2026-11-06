// O acesso ao Firestore do "Importar no Alterdata" (comum/importarNoAlterdata.ts): grava o pedido em pedidosAlterdata
// (banco do Entregas) e acompanha o documento que o robô do servidor vai escrevendo.
import { addDoc, collection, doc, onSnapshot } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';

export async function gravarPedidoAlterdata(dados: Record<string, unknown>): Promise<string> {
  const r = await addDoc(collection(bancoDoEntregas(), 'pedidosAlterdata'), dados);
  return r.id;
}

export function ouvirPedidoAlterdata(id: string, chegou: (d: Record<string, unknown>) => void, falhou: (e: Error) => void): () => void {
  return onSnapshot(doc(bancoDoEntregas(), 'pedidosAlterdata', id), s => { if (s.exists()) chegou(s.data()); }, falhou);
}
