// Movimento › Relatório › Entradas/Saídas: notas com lançamento fora do padrão do CFOP,
// separadas em pendentes e corrigidas e agrupadas por natureza.
// Origem: conferencia.html renderDivergencias (~L3180, a parte que calcula) e o
// change de data-resolve-grupo (~L3244-3256: o grupo marca TODAS as notas da natureza).
import { dataOrdem } from '../../formatos';
import type { Empresa, TipoNotaFiscal } from '../tipos';
import { agruparPorNatureza, ordenarGrupos, somaValores, tituloDoGrupo, type OrdemGrupos } from './cfop';
import { acharDivergencias, chaveResolvido, type Divergencia } from './divergencias';

export interface GrupoForaDoPadrao {
  /** chave da natureza (a do agruparPorNatureza) */
  key: string;
  titulo: string;
  total: number;
  /** itens do grupo, por data */
  itens: Divergencia[];
  /** marcas de "corrigido" de todas as notas fora do padrão da natureza (o checkbox do grupo) */
  chavesDaNatureza: string[];
}

export interface ForaDoPadraoFiscal {
  temDivergencias: boolean;
  pendentes: GrupoForaDoPadrao[];
  corrigidos: GrupoForaDoPadrao[];
  qtdCorrigidos: number;
}

export function foraDoPadraoFiscal(e: Empresa, tipo: TipoNotaFiscal, ordem: OrdemGrupos): ForaDoPadraoFiscal {
  const divs = acharDivergencias(e, tipo);
  const res: Record<string, 1> = {};
  for (const k of e.divResolvidos) res[k] = 1;
  const resolvida = (d: Divergencia) => !!res[chaveResolvido(tipo, d.chave)];
  const todas = agruparPorNatureza(divs);
  const montar = (lista: Divergencia[]): GrupoForaDoPadrao[] =>
    ordenarGrupos(agruparPorNatureza(lista), ordem).map(gr => {
      const itens = gr.itens.slice().sort((a, b) => dataOrdem(a.nota.data) - dataOrdem(b.nota.data));
      return {
        key: gr.key,
        titulo: tituloDoGrupo(gr),
        total: somaValores(itens.map(d => d.nota)),
        itens,
        chavesDaNatureza: (todas[gr.key]?.itens || []).map(d => chaveResolvido(tipo, d.chave)),
      };
    });
  const corrigidas = divs.filter(resolvida);
  return {
    temDivergencias: divs.length > 0,
    pendentes: montar(divs.filter(d => !resolvida(d))),
    corrigidos: montar(corrigidas),
    qtdCorrigidos: corrigidas.length,
  };
}
