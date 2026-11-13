// O mural de avisos no banco do Entregas (coleção nadsAvisos; regra em firestore.rules): toda a equipe no nads lê; só o
// admin e o diretor criam, fixam e apagam. Sem a regra no ar, o banco recusa: o mural fica vazio e publicar avisa o erro.
import { arrayUnion, collection, deleteDoc as deleteDocBruto, doc, limit, onSnapshot, orderBy, query, setDoc as setDocBruto, updateDoc as updateDocBruto, where, type QuerySnapshot } from 'firebase/firestore';
import { tarefas as t } from '@nads/core';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoAvisos } from './avisos';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor: com o modo ligado, nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

const texto = (v: unknown) => (v == null ? '' : String(v));
// o comunicado do Início novo (13/11/2026): o tipo, o título, o link e o dia da reunião só entram quando o documento tem
const avisosDe = (s: QuerySnapshot): t.AvisoDoEscritorio[] => s.docs.map(d => {
  const x = d.data();
  return {
    id: d.id, texto: texto(x.texto), por: texto(x.por), em: texto(x.em), fixado: x.fixado === true,
    ...(t.ehTipoDeComunicado(x.tipo) ? { tipo: x.tipo } : {}),
    ...(x.titulo ? { titulo: texto(x.titulo) } : {}),
    ...(x.link && t.linkValido(texto(x.link)) ? { link: texto(x.link) } : {}),
    ...(x.quando ? { quando: texto(x.quando) } : {}),
    // quem escreveu, o pedido de confirmação, os Recebidos e para quem é (13/11/2026)
    ...(x.porUid ? { porUid: texto(x.porUid) } : {}),
    ...(x.pedeConfirmacao === true ? { pedeConfirmacao: true } : {}),
    ...(Array.isArray(x.recebidos) ? { recebidos: (x.recebidos as Record<string, unknown>[]).map(r => ({ uid: texto(r.uid), nome: texto(r.nome), em: texto(r.em) })).filter(r => r.uid) } : {}),
    ...(destino(x.para) ? { para: destino(x.para)! } : {}),
  };
});

/** o destino lido do banco (um formato que não conhece fica para todos) */
function destino(v: unknown): t.DestinoDoAviso | null {
  const p = v as Record<string, unknown> | undefined;
  if (p?.tipo === 'setor' && Array.isArray(p.setores)) return { tipo: 'setor', setores: p.setores.map(texto) };
  if (p?.tipo === 'pessoas' && Array.isArray(p.pessoas)) return { tipo: 'pessoas', pessoas: (p.pessoas as Record<string, unknown>[]).map(x => ({ uid: texto(x.uid), nome: texto(x.nome) })) };
  return null;
}

export function criarAvisosFirestore(): RepoAvisos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let estado: { carregados: boolean; avisos: t.AvisoDoEscritorio[] } | null = null;
  return {
    exemplos: false,
    lista() {
      if (!estado) {
        estado = { carregados: false, avisos: [] };
        // os 50 mais novos e, à parte, os fixados (30/10/2026: o fixado antigo saía dos 50 e sumia do mural); só igualdade
        // nos fixados, sem orderBy, que pediria um índice. O mural abre quando as duas leituras chegam (ou falham).
        const lidas: { recentes: t.AvisoDoEscritorio[] | null; fixados: t.AvisoDoEscritorio[] | null } = { recentes: null, fixados: null };
        const juntar = () => {
          estado = { carregados: lidas.recentes != null && lidas.fixados != null, avisos: t.juntarAvisos(lidas.recentes || [], lidas.fixados || []) };
          mudou();
        };
        const falhou = (qual: 'recentes' | 'fixados') => (e: unknown) => {
          console.warn('O mural de avisos não abriu:', e instanceof Error ? e.message : e);
          lidas[qual] = [];
          juntar();
        };
        onSnapshot(query(collection(db, 'nadsAvisos'), orderBy('em', 'desc'), limit(50)), s => { lidas.recentes = avisosDe(s); juntar(); }, falhou('recentes'));
        onSnapshot(query(collection(db, 'nadsAvisos'), where('fixado', '==', true)), s => { lidas.fixados = avisosDe(s); juntar(); }, falhou('fixados'));
      }
      return estado;
    },
    // os campos do comunicado (extras) só passam no banco quando a regra do nadsAvisos aceitar (ainda não publicada: 13/11/2026)
    async publicar(textoDoAviso, por, extras, porUid) {
      const problema = extras ? t.problemaDoComunicado(textoDoAviso, extras) : t.problemaDoAviso(textoDoAviso);
      if (problema) throw new Error(problema);
      await setDoc(doc(collection(db, 'nadsAvisos')), { texto: t.limparAviso(textoDoAviso), por, em: new Date().toISOString(), fixado: false, ...(porUid ? { porUid } : {}), ...(extras ? t.camposDoComunicado(extras) : {}) });
    },
    async fixar(id, fixado) { await updateDoc(doc(db, 'nadsAvisos', id), { fixado }); },
    async marcarRecebido(id, quem) { await updateDoc(doc(db, 'nadsAvisos', id), { recebidos: arrayUnion({ uid: quem.uid, nome: quem.nome, em: new Date().toISOString() }) }); },
    async apagar(id) { await deleteDoc(doc(db, 'nadsAvisos', id)); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
