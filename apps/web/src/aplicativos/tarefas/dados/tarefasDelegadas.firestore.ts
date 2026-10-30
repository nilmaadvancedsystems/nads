// O delegador de tarefas no banco do Entregas (28/10/2026; regra em firestore.rules, bloco nadsTarefasDelegadas): quem
// está no nads lê; quem cria é o criadaPor (o próprio login); mudam o criador e o responsável; apagam o criador e o
// admin. Cada pessoa ouve só as dela (o campo pessoas: o uid de quem criou e o do responsável). Os anexos vão em pedaços
// de até 900 KB em nadsTarefasDelegadas/{id}/partes/{anexo}-{n} (como os dos feedbacks), sem Storage; a lista deles fica
// no documento; o arquivo já chega encolhido (a imagem em WebP, o resto em gzip: encolherAnexo.ts). O número da tarefa
// é o maior que existe + 1 (duas criadas no mesmo segundo podem repetir o número: é só o rótulo, o id é o do documento).
// Sem a regra no ar, o banco recusa: a lista fica vazia com o aviso.
// A tela não depende só do ouvinte (29/10/2026: "a tela inteira do minhas tarefas ta bugado não salva nada"; o Gustavo
// salvou às 17:28 vendo ainda o Savio como responsável, que já tinha devolvido a tarefa às 17:27): o que muda parte da
// tarefa como está no banco agora, e depois de cada gravação a lista é relida do banco.
import {
  arrayUnion, Bytes, collection, deleteDoc as deleteDocBruto, doc, getDoc, getDocFromServer, getDocs, getDocsFromServer, limit, onSnapshot, orderBy, query, setDoc as setDocBruto,
  updateDoc as updateDocBruto, where, type Unsubscribe,
} from 'firebase/firestore';
import { entregas, tarefas } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { anexoDe, conferirAnexos, type ArquivoParaAnexar, type RepoTarefasDelegadas } from './tarefasDelegadas';
import { bytesDoAnexo } from './encolherAnexo';
import { guardar, guardarPedido, modoDesenvolvedor } from '../../../comum/modoDesenvolvedor';

// o erro do banco em português (29/10/2026: a tela mostrava "Missing or insufficient permissions." e parecia que o Salvar
// não fazia nada); o que não está aqui segue com a mensagem que veio
const ERROS_DO_BANCO: Record<string, string> = {
  'permission-denied': 'o banco recusou a gravação (a regra das tarefas no Entregas não deixou)',
  unavailable: 'sem conexão com o banco; confira a internet e tente de novo',
  'not-found': 'a tarefa não existe mais no banco',
  'deadline-exceeded': 'o banco demorou demais para responder; tente de novo',
};
function emPortugues<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => gravar(...a).catch((e: unknown) => {
    const codigo = String((e as { code?: unknown })?.code || '');
    throw new Error(ERROS_DO_BANCO[codigo] || (e instanceof Error ? e.message : String(e)), { cause: e });
  });
}

// a trava do modo desenvolvedor: com o modo ligado, criar é recusado (é mandar para alguém) e o resto finge que gravou
const criarDoc = emPortugues(guardarPedido(setDocBruto)) as typeof setDocBruto;
const setDoc = emPortugues(guardar(setDocBruto)) as typeof setDocBruto;
const updateDoc = emPortugues(guardar(updateDocBruto)) as typeof updateDocBruto;
const deleteDoc = emPortugues(guardar(deleteDocBruto)) as typeof deleteDocBruto;

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
  const daPessoa = (uid: string) => query(collection(db, COLECAO), where('pessoas', 'array-contains', uid), limit(500));
  /** a tarefa como está no banco agora (sem o banco, a da lista) */
  async function noBanco(id: string): Promise<TarefaDelegada> {
    try {
      const s = await getDocFromServer(doc(db, COLECAO, id));
      if (!s.exists()) throw new Error('a tarefa não existe mais');
      return d.lerTarefa(s.id, s.data());
    } catch (e) {
      if (e instanceof Error && e.message === 'a tarefa não existe mais') throw e;
      return daTarefa(id);
    }
  }
  /** relê a lista do banco depois de gravar (se o ouvinte parou, a tela não fica com o que era antes) */
  async function reler() {
    const q = quem();
    // no modo desenvolvedor nada foi ao banco: reler apagaria da tela o que a pessoa fez
    if (!q || !estado || estado.uid !== q.uid || modoDesenvolvedor()) return;
    try {
      const s = await getDocsFromServer(daPessoa(q.uid));
      if (estado?.uid !== q.uid) return;
      estado = { uid: q.uid, carregadas: true, tarefas: s.docs.map(x => d.lerTarefa(x.id, x.data())) };
      mudou();
    } catch { /* sem rede: fica o que o ouvinte trouxer */ }
  }
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
        parar = onSnapshot(daPessoa(q.uid), s => {
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
      await reler();
      return ref.id;
    },
    async salvar(id, r) {
      const por = eu();
      const problema = d.problemaDaTarefa(r);
      if (problema) throw new Error(problema);
      const antes = await noBanco(id);
      const em = new Date().toISOString();
      const linhas = d.historicoDaMudanca(antes, r, por.nome, em);
      if (!linhas.length) return;
      const t = d.mudar(antes, r, por, em);
      await updateDoc(doc(db, COLECAO, id), {
        titulo: t.titulo, descricao: t.descricao, cliente: t.cliente, prioridade: t.prioridade, prazo: t.prazo, status: t.status,
        responsavel: t.responsavel, pessoas: d.pessoasDaTarefa(t), concluidaEm: t.concluidaEm, atualizadaEm: em, historico: historicoNovo(antes, linhas),
      });
      await reler();
    },
    async comentar(id, texto) {
      const por = eu();
      const t = await noBanco(id);
      const problema = d.problemaDoParecer(texto, t);
      if (problema) throw new Error(problema);
      const em = new Date().toISOString();
      await updateDoc(doc(db, COLECAO, id), {
        pareceres: arrayUnion({ por: por.nome, em, texto: d.limparTexto(texto) }), historico: historicoNovo(t, [d.historicoDoParecer(por.nome, em)]), atualizadaEm: em,
      });
      await reler();
    },
    async anexar(id, arquivos) {
      const por = eu();
      const t = await noBanco(id);
      conferirAnexos(t, arquivos);
      const em = new Date().toISOString();
      const novos = await subir(id, arquivos, por.nome, em);
      await updateDoc(doc(db, COLECAO, id), {
        anexos: arrayUnion(...novos), historico: historicoNovo(t, novos.map(a => d.historicoDoAnexo('anexou', a.nome, por.nome, em))), atualizadaEm: em,
      });
      await reler();
    },
    async tirarAnexo(id, anexoId) {
      const por = eu();
      const t = await noBanco(id);
      const a = t.anexos.find(x => x.id === anexoId);
      if (!a) return;
      const em = new Date().toISOString();
      // primeiro sai da lista (ninguém tenta baixar um pela metade), depois os pedaços
      await updateDoc(doc(db, COLECAO, id), {
        anexos: t.anexos.filter(x => x.id !== anexoId), historico: historicoNovo(t, [d.historicoDoAnexo('tirou', a.nome, por.nome, em)]), atualizadaEm: em,
      });
      for (let n = 0; n < a.partes; n++) await deleteDoc(parte(id, anexoId, n));
      await reler();
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
      await reler();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
