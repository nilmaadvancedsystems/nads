import { describe, expect, it } from 'vitest';
import { feriadoDaSemana, frasesDaSaudacao, mesEDia, saudacao, turnoDe } from './saudacao';

// 13/11/2026 é sexta-feira; 16/11/2026, segunda; 24/11/2026, uma terça sem feriado na semana
const em = (dia: string, hora: number) => new Date(dia + 'T' + String(hora).padStart(2, '0') + ':30:00');

describe('saudação do Início novo', () => {
  it('o turno pela hora', () => {
    expect(turnoDe(8)).toBe('manha');
    expect(turnoDe(12)).toBe('tarde');
    expect(turnoDe(19)).toBe('noite');
    expect(turnoDe(2)).toBe('noite');
  });

  it('lê o aniversário de vários jeitos', () => {
    expect(mesEDia('1990-11-20')).toBe('11-20');
    expect(mesEDia('11-20')).toBe('11-20');
    expect(mesEDia('20/11')).toBe('11-20');
    expect(mesEDia('')).toBe('');
  });

  it('bom dia, boa tarde e boa noite com o primeiro nome', () => {
    expect(frasesDaSaudacao('Vitor Dias', em('2026-11-24', 9))[0]).toBe('Bom dia, Vitor');
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 14))[0]).toBe('Boa tarde, Vitor');
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 21))[0]).toBe('Boa noite, Vitor');
  });

  it('segunda-feira pergunta do final de semana; o mês do aniversário comemora; sem data, não', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-16', 9))).toContain('Como foi o final de semana, Vitor?');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9))).not.toContain('Como foi o final de semana, Vitor?');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), '1990-11-28')).toContain('Melhor mês do ano chegou, Vitor!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), null).some(f => f.includes('Melhor mês'))).toBe(false);
  });

  it('a sexta anima a fechar a semana, sem o "Sextou" (16/11/2026: "remova as que desmotivam/transmitem preguiça")', () => {
    const sexta = frasesDaSaudacao('Vitor', em('2026-11-27', 9));
    expect(sexta).toContain('Vamos fechar a semana com tudo, Vitor');
    expect(sexta.some(f => f.startsWith('Sextou'))).toBe(false);
    expect(frasesDaSaudacao('Vitor', em('2026-11-26', 9))).not.toContain('Vamos fechar a semana com tudo, Vitor');
  });

  it('a semana com feriado sem contagem nem ansiedade pelo descanso (16/11/2026)', () => {
    // segunda 16/11: a Consciência Negra na sexta 20/11
    expect(feriadoDaSemana(em('2026-11-16', 9))).toMatchObject({ dias: 4, diaDaSemana: 5 });
    expect(frasesDaSaudacao('Vitor', em('2026-11-16', 9))).toContain('Semana mais curta, Vitor. Vamos adiantar as entregas');
    expect(frasesDaSaudacao('Vitor', em('2026-11-20', 9))).toContain('Hoje é feriado, Vitor. Obrigado pela dedicação');
    // o feriado no domingo (15/11) não muda a semana
    expect(frasesDaSaudacao('Vitor', em('2026-11-12', 9)).some(f => /feriado|semana mais curta/i.test(f))).toBe(false);
    // da sexta, a segunda seguinte entra (o 07/09); o ponto facultativo não conta; semana sem feriado, nada
    expect(feriadoDaSemana(em('2026-09-04', 9))).toMatchObject({ dias: 3, diaDaSemana: 1 });
    expect(feriadoDaSemana(em('2026-06-01', 9))?.feriado.nome).not.toBe('Corpus Christi');
    expect(feriadoDaSemana(em('2026-11-24', 9))).toBeNull();
  });

  it('nenhuma frase conta o tempo para o descanso', () => {
    const dias = ['2026-11-12', '2026-11-16', '2026-11-19', '2026-11-20', '2026-11-27', '2026-09-04'];
    const todas = dias.flatMap(d => [9, 15, 21].flatMap(h => frasesDaSaudacao('Vitor', em(d, h))));
    expect(todas.filter(f => /sextou|feriadão|amanhã|churrasco|ansiedade|não colou|descansar|já foi/i.test(f))).toEqual([]);
  });

  it('no dia do aniversário, só os parabéns', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), '13/11')).toEqual(['Feliz aniversário, Vitor!']);
  });

  it('a mesma frase no mesmo turno; pode mudar em outro turno ou dia', () => {
    const o = { nome: 'Vitor', quem: 'u1' };
    expect(saudacao({ ...o, agora: em('2026-11-13', 8) })).toBe(saudacao({ ...o, agora: em('2026-11-13', 11) }));
    const doDia = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17', '2026-11-18'].map(dia => saudacao({ ...o, agora: em(dia, 9) })));
    expect(doDia.size).toBeGreaterThan(1);
  });
});
