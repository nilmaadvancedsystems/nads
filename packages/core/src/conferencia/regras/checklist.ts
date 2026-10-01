// Checklist (Movimento › Checklist, título "Naturezas de CFOP"): uma linha por natureza,
// marcar risca e manda pro fim. Origem: conferencia.html renderChecklistNatureza (~L3080).
import { compararNumerico } from '../../formatos';
import type { Empresa, FiltroMovimento, TipoCfop } from '../tipos';
import { agruparTotaisPorNatureza, somaValores, tituloDoGrupo } from './cfop';
import { quaisMarcarSozinho } from './conciliacao';
import { contasDaNatureza, naoContabil, nomeConta } from './empresa';
import { notasNoPeriodo, periodoKey } from './periodo';
import { contasOkEmServicos } from './servicosConferencia';

export interface LinhaChecklist {
  chave: string;
  /** marca de conferência: periodoKey||natureza */
  marca: string;
  tipo: TipoCfop;
  titulo: string;
  qtdNotas: number;
  total: number;
  /** % do maior valor da lista (barrinha) */
  proporcao: number;
  marcado: boolean;
  automatico: boolean;
  contas: string[];
  naoContabil: boolean;
}

export interface Checklist {
  linhas: LinhaChecklist[];
  /** havia naturezas no período (o vazio muda de texto) */
  temNaturezas: boolean;
  marcarSozinho: { chave: string; texto: string }[];
}

export function montarChecklist(e: Empresa, f: FiltroMovimento): Checklist {
  const grupos = agruparTotaisPorNatureza(notasNoPeriodo(e, f));
  const pk = periodoKey(f);
  const todas = Object.keys(grupos);
  const marcado = (k: string) => e.confMarcados.indexOf(pk + '||' + k) > -1;
  const qb = (f.busca || '').toLowerCase().trim();
  const chaves = todas.filter(k => {
    const gr = grupos[k];
    if (f.tipo && gr.tipo !== f.tipo) return false;
    if (f.status === 'conferido' && !marcado(k)) return false;
    if (f.status === 'pendente' && marcado(k)) return false;
    if (!qb) return true;
    return gr.desc.toLowerCase().indexOf(qb) > -1 || gr.tipo.toLowerCase().indexOf(qb) > -1 || gr.cfops.some(c => c.indexOf(qb) > -1);
  }).sort((a, b) => {
    // as já conferidas descem pro fim; dentro de cada bloco, maior valor primeiro
    const ma = marcado(a), mb = marcado(b);
    if (ma !== mb) return ma ? 1 : -1;
    return somaValores(grupos[b].itens) - somaValores(grupos[a].itens);
  });
  const maxVal = chaves.reduce((m, k) => Math.max(m, somaValores(grupos[k].itens)), 0) || 1;
  return {
    temNaturezas: todas.length > 0,
    marcarSozinho: quaisMarcarSozinho(e, grupos, todas, f, contasOkEmServicos(e, f)),
    linhas: chaves.map(k => {
      const gr = grupos[k];
      const total = somaValores(gr.itens);
      const mk = pk + '||' + k;
      return {
        chave: k, marca: mk, tipo: gr.tipo, titulo: tituloDoGrupo(gr),
        qtdNotas: gr.itens.length, total,
        proporcao: Math.max(2, Math.round(total / maxVal * 100)),
        marcado: e.confMarcados.indexOf(mk) > -1,
        automatico: e.confAutoMarcados.indexOf(mk) > -1,
        contas: contasDaNatureza(e, k).map(c => { const n = nomeConta(e, c); return c + (n ? ' — ' + n : ''); }),
        naoContabil: naoContabil(e, k),
      };
    }),
  };
}

/** Meses marcados no Relatório, para o aviso do Checklist. */
export function mesesMarcados(f: FiltroMovimento): string[] {
  return f.meses.slice().sort(compararNumerico);
}
