import { describe, expect, it } from 'vitest';
import { cadastroDoDocumento, cadastroVazio, corrigirAliquotaDaLinhaDaAntecipacao, definirAliquotaDaAntecipacao, documentoDoCadastro, marcarSituacaoDaAntecipacao, type CadastroDaEmpresa } from '.';

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
  it('a alíquota corrigida de uma linha: no histórico, vai e volta do banco; vazia volta à da nota (ticket PK6RIE)', () => {
    const c = corrigirAliquotaDaLinhaDaAntecipacao(cadastroVazio('EMPRESA TESTE', 1), 'CH1|2102|101|0', 4, 'NF-e 100', 'Fulano', AGORA) as CadastroDaEmpresa;
    expect(c.antecipacaoIcmsEs?.aliquotas).toEqual({ 'CH1|2102|101|0': { aliquota: 4, por: 'Fulano', em: AGORA.toISOString() } });
    expect(c.historico[0]).toMatchObject({ por: 'Fulano', acao: 'Antecipação ICMS-ES', detalhe: 'Alíquota da NF-e 100: 4%' });
    expect(corrigirAliquotaDaLinhaDaAntecipacao(c, 'CH1|2102|101|0', 4, 'NF-e 100', 'Outro', AGORA)).toBe(c);
    expect(corrigirAliquotaDaLinhaDaAntecipacao(c, 'CH1|2102|101|0', 100, 'NF-e 100', 'Fulano', AGORA)).toEqual({ erro: 'A alíquota vai de 0 a 99,99%.' });
    const zero = corrigirAliquotaDaLinhaDaAntecipacao(c, 'CH2', 0, 'NF-e 200', 'Fulano', AGORA) as CadastroDaEmpresa;
    expect(zero.antecipacaoIcmsEs?.aliquotas?.CH2.aliquota).toBe(0);
    expect(cadastroDoDocumento('EMPRESA TESTE', 1, documentoDoCadastro(zero)).antecipacaoIcmsEs).toEqual(zero.antecipacaoIcmsEs);
    const volta = corrigirAliquotaDaLinhaDaAntecipacao(c, 'CH1|2102|101|0', null, 'NF-e 100', 'Fulano', AGORA) as CadastroDaEmpresa;
    expect(volta.antecipacaoIcmsEs).toEqual({});
    expect(volta.historico[0].detalhe).toBe('Alíquota da NF-e 100: a da nota');
  });
});
