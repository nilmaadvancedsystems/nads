import { describe, expect, it } from 'vitest';
import {
  brl, campoCsv, chaveDaData, dataDoSerialExcel, lerDataFlexivel, lerNumeroFlexivel, limparHistorico, notaDoHistorico, pad2, rotuloMes, valorBR,
} from './formatos';

describe('formatos do Conciliadorzinho', () => {
  it('rótulo do mês e dinheiro', () => {
    expect(rotuloMes({ mes: 7, ano: 2026 })).toBe('Julho/2026');
    expect(rotuloMes({ mes: 3, ano: 2026 })).toBe('Março/2026');
    expect(valorBR(1234.5)).toBe('1.234,50');
    const nb = String.fromCharCode(0xa0); // o original usa espaço que não quebra depois do R$
    expect(brl(1234.567)).toBe('R$' + nb + '1.234,57');
    expect(brl(-3.2)).toBe('R$' + nb + '-3,20');
    expect(pad2(7)).toBe('07');
    expect(pad2(12)).toBe('12');
  });

  it('chave da data e série do Excel', () => {
    expect(chaveDaData(new Date(2026, 6, 5, 23, 59))).toBe('05/07/2026');
    const d = dataDoSerialExcel(46208.75); // 05/07/2026 às 18h
    expect(chaveDaData(d)).toBe('05/07/2026');
    expect(d.getHours()).toBe(0);
  });

  it('lê datas em vários formatos', () => {
    const k = (v: unknown) => { const d = lerDataFlexivel(v); return d ? chaveDaData(d) : null; };
    expect(k(new Date(2026, 6, 5, 15, 0))).toBe('05/07/2026');
    expect(k(46208)).toBe('05/07/2026');
    expect(k(19999)).toBeNull();
    expect(k('5/7/26')).toBe('05/07/2026');
    expect(k('05-07-2026 10:00')).toBe('05/07/2026');
    expect(k('05.07.2026')).toBe('05/07/2026');
    expect(k('2026-07-05')).toBe('05/07/2026');
    expect(k('32/07/2026')).toBeNull();
    expect(k('31/02/2026')).toBeNull(); // data que não existe é ignorada (corrigido; o original virava 03/03)
    expect(k('Data')).toBeNull();
    expect(k(null)).toBeNull();
    expect(k(new Date('x'))).toBeNull();
  });

  it('lê números em vários formatos', () => {
    expect(lerNumeroFlexivel(12.5)).toBe(12.5);
    expect(lerNumeroFlexivel(Infinity)).toBeNull();
    expect(lerNumeroFlexivel('R$ 1.234,56')).toBe(1234.56);
    expect(lerNumeroFlexivel('(3,21)')).toBe(-3.21);
    expect(lerNumeroFlexivel('-2,5')).toBe(-2.5);
    expect(lerNumeroFlexivel('1,234.56')).toBe(1234.56);
    // corrigidos (o original dava 1, 12345 e 10):
    expect(lerNumeroFlexivel('1.000')).toBe(1000);
    expect(lerNumeroFlexivel('1.234.567')).toBe(1234567);
    expect(lerNumeroFlexivel('12,345')).toBe(12.345);
    expect(lerNumeroFlexivel('12.5')).toBe(12.5);
    expect(lerNumeroFlexivel('10-')).toBeNull();
    expect(lerNumeroFlexivel('')).toBeNull();
    expect(lerNumeroFlexivel('abc')).toBeNull();
    expect(lerNumeroFlexivel(null)).toBeNull();
  });

  it('limpa o histórico e tira a NF', () => {
    const h = limparHistorico('Pelas vendas de mercadorias a vista conforme NF-e nº 200294 - 0 - CONSUMIDOR FINAL');
    expect(h).toBe('200294-0-CONSUMIDOR FINAL');
    expect(notaDoHistorico(h)).toBe('200294');
    expect(limparHistorico('  SEM PADRAO  ')).toBe('SEM PADRAO');
    expect(notaDoHistorico('SEM PADRAO')).toBe('SEM PADRAO');
    expect(limparHistorico(null)).toBe('');
    expect(notaDoHistorico('')).toBe('');
  });

  it('campo de CSV', () => {
    expect(campoCsv('abc')).toBe('abc');
    expect(campoCsv('a;b')).toBe('"a;b"');
    expect(campoCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(campoCsv(null)).toBe('');
    expect(campoCsv(3)).toBe('3');
  });
});
