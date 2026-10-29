// O delegador de tarefas no banco do Entregas (28/10/2026; regra em firestore.rules, bloco nadsTarefasDelegadas): quem
// está no nads lê; quem cria é o criadaPor (o próprio login); mudam o criador e o responsável; apagam o criador e o
// admin. Cada pessoa ouve só as dela (o campo pessoas: o uid de quem criou e o do responsável). Os anexos vão em pedaços
// de até 900 KB em nadsTarefasDelegadas/{id}/partes/{anexo}-{n} (como os dos feedbacks), sem Storage; a lista deles fica
// no documento; o arquivo já chega encolhido (a imagem em WebP, o resto em gzip: encolherAnexo.ts). O número da tarefa
// é o maior que existe + 1 (duas criadas no mesmo segundo podem repetir o número: é só o rótulo, o id é o do documento).
// Sem a regra no ar, o banco recusa: a lista fica vazia com o aviso.
import {
  arrayUnion, Bytes, collection, deleteDoc as deleteDocBruto, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc as setDocBruto,
  updateDoc as updateDocBruto, where, type Unsubscribe,
} from 'firebase/firestore';
import { entregas, tarefas } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { anexoDe, conferirAnexos, type ArquivoParaAnexar, type RepoTarefasDelegadas } from './tarefasDelegadas';
import { bytesDoAnexo } from './encolherAnexo';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, criar é recusado (é mandar para alguém) e o resto finge que gravou
const criarDoc = guardarPedido(setDocBruto) as typeof setDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

const d = tarefas.delegadas;
type TarefaDelegada = tarefas.delegadas.TarefaDelegada;
type Pessoa = tarefas.delegadas.Pessoa;
const COLECAO = 'nadsTarefasDelegadas';

