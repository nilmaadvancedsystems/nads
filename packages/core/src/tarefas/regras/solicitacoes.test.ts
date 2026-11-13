import { describe, expect, it } from 'vitest';
import { decidir, ordenarSolicitacoes, papelNasSolicitacoes, problemaDaSolicitacao, type SolicitacaoDeReuniao } from './solicitacoes';

const EM = '2026-11-13T12:00:00.000Z';
const pedido = (p: Partial<SolicitacaoDeReuniao> = {}): SolicitacaoDeReuniao => ({
  id: 's', titulo: 'Fechamento', texto: 'A pauta', quando: '2026-11-20T09:00', por: 'Fernando', porUid: 'u1', em: EM, situacao: 'pendente', ...p,
});

describe('solicitações de reunião', () => {
  it('o Sênior pede, o Diretor e o Dono aprovam, os outros nada', () => {
    expect(papelNasSolicitacoes('senior')).toBe('pede');
    expect(papelNasSolicitacoes('diretor')).toBe('aprova');
    expect(papelNasSolicitacoes('dono')).toBe('aprova');
    expect(papelNasSolicitacoes('pleno')).toBe('nenhum');
    expect(papelNasSolicitacoes(null)).toBe('nenhum');
  });

  it('pede o título, a pauta, o dia e a hora', () => {
    expect(problemaDaSolicitacao({ titulo: '', texto: 'x', quando: '2026-11-20T09:00' })).toMatch(/título/);
    expect(problemaDaSolicitacao({ titulo: 'R', texto: 'x', quando: '2026-11-20' })).toMatch(/dia e a hora/);
    expect(problemaDaSolicitacao({ titulo: 'R', texto: '', quando: '2026-11-20T09:00' })).toBe('Escreva o aviso.');
    expect(problemaDaSolicitacao({ titulo: 'R', texto: 'x', quando: '2026-11-20T09:00', link: 'ftp://a' })).toMatch(/https/);
    expect(problemaDaSolicitacao({ titulo: 'R', texto: 'x', quando: '2026-11-20T09:00' })).toBe('');
  });

  it('decide com quem, quando e a observação (sem observação, sem o campo)', () => {
    expect(decidir(pedido(), true, '  Ok, na sala 2 ', 'Nilma', EM)).toMatchObject({ situacao: 'aprovada', decididoPor: 'Nilma', decididoEm: EM, observacao: 'Ok, na sala 2' });
    expect('observacao' in decidir(pedido(), false, ' ', 'Nilma', EM)).toBe(false);
  });

  it('as pendentes em cima, a mais nova primeiro', () => {
    const l = [pedido({ id: 'a', situacao: 'aprovada', em: '2026-11-13T10:00:00Z' }), pedido({ id: 'b', em: '2026-11-12T10:00:00Z' }), pedido({ id: 'c', em: '2026-11-13T09:00:00Z' })];
    expect(ordenarSolicitacoes(l).map(s => s.id)).toEqual(['c', 'b', 'a']);
  });
});
