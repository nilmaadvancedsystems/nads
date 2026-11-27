// O "Hoje" da Área do Cliente refeita (26/11/2026; escolhidas as "5 seções", com a Hoje: "O que preciso fazer agora?"):
// os números que levam a cada seção já filtrada e as últimas coisas que chegaram. Funções puras, testadas em
// hojeDaArea.test.ts.
import { areaCliente as ac } from '@nads/core';
import type { ChamadoNaEquipe, LinkDaEmpresa, PessoaComSenha, RecebidoDoCliente } from './areaCliente';

export interface ResumoDoHoje {
  /** solicitações abertas ou em andamento */
  pendentes: number;
  /** delas, as que ninguém respondeu ainda (situação aberto) */
  semResposta: number;
  /** arquivos dos últimos 7 dias, sem recusa */
  arquivosNovos: number;
  /** comunicados no ar hoje */
  comunicadosNoAr: number;
  /** empresas com link */
  comAcesso: number;
  /** pessoas cujo login o robô não conseguiu criar */
  acessosComErro: number;
  nota: { media: number; total: number };
}

const SETE_DIAS = 7 * 24 * 36e5;

/** Está no ar hoje ('AAAA-MM-DD'): já começou e não acabou. */
export const comunicadoNoAr = (c: Pick<ac.Comunicado, 'publicarEm' | 'ate'>, hoje: string) => (!c.publicarEm || c.publicarEm <= hoje) && (!c.ate || c.ate >= hoje);

export function resumoDoHoje(d: {
  chamados: readonly ChamadoNaEquipe[]; recebidos: readonly RecebidoDoCliente[]; comunicados: readonly ac.Comunicado[];
  links: readonly LinkDaEmpresa[]; pessoas: readonly PessoaComSenha[]; agora: Date;
}): ResumoDoHoje {
  // o dia de hoje no horário daqui (não em UTC: depois das 21h o UTC já é amanhã)
  const a = d.agora, hoje = a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0');
  const pend = d.chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento');
  return {
    pendentes: pend.length,
    semResposta: pend.filter(c => c.situacao === 'aberto').length,
    arquivosNovos: d.recebidos.filter(r => !r.recusa && d.agora.getTime() - Date.parse(r.recebidoEm) <= SETE_DIAS).length,
    comunicadosNoAr: d.comunicados.filter(c => comunicadoNoAr(c, hoje)).length,
    comAcesso: new Set(d.links.map(l => l.codigo)).size,
    acessosComErro: d.pessoas.filter(p => p.ativo && p.situacao === 'erro').length,
    nota: ac.mediaDasAvaliacoes(d.chamados.flatMap(c => (c.avaliacao ? [c.avaliacao] : [])), hoje.slice(0, 7)),
  };
}

/** As solicitações que esperam a equipe, a mais antiga sem resposta primeiro (quem espera há mais tempo). */
export function solicitacoesQueEsperam(chamados: readonly ChamadoNaEquipe[], limite = 5): ChamadoNaEquipe[] {
  const peso = (c: ChamadoNaEquipe) => (c.situacao === 'aberto' ? 0 : 1);
  return chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento')
    .slice().sort((a, b) => peso(a) - peso(b) || a.atualizadoEm.localeCompare(b.atualizadoEm)).slice(0, limite);
}

/** Os últimos arquivos que chegaram (sem os recusados). */
export function ultimosRecebidos(recebidos: readonly RecebidoDoCliente[], limite = 5): RecebidoDoCliente[] {
  return recebidos.filter(r => !r.recusa).slice().sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm)).slice(0, limite);
}

// ─── a fila do Hoje (27/11/2026: "se baseia na UI deles e monte um para nós", o TaxDome, o Karbon e o Intercom) ─────
// Três filas, como nos grandes: o que espera a equipe (o cliente falou por último), o que espera o cliente (o escritório
// falou por último: a cobrança) e os arquivos para revisar (nem aprovados nem recusados). Cada item com há quanto tempo
// espera e o tom (em dia, atenção, atrasado), o mais antigo primeiro; e a conta por responsável, como o painel do TaxDome.

export type FilaDoHoje = 'equipe' | 'cliente' | 'revisar';
export type TomDaEspera = 'ok' | 'atencao' | 'atrasado';

export interface ItemDaFila {
  fila: FilaDoHoje;
  /** o id da solicitação ou do arquivo */
  id: string;
  titulo: string;
  empresa: string;
  codigo: number | null;
  /** desde quando espera (ISO): a última mensagem, ou quando chegou */
  desde: string;
  /** dias inteiros de espera */
  dias: number;
  tom: TomDaEspera;
  /** a solicitação do DP (admissão, férias, demissão): o responsável é o do DP */
  doDp: boolean;
}

