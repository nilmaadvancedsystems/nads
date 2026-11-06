// O razão de todas as contas pelo robô do Alterdata (Vitor, 06/11/2026: "quero atrelar essas razões ao robô do servidor,
// ao invés do usuário upar manualmente, puxar automaticamente"). A mesma fila da página Alterdata da empresa (Tarefas):
//   pedidosAlterdata {tipo: 'mensal'}: um pedido por mês (o robô gera o balancete e o razão no Contábil do servidor);
//   pedidosAlterdata/{id}/numeros/razao      o resumo por conta ({contas: [{conta, nome, anterior, …}], pedacos});
//   pedidosAlterdata/{id}/numeros/razao-nnn  os lançamentos lidos ({lancamentos: [{conta, data, historico, contra, …}]}).
// As regras de lá: o admin e o Contábil leem e pedem (só essas chaves no pedido); o resto, só o robô escreve.
import type { tarefas as t } from '@nads/core';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, initializeFirestore, onSnapshot, query, where, type Firestore } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { appDoEntregas } from './driveDasFerramentas.firestore';

// a trava do modo desenvolvedor: com o modo ligado, só ver — o pedido não sai
const addDocGuardado = guardar(addDoc) as typeof addDoc;

function banco(): Firestore {
  const app = appDoEntregas();
  try { return initializeFirestore(app, { ignoreUndefinedProperties: true }); } catch { return getFirestore(app); }
}

/** Um pedido mensal da empresa, no que importa aqui. */
export interface PedidoDoRazao {
  id: string;
  competencia: string;
  /** pendente, trabalhando, pronto, erro, cancelado */
  status: string;
  /** o razão saiu e foi lido (os lançamentos estão em numeros) */
  razaoLido: boolean;
  /** por que o razão não saiu (ou não foi lido) */
  erro: string;
  /** a barra do robô (0 a 100) e o que ele está fazendo */
  pct: number;
  etapa: string;
  /** o pedido igual que o robô já atendeu: os números são os dele */
  mesmoQue: string;
  criadoEm: string;
}

const texto = (v: unknown) => (v == null ? '' : String(v));

function pedidoDoBanco(id: string, d: Record<string, unknown>): PedidoDoRazao {
  const raz = ((d.arquivos || {}) as Record<string, Record<string, unknown> | undefined>).razao;
  const imp = raz?.importado as Record<string, unknown> | undefined;
  const and = (d.andamento || {}) as Record<string, unknown>;
  return {
    id, competencia: texto(d.competencia), status: texto(d.status), mesmoQue: texto(d.mesmoQue), criadoEm: texto(d.criadoEm),
    razaoLido: raz?.status === 'pronto' && !!imp && imp.lancamentos != null && !imp.erro,
    erro: texto(raz?.status === 'erro' ? raz.erro : imp?.erro ? 'não consegui ler o razão: ' + texto(imp.erro) : d.status === 'erro' ? d.erro : ''),
    pct: Number(and.pct) || 0, etapa: texto(and.etapa),
  };
}

/** Ouve os pedidos mensais da empresa (o mais novo primeiro). Sem login ou sem permissão: falhou. */
export function ouvirPedidosDoRazao(codigo: number, chegou: (l: PedidoDoRazao[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  const db = banco();
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(db, 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'mensal')),
      s => chegou(s.docs.map(x => pedidoDoBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

/** Pede ao robô o balancete e o razão do mês (a mesma fila da página Alterdata). */
export async function pedirRazaoDoMes(codigo: number, empresa: string, competencia: string): Promise<void> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  await addDocGuardado(collection(banco(), 'pedidosAlterdata'), {
    status: 'pendente', tipo: 'mensal', codigo, empresa: empresa.slice(0, 200), competencia,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
}

/** Os números do razão que o robô leu (o resumo por conta e os lançamentos, de todos os pedaços). */
export async function lerRazaoDoRobo(p: PedidoDoRazao): Promise<{ contas: t.ContaDoRobo[]; lancamentos: t.LancamentoDoRobo[] }> {
  const db = banco();
  const id = p.mesmoQue || p.id;
  const [resumo, partes] = await Promise.all([
    getDoc(doc(db, 'pedidosAlterdata', id, 'numeros', 'razao')),
    getDocs(collection(db, 'pedidosAlterdata', id, 'numeros')),
  ]);
  const r = (resumo.data() || {}) as { contas?: t.ContaDoRobo[]; pedacos?: number };
  const pedacos = partes.docs.filter(x => /^razao-\d+$/.test(x.id)).sort((a, b) => a.id.localeCompare(b.id));
  if (r.pedacos != null && pedacos.length !== r.pedacos) throw new Error('faltam pedaços do razão de ' + p.competencia + ' (' + pedacos.length + ' de ' + r.pedacos + ')');
  return {
    contas: (r.contas || []).map(c => ({ conta: texto(c.conta), nome: texto(c.nome), anterior: Number(c.anterior) || 0 })),
    lancamentos: pedacos.flatMap(x => ((x.data().lancamentos || []) as Record<string, unknown>[]).map(l => ({
      conta: texto(l.conta), data: texto(l.data), historico: texto(l.historico), contra: texto(l.contra), documento: texto(l.documento),
      debito: Number(l.debito) || 0, credito: Number(l.credito) || 0,
    }))),
  };
}
