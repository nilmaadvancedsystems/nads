// O andamento das etapas de uma empresa numa competência: o que está feito, o que é a próxima,
// e as ações da tela (fazer, dispensar, interromper), cada uma devolvendo a execução nova e o evento.
import type { Departamento } from '../../usuarios/tipos';
import type { Etapa, EstadoEtapa, Evento, Execucao, Rotina, SituacaoEtapa } from '../tipos';

export function execucaoNova(empresa: string, codigo: number | null, competencia: string, departamento: Departamento): Execucao {
  return { empresa, codigo, competencia, departamento, etapas: {} };
}

export function estadoDa(ex: Execucao | null, etapa: string): EstadoEtapa | null {
  return ex?.etapas[etapa] || null;
}

export function situacaoDa(ex: Execucao | null, etapa: string): SituacaoEtapa {
  return estadoDa(ex, etapa)?.situacao || 'pendente';
}

/** Feita ou dispensada ("não se aplica") = não precisa mais fazer. */
export function concluida(s: SituacaoEtapa): boolean {
  return s === 'feita' || s === 'dispensada';
}

/** A primeira etapa que ainda não foi concluída (null = tudo pronto). */
export function proximaEtapa(ex: Execucao | null, rotina: Rotina): Etapa | null {
  return rotina.etapas.find(e => !concluida(situacaoDa(ex, e.id))) || null;
}

export interface Progresso { concluidas: number; total: number; interrompida: Etapa | null }

export function progresso(ex: Execucao | null, rotina: Rotina): Progresso {
  const concluidas = rotina.etapas.filter(e => concluida(situacaoDa(ex, e.id))).length;
  const proxima = proximaEtapa(ex, rotina);
  return { concluidas, total: rotina.etapas.length, interrompida: proxima && situacaoDa(ex, proxima.id) === 'interrompida' ? proxima : null };
}

export type SituacaoGeral = 'nao-iniciada' | 'em-andamento' | 'parada' | 'concluida';

export function situacaoGeral(ex: Execucao | null, rotina: Rotina): SituacaoGeral {
  const p = progresso(ex, rotina);
  if (p.concluidas === p.total) return 'concluida';
  if (p.interrompida) return 'parada';
  return p.concluidas === 0 && !Object.keys(ex?.etapas || {}).length ? 'nao-iniciada' : 'em-andamento';
}

export const ROTULO_SITUACAO_GERAL: Record<SituacaoGeral, string> = {
  'nao-iniciada': 'Não iniciada', 'em-andamento': 'Em andamento', parada: 'Parada', concluida: 'Concluída',
};

function mudar(ex: Execucao, etapa: string, estado: EstadoEtapa): Execucao {
  return { ...ex, etapas: { ...ex.etapas, [etapa]: estado } };
}

/** A pessoa começou (ou voltou a) uma etapa. Não muda o estado; só vira evento (conta o tempo). */
export function eventoDeInicio(etapa: string, por: string, agora: Date): Evento {
  return { tipo: 'inicio', etapa, por, em: agora.toISOString() };
}

/** O "Próximo" conferiu e a etapa está feita. */
export function fazer(ex: Execucao, etapa: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  return { execucao: mudar(ex, etapa, { situacao: 'feita', por, em }), evento: { tipo: 'feita', etapa, por, em } };
}

/** "Não se aplica": conta como concluída, com o motivo. */
export function dispensar(ex: Execucao, etapa: string, objecao: string, observacao: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const obs = observacao.trim();
  return {
    execucao: mudar(ex, etapa, { situacao: 'dispensada', por, em, objecao, ...(obs ? { observacao: obs } : {}) }),
    evento: { tipo: 'dispensada', etapa, por, em, objecao, ...(obs ? { observacao: obs } : {}) },
  };
}

/** "Interromper": a etapa fica parada com o motivo, até alguém retomar. */
export function interromper(ex: Execucao, etapa: string, objecao: string, observacao: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const obs = observacao.trim();
  return {
    execucao: mudar(ex, etapa, { situacao: 'interrompida', por, em, objecao, ...(obs ? { observacao: obs } : {}) }),
    evento: { tipo: 'interrompida', etapa, por, em, objecao, ...(obs ? { observacao: obs } : {}) },
  };
}

/**
 * A pessoa clicou numa etapa já concluída no checklist: volta para ela e o check sai (a etapa fica
 * pendente de novo; as outras continuam como estão). O evento guarda como ela estava.
 */
export function voltarPara(ex: Execucao, etapa: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const antes = situacaoDa(ex, etapa);
  const etapas = { ...ex.etapas };
  delete etapas[etapa];
  return { execucao: { ...ex, etapas }, evento: { tipo: 'reaberta', etapa, por, em: agora.toISOString(), observacao: antes } };
}

/** O "Próximo" conferiu e ainda não está feita (vira evento: mostra onde as pessoas tropeçam). */
export function eventoDeVerificacaoFalhou(etapa: string, por: string, agora: Date, motivo: string): Evento {
  return { tipo: 'verificacao-falhou', etapa, por, em: agora.toISOString(), observacao: motivo };
}

/** "Não teve movimento" na linha de um banco (marcar ou desmarcar). O evento diz qual banco. */
export function marcarSemMovimento(ex: Execucao, etapa: string, banco: string, marcado: boolean, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const atuais = (ex.semMovimento || []).filter(b => b !== banco);
  return {
    execucao: { ...ex, semMovimento: marcado ? [...atuais, banco] : atuais },
    evento: { tipo: marcado ? 'sem-movimento' : 'com-movimento', etapa, por, em: agora.toISOString(), observacao: banco },
  };
}

/**
 * Vários meses: põe o mês no período prometido (ou tira, com null). O evento guarda o período (a etapa fica vazia:
 * vale para a competência inteira).
 */
export function definirPeriodo(ex: Execucao, periodo: string | null, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const sem: Execucao = { ...ex };
  delete sem.periodo;
  return {
    execucao: periodo ? { ...ex, periodo } : sem,
    evento: { tipo: periodo ? 'periodo' : 'periodo-encerrado', etapa: '', por, em: agora.toISOString(), observacao: periodo || ex.periodo || '' },
  };
}

/** Os meses do período estão todos concluídos (todas as etapas feitas ou "não se aplica")? Só aí dá para encerrar. */
export function periodoConcluido(execucoes: readonly (Execucao | null)[], rotina: Rotina): boolean {
  return execucoes.length > 0 && execucoes.every(ex => situacaoGeral(ex, rotina) === 'concluida');
}

/** Todos os bancos da empresa sem movimento? (aí a etapa dos extratos conta como "não se aplica") */
export function todosSemMovimento(ex: Execucao | null, bancos: readonly { id: string }[]): boolean {
  return bancos.length > 0 && bancos.every(b => ex?.semMovimento?.includes(b.id));
}
