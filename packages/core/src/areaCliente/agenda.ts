// A agenda do mês na Área do Cliente (Vitor, 16/10/2026): o que o escritório faz e quando vence, só das obrigações da
// tabela de vencimentos (vencimentos.ts). O robô grava em areasCliente/{token}/agenda/{AAAA-MM}. Daqui não sai nada da
// rotina interna: nem o id da etapa, nem quem fez, nem observação, nem objeção.
import { etapaNoMes, execucaoNova } from '../tarefas/regras/execucao';
import type { Execucao, Rotina } from '../tarefas/tipos';
import { vencimentoDaEtapa, vencimentoNaCompetencia } from './vencimentos';

export type SituacaoDoItem = 'feito' | 'a fazer' | 'nao se aplica';

export interface ItemDaAgenda {
  /** o id da tabela de vencimentos (não é o da etapa) */
  id: string;
  /** o nome para o cliente */
  nome: string;
  /** 'aaaa-mm-dd' */
  vence: string;
  situacao: SituacaoDoItem;
  /** ISO: quando o escritório terminou (só no feito) */
  feitoEm?: string;
}

export interface AgendaDoMes {
  /** 'aaaa-mm' do mês em que os itens VENCEM (é o que o cliente procura: "o que vence em outubro"); o robô monta com a competência anterior */
  mes: string;
  itens: ItemDaAgenda[];
}

/**
 * A agenda de UMA rotina (fiscal, dp…) numa competência. Etapa fora da tabela não aparece; etapa que não entra no mês
 * (regime, mês do ano, obrigação que a empresa não tem) também não. Sem execução ainda, tudo "a fazer".
 * 'feita' → feito; 'pendente' e 'interrompida' → a fazer (o cliente não precisa saber que parou); 'dispensada' → não se aplica.
 */
export function agendaDaExecucao(execucao: Execucao | null, rotina: Rotina, empresa: { nome: string; codigo: number | null }, competencia: string): ItemDaAgenda[] {
  const ex = execucao ?? execucaoNova(empresa.nome, empresa.codigo, competencia, rotina.departamento);
  const itens: ItemDaAgenda[] = [];
  for (const etapa of rotina.etapas) {
    const linha = vencimentoDaEtapa(etapa.id);
    if (!linha || !etapaNoMes(ex, etapa.id)) continue;
    const vence = vencimentoNaCompetencia(linha, competencia);
    if (!vence) continue;
    const estado = ex.etapas[etapa.id];
    const situacao: SituacaoDoItem = estado?.situacao === 'feita' ? 'feito' : estado?.situacao === 'dispensada' ? 'nao se aplica' : 'a fazer';
    itens.push({ id: linha.id, nome: linha.nome, vence, situacao, ...(situacao === 'feito' && estado?.em ? { feitoEm: estado.em } : {}) });
  }
  return itens;
}

/** A competência que vence no mês: 'aaaa-mm' do mês anterior (a agenda de outubro é a competência de setembro). */
export function competenciaDoMesDeVencimento(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Junta as agendas dos departamentos num mês só: a mais próxima primeiro. */
export function agendaDoMes(mes: string, ...listas: ItemDaAgenda[][]): AgendaDoMes {
  const itens = listas.flat().sort((a, b) => a.vence.localeCompare(b.vence) || a.nome.localeCompare(b.nome));
  return { mes, itens };
}

/** O que ainda falta fazer (a fazer), na ordem do vencimento. */
export function pendenciasDaAgenda(itens: ItemDaAgenda[]): ItemDaAgenda[] {
  return itens.filter(i => i.situacao === 'a fazer');
}

/** 'aaaa-mm-dd' → 'dd/mm/aaaa'. */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
}
