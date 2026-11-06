// Peças de ViewModel que o Relatório e o Checklist dividem: a marcação automática das
// naturezas que bateram com o balancete e o texto das abas travadas.
// Origem: conferencia.html autoMarcarConferidos (~L3563, chamado em renderGeral ~L3620 e
// renderChecklistNatureza ~L3086) e aplicarBloqueios (~L1843-1861).
import { conferencia as c } from '@nads/core';
import { useEffect, useRef } from 'react';
import { useSessao } from '../../casca/sessao';

/** O que falta importar para a aba destravar (o data-req do original). */
export type ReqAba = 'entradas' | 'saidas' | 'tomados' | 'prestados';

const O_QUE: Record<ReqAba, string> = { entradas: 'as entradas', saidas: 'as saídas', prestados: 'os serviços prestados', tomados: 'os serviços tomados' };

/** title da aba travada ("Importe as entradas primeiro"), ou false se tem dado. */
export function travaDaAba(tem: c.Disponivel, req: ReqAba): string | false {
  return tem[req] ? false : 'Importe ' + O_QUE[req] + ' primeiro';
}

/**
 * Marca sozinho o que bateu com o balancete. Só dispara quando há o que marcar, e nunca
 * duas vezes a mesma lista (depois de marcar, a lista nova vem vazia).
 */
export function useMarcarSozinho(itens: { chave: string; texto: string }[] | null) {
  const s = useSessao();
  const ultima = useRef('');
  const chave = itens && itens.length ? itens.map(x => x.chave).join('\n') : '';
  useEffect(() => {
    if (!chave || !itens || ultima.current === chave) return;
    ultima.current = chave;
    s.aplicar(x => c.marcarAutomaticos(x, itens, new Date()));
  }, [chave, itens, s]);
}
