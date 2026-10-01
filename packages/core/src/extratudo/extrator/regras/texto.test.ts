import { describe, expect, it } from 'vitest';
import { centavos, dataBR, lerData, parecido, temSinal, valorBR } from './texto';

describe('valores', () => {
  it('lê o formato brasileiro e o sinal', () => {
    expect(['1.234,56', '-1.234,56', '(10,00)', '10,00 D', '10,00 C', '1234.56', 'R$ 5,00', '12,5', '1.000', 'abc', ''].map(centavos))
      .toEqual([123456, -123456, -1000, -1000, 1000, 123456, 500, 1250, 100000, null, null]);
    expect(centavos(12.345)).toBe(1235);
  });
  it('sabe quando o texto já traz o sinal', () => {
    expect(['10,00 D', '-10,00', '(10,00)', '10,00 C', '10,00'].map(temSinal)).toEqual([true, true, true, true, false]);
  });
  it('o D/C colado no número, como o extrato do Sicoob (5,10D = saída; 5.852,54C = entrada)', () => {
    expect(['5,10D', '5.852,54C', '1.166,00d'].map(centavos)).toEqual([-510, 585254, -116600]);
    expect(['5,10D', '5.852,54C'].map(temSinal)).toEqual([true, true]);
  });
  it('mostra com o menos tipográfico', () => {
    expect(valorBR(-123456)).toBe('−1.234,56');
    expect(valorBR(5)).toBe('0,05');
  });
});

describe('datas', () => {
  it('aceita os formatos dos bancos e dos sistemas', () => {
    expect(['05/09/2026', '05/09/26', '05/09', '5 set 2026', '05-SET', '2026-09-05', '5.9.2026'].map(s => lerData(s, 2026)))
      .toEqual(Array(7).fill('2026-09-05'));
    expect(lerData(new Date(2026, 8, 5), 2000)).toBe('2026-09-05');
    expect(lerData(46270, 2000)).toBe('2026-09-05');
  });
  it('recusa data que não existe', () => {
    expect(lerData('31/02/2026', 2026)).toBeNull();
    expect(lerData('texto', 2026)).toBeNull();
    expect(lerData(12, 2026)).toBeNull();
  });
  it('mostra dd/mm/aaaa', () => {
    expect(dataBR('2026-09-05')).toBe('05/09/2026');
  });
});

describe('históricos parecidos', () => {
  it('ignora os verbos do banco e acentos', () => {
    expect(parecido('PIX ENVIADO FORNECEDOR DELTA', 'Pagamento fornecedor Delta')).toBe(1);
    expect(parecido('ENERGIA', 'Energia elétrica')).toBe(0.5);
    expect(parecido('TARIFA', 'Honorários')).toBe(0);
    expect(parecido('PIX', 'TED')).toBe(1);
  });
});
