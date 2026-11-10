// O lote de boletos no banco do Entregas (10/11/2026), nas regras de lá (só quem pode no Financeiro; o disparo, só o Diretor):
//   - financeiroBoletos/{id}: { competencia, arquivo, contratoId, achadoPor, linha, valor, vencimento, destinatarios, fora?, tamanho,
//     partes, criadoEm, criadoPor, criadoPorUid, atualizadoEm?, atualizadoPor?, envio?: { status, para, em, por, porUid, erro? } };
//     a tela cria, revisa (cliente, destinatários, fora), exclui o que não saiu e pede o disparo (envio.status = 'fila'); o robô manda e grava o resto;
//   - financeiroBoletos/{id}/partes/{n}: { dados: Bytes }, o PDF em pedaços (como o lotesDp).
import { addDoc as addDocBruto, Bytes, collection, deleteDoc as deleteDocBruto, doc, getDocs, onSnapshot, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { entregas as e, financeiro } from '@nads/core';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { RepoBoletos } from './boletos';
import { bancoDoEntregas } from './entregas.firestore';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const texto = (v: unknown) => (v == null ? '' : String(v));
const textos = (v: unknown) => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);
const STATUS: financeiro.StatusDoEnvio[] = ['fila', 'enviando', 'enviado', 'erro'];

function envioDoBanco(v: unknown): financeiro.EnvioDoBoleto | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const d = v as Record<string, unknown>;
  if (!STATUS.includes(d.status as financeiro.StatusDoEnvio)) return undefined;
  return { status: d.status as financeiro.StatusDoEnvio, para: textos(d.para), em: texto(d.em), por: texto(d.por), ...(d.erro ? { erro: texto(d.erro) } : {}) };
}

export function boletoDoBanco(id: string, d: Record<string, unknown>): financeiro.BoletoDoLote {
  const achadoPor = ['documento', 'nome', 'mao'].includes(texto(d.achadoPor)) ? (d.achadoPor as financeiro.BoletoDoLote['achadoPor']) : '';
  return {
    id, competencia: texto(d.competencia), arquivo: texto(d.arquivo), contratoId: texto(d.contratoId), achadoPor, linha: texto(d.linha).replace(/\D/g, ''),
    valor: typeof d.valor === 'number' && Number.isFinite(d.valor) ? d.valor : null, vencimento: /^\d{4}-\d{2}-\d{2}$/.test(texto(d.vencimento)) ? texto(d.vencimento) : null,
    destinatarios: textos(d.destinatarios), ...(d.fora === true ? { fora: true } : {}), envio: envioDoBanco(d.envio),
  };
}

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só quem tem acesso ao Financeiro vê os boletos.' : err.message);

export function criarBoletosFirestore(quem: () => e.Quem | null, emails: (c: financeiro.ContratoDeHonorario) => Promise<string[]>): RepoBoletos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const porCompetencia = new Map<string, ListaAoVivo<financeiro.BoletoDoLote>>();
  const quemE = () => { const q = quem(); if (!q) throw new Error('Sem login.'); return q; };

  return {
    exemplos: false,
    boletos(competencia) {
      let l = porCompetencia.get(competencia);
      if (!l) {
        l = { carregada: false, lista: [], erro: '' };
        porCompetencia.set(competencia, l);
        // só igualdade (sem orderBy, que pediria um índice): a ordem é feita na tela
        onSnapshot(query(collection(db, 'financeiroBoletos'), where('competencia', '==', competencia)), s => {
          porCompetencia.set(competencia, { carregada: true, lista: s.docs.map(x => boletoDoBanco(x.id, x.data())), erro: '' });
          mudou();
        }, err => { porCompetencia.set(competencia, { carregada: true, lista: [], erro: erroDe(err) }); mudou(); });
      }
      return l;
    },
    emailsDoContrato: emails,
    async adicionar(novos, andamento) {
      const q = quemE();
      for (const [k, { bytes, ...n }] of novos.entries()) {
        const partes = e.partesDoArquivo(bytes);
        const ref = await addDoc(collection(db, 'financeiroBoletos'), {
          competencia: n.competencia, arquivo: e.nomeParaEnviar(n.arquivo), contratoId: n.contratoId, achadoPor: n.achadoPor, linha: n.linha,
          valor: n.valor, vencimento: n.vencimento, destinatarios: n.destinatarios.slice(0, 10), tamanho: bytes.length, partes: partes.length,
          criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid,
        });
        for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
        andamento?.(k + 1, novos.length);
      }
    },
    async alterar(id, mudar) {
      const q = quemE();
      const campos: Record<string, unknown> = { ...mudar, atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome };
      if (mudar.destinatarios) campos.destinatarios = mudar.destinatarios.slice(0, 10);
      await updateDoc(doc(db, 'financeiroBoletos', id), campos);
    },
    async excluir(id) {
      quemE();
      // os pedaços antes: a regra deles olha o boleto, que ainda precisa existir
      const partes = await getDocs(collection(db, 'financeiroBoletos', id, 'partes'));
      for (const p of partes.docs) await deleteDoc(p.ref);
      await deleteDoc(doc(db, 'financeiroBoletos', id));
    },
    async disparar(lista) {
      const q = quemE();
      const em = new Date().toISOString();
      for (const b of lista) await updateDoc(doc(db, 'financeiroBoletos', b.id), { envio: { status: 'fila', para: b.destinatarios, em, por: q.nome, porUid: q.uid } });
    },
    async pdf(id) {
      const s = await getDocs(collection(db, 'financeiroBoletos', id, 'partes'));
      if (s.empty) return null;
      const partes = s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(x => (x.data().dados as Bytes).toUint8Array());
      const tudo = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
      let i = 0;
      for (const p of partes) { tudo.set(p, i); i += p.length; }
      return tudo;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
