import { describe, expect, it } from 'vitest';
import type { ArquivoImportado } from '../extratudo/extrator/tipos';
import {
  competenciasRecentes, concluida, criarRepoTarefasMemoria, dispensar, execucaoNova, fazer, idDaExecucao, interromper,
  objecoesMaisComuns, progresso, proximaEtapa, quandoFoi, resumoPorEtapa, ROTINA_CONTABIL, rotuloCompetencia, situacaoGeral, ultimaVez, verificar,
} from '.';

const R = ROTINA_CONTABIL;
const agora = new Date('2026-09-29T12:00:00Z');
const etapa = (id: string) => R.etapas.find(e => e.id === id)!;
const arq = (lado: 'banco' | 'sistema', data: string): ArquivoImportado => ({
  id: lado + data, lado, nome: 'x', importadoEm: agora.toISOString(), modo: 'primeira', lancamentos: [{ data, valor: 100, historico: 'PIX' }],
});

describe('rotina do Contábil', () => {
  it('etapas com ids únicos, cada uma com objeções', () => {
    const ids = R.etapas.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of R.etapas) {
      expect(e.objecoes.length).toBeGreaterThan(0);
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
    expect(proximaEtapa(ex, R)?.id).toBe('conferencia');
    ex = interromper(ex, 'conferencia', 'sem-razao', '  aguardando  ', 'Clara', agora).execucao;
    expect(ex.etapas.conferencia).toMatchObject({ situacao: 'interrompida', objecao: 'sem-razao', observacao: 'aguardando' });
    expect(situacaoGeral(ex, R)).toBe('parada');
    expect(progresso(ex, R)).toMatchObject({ concluidas: 1, total: 7, interrompida: etapa('conferencia') });
    ex = fazer(ex, 'conferencia', 'Clara', agora).execucao;
    ex = dispensar(ex, 'cheque-especial', 'sem-negativo', '', 'Clara', agora).execucao;
    expect(concluida(ex.etapas['cheque-especial'].situacao)).toBe(true);
    expect(situacaoGeral(ex, R)).toBe('em-andamento');
    for (const e of R.etapas) ex = fazer(ex, e.id, 'Clara', agora).execucao;
    expect(situacaoGeral(ex, R)).toBe('concluida');
    expect(proximaEtapa(ex, R)).toBeNull();
  });
});

describe('check automático', () => {
  it('extratos: precisa de extrato do banco com lançamento na competência', () => {
    expect(verificar(etapa('extratos'), '2026-08', [])).toEqual({ ok: false, motivo: 'Ainda não há extrato de agosto/2026 importado.' });
    expect(verificar(etapa('extratos'), '2026-08', [arq('banco', '2026-07-31')]).ok).toBe(false);
    expect(verificar(etapa('extratos'), '2026-08', [arq('banco', '2026-08-05')]).ok).toBe(true);
    expect(verificar(etapa('extratos'), '2026-08', [arq('sistema', '2026-08-05')]).ok).toBe(false);
  });
  it('conferência: precisa de extrato e razão do sistema', () => {
    expect(verificar(etapa('conferencia'), '2026-08', [arq('banco', '2026-08-05')]).motivo).toBe('Falta importar o razão do sistema de agosto/2026.');
    expect(verificar(etapa('conferencia'), '2026-08', [arq('banco', '2026-08-05'), arq('sistema', '2026-08-20')]).ok).toBe(true);
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
    expect(r[1]).toMatchObject({ etapa: 'conferencia', feitas: 1, interrompidas: 1, pendentes: 1 });
    expect(objecoesMaisComuns(exs, R).map(o => [o.texto, o.qtd])).toEqual([
      ['A conta não ficou negativa', 1], ['O razão da conta ainda não foi gerado no sistema', 1],
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