export function criarTarefasDelegadasFirestore(quem: () => Pessoa | null): RepoTarefasDelegadas {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { uid: string; carregadas: boolean; tarefas: TarefaDelegada[]; erro?: string } | null = null;
  let parar: Unsubscribe | null = null;

  const eu = () => { const q = quem(); if (!q) throw new Error('entre com a conta do Entregas'); return q; };
  const daTarefa = (id: string) => {
    const t = estado?.tarefas.find(x => x.id === id);
    if (!t) throw new Error('a tarefa não está mais na sua lista');
    return t;
  };
  const parte = (id: string, anexoId: string, n: number) => doc(db, COLECAO, id, 'partes', anexoId + '-' + n);

  /** sobe os pedaços de cada arquivo e devolve a lista dos anexos (para o documento) */
  async function subir(id: string, arquivos: readonly ArquivoParaAnexar[], por: string, em: string) {
    const anexos: TarefaDelegada['anexos'] = [];
    for (const a of arquivos) {
      const anexoId = doc(collection(db, COLECAO)).id;
      const pedacos = entregas.partesDoArquivo(a.bytes);
      for (let n = 0; n < pedacos.length; n++) await setDoc(parte(id, anexoId, n), { dados: Bytes.fromUint8Array(pedacos[n]) });
      anexos.push(anexoDe(a, { id: anexoId, em, por, partes: pedacos.length }));
    }
    return anexos;
  }

  /** o histórico: as linhas novas no fim (arrayUnion, sem perder as de quem gravou junto); cheio, a lista já aparada */
  const historicoNovo = (t: TarefaDelegada, linhas: tarefas.delegadas.Nota[]) =>
    (t.historico.length + linhas.length > d.MAIOR_HISTORICO ? d.noHistorico(t.historico, linhas) : arrayUnion(...linhas));

  return {
    exemplos: false,
    eu: quem,
    lista() {
      const q = quem();
      if (!q) return { carregadas: false, tarefas: [] };
      if (!estado || estado.uid !== q.uid) {
        parar?.();
        const este: NonNullable<typeof estado> = { uid: q.uid, carregadas: false, tarefas: [] };
        estado = este;
        // sem orderBy (a ordem é a do core): a busca por um campo só não pede índice composto
        parar = onSnapshot(query(collection(db, COLECAO), where('pessoas', 'array-contains', q.uid), limit(500)), s => {
          if (estado !== este) return;
          estado = { uid: q.uid, carregadas: true, tarefas: s.docs.map(x => d.lerTarefa(x.id, x.data())) };
          mudou();
        }, e => {
          if (estado !== este) return;
          console.warn('As tarefas delegadas não abriram:', e instanceof Error ? e.message : e);
          estado = { uid: q.uid, carregadas: true, tarefas: [], erro: 'Não consegui abrir as tarefas (o banco recusou). Tente de novo mais tarde.' };
          mudou();
        });
      }
      return estado;
    },
    async criar(r, anexos) {
      const por = eu();
      const problema = d.problemaDaTarefa(r);
      if (problema) throw new Error(problema);
      conferirAnexos(null, anexos);
      const ultima = await getDocs(query(collection(db, COLECAO), orderBy('numero', 'desc'), limit(1)));
      const numero = (Number(ultima.docs[0]?.data().numero) || 0) + 1;
      const ref = doc(collection(db, COLECAO));
      const em = new Date().toISOString();
      const t = d.nova(r, { id: ref.id, numero, por, em });
      // o id é o do documento: não vai dentro dele
      const campos: Record<string, unknown> = { ...t, pessoas: d.pessoasDaTarefa(t) };
      delete campos.id;
      await criarDoc(ref, campos);
      // os anexos depois do documento (a regra dos pedaços confere quem é da tarefa); a lista só entra com todos no banco
      if (anexos.length) {
        const novos = await subir(ref.id, anexos, por.nome, em);
        await updateDoc(ref, { anexos: novos, historico: arrayUnion(...novos.map(a => d.historicoDoAnexo('anexou', a.nome, por.nome, em))), atualizadaEm: em });
      }
      return ref.id;
    },
    async salvar(id, r) {
      const por = eu();
      const problema = d.problemaDaTarefa(r);
      if (problema) throw new Error(problema);
      const antes = daTarefa(id);
      const em = new Date().toISOString();
      const linhas = d.historicoDaMudanca(antes, r, por.nome, em);
      if (!linhas.length) return;
      const t = d.mudar(antes, r, por, em);
      await updateDoc(doc(db, COLECAO, id), {
        titulo: t.titulo, descricao: t.descricao, cliente: t.cliente, prioridade: t.prioridade, prazo: t.prazo, status: t.status,
        responsavel: t.responsavel, pessoas: d.pessoasDaTarefa(t), concluidaEm: t.concluidaEm, atualizadaEm: em, historico: historicoNovo(antes, linhas),
      });
    },
    async comentar(id, texto) {
      const por = eu();
      const t = daTarefa(id);
      const problema = d.problemaDoParecer(texto, t);
      if (problema) throw new Error(problema);
      const em = new Date().toISOString();
      await updateDoc(doc(db, COLECAO, id), {
        pareceres: arrayUnion({ por: por.nome, em, texto: d.limparTexto(texto) }), historico: historicoNovo(t, [d.historicoDoParecer(por.nome, em)]), atualizadaEm: em,
      });
    },
    async anexar(id, arquivos) {
      const por = eu();
      const t = daTarefa(id);
      conferirAnexos(t, arquivos);
      const em = new Date().toISOString();
      const novos = await subir(id, arquivos, por.nome, em);
      await updateDoc(doc(db, COLECAO, id), {
        anexos: arrayUnion(...novos), historico: historicoNovo(t, novos.map(a => d.historicoDoAnexo('anexou', a.nome, por.nome, em))), atualizadaEm: em,
      });
    },
    async tirarAnexo(id, anexoId) {
      const por = eu();
      const t = daTarefa(id);
      const a = t.anexos.find(x => x.id === anexoId);
      if (!a) return;
      const em = new Date().toISOString();
      // primeiro sai da lista (ninguém tenta baixar um pela metade), depois os pedaços
      await updateDoc(doc(db, COLECAO, id), {
        anexos: t.anexos.filter(x => x.id !== anexoId), historico: historicoNovo(t, [d.historicoDoAnexo('tirou', a.nome, por.nome, em)]), atualizadaEm: em,
      });
      for (let n = 0; n < a.partes; n++) await deleteDoc(parte(id, anexoId, n));
    },
    async baixarAnexo(id, anexoId) {
      const a = daTarefa(id).anexos.find(x => x.id === anexoId);
      if (!a) return null;
      const docs = await Promise.all(Array.from({ length: a.partes }, (_, n) => getDoc(parte(id, anexoId, n))));
      if (docs.some(x => !x.exists())) return null;
      const pedacos = docs.map(x => (x.data()?.dados as Bytes).toUint8Array());
      const bytes = new Uint8Array(pedacos.reduce((s, p) => s + p.length, 0));
      let k = 0;
      for (const p of pedacos) { bytes.set(p, k); k += p.length; }
      return bytesDoAnexo(bytes, a.gzip);
    },
    async excluir(id) {
      const t = daTarefa(id);
      // os pedaços antes (a regra deles olha a tarefa, que ainda existe), depois a tarefa
      for (const a of t.anexos) for (let n = 0; n < a.partes; n++) await deleteDoc(parte(id, a.id, n));
      await deleteDoc(doc(db, COLECAO, id));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
