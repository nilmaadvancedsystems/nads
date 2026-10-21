// Os feedbacks no banco do Entregas (coleção feedbacks; regra em firestore.rules): quem está no nads cria o seu (com o
// uid dele, status 'novo' e a prioridade baixa/media/alta); só o admin lê todos e muda o status. A imagem vai no próprio
// documento (JPEG comprimido, até ~900 KB), sem Storage.
import { addDoc as addDocBruto, Bytes, collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto } from 'firebase/firestore';
import { entregas } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import { ehPrioridade, type Feedback, type RepoFeedback, type SituacaoDoFeedback } from './feedback';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setDoc = guardarPedido(setDocBruto) as typeof setDocBruto;

type Quem = { uid: string; email: string; nome: string } | null;
const texto = (v: unknown) => (v == null ? '' : String(v));
const STATUS: readonly SituacaoDoFeedback[] = ['novo', 'visto', 'feito'];

export function criarFeedbackFirestore(quem: () => Quem): RepoFeedback {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let todos: { carregados: boolean; lista: Feedback[] } | null = null;
  return {
    exemplos: false,
    async enviar(f) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      await addDoc(collection(db, 'feedbacks'), {
        uid: q.uid, nome: q.nome, email: q.email, texto: f.texto, imagem: f.imagem, tela: f.tela, versao: f.versao,
        criadoEm: new Date().toISOString(), status: 'novo', prioridade: f.prioridade,
      });
    },
    // o bug do suporte de leitura (Vitor, 20/10/2026): o documento com a conversa e o contexto, e o arquivo em pedaços em
    // feedbacks/{id}/partes (como o enviosSecretario); o robô do PC do escritório espera os pedaços, investiga e escreve o
    // report (analise 'pronta'). Prioridade Alta: chega para o admin na aba Bugs.
    async enviarBug(b) {
      const q = quem();
      if (!q) throw new Error('entre com a conta do Entregas');
      if (b.arquivo) {
        const problema = entregas.problemaDoArquivo({ nome: b.arquivo.nome, tamanho: b.arquivo.bytes.length });
        if (problema) throw new Error(b.arquivo.nome + ': ' + problema);
      }
      const partes = b.arquivo ? entregas.partesDoArquivo(b.arquivo.bytes) : [];
      const ref = doc(collection(db, 'feedbacks'));
      await setDoc(ref, {
        uid: q.uid, nome: q.nome, email: q.email, texto: b.texto, imagem: '', tela: b.tela, versao: b.versao,
        criadoEm: new Date().toISOString(), status: 'novo', prioridade: 'alta',
        tipo: 'bug', caminho: b.caminho, contexto: b.contexto, analise: 'pendente',
        ...(b.arquivo ? { arquivo: { nome: b.arquivo.nome, tamanho: b.arquivo.bytes.length, partes: partes.length } } : {}),
      });
      for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
    },
    async arquivoDoBug(id) {
      const d = todos?.lista.find(x => x.id === id);
      if (!d?.arquivo) return null;
      const s = await getDocs(collection(db, 'feedbacks', id, 'partes'));
      const pedacos = s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(p => (p.data().dados as Bytes).toUint8Array());
      const bytes = new Uint8Array(pedacos.reduce((t, p) => t + p.length, 0));
      let i = 0;
      for (const p of pedacos) { bytes.set(p, i); i += p.length; }
      return { nome: d.arquivo.nome, bytes };
    },
    todos() {
      if (!todos) {
        todos = { carregados: false, lista: [] };
        onSnapshot(query(collection(db, 'feedbacks'), orderBy('criadoEm', 'desc'), limit(200)), s => {
          todos = {
            carregados: true,
            lista: s.docs.map(d => {
              const x = d.data();
              return {
                id: d.id, texto: texto(x.texto), imagem: texto(x.imagem), tela: texto(x.tela), versao: texto(x.versao), nome: texto(x.nome),
                email: texto(x.email), criadoEm: texto(x.criadoEm), status: (STATUS.includes(x.status) ? x.status : 'novo') as SituacaoDoFeedback,
                prioridade: ehPrioridade(x.prioridade) ? x.prioridade : null,
                tipo: x.tipo === 'bug' ? 'bug' as const : 'feedback' as const, caminho: texto(x.caminho),
                empresa: x.contexto && typeof x.contexto === 'object' ? texto((x.contexto as { empresa?: unknown }).empresa) : '',
                arquivo: x.arquivo && typeof x.arquivo === 'object' ? { nome: texto(x.arquivo.nome), tamanho: Number(x.arquivo.tamanho) || 0, partes: Number(x.arquivo.partes) || 0 } : null,
                analise: (['pendente', 'analisando', 'pronta', 'erro'].includes(x.analise) ? x.analise : '') as Feedback['analise'],
                relatorio: texto(x.relatorio),
              };
            }),
          };
          mudou();
        }, () => { todos = { carregados: true, lista: [] }; mudou(); });
      }
      return todos;
    },
    async marcar(id, status) { await updateDoc(doc(db, 'feedbacks', id), { status }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
