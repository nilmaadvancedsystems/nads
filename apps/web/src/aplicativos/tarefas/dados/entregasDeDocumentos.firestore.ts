// A entrega de documentos no banco do Entregas (16/10/2026), nas MESMAS coleções e campos da página antiga, que continua
// funcionando junto (as regras são as de lá; nenhuma coleção nova):
//   - entregas: as paradas na rota (status 'pendente', ao vivo, até 500), as da competência do painel (até 1500) e o
//     histórico do cliente (uma leitura, até 200); registrar (o documento + anexos/comprovante com a foto, num lote),
//     confirmar (a atualização + o comprovante, num lote: tudo ou nada, como no Entregas), a nova tentativa, a ordem
//     (só o ordemRota) e tirar da rota (a entrega, o comprovante e as guias anexadas, num lote);
//   - entregas/{id}/anexos/comprovante: a assinatura (PNG) e a foto (JPEG) em data URL, como o Entregas grava (sem Storage);
//   - clientes: a lista (ao vivo, até 1000) e, ao pôr na rota, a região (zona) e a marca de cliente de entrega (entrega),
//     os dois campos que a regra deixa a equipe ajustar;
//   - config/rotaPadrao: a ordem fixa da rota (só leitura).
// O e-mail de quem grava é o do login (as regras conferem entregadoPor == o e-mail do token).
import { entregas } from '@nads/core';
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc as updateDocBruto, where, writeBatch as writeBatchBruto,
} from 'firebase/firestore';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import { bancoDoEntregas, contaDoEntregas } from './entregas.firestore';
import type { ComprovanteDaEntrega, RepoEntregasDeDocumentos } from './entregasDeDocumentos';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

/** As guias que o Entregas anexa à parada (anexos/guia-<tipo>): saem junto quando a parada sai da rota. */
const GUIAS_ANEXADAS = ['fgts', 'darf', 'das'];

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Sem permissão no banco do Entregas para ler as entregas.' : err.message);

