// A legislação do DP cadastrada no nads, no banco do Entregas: legislacaoDp/{id} {assunto, texto, observacoes, data,
// atualizadoEm, atualizadoPor} (a regra: lê quem é membro; o DP e o admin gravam).
import { addDoc as addDocBruto, collection, doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import type { LegislacaoNoBanco, RepoLegislacaoDp } from './legislacaoDp';
import { guardar } from '../../../comum/modoDesenvolvedor';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const addDoc = guardar(addDocBruto) as typeof addDocBruto;

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

export function criarLegislacaoDpFirestore(quem: () => string): RepoLegislacaoDp {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregada: boolean; lista: readonly LegislacaoNoBanco[] } = { carregada: false, lista: [] };
  let ouvindo = false;
  return {
    exemplos: false,
    lista() {
      if (!ouvindo) {
        ouvindo = true;
        onSnapshot(collection(db, 'legislacaoDp'), s => {
          estado = {
            carregada: true,
            lista: s.docs.map(d => {
              const x = d.data();
              return { id: d.id, assunto: texto(x.assunto), texto: texto(x.texto), observacoes: texto(x.observacoes), data: texto(x.data), atualizadoEm: texto(x.atualizadoEm), atualizadoPor: texto(x.atualizadoPor) };
            }).filter(l => l.assunto && l.texto),
          };
          mudou();
        }, () => { estado = { carregada: true, lista: [] }; mudou(); });
      }
      return estado;
    },
    async salvar(l) {
      const dados = { assunto: l.assunto, texto: l.texto, observacoes: l.observacoes, data: l.data || new Date().toISOString().slice(0, 10), atualizadoEm: new Date().toISOString(), atualizadoPor: quem() };
      if (l.id) { await setDoc(doc(db, 'legislacaoDp', l.id), dados); return l.id; }
      const r = await addDoc(collection(db, 'legislacaoDp'), dados);
      return r.id;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
