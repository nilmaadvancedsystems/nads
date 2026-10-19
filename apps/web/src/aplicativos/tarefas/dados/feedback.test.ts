import { describe, expect, it } from 'vitest';
import { criarFeedbackMemoria, ehPrioridade, ordenarPorPrioridade, type Feedback } from './feedback';

describe('a prioridade do feedback do app (Vitor, 19/10/2026)', () => {
  it('só baixa, media e alta', () => {
    expect(['baixa', 'media', 'alta'].every(ehPrioridade)).toBe(true);
    expect(ehPrioridade('urgente')).toBe(false);
    expect(ehPrioridade(undefined)).toBe(false);
  });

  it('ordena Alta, Média, os antigos sem prioridade, Baixa; na mesma, o mais novo em cima', () => {
    const f = (id: string, prioridade: Feedback['prioridade'], criadoEm: string) => ({ id, prioridade, criadoEm });
    const lista = [
      f('baixa', 'baixa', '2026-10-19T10:00:00Z'),
      f('antigo', null, '2026-10-01T10:00:00Z'),
      f('media', 'media', '2026-10-10T10:00:00Z'),
      f('alta-velha', 'alta', '2026-10-02T10:00:00Z'),
      f('alta-nova', 'alta', '2026-10-18T10:00:00Z'),
    ];
    expect(ordenarPorPrioridade(lista).map(x => x.id)).toEqual(['alta-nova', 'alta-velha', 'media', 'antigo', 'baixa']);
  });

  it('o exemplo guarda a prioridade de quem manda', async () => {
    const r = criarFeedbackMemoria(() => 'Vitor');
    await r.enviar({ texto: 'Lembrar o filtro', imagem: '', tela: '/tarefas/cadastro/empresas', versao: '1', prioridade: 'alta' });
    expect(r.todos().lista[0]).toMatchObject({ nome: 'Vitor', prioridade: 'alta', status: 'novo', texto: 'Lembrar o filtro' });
  });
});
