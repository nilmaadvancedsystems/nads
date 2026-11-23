// Os dados das delegadas por pessoa (23/11/2026): os números de quem recebeu, só com o que a tarefa já guarda.
import { describe, expect, it } from 'vitest';
import { concluidaForaDoPrazo, dadosPorPessoa, inicioDoPeriodo, partesDoTitulo, type TarefaDelegada } from './delegadas';

const EU = { uid: 'eu', nome: 'Pessoa Que Delega' };
const ANA = { uid: 'a', nome: 'Ana Exemplo' };
const BIA = { uid: 'b', nome: 'Bia Exemplo' };
// segunda-feira, 16/11/2026, 10:00 em Brasília (13:00 UTC)
const AGORA = new Date('2026-11-16T13:00:00.000Z');
// os horários de Brasília em ISO (UTC−3)
const br = (diaHora: string) => new Date(diaHora + ':00.000-03:00').toISOString();

const tarefa = (x: Partial<TarefaDelegada> & Pick<TarefaDelegada, 'id' | 'responsavel'>): TarefaDelegada => ({
  numero: 1, titulo: 'Tarefa ' + x.id, descricao: '', cliente: null, clientes: [], prioridade: 'normal', prazo: '', prazoHora: '',
  status: 'pendente', criadaPor: EU, criadaEm: br('2026-11-16T08:00'), concluidaEm: '', atualizadaEm: br('2026-11-16T08:00'),
  pareceres: [], historico: [], anexos: [], ...x,
});

describe('dadosPorPessoa', () => {
  it('conta o que está em aberto agora, em andamento e atrasado', () => {
    const lista = [
      tarefa({ id: '1', responsavel: ANA, prazo: '2026-11-13' }),
      tarefa({ id: '2', responsavel: ANA, status: 'andamento', historico: [{ por: 'Ana', em: br('2026-11-16T08:30'), texto: 'Iniciou a tarefa' }] }),
      tarefa({ id: '3', responsavel: BIA, prazo: '2026-11-20' }),
    ];
    const [ana, bia] = dadosPorPessoa(lista, EU.uid, '', AGORA);
    expect(ana.pessoa.nome).toBe('Ana Exemplo');
    expect([ana.abertas, ana.emAndamento, ana.atrasadas]).toEqual([2, 1, 1]);
    expect([bia.abertas, bia.atrasadas]).toEqual([1, 0]);
  });

  it('deixa de fora as canceladas, as que eu passei para mim e as que outra pessoa delegou', () => {
    const lista = [
      tarefa({ id: '1', responsavel: ANA, status: 'cancelada' }),
      tarefa({ id: '2', responsavel: EU }),
      tarefa({ id: '3', responsavel: ANA, criadaPor: BIA }),
    ];
    expect(dadosPorPessoa(lista, EU.uid, '', AGORA)).toEqual([]);
  });

  it('mede até ver, até iniciar e até concluir só no expediente', () => {
    // passada na quinta 12/11 às 17:50, vista na sexta às 07:10
    const t = tarefa({
      id: '1', responsavel: ANA, criadaEm: br('2026-11-12T17:50'), visualizadaEm: br('2026-11-13T07:10'), status: 'concluida',
      historico: [{ por: 'Ana', em: br('2026-11-13T07:40'), texto: 'Iniciou a tarefa' }, { por: 'Ana', em: br('2026-11-13T08:40'), texto: 'Concluiu a tarefa' }],
      concluidaEm: br('2026-11-13T08:40'),
    });
    const [ana] = dadosPorPessoa([t], EU.uid, '', AGORA);
    // quinta 17:50 → 18:05 = 15 min; sexta 07:00 → 07:10 = 10 min
    expect(ana.ateVer).toBe(25);
    expect(ana.ateIniciar).toBe(55);
    expect(ana.ateConcluir).toBe(115);
    expect(ana.trabalhados).toBe(60);
    expect(ana.concluidas).toBe(1);
  });

  it('sem o caso, a média fica vazia (null), não zero', () => {
    const [ana] = dadosPorPessoa([tarefa({ id: '1', responsavel: ANA })], EU.uid, '', AGORA);
    expect([ana.ateVer, ana.ateIniciar, ana.ateConcluir]).toEqual([null, null, null]);
  });

  it('conta as cobranças e os pedidos de mais tempo do período', () => {
    const t = tarefa({
      id: '1', responsavel: ANA, pareceres: [
        { por: EU.nome, em: br('2026-11-01T09:00'), texto: 'Antiga', tipo: 'cobranca' },
        { por: EU.nome, em: br('2026-11-16T09:00'), texto: 'Como está?', tipo: 'cobranca' },
        { por: 'Ana', em: br('2026-11-16T09:01'), texto: 'Já vejo', tipo: 'adiamento', minutos: 10 },
        { por: 'Ana', em: br('2026-11-16T09:05'), texto: 'Um parecer comum' },
      ],
    });
    const [tudo] = dadosPorPessoa([t], EU.uid, '', AGORA);
    expect([tudo.cobrancas, tudo.adiamentos, tudo.minutosPedidos]).toEqual([2, 1, 10]);
    const [semana] = dadosPorPessoa([t], EU.uid, inicioDoPeriodo('7', AGORA), AGORA);
    expect(semana.cobrancas).toBe(1);
  });

  it('aponta a em aberto parada há mais tempo (não a em andamento)', () => {
    const lista = [
      tarefa({ id: '1', numero: 1, responsavel: ANA, criadaEm: br('2026-11-10T08:00') }),
      tarefa({ id: '2', numero: 2, responsavel: ANA, criadaEm: br('2026-11-02T08:00'), status: 'pausada',
        historico: [{ por: 'Ana', em: br('2026-11-03T08:00'), texto: 'Iniciou a tarefa' }, { por: 'Ana', em: br('2026-11-12T08:00'), texto: 'Pausou a tarefa' }] }),
      tarefa({ id: '3', numero: 3, responsavel: ANA, criadaEm: br('2026-11-01T08:00'), status: 'andamento' }),
    ];
    const [ana] = dadosPorPessoa(lista, EU.uid, '', AGORA);
    expect(ana.maisAntigaParada?.id).toBe('1');
  });

  it('quem tem mais em aberto vem primeiro', () => {
    const lista = [tarefa({ id: '1', responsavel: ANA }), tarefa({ id: '2', responsavel: BIA }), tarefa({ id: '3', responsavel: BIA })];
    expect(dadosPorPessoa(lista, EU.uid, '', AGORA).map(x => x.pessoa.uid)).toEqual(['b', 'a']);
  });
});

