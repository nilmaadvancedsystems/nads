import { describe, expect, it } from 'vitest';
import { ROTINA_FISCAL } from '../rotinas/fiscal';
import { FLUXO_PRESUMIDO, FLUXO_REAL, FLUXO_SIMPLES, FLUXOS_FISCAIS, fluxoDoRegime } from '../rotinas/fluxoFiscal';
import { definirResponsavelDeVarios, definirResponsavelDoSubprocesso, definirStatus, definirStatusDeVarios, fluxoDoMes, resumoDoFluxo, statusDe } from './fluxoFiscal';
import { etapaNoMes, execucaoNova } from './execucao';

const agora = new Date('2026-10-23T12:00:00Z');

describe('o fluxo operacional do Fiscal (23/10/2026)', () => {
  it('as etapas do documento, na ordem, com ids únicos', () => {
    expect(FLUXO_REAL.etapas.map(e => e.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(FLUXO_PRESUMIDO.etapas.map(e => e.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(FLUXO_SIMPLES.etapas.map(e => e.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ids = FLUXOS_FISCAIS.flatMap(f => f.etapas.flatMap(e => e.subprocessos.map(s => s.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(FLUXO_REAL.etapas[3].subprocessos.map(s => s.nome)).toContain('IBS e CBS, quando aplicáveis');
    expect(fluxoDoRegime('Simples')).toBe(FLUXO_SIMPLES);
    expect(fluxoDoRegime('MEI')).toBeNull();
  });
  it('a rotina do Fiscal: o fluxo do regime e, nos regimes sem fluxo, a antiga', () => {
    const ex = (codigo: number) => execucaoNova('X', codigo, '2026-09', 'fiscal');
    const ids = ROTINA_FISCAL.etapas.map(e => e.id);
    expect(ids).toContain('fs-6-das');
    expect(ids).toContain('fiscal-mei');
    expect(ids).not.toContain('fiscal-simples');
    // a regra do regime de sempre (Etapa.regimes): sem o regime cadastrado, entra tudo; o teste olha só a etapa
    const das = ROTINA_FISCAL.etapas.find(e => e.id === 'fs-6-das')!;
    expect(das.regimes).toEqual(['Simples']);
    expect(ROTINA_FISCAL.etapas.find(e => e.id === 'fiscal-mei')!.regimes).toEqual(['MEI']);
    expect(etapaNoMes(ex(1), 'fp-5-irpj')).toBeTypeOf('boolean');
  });
  it('o status: concluído e aprovado encerram, não aplicável dispensa; o responsável fica', () => {
    let ex = execucaoNova('X', 1, '2026-09', 'fiscal');
    ex = definirResponsavelDoSubprocesso(ex, 'fs-1-empresas', 'Heverton', 'Vitor', agora).execucao;
    ex = definirStatus(ex, 'fs-1-empresas', 'execucao', 'Heverton', agora).execucao;
    expect(ex.etapas['fs-1-empresas']).toMatchObject({ situacao: 'pendente', status: 'execucao', responsavel: 'Heverton' });
    const r = definirStatus(ex, 'fs-1-empresas', 'concluido', 'Heverton', agora, 'ok');
    expect(r.execucao.etapas['fs-1-empresas']).toMatchObject({ situacao: 'feita', status: 'concluido', responsavel: 'Heverton', observacao: 'ok' });
    expect(r.evento).toMatchObject({ tipo: 'status', etapa: 'fs-1-empresas' });
    expect(definirStatus(ex, 'fs-1-empresas', 'nao-aplicavel', 'H', agora).execucao.etapas['fs-1-empresas'].situacao).toBe('dispensada');
    expect(statusDe({ situacao: 'feita', por: '', em: '' })).toBe('concluido');
  });
  it('a etapa só libera quando as de antes encerram; as trimestrais só no trimestre; as anuais no mês delas', () => {
    let ex = execucaoNova('X', 1, '2026-09', 'fiscal');
    let etapas = fluxoDoMes(FLUXO_SIMPLES, ex, '2026-09');
    expect(etapas[0].liberada).toBe(true);
    expect(etapas[1].liberada).toBe(false);
    expect(etapas[1].esperando).toBe('1. Abertura da competência');
    for (const s of etapas[0].subprocessos) ex = definirStatus(ex, s.id, 'concluido', 'H', agora).execucao;
    etapas = fluxoDoMes(FLUXO_SIMPLES, ex, '2026-09');
    expect(etapas[0].concluida).toBe(true);
    expect(etapas[1].liberada).toBe(true);
    expect(resumoDoFluxo(etapas).daVez?.n).toBe(2);
    expect(fluxoDoMes(FLUXO_PRESUMIDO, null, '2026-09').map(e => e.n)).toContain(5);
    expect(fluxoDoMes(FLUXO_PRESUMIDO, null, '2026-10').map(e => e.n)).not.toContain(5);
    expect(fluxoDoMes(FLUXO_SIMPLES, null, '2026-02').find(e => e.n === 8)!.subprocessos.map(s => s.nome)).toContain('DEFIS anual');
    expect(fluxoDoMes(FLUXO_SIMPLES, null, '2026-09').find(e => e.n === 8)!.subprocessos.map(s => s.nome)).not.toContain('DEFIS anual');
  });
  it('o responsável padrão entra sozinho ao mudar o status; vários de uma vez numa gravação só', () => {
    const ex = execucaoNova('X', 1, '2026-09', 'fiscal');
    expect(definirStatus(ex, 'fs-1-empresas', 'concluido', 'Gustavo', agora, '', 'Heverton').execucao.etapas['fs-1-empresas'].responsavel).toBe('Heverton');
    const com = definirResponsavelDoSubprocesso(ex, 'fs-1-empresas', 'Clara', 'G', agora).execucao;
    expect(definirStatus(com, 'fs-1-empresas', 'concluido', 'G', agora, '', 'Heverton').execucao.etapas['fs-1-empresas'].responsavel).toBe('Clara');
    const v = definirStatusDeVarios(ex, ['fs-1-empresas', 'fs-1-tarefas'], 'concluido', 'G', agora, 'Heverton');
    expect(Object.keys(v.execucao.etapas)).toEqual(['fs-1-empresas', 'fs-1-tarefas']);
    expect(v.evento.observacao).toBe('concluido · 2 subprocessos');
    expect(definirResponsavelDeVarios(ex, ['fs-1-empresas', 'fs-1-tarefas'], 'Ana', 'G', agora).execucao.etapas['fs-1-tarefas'].responsavel).toBe('Ana');
  });
});
