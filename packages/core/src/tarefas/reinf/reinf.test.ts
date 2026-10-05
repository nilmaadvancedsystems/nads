import { describe, expect, it } from 'vitest';
import { alternarRetificada, desfazerReinf, EMPRESAS_REINF, estadosIniciaisReinf, resumoReinf, situacaoReinf, transmitirReinf } from './reinf';

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
