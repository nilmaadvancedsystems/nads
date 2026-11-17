// Testes das regras curtas do Faturamento (16/11/2026: "muita informação").
import { describe, expect, it } from 'vitest';
import { dicaDasNotas, leituraDoBanco, semAno, textoDoDia } from './faturamentoEnxuto';

describe('semAno', () => {
  it('tira o ano do mês por extenso e deixa em minúscula', () => {
    expect(semAno('Setembro de 2026')).toBe('setembro');
    expect(semAno('Dezembro de 2025')).toBe('dezembro');
    expect(semAno('março')).toBe('março');
  });
});

describe('textoDoDia (o dia em foco numa frase)', () => {
  it('o melhor dia ganha o "Melhor dia:" na frente', () => {
    expect(textoDoDia('Sábado, 3 de outubro', true)).toBe('Melhor dia: sábado, 3 de outubro');
    expect(textoDoDia('sábado, 3 de outubro', true)).toBe('Melhor dia: sábado, 3 de outubro');
  });
  it('outro dia: só a data, com a primeira letra maiúscula', () => {
    expect(textoDoDia('sexta, 15 de outubro', false)).toBe('Sexta, 15 de outubro');
    expect(textoDoDia('  ', false)).toBe('');
  });
});

describe('dicaDasNotas', () => {
  it('a média por nota; as canceladas só quando houver', () => {
    expect(dicaDasNotas('R$ 343,73', 0)).toBe('R$ 343,73 por nota');
    expect(dicaDasNotas('R$ 343,73', 1)).toBe('R$ 343,73 por nota · 1 cancelada');
    expect(dicaDasNotas('R$ 343,73', 3)).toBe('R$ 343,73 por nota · 3 canceladas');
  });
  it('sem média (mês sem nota): só as canceladas ou nada', () => {
    expect(dicaDasNotas(null, 2)).toBe('2 canceladas');
    expect(dicaDasNotas(null, 0)).toBe('');
  });
});

describe('leituraDoBanco', () => {
  it('acompanhou o faturado: só a parte que entrou', () => {
    expect(leituraDoBanco({ cobertura: '94%', leitura: 'O que entrou no banco acompanha o faturado.', tom: 'bom' })).toEqual({ forte: '94% do faturado entrou no banco.', resto: '' });
  });
  it('pede atenção: a parte e a explicação', () => {
    const l = 'Entrou menos do que o faturado: vendas a prazo, cartão a receber ou pagamento em dinheiro.';
    expect(leituraDoBanco({ cobertura: '70%', leitura: l, tom: 'atencao' })).toEqual({ forte: '70% do faturado entrou no banco.', resto: l });
  });
  it('sem a parte (sem extrato, sem nota): só a explicação', () => {
    expect(leituraDoBanco({ cobertura: '', leitura: 'O escritório ainda não leu os extratos deste mês.', tom: 'neutro' })).toEqual({ forte: '', resto: 'O escritório ainda não leu os extratos deste mês.' });
  });
});
