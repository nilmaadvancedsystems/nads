// O que é só da pessoa (a Minha página), no banco do Entregas (02/10/2026, pedido do Vitor: a caixa de entrada mais
// completa, as anotações, a conta). Só o que as regras do Entregas já deixam a própria pessoa fazer:
//   - solicitacoesEmail: LEITURA dos pedidos com o e-mail dela (criadoPorEmail; as Pendências e a Tarefas gravam o
//     e-mail em todos, o uid só em alguns) — Pedir documentos (tipo um/lote) e as respostas pelo robô;
//   - usuarios/{uid}/notas: as Anotações (as mesmas do Entregas) — só a dona lê e grava;
//   - usuarios/{uid}.nadsArquivados: os itens da caixa de entrada que ela arquivou (o dono mexe no próprio documento,
//     menos em roles/email/criadoEm).
import { addDoc as addDocBruto, arrayRemove, arrayUnion, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, query, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';
import { cobrancasRecentes, ordenarNotas, type CobrancaMinha, type Nota, type RepoPessoal, type TipoDeCobranca } from './pessoal';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

type Quem = { uid: string; email: string } | null;

const texto = (v: unknown) => (v == null ? '' : String(v));
/** O ExtraTudo grava criadoEm como Timestamp; o resto, como texto ISO. */
function iso(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate().toISOString() : '';
}

export function criarPessoalFirestore(quem: () => Quem): RepoPessoal {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let cobrancas: { carregadas: boolean; lista: CobrancaMinha[] } = { carregadas: false, lista: [] };
  let notas: { carregadas: boolean; lista: Nota[] } = { carregadas: false, lista: [] };
  let arquivados: string[] = [];
  let ouvindoDe = '';
  const paradas: (() => void)[] = [];

  function ouvir() {
    const q = quem();
    const chave = q ? q.uid + '|' + q.email : '';
    if (chave === ouvindoDe) return;
    ouvindoDe = chave;
    paradas.splice(0).forEach(f => f());
    cobrancas = { carregadas: !q, lista: [] };
    notas = { carregadas: !q, lista: [] };
    arquivados = [];
    if (!q) return;
    if (q.email) {
      paradas.push(onSnapshot(query(collection(db, 'solicitacoesEmail'), where('criadoPorEmail', '==', q.email)), s => {
        const lista: CobrancaMinha[] = s.docs.flatMap(d => {
          const x = d.data();
          const tipo = texto(x.tipo);
          if (tipo !== 'um' && tipo !== 'lote' && tipo !== 'responder') return [];
          const ids = Array.isArray(x.clienteIds) ? x.clienteIds.length : 0;
          return [{
            id: d.id, tipo: tipo as TipoDeCobranca,
            para: tipo === 'lote' ? ids + ' clientes' : texto(x.para),
            clienteNome: texto(x.clienteNome), assunto: texto(x.assunto), status: texto(x.status) || 'pendente',
            criadoEm: iso(x.criadoEm), enviadoEm: iso(x.enviadoEm), erro: texto(x.erro),
          }];
        });
        cobrancas = { carregadas: true, lista: cobrancasRecentes(lista) };
        mudou();
      }, () => { cobrancas = { carregadas: true, lista: [] }; mudou(); }));
    } else cobrancas = { carregadas: true, lista: [] };
    paradas.push(onSnapshot(collection(db, 'usuarios', q.uid, 'notas'), s => {
      notas = { carregadas: true, lista: ordenarNotas(s.docs.map(d => {
        const x = d.data();
        return { id: d.id, texto: texto(x.texto), feito: x.feito === true, criadoEm: iso(x.criadoEm), lembreteEm: iso(x.lembreteEm) || null };
      })) };
      mudou();
    }, () => { notas = { carregadas: true, lista: [] }; mudou(); }));
    paradas.push(onSnapshot(doc(db, 'usuarios', q.uid), s => {
      const v = (s.data() || {}).nadsArquivados;
      arquivados = Array.isArray(v) ? v.map(texto) : [];
      mudou();
    }, () => {}));
  }

  function eu(): { uid: string; email: string } {
    const q = quem();
    if (!q) throw new Error('Sem login.');
    return q;
  }
  const minhasNotas = () => collection(db, 'usuarios', eu().uid, 'notas');

  return {
    exemplos: false,
    minhasCobrancas: () => { ouvir(); return cobrancas; },
    notas: () => { ouvir(); return notas; },
    async novaNota(t, lembreteEm) {
      // os mesmos campos das Anotações do Entregas (avisadoEm: o Entregas marca quando avisou do lembrete)
      await addDoc(minhasNotas(), { texto: t, feito: false, criadoEm: new Date().toISOString(), ...(lembreteEm ? { lembreteEm, avisadoEm: null } : {}) });
    },
    async editarNota(id, t) { await updateDoc(doc(minhasNotas(), id), { texto: t }); },
    async marcarNota(id, feito) { await updateDoc(doc(minhasNotas(), id), { feito }); },
    async apagarNota(id) { await deleteDoc(doc(minhasNotas(), id)); },
    arquivados: () => { ouvir(); return arquivados; },
    async arquivar(id) { await updateDoc(doc(db, 'usuarios', eu().uid), { nadsArquivados: arrayUnion(id) }); },
    async desarquivar(id) { await updateDoc(doc(db, 'usuarios', eu().uid), { nadsArquivados: arrayRemove(id) }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
