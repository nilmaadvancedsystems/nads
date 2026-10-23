import { describe, expect, it } from 'vitest';
import { cadastroDoDocumento, cadastroVazio, definirAliquotaDaAntecipacao, documentoDoCadastro, marcarSituacaoDaAntecipacao, type CadastroDaEmpresa } from '.';

const AGORA = new Date('2026-10-22T12:00:00Z');

describe('a antecipação do ICMS do ES no cadastro da empresa (22/10/2026)', () => {
  it('a alíquota interna fica no histórico; vazia volta à padrão; fora de 0-100, o erro', () => {
    const c = definirAliquotaDaAntecipacao(cadastroVazio('MORONI', 585), 18, 'Heverton', AGORA) as CadastroDaEmpresa;
    expect(c.antecipacaoIcmsEs).toEqual({ aliquota: 18 });
    expect(c.historico[0]).toMatchObject({ por: 'Heverton', acao: 'Antecipação ICMS-ES', detalhe: 'Alíquota interna: 18%' });
    expect(definirAliquotaDaAntecipacao(c, 18, 'Heverton', AGORA)).toBe(c);
    expect(definirAliquotaDaAntecipacao(c, 120, 'Heverton', AGORA)).toEqual({ erro: 'A alíquota vai de 0,01 a 99,99%.' });
    expect((definirAliquotaDaAntecipacao(c, null, 'Heverton', AGORA) as CadastroDaEmpresa).antecipacaoIcmsEs).toEqual({});
  });
  it('a situação de cada linha, com quem e quando, sem o histórico; vai e volta do banco', () => {
    const c = marcarSituacaoDaAntecipacao(cadastroVazio('MORONI', 585), 'CH1|2102|000|7', 'conferido', 'Heverton', AGORA);
    expect(c.antecipacaoIcmsEs?.situacoes).toEqual({ 'CH1|2102|000|7': { situacao: 'conferido', por: 'Heverton', em: AGORA.toISOString() } });
    expect(c.historico).toEqual([]);
    expect(marcarSituacaoDaAntecipacao(c, 'CH1|2102|000|7', 'conferido', 'Outro', AGORA)).toBe(c);
    expect(marcarSituacaoDaAntecipacao(c, 'CH2', 'inventada', 'Heverton', AGORA)).toBe(c);
    const doBanco = cadastroDoDocumento('MORONI', 585, documentoDoCadastro(c));
    expect(doBanco.antecipacaoIcmsEs).toEqual(c.antecipacaoIcmsEs);
    expect(cadastroDoDocumento('MORONI', 585, { ...documentoDoCadastro(c), antecipacaoIcmsEs: { situacoes: { x: { situacao: 'nada' } } } }).antecipacaoIcmsEs).toBeUndefined();
    expect('antecipacaoIcmsEs' in documentoDoCadastro(cadastroVazio('MORONI', 585))).toBe(false);
  });
});
