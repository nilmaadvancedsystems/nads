// A tela inicial simples da Área do Cliente (17/11/2026: "remove esse boa tarde e esse inicio precisamos montar de maneira
// mais simples possivel o inicio, onde precisamos ter uma tela de guias e documentos la"; escolhida "Guias e documentos
// juntos", no celular e no computador). Sem saudação e sem resumo: as guias a pagar (a vencida primeiro), os documentos
// mais recentes e o enviar. Funções puras, testadas em inicioSimples.test.ts.
import { areaCliente as ac } from '@nads/core';
import type { ItemDaBiblioteca } from './biblioteca';
import { quandoVence } from './guiasDoMes';
import { guiasDoMomento } from './visaoGeral';

export interface GuiaDoInicio {
  guia: ac.GuiaDoCliente;
  /** 'Venceu 12/11', 'Vence hoje', 'Vence 20/11' */
  quando: string;
  tom: '' | 'vencida' | 'hoje';
}

const ORDEM: Record<string, number> = { vencida: 0, 'vence hoje': 1, 'a vencer': 2 };

/**
 * As guias a pagar da tela inicial: as do momento (deste mês em diante) que venceram, vencem hoje ou vão vencer; a
 * vencida primeiro (pede uma guia nova), depois a de hoje, depois as outras da mais próxima à mais distante. Até
 * `limite`, com quantas são ao todo (o "Ver todas"). (17/11/2026: "quero um numero grande de quanto ele tem para pagar
 * no estilo saldo de banco") com o total de todas (a vencida entra: o cliente ainda deve) e quantas venceram.
 */
export function guiasDoInicio(guias: readonly ac.GuiaDoCliente[], hoje: Date, limite = 5): { itens: GuiaDoInicio[]; quantas: number; total: number; vencidas: number } {
  const todas = guiasDoMomento([...guias], hoje)
    .filter(g => g.situacao in ORDEM)
    .map(g => ({ g, v: ac.dataDoVencimento(g.vencimento)?.getTime() ?? Infinity }))
    .sort((a, b) => ORDEM[a.g.situacao] - ORDEM[b.g.situacao] || a.v - b.v);
  const itens = todas.slice(0, limite).map(({ g }) => {
    const q = quandoVence(g.situacao, g.vencimento);
    return { guia: g, quando: q.texto, tom: q.tom };
  });
  return { itens, quantas: todas.length, total: todas.reduce((s, x) => s + x.g.valor, 0), vencidas: todas.filter(x => x.g.situacao === 'vencida').length };
}

/**
 * Os documentos mais recentes que o cliente pode abrir (o do DP, a DANFE, o que o escritório mandou): sem as guias, que
 * já têm a lista delas, e sem o que o próprio cliente enviou. O novo (ainda não baixado) primeiro, depois do mais
 * recente ao mais antigo. Até `limite`, com quantos novos há.
 */
export function documentosRecentes(itens: readonly ItemDaBiblioteca[], limite = 3): { itens: ItemDaBiblioteca[]; novos: number } {
  const docs = itens.filter(i => i.abre && i.origem.tipo !== 'guia' && i.origem.tipo !== 'envio')
    .map((i, n) => ({ i, n }))
    .sort((a, b) => Number(b.i.novo) - Number(a.i.novo) || (b.i.data || b.i.mes).localeCompare(a.i.data || a.i.mes) || a.n - b.n)
    .map(x => x.i);
  return { itens: docs.slice(0, limite), novos: docs.filter(i => i.novo).length };
}
