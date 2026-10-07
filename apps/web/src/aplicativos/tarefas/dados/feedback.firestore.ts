// Os feedbacks no banco do Entregas (coleção feedbacks; regra em firestore.rules): quem está no nads cria o seu (com o
// uid dele e status 'novo'); só o admin lê todos e muda o status. A imagem vai no próprio documento (JPEG comprimido,
// até ~900 KB), sem Storage.
import { addDoc as addDocBruto, collection, doc, limit, onSnapshot, orderBy, query, updateDoc as updateDocBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { Feedback, RepoFeedback, SituacaoDoFeedback } from './feedback';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;

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
        criadoEm: new Date().toISOString(), status: 'novo',
      });
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
