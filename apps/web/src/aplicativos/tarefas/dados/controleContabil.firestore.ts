// O Controle contábil no banco do Entregas: controleContabil/{ano}_{código}, uma linha por empresa e ano. A tela ouve só as
// linhas do ano aberto (where ano ==), nunca a coleção inteira. Lê a equipe do nads; grava o Contábil e o admin (regras do banco).
import { tarefas as t } from '@nads/core';
import { collection, deleteDoc as deleteDocBruto, doc, getDocs, onSnapshot, query, setDoc as setDocBruto, where, writeBatch as writeBatchBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { AnoDoControleContabil, RepoControleContabil } from './controleContabil';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

const COLECAO = 'controleContabil';
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function linhaDoDocumento(d: Record<string, unknown>): t.LinhaDoControleContabil | null {
  const ano = Number(d.ano);
  const codigo = Number(d.codigo);
  if (!Number.isInteger(ano) || !Number.isInteger(codigo) || codigo <= 0) return null;
  const mes = Number(d.feitaAte);
  return {
    ano, codigo, feitaAte: Number.isInteger(mes) && mes >= 0 && mes <= 12 ? mes : 0,
    observacao: texto(d.observacao, t.MAX_OBSERVACAO_CONTABIL), pausada: texto(d.pausada, t.MAX_MOTIVO_PAUSA),
    atualizadoEm: texto(d.atualizadoEm, 40), atualizadoPor: texto(d.atualizadoPor, 100),
  };
}

export function criarControleContabilFirestore(quem: () => string): RepoControleContabil {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const anos = new Map<number, AnoDoControleContabil>();
  const documento = (l: t.LinhaDoControleContabil) => ({
    ano: l.ano, codigo: l.codigo, feitaAte: Math.max(0, Math.min(12, Math.trunc(l.feitaAte))),
    observacao: l.observacao.slice(0, t.MAX_OBSERVACAO_CONTABIL), pausada: l.pausada.slice(0, t.MAX_MOTIVO_PAUSA),
    atualizadoEm: new Date().toISOString(), atualizadoPor: quem().slice(0, 100),
  });
  const consulta = (ano: number) => query(collection(db, COLECAO), where('ano', '==', ano));
  const dosDocs = (docs: { data: () => Record<string, unknown> }[]) => docs.map(d => linhaDoDocumento(d.data())).filter((l): l is t.LinhaDoControleContabil => !!l);
  return {
    exemplos: false,
    doAno(ano) {
      const ja = anos.get(ano);
      if (ja) return ja;
      anos.set(ano, { carregada: false, falhou: false, linhas: new Map() });
      onSnapshot(consulta(ano), s => {
        anos.set(ano, { carregada: true, falhou: false, linhas: new Map(dosDocs(s.docs).map(l => [l.codigo, l])) });
        mudou();
      }, () => { anos.set(ano, { ...(anos.get(ano) as AnoDoControleContabil), carregada: true, falhou: true }); mudou(); });
      return anos.get(ano) as AnoDoControleContabil;
    },
    async lerAno(ano) { return dosDocs((await getDocs(consulta(ano))).docs); },
    async salvar(l) { await setDoc(doc(db, COLECAO, t.idDaLinhaContabil(l.ano, l.codigo)), documento(l)); },
    async salvarVarias(ls) {
      // o lote do Firestore aceita até 500 gravações
      for (let i = 0; i < ls.length; i += 400) {
        const b = writeBatch(db);
        for (const l of ls.slice(i, i + 400)) b.set(doc(db, COLECAO, t.idDaLinhaContabil(l.ano, l.codigo)), documento(l));
        await b.commit();
      }
    },
    async remover(ano, codigo) { await deleteDoc(doc(db, COLECAO, t.idDaLinhaContabil(ano, codigo))); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
