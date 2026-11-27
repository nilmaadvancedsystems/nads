// As notas do Alterdata Fiscal pelo robô do servidor (Vitor, 16/11/2026: "queria ensinar o robo do servidor a pegar
// entradas, saidas e tomados e prestados da etapa de importacao"). Na mesma fila do balancete (pedidosAlterdata):
//   {status: 'pendente', tipo: 'fiscal', relatorio: entradas|saidas|tomados|prestados, codigo, empresa, competencia, ate,
//    criadoEm, criadoPor, criadoPorUid}
// O robô abre o Fiscal (Lançamentos › Notas Fiscais e Produtos, ou ISS, Receitas e Deduções), filtra a empresa e o período
// e exporta a planilha; ela volta em pedaços (pedidosAlterdata/{id}/partes/fiscal-nnn) e o resumo em arquivos.fiscal.
// O pedido só gera um relatório (não muda dado nenhum): sai também no modo desenvolvedor, como o balancete da Conferência
// saía (14/10/2026); a importação que vem depois, no modo desenvolvedor, continua só na tela.
import { robos } from '@nads/core';
import { getAuth } from 'firebase/auth';
import { addDoc as addDocBruto, collection, doc, getDocs, onSnapshot, query, runTransaction, updateDoc, where, type Firestore } from 'firebase/firestore';
import { travarPedido } from '../../../comum/disjuntorDeGravacao';
import { abrirBancoDoEntregas } from './conexaoEntregas.firestore';
import { appDoEntregas } from './driveDasFerramentas.firestore';

const addDoc = travarPedido(addDocBruto) as typeof addDocBruto;

export type RelatorioDoFiscal = 'entradas' | 'saidas' | 'tomados' | 'prestados';

/**
 * A fila do pedido (17/11/2026): quem tem o robô no PC pede na fila só dele ('pendentePc'), que o servidor ainda no robô antigo
 * não enxerga (pegava e respondia "tipo desconhecido"); os outros, na de sempre.
 */
export function statusDoPedido(): 'pendente' | 'pendentePc' {
  return roboDePcDoUsuario() ? 'pendentePc' : 'pendente';
}

/** O robô do Alterdata no PC da pessoa logada (core/robos/robosDePc: só o dono vê o botão do Fiscal), ou null. */
export function roboDePcDoUsuario(): { maquina: string; rotulo: string } | null {
  return robos.roboDePcDaConta(getAuth(appDoEntregas()).currentUser?.uid);
}

export interface PedidoDoFiscal {
  id: string;
  relatorio: RelatorioDoFiscal;
  competencia: string;
  ate: string;
  /** pendente, trabalhando, pronto, erro, cancelado */
  status: string;
  erro: string;
  pct: number;
  etapa: string;
  clique: string;
  criadoEm: string;
  /** o robô do PC já viu o pedido (recebidoEm; 19/11/2026): conectou */
  recebido: boolean;
  /** o que o robô viu nas telas do Fiscal (enquanto ele aprende as telas: os itens de cada janela) */
  diag: string[];
  /** a planilha no banco (pronto) */
  arquivo: { nome: string; partes: number } | null;
}

const texto = (v: unknown) => (v == null ? '' : String(v));

function banco(): Firestore {
  return abrirBancoDoEntregas(appDoEntregas());
}

function doBanco(id: string, d: Record<string, unknown>): PedidoDoFiscal {
  const and = (d.andamento || {}) as Record<string, unknown>;
  const a = ((d.arquivos || {}) as Record<string, Record<string, unknown> | undefined>).fiscal;
  return {
    id, relatorio: texto(d.relatorio) as RelatorioDoFiscal, competencia: texto(d.competencia), ate: texto(d.ate || d.competencia), status: texto(d.status),
    erro: texto(d.erro), pct: Math.max(0, Math.min(100, Number(and.pct) || 0)), etapa: texto(and.etapa), clique: texto(and.clique), criadoEm: texto(d.criadoEm), recebido: !!d.recebidoEm,
    diag: Array.isArray(d.diag) ? (d.diag as unknown[]).map(texto) : [],
    arquivo: a && a.status === 'pronto' && Number(a.partes) > 0 ? { nome: texto(a.nome), partes: Number(a.partes) } : null,
  };
}

