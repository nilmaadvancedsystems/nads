// O Início novo das tarefas (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo… só quero o posicionamento das coisas"):
// a lista agrupada em Hoje, Amanhã e Esta semana, o prazo curto ("Hoje", "Quarta") e os dias com prazo no calendário do
// mês. Tudo a partir das tarefas delegadas (tarefas.delegadas); só lê, não grava nada.
import { atrasada, emAberto, type TarefaDelegada } from './delegadas';

type ComPrazo = Pick<TarefaDelegada, 'status' | 'prazo'> & { prazoHora?: string };

/** 'aaaa-mm-dd' + n dias (ao meio-dia UTC, para o fuso não pular o dia). */
export function somarDias(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

const DIAS_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaDaSemana = (iso: string) => new Date(Date.parse(iso + 'T12:00:00Z')).getUTCDay();

export type GrupoDaAgenda = 'atrasadas' | 'hoje' | 'amanha' | 'semana' | 'depois' | 'sem-prazo';

/** Os grupos da lista do Início novo, na ordem em que aparecem (o print: Today, Tomorrow, This week). */
export const GRUPOS_DA_AGENDA: readonly { valor: GrupoDaAgenda; rotulo: string }[] = [
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'amanha', rotulo: 'Amanhã' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'depois', rotulo: 'Mais adiante' },
  { valor: 'sem-prazo', rotulo: 'Sem prazo' },
];

/** Em que grupo a tarefa cai pelo prazo: "Esta semana" são os 7 dias depois de amanhã. */
export function grupoDaAgenda(t: ComPrazo, hoje: string, agora = ''): GrupoDaAgenda {
  if (!t.prazo) return 'sem-prazo';
  if (atrasada(t, hoje, agora)) return 'atrasadas';
  if (t.prazo <= hoje) return 'hoje';
  if (t.prazo === somarDias(hoje, 1)) return 'amanha';
  return t.prazo <= somarDias(hoje, 7) ? 'semana' : 'depois';
}

/** O prazo curto da lista: "Hoje", "Amanhã", "Ontem", o dia da semana nos próximos 7 dias e, fora disso, 'dd/mm'. */
export function prazoCurto(prazo: string, hoje: string): string {
  if (!prazo) return '';
  if (prazo === hoje) return 'Hoje';
  if (prazo === somarDias(hoje, 1)) return 'Amanhã';
  if (prazo === somarDias(hoje, -1)) return 'Ontem';
  if (prazo > hoje && prazo <= somarDias(hoje, 7)) return DIAS_DA_SEMANA[diaDaSemana(prazo)];
  return prazo.slice(8, 10) + '/' + prazo.slice(5, 7);
}

/** Os dias do mês ('aaaa-mm') com prazo de tarefa em aberto: o dia (1 a 31) → quantas. */
export function diasComPrazo(lista: readonly ComPrazo[], mes: string): Record<number, number> {
  const dias: Record<number, number> = {};
  for (const t of lista) {
    if (!emAberto(t) || !t.prazo.startsWith(mes + '-')) continue;
    const dia = Number(t.prazo.slice(8, 10));
    dias[dia] = (dias[dia] || 0) + 1;
  }
  return dias;
}
