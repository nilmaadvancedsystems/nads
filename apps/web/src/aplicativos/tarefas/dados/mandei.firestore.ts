// O Mandei no banco do Entregas (11/11/2026, "liga ao banco"), nas regras publicadas em 07/10/2026
// (docs/mandei/regras-do-banco.md):
//   - tickets/{id}: o ticket inteiro (só a equipe no nads); tickets/_numero guarda o próximo número (#0001);
//   - ticketsLinks/{codigo}: o formulário de cada link (o DocDoLink do core, com o validoAte como data do banco: a regra
//     compara com a hora do servidor). A equipe cria e fecha; o cliente marca que abriu e manda as respostas e os arquivos;
//   - solicitacoesEmail: o pedido do e-mail com o link (tipo 'mandei'); o robô (robo/mandei.js) manda pela caixa do setor
//     de quem pediu e marca no ticket quando enviou (ou o erro);
//   - enviosSecretario (só leitura, com o ticket): o andamento dos arquivos que o cliente anexou (o robô grava no Drive).
// A tela vê o ticket já com o que o cliente fez (mandei.ticketComOsLinks). Sem fetch: só o Firestore.
import { mandei as m, type entregas } from '@nads/core';
import {
  collection, doc, limit, onSnapshot, orderBy, query, runTransaction, setDoc as setDocBruto, Timestamp,
  updateDoc as updateDocBruto, where, type Unsubscribe,
} from 'firebase/firestore';
import { EVENTO_BLOQUEADO, guardar, guardarPedido, MENSAGEM_BLOQUEADO, modoDesenvolvedor } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import type { RepoMandei } from './mandei';

// a trava do modo desenvolvedor: com o modo ligado, só ver (nada é gravado nem pedido ao robô)
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setPedido = guardarPedido(setDocBruto) as (ref: Parameters<typeof setDocBruto>[0], dados: Record<string, unknown>) => Promise<void>;

/** O formulário fica no site do cliente (cliente.nilmacontabilidade.com/mandei/<código>), sem login. */
const FORMULARIO = 'https://cliente.nilmacontabilidade.com/mandei/';
const NUMERO = '_numero';

/** Sem os campos vazios (o Firestore recusa undefined). */
const limpo = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const comoData = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : '');

function paraOBanco(d: m.DocDoLink): Record<string, unknown> {
  return { ...limpo(d), validoAte: Timestamp.fromDate(new Date(d.validoAte)) };
}

function ticketDoBanco(id: string, d: Record<string, unknown>): m.Ticket | null {
  if (id === NUMERO || !Array.isArray(d.links) || !d.links.length || !Array.isArray(d.itens)) return null;
  return { ...(d as unknown as m.Ticket), id, respostas: (d.respostas as m.Ticket['respostas']) || {}, arquivos: Array.isArray(d.arquivos) ? d.arquivos as m.ArquivoDoTicket[] : [] };
}

function bloqueado(): boolean {
  if (!modoDesenvolvedor()) return false;
  window.dispatchEvent(new CustomEvent(EVENTO_BLOQUEADO));
  return true;
}

