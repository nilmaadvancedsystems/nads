// @nads/core/clientes — a etapa Clientes da Tarefa (Vitor, 06/10/2026): o balancete e o balancete dinâmico (o saldo de
// cada conta mês a mês), as contas de cliente com saldo credor (corrigir primeiro), a relação de todas com a situação
// (Pendente = o valor devedor, Ok = zerado, Conferido = vai para o cliente, com a observação) e a planilha e a mensagem
// para o cliente responder. Os conferidos passam para o mês seguinte. TypeScript puro: quem chama guarda o estado.
import * as XLSX from 'xlsx';
import { normalizarTexto } from '../../formatos';
import type { Conta } from '../../conferencia/tipos';

// ─── o balancete dinâmico ────────────────────────────────────────────────────

/** Uma conta do balancete dinâmico: o saldo anterior e o saldo de cada mês (positivo = devedor no Ativo). */
export interface LinhaDinamico { codigo: string; classificacao: string; descricao: string; saldoAnterior: number; saldos: Record<string, number> }
export interface BalanceteDinamico { meses: string[]; linhas: LinhaDinamico[] }

const numero = (v: unknown): number => {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  // "1234.56" (o Alterdata exporta com ponto) ou "1.234,56"
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** As linhas da planilha (a primeira aba) → o balancete dinâmico. O cabeçalho: Código, Classificação, Descrição, Saldo Anterior e os meses (MM/AAAA). */
export function lerBalanceteDinamico(rows: readonly (readonly unknown[])[]): BalanceteDinamico {
  const baixo = (c: unknown) => normalizarTexto(String(c ?? ''));
  const h = rows.findIndex(r => r.some(c => baixo(c) === 'classificacao') && r.some(c => baixo(c) === 'codigo'));
  if (h < 0) throw new Error('Não achei o cabeçalho do balancete dinâmico (Código, Classificação, Descrição).');
  const head = rows[h].map(c => String(c ?? '').trim());
  const col = (nome: string) => head.findIndex(c => baixo(c) === nome);
  const cCod = col('codigo'), cCla = col('classificacao'), cDes = col('descricao'), cAnt = col('saldo anterior');
  const meses = head.map((c, i) => { const m = /^(\d{2})\/(\d{4})$/.exec(c); return m ? { i, mes: m[2] + '-' + m[1] } : null; }).filter((x): x is { i: number; mes: string } => !!x);
  if (!meses.length) throw new Error('O balancete dinâmico não tem as colunas dos meses (MM/AAAA).');
  const linhas: LinhaDinamico[] = [];
  for (const r of rows.slice(h + 1)) {
    const codigo = String(r[cCod] ?? '').trim();
    if (!codigo) continue;
    linhas.push({
      codigo, classificacao: String(r[cCla] ?? '').trim(), descricao: String(r[cDes] ?? '').trim(),
      saldoAnterior: cAnt >= 0 ? numero(r[cAnt]) : 0,
      saldos: Object.fromEntries(meses.map(m => [m.mes, numero(r[m.i])])),
    });
  }
  return { meses: meses.map(m => m.mes), linhas };
}

// ─── as contas de cliente ────────────────────────────────────────────────────

/** Uma conta de cliente: o saldo no mês (positivo = devedor, negativo = credor) e o do balancete atual, quando veio. */
export interface ContaDeCliente { codigo: string; nome: string; saldo: number; noBalancete: number | null }

const SECAO_CLIENTES = /^(clientes?|duplicatas? a receber|contas? a receber)\b/;

/** As contas de cliente do dinâmico no mês: as analíticas debaixo da sintética de clientes (pela classificação). */
export function clientesDoDinamico(d: BalanceteDinamico, mes: string): ContaDeCliente[] {
  const secoes = d.linhas.filter(l => SECAO_CLIENTES.test(normalizarTexto(l.descricao)) && l.classificacao);
  const tem = (l: LinhaDinamico) => d.linhas.some(o => o !== l && o.classificacao.startsWith(l.classificacao + '.'));
  return d.linhas
    .filter(l => secoes.some(s => l.classificacao.startsWith(s.classificacao + '.')) && !tem(l))
    .map(l => ({ codigo: l.codigo, nome: l.descricao.replace(/\s+/g, ' '), saldo: l.saldos[mes] ?? 0, noBalancete: null }));
}

/** O saldo de cada cliente no balancete atual (o do Alterdata: D positivo, C negativo). */
export function comBalancete(clientes: readonly ContaDeCliente[], balancete: Record<string, Conta>): ContaDeCliente[] {
  return clientes.map(c => {
    const b = balancete[c.codigo];
    return { ...c, noBalancete: b ? (b.dc === 'C' ? -b.valor : b.valor) : null };
  });
}

const zero = (v: number) => Math.abs(v) < 0.005;

/** Os clientes com saldo credor (no mês do dinâmico ou no balancete atual): a prioridade, corrigir antes. */
export function credores(clientes: readonly ContaDeCliente[]): ContaDeCliente[] {
  return clientes.filter(c => (c.saldo < 0 && !zero(c.saldo)) || (c.noBalancete != null && c.noBalancete < 0 && !zero(c.noBalancete)));
}

// ─── a situação de cada um ───────────────────────────────────────────────────

/** Pendente (o valor devedor, em laranja), Ok (zerado) ou Conferido (vai para o cliente, com a observação). */
export type SituacaoCliente = 'pendente' | 'ok' | 'conferido';

/** O que a pessoa marcou (guardado no mês): a situação e a observação. */
export interface MarcaDoCliente { nome: string; saldo: number; situacao: SituacaoCliente; obs?: string }
export interface DocClientes { contas: Record<string, MarcaDoCliente>; atualizadoEm?: string }

/** Sem marca: zerado é Ok, com saldo é Pendente. */
export function situacaoDe(c: ContaDeCliente, marca?: MarcaDoCliente): SituacaoCliente {
  return marca ? marca.situacao : zero(c.saldo) ? 'ok' : 'pendente';
}

/** O clique no botão: Pendente → Ok → Conferido → Pendente. */
export function proximaSituacao(s: SituacaoCliente): SituacaoCliente {
  return s === 'pendente' ? 'ok' : s === 'ok' ? 'conferido' : 'pendente';
}

/** O documento guardado conferido (o que não for de cliente, fora). */
export function docDoDocumento(d: unknown): DocClientes {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const contas = (o.contas && typeof o.contas === 'object' ? o.contas : {}) as Record<string, Record<string, unknown>>;
  const certo: Record<string, MarcaDoCliente> = {};
  for (const [k, v] of Object.entries(contas)) {
    const s = v?.situacao;
    if (s !== 'pendente' && s !== 'ok' && s !== 'conferido') continue;
    certo[k] = { nome: String(v.nome ?? ''), saldo: typeof v.saldo === 'number' ? v.saldo : 0, situacao: s, ...(typeof v.obs === 'string' && v.obs ? { obs: v.obs } : {}) };
  }
  return { contas: certo, ...(typeof o.atualizadoEm === 'string' ? { atualizadoEm: o.atualizadoEm } : {}) };
}

/** Os conferidos de um mês anterior que ainda não estão neste (passam para o mês seguinte). */
export function conferidosQuePassam(anterior: DocClientes | null, atual: DocClientes): Record<string, MarcaDoCliente> {
  if (!anterior) return {};
  return Object.fromEntries(Object.entries(anterior.contas).filter(([k, m]) => m.situacao === 'conferido' && !atual.contas[k]));
}

// ─── para o cliente ──────────────────────────────────────────────────────────

export interface LinhaParaCliente { codigo: string; nome: string; saldo: number; obs: string }

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A planilha para o cliente responder (.xlsx): a conta, o cliente, o saldo, a nossa observação e a resposta. */
export function planilhaParaCliente(linhas: readonly LinhaParaCliente[]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Conta', 'Cliente', 'Saldo (R$)', 'Observação do escritório', 'Resposta da empresa'],
    ...linhas.map(l => [l.codigo, l.nome, Math.round(l.saldo * 100) / 100, l.obs, '']),
  ]);
  ws['!cols'] = [{ wch: 10 }, { wch: 42 }, { wch: 14 }, { wch: 48 }, { wch: 48 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A mensagem padrão (dá para trocar na tela): {empresa}, {mes} e {lista} viram os dados. */
export const MENSAGEM_PADRAO = 'Olá! Na conferência dos clientes de {mes} da {empresa}, estes saldos ficaram em aberto. Pode nos dizer o que aconteceu com cada um?\n\n{lista}\n\nObrigado!';

/** O texto da mensagem com a lista dos conferidos (uma linha por cliente: o nome, o saldo e a observação). */
export function textoDaMensagem(modelo: string, empresa: string, mes: string, linhas: readonly LinhaParaCliente[]): string {
  const lista = linhas.map(l => '• ' + l.nome + ' — R$ ' + brl(l.saldo) + (l.obs ? ' — ' + l.obs : '')).join('\n');
  return (modelo || MENSAGEM_PADRAO).replace(/\{empresa\}/g, empresa).replace(/\{mes\}/g, mes).replace(/\{lista\}/g, lista);
}
