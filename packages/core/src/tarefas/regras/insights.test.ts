// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights).
import { describe, expect, it } from 'vitest';
import type { Execucao, Rotina } from '../tipos';
import {
  contarChamados, contarDp, contarEntregas, delegadasAtrasadas, equipeDosInsights, lerResumoDosInsights, paineisDosInsights, resumoDeExemploDosInsights,
  rotinasPorPessoa, situacaoDoClienteDp,
} from './insights';

const rotina = { departamento: 'fiscal', etapas: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }] } as unknown as Rotina;
const ex = (codigo: number, etapas: Record<string, string>): Execucao => ({
  empresa: 'E' + codigo, codigo, competencia: '2026-10', departamento: 'fiscal',
  etapas: Object.fromEntries(Object.entries(etapas).map(([k, s]) => [k, { situacao: s, por: 'x', em: '2026-11-01T10:00:00Z' }])),
} as unknown as Execucao);

describe('os números da Tela de Insights', () => {
  it('rotinas por responsável: a empresa concluída é feita, a sem execução falta; sem responsável no fim', () => {
    const r = rotinasPorPessoa(
      [{ codigo: 1, responsavel: 'Heverton' }, { codigo: 2, responsavel: 'Heverton' }, { codigo: 3, responsavel: '' }, { codigo: 4, responsavel: 'Adivania' }],
      [ex(1, { a: 'feita', b: 'dispensada' }), ex(2, { a: 'feita' }), ex(4, { a: 'feita', b: 'feita' })],
      () => rotina,
    );
    expect(r.map(({ nome, feitas, faltando }) => ({ nome, feitas, faltando }))).toEqual([{ nome: 'Heverton', feitas: 1, faltando: 1 }, { nome: 'Adivania', feitas: 1, faltando: 0 }, { nome: 'Sem responsável', feitas: 0, faltando: 1 }]);
    // a visão da pessoa: a empresa que falta primeiro, com a etapa em que está
    expect(r[0].empresas).toEqual([
      { nome: 'E2', situacao: 'em-andamento', etapa: 'B', feitas: 1, total: 2 },
      { nome: 'E1', situacao: 'concluida', etapa: '', feitas: 2, total: 2 },
    ]);
  });
  it('a tabela do DP: sem movimento, feita, atrasada e no prazo', () => {
    const base = { obrigacoes: ['folha'], reinfAutorizada: false, movimento: 'Folha' as const };
    const dp = (etapas: Record<string, string>) => ({ ...ex(1, etapas), departamento: 'dp' } as Execucao);
    expect(situacaoDoClienteDp({ ...base, movimento: 'Sem Movimento' }, null, '2026-10', new Date(2026, 10, 18))).toBe('sem');
    expect(situacaoDoClienteDp({ ...base, obrigacoes: [] }, null, '2026-10', new Date(2026, 10, 18))).toBe('sem');
    expect(situacaoDoClienteDp(base, dp({ 'dp-folha': 'feita', 'dp-envio': 'feita' }), '2026-10', new Date(2026, 10, 18))).toBe('feita');
    // a folha de outubro vence no 5º dia útil de novembro: em 18/11 está atrasada; em 01/11, no prazo
    expect(situacaoDoClienteDp(base, null, '2026-10', new Date(2026, 10, 18))).toBe('atrasada');
    expect(situacaoDoClienteDp(base, null, '2026-10', new Date(2026, 10, 1))).toBe('pendente');
    expect(contarDp(['feita', 'atrasada', 'sem', 'pendente', 'feita'])).toEqual({ feitas: 2, pendentes: 1, atrasadas: 1, sem: 1 });
  });
  it('solicitações, nota do mês, entregas e tarefas atrasadas por pessoa', () => {
    expect(contarChamados([
      { situacao: 'aberto' }, { situacao: 'em andamento' }, { situacao: 'respondido' },
      { situacao: 'concluido', avaliacao: { nota: 5, em: '2026-11-02T10:00:00Z' } }, { situacao: 'concluido', avaliacao: { nota: 4, em: '2026-11-03T10:00:00Z' } },
    ], '2026-11')).toEqual({ abertas: 2, respondidas: 1, nota: 4.5, avaliacoes: 2 });
    expect(contarEntregas([{ status: 'pendente' }, { status: 'link' }, { status: 'confirmada' }, { status: 'confirmada' }, { status: 'falha' }, { status: 'x' }]))
      .toEqual({ aEntregar: 1, noLink: 1, confirmadas: 2, falhas: 1 });
    expect(delegadasAtrasadas([
      { status: 'pendente', prazo: '2026-11-10', titulo: 'Balancete', responsavel: { nome: 'Clara' } },
      { status: 'andamento', prazo: '2026-11-17', responsavel: { nome: 'Clara' } },
      { status: 'pendente', prazo: '2026-11-17', responsavel: { nome: 'Felipe' } },
      { status: 'concluida', prazo: '2026-11-01', responsavel: { nome: 'Felipe' } },
      { status: 'pendente', prazo: '2026-12-01', responsavel: { nome: 'Felipe' } },
    ], '2026-11-18')).toEqual({ atrasadas: 3, pessoas: [
      { nome: 'Clara', atrasadas: 2, tarefas: [{ titulo: 'Balancete', prazo: '2026-11-10' }, { titulo: 'Tarefa', prazo: '2026-11-17' }] },
      { nome: 'Felipe', atrasadas: 1, tarefas: [{ titulo: 'Tarefa', prazo: '2026-11-17' }] },
    ] });
  });
  it('os seis painéis, na ordem da TV', () => {
    const p = paineisDosInsights(resumoDeExemploDosInsights(new Date(2026, 10, 18)));
    expect(p.map(x => x.id)).toEqual(['rotinas', 'dp', 'guias', 'clientes', 'entregas', 'equipe']);
    expect(p[1].subtitulo).toBe('A tabela do DP · competência outubro/2026');
    expect(p[0].linhas[0]).toEqual({ nome: 'Heverton (Fiscal)', texto: '38 concluídas · 6 faltando', tom: 'alerta' });
  });
  it('a leitura do documento: o torto vira zero; sem data, nada', () => {
    const r = resumoDeExemploDosInsights(new Date(2026, 10, 18));
    expect(lerResumoDosInsights(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(lerResumoDosInsights({ ...r, atualizadoEm: '' })).toBeNull();
    expect(lerResumoDosInsights({ atualizadoEm: 'x', dp: { atrasadas: -3 }, rotinas: [{ setor: 'outro' }] })?.dp.atrasadas).toBe(0);
  });
});

describe('a equipe em cartões', () => {
  it('o percentual de cada pessoa, o tom e as atrasadas dela; a pior primeiro', () => {
    const e = equipeDosInsights(resumoDeExemploDosInsights(new Date(2026, 10, 18)));
    expect(e[0]).toMatchObject({ nome: 'Fernando', setor: 'Contábil', feitas: 12, total: 21, pct: 57, tom: 'ruim', atrasadas: 3 });
    expect(e[0].tarefas.map(t => t.titulo)[0]).toBe('Conferir o balancete de setembro');
    expect(e[0].empresas[0]).toMatchObject({ situacao: 'parada', etapa: 'Importar o extrato' });
    expect(e.find(p => p.nome === 'Gustavo')).toMatchObject({ pct: 100, tom: 'bom' });
    expect(e.find(p => p.nome === 'Heverton')).toMatchObject({ pct: 86, tom: 'alerta' });
  });
});
