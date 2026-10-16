// Visão de cima (Contábil/Fiscal): como está cada etapa em todas as empresas da competência e quais
// objeções mais param o trabalho. Só leitura.
import type { Execucao, Rotina } from '../tipos';
import { etapaNoMes, etapaNoMesDoAno, situacaoDa } from './execucao';

/** total: as empresas que têm a etapa (a "só quando adicionada" e o LCDPR contam só nas delas; 16/10/2026) */
export interface ResumoDaEtapa { etapa: string; nome: string; feitas: number; dispensadas: number; interrompidas: number; pendentes: number; total: number }

export function resumoPorEtapa(execucoes: readonly Execucao[], rotina: Rotina, totalEmpresas: number): ResumoDaEtapa[] {
  return rotina.etapas.map(e => {
    let feitas = 0, dispensadas = 0, interrompidas = 0;
    // a etapa "só quando adicionada" (o Creditor) conta só nas empresas em que entrou
    const daEtapa = e.soQuandoAdicionada ? execucoes.filter(ex => etapaNoMes(ex, e.id)) : execucoes;
    const total = e.soQuandoAdicionada ? daEtapa.length : totalEmpresas;
    for (const ex of daEtapa) {
      const s = situacaoDa(ex, e.id);
      if (s === 'feita') feitas++;
      else if (s === 'dispensada') dispensadas++;
      else if (s === 'interrompida') interrompidas++;
    }
    return { etapa: e.id, nome: e.nome, feitas, dispensadas, interrompidas, pendentes: Math.max(0, total - feitas - dispensadas - interrompidas), total };
  });
}

/**
 * A visão de cima com a rotina de cada empresa (16/10/2026: a 62 só tem o LCDPR): as empresas agrupadas pela rotina
 * delas (rotinaDe, pelo código), cada grupo contado só na própria rotina — a 62 não fica pendente nas etapas do Contábil,
 * e o LCDPR entra como uma etapa a mais, contada só nela. As rotinas da que tem mais empresas para a que tem menos (a do
 * departamento primeiro); com a competência, só as etapas do mês do ano dela (o Estoque só em dezembro).
 */
export function resumoPorEtapaDasEmpresas(execucoes: readonly Execucao[], codigos: readonly (number | null)[], rotinaDe: (codigo: number | null) => Rotina, competencia?: string): ResumoDaEtapa[] {
  const grupos = new Map<Rotina, { codigos: Set<number | null>; total: number }>();
  for (const c of codigos) {
    const r = rotinaDe(c);
    const g = grupos.get(r) || { codigos: new Set<number | null>(), total: 0 };
    g.codigos.add(c);
    g.total++;
    grupos.set(r, g);
  }
  return [...grupos].sort((a, b) => b[1].total - a[1].total).flatMap(([r, g]) => resumoPorEtapa(
    execucoes.filter(ex => g.codigos.has(ex.codigo)),
    competencia ? { ...r, etapas: r.etapas.filter(e => etapaNoMesDoAno(e, competencia)) } : r,
    g.total,
  ));
}

export interface ObjecaoContada { etapa: string; nomeEtapa: string; objecao: string; texto: string; qtd: number }

/** As objeções que estão parando (ou dispensando) etapas agora, da mais comum para a menos. */
export function objecoesMaisComuns(execucoes: readonly Execucao[], rotina: Rotina): ObjecaoContada[] {
  const conta = new Map<string, ObjecaoContada>();
  for (const ex of execucoes) {
    for (const [idEtapa, est] of Object.entries(ex.etapas)) {
      if (!est.objecao || (est.situacao !== 'interrompida' && est.situacao !== 'dispensada')) continue;
      const etapa = rotina.etapas.find(e => e.id === idEtapa);
      const texto = etapa?.objecoes.find(o => o.id === est.objecao)?.texto || (est.objecao === 'outro' ? 'Outro motivo' : est.objecao);
      const k = idEtapa + '|' + est.objecao;
      const c = conta.get(k) || { etapa: idEtapa, nomeEtapa: etapa?.nome || idEtapa, objecao: est.objecao, texto, qtd: 0 };
      c.qtd++;
      conta.set(k, c);
    }
  }
  return [...conta.values()].sort((a, b) => b.qtd - a.qtd || a.texto.localeCompare(b.texto));
}

/**
 * Quanto cada etapa leva (Vitor, 16/10/2026: "aplique todas as suas sugestões" — onde as pessoas mais param): em cada
 * empresa, a hora em que a etapa foi concluída menos a hora da concluída antes dela, quando é a mesma sentada (até 4
 * horas). A mediana, em minutos, de cada etapa (n = quantas vezes deu para medir).
 */
export function tempoPorEtapa(execucoes: readonly Execucao[]): Record<string, { minutos: number; n: number }> {
  const amostras = new Map<string, number[]>();
  for (const ex of execucoes) {
    const feitas = Object.entries(ex.etapas)
      .filter(([, e]) => (e.situacao === 'feita' || e.situacao === 'dispensada') && !Number.isNaN(Date.parse(e.em)))
      .map(([id, e]) => ({ id, t: Date.parse(e.em) }))
      .sort((a, b) => a.t - b.t);
    for (let i = 1; i < feitas.length; i++) {
      const min = (feitas[i].t - feitas[i - 1].t) / 60000;
      if (min <= 0 || min > 240) continue;
      amostras.set(feitas[i].id, [...(amostras.get(feitas[i].id) || []), min]);
    }
  }
  const out: Record<string, { minutos: number; n: number }> = {};
  for (const [id, xs] of amostras) {
    const o = [...xs].sort((a, b) => a - b);
    const meio = Math.floor(o.length / 2);
    out[id] = { minutos: Math.round(o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2), n: o.length };
  }
  return out;
}
