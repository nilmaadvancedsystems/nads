// As marcas da etapa Clientes no banco da Conferência (Vitor, 06/10/2026): um documento por empresa e mês, ao lado das
// contas do Creditor (extrator/{empresa}/creditor/clientes-AAAA-MM), que é onde o nads já grava. Só a porta: a regra fica
// no core (clientes.docDoDocumento).
import { clientes as cl } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDaConferencia } from './extrator.firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const caminho = (slug: string, mes: string) => doc(bancoDaConferencia(), 'extrator', slug, 'creditor', 'clientes-' + mes);

/** Ouve o mês da empresa (devolve o parar). */
export function ouvirMarcasNoBanco(slug: string, mes: string, chegou: (d: cl.DocClientes) => void, falhou: (m: string) => void): () => void {
  return onSnapshot(caminho(slug, mes), s => chegou(cl.docDoDocumento(s.exists() ? s.data() : null)), e => falhou(e.message));
}

export function gravarMarcasNoBanco(slug: string, mes: string, d: cl.DocClientes): Promise<void> {
  return setDoc(caminho(slug, mes), { ...d, atualizadoEm: new Date().toISOString() });
}
