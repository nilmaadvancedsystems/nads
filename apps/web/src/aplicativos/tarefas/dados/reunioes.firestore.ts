// As reuniões no banco do Entregas (coleção nadsReunioes; 13/11/2026). Cada passo grava a reunião inteira de novo (as regras
// do core dizem como ela fica); os arquivos (o Problema e a Solução) vão em pedaços em partes/{arquivo}-{n}, como os anexos
// das tarefas. A regra ainda não está no ar: até o Vitor aprovar, o banco recusa e a lista fica vazia (no modo
// desenvolvedor nada grava mesmo).
import { Bytes, collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto } from 'firebase/firestore';
import { entregas, tarefas } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { bytesDoAnexo } from './encolherAnexo';
import { anexoDe } from './tarefasDelegadas';
import type { RepoReunioes } from './reunioes';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

const COLECAO = 'nadsReunioes';
type Reuniao = tarefas.reunioes.Reuniao;
const r = tarefas.reunioes;

/** a reunião lida do banco (o que faltar fica vazio; um status desconhecido vira Em análise) */
function lerReuniao(id: string, x: Record<string, unknown>): Reuniao {
  const t = (v: unknown) => (v == null ? '' : String(v));
  const pessoa = (v: unknown) => { const o = (v || {}) as Record<string, unknown>; return { uid: t(o.uid), nome: t(o.nome) }; };
  const lista = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const status = (Object.keys(r.ROTULO_DO_STATUS) as string[]).includes(t(x.status)) && x.status !== 'em-andamento' ? x.status as tarefas.reunioes.StatusGuardado : 'em-analise';
  const anexo = (v: unknown) => {
    const a = v as Record<string, unknown> | undefined;
    return a && a.id ? { id: t(a.id), nome: t(a.nome), extensao: t(a.extensao), tamanho: Number(a.tamanho) || 0, em: t(a.em), por: t(a.por), partes: Number(a.partes) || 0, ...(a.gzip === true ? { gzip: true as const } : {}) } : undefined;
  };
  const problema = anexo(x.problema), solucao = anexo(x.solucao);
  return {
    id, titulo: t(x.titulo), pauta: t(x.pauta), quando: t(x.quando), ...(x.link ? { link: t(x.link) } : {}),
    criadaPor: pessoa(x.criadaPor), origem: x.origem === 'direta' ? 'direta' : 'pedido', participantes: lista(x.participantes).map(pessoa), comDiretor: x.comDiretor === true,
    ...(x.tipo === 'live' ? { tipo: 'live' as const } : {}), ...(Number(x.duracao) > 0 ? { duracao: Number(x.duracao) } : {}),
    status, ...(x.prazoDaRevisao ? { prazoDaRevisao: t(x.prazoDaRevisao) } : {}), ...(x.decididoPor ? { decididoPor: t(x.decididoPor) } : {}), ...(x.observacao ? { observacao: t(x.observacao) } : {}),
    ...(problema ? { problema } : {}), ...(solucao ? { solucao } : {}),
    comentarios: lista(x.comentarios).map(c => ({ uid: t(c.uid), nome: t(c.nome), texto: t(c.texto), em: t(c.em) })),
    presencas: lista(x.presencas).map(p => ({ uid: t(p.uid), nome: t(p.nome), vai: p.vai === true, em: t(p.em) })),
    historico: lista(x.historico).map(n => ({ por: t(n.por), em: t(n.em), texto: t(n.texto) })), em: t(x.em),
  };
}

export function criarReunioesFirestore(quem: () => { uid: string; nome: string } | null): RepoReunioes {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregadas: boolean; reunioes: Reuniao[] } | null = null;
  const eu = () => { const q = quem(); if (!q) throw new Error('entre com a sua conta'); return q; };
  const agora = () => new Date().toISOString();
  const daLista = (id: string) => { const x = estado?.reunioes.find(y => y.id === id); if (!x) throw new Error('a reunião não existe mais'); return x; };
  /** grava a reunião inteira (sem o id, que é o do documento) */
  const gravar = async (x: Reuniao) => { const { id, ...dados } = x; await setDoc(doc(db, COLECAO, id), dados); };
  const mudar = async (id: string, f: (x: Reuniao) => Reuniao) => gravar(f(daLista(id)));
  const parte = (id: string, arquivoId: string, n: number) => doc(db, COLECAO, id, 'partes', arquivoId + '-' + n);
  return {
    exemplos: false,
    lista() {
      if (!estado) {
        estado = { carregadas: false, reunioes: [] };
        onSnapshot(query(collection(db, COLECAO), orderBy('em', 'desc'), limit(200)),
          s => { estado = { carregadas: true, reunioes: s.docs.map(d => lerReuniao(d.id, d.data())) }; mudou(); },
          e => { console.warn('As reuniões não abriram:', e instanceof Error ? e.message : e); estado = { carregadas: true, reunioes: [] }; mudou(); });
      }
      return estado;
    },
    async pedir(p, direta) {
      const problema = r.problemaDoPedido(p);
      if (problema) throw new Error(problema);
      await gravar(r.nova(p, { id: doc(collection(db, COLECAO)).id, por: eu(), em: agora(), direta }));
    },
    revisar: (id, prazo) => mudar(id, x => r.revisar(x, prazo, eu().nome, agora())),
    decidir: (id, aprovar, observacao) => mudar(id, x => r.decidir(x, aprovar, observacao, eu().nome, agora())),
    remarcar: (id, quando) => mudar(id, x => r.remarcar(x, quando, eu().nome, agora())),
    confirmar: (id, vai) => mudar(id, x => r.confirmarPresenca(x, eu(), vai, agora())),
    async anexar(id, qual, arquivo) {
      const arquivoId = doc(collection(db, COLECAO)).id;
      const pedacos = entregas.partesDoArquivo(arquivo.bytes);
      for (let n = 0; n < pedacos.length; n++) await setDoc(parte(id, arquivoId, n), { dados: Bytes.fromUint8Array(pedacos[n]) });
      await mudar(id, x => r.anexar(x, qual, anexoDe(arquivo, { id: arquivoId, em: agora(), por: eu().nome, partes: pedacos.length }), eu().nome, agora()));
    },
    async baixar(id, qual) {
      const a = daLista(id)[qual];
      if (!a) return null;
      const docs = await Promise.all(Array.from({ length: a.partes }, (_, n) => getDoc(parte(id, a.id, n))));
      if (docs.some(x => !x.exists())) return null;
      const pedacos = docs.map(x => (x.data()?.dados as Bytes).toUint8Array());
      const bytes = new Uint8Array(pedacos.reduce((s, p) => s + p.length, 0));
      let k = 0;
      for (const p of pedacos) { bytes.set(p, k); k += p.length; }
      return bytesDoAnexo(bytes, a.gzip);
    },
    finalizar: id => mudar(id, x => r.finalizar(x, eu().nome, agora())),
    comentar: (id, texto) => mudar(id, x => r.comentar(x, eu(), texto, agora())),
    encerrar: id => mudar(id, x => r.encerrar(x, eu().nome, agora())),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
