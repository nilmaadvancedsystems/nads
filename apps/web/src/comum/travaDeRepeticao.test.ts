import { describe, expect, it } from 'vitest';
import { criarTravaDeRepeticao } from './travaDeRepeticao';

describe('a trava de repetição das gravações automáticas', () => {
  it('a mesma chave: na hora, depois de 1, 2, 4… min, até 1 h', () => {
    let t = 0;
    const pode = criarTravaDeRepeticao(60_000, 3_600_000, () => t);
    expect(pode('2026-10|cartoes|true')).toBe(true);
    expect(pode('2026-10|cartoes|true')).toBe(false);
    t += 59_000;
    expect(pode('2026-10|cartoes|true')).toBe(false);
    t += 1_000; // 1 min
    expect(pode('2026-10|cartoes|true')).toBe(true);
    t += 60_000; // 1 min depois: agora espera 2
    expect(pode('2026-10|cartoes|true')).toBe(false);
    t += 60_000;
    expect(pode('2026-10|cartoes|true')).toBe(true);
    // muitas voltas: a espera não passa de 1 h
    for (let i = 0; i < 20; i++) { t += 3_600_000; expect(pode('2026-10|cartoes|true')).toBe(true); }
    t += 3_599_000;
    expect(pode('2026-10|cartoes|true')).toBe(false);
  });

  it('chaves diferentes (outro mês, outra etapa, entra ou sai) não esperam uma pela outra', () => {
    const pode = criarTravaDeRepeticao(60_000, 3_600_000, () => 0);
    expect(pode('2026-10|cartoes|true')).toBe(true);
    expect(pode('2026-10|cartoes|false')).toBe(true);
    expect(pode('2026-11|cartoes|true')).toBe(true);
    expect(pode('2026-10|creditor|true')).toBe(true);
  });

  it('o ciclo do incidente (a mesma retirada pedida a cada volta, o dia todo) grava poucas vezes', () => {
    let t = 0;
    const pode = criarTravaDeRepeticao(60_000, 3_600_000, () => t);
    let gravou = 0;
    for (; t < 24 * 3_600_000; t += 200) if (pode('2026-10|adiantamento-salarial|false')) gravou++;
    expect(gravou).toBeLessThan(30);
  });
});
