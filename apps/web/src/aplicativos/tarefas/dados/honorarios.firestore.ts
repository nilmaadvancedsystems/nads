// Os honorários no banco do Entregas (19/10/2026, fase 2 do Financeiro), nas regras de lá (o admin e o diretor):
//   - financeiroHonorarios/{id}: {clienteId, codigo, nome, cnpj, valor, ativo, observacoes?, criadoEm, criadoPor, atualizadoEm?,
//     atualizadoPor?, cobrancas?: {AAAA-MM: {em, por}}}; ao vivo;
//   - financeiroRecebimentos/{contratoId}_{AAAA-MM}: {contratoId, competencia, valor, recebidoEm, forma, lancamentoId?,
//     observacoes?, por, em}; ao vivo.
import { financeiro } from '@nads/core';
import { addDoc, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, setDoc as setDocBruto, updateDoc as updateDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoHonorarios } from './honorarios';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const addDocGuardado = guardar(addDoc) as typeof addDoc;
const texto = (v: unknown) => (v == null ? '' : String(v));
const FORMAS = financeiro.FORMAS_DE_RECEBIMENTO.map(f => f.valor);

/** as cobranças mandadas: { '2026-09': { em, por } } */
function cobrancasDoBanco(v: unknown): Record<string, { em: string; por: string }> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const saida: Record<string, { em: string; por: string }> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    saida[k] = { em: texto(o.em), por: texto(o.por) };
  }
  return Object.keys(saida).length ? saida : undefined;
}

function contratoDoBanco(id: string, d: Record<string, unknown>): financeiro.ContratoDeHonorario {
  return {
    id, clienteId: texto(d.clienteId), codigo: texto(d.codigo), nome: texto(d.nome), cnpj: texto(d.cnpj).replace(/\D/g, ''),
    valor: Number(d.valor) || 0, ativo: d.ativo !== false, observacoes: texto(d.observacoes) || undefined, cobrancas: cobrancasDoBanco(d.cobrancas),
    criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), atualizadoEm: texto(d.atualizadoEm) || undefined, atualizadoPor: texto(d.atualizadoPor) || undefined,
  };
}

function recebimentoDoBanco(id: string, d: Record<string, unknown>): financeiro.RecebimentoDeHonorario {
  return {
    id, contratoId: texto(d.contratoId), competencia: texto(d.competencia), valor: Number(d.valor) || 0, recebidoEm: texto(d.recebidoEm),
    forma: (FORMAS.includes(d.forma as financeiro.FormaDeRecebimento) ? d.forma : 'outro') as financeiro.FormaDeRecebimento,
    lancamentoId: texto(d.lancamentoId) || undefined, observacoes: texto(d.observacoes) || undefined, por: texto(d.por), em: texto(d.em),
  };
}

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin e o diretor veem o financeiro.' : err.message);

export function criarHonorariosFirestore(): RepoHonorarios {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let contratos: ListaAoVivo<financeiro.ContratoDeHonorario> | null = null;
  let recebimentos: ListaAoVivo<financeiro.RecebimentoDeHonorario> | null = null;

  return {
    exemplos: false,
    contratos() {
      if (!contratos) {
        contratos = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroHonorarios'), s => {
          contratos = { carregada: true, lista: s.docs.map(x => contratoDoBanco(x.id, x.data())), erro: '' };
          mudou();
        }, err => { contratos = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return contratos;
    },
    recebimentos() {
      if (!recebimentos) {
        recebimentos = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroRecebimentos'), s => {
          recebimentos = { carregada: true, lista: s.docs.map(x => recebimentoDoBanco(x.id, x.data())), erro: '' };
          mudou();
        }, err => { recebimentos = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return recebimentos;
    },
    async salvarContrato(d, quem) {
      const agora = new Date().toISOString();
      const base = {
        clienteId: d.clienteId, codigo: d.codigo.trim(), nome: d.nome.trim(), cnpj: d.cnpj.replace(/\D/g, ''),
        valor: Math.round(d.valor * 100) / 100, ativo: d.ativo, ...(d.observacoes?.trim() ? { observacoes: d.observacoes.trim() } : {}),
      };
      const antes = d.id ? contratos?.lista.find(x => x.id === d.id) : undefined;
      if (d.id && antes) {
        await setDoc(doc(db, 'financeiroHonorarios', d.id), { ...base, ...(antes.cobrancas ? { cobrancas: antes.cobrancas } : {}), criadoEm: antes.criadoEm, criadoPor: antes.criadoPor, atualizadoEm: agora, atualizadoPor: quem });
        return d.id;
      }
      return (await addDocGuardado(collection(db, 'financeiroHonorarios'), { ...base, criadoEm: agora, criadoPor: quem })).id;
    },
    async definirValor(id, valor, quem) {
      await updateDoc(doc(db, 'financeiroHonorarios', id), { valor: Math.round(valor * 100) / 100, atualizadoEm: new Date().toISOString(), atualizadoPor: quem });
    },
    async registrarCobranca(id, competencia, quem) {
      // o campo com caminho (cobrancas.2026-09) muda só essa competência, sem apagar as outras
      await updateDoc(doc(db, 'financeiroHonorarios', id), { ['cobrancas.' + competencia]: { em: new Date().toISOString(), por: quem } });
    },
    async receber(d, quem) {
      await setDoc(doc(db, 'financeiroRecebimentos', financeiro.idDoRecebimento(d.contratoId, d.competencia)), {
        contratoId: d.contratoId, competencia: d.competencia, valor: Math.round(d.valor * 100) / 100, recebidoEm: d.recebidoEm, forma: d.forma,
        ...(d.lancamentoId ? { lancamentoId: d.lancamentoId } : {}), ...(d.observacoes?.trim() ? { observacoes: d.observacoes.trim() } : {}),
        por: quem, em: new Date().toISOString(),
      });
    },
    async desfazer(contratoId, competencia) { await deleteDoc(doc(db, 'financeiroRecebimentos', financeiro.idDoRecebimento(contratoId, competencia))); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
