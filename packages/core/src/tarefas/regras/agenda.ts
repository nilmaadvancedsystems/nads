// O Início novo das tarefas (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo… só quero o posicionamento das coisas"):
// a lista agrupada em Hoje, Amanhã e Esta semana, o prazo curto ("Hoje", "Quarta"), os dias com prazo no calendário do
// mês, os comentários novos, as notificações (o que os outros fizeram nas tarefas) e as tarefas em aberto por cliente.
// Tudo a partir das tarefas delegadas (tarefas.delegadas); só lê, não grava nada.
import { atrasada, emAberto, type ClienteVinculado, type Nota, type Pessoa, type TarefaDelegada } from './delegadas';

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

/** Um comentário (parecer) ou um movimento (do histórico) de outra pessoa, com a tarefa em que foi. */
export interface Recado extends Nota { tarefa: string; titulo: string; numero: number }

/** Os pareceres de outras pessoas nas tarefas, do mais novo para o mais velho (o cartão "Comentários novos"). */
export function comentariosNovos(lista: readonly TarefaDelegada[], meuNome: string, limite = 5): Recado[] {
  return lista.flatMap(t => t.pareceres.filter(p => p.por !== meuNome).map(p => ({ ...p, tarefa: t.id, titulo: t.titulo, numero: t.numero })))
    .sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite);
}

/** O que as outras pessoas fizeram nas tarefas (o histórico), do mais novo para o mais velho (as Notificações). */
export function notificacoes(lista: readonly TarefaDelegada[], meuNome: string, limite = 30): Recado[] {
  return lista.flatMap(t => t.historico.filter(h => h.por !== meuNome).map(h => ({ ...h, tarefa: t.id, titulo: t.titulo, numero: t.numero })))
    .sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite);
}

/** As tarefas em aberto de um cliente e as pessoas que estão nelas (o cartão "Por cliente"). */
export interface DoCliente { cliente: ClienteVinculado; quantas: number; pessoas: Pessoa[] }

/** Os clientes com tarefa em aberto, o que tem mais primeiro (a tarefa sem cliente não entra). */
export function porCliente(lista: readonly TarefaDelegada[], limite = 6): DoCliente[] {
  const mapa = new Map<string, DoCliente>();
  for (const t of lista) {
    if (!emAberto(t)) continue;
    for (const c of t.clientes) {
      const chave = String(c.codigo) + '|' + c.nome;
      const x = mapa.get(chave) || { cliente: c, quantas: 0, pessoas: [] };
      x.quantas++;
      if (!x.pessoas.some(p => p.uid === t.responsavel.uid)) x.pessoas.push(t.responsavel);
      mapa.set(chave, x);
    }
  }
  return [...mapa.values()].sort((a, b) => b.quantas - a.quantas || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR')).slice(0, limite);
}
