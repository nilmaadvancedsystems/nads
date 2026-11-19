// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights).
import { describe, expect, it } from 'vitest';
import * as ins from './insights';
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

// ------------------- a equipe pelo tabelão do setor (19/11/2026: "dp e fiscal sao tabelao nao rotina") -------------------
describe('a equipe pelos usuários e pelo tabelão do setor', () => {
  it('o setor do usuário: o departamento, senão o office boy; desativado e admin sem departamento ficam de fora', () => {
    expect(ins.setorDoUsuario({ nome: 'Savio', departamento: 'dp' })).toBe('dp');
    expect(ins.setorDoUsuario({ nome: 'Gustavo', roles: ['staff', 'office_boy'] })).toBe('office-boy');
    expect(ins.setorDoUsuario({ nome: 'Ana', departamento: 'fiscal', ativo: false })).toBeNull();
    expect(ins.setorDoUsuario({ nome: 'Gustavo.S', roles: ['admin'] })).toBeNull();
  });
  it('o nome do cartão e a chave do nome batem o cadastro com o usuário', () => {
    expect(ins.nomeDoCartao('savio')).toBe('Savio');
    expect(ins.chaveDoNome('HEVERTON')).toBe(ins.chaveDoNome('heverton.silva'));
    expect(ins.chaveDoNome('Adivânia')).toBe('adivania');
  });
  it('o Fiscal pelo tabelão: entregue conta como feita, preenchida em andamento, em branco não iniciada', () => {
    const p = ins.fiscalPorPessoa([{ codigo: 1, responsavel: 'HEVERTON', nome: 'A' }, { codigo: 2, responsavel: 'HEVERTON', nome: 'B' }, { codigo: 3, responsavel: 'HEVERTON', nome: 'C' }],
      c => (c === 1 ? 'entregue' : c === 2 ? 'comecada' : 'branco'));
    expect(p.map(x => [x.nome, x.feitas, x.faltando])).toEqual([['HEVERTON', 1, 2]]);
    expect(p[0].empresas!.map(e => [e.nome, e.situacao, e.total])).toEqual([['B', 'em-andamento', 0], ['C', 'nao-iniciada', 0], ['A', 'concluida', 0]]);
  });
  it('as empresas pelo responsável, como em Empresas por responsável: ficha pelo código ou pelo nome, planilha no Fiscal, só quem é do setor', () => {
    const equipe = [{ nome: 'Heverton', setor: 'fiscal' as const }, { nome: 'Vitor', setor: 'contabil' as const }, { nome: 'Savio', setor: 'dp' as const }];
    const porCodigo = new Map([[999001, { nome: 'NOVA LTDA', regime: 'Simples', responsaveis: { fiscal: 'Heverton', contabil: 'vitor' } }], [999002, { nome: 'MEI X', regime: 'MEI' }]]);
    // a 10 (DORNAS HAVANA) tem a ficha sem o código (achada pelo nome) e o Savio (do DP) escolhido no Fiscal: vale a planilha
    const porSlug = new Map([['dornas-havana-ltda', { responsaveis: { fiscal: 'Savio', contabil: 'Vitor' } }]]);
    const l = ins.empresasDoInsight(porCodigo, porSlug, equipe);
    const de = (c: number) => l.find(e => e.codigo === c);
    expect(de(999001)).toEqual({ codigo: 999001, nome: 'NOVA LTDA', regime: 'Simples', fiscal: 'Heverton', contabil: 'Vitor' });
    expect(de(10)?.fiscal).toBe('Heverton');
    expect(de(10)?.contabil).toBe('Vitor');
    const t = ins.empresasDoTabelaoFiscal(l);
    expect(t.some(e => e.codigo === 999002)).toBe(false);
    expect(t.filter(e => e.responsavel === 'Heverton').length).toBeGreaterThan(5);
  });
  it('com o time, todo mundo aparece, contado pelo setor', () => {
    const r = ins.resumoDeExemploDosInsights(new Date(2026, 10, 19));
    r.time = [{ nome: 'savio', setor: 'dp' }, { nome: 'Felipe', setor: 'contabil' }, { nome: 'gustavo', setor: 'office-boy' }, { nome: 'heverton', setor: 'fiscal' }, { nome: 'Novato', setor: 'contabil' }];
    const e = ins.equipeDosInsights(r);
    const por = Object.fromEntries(e.map(p => [p.nome, p]));
    expect(Object.keys(por).sort()).toEqual(['Felipe', 'Gustavo', 'Heverton', 'Novato', 'Savio']);
    expect([por.Savio.setor, por.Savio.feitas, por.Savio.total, por.Savio.conta]).toEqual(['DP', 96, 96 + 18 + 3, 'clientes do DP fechados']);
    expect([por.Gustavo.setor, por.Gustavo.feitas, por.Gustavo.total]).toEqual(['Office boy', 132, 132 + 14 + 6]);
    r.entregas.protocoladas = 160;
    expect(ins.equipeDosInsights(r).find(p => p.nome === 'Gustavo')?.total).toBe(160);
    expect([por.Heverton.setor, por.Heverton.feitas, por.Heverton.total]).toEqual(['Fiscal', 38, 44]);
    expect([por.Felipe.feitas, por.Felipe.total]).toEqual([15, 19]);
    expect([por.Novato.total, por.Novato.pct]).toEqual([0, 100]);
  });
  it('dois com o mesmo primeiro nome: o cartão leva o nome inteiro e cada um conta pelo seu setor', () => {
    const r = ins.resumoDeExemploDosInsights(new Date(2026, 10, 19));
    r.rotinas[0].pessoas.push({ nome: 'Gustavo', feitas: 5, faltando: 5, empresas: [] });
    r.time = [{ nome: 'Gustavo', setor: 'fiscal' }, { nome: 'Gustavo.S', setor: 'office-boy' }];
    const e = ins.equipeDosInsights(r).map(p => [p.nome, p.setor]);
    expect(e).toContainEqual(['Gustavo', 'Fiscal']);
    expect(e).toContainEqual(['Gustavo.S', 'Office boy']);
    const l = ins.empresasDoInsight(new Map(), new Map(), [{ nome: 'Gustavo.S', setor: 'office-boy' }, { nome: 'Gustavo', setor: 'fiscal' }]);
    expect(l.find(x => x.codigo === 51)?.fiscal).toBe('Gustavo');
  });
  it('a leitura guarda o time e joga fora o setor torto', () => {
    const r = ins.lerResumoDosInsights({ atualizadoEm: '2026-11-19T10:00:00Z', time: [{ nome: 'Savio', setor: 'dp' }, { nome: 'X', setor: 'chefe' }] });
    expect(r?.time).toEqual([{ nome: 'Savio', setor: 'dp' }]);
    expect(ins.lerResumoDosInsights({ atualizadoEm: '2026-11-19T10:00:00Z' })?.time).toBeUndefined();
  });
});
