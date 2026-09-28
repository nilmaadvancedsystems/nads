import { describe, expect, it } from 'vitest';
import type { IdBandeira } from '../tipos';
import { bandeira, BANDEIRAS } from './bandeiras';

describe('bandeiras', () => {
  it('na ordem do original, com rótulo e slug', () => {
    expect(BANDEIRAS.map(b => b.id)).toEqual(['cielo', 'rede', 'getnet', 'stone', 'pagbank']);
    expect(bandeira('pagbank')).toEqual({ id: 'pagbank', rotulo: 'PagBank', slug: 'pagbank' });
    expect(() => bandeira('visa' as IdBandeira)).toThrow();
  });
});
