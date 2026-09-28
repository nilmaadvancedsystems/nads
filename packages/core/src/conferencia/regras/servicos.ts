// Serviços prestados e tomados: a chave é o PARTICIPANTE (não o CFOP).
// Origem: conferencia.html catServ/chaveContaCat/catFixa/catDoPart/contasDoPart
// (~L4430-4447), contasServico/notasCfopDeServico (~L2287-2299),
// servicoDaConta/somaServDaConta/somaNfeDaConta (~L2305-2327),
// servPartsDasNotas (~L4467), chaveServ (~L4273).
import { lancN, nomeNorm } from '../../formatos';
import { SERV_CAT, type CategoriaServico } from '../tabelas/servicos';
import type { Empresa, FiltroMovimento, Nota, NotaServico, TipoCfop, TipoServico } from '../tipos';
import { chaveNaturezaNota, tipoDoCfop } from './cfop';
import { contasDaNatureza, listaTipo } from './empresa';
import { noPeriodo } from './periodo';

type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;

/** Identidade de uma nota de serviço. */
export function chaveServ(n: Pick<NotaServico, 'numero' | 'data' | 'nome' | 'valor'>): string {
  return [n.numero, n.data, n.nome, n.valor.toFixed(2)].join('|');
}

export function catServ(tipo: TipoServico, id: string): CategoriaServico {
  return SERV_CAT[tipo].find(c => c.id === id) || SERV_CAT[tipo][0];
}

/** Chave do vínculo de conta da categoria: "serv|tomados|*" (geral) ou "serv|tomados|cat:telefone". */
export function chaveContaCat(tipo: TipoServico, id: string): string {
  return 'serv|' + tipo + '|' + (id === 'geral' ? '*' : 'cat:' + id);
}

/** Categoria permanente pelo nome (ex.: Honorário = NILMA CONTABILIDADE). */
export function catFixa(tipo: TipoServico, nome: string): string | null {
  const k = nomeNorm(nome);
  const c = SERV_CAT[tipo].find(c => (c.fixos || []).some(f => k.indexOf(nomeNorm(f)) > -1));
  return c ? c.id : null;
}

export function catDoPart(e: Empresa, tipo: TipoServico, nome: string): string {
  const f = catFixa(tipo, nome);
  if (f) return f; // Honorário é permanente: ninguém tira nem coloca
  const m = ((e.servCat || {})[tipo] || {})[nomeNorm(nome)];
  return (m && m.cat) || 'geral';
}

/** Conta do participante = a conta da categoria dele (uma conta por categoria). */
export function contasDoPart(e: Empresa, tipo: TipoServico, nome: string): string[] {
  return contasDaNatureza(e, chaveContaCat(tipo, catDoPart(e, tipo, nome)));
}

/** Contas ligadas a serviço → tipo (tomados/prestados). */
export function contasServico(e: Empresa, tipo?: TipoServico): Record<string, TipoServico> {
  const s: Record<string, TipoServico> = {};
  for (const k of Object.keys(e.naturezaConta || {})) {
    const m = /^serv\|(tomados|prestados)\|/.exec(k);
    if (m && (!tipo || m[1] === tipo)) for (const c of contasDaNatureza(e, k)) s[c] = m[1] as TipoServico;
  }
  return s;
}

/** Notas com CFOP cuja natureza está ligada a uma conta de serviço (tomados ← entradas, prestados ← saídas). */
export function notasCfopDeServico(e: Empresa, tipo: TipoServico): Nota[] {
  const sc = contasServico(e, tipo);
  const t: TipoCfop = tipo === 'tomados' ? 'Entrada' : 'Saída';
  return (e[tipo === 'tomados' ? 'entradas' : 'saidas'] || []).filter(n => {
    if ((tipoDoCfop(n.cfop) || t) !== t) return false;
    return contasDaNatureza(e, chaveNaturezaNota(n, t)).some(c => sc[c]);
  });
}

/** Essas contas têm nota de serviço no período? Devolve o tipo, ou null. */
export function servicoDaConta(e: Empresa, codigos: string[], p: Periodo): TipoServico | null {
  for (const t of ['tomados', 'prestados'] as TipoServico[]) {
    if (listaTipo(e, t).some(n => noPeriodo(n, p) && contasDoPart(e, t, n.nome).some(c => codigos.indexOf(c) > -1))) return t;
  }
  return null;
}

/** Participantes das notas de um tipo, com quantas notas e os lançamentos usados. */
export function participantesDasNotas(e: Empresa, t: TipoServico): Record<string, { nome: string; qtd: number; lancs: Record<string, number> }> {
  const parts: Record<string, { nome: string; qtd: number; lancs: Record<string, number> }> = {};
  for (const n of listaTipo(e, t)) {
    const k = nomeNorm(n.nome);
    const p = (parts[k] = parts[k] || { nome: n.nome, qtd: 0, lancs: {} });
    p.qtd++;
    const l = lancN(n.lanc);
    if (l) p.lancs[l] = (p.lancs[l] || 0) + 1;
  }
  return parts;
}
