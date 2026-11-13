import { describe, expect, it } from 'vitest';
import { comentariosNovos, diasComPrazo, grupoDaAgenda, notificacoes, porCliente, prazoCurto, somarDias } from './agenda';
import type { TarefaDelegada } from './delegadas';

const NILMA = { uid: 'u1', nome: 'Nilma' };
const VITOR = { uid: 'u2', nome: 'Vitor' };
const EM = '2026-11-13T12:00:00.000Z';
// sexta-feira
const HOJE = '2026-11-13';

function tarefa(p: Partial<TarefaDelegada> = {}): TarefaDelegada {
  return {
    id: 't', numero: 1, titulo: 'Conferir o balancete', descricao: '', cliente: null, clientes: [], prazoHora: '', prioridade: 'normal', prazo: '', status: 'pendente',
    criadaPor: VITOR, responsavel: NILMA, criadaEm: EM, concluidaEm: '', atualizadaEm: EM, pareceres: [], historico: [], anexos: [], ...p,
  };
}

describe('agenda do Início novo', () => {
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('agrupa em atrasadas, hoje, amanhã, esta semana, mais adiante e sem prazo', () => {
    expect(grupoDaAgenda(tarefa({ prazo: '2026-11-12' }), HOJE)).toBe('atrasadas');
    expect(grupoDaAgenda(tarefa({ prazo: HOJE }), HOJE)).toBe('hoje');
    expect(grupoDaAgenda(tarefa({ prazo: HOJE, prazoHora: '09:00' }), HOJE, '10:00')).toBe('atrasadas');
    expect(grupoDaAgenda(tarefa({ prazo: '2026-11-14' }), HOJE)).toBe('amanha');
    expect(grupoDaAgenda(tarefa({ prazo: '2026-11-20' }), HOJE)).toBe('semana');
    expect(grupoDaAgenda(tarefa({ prazo: '2026-11-21' }), HOJE)).toBe('depois');
    expect(grupoDaAgenda(tarefa(), HOJE)).toBe('sem-prazo');
  });

  it('mostra o prazo curto', () => {
    expect(prazoCurto(HOJE, HOJE)).toBe('Hoje');
    expect(prazoCurto('2026-11-14', HOJE)).toBe('Amanhã');
    expect(prazoCurto('2026-11-12', HOJE)).toBe('Ontem');
    expect(prazoCurto('2026-11-18', HOJE)).toBe('Quarta');
    expect(prazoCurto('2026-12-25', HOJE)).toBe('25/12');
    expect(prazoCurto('', HOJE)).toBe('');
  });

  it('conta os dias com prazo em aberto no mês', () => {
    const lista = [tarefa({ prazo: '2026-11-13' }), tarefa({ prazo: '2026-11-13' }), tarefa({ prazo: '2026-11-20', status: 'concluida' }), tarefa({ prazo: '2026-12-01' })];
    expect(diasComPrazo(lista, '2026-11')).toEqual({ 13: 2 });
  });

  it('comentários e notificações só dos outros, o mais novo primeiro', () => {
    const t = tarefa({
      pareceres: [{ por: 'Vitor', em: '2026-11-12T10:00:00Z', texto: 'a' }, { por: 'Nilma', em: '2026-11-12T11:00:00Z', texto: 'b' }, { por: 'Vitor', em: '2026-11-13T10:00:00Z', texto: 'c' }],
      historico: [{ por: 'Vitor', em: '2026-11-12T09:00:00Z', texto: 'Criou a tarefa' }, { por: 'Nilma', em: '2026-11-12T12:00:00Z', texto: 'Iniciou a tarefa' }],
    });
    expect(comentariosNovos([t], 'Nilma').map(c => c.texto)).toEqual(['c', 'a']);
    expect(notificacoes([t], 'Nilma').map(n => n.texto)).toEqual(['Criou a tarefa']);
  });

  it('agrupa as tarefas em aberto por cliente, com as pessoas', () => {
    const alfa = { codigo: 14, nome: 'ALFA' }, beta = { codigo: 15, nome: 'BETA' };
    const lista = [
      tarefa({ clientes: [alfa] }), tarefa({ clientes: [alfa, beta], responsavel: VITOR }), tarefa({ clientes: [beta], status: 'concluida' }), tarefa(),
    ];
    const r = porCliente(lista);
    expect(r.map(x => [x.cliente.codigo, x.quantas])).toEqual([[14, 2], [15, 1]]);
    expect(r[0].pessoas.map(p => p.nome)).toEqual(['Nilma', 'Vitor']);
  });
});
