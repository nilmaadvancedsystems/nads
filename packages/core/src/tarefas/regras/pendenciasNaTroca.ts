// O que está pendente numa empresa quando ela muda de responsável (plano do Acessórias, ficha M02): as etapas da
// competência de trabalho com o prazo legal vencido, as que já passaram do prazo interno e as paradas. A pessoa nova vê
// a lista na troca, para nada "sumir". Sem a lista única de prazos (E04) ainda, a conta sai daqui: a rotina da empresa, a
// execução do mês e a tabela de prazos (com o dia da empresa, ficha E08). Só a lógica (sem tela e sem banco).
import type { Execucao, Rotina } from '../tipos';
import { ajusteDaEtapa, etapaNoMes, execucaoNova, situacaoDa } from './execucao';
import { prazoDaEtapa } from './prazos';

export type TipoDePendencia = 'atrasada' | 'no-interno' | 'parada';

export interface PendenciaDaEmpresa {
  etapa: string;
  nome: string;
  tipo: TipoDePendencia;
  /** o prazo legal ('aaaa-mm-dd'), quando a etapa tem */
  legal?: string;
}

/**
 * As pendências de uma empresa na competência: hoje ('aaaa-mm-dd') depois do prazo legal = atrasada; no prazo interno ou
 * depois dele = no-interno; a interrompida = parada. As feitas, as dispensadas e as que não entram no mês ficam de fora.
 */
export function pendenciasDaEmpresa(
  ex: Execucao | null, empresa: { nome: string; codigo: number | null }, rotina: Rotina, competencia: string, hoje: string,
): PendenciaDaEmpresa[] {
  const base = ex || execucaoNova(empresa.nome, empresa.codigo, competencia, rotina.departamento);
  const r: PendenciaDaEmpresa[] = [];
  for (const e of rotina.etapas) {
    if (!etapaNoMes(base, e.id)) continue;
    const s = situacaoDa(base, e.id);
    if (s === 'feita' || s === 'dispensada') continue;
    const prazo = prazoDaEtapa(rotina.departamento, e.id, competencia, ajusteDaEtapa(base, e.id)?.dia);
    if (prazo && hoje > prazo.legal) r.push({ etapa: e.id, nome: e.nome, tipo: 'atrasada', legal: prazo.legal });
    else if (prazo && hoje >= prazo.interno) r.push({ etapa: e.id, nome: e.nome, tipo: 'no-interno', legal: prazo.legal });
    else if (s === 'interrompida') r.push({ etapa: e.id, nome: e.nome, tipo: 'parada', ...(prazo ? { legal: prazo.legal } : {}) });
  }
  return r;
}

/** "2 atrasadas, 1 no prazo interno e 1 parada" ('' = nada pendente). */
export function resumoDasPendencias(l: readonly PendenciaDaEmpresa[]): string {
  const q = (t: TipoDePendencia) => l.filter(p => p.tipo === t).length;
  const partes = [
    q('atrasada') ? q('atrasada') + (q('atrasada') === 1 ? ' atrasada' : ' atrasadas') : '',
    q('no-interno') ? q('no-interno') + ' no prazo interno' : '',
    q('parada') ? q('parada') + (q('parada') === 1 ? ' parada' : ' paradas') : '',
  ].filter(Boolean);
  return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0] || '';
}