/** Ouve os pedidos do Fiscal da empresa para um relatório (o mais novo primeiro). */
export function ouvirPedidosDoFiscal(codigo: number, relatorio: RelatorioDoFiscal, chegou: (l: PedidoDoFiscal[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'fiscal'), where('relatorio', '==', relatorio)),
      s => chegou(s.docs.map(x => doBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

/** Pede ao robô a planilha do relatório no período (competencia até ate). */
export async function pedirNotasDoFiscal(o: { codigo: number; empresa: string; relatorio: RelatorioDoFiscal; competencia: string; ate: string }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: statusDoPedido(), tipo: 'fiscal', relatorio: o.relatorio, codigo: o.codigo, empresa: o.empresa.slice(0, 200), competencia: o.competencia, ate: o.ate,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}

/** Tira o pedido da fila (enquanto espera ou está com o robô). */
/**
 * Cancela o pedido que o robô ainda não viu (o prazo de conectar, 19/11/2026): numa transação, só se ainda está na fila e sem o
 * recebidoEm — o robô que pegou no último instante segue. true = cancelou.
 */
export async function cancelarSeNaoConectou(id: string): Promise<boolean> {
  const u = getAuth(appDoEntregas()).currentUser;
  const ref = doc(banco(), 'pedidosAlterdata', id);
  return runTransaction(banco(), async t => {
    const s = await t.get(ref);
    const d = s.data();
    if (!d || !['pendente', 'pendentePc'].includes(String(d.status)) || d.recebidoEm) return false;
    t.update(ref, { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: (u?.displayName || 'nads').slice(0, 120) });
    return true;
  });
}

export async function cancelarPedidoDoFiscal(id: string): Promise<void> {
  const u = getAuth(appDoEntregas()).currentUser;
  await updateDoc(doc(banco(), 'pedidosAlterdata', id), { status: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: (u?.displayName || 'nads').slice(0, 120) });
}

/** A planilha que o robô subiu, juntando os pedaços. */
export async function planilhaDoFiscal(p: PedidoDoFiscal): Promise<File> {
  if (!p.arquivo) throw new Error('o pedido ainda não tem a planilha');
  const s = await getDocs(collection(banco(), 'pedidosAlterdata', p.id, 'partes'));
  const pedacos = s.docs.filter(x => x.id.startsWith('fiscal-')).sort((a, b) => a.id.localeCompare(b.id)).map(x => texto(x.data().dados));
  if (pedacos.length !== p.arquivo.partes) throw new Error('faltam pedaços da planilha (' + pedacos.length + ' de ' + p.arquivo.partes + ')');
  const bin = atob(pedacos.join('').replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], p.arquivo.nome, { type: 'application/vnd.ms-excel' });
}

// ---------- o razão de uma conta do Contábil (17/11/2026, o caminho que o Vitor gravou: Consultas › Lançamentos, a empresa, a
// conta, o período, Imprimir › Exportar para excel) ----------
// {status: 'pendente', tipo: 'razaoConta', codigo, empresa, conta, competencia, ate, criadoEm, criadoPor, criadoPorUid}: o robô
// do PC do dono puxa e a planilha volta em partes/fiscal-nnn, como a do Fiscal. Na Importação, entra na linha "Razão" do banco.
export interface PedidoDoRazaoDaConta extends PedidoDoFiscal { conta: string }

export function ouvirRazoesDaConta(codigo: number, chegou: (l: PedidoDoRazaoDaConta[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'razaoConta')),
      s => chegou(s.docs.map(x => ({ ...doBanco(x.id, x.data()), conta: texto(x.data().conta) })).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

export async function pedirRazaoDaConta(o: { codigo: number; empresa: string; conta: string; competencia: string; ate: string }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: statusDoPedido(), tipo: 'razaoConta', codigo: o.codigo, empresa: o.empresa.slice(0, 200), conta: o.conta.slice(0, 30), competencia: o.competencia, ate: o.ate,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}

// ---------- o Balancete Dinâmico do período (17/11/2026, o caminho que o Vitor gravou: Consultas › Balancete Dinâmico, a empresa,
// o período inteiro numa consulta, Saldo por mês, Ocultar contas sem movimento, Exportar › Gravar › Salvar) ----------
// {status, tipo: 'balanceteDinamico', codigo, empresa, competencia, ate, criadoEm, criadoPor, criadoPorUid}: a planilha volta em
// partes/fiscal-nnn e entra como o balancete dinâmico da Tarefa.
export function ouvirDinamicos(codigo: number, chegou: (l: PedidoDoFiscal[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'balanceteDinamico')),
      s => chegou(s.docs.map(x => doBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

export async function pedirDinamico(o: { codigo: number; empresa: string; competencia: string; ate: string }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: statusDoPedido(), tipo: 'balanceteDinamico', codigo: o.codigo, empresa: o.empresa.slice(0, 200), competencia: o.competencia, ate: o.ate,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}

// o Balancete (Livros e Relatórios) do período, com o Salvar da visualização (17/11/2026, o caminho que o Vitor gravou): o mesmo
// balancete normal que a Conferência importa; por enquanto só no modo desenvolvedor, na Importação, com o robô do PC do Vitor
export function ouvirBalancetesDoPeriodo(codigo: number, chegou: (l: PedidoDoFiscal[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'balancetePeriodo')),
      s => chegou(s.docs.map(x => doBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

export async function pedirBalancetePeriodo(o: { codigo: number; empresa: string; competencia: string; ate: string }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: statusDoPedido(), tipo: 'balancetePeriodo', codigo: o.codigo, empresa: o.empresa.slice(0, 200), competencia: o.competencia, ate: o.ate,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}

/** O estado que o robô do PC publica em robo/alterdata (maquinas.<pc>): o Contábil, o Fiscal e quando falou por último. */
export function ouvirMaquinaDoPc(maquina: string, chegou: (m: { contabil: string; fiscal: string; em: string } | null) => void): () => void {
  try {
    return onSnapshot(doc(banco(), 'robo', 'alterdata'), s => {
      const x = (((s.data() || {}).maquinas || {}) as Record<string, Record<string, unknown>>)[maquina] || {};
      chegou({ contabil: String(x.contabil || ''), fiscal: String(x.fiscal || ''), em: String(x.em || '') });
    }, () => chegou(null));
  } catch { chegou(null); return () => {}; }
}

// ---------- os lançamentos do SCI (27/11/2026, o caminho que o Vitor ensinou no SCI: Lançamentos › Contábeis, a lupa, Retirar
// filtro, Impressão de campos da consulta, Excel) ----------
// {status: 'pendentePc', tipo: 'sciLancamentos', codigo, empresa, competencia (MM/AAAA do SCI; 00 = o ano todo; 00/0000 = tudo),
//  criadoEm, criadoPor, criadoPorUid}: só o robô do PC do dono (o SCI está lá); a planilha volta em partes/fiscal-nnn e entra
//  na Contabilização do minimum.
/** o que o robô puxa do SCI: os lançamentos (a consulta) ou o balancete (27/11/2026) */
export type TipoDoSci = 'sciLancamentos' | 'sciBalancete';

export function ouvirLancamentosDoSci(codigo: number, chegou: (l: PedidoDoFiscal[]) => void, falhou: (e: Error) => void, tipo: TipoDoSci = 'sciLancamentos'): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', tipo)),
      s => chegou(s.docs.map(x => doBanco(x.id, x.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

export async function pedirLancamentosDoSci(o: { codigo: number; empresa: string; competencia: string; tipo?: TipoDoSci }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  if (!roboDePcDoUsuario()) throw new Error('O SCI só é puxado pelo robô do PC de quem tem o robô.');
  if (!/^(0\d|1[0-2])\/\d{4}$/.test(o.competencia)) throw new Error('A competência do SCI é MM/AAAA (00 = o ano todo).');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: 'pendentePc', tipo: o.tipo || 'sciLancamentos', codigo: o.codigo, empresa: o.empresa.slice(0, 200), competencia: o.competencia,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}

// Excluir no SCI pelo minimum (27/11/2026, o Vitor: um lançamento excluído no nads sai do SCI pela chave na coluna Lote):
// pedidosAlterdata {status:'pendentePc', tipo:'sciExcluir', codigo, empresa, lote, chave ('' = o lote inteiro), criadoEm, criadoPor,
// criadoPorUid}. Só o robô do PC do dono (o SCI está lá). Com a chave, a lixeira verde (sem senha); sem ela, a vermelha, e a senha de
// segurança quem digita é a pessoa, no SCI do PC: nenhuma senha vai no pedido.
export interface PedidoDeExcluirNoSci {
  id: string;
  status: string;
  erro: string;
  pct: number;
  etapa: string;
  criadoEm: string;
  recebido: boolean;
  lote: string;
  chave: string;
  /** o ano do lote (AAAA): o robô abre a consulta do SCI só nele ('' = todos, 00/0000) */
  ano: string;
}

export function ouvirExclusoesNoSci(codigo: number, chegou: (l: PedidoDeExcluirNoSci[]) => void, falhou: (e: Error) => void): () => void {
  const auth = getAuth(appDoEntregas());
  let parar = () => {};
  let parado = false;
  auth.authStateReady().then(() => {
    if (parado) return;
    parar = onSnapshot(query(collection(banco(), 'pedidosAlterdata'), where('codigo', '==', codigo), where('tipo', '==', 'sciExcluir')),
      s => chegou(s.docs.map(x => {
        const d = x.data();
        const and = (d.andamento || {}) as Record<string, unknown>;
        return {
          id: x.id, status: texto(d.status), erro: texto(d.erro), pct: Math.max(0, Math.min(100, Number(and.pct) || 0)), etapa: texto(and.etapa),
          criadoEm: texto(d.criadoEm), recebido: !!d.recebidoEm, lote: texto(d.lote), chave: texto(d.chave), ano: texto(d.ano),
        };
      }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))), falhou);
  }, falhou);
  return () => { parado = true; parar(); };
}

export async function pedirExclusaoNoSci(o: { codigo: number; empresa: string; lote: string; chave: string; ano: string }): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) throw new Error('Entre com a conta do escritório para pedir ao robô.');
  if (!roboDePcDoUsuario()) throw new Error('O SCI só é mexido pelo robô do PC de quem tem o robô.');
  if (!/^M[0-9A-Z]{6,9}$/.test(o.lote) || (o.chave && !/^M[0-9A-Z]{6}\d{3}$/.test(o.chave)) || !/^(\d{4})?$/.test(o.ano)) throw new Error('Esse lote não é do minimum.');
  const r = await addDoc(collection(banco(), 'pedidosAlterdata'), {
    status: 'pendentePc', tipo: 'sciExcluir', codigo: o.codigo, empresa: o.empresa.slice(0, 200), lote: o.lote, chave: o.chave, ano: o.ano,
    criadoEm: new Date().toISOString(), criadoPor: (u.displayName || (u.email || '').split('@')[0] || 'nads').slice(0, 120), criadoPorUid: u.uid,
  });
  return r.id;
}
