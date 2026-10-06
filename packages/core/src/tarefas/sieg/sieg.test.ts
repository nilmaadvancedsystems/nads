import { describe, expect, it } from 'vitest';
import { conferirSaidas, emFaixas, totalDe } from '.';

describe('SIEG: a conferência das saídas', () => {
  it('acha os buracos da numeração e separa as canceladas, série por série', () => {
    const r = conferirSaidas({
      codigo: '292', competencia: '2026-10', em: '',
      series: [
        { modelo: '55', serie: '1', numeros: [101, 102, 104, 105, 108], canceladas: [102], valor: 900 },
        { modelo: '65', serie: '2', numeros: [7, 8, 9], canceladas: [], valor: 50.5 },
      ],
    });
    expect(r.series[0]).toMatchObject({ rotulo: 'NF-e · série 1', primeira: 101, ultima: 108, autorizadas: 4, canceladas: [102], faltando: [103, 106, 107] });
    expect(r.series[1]).toMatchObject({ rotulo: 'NFC-e · série 2', faltando: [], autorizadas: 3 });
    expect(r).toMatchObject({ autorizadas: 7, canceladas: 1, faltando: 3, valor: 950.5, ok: false });
  });
  it('sem buraco: ok; série vazia não entra', () => {
    const r = conferirSaidas({ codigo: '1', competencia: '2026-10', em: '', series: [{ modelo: '55', serie: '1', numeros: [1, 2, 3], canceladas: [], valor: 10 }, { modelo: '55', serie: '9', numeros: [], canceladas: [], valor: 0 }] });
    expect(r.ok).toBe(true);
    expect(r.series).toHaveLength(1);
  });
  it('faixas e totais', () => {
    expect(emFaixas([9, 3, 4, 5, 12, 13])).toBe('3–5, 9, 12–13');
    expect(totalDe({ NFe: 2, NFCe: 3, NFSe: 0, CTe: 1, CFe: 0 })).toBe(6);
  });
});
