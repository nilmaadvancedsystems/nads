// O Registro mais enxuto (16/11/2026: "muita informação"): o resumo de dois fatos, a frase curta das férias e a nota.
import { describe, expect, it } from 'vitest';
import { donoQueNaoRepete, fraseCurtaDasFerias, notaDasFerias, resumoDoRegistro } from './registroEnxuto';

describe('resumoDoRegistro', () => {
  it('no máximo dois fatos: os ativos e as férias urgentes, que levam à aba Férias', () => {
    expect(resumoDoRegistro({ ativos: 5, paraTirar: 3, urgentes: 1 })).toEqual([
      { valor: '5', depois: 'funcionários ativos' },
      { valor: '1', depois: 'com férias para tirar logo', tom: 'atencao', aba: 'ferias' },
    ]);
  });
  it('sem urgência, quantas férias dá para tirar', () => {
    expect(resumoDoRegistro({ ativos: 1, paraTirar: 2, urgentes: 0 })).toEqual([
      { valor: '1', depois: 'funcionário ativo' },
      { valor: '2', depois: 'com férias para tirar', aba: 'ferias' },
    ]);
  });
  it('sem férias para tirar, só os ativos', () => {
    expect(resumoDoRegistro({ ativos: 0, paraTirar: 0, urgentes: 0 })).toEqual([{ valor: '0', depois: 'funcionários ativos' }]);
  });
});

describe('fraseCurtaDasFerias', () => {
  it('só a data, sem os dias e o período aquisitivo', () => {
    expect(fraseCurtaDasFerias('Tirar até 15/05/2026 · 10 dias a tirar · período 15/06/2024 a 14/06/2025')).toBe('Tirar até 15/05/2026');
    expect(fraseCurtaDasFerias('Venceu em 10/2026 · período 03/2024 a 02/2025')).toBe('Venceu em 10/2026');
    expect(fraseCurtaDasFerias('Férias em dia · as próximas a partir de 03/2027')).toBe('Férias em dia');
  });
  it('a marca do holerite, em poucas palavras', () => {
    expect(fraseCurtaDasFerias('O holerite marca férias vencidas · Pode tirar até 03/2027 · período 03/2025 a 02/2026')).toBe('Vencidas, pelo holerite');
  });
  it('sem texto, vazio', () => {
    expect(fraseCurtaDasFerias('')).toBe('');
  });
});

describe('notaDasFerias', () => {
  it('uma frase só', () => {
    expect(notaDasFerias('folha')).toBe('Férias vencidas são pagas em dobro.');
    expect(notaDasFerias('guias')).toMatch(/^As datas são uma estimativa/);
    expect(notaDasFerias('misto')).toBe(notaDasFerias('guias'));
  });
});

describe('donoQueNaoRepete', () => {
  it('some quando o nome do arquivo já diz de quem é', () => {
    expect(donoQueNaoRepete('Recibo de Férias - Carlos Eduardo', 'Carlos Eduardo Santos')).toBe('');
    expect(donoQueNaoRepete('Cartao de ponto - JOAO', 'João Pereira')).toBe('');
  });
  it('fica quando o nome do arquivo não diz', () => {
    expect(donoQueNaoRepete('Atestado 10-2026', 'Ana Luiza Ferreira')).toBe('Ana Luiza Ferreira');
    expect(donoQueNaoRepete('Folha de pagamento 10-2026', '')).toBe('');
  });
});
