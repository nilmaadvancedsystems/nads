// O documento do cliente vencendo vira tarefa (plano do Acessórias, ficha M03-papeis-viram-tarefa; o dono, 22/11/2026: "pode
// fazer tudo"). A certidão, a procuração ou o alvará cadastrado em clientes.papeis deixa de ser só um aviso no celular: a 30
// dias de vencer, o robô da nuvem cria uma tarefa no Início do responsável do Contábil da empresa (sem ele, um Diretor), com o
// prazo no dia do vencimento. O id é determinístico (papel-{código}-{tipo}-{vence}): rodar de novo não cria outra. Desligado
// por padrão (Robôs › Ajustes › "Documento vencendo vira tarefa"). Só a lógica.
import { nova, type Pessoa, type TarefaDelegada } from './delegadas';

export const NOMES_DOS_PAPEIS: Record<string, string> = {
  'cnd-federal': 'CND Federal', 'cnd-estadual': 'CND Estadual', 'cnd-municipal': 'CND Municipal',
  fgts: 'CRF do FGTS', trabalhista: 'Certidão trabalhista',
  procuracao: 'Procuração eletrônica', certificado: 'Certificado digital', outro: 'Documento',
};

/** A quantos dias do vencimento a tarefa nasce. */
export const DIAS_ANTES_DA_TAREFA = 30;

/** O id da tarefa do papel (o mesmo papel e vencimento, a mesma tarefa). */
export function idDaTarefaDoPapel(codigo: number | null, tipo: string, vence: string): string {
  const t = String(tipo || 'outro').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'outro';
  return 'papel-' + (codigo ?? 'sem') + '-' + t + '-' + vence;
}

/** O papel nasce como tarefa hoje? (exatamente a 30 dias; 'aaaa-mm-dd') */
export function papelViraTarefaHoje(vence: string, hoje: string): boolean {
  const d = (s: string) => { const [a, m, dd] = s.split('-').map(Number); return a ? Date.UTC(a, m - 1, dd) : NaN; };
  const dias = Math.round((d(vence) - d(hoje)) / 864e5);
  return Number.isFinite(dias) && dias === DIAS_ANTES_DA_TAREFA;
}

/** A tarefa do papel, no formato das delegadas (criada pelo "Robô", para o responsável). */
export function tarefaDoPapel(p: { tipo: string; vence: string; observacao?: string }, cliente: { codigo: number | null; nome: string }, responsavel: Pessoa, o: { numero: number; em: string }): TarefaDelegada {
  const nome = NOMES_DOS_PAPEIS[p.tipo] || NOMES_DOS_PAPEIS.outro;
  const vence = p.vence.slice(8, 10) + '/' + p.vence.slice(5, 7) + '/' + p.vence.slice(0, 4);
  return nova({
    titulo: ('Renovar ' + nome + ' de ' + cliente.nome).slice(0, 120),
    descricao: nome + ' de ' + cliente.nome + ' vence em ' + vence + '.' + (p.observacao ? ' ' + String(p.observacao).slice(0, 200) : '') + ' (tarefa criada pelo robô a ' + DIAS_ANTES_DA_TAREFA + ' dias do vencimento)',
    clientes: [{ codigo: cliente.codigo, nome: cliente.nome }], prioridade: 'normal', prazo: p.vence, prazoHora: '', status: 'pendente', responsavel,
  }, { id: idDaTarefaDoPapel(cliente.codigo, p.tipo, p.vence), numero: o.numero, por: { uid: 'robo', nome: 'Robô' }, em: o.em });
}
