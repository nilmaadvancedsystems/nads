// O "Importar no Alterdata" (06/11/2026, Vitor: "importar os lancamentos direto no alterdata"): a planilha de 10 colunas
// que o nads gera (a mesma do Baixar) vai num pedido ao robô do Alterdata do servidor, que importa no Contábil
// (Lançamentos › Importação financeira › a empresa › Criar novo Lote › a planilha › Importação Personalizada - Excel ›
// Concluir). O pedido fica em pedidosAlterdata {status: 'pendente', tipo: 'importar', codigo, empresa, lote, origem,
// planilha (base64), linhas, criadoEm, criadoPor, criadoPorUid}; o robô escreve o andamento, o resultado (o que o
// Alterdata respondeu) ou o erro. A mesma planilha na mesma empresa o robô não importa duas vezes.
// Nos exemplos e no modo desenvolvedor (sem banco): um pedido de mentira que anda sozinho.
import { ligadoAoBanco } from './modoDesenvolvedor';
import { contaDoEntregas } from '../aplicativos/tarefas/dados/entregas.firestore';
import { gravarPedidoAlterdata, ouvirPedidoAlterdata } from '../aplicativos/tarefas/dados/importarNoAlterdata.firestore';

export interface ImportacaoNoAlterdata {
  id: string;
  status: 'pendente' | 'trabalhando' | 'pronto' | 'erro' | 'cancelado';
  pct: number;
  etapa: string;
  clique: string;
  /** o que o Alterdata respondeu ("Importação concluída.") ou o porquê de não ter importado */
  resultado: string;
  erro: string;
  /** a mesma planilha já tinha sido importada (o id do pedido que importou) */
  mesmoQue: string;
}

export interface PedidoDeImportacao {
  codigo: number;
  empresa: string;
  lote: string;
  /** de onde veio (creditor, honorarios, fgts…): para quem olha o pedido depois */
  origem: string;
  planilha: Uint8Array;
  linhas: number;
}

/** O documento do Firestore vai até 1 MiB: a planilha em base64 até ~900 mil caracteres (uns 9 mil lançamentos). */
export const LIMITE_BASE64 = 900 * 1000;

function paraBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const texto = (v: unknown) => (v == null ? '' : String(v));
const STATUS = ['pendente', 'trabalhando', 'pronto', 'erro', 'cancelado'] as const;

function doBanco(id: string, d: Record<string, unknown>): ImportacaoNoAlterdata {
  const a = (d.andamento && typeof d.andamento === 'object' ? d.andamento : {}) as Record<string, unknown>;
  const st = STATUS.find(s => s === d.status) ?? 'pendente';
  return { id, status: st, pct: Math.max(0, Math.min(100, Number(a.pct) || 0)), etapa: texto(a.etapa), clique: texto(a.clique), resultado: texto(d.resultado), erro: texto(d.erro), mesmoQue: texto(d.mesmoQue) };
}

/** Manda a planilha ao robô; devolve o id do pedido. */
export async function pedirImportacao(p: PedidoDeImportacao, quem: string): Promise<string> {
  const planilha = paraBase64(p.planilha);
  if (planilha.length > LIMITE_BASE64) throw new Error('a planilha passou do tamanho que o robô recebe (' + p.linhas + ' lançamentos); divida em duas');
  if (!ligadoAoBanco()) return exemplo(p);
  const conta = contaDoEntregas();
  if (!conta) throw new Error('entre no nads de novo para mandar ao robô');
  return gravarPedidoAlterdata({
    status: 'pendente', tipo: 'importar', codigo: p.codigo, empresa: p.empresa.slice(0, 200), lote: p.lote.slice(0, 60),
    origem: p.origem.slice(0, 40), planilha, linhas: p.linhas, criadoEm: new Date().toISOString(),
    criadoPor: (quem || conta.email).slice(0, 200), criadoPorUid: conta.uid,
  });
}

/** Acompanha o pedido; devolve o desligar. */
export function acompanharImportacao(id: string, chegou: (i: ImportacaoNoAlterdata) => void, falhou: (e: Error) => void): () => void {
  if (id.startsWith('exemplo-')) return acompanharExemplo(id, chegou);
  return ouvirPedidoAlterdata(id, d => chegou(doBanco(id, d)), falhou);
}

// ── nos exemplos: o robô de mentira (fila, os passos do roteiro, pronto)
const exemplos = new Map<string, { inicio: number }>();
function exemplo(p: PedidoDeImportacao): string {
  const id = 'exemplo-' + p.codigo + '-' + Date.now();
  exemplos.set(id, { inicio: Date.now() });
  return id;
}
const PASSOS_EXEMPLO = ['abrindo Lançamentos → Importação financeira', 'empresa', 'lote', 'planilha', 'layout Importação Personalizada - Excel', 'importando no Alterdata'];
function acompanharExemplo(id: string, chegou: (i: ImportacaoNoAlterdata) => void): () => void {
  const e = exemplos.get(id) ?? { inicio: Date.now() };
  const base: ImportacaoNoAlterdata = { id, status: 'pendente', pct: 0, etapa: '', clique: '', resultado: '', erro: '', mesmoQue: '' };
  const tique = () => {
    const s = (Date.now() - e.inicio) / 1000;
    if (s < 2) return chegou(base);
    const n = Math.floor((s - 2) / 1.5);
    if (n >= PASSOS_EXEMPLO.length) return chegou({ ...base, status: 'pronto', pct: 100, etapa: 'pronto', resultado: 'Importação concluída.' });
    chegou({ ...base, status: 'trabalhando', pct: Math.round((n + 1) / (PASSOS_EXEMPLO.length + 1) * 100), etapa: PASSOS_EXEMPLO[n], clique: n === 1 ? 'campo Empresa' : '' });
  };
  tique();
  const t = setInterval(tique, 500);
  return () => clearInterval(t);
}

/** O nome do lote no Contábil: "nads <de onde> <mês/ano>" pelas datas dos lançamentos (dd/mm/aaaa); mais de um mês, o
 *  primeiro e o último ("nads Creditor 10/2025 a 11/2025"). */
export function nomeDoLote(deOnde: string, datas: readonly string[]): string {
  const meses = [...new Set(datas.map(d => d.match(/^\d{2}\/(\d{2})\/(\d{4})$/)).filter((m): m is RegExpMatchArray => !!m).map(m => m[2] + '-' + m[1]))].sort();
  const mmaa = (s: string) => s.slice(5) + '/' + s.slice(0, 4);
  const periodo = !meses.length ? '' : meses.length === 1 ? mmaa(meses[0]) : mmaa(meses[0]) + ' a ' + mmaa(meses[meses.length - 1]);
  return ('nads ' + deOnde + (periodo ? ' ' + periodo : '')).slice(0, 60);
}
