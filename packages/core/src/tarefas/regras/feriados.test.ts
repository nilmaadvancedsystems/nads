import { describe, expect, it } from 'vitest';
import { dicaDoFeriado, feriadoDoDia, FERIADOS, feriadosDoMes, rotuloDoFeriado } from './feriados';

describe('os feriados de Taiobeiras (Decreto 4068/2026)', () => {
  it('as datas do decreto, sem repetir e em ordem', () => {
    const datas = FERIADOS.map(f => f.data);
    expect(new Set(datas).size).toBe(datas.length);
    expect([...datas].sort()).toEqual(datas);
    expect(feriadosDoMes('2026-11').map(f => f.data)).toEqual(['2026-11-02', '2026-11-15', '2026-11-20']);
  });
  it('Nossa Senhora de Fátima passou para o dia 18 de maio', () => {
    expect(feriadoDoDia('2026-05-13')).toBeNull();
    expect(feriadoDoDia('2026-05-18')?.tipo).toBe('feriado');
  });
  it('o rótulo e a dica', () => {
    expect(dicaDoFeriado(feriadoDoDia('2026-04-21')!)).toBe('Tiradentes · Feriado');
    expect(dicaDoFeriado(feriadoDoDia('2026-04-20')!)).toBe('Ponto facultativo');
    expect(rotuloDoFeriado(feriadoDoDia('2026-12-24')!)).toBe('Expediente até 13h');
    expect(feriadoDoDia('2026-11-16')).toBeNull();
  });
});
