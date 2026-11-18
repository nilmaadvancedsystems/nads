// O calendário único de dias úteis (plano do Acessórias, 17/11/2026, ficha E01; frase do dono: "Começar pela E01").
// Datas fixas, nunca a data de hoje.
import { describe, expect, it } from 'vitest';
import { feriadoNacional } from './etiquetasDaFolha';
import { PRAZOS_DO_DP, prazoDaObrigacaoDp } from './prazosDoDp';
import { ajustar, ehDiaUtil, ehFeriado, enesimoDiaUtil, ultimoDiaUtil } from './diasUteis';

describe('o calendário de dias úteis', () => {
  it('o ponto facultativo não fecha prazo (20/04/2026)', () => {
    expect(ehDiaUtil('2026-04-20', 'municipal')).toBe(true);
    expect(ehDiaUtil('2026-04-20', 'federal')).toBe(true);
  });
  it('o feriado de Taiobeiras só vale na esfera municipal (Nossa Senhora de Fátima, 18/05/2026)', () => {
    expect(ehDiaUtil('2026-05-18', 'municipal')).toBe(false);
    expect(ehDiaUtil('2026-05-18', 'federal')).toBe(true);
    expect(ehDiaUtil('2026-05-18', 'estadual')).toBe(true);
  });
  it('a Paixão de Cristo (03/04/2026) não é útil em nenhuma esfera', () => {
    for (const e of ['federal', 'estadual', 'municipal'] as const) expect(ehDiaUtil('2026-04-03', e)).toBe(false);
  });
  it('o meio expediente (24/12/2026) é dia útil', () => {
    expect(ehDiaUtil('2026-12-24', 'municipal')).toBe(true);
  });
  it('o fim de semana: domingo nunca; sábado só quando conta', () => {
    expect(ehDiaUtil('2026-12-05', 'federal')).toBe(false); // sábado
    expect(ehDiaUtil('2026-12-05', 'federal', true)).toBe(true);
    expect(ehDiaUtil('2026-12-06', 'federal', true)).toBe(false); // domingo
    expect(ehFeriado('2026-12-05', 'federal')).toBe(false);
  });
  it('ajustar: antecipa, posterga e mantém', () => {
    expect(ajustar('2026-11-15', 'antecipa', 'federal')).toBe('2026-11-13'); // domingo e feriado
    expect(ajustar('2026-11-15', 'posterga', 'federal')).toBe('2026-11-16');
    expect(ajustar('2026-11-15', 'mantem', 'federal')).toBe('2026-11-15');
    expect(ajustar('2026-11-17', 'antecipa', 'federal')).toBe('2026-11-17'); // já é útil
    expect(ajustar('2026-12-12', 'posterga', 'municipal')).toBe('2026-12-14'); // emancipação (sábado)
  });
  it('o 5º dia útil de dez/2026 contando o sábado', () => {
    expect(enesimoDiaUtil(2026, 11, 5, 'federal', true)).toBe('2026-12-05');
    expect(enesimoDiaUtil(2026, 11, 5, 'federal')).toBe('2026-12-07');
  });
  it('o último dia útil do mês', () => {
    expect(ultimoDiaUtil(2026, 9, 'federal')).toBe('2026-10-30'); // 31/10 é sábado
    expect(ultimoDiaUtil(2027, 0, 'federal')).toBe('2027-01-29'); // 31/01/2027 é domingo
  });
});

describe('os prazos do DP não mudam com o calendário único', () => {
  // o cálculo de antes da E01 (17/11/2026), copiado aqui só para comparar
  const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function antes(obrigacao: string, competencia: string): string {
    const regra = PRAZOS_DO_DP[obrigacao];
    const [a, m] = competencia.split('-').map(Number);
    if (regra.dia === 'quinto-dia-util') {
      const d = new Date(a, m, 1);
      let uteis = 0;
      for (;;) {
        if (d.getDay() !== 0 && !feriadoNacional(d)) uteis++;
        if (uteis === 5) return iso(d);
        d.setDate(d.getDate() + 1);
      }
    }
    const d = new Date(a, m, regra.dia);
    while (d.getDay() === 0 || d.getDay() === 6 || feriadoNacional(d)) d.setDate(d.getDate() + (regra.ajuste === 'antecipa' ? -1 : 1));
    return iso(d);
  }
  it('as mesmas datas de 2025 a 2028, em toda obrigação', () => {
    for (let ano = 2025; ano <= 2028; ano++) for (let mes = 1; mes <= 12; mes++) {
      const comp = ano + '-' + String(mes).padStart(2, '0');
      for (const o of Object.keys(PRAZOS_DO_DP)) expect(prazoDaObrigacaoDp(o, comp), o + ' ' + comp).toBe(antes(o, comp));
    }
  });
});
