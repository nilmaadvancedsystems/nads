// Período do Movimento: datas (de/até) e meses marcados no gráfico.
// Origem: conferencia.html noPeriodoCc (~L2300), notasBaseCc/notasNoPeriodoCc
// (~L3332-3341), periodoKeyCc (~L3367). O original lia o ccState global; aqui o
// filtro vem por parâmetro.
import { dataOrdem } from '../../formatos';
import { FILTRO_MOVIMENTO_VAZIO, type Empresa, type FiltroMovimento, type NotaComTipo } from '../tipos';
import { todasNotasComTipo } from './empresa';

type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;

function limites(p: Periodo) {
  const de = p.dataDe && p.dataDe.length === 10 ? dataOrdem(p.dataDe) : 0;
  const ate = p.dataAte && p.dataAte.length === 10 ? dataOrdem(p.dataAte) : 0;
  return { de, ate };
}

/** A nota está no período (datas e meses marcados)? */
export function noPeriodo(n: { data: string; comp: string }, p: Periodo): boolean {
  const { de, ate } = limites(p);
  const t = dataOrdem(n.data);
  return (!de || t >= de) && (!ate || t <= ate) && (!p.meses.length || p.meses.indexOf(n.comp) > -1);
}

/** Só pelas datas — a base do gráfico mensal, que mostra todos os meses mesmo com um marcado. */
export function notasBase(e: Empresa, p: Periodo): NotaComTipo[] {
  const { de, ate } = limites(p);
  return todasNotasComTipo(e).filter(n => { const t = dataOrdem(n.data); return (!de || t >= de) && (!ate || t <= ate); });
}

export function notasNoPeriodo(e: Empresa, p: Periodo): NotaComTipo[] {
  return notasBase(e, p).filter(n => !p.meses.length || p.meses.indexOf(n.comp) > -1);
}

/** Prefixo das marcas de conferência: cada período tem as suas. */
export function periodoKey(p: Periodo): string {
  return 'data|' + p.dataDe + '|' + p.dataAte + (p.meses.length ? '|' + p.meses.slice().sort().join(',') : '');
}

/**
 * O filtro do Movimento de quando a Conferência abre dentro de uma etapa da Tarefas (a Conferência fiscal): os
 * meses que a pessoa está fazendo ('aaaa-mm', um ou o período do Em Lote) e as datas do primeiro dia do primeiro
 * mês ao último dia do último — tudo roda dentro desse período. Mês inválido fica de fora; sem nenhum, o vazio.
 */
export function filtroDoPeriodo(meses: readonly string[]): FiltroMovimento {
  const validos = [...new Set(meses.filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)))].sort();
  if (!validos.length) return { ...FILTRO_MOVIMENTO_VAZIO };
  const [a1, m1] = validos[0].split('-');
  const [a2, m2] = validos[validos.length - 1].split('-');
  const ultimoDia = new Date(Date.UTC(Number(a2), Number(m2), 0)).getUTCDate();
  return { ...FILTRO_MOVIMENTO_VAZIO, meses: validos, dataDe: '01/' + m1 + '/' + a1, dataAte: String(ultimoDia).padStart(2, '0') + '/' + m2 + '/' + a2 };
}
