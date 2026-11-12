import { describe, expect, it } from 'vitest';
import { alternarRetificada, alternarSerieReinf, rotuloDasSeries, transmitirSeriesReinf, desfazerReinf, EMPRESAS_REINF, empresasDaReinf, estadosIniciaisReinf, resumoReinf, seriesDaReinf, situacaoReinf, temReinfNoFiscal, transmitirReinf } from './reinf';
import { EMPRESAS } from '../../empresas/lista';

const agora = new Date('2026-10-05T12:00:00Z');

describe('REINF', () => {
  it('as 42 empresas do Notion, sem repetir', () => {
    expect(EMPRESAS_REINF).toHaveLength(42);
    expect(new Set(EMPRESAS_REINF.map(e => e.codigo)).size).toBe(42);
  });
  it('transmitida quando o "até" chegou na competência; senão pendente (sem limpar todo mês)', () => {
    const e = { codigo: 1, transmitidoAte: '2026-08', retificadas: [] };
    expect(situacaoReinf(e, '2026-08')).toBe('transmitida');
    expect(situacaoReinf(e, '2026-09')).toBe('pendente');
    expect(situacaoReinf(undefined, '2026-09')).toBe('pendente');
  });
  it('transmitir guarda o mês, quando e quem; não volta o "até" para trás', () => {
    const e = transmitirReinf({ codigo: 1, retificadas: [] }, '2026-09', 'Heverton', agora);
    expect(e).toMatchObject({ transmitidoAte: '2026-09', ultima: { por: 'Heverton' } });
    expect(transmitirReinf(e, '2026-07', 'Heverton', agora).transmitidoAte).toBe('2026-09');
  });
  it('desfazer volta para o mês anterior; retificar alterna', () => {
    expect(desfazerReinf({ codigo: 1, transmitidoAte: '2026-01', retificadas: [] }, '2026-01').transmitidoAte).toBe('2025-12');
    const r = alternarRetificada({ codigo: 1, retificadas: [] }, '2026-08', 'Heverton', agora);
    expect(r.retificadas).toEqual(['2026-08']);
    expect(alternarRetificada(r, '2026-08', 'Heverton', agora).retificadas).toEqual([]);
  });
  it('o resumo da competência pelo estado do Notion', () => {
    expect(resumoReinf(estadosIniciaisReinf(), '2026-08')).toEqual({ transmitidas: 4, pendentes: 38, total: 42 });
  });
});

describe('quem tem a REINF no Fiscal (05/11/2026: todas, com as filiais)', () => {
  it('todas as que têm código, de qualquer regime, com as filiais', () => {
    expect(temReinfNoFiscal({ codigo: 10, nome: 'DORNAS HAVANA LTDA', regime: 'Simples' })).toBe(true);
    expect(temReinfNoFiscal({ codigo: 66, nome: 'ADERLEI DOS SANTOS & CIA LTDA', regime: 'Presumido' })).toBe(true);
    expect(temReinfNoFiscal({ codigo: 494, nome: 'CAIXA ESCOLAR JOVITA SECUNDINA REGO', regime: 'Isentas' })).toBe(true);
    expect(temReinfNoFiscal({ codigo: 299, nome: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 02', regime: 'Simples' })).toBe(true);
    expect(temReinfNoFiscal({ codigo: 449, nome: 'GRANMIX COMERCIO DE ALIMENTOS LTDA - MATRIZ', regime: 'Simples' })).toBe(true);
    expect(temReinfNoFiscal({ codigo: 499, nome: 'FARLEN XAVIER SANTOS 36075344896', regime: 'MEI' })).toBe(true);
    // doméstica e pessoa física saem (Vitor, 12/11/2026)
    expect(temReinfNoFiscal({ codigo: 1, nome: 'EMPREGADOR EXEMPLO', regime: 'Domésticas' })).toBe(false);
    expect(temReinfNoFiscal({ codigo: 2, nome: 'PESSOA EXEMPLO', regime: 'Física' })).toBe(false);
    expect(temReinfNoFiscal({ codigo: null, nome: 'SEM CODIGO LTDA', regime: 'Simples' })).toBe(false);
  });
  it('na lista do escritório: as da lista antiga continuam', () => {
    const codigos = new Set(empresasDaReinf(EMPRESAS).map(e => e.codigo));
    expect(codigos.size).toBeGreaterThan(150);
    for (const c of [10, 66, 86, 298, 544, 579, 593]) expect(codigos.has(c)).toBe(true);
    for (const c of [299, 300, 301, 545, 564, 585, 599]) expect(codigos.has(c)).toBe(true);
  });
});

describe('as séries da transmissão (2000, 4000, MIT)', () => {
  const quando = new Date('2026-11-12T10:00:00Z');
  const vazio = { codigo: 1, retificadas: [] };
  it('a primeira série transmite a competência; as outras só se somam', () => {
    const a = alternarSerieReinf(vazio, '2026-10', '4000', 'Ana', quando);
    expect(situacaoReinf(a, '2026-10')).toBe('transmitida');
    const b = alternarSerieReinf(a, '2026-10', '2000', 'Ana', quando);
    expect(seriesDaReinf(b, '2026-10')).toEqual(['2000', '4000']);
  });
  it('tirar a última série desfaz a transmissão', () => {
    const a = alternarSerieReinf(vazio, '2026-10', 'mit', 'Ana', quando);
    const b = alternarSerieReinf(a, '2026-10', 'mit', 'Ana', quando);
    expect(situacaoReinf(b, '2026-10')).toBe('pendente');
    expect(seriesDaReinf(b, '2026-10')).toEqual([]);
  });
  it('desfazer limpa as séries da competência', () => {
    const a = alternarSerieReinf(vazio, '2026-10', '2000', 'Ana', quando);
    expect(seriesDaReinf(desfazerReinf(a, '2026-10'), '2026-10')).toEqual([]);
  });
});

describe('as caixinhas do Transmitir', () => {
  const quando = new Date('2026-11-12T10:00:00Z');
  it('transmite com uma ou mais séries, na ordem do Alterdata', () => {
    const e = transmitirSeriesReinf({ codigo: 1, retificadas: [] }, '2026-10', ['mit', '2000'], 'Ana', quando);
    expect(situacaoReinf(e, '2026-10')).toBe('transmitida');
    expect(rotuloDasSeries(seriesDaReinf(e, '2026-10'))).toBe('2000 · MIT');
  });
  it('sem nenhuma marcada, nada muda', () => {
    const e = { codigo: 1, retificadas: [] };
    expect(transmitirSeriesReinf(e, '2026-10', [], 'Ana', quando)).toBe(e);
  });
});
