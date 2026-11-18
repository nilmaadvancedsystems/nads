import { describe, expect, it } from 'vitest';
import { ehDiaUtil, novaRecorrencia, prazoDaUltima, proximaOcorrencia, proximoDiaUtil } from './recorrencia';

describe('a tarefa recorrente', () => {
  it('o dia útil: sábado, domingo, feriado e ponto facultativo não; meio expediente sim', () => {
    expect(ehDiaUtil('2026-11-18')).toBe(true);    // quarta
    expect(ehDiaUtil('2026-11-21')).toBe(false);   // sábado
    expect(ehDiaUtil('2026-11-20')).toBe(false);   // Consciência Negra
    expect(ehDiaUtil('2026-10-30')).toBe(false);   // ponto facultativo
    expect(ehDiaUtil('2026-12-24')).toBe(true);    // meio expediente
  });
  it('caiu em dia não útil: vai para o próximo dia útil', () => {
    expect(proximoDiaUtil('2026-11-20')).toBe('2026-11-23');   // sexta feriado → segunda
    expect(proximoDiaUtil('2026-11-18')).toBe('2026-11-18');
  });
  it('semanal, quinzenal e diária', () => {
    const s = proximaOcorrencia(novaRecorrencia('semanal', '2026-11-13')!)!;
    expect(s.recorrencia.ancora).toBe('2026-11-20');
    expect(s.prazo).toBe('2026-11-23');
    const s2 = proximaOcorrencia(s.recorrencia)!;
    expect(s2.recorrencia.ancora).toBe('2026-11-27');   // a âncora não arrasta com o ajuste
    expect(proximaOcorrencia(novaRecorrencia('quinzenal', '2026-11-18')!)!.prazo).toBe('2026-12-02');
    expect(proximaOcorrencia(novaRecorrencia('diaria', '2026-11-19')!)!.prazo).toBe('2026-11-23');   // pula o feriado e o fim de semana
  });
  it('mensal e anual guardam o dia do mês da primeira', () => {
    const jan = novaRecorrencia('mensal', '2026-01-31')!;
    const fev = proximaOcorrencia(jan)!;
    expect(fev.recorrencia.ancora).toBe('2026-02-28');
    const mar = proximaOcorrencia(fev.recorrencia)!;
    expect(mar.recorrencia.ancora).toBe('2026-03-31');
    expect(mar.prazo).toBe('2026-03-31');
    const a = proximaOcorrencia(novaRecorrencia('anual', '2026-11-15')!)!;
    expect(a.recorrencia.ancora).toBe('2027-11-15');
  });
  it('com quantidade de vezes, conta e para na última', () => {
    const r = novaRecorrencia('mensal', '2026-11-30', 3)!;
    expect(r).toMatchObject({ vezes: 3, n: 1 });
    const dez = proximaOcorrencia(r)!;
    expect(dez.recorrencia.n).toBe(2);
    const jan = proximaOcorrencia(dez.recorrencia)!;
    expect(jan.recorrencia.n).toBe(3);
    expect(proximaOcorrencia(jan.recorrencia)).toBeNull();
    expect(prazoDaUltima(r)).toBe(jan.prazo);
    expect(prazoDaUltima(novaRecorrencia('mensal', '2026-11-30')!)).toBe('');
    expect(novaRecorrencia('anual', '2026-11-30', 1)!.vezes).toBe(1);
    expect(proximaOcorrencia(novaRecorrencia('anual', '2026-11-30', 1)!)).toBeNull();
  });
});