export function criarEntregasDeDocumentosFirestore(nome: () => string): RepoEntregasDeDocumentos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let clientes: ListaAoVivo<entregas.ClienteDaRota> | null = null;
  let naRota: ListaAoVivo<entregas.Entrega> | null = null;
  let rotaPadrao: entregas.RotaPadrao | null = null;
  // uma competência por vez: trocar de mês desliga a anterior (o painel só mostra uma)
  let mes: { competencia: string; lista: ListaAoVivo<entregas.Entrega>; parar: () => void } | null = null;

  const quem = (): entregas.QuemEntrega | null => {
    const c = contaDoEntregas();
    return c && c.email ? { email: c.email, nome: nome() || c.email } : null;
  };
  const precisaDeQuem = () => {
    const q = quem();
    if (!q) throw new Error('Sem login no Entregas.');
    return q;
  };

  return {
    exemplos: false,
    quem,
    clientes() {
      if (!clientes) {
        clientes = { carregada: false, lista: [], erro: '' };
        onSnapshot(query(collection(db, 'clientes'), orderBy('nome'), limit(1000)), s => {
          clientes = { carregada: true, lista: s.docs.map(d => entregas.clienteDaRotaDoDocumento(d.id, d.data())), erro: '' };
          mudou();
        }, err => { clientes = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return clientes;
    },
    rotaPadrao() {
      if (!rotaPadrao) {
        rotaPadrao = entregas.ROTA_PADRAO_VAZIA;
        getDoc(doc(db, 'config', 'rotaPadrao')).then(s => { rotaPadrao = entregas.rotaPadraoDoDocumento(s.data()); mudou(); }).catch(() => undefined);
      }
      return rotaPadrao;
    },
    naRota() {
      if (!naRota) {
        naRota = { carregada: false, lista: [], erro: '' };
        onSnapshot(query(collection(db, 'entregas'), where('status', '==', 'pendente'), limit(500)), s => {
          naRota = { carregada: true, lista: s.docs.map(d => entregas.entregaDoDocumento(d.id, d.data())), erro: '' };
          mudou();
        }, err => { naRota = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return naRota;
    },
    doMes(competencia) {
      if (mes?.competencia === competencia) return mes.lista;
      mes?.parar();
      const atual: NonNullable<typeof mes> = { competencia, lista: { carregada: false, lista: [], erro: '' }, parar: () => undefined };
      mes = atual;
      atual.parar = onSnapshot(query(collection(db, 'entregas'), where('competencia', '==', competencia), limit(1500)), s => {
        atual.lista = { carregada: true, lista: s.docs.map(d => entregas.entregaDoDocumento(d.id, d.data())), erro: '' };
        mudou();
      }, err => { atual.lista = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      return atual.lista;
    },
    async doCliente(clienteId) {
      const s = await getDocs(query(collection(db, 'entregas'), where('clienteId', '==', clienteId), limit(200)));
      return s.docs.map(d => entregas.entregaDoDocumento(d.id, d.data()));
    },
    async comprovante(entregaId): Promise<ComprovanteDaEntrega> {
      const s = await getDoc(doc(db, 'entregas', entregaId, 'anexos', 'comprovante'));
      const d = s.data() || {};
      return { assinatura: typeof d.assinatura === 'string' ? d.assinatura : '', foto: typeof d.foto === 'string' ? d.foto : '' };
    },
    async registrar(n) {
      const q = precisaDeQuem();
      const ref = doc(collection(db, 'entregas'));
      const lote = writeBatch(db);
      lote.set(ref, entregas.dadosDaEntregaNova(n, q, new Date().toISOString()));
      if (n.foto) lote.set(doc(db, 'entregas', ref.id, 'anexos', 'comprovante'), { foto: n.foto });
      await lote.commit();
      // o cliente: a região que a pessoa escolheu e a marca de cliente de entrega (à parte e sem esperar, como no Entregas)
      if (n.para.tipo === 'cliente') {
        const c = n.para.cliente;
        const mudar: Record<string, unknown> = {};
        if (n.zona && c.zona !== n.zona) mudar.zona = n.zona;
        if (!c.entrega) mudar.entrega = true;
        if (Object.keys(mudar).length) updateDoc(doc(db, 'clientes', c.id), mudar).catch(() => undefined);
      }
      return ref.id;
    },
    async confirmar(lista, c) {
      const q = precisaDeQuem();
      const agora = new Date().toISOString();
      const comprovante = entregas.comprovanteDaConfirmacao(c);
      const lote = writeBatch(db);
      for (const e of lista) {
        lote.update(doc(db, 'entregas', e.id), entregas.dadosDaConfirmacao(e, c, q, agora));
        // só o que existe, com merge: a guia que já estava no comprovante fica
        if (comprovante) lote.set(doc(db, 'entregas', e.id, 'anexos', 'comprovante'), comprovante, { merge: true });
      }
      await lote.commit();
    },
    async novaTentativa(lista, motivo) {
      const q = precisaDeQuem();
      const agora = new Date().toISOString();
      const lote = writeBatch(db);
      for (const e of lista) lote.set(doc(collection(db, 'entregas')), entregas.dadosDaNovaTentativa(e, motivo, q, agora));
      await lote.commit();
    },
    async reordenar(ids) {
      const lote = writeBatch(db);
      ids.forEach((id, i) => lote.update(doc(db, 'entregas', id), { ordemRota: i }));
      await lote.commit();
    },
    async excluir(e) {
      const lote = writeBatch(db);
      lote.delete(doc(db, 'entregas', e.id, 'anexos', 'comprovante'));
      for (const g of GUIAS_ANEXADAS) lote.delete(doc(db, 'entregas', e.id, 'anexos', 'guia-' + g));
      lote.delete(doc(db, 'entregas', e.id));
      await lote.commit();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
