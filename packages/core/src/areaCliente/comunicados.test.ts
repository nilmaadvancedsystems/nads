import { describe, expect, it } from 'vitest';
import { comunicadosDoLink, erroDoComunicado, lerComunicado, type Comunicado } from './comunicados';

const base: Comunicado = { id: 'c1', titulo: 'Recesso de fim de ano', texto: 'O escritório fecha de 24/12 a 02/01.', alvo: { todos: true }, publicarEm: '2026-12-01', ate: '2027-01-02', por: 'Vitor', atualizadoEm: '' };

describe('os comunicados aos clientes', () => {
  it('o erro do comunicado', () => {
    expect(erroDoComunicado(base)).toBe('');
    expect(erroDoComunicado({ ...base, titulo: '' })).not.toBe('');
    expect(erroDoComunicado({ ...base, texto: 'x'.repeat(601) })).not.toBe('');
    expect(erroDoComunicado({ ...base, ate: '2026-11-01' })).not.toBe('');
    expect(erroDoComunicado({ ...base, alvo: { regimes: [] } })).not.toBe('');
  });
  it('só dentro do período e só para o alvo', () => {
    const empresas = [{ codigo: 292, regime: 'Simples' }];
    expect(comunicadosDoLink([base], empresas, '2026-11-30')).toEqual([]);
    expect(comunicadosDoLink([base], empresas, '2026-12-10').map(c => c.id)).toEqual(['c1']);
    expect(comunicadosDoLink([base], empresas, '2027-01-03')).toEqual([]);
    expect(comunicadosDoLink([{ ...base, alvo: { regimes: ['Presumido'] } }], empresas, '2026-12-10')).toEqual([]);
    expect(comunicadosDoLink([{ ...base, alvo: { regimes: ['Simples'] } }], empresas, '2026-12-10').length).toBe(1);
    expect(comunicadosDoLink([{ ...base, alvo: { codigos: [515] } }], empresas, '2026-12-10')).toEqual([]);
    expect(comunicadosDoLink([{ ...base, alvo: { codigos: [292] } }], empresas, '2026-12-10')[0]).toEqual({ id: 'c1', titulo: 'Recesso de fim de ano', texto: 'O escritório fecha de 24/12 a 02/01.', ate: '2027-01-02' });
  });
  it('a leitura joga fora o torto', () => {
    expect(lerComunicado('c1', { ...base })?.titulo).toBe('Recesso de fim de ano');
    expect(lerComunicado('c1', { ...base, alvo: {} })).toBeNull();
    expect(lerComunicado('c1', { ...base, titulo: '' })).toBeNull();
  });
});
