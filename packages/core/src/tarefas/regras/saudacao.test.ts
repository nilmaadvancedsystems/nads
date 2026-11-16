import { describe, expect, it } from 'vitest';
import { feriadoDaSemana, frasesDaSaudacao, jeitosDeChamar, MAX_APELIDOS, mesEDia, primeiroNome, saudacao, saudacaoDoTurno, SO_O_TURNO_EM_CEM, turnoDe } from './saudacao';

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
    expect(frasesDaSaudacao('Vitor Dias', em('2026-11-24', 9))[0]).toBe('Bom dia Vitor!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 14))[0]).toBe('Boa tarde Vitor!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 21))[0]).toBe('Boa noite Vitor, bom descanso');
  });

  it('segunda-feira pergunta do final de semana; o mês do aniversário comemora; sem data, não', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-16', 9))).toContain('Como foi o final de semana Vitor?');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9))).not.toContain('Como foi o final de semana Vitor?');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), '1990-11-28')).toContain('Melhor mês do ano chegou Vitor!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), null).some(f => f.includes('Melhor mês'))).toBe(false);
  });

  it('sextou na sexta, com as que animam a fechar a semana', () => {
    const sexta = frasesDaSaudacao('Vitor', em('2026-11-27', 9));
    expect(sexta).toContain('Sextou!');
    expect(sexta).toContain('Vamos fechar a semana com tudo Vitor');
    expect(frasesDaSaudacao('Vitor', em('2026-11-26', 9)).some(f => f.startsWith('Sextou'))).toBe(false);
  });

  it('a semana com feriado, com o texto do Vitor (16/11/2026)', () => {
    // segunda 16/11: a Consciência Negra na sexta 20/11
    expect(feriadoDaSemana(em('2026-11-16', 9))).toMatchObject({ dias: 4, diaDaSemana: 5 });
    expect(frasesDaSaudacao('Vitor', em('2026-11-16', 9))).toContain('Feriado na sexta em! Ôh semana boa');
    // na terça e na quarta, nada do feriado ("deixa só na segunda e um dia antes do feriado")
    for (const dia of ['2026-11-17', '2026-11-18']) expect(frasesDaSaudacao('Vitor', em(dia, 9)).some(f => /feriado|semana mais curta/i.test(f))).toBe(false);
    // a véspera e o próprio dia
    expect(frasesDaSaudacao('Vitor', em('2026-11-19', 9))).toContain('Amanhã é feriadão, bora que bora!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-19', 9))).toContain('Vai fazer churrasco no feriado? Vai me chamar não?');
    expect(frasesDaSaudacao('Vitor', em('2026-11-20', 9))).toContain('Feriado e você aqui? Vai descansar, anda!');
    // o feriado no domingo (15/11): na segunda 09/11, não na quinta 12/11
    expect(frasesDaSaudacao('Vitor', em('2026-11-09', 9))).toContain('Feriadão no final de semana! Deu ruim :(');
    expect(frasesDaSaudacao('Vitor', em('2026-11-12', 9)).some(f => /feriad/i.test(f))).toBe(false);
    // a sexta antes do feriado na segunda (07/09) é a véspera
    expect(frasesDaSaudacao('Vitor', em('2026-09-04', 9))).toContain('Segunda é feriado Vitor! Bora que bora!');
    // da sexta, a segunda seguinte entra (o 07/09); o ponto facultativo não conta; semana sem feriado, nada
    expect(feriadoDaSemana(em('2026-09-04', 9))).toMatchObject({ dias: 3, diaDaSemana: 1 });
    expect(feriadoDaSemana(em('2026-06-01', 9))?.feriado.nome).not.toBe('Corpus Christi');
    expect(feriadoDaSemana(em('2026-11-24', 9))).toBeNull();
  });

  it('o "Segura a ansiedade" e o "Feriadão vem aí" saíram de vez (16/11/2026)', () => {
    const dias = ['2026-11-12', '2026-11-16', '2026-11-19', '2026-11-20', '2026-11-27', '2026-09-04'];
    const todas = dias.flatMap(d => [9, 15, 21].flatMap(h => frasesDaSaudacao('Vitor', em(d, h))));
    expect(todas.filter(f => /ansiedade|feriadão vem/i.test(f))).toEqual([]);
  });

  it('no dia do aniversário, só os parabéns', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-13', 9), '13/11')).toEqual(['Feliz aniversário Vitor!']);
  });

  it('o texto exato do Vitor (16/11/2026: "Corrigidas que quero exatamente")', () => {
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 9))).toEqual(expect.arrayContaining(['Vamo que vamo Vitor?', 'Eae, já tomou café?', 'Bom te ver por aqui Vitor']));
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 15))).toEqual(expect.arrayContaining(['Sol tá quente?', 'Metade do dia já foi, vamo pra cima!']));
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 21))).toEqual(expect.arrayContaining(['Obrigado pelo empenho de hoje <3', 'Tá apertado aí, né? Entendo... Mas não esqueça de você!', 'Já matou o leão do dia e já tá querendo o da noite? Descanso é importante']));
    expect(frasesDaSaudacao('Vitor', em('2026-11-27', 9))).toContain('Sexta é dia!');
    expect(frasesDaSaudacao('Vitor', em('2026-11-16', 9))).toContain('Semana mais curta, cuidado com os prazos!');
  });

  it('o apelido entra só onde pode; o nome com a inicial maiúscula', () => {
    expect(primeiroNome('ADIVÂNIA')).toBe('Adivânia');
    expect(primeiroNome('Gustavo.S')).toBe('Gustavo');
    expect(jeitosDeChamar('Vitor', ['Craque', ' ', 'vitor'])).toEqual(['Vitor', 'Craque']);
    const manha = frasesDaSaudacao('Vitor', em('2026-11-24', 9), null, 'Craque');
    expect(manha).toEqual(expect.arrayContaining(['Bom dia Craque!', 'Vamo que vamo Craque?', 'Eae, já tomou café?']));
    expect(frasesDaSaudacao('Vitor', em('2026-11-24', 21), null, 'Craque')).toContain('Boa noite Vitor, bom descanso');
    // "Não exagere nos apelidos, diminua muito e a chance de aparecer": no máximo dois, e cerca de 1 de cada 10 saudações
    expect(MAX_APELIDOS).toBe(2);
    const turnos = Array.from({ length: 365 }, (_, i) => [9, 15, 21].map(h => new Date(2026, 0, 1 + i, h, 30))).flat();
    const ditas = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'].flatMap(quem =>
      turnos.map(agora => saudacao({ nome: 'Vitor', quem, agora, apelidos: ['Craque', 'Fera', 'Terceiro'] })));
    const comApelido = ditas.filter(t => /Craque|Fera/.test(t)).length;
    expect(ditas.some(t => t.includes('Terceiro'))).toBe(false);
    expect(comApelido).toBeGreaterThan(0);
    // só nas frases raras, e nelas 1 em 10: bem menos de 1 em 100
    expect(comApelido / ditas.length).toBeLessThan(0.01);
    const o = { nome: 'Vitor', quem: 'u1', apelidos: ['Craque', 'Fera', 'Terceiro'] };
    // simulando com apelido (o ⚡), ele sai sempre que a frase tem lugar para ele
    expect(saudacao({ ...o, agora: new Date(2026, 10, 24, 9, 30), simulando: true, troca: 0 })).toBe('Bom dia Craque!');
  });

  it('a mesma frase no mesmo turno; pode mudar em outro turno ou dia', () => {
    const o = { nome: 'Vitor', quem: 'u1' };
    expect(saudacao({ ...o, agora: em('2026-11-13', 8) })).toBe(saudacao({ ...o, agora: em('2026-11-13', 11) }));
    const doAno = new Set(Array.from({ length: 365 }, (_, i) => saudacao({ ...o, agora: new Date(2026, 0, 1 + i, 9, 30) })));
    expect(doAno.size).toBeGreaterThan(1);
  });

  it('na grande maioria das vezes, só bom dia, boa tarde e boa noite (16/11/2026: "o resto deixa muito raro")', () => {
    const turnos = Array.from({ length: 365 }, (_, i) => [9, 15, 21].map(h => new Date(2026, 0, 1 + i, h, 30))).flat();
    let doTurno = 0, total = 0;
    for (const quem of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10']) {
      for (const agora of turnos) {
        total++;
        if (saudacao({ nome: 'Vitor', quem, agora }) === saudacaoDoTurno('Vitor', agora)) doTurno++;
      }
    }
    expect(SO_O_TURNO_EM_CEM).toBe(88);
    expect(doTurno / total).toBeGreaterThanOrEqual(0.85);
    expect(doTurno / total).toBeLessThanOrEqual(0.9);
    expect(saudacaoDoTurno('Vitor', em('2026-11-24', 21))).toBe('Boa noite Vitor, bom descanso');
    // o dia do aniversário continua só com os parabéns
    expect(saudacao({ nome: 'Vitor', quem: 'u1', agora: em('2026-11-13', 9), aniversario: '13/11' })).toBe('Feliz aniversário Vitor!');
  });
});
