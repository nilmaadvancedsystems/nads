import { describe, expect, it } from 'vitest';
import { dataBR, dataDaCelula, dataParaSerialExcel, diaUtil, proximoDiaUtil, serialExcelParaData, soData } from './datas';

// Janeiro/2026: dia 1 é quinta; 2 sexta; 3 sábado; 4 domingo; 5 segunda.
const dia = (d: number, m = 1, a = 2026) => new Date(a, m - 1, d);

describe('dataDaCelula', () => {
  it('vazio e tipos que não são data viram null', () => {
    for (const v of [null, undefined, '', true, {}, 'abc', '12', new Date(NaN)]) expect(dataDaCelula(v)).toBeNull();
  });

  it('Date: fica só a data, sem hora', () => {
    expect(dataDaCelula(new Date(2026, 0, 5, 15, 30))).toEqual(dia(5));
  });

  it('texto dd/mm/aaaa, d/m/aa e com hora depois', () => {
    expect(dataDaCelula('05/01/2026')).toEqual(dia(5));
    expect(dataDaCelula(' 5/1/26 ')).toEqual(dia(5));
    expect(dataDaCelula('05/01/2026 14:22')).toEqual(dia(5));
  });

  it('texto com dia inválido rola para o mês seguinte (como o Date do JS)', () => {
    expect(dataDaCelula('31/02/2026')).toEqual(dia(3, 3));
  });

  it('serial do Excel (número ou texto > 1000) é o dia do serial, em qualquer fuso (corrigido)', () => {
    // 46027 = 05/01/2026. O original, no Brasil, caía em 04/01.
    expect(dataBR(dataDaCelula(46027) as Date)).toBe('05/01/2026');
    expect(dataBR(dataDaCelula('46027,7') as Date)).toBe('05/01/2026');
    expect(dataDaCelula('999')).toBeNull();
  });
});

describe('serial do Excel', () => {
  it('serialExcelParaData ignora a fração e usa a época 1899-12-30', () => {
    expect(serialExcelParaData(46027.9).getTime()).toBe(new Date(2026, 0, 5).getTime());
  });
  it('dataParaSerialExcel usa a data local', () => {
    expect(dataParaSerialExcel(dia(5))).toBe(46027);
    expect(dataParaSerialExcel(new Date(2026, 0, 5, 23, 59))).toBe(46027);
  });
});

describe('dias úteis e formato', () => {
  it('diaUtil: sábado e domingo não são', () => {
    expect([1, 2, 3, 4, 5].map(d => diaUtil(dia(d)))).toEqual([true, true, false, false, true]);
  });
  it('proximoDiaUtil pula o fim de semana e a virada de mês', () => {
    expect(proximoDiaUtil(dia(2))).toEqual(dia(5));
    expect(proximoDiaUtil(dia(3))).toEqual(dia(5));
    expect(proximoDiaUtil(dia(5))).toEqual(dia(6));
    expect(proximoDiaUtil(dia(30, 1))).toEqual(dia(2, 2));
  });
  it('dataBR e soData', () => {
    expect(dataBR(dia(5))).toBe('05/01/2026');
    expect(dataBR(dia(31, 12, 2025))).toBe('31/12/2025');
    expect(soData(new Date(2026, 0, 5, 10))).toEqual(dia(5));
  });
});
