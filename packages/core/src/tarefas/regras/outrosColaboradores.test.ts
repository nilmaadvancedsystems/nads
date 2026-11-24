// Outros colaboradores (24/11/2026): quem vê, de quem são as tarefas e a ordem por pessoa.
import { describe, expect, it } from 'vitest';
import { colaboradorObservado, porColaborador, veOutrosColaboradores, type TarefaDelegada } from './delegadas';

const EU = { uid: 'eu', nome: 'Pessoa Que Delega' };
const ANA = { uid: 'a', nome: 'Ana Exemplo' };
const BIA = { uid: 'b', nome: 'Bia Exemplo' };
const tarefa = (x: Partial<TarefaDelegada> & Pick<TarefaDelegada, 'id' | 'responsavel'>): TarefaDelegada => ({
  numero: 1, titulo: 'Tarefa ' + x.id, descricao: '', cliente: null, clientes: [], prioridade: 'normal', prazo: '', prazoHora: '',
  status: 'pendente', criadaPor: EU, criadaEm: '2026-11-16T11:00:00.000Z', concluidaEm: '', atualizadaEm: '2026-11-16T11:00:00.000Z',
  pareceres: [], historico: [], anexos: [], ...x,
});

describe('outros colaboradores', () => {
  it('o Sênior, o Diretor e o Dono veem; as tarefas são dos Juniores e Plenos', () => {
    expect(['senior', 'diretor', 'dono', 'pleno', 'junior', null].map(n => veOutrosColaboradores(n as 'senior'))).toEqual([true, true, true, false, false, false]);
    expect(['senior', 'diretor', 'pleno', 'junior'].map(n => colaboradorObservado(n as 'senior'))).toEqual([false, false, true, true]);
  });

  it('por pessoa: quem tem mais em aberto primeiro, com as atrasadas', () => {
    const grupos = porColaborador([
      tarefa({ id: '1', responsavel: BIA, status: 'concluida' }),
      tarefa({ id: '2', responsavel: ANA, prazo: '2026-11-10' }),
      tarefa({ id: '3', responsavel: ANA, prazo: '2026-11-30' }),
    ], '2026-11-16');
    expect(grupos.map(g => [g.pessoa.nome, g.abertas, g.atrasadas])).toEqual([['Ana Exemplo', 2, 1], ['Bia Exemplo', 0, 0]]);
    expect(grupos[0].tarefas.map(t => t.id)).toEqual(['2', '3']);
  });
});
