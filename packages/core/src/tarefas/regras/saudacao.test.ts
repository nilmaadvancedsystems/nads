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

  it('sextou na sexta (15/11/2026: "se tiver sexta, coloca sextou tbm")', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-27', 9))).toContain('Sextou, Vitor!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-26', 9)).some(f => f.startsWith('Sextou'))).toBe(false);
  });

  it('a piada da semana com feriado (15/11/2026: "coloca algo de piada se tiver feriado na semana")', () => {
    // segunda 16/11: a Consciência Negra na sexta 20/11, o feriadão
    expect(feriadoDaSemana(em('2026-11-16', 9))).toMatchObject({ dias: 4, diaDaSemana: 5 });
    const segunda = frasesDaSaudacao('Vitor', em('2026-11-16', 9));
    expect(segunda).toContain('Feriado na sexta, Vitor! Semana boa');
    expect(segunda).toContain('Feriadão vem aí, Vitor!');
    // a véspera e o próprio dia
    expect(frasesDaSaudacao('Vitor', em('2026-11-19', 9))).toContain('Amanhã é feriado, Vitor! Força');
    expect(frasesDaSaudacao('Vitor', em('2026-11-20', 9))).toContain('Feriado e você aqui, Vitor?');
    // o feriado no domingo (15/11) não colou
    expect(frasesDaSaudacao('Vitor', em('2026-11-12', 9))).toContain('Feriado no domingo, Vitor? Não colou');
    // da sexta, a segunda seguinte entra (o feriadão de Tiradentes não é segunda; o de 07/09 é)
    expect(feriadoDaSemana(em('2026-09-04', 9))).toMatchObject({ dias: 3, diaDaSemana: 1 });
    // o ponto facultativo não conta; semana sem feriado, nada
    expect(feriadoDaSemana(em('2026-06-01', 9))?.feriado.nome).not.toBe('Corpus Christi');
    expect(feriadoDaSemana(em('2026-11-24', 9))).toBeNull();
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