/** Quantos dias de espera viram atenção e atraso em cada fila (a equipe responde rápido; o cliente tem mais folga). */
export const LIMITES_DA_ESPERA: Record<FilaDoHoje, { atencao: number; atrasado: number }> = {
  equipe: { atencao: 1, atrasado: 3 },
  cliente: { atencao: 3, atrasado: 7 },
  revisar: { atencao: 2, atrasado: 5 },
};

/** os arquivos de mais de 30 dias saem da fila de revisar (os antigos, de antes do Aprovar, não viram pendência) */
const REVISAR_ATE_DIAS = 30;
const TIPOS_DO_DP: readonly string[] = ['admissao', 'ferias', 'demissao'];
const DIA = 864e5;

export function tomDaEspera(fila: FilaDoHoje, dias: number): TomDaEspera {
  const l = LIMITES_DA_ESPERA[fila];
  return dias >= l.atrasado ? 'atrasado' : dias >= l.atencao ? 'atencao' : 'ok';
}

/** A fila de cada solicitação aberta: quem falou por último decide (sem mensagem, espera a equipe); null = concluída. */
export function filaDaSolicitacao(c: Pick<ChamadoNaEquipe, 'situacao' | 'mensagens'>): FilaDoHoje | null {
  if (c.situacao === 'concluido') return null;
  if (c.situacao === 'aberto') return 'equipe';
  const ultima = c.mensagens[c.mensagens.length - 1];
  if (c.situacao === 'respondido') return ultima?.de === 'cliente' ? 'equipe' : 'cliente';
  return ultima?.de === 'escritorio' ? 'cliente' : 'equipe';
}

export function filaDoHoje(d: { chamados: readonly ChamadoNaEquipe[]; recebidos: readonly RecebidoDoCliente[]; agora: Date }): ItemDaFila[] {
  const dias = (iso: string) => Math.max(0, Math.floor((d.agora.getTime() - Date.parse(iso)) / DIA)) || 0;
  const itens: ItemDaFila[] = [];
  for (const c of d.chamados) {
    const fila = filaDaSolicitacao(c);
    if (!fila) continue;
    const desde = c.mensagens[c.mensagens.length - 1]?.em || c.atualizadoEm || c.criadoEm;
    const n = dias(desde);
    itens.push({ fila, id: c.id, titulo: c.titulo, empresa: c.empresa, codigo: c.codigos[0] ?? null, desde, dias: n, tom: tomDaEspera(fila, n), doDp: TIPOS_DO_DP.includes(c.tipo) });
  }
  for (const r of d.recebidos) {
    if (r.recusa || r.aprovado) continue;
    const n = dias(r.recebidoEm);
    if (n > REVISAR_ATE_DIAS) continue;
    itens.push({ fila: 'revisar', id: r.id, titulo: r.guia || r.nome, empresa: r.empresa, codigo: r.codigo, desde: r.recebidoEm, dias: n, tom: tomDaEspera('revisar', n), doDp: false });
  }
  // o que espera há mais tempo primeiro
  return itens.sort((a, b) => a.desde.localeCompare(b.desde));
}

export interface ContaDaFila { equipe: number; cliente: number; revisar: number; atrasados: Record<FilaDoHoje, number> }

export function contarFila(itens: readonly ItemDaFila[]): ContaDaFila {
  const c: ContaDaFila = { equipe: 0, cliente: 0, revisar: 0, atrasados: { equipe: 0, cliente: 0, revisar: 0 } };
  for (const i of itens) { c[i.fila]++; if (i.tom === 'atrasado') c.atrasados[i.fila]++; }
  return c;
}

export interface LinhaPorResponsavel { nome: string; equipe: number; cliente: number; revisar: number; atrasados: number }

export const SEM_RESPONSAVEL = 'Sem responsável';

/** A fila por responsável (o painel do TaxDome: o pendente de cada um); sem responsável primeiro; depois o maior. */
export function filaPorResponsavel(itens: readonly ItemDaFila[], responsavelDe: (i: ItemDaFila) => string): LinhaPorResponsavel[] {
  const m = new Map<string, LinhaPorResponsavel>();
  for (const i of itens) {
    const nome = responsavelDe(i) || SEM_RESPONSAVEL;
    const l = m.get(nome) ?? { nome, equipe: 0, cliente: 0, revisar: 0, atrasados: 0 };
    l[i.fila]++;
    if (i.tom === 'atrasado') l.atrasados++;
    m.set(nome, l);
  }
  const total = (l: LinhaPorResponsavel) => l.equipe + l.cliente + l.revisar;
  const sem = (l: LinhaPorResponsavel) => (l.nome === SEM_RESPONSAVEL ? 0 : 1);
  return [...m.values()].sort((a, b) => sem(a) - sem(b) || total(b) - total(a) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
