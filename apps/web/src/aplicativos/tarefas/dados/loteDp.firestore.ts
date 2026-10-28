// O lote do DP › Envios no banco do Entregas (28/10/2026), nas regras de lá (só o DP e o admin):
//   - lotesDp/{lote}: { status: 'enviando' → 'pendente' (a tela) → lendo → lido (o robô) → 'disparar' (a tela, com
//     disparadoPor/disparadoPorUid) → disparando → disparado (o robô), criadoEm, criadoPor, criadoPorUid, total, lidos,
//     resultados.<código>_<AAAA-MM> };
//   - lotesDp/{lote}/arquivos/{k}: { nome, tamanho, partes, status: 'enviando' → 'pendente' }, com os pedaços em
//     .../partes/{n} { dados: Bytes } (como o enviosSecretario); o robô grava a leitura (ou o erro); a tela, a escolha e o fora.
import { addDoc as addDocBruto, Bytes, collection, doc, onSnapshot, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { entregas as e } from '@nads/core';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { ArquivoDoLote, LeituraDoArquivo, LoteDp, RepoLoteDp, ResultadoDoLote } from './loteDp';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const texto = (v: unknown) => (v == null ? '' : String(v));
const textos = (v: unknown) => (Array.isArray(v) ? v.map(texto) : []);
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function leituraDoBanco(v: unknown): LeituraDoArquivo | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  return {
    acao: texto(d.acao), motivo: texto(d.motivo), cliente: numero(d.cliente), clienteNome: texto(d.clienteNome), tipo: texto(d.tipo),
    tributo: texto(d.tributo), competencia: texto(d.competencia), valor: texto(d.valor), vencimento: texto(d.vencimento),
    nomeFinal: texto(d.nomeFinal), destino: textos(d.destino), semTexto: d.semTexto === true,
  };
}
function arquivoDoBanco(id: string, d: Record<string, unknown>): ArquivoDoLote {
  const es = d.escolha as Record<string, unknown> | null | undefined;
  return {
    id, nome: texto(d.nome), tamanho: Number(d.tamanho) || 0, status: texto(d.status), erro: texto(d.erro), leitura: leituraDoBanco(d.leitura),
    escolha: es && numero(es.cliente) != null ? { cliente: numero(es.cliente) as number, tipo: texto(es.tipo), competencia: texto(es.competencia) } : null,
    fora: d.fora === true,
  };
}
function loteDoBanco(id: string, d: Record<string, unknown>): LoteDp {
  const r = (d.resultados || {}) as Record<string, Record<string, unknown>>;
  const resultados: ResultadoDoLote[] = Object.entries(r).map(([chave, x]) => ({
    chave, codigo: Number(x.codigo) || 0, competencia: texto(x.competencia), status: texto(x.status), erro: texto(x.erro), para: textos(x.para),
    enviadoEm: texto(x.enviadoEm), arquivos: textos(x.arquivos),
    salvos: (Array.isArray(x.salvos) ? x.salvos : []).map(s => { const o = (s || {}) as Record<string, unknown>; return { nome: texto(o.nome), pasta: texto(o.pasta), jaEstava: o.jaEstava === true, erro: texto(o.erro) }; }),
    valores: Object.fromEntries(Object.entries((x.valores || {}) as Record<string, unknown>).filter(([, v]) => typeof v === 'number')) as Record<string, number>,
  })).sort((a, b) => a.codigo - b.codigo);
  return {
    id, status: texto(d.status), criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor), total: Number(d.total) || 0, lidos: Number(d.lidos) || 0,
    erro: texto(d.erro), disparadoPor: texto(d.disparadoPor), resultados,
  };
}

export function criarLoteDpFirestore(quem: () => e.Quem | null): RepoLoteDp {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lotes: { carregados: boolean; lista: LoteDp[] } = { carregados: false, lista: [] };
  let ouvindo = '';

  return {
    exemplos: false,
    lotes() {
      const q = quem();
      if (q && ouvindo !== q.uid) {
        ouvindo = q.uid;
        // só igualdade (sem orderBy, que pediria um índice): a ordem é feita aqui
        onSnapshot(query(collection(db, 'lotesDp'), where('criadoPorUid', '==', q.uid)), s => {
          lotes = { carregados: true, lista: s.docs.map(x => loteDoBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) };
          mudou();
        }, () => { lotes = { carregados: true, lista: [] }; mudou(); });
      }
      return lotes;
    },
    arquivos(lote, chegou) {
      return onSnapshot(collection(db, 'lotesDp', lote, 'arquivos'), s => {
        chegou(s.docs.map(x => arquivoDoBanco(x.id, x.data())).sort((a, b) => Number(a.id) - Number(b.id)));
      }, () => chegou([]));
    },
    async subir(lista, andamento) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const ref = await addDoc(collection(db, 'lotesDp'), { status: 'enviando', criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid, total: lista.length });
      for (let k = 0; k < lista.length; k++) {
        const a = lista[k];
        const partes = e.partesDoArquivo(a.bytes);
        const arq = doc(ref, 'arquivos', String(k));
        await setDoc(arq, { nome: e.nomeParaEnviar(a.nome), tamanho: a.bytes.length, partes: partes.length, status: 'enviando' });
        for (let i = 0; i < partes.length; i++) await setDoc(doc(arq, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
        await updateDoc(arq, { status: 'pendente' });
        andamento(k + 1, lista.length);
      }
      await updateDoc(ref, { status: 'pendente' });
      return ref.id;
    },
    async escolher(lote, arquivo, escolha) {
      await updateDoc(doc(db, 'lotesDp', lote, 'arquivos', arquivo), { escolha: escolha ? { cliente: escolha.cliente, tipo: escolha.tipo, competencia: escolha.competencia } : null });
    },
    async tirar(lote, arquivo, fora) {
      await updateDoc(doc(db, 'lotesDp', lote, 'arquivos', arquivo), { fora });
    },
    async disparar(lote) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      await updateDoc(doc(db, 'lotesDp', lote), { status: 'disparar', disparadoPor: q.nome, disparadoPorUid: q.uid, pedidoEm: new Date().toISOString() });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
