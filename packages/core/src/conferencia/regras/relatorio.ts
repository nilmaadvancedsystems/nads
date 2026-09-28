// Relatório (Movimento › Relatório): números do período, gráfico por mês e maiores naturezas.
// Origem: conferencia.html renderGeral (~L3593, a parte que calcula), renderCcChart
// (~L3419), renderCcRank (~L3447).
import { compararNumerico } from '../../formatos';
import type { Empresa, FiltroMovimento, GrupoNatureza, NotaComTipo, TipoCfop } from '../tipos';
import { agruparTotaisPorNatureza, somaValores } from './cfop';
import { linhasDoSaldo, quaisMarcarSozinho, type LinhaSaldo } from './conciliacao';
import { notasBase, notasNoPeriodo } from './periodo';

export type AbaRelatorio = 'geral' | 'entradas' | 'saidas' | 'tomados' | 'prestados';

export function tipoDaAba(aba: AbaRelatorio): '' | TipoCfop {
  return aba === 'entradas' ? 'Entrada' : aba === 'saidas' ? 'Saída' : '';
}

export interface MesDoGrafico { comp: string; ent: number; sai: number; qtd: number }

/** Entradas × saídas por mês (só aparece com 2 meses ou mais). */
export function porMes(base: NotaComTipo[]): MesDoGrafico[] {
  const m: Record<string, MesDoGrafico> = {};
  for (const n of base) {
    if (!n.comp) continue;
    const x = (m[n.comp] = m[n.comp] || { comp: n.comp, ent: 0, sai: 0, qtd: 0 });
    if (n.tipo === 'Entrada') x.ent += n.valor; else x.sai += n.valor;
    x.qtd++;
  }
  const meses = Object.keys(m).sort().map(k => m[k]);
  return meses.length < 2 ? [] : meses;
}

export interface ItemRank { k: string; tipo: TipoCfop; nome: string; cfops: string; valor: number }

/** Maiores naturezas por valor no período (até 7; só com 2 ou mais naturezas). */
export function maioresNaturezas(grupos: Record<string, GrupoNatureza>): ItemRank[] {
  const chaves = Object.keys(grupos);
  if (chaves.length < 2) return [];
  return chaves.map(k => {
    const gr = grupos[k];
    return {
      k, tipo: gr.tipo, nome: gr.desc || gr.cfops.join(', '),
      cfops: gr.cfops.slice().sort(compararNumerico).join(', '),
      valor: somaValores(gr.itens),
    };
  }).sort((a, b) => b.valor - a.valor).slice(0, 7);
}

export interface Relatorio {
  totEnt: number;
  totSai: number;
  qtdNotas: number;
  qtdNaturezas: number;
  meses: MesDoGrafico[];
  rank: ItemRank[];
  saldo: LinhaSaldo[];
  /** naturezas que batem com o balancete e ainda não estão marcadas (o antigo autoMarcarConferidos) */
  marcarSozinho: { chave: string; texto: string }[];
}

/** Tudo que a aba Geral/Entradas/Saídas do Relatório mostra, num cálculo só. */
export function montarRelatorio(e: Empresa, f: FiltroMovimento, tipoF: '' | TipoCfop): Relatorio {
  const doTipo = (n: NotaComTipo) => !tipoF || n.tipo === tipoF;
  const todasNotas = notasNoPeriodo(e, f);
  const notas = todasNotas.filter(doTipo);
  const grupos = agruparTotaisPorNatureza(notas);
  const gruposTodos = agruparTotaisPorNatureza(todasNotas);
  const chavesTodas = Object.keys(gruposTodos);
  return {
    totEnt: somaValores(notas.filter(n => n.tipo === 'Entrada')),
    totSai: somaValores(notas.filter(n => n.tipo === 'Saída')),
    qtdNotas: notas.length,
    qtdNaturezas: Object.keys(grupos).length,
    meses: porMes(notasBase(e, f).filter(doTipo)),
    rank: maioresNaturezas(grupos),
    saldo: linhasDoSaldo(e, gruposTodos, chavesTodas, f, tipoF),
    marcarSozinho: quaisMarcarSozinho(e, gruposTodos, chavesTodas, f),
  };
}
