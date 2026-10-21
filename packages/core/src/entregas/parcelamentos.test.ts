import { describe, expect, it } from 'vitest';
import { camposDoParcelamento, parcelamentoDoDocumento, proximaParcela, valorDaParcelaDigitado } from './parcelamentos';

describe('os parcelamentos (Heverton, 20/10/2026)', () => {
  it('confere o que se digita', () => {
    expect(camposDoParcelamento({ orgao: 'simples', modalidade: ' Simplificado ', numero: '123', parcelas: '60', primeira: '1/2026', valor: '1.234,56', dia: 'util', obs: '' }))
      .toEqual({ campos: { orgao: 'simples', modalidade: 'Simplificado', numero: '123', parcelas: 60, primeira: '2026-01', valorParcela: 1234.56, dia: 'util', obs: '', status: 'ativo', aberto: true } });
    expect(camposDoParcelamento({ orgao: 'x', modalidade: '', numero: '', parcelas: '0', primeira: '01/2026', valor: '1', dia: '10', obs: '' })).toEqual({ erro: 'Quantas parcelas? (1 a 600)' });
    expect('erro' in camposDoParcelamento({ orgao: 'pgfn', modalidade: '', numero: '', parcelas: '2', primeira: '13/2026', valor: '1', dia: '10', obs: '' })).toBe(true);
    expect(valorDaParcelaDigitado('R$ 350,00')).toBe(350);
    expect(valorDaParcelaDigitado('abc')).toBeNull();
  });
  it('a próxima parcela em aberto e o vencimento', () => {
    const p = parcelamentoDoDocumento('a', { clienteId: 'k1', orgao: 'pgfn', parcelas: 3, primeira: '2026-08', valorParcela: 10, dia: 'util', aberto: true, pagas: { '2026-08': { em: 'x' } } });
    // setembro/2026: o último dia útil é 30 (quarta)
    expect(proximaParcela(p)).toEqual({ numero: 2, mes: '2026-09', vencimento: '30/09/2026' });
    expect(proximaParcela({ ...p, dia: 31 })?.vencimento).toBe('30/09/2026');
    expect(proximaParcela({ ...p, pagas: ['2026-08', '2026-09', '2026-10'] })).toBeNull();
    expect(proximaParcela({ ...p, aberto: false })).toBeNull();
  });
});
