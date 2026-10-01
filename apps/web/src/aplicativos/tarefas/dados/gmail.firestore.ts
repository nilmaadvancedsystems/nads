// A caixa do robô do Gmail na Tarefas, pelo robô do Entregas (o mesmo das Pendências), no banco do Entregas com o
// login de lá. O navegador não fala com o Gmail:
//   robo/estado             SÓ LEITURA: o que o robô viu (caixa, sem cliente, spam, execuções, andamento) — admin/contábil/fiscal
//   robo/caixa-<setor>      SÓ LEITURA: as listas da caixa do setor (contabil, fiscal) — só o setor e o admin (01/10/2026)
//   clientes                para escolher o dono do e-mail; ligar remetente grava SÓ email/emails (o que a regra deixa)
//   config/roboIgnorados    os remetentes marcados como spam (só o admin grava)
//   solicitacoesEmail       os pedidos ao robô: verificar, cancelar, salvar no Drive, responder (mesmos campos das Pendências)
//   leiturasGmail           o texto inteiro de um e-mail (o robô responde no próprio pedido; cada um lê só o seu)
import { entregas as e } from '@nads/core';
import { addDoc, arrayUnion, collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';

const ESPERA_LEITURA_MS = 90 * 1000;

export function criarGmailFirestore(quem: () => (e.Quem | null), competencia: () => string): e.RepoGmailDoEntregas {
  const db = bancoDoEntregas();
  let estado: e.EstadoDoRobo = e.ESTADO_VAZIO;
  let docEstado: Record<string, unknown> | null = null;
  // a caixa escolhida: a da Nilma (robo/estado) ou a de um setor (robo/caixa-<setor>, ouvida só enquanto escolhida)
  let caixa: e.CaixaDoGmail = 'robo';
  let docSetor: Record<string, unknown> | null = null;
  let pararSetor = () => {};
  const recalcular = () => { estado = e.estadoDoRobo(caixa === 'robo' ? docEstado : e.docDaCaixa(docEstado, docSetor)); mudou(); };
  let clientes: { carregados: boolean; lista: e.ClienteDoEntregas[] } = { carregados: false, lista: [] };
  let ignorados: string[] = [];
  let ouvindo = false;
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  function ouvir() {
    if (ouvindo) return;
    ouvindo = true;
    onSnapshot(doc(db, 'robo', 'estado'), s => { docEstado = s.exists() ? s.data() : null; recalcular(); },
      err => { estado = { ...e.ESTADO_VAZIO, carregado: true, erro: err.message }; mudou(); });
    onSnapshot(collection(db, 'clientes'), s => {
      clientes = { carregados: true, lista: e.clientesDoEntregas(s.docs.map(d => ({ id: d.id, dados: d.data() }))) };
      mudou();
    }, () => { clientes = { carregados: true, lista: [] }; mudou(); });
    onSnapshot(doc(db, 'config', 'roboIgnorados'), s => {
      const r = (s.data() || {}).remetentes;
      ignorados = Array.isArray(r) ? r.map(String) : [];
      mudou();
    }, () => {});
    // o "online" depende da hora: recalcula a cada 30 s
    setInterval(() => { if (docEstado) recalcular(); }, 30 * 1000);
  }

  function pessoa(): e.Quem {
    const q = quem();
    if (!q) throw new Error('entre com a conta do Entregas');
    return q;
  }

  /** Um pedido na fila do robô, com os campos que as Pendências mandam. */
  async function pedir(dados: Record<string, unknown>) {
    const q = pessoa();
    await addDoc(collection(db, 'solicitacoesEmail'), {
      status: 'pendente', criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorEmail: q.email, competencia: competencia(), caixa, ...dados,
    });
  }

  return {
    exemplos: false,
    caixa: () => caixa,
    usarCaixa(c) {
      if (c === caixa) return;
      caixa = c;
      pararSetor();
      docSetor = null;
      pararSetor = () => {};
      if (c !== 'robo') {
        pararSetor = onSnapshot(doc(db, 'robo', 'caixa-' + c), s => { docSetor = s.exists() ? s.data() : null; recalcular(); },
          err => { estado = { ...e.ESTADO_VAZIO, carregado: true, erro: err.message }; mudou(); });
      }
      recalcular();
    },
    estado: () => { ouvir(); return estado; },
    clientes: () => { ouvir(); return clientes; },
    ignorados: () => { ouvir(); return ignorados; },
    verificar: dias => pedir({ tipo: 'verificar', dias }),
    cancelar: () => pedir({ tipo: 'cancelar' }),
    salvarNoDrive: (mensagemId, clienteId) => pedir({ tipo: 'salvar', mensagemId, clienteId: clienteId || null }),
    async ligarRemetente(clienteId, email) {
      const c = clientes.lista.find(x => x.id === clienteId);
      const ref = doc(db, 'clientes', clienteId);
      const endereco = email.trim().toLowerCase();
      if (c && !c.email) await updateDoc(ref, { email: endereco });
      else await updateDoc(ref, { emails: arrayUnion(endereco) });
    },
    async ignorar(email) {
      const q = pessoa();
      await setDoc(doc(db, 'config', 'roboIgnorados'), { remetentes: arrayUnion(email.trim().toLowerCase()), atualizadoEm: new Date().toISOString(), por: q.nome }, { merge: true });
    },
    async ler(mensagemId) {
      const q = pessoa();
      if (!e.mensagemIdValido(mensagemId)) throw new Error('e-mail sem id do Gmail');
      const ref = await addDoc(collection(db, 'leiturasGmail'), { status: 'pendente', mensagemId, caixa, criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorUid: q.uid });
      return new Promise<e.EmailLido>((resolver, recusar) => {
        const fim = setTimeout(() => { parar(); recusar(new Error('o robô não respondeu a tempo')); }, ESPERA_LEITURA_MS);
        const parar = onSnapshot(ref, s => {
          const d = s.data() || {};
          if (d.status === 'pronto') { clearTimeout(fim); parar(); resolver(e.emailLidoDoDocumento(d)); }
          else if (d.status === 'erro') { clearTimeout(fim); parar(); recusar(new Error(String(d.erro || 'erro do robô'))); }
        }, err => { clearTimeout(fim); recusar(err); });
      });
    },
    async responder(p) {
      const q = pessoa();
      await addDoc(collection(db, 'solicitacoesEmail'), {
        tipo: 'responder', status: 'pendente', mensagemId: p.mensagemId, corpo: p.corpo.slice(0, 20000), todos: p.todos,
        para: p.para, assunto: p.assunto.slice(0, 200), clienteId: p.clienteId, anexo: null, caixa,
        criadoEm: new Date().toISOString(), criadoPor: q.nome, criadoPorEmail: q.email, criadoPorUid: q.uid,
      });
    },
    respostas(mensagemId, aoMudar) {
      return onSnapshot(query(collection(db, 'solicitacoesEmail'), where('mensagemId', '==', mensagemId)), s => {
        aoMudar(s.docs.filter(d => d.data().tipo === 'responder').map(d => e.respostaDoDocumento(d.id, d.data())).sort((a, b) => a.em.localeCompare(b.em)));
      }, () => aoMudar([]));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
