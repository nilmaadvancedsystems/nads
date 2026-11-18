// As certidões na Área do Cliente (plano do Acessórias, 18/11/2026, ficha certidoes).
import { describe, expect, it } from 'vitest';
import { certidaoParaAvisar, orgaoDaCertidao, ultimaPorOrgao, validadeDaCertidao } from './certidoes';

describe('as certidões', () => {
  it('o órgão pela pasta', () => {
    expect(orgaoDaCertidao('FEDERAL')).toBe('Federal');
    expect(orgaoDaCertidao('União')).toBe('Federal');
    expect(orgaoDaCertidao('TRABALHISTA')).toBe('Trabalhista');
    expect(orgaoDaCertidao('FGTS')).toBe('FGTS');
    expect(orgaoDaCertidao('Municipal')).toBe('Municipal');
  });
  it('a validade pelo nome do arquivador', () => {
    expect(validadeDaCertidao('VENC 15-12-2026.pdf')).toBe('2026-12-15');
    expect(validadeDaCertidao('15-12-2026.pdf')).toBe('2026-12-15');
    expect(validadeDaCertidao('VENCIMENTO 01.02.2027')).toBe('2027-02-01');
    expect(validadeDaCertidao('certidao negativa.pdf')).toBeNull();
    expect(validadeDaCertidao('VENC 31-02-2026.pdf')).toBeNull();
  });
  it('a última de cada órgão: a de validade mais longe; sem validade, a mais nova', () => {
    const r = ultimaPorOrgao([
      { orgao: 'Federal', nome: 'VENC 15-12-2026.pdf', modificadoEm: '2026-06-01' },
      { orgao: 'Federal', nome: 'VENC 15-06-2026.pdf', modificadoEm: '2026-12-01' },
      { orgao: 'Estadual', nome: 'a.pdf', modificadoEm: '2026-01-01' },
      { orgao: 'Estadual', nome: 'b.pdf', modificadoEm: '2026-03-01' },
    ]);
    expect(r.map(c => [c.orgao, c.nome, c.validoAte])).toEqual([['Estadual', 'b.pdf', null], ['Federal', 'VENC 15-12-2026.pdf', '2026-12-15']]);
  });
  it('o sino: vencida ou em até 15 dias', () => {
    expect(certidaoParaAvisar('2026-11-10', '2026-11-18')).toBe('vencida');
    expect(certidaoParaAvisar('2026-12-03', '2026-11-18')).toBe('vencendo');
    expect(certidaoParaAvisar('2026-12-04', '2026-11-18')).toBeNull();
    expect(certidaoParaAvisar(null, '2026-11-18')).toBeNull();
  });
});
