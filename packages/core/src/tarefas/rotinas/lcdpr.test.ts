// A rotina das empresas com o LCDPR (16/10/2026: a 62 "só precisa do lcdpr").
import { describe, expect, it } from 'vitest';
import { EMPRESAS_COM_LCDPR, temLcdpr } from '../../lcdpr';
import { execucaoNova, fazer, interromper, proximaEtapa, progresso, situacaoGeral } from '../regras/execucao';
import { resumoPorEtapaDasEmpresas } from '../regras/visao';
import { ROTINA_CONTABIL } from './contabil';
import { ROTINA_DP } from './dp';
import { ROTINA_FISCAL } from './fiscal';
import { ROTINA_LCDPR } from './lcdpr';
import { rotinaDaEmpresa } from './rotinaDo';

const agora = new Date('2026-10-16T12:00:00Z');

describe('rotina das empresas com o LCDPR', () => {
  it('a 62 tem o LCDPR (a lista mora no core)', () => {
    expect(EMPRESAS_COM_LCDPR).toEqual([62]);
    expect(temLcdpr(62)).toBe(true);
    expect(temLcdpr(292)).toBe(false);
    expect(temLcdpr(null)).toBe(false);
  });

  it('no Contábil, a 62 tem uma etapa só: o LCDPR, com a tela dele', () => {
    const r = rotinaDaEmpresa('contabil', 62)!;
    expect(r).toBe(ROTINA_LCDPR);
    expect(r.departamento).toBe('contabil');
    expect(r.etapas.map(e => e.id)).toEqual(['lcdpr']);
    expect(r.etapas[0].tela?.id).toBe('lcdpr');
    for (const id of ['extratos', 'cheque-especial', 'fiscal', 'dp', 'bancos', 'cartoes', 'honorarios', 'fechamento']) {
      expect(r.etapas.some(e => e.id === id)).toBe(false);
    }
  });

  it('uma empresa comum continua com as etapas de sempre; o Fiscal e o DP da 62 não mudam', () => {
    expect(rotinaDaEmpresa('contabil', 292)).toBe(ROTINA_CONTABIL);
    expect(rotinaDaEmpresa('contabil', null)).toBe(ROTINA_CONTABIL);
    expect(ROTINA_CONTABIL.etapas.slice(0, 4).map(e => e.id)).toEqual(['extratos', 'cheque-especial', 'fiscal', 'dp']);
    expect(rotinaDaEmpresa('fiscal', 62)).toBe(ROTINA_FISCAL);
    expect(rotinaDaEmpresa('dp', 62)).toBe(ROTINA_DP);
    expect(rotinaDaEmpresa('outro', 62)).toBeNull();
  });

  it('o andamento da 62 conta 1 etapa (mesmo com o que ficou gravado das etapas antigas)', () => {
    const r = rotinaDaEmpresa('contabil', 62)!;
    let ex = execucaoNova('CARLOS LUCAS MENDES - FAZ. TABATINGA', 62, '2026-09', 'contabil');
    ex = fazer(ex, 'extratos', 'Vitor', agora).execucao;
    expect(progresso(null, r)).toMatchObject({ concluidas: 0, total: 1 });
    expect(progresso(ex, r)).toMatchObject({ concluidas: 0, total: 1 });
    expect(proximaEtapa(ex, r)?.id).toBe('lcdpr');
    const parada = interromper(ex, 'lcdpr', 'sem-relatorios', '', 'Vitor', agora).execucao;
    expect(situacaoGeral(parada, r)).toBe('parada');
    const feita = fazer(ex, 'lcdpr', 'Vitor', agora).execucao;
    expect(progresso(feita, r)).toMatchObject({ concluidas: 1, total: 1 });
    expect(situacaoGeral(feita, r)).toBe('concluida');
  });

  it('a visão de cima conta cada empresa na rotina dela', () => {
    const rotinaDe = (c: number | null) => rotinaDaEmpresa('contabil', c)!;
    const ex62 = fazer(execucaoNova('CARLOS', 62, '2026-09', 'contabil'), 'lcdpr', 'Vitor', agora).execucao;
    const ex292 = fazer(execucaoNova('FITO', 292, '2026-09', 'contabil'), 'extratos', 'Vitor', agora).execucao;
    const resumo = resumoPorEtapaDasEmpresas([ex62, ex292], [62, 292, 309], rotinaDe, '2026-09');
    // as do Contábil primeiro (duas empresas), o LCDPR no fim (uma)
    expect(resumo[0].etapa).toBe('extratos');
    expect(resumo[resumo.length - 1]).toMatchObject({ etapa: 'lcdpr', feitas: 1, pendentes: 0, total: 1 });
    expect(resumo.find(e => e.etapa === 'extratos')).toMatchObject({ feitas: 1, pendentes: 1, total: 2 });
    // a 62 não conta como pendente no Contábil; o Estoque (só em dezembro) fica fora em setembro
    expect(resumo.find(e => e.etapa === 'fiscal')).toMatchObject({ feitas: 0, pendentes: 2 });
    expect(resumo.some(e => e.etapa === 'estoque')).toBe(false);
  });
});
