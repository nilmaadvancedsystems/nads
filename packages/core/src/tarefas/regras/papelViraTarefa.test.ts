import { describe, expect, it } from 'vitest';
import { idDaTarefaDoPapel, papelViraTarefaHoje, tarefaDoPapel } from './papelViraTarefa';

describe('o documento vencendo vira tarefa (M03)', () => {
  it('nasce exatamente a 30 dias', () => {
    expect(papelViraTarefaHoje('2026-12-22', '2026-11-22')).toBe(true);
    expect(papelViraTarefaHoje('2026-12-21', '2026-11-22')).toBe(false);
    expect(papelViraTarefaHoje('2026-12-23', '2026-11-22')).toBe(false);
  });
  it('o id é o mesmo para o mesmo papel e vencimento', () => {
    expect(idDaTarefaDoPapel(292, 'cnd-federal', '2026-12-22')).toBe('papel-292-cnd-federal-2026-12-22');
    expect(idDaTarefaDoPapel(null, '', '2026-12-22')).toBe('papel-sem-outro-2026-12-22');
  });
  it('a tarefa: para o responsável, com o prazo no vencimento e a empresa vinculada', () => {
    const t = tarefaDoPapel({ tipo: 'cnd-federal', vence: '2026-12-22' }, { codigo: 292, nome: 'PADARIA BOA' }, { uid: 'u1', nome: 'Clara' }, { numero: 41, em: '2026-11-22T11:00:00.000Z' });
    expect([t.id, t.numero, t.titulo, t.prazo, t.status, t.responsavel.nome, t.criadaPor.nome]).toEqual(['papel-292-cnd-federal-2026-12-22', 41, 'Renovar CND Federal de PADARIA BOA', '2026-12-22', 'pendente', 'Clara', 'Robô']);
    expect(t.clientes).toEqual([{ codigo: 292, nome: 'PADARIA BOA' }]);
    expect(t.descricao).toContain('22/12/2026');
  });
});