export function criarMandeiFirestore(codigoNovo: () => string, quem: () => entregas.Quem | null): RepoMandei {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; vista = null; for (const f of ouvintes) f(); };
  let base: m.Ticket[] = [];
  let vista: m.Ticket[] | null = null;
  const docs = new Map<string, m.DocDoLink>();
  const envios = new Map<string, Record<string, m.EstadoDoEnvio>>();
  const ouvindoLinks = new Map<string, Unsubscribe[]>();
  let parar: Unsubscribe | null = null;

  /** ouve o link atual de cada ticket em aberto (o documento e os envios dos arquivos); o resto para de ouvir */
  function acompanharLinks() {
    const queremos = new Set(base.filter(t => !t.resolvidoEm).map(t => m.linkAtual(t).codigo));
    for (const [codigo, fs] of ouvindoLinks) if (!queremos.has(codigo)) { fs.forEach(f => f()); ouvindoLinks.delete(codigo); }
    for (const codigo of queremos) {
      if (ouvindoLinks.has(codigo)) continue;
      const doLink = onSnapshot(doc(db, 'ticketsLinks', codigo), s => {
        const raw = s.data();
        const d = raw ? m.lerDocDoLink({ ...raw, validoAte: comoData(raw.validoAte) }) : null;
        if (d) docs.set(codigo, d); else docs.delete(codigo);
        mudou();
      }, () => { /* sem acesso agora: fica o que o ticket tem */ });
      const dosEnvios = onSnapshot(query(collection(db, 'enviosSecretario'), where('ticket', '==', codigo)), s => {
        envios.set(codigo, Object.fromEntries(s.docs.map(x => [x.id, m.estadoDoEnvio(x.data())])));
        mudou();
      }, () => { /* sem o andamento: os arquivos ficam "na fila" */ });
      ouvindoLinks.set(codigo, [doLink, dosEnvios]);
    }
  }

  function ligar() {
    if (parar) return;
    parar = onSnapshot(query(collection(db, 'tickets'), orderBy('criadoEm', 'desc'), limit(400)), s => {
      base = s.docs.map(x => ticketDoBanco(x.id, x.data())).filter((t): t is m.Ticket => !!t);
      acompanharLinks();
      mudou();
    }, () => { base = []; mudou(); });
  }

  /**
   * O pedido do e-mail com o link ao robô (robo/mandei.js), com o id escolhido antes: o ticket já é gravado com o emailId,
   * e o robô, quando manda, marca o enviadoEm no próprio ticket (nada aqui grava o ticket depois e apaga essa marca).
   */
  function pedidoDoEmail(t: m.Ticket, link: m.LinkDoTicket): { id: string; pedir: () => Promise<void> } {
    const para = t.para.email.trim().toLowerCase();
    if (!para) return { id: '', pedir: async () => undefined };
    const ref = doc(collection(db, 'solicitacoesEmail'));
    const q = quem();
    const { assunto, corpo } = m.emailDoLink(t, link, FORMULARIO + link.codigo);
    return {
      id: ref.id,
      pedir: () => setPedido(ref, {
        tipo: 'mandei', status: 'pendente', ticket: t.id, link: link.codigo, numero: m.rotuloDoNumero(t.numero),
        para, assunto, corpo, empresa: t.empresa.nome, codigo: String(t.empresa.codigo ?? ''),
        criadoEm: new Date().toISOString(), criadoPor: q?.nome || t.criadoPor.nome, criadoPorEmail: q?.email || '', criadoPorUid: q?.uid || '', origem: 'nads',
      }),
    };
  }

  const comEmail = (t: m.Ticket, codigo: string, emailId: string): m.Ticket =>
    (emailId ? { ...t, links: t.links.map(l => (l.codigo === codigo ? { ...l, emailId } : l)) } : t);

  return {
    exemplo: false,
    assinar(f) { ligar(); ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    tickets() {
      if (!vista) vista = base.map(t => m.ticketComOsLinks(t, Object.fromEntries(t.links.map(l => [l.codigo, docs.get(l.codigo)])), envios.get(m.linkAtual(t).codigo) || {}));
      return vista;
    },

    async criar(d) {
      if (bloqueado()) throw new Error(MENSAGEM_BLOQUEADO);
      const agora = new Date();
      const ref = doc(collection(db, 'tickets'));
      const numero = await runTransaction(db, async tx => {
        const contador = doc(db, 'tickets', NUMERO);
        const n = Number((await tx.get(contador)).data()?.proximo) || 1;
        tx.set(contador, { proximo: n + 1, atualizadoEm: agora.toISOString() });
        return n;
      });
      const novo = m.novoTicket(d, ref.id, numero, codigoNovo(), agora);
      const link = novo.links[0];
      const email = pedidoDoEmail(novo, link);
      const t = comEmail(novo, link.codigo, email.id);
      // o formulário e o ticket antes do pedido: quando o robô pega o pedido, os dois já existem
      await setDoc(doc(db, 'ticketsLinks', link.codigo), paraOBanco(m.docDoLink(t, link, agora)));
      await setDoc(ref, limpo(t));
      await email.pedir();
      return t;
    },

    async gravar(t) { await setDoc(doc(db, 'tickets', t.id), limpo(t)); },

    async novoLink(antes, depois) {
      if (bloqueado()) throw new Error(MENSAGEM_BLOQUEADO);
      const agora = new Date();
      const link = m.linkAtual(depois);
      const email = pedidoDoEmail(depois, link);
      const comPedido = comEmail(depois, link.codigo, email.id);
      const ref = doc(db, 'tickets', depois.id);
      // um só faz: se o ticket já ganhou outro link (outra tela, o 2º link automático), não faz de novo
      const fez = await runTransaction(db, async tx => {
        const s = await tx.get(ref);
        const atual = s.exists() ? ticketDoBanco(s.id, s.data()) : null;
        if (!atual || atual.links.length !== antes.links.length) return false;
        tx.set(ref, limpo(comPedido));
        return true;
      });
      if (!fez) return false;
      await setDoc(doc(db, 'ticketsLinks', link.codigo), paraOBanco(m.docDoLink(comPedido, link, agora)));
      await updateDoc(doc(db, 'ticketsLinks', m.linkAtual(antes).codigo), { fechado: true }).catch(() => { /* o de antes já não existe */ });
      await email.pedir();
      return true;
    },

    async resolver(t, por) {
      const r = m.resolver(t, por, new Date());
      await setDoc(doc(db, 'tickets', t.id), limpo(r));
      await updateDoc(doc(db, 'ticketsLinks', m.linkAtual(t).codigo), { fechado: true }).catch(() => { /* sem o documento do link */ });
    },

    async apagar() { throw new Error('No banco, só o admin apaga ticket (pelo Entregas).'); },
    arquivo: () => null,
    urlDoLink: codigo => FORMULARIO + codigo,
  };
}
