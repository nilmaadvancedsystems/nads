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

/** O "Próximo" conferiu e ainda não está feita (vira evento: mostra onde as pessoas tropeçam). */
export function eventoDeVerificacaoFalhou(etapa: string, por: string, agora: Date, motivo: string): Evento {
  return { tipo: 'verificacao-falhou', etapa, por, em: agora.toISOString(), observacao: motivo };
}
