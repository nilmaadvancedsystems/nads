import { describe, expect, it } from 'vitest';
import type { ArquivoImportado } from '../extratudo/extrator/tipos';
import {
  competenciasRecentes, concluida, criarRepoTarefasMemoria, dispensar, execucaoNova, fazer, idDaExecucao, interromper,
  objecoesMaisComuns, progresso, proximaEtapa, quandoFoi, resumoPorEtapa, ROTINA_CONTABIL, rotuloCompetencia, situacaoGeral, ultimaVez, verificar, execucoesVariadas, marcarSemMovimento, todosSemMovimento, voltarPara, rotuloCurtoCompetencia, competenciasDoPeriodo, rotaDoPeriodo, rotuloDoPeriodo, definirPeriodo, periodoConcluido,
} from '.';

const R = ROTINA_CONTABIL;
const agora = new Date('2026-09-29T12:00:00Z');
const etapa = (id: string) => R.etapas.find(e => e.id === id)!;
const arq = (lado: 'banco' | 'sistema', data: string): ArquivoImportado => ({
  id: lado + data, lado, nome: 'x', importadoEm: agora.toISOString(), modo: 'primeira', lancamentos: [{ data, valor: 100, historico: 'PIX' }],
});

describe('rotina do Contábil', () => {
  it('etapas com ids únicos, cada uma com objeções (a Conferência fiscal não tem: sem o Fiscal fechado, nem abre)', () => {
    const ids = R.etapas.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of R.etapas) {
      if (e.id !== 'fiscal') expect(e.objecoes.length).toBeGreaterThan(0);
      expect(new Set(e.objecoes.map(o => o.id)).size).toBe(e.objecoes.length);
    }
    expect(ids[0]).toBe('extratos');
  });
});

describe('andamento', () => {
  it('fazer, dispensar e interromper; a próxima é a primeira não concluída', () => {
    let ex = execucaoNova('FITO', 292, '2026-08', 'contabil');
    expect(situacaoGeral(ex, R)).toBe('nao-iniciada');
    expect(proximaEtapa(ex, R)?.id).toBe('extratos');
    const f = fazer(ex, 'extratos', 'Clara', agora);
    expect(f.evento).toEqual({ tipo: 'feita', etapa: 'extratos', por: 'Clara', em: agora.toISOString() });
    ex = f.execucao;
    expect(proximaEtapa(ex, R)?.id).toBe('cheque-especial');
    ex = fazer(ex, 'cheque-especial', 'Clara', agora).execucao;
    expect(proximaEtapa(ex, R)?.id).toBe('fiscal');
    ex = fazer(ex, 'fiscal', 'Clara', agora).execucao;
    expect(proximaEtapa(ex, R)?.id).toBe('dp');
    ex = interromper(ex, 'dp', 'outro', '  aguardando  ', 'Clara', agora).execucao;
    expect(ex.etapas.dp).toMatchObject({ situacao: 'interrompida', objecao: 'outro', observacao: 'aguardando' });
    expect(situacaoGeral(ex, R)).toBe('parada');
    expect(progresso(ex, R)).toMatchObject({ concluidas: 3, total: R.etapas.filter(e => !e.soQuandoAdicionada).length, interrompida: etapa('dp') });
    ex = dispensar(ex, 'dp', 'sem-funcionarios', '', 'Clara', agora).execucao;
    expect(concluida(ex.etapas.dp.situacao)).toBe(true);
    expect(situacaoGeral(ex, R)).toBe('em-andamento');
    for (const e of R.etapas) ex = fazer(ex, e.id, 'Clara', agora).execucao;
    expect(situacaoGeral(ex, R)).toBe('concluida');
    expect(proximaEtapa(ex, R)).toBeNull();
  });
});

describe('vários meses: o período prometido', () => {
  it('põe e tira o período do mês; só encerra com todos os meses concluídos', () => {
    let ex = execucaoNova('FITO', 292, '2026-06', 'contabil');
    const p = definirPeriodo(ex, '2026-06..2026-08', 'Vitor', agora);
    expect(p.execucao.periodo).toBe('2026-06..2026-08');
    expect(p.evento).toMatchObject({ tipo: 'periodo', observacao: '2026-06..2026-08' });
    const tira = definirPeriodo(p.execucao, null, 'Vitor', agora);
    expect(tira.execucao.periodo).toBeUndefined();
    expect(tira.evento.tipo).toBe('periodo-encerrado');
    expect(periodoConcluido([ex], R)).toBe(false);
    for (const e of R.etapas) ex = fazer(ex, e.id, 'Vitor', agora).execucao;
    expect(periodoConcluido([ex, ex], R)).toBe(true);
    expect(periodoConcluido([ex, execucaoNova('FITO', 292, '2026-07', 'contabil')], R)).toBe(false);
  });
});

