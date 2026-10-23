// O extrato do banco no Financeiro (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um importador
// de extrato que vai trazer os dados e informações para o dashboard inicial"; guardado à parte do Caixa, para não
// duplicar o que já foi lançado nele). Os lançamentos lidos do extrato (pelo Extrator) viram linhas do banco com um id
// fixo (o banco, a data, o valor, o histórico e a ordem entre os iguais): importar o mesmo extrato de novo não duplica.
// O saldo do banco é o do fim do último extrato de cada banco. Puro: sem banco e sem tela.
import type { TipoDeLancamento } from './index';

/** uma linha do extrato do banco (financeiroBanco/{id}) */
export interface LancamentoDoBanco {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  historico: string;
  /** sempre positivo; quem diz se entra ou sai é o tipo */
  valor: number;
  tipo: TipoDeLancamento;
  /** o nome do banco ("Sicoob", "Efí"…) */
  banco: string;
  /** o id da importação que trouxe a linha */
  importacao: string;
}

/** uma importação de extrato (financeiroBancoImportacoes/{id}) */
export interface ImportacaoDeExtrato {
  id: string;
  banco: string;
  arquivo: string;
  /** o período do extrato (AAAA-MM-DD) */
  de: string;
  ate: string;
  quantos: number;
  entradas: number;
  saidas: number;
  /** o saldo no fim do extrato, quando ele traz (a coluna Saldo, a linha "SALDO ANTERIOR" ou o OFX) */
  saldoFinal?: number;
  importadoEm: string;
  importadoPor: string;
}

/** o que o Extrator lê (valor em centavos, + entra, − sai) */
export interface LinhaLida { data: string; valor: number; historico: string }

const emReais = (centavos: number) => Math.round(Math.abs(centavos)) / 100;

/** um hash curto e estável do texto (o id da linha) */
function hash(s: string): string {
  let h = 5381, g = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = (h * 33) ^ c; g = (g * 31) ^ c; }
  return (h >>> 0).toString(36) + (g >>> 0).toString(36);
}

const chaveDoBanco = (banco: string) => banco.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banco';

/**
 * As linhas do extrato prontas para guardar: o id é fixo (banco, data, valor, histórico e a ordem entre as linhas
 * iguais), então importar o mesmo extrato de novo regrava as mesmas linhas. Linha sem data ou com valor zero fica de fora.
 */
export function linhasDoExtrato(lidas: readonly LinhaLida[], banco: string, importacao: string): LancamentoDoBanco[] {
  const vistos = new Map<string, number>();
  const nome = banco.trim() || 'Banco';
  const out: LancamentoDoBanco[] = [];
  for (const l of lidas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data) || !Math.round(l.valor)) continue;
    const historico = l.historico.replace(/\s+/g, ' ').trim();
    const base = chaveDoBanco(nome) + '|' + l.data + '|' + Math.round(l.valor) + '|' + historico.toUpperCase();
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    out.push({ id: 'b_' + hash(base + '|' + n), data: l.data, historico, valor: emReais(l.valor), tipo: l.valor < 0 ? 'S' : 'E', banco: nome, importacao });
  }
  return out;
}

/** o saldo no fim do extrato: o último saldo do dia impresso, ou o saldo anterior mais o movimento; sem nada, undefined */
export function saldoFinalDoExtrato(lidas: readonly LinhaLida[], saldoAnterior?: number, saldosDoDia?: readonly { data: string; saldo: number }[]): number | undefined {
  if (saldosDoDia?.length) {
    const ultimo = [...saldosDoDia].sort((a, b) => a.data.localeCompare(b.data)).at(-1)!;
    return Math.round(ultimo.saldo) / 100;
  }
  if (saldoAnterior == null) return undefined;
  return Math.round(saldoAnterior + lidas.reduce((s, l) => s + Math.round(l.valor), 0)) / 100;
}

/** o resumo de uma importação (o período, quantas, entradas e saídas) */
export function resumoDoExtrato(linhas: readonly LancamentoDoBanco[]): { de: string; ate: string; quantos: number; entradas: number; saidas: number } {
  const datas = linhas.map(l => l.data).sort();
  const soma = (t: TipoDeLancamento) => Math.round(linhas.filter(l => l.tipo === t).reduce((s, l) => s + Math.round(l.valor * 100), 0)) / 100;
  return { de: datas[0] || '', ate: datas.at(-1) || '', quantos: linhas.length, entradas: soma('E'), saidas: soma('S') };
}

/** o saldo de cada banco: o do extrato que vai mais longe (com saldo); do maior para o menor nome */
export function saldosNoBanco(importacoes: readonly ImportacaoDeExtrato[]): { banco: string; saldo: number; ate: string }[] {
  const porBanco = new Map<string, ImportacaoDeExtrato>();
  for (const i of importacoes) {
    if (i.saldoFinal == null) continue;
    const atual = porBanco.get(i.banco);
    if (!atual || i.ate > atual.ate || (i.ate === atual.ate && i.importadoEm > atual.importadoEm)) porBanco.set(i.banco, i);
  }
  return [...porBanco.values()].map(i => ({ banco: i.banco, saldo: i.saldoFinal!, ate: i.ate })).sort((a, b) => a.banco.localeCompare(b.banco, 'pt-BR'));
}