describe('concluidaForaDoPrazo', () => {
  const base = { status: 'concluida' as const, prazo: '2026-11-13', prazoHora: '' };
  it('no dia do prazo está no prazo; no dia seguinte, fora', () => {
    expect(concluidaForaDoPrazo({ ...base, concluidaEm: br('2026-11-13T22:00') })).toBe(false);
    expect(concluidaForaDoPrazo({ ...base, concluidaEm: br('2026-11-14T07:00') })).toBe(true);
  });
  it('com a hora do prazo, depois dela já é fora', () => {
    expect(concluidaForaDoPrazo({ ...base, prazoHora: '12:00', concluidaEm: br('2026-11-13T12:30') })).toBe(true);
    expect(concluidaForaDoPrazo({ ...base, prazoHora: '12:00', concluidaEm: br('2026-11-13T11:30') })).toBe(false);
  });
  it('sem prazo ou não concluída, nunca', () => {
    expect(concluidaForaDoPrazo({ ...base, prazo: '', concluidaEm: br('2026-11-20T10:00') })).toBe(false);
    expect(concluidaForaDoPrazo({ ...base, status: 'andamento', concluidaEm: '' })).toBe(false);
  });
});

describe('partesDoTitulo', () => {
  const etapaDelegada = { etapa: 'fornecedores', rota: 'x', periodo: '2026-01..2026-09', todas: true, contas: [], feitas: [] };
  const empresa = { codigo: 309, nome: 'EMPRESA EXEMPLO LTDA' };
  it('a tarefa da etapa: o nome da etapa e o período, sem a empresa', () => {
    expect(partesDoTitulo({ titulo: 'Fornecedores · 309 · EMPRESA EXEMPLO LTDA · Janeiro a Setembro/2026', etapaDelegada, clientes: [empresa] }))
      .toEqual({ titulo: 'Fornecedores', periodo: 'Janeiro a Setembro/2026' });
  });
  it('a empresa sem código também', () => {
    expect(partesDoTitulo({ titulo: 'Clientes · EMPRESA NOVA · Outubro/2026', etapaDelegada, clientes: [{ codigo: null, nome: 'EMPRESA NOVA' }] }))
      .toEqual({ titulo: 'Clientes', periodo: 'Outubro/2026' });
  });
  it('fica inteiro: tarefa comum, título fora do formato ou outra empresa no meio', () => {
    expect(partesDoTitulo({ titulo: 'Ligar · para · o cliente', clientes: [] })).toEqual({ titulo: 'Ligar · para · o cliente', periodo: '' });
    expect(partesDoTitulo({ titulo: 'Fornecedores de outubro', etapaDelegada, clientes: [empresa] }).periodo).toBe('');
    expect(partesDoTitulo({ titulo: 'Fornecedores · 12 · OUTRA LTDA · Outubro/2026', etapaDelegada, clientes: [empresa] }).periodo).toBe('');
  });
});