describe('etapa com vários meses: o período na rota', () => {
  it('um mês, vários, virada de ano, invertido e inválido', () => {
    expect(competenciasDoPeriodo('2026-08')).toEqual(['2026-08']);
    expect(competenciasDoPeriodo('2026-06..2026-08')).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(competenciasDoPeriodo('2025-11..2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(competenciasDoPeriodo('2026-08..2026-06')).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(competenciasDoPeriodo('2026-13')).toEqual([]);
    expect(competenciasDoPeriodo('2020-01..2026-01')).toHaveLength(24);
    expect(rotaDoPeriodo('2026-08', '2026-06')).toBe('2026-06..2026-08');
    expect(rotaDoPeriodo('2026-08', '2026-08')).toBe('2026-08');
    expect(rotuloDoPeriodo(['2026-06', '2026-07', '2026-08'])).toBe('Junho a Agosto/2026');
    expect(rotuloDoPeriodo(['2025-12', '2026-01'])).toBe('Dezembro/2025 a Janeiro/2026');
    expect(rotuloDoPeriodo(['2026-08'])).toBe('Agosto/2026');
  });
});

describe('rótulo curto da competência', () => {
  it('"ago 2026"', () => {
    expect(rotuloCurtoCompetencia('2026-08')).toBe('ago 2026');
    expect(rotuloCurtoCompetencia('2026-03')).toBe('mar 2026');
  });
});

describe('voltar para uma etapa (clique no checklist)', () => {
  it('tira o check só dela, e ela vira a da vez', () => {
    let ex = execucaoNova('FITO', 292, '2026-08', 'contabil');
    ex = fazer(ex, 'extratos', 'Clara', agora).execucao;
    ex = dispensar(ex, 'fiscal', 'outro', '', 'Clara', agora).execucao;
    expect(proximaEtapa(ex, R)?.id).toBe('cheque-especial');
    const v = voltarPara(ex, 'extratos', 'Vitor', agora);
    expect(v.execucao.etapas.extratos).toBeUndefined();
    expect(v.execucao.etapas.fiscal.situacao).toBe('dispensada');
    expect(proximaEtapa(v.execucao, R)?.id).toBe('extratos');
    expect(v.evento).toEqual({ tipo: 'reaberta', etapa: 'extratos', por: 'Vitor', em: agora.toISOString(), observacao: 'feita' });
    expect(ex.etapas.extratos.situacao).toBe('feita');
  });
});

describe('check automático', () => {
  it('só extrato: precisa de extrato do banco com lançamento na competência', () => {
    const soExtrato = { ...etapa('extratos'), verificacao: 'extratos' as const };
    expect(verificar(soExtrato, '2026-08', [])).toEqual({ ok: false, motivo: 'Ainda não há extrato de agosto/2026 importado.' });
    expect(verificar(soExtrato, '2026-08', [arq('banco', '2026-07-31')]).ok).toBe(false);
    expect(verificar(soExtrato, '2026-08', [arq('banco', '2026-08-05')]).ok).toBe(true);
    expect(verificar(soExtrato, '2026-08', [arq('sistema', '2026-08-05')]).ok).toBe(false);
  });
  it('importar e conferir: precisa de extrato e razão do sistema', () => {
    expect(verificar(etapa('extratos'), '2026-08', []).motivo).toBe('Falta o extrato de agosto/2026.');
    expect(verificar(etapa('extratos'), '2026-08', [arq('banco', '2026-08-05')]).motivo).toBe('Falta importar o razão do sistema de agosto/2026.');
    expect(verificar(etapa('extratos'), '2026-08', [arq('banco', '2026-08-05'), arq('sistema', '2026-08-20')]).ok).toBe(true);
  });
  it('manual: passa', () => {
    expect(verificar(etapa('fechamento'), '2026-08', []).ok).toBe(true);
  });
});

describe('competências e visão de cima', () => {
  it('começa no mês passado', () => {
    expect(competenciasRecentes(agora, 3)).toEqual(['2026-08', '2026-07', '2026-06']);
    expect(competenciasRecentes(new Date('2026-01-10T12:00:00'), 1)).toEqual(['2025-12']);
    expect(rotuloCompetencia('2026-08')).toBe('Agosto/2026');
  });
  it('resumo por etapa e objeções mais comuns', () => {
    const repo = criarRepoTarefasMemoria({ agora, guarda: null });
    const exs = repo.execucoes('2026-08', 'contabil');
    expect(exs).toHaveLength(2);
    const r = resumoPorEtapa(exs, R, 3);
    expect(r[0]).toMatchObject({ etapa: 'extratos', feitas: 2, pendentes: 1 });
    expect(r[2]).toMatchObject({ etapa: 'fiscal', feitas: 1, interrompidas: 1, pendentes: 1 });
    expect(r[3]).toMatchObject({ etapa: 'dp', dispensadas: 1, pendentes: 2 });
    expect(objecoesMaisComuns(exs, R).map(o => [o.texto, o.qtd])).toEqual([
      ['A empresa não tem funcionários', 1], ['Outro motivo', 1],
    ]);
  });
  it('repositório em memória grava a execução e o evento', () => {
    const repo = criarRepoTarefasMemoria({ agora, guarda: null });
    const ex = execucaoNova('EXEMPLO', 903, '2026-08', 'contabil');
    const f = fazer(ex, 'extratos', 'Vitor', agora);
    repo.gravar(f.execucao, f.evento);
    expect(repo.execucoes('2026-08', 'contabil')).toHaveLength(3);
    expect(idDaExecucao('Fito Indústria', '2026-08', 'contabil')).toBe('fito-industria_2026-08_contabil');
  });
});

describe('quando foi (última vez que mexeram)', () => {
  const agoraLocal = new Date(2026, 8, 29, 15, 0);
  const antes = (ms: number) => new Date(agoraLocal.getTime() - ms).toISOString();
  it('minutos, horas, ontem, dias e data', () => {
    expect(quandoFoi(antes(20 * 1000), agoraLocal)).toBe('agora');
    expect(quandoFoi(antes(5 * 60000), agoraLocal)).toBe('há 5 min');
    expect(quandoFoi(antes(60 * 60000), agoraLocal)).toBe('há 1 hora');
    expect(quandoFoi(antes(5 * 3600000), agoraLocal)).toBe('há 5 horas');
    expect(quandoFoi(new Date(2026, 8, 28, 23, 0).toISOString(), agoraLocal)).toBe('ontem');
    expect(quandoFoi(new Date(2026, 8, 26, 10, 0).toISOString(), agoraLocal)).toBe('há 3 dias');
    expect(quandoFoi(new Date(2026, 6, 1, 10, 0).toISOString(), agoraLocal)).toBe('01/07/2026');
  });
  it('a última data entre as etapas, de qualquer pessoa', () => {
    expect(ultimaVez(null)).toBeNull();
    expect(ultimaVez({ etapas: { a: { em: '2026-09-01T10:00:00Z' }, b: { em: '2026-09-03T10:00:00Z' } } })).toBe('2026-09-03T10:00:00Z');
  });
});

describe('exemplos variados (só no modo exemplos)', () => {
  it('o mês passado tem concluídas, em andamento, paradas e não iniciadas', () => {
    const lista = Array.from({ length: 50 }, (_, i) => ({ codigo: i + 1, nome: 'EMPRESA ' + (i + 1), regime: 'Simples' }));
    const exs = execucoesVariadas(lista, agora);
    const doMes = exs.filter(e => e.competencia === '2026-08');
    const porEmpresa = new Map(doMes.map(e => [e.empresa, e]));
    const situacoes = lista.map(emp => situacaoGeral(porEmpresa.get(emp.nome) || null, R));
    for (const s of ['concluida', 'em-andamento', 'parada', 'nao-iniciada'] as const) expect(situacoes).toContain(s);
    expect(exs.some(e => e.competencia === '2026-07')).toBe(true);
    const repo = criarRepoTarefasMemoria({ agora, guarda: null, empresas: lista });
    expect(repo.listarEmpresas()).toHaveLength(50);
    expect(repo.execucoes('2026-08', 'contabil').length).toBe(doMes.length);
  });
});

describe('não teve movimento (por banco)', () => {
  it('marca e desmarca; todos os bancos sem movimento', () => {
    const bancos = [{ id: 'sicoob' }, { id: 'itau' }];
    let ex = execucaoNova('FITO', 292, '2026-08', 'contabil');
    const m = marcarSemMovimento(ex, 'extratos', 'sicoob', true, 'Clara', agora);
    expect(m.evento).toMatchObject({ tipo: 'sem-movimento', etapa: 'extratos', observacao: 'sicoob' });
    ex = m.execucao;
    expect(todosSemMovimento(ex, bancos)).toBe(false);
    ex = marcarSemMovimento(ex, 'extratos', 'itau', true, 'Clara', agora).execucao;
    expect(todosSemMovimento(ex, bancos)).toBe(true);
    ex = marcarSemMovimento(ex, 'extratos', 'sicoob', false, 'Clara', agora).execucao;
    expect(ex.semMovimento).toEqual(['itau']);
    expect(todosSemMovimento(null, bancos)).toBe(false);
  });
});

describe('check por banco', () => {
  const contas = (semMovimento: string[] = []) => ({ bancos: [{ id: 'sicoob', nome: 'Sicoob' }, { id: 'itau', nome: 'Itaú' }], semMovimento });
  const doBanco = (lado: 'banco' | 'sistema', banco?: string) => ({ ...arq(lado, '2026-08-05'), id: lado + (banco || ''), ...(banco ? { banco } : {}) });
  it('cada banco precisa de extrato e razão; arquivo sem banco é do primeiro', () => {
    expect(verificar(etapa('extratos'), '2026-08', [doBanco('banco'), doBanco('sistema')], contas()).motivo).toBe('Falta o extrato do Itaú de agosto/2026.');
    expect(verificar(etapa('extratos'), '2026-08', [doBanco('banco'), doBanco('sistema'), doBanco('banco', 'itau')], contas()).motivo).toBe('Falta o razão do Itaú de agosto/2026.');
    expect(verificar(etapa('extratos'), '2026-08', [doBanco('banco'), doBanco('sistema')], contas(['itau'])).ok).toBe(true);
  });
});
