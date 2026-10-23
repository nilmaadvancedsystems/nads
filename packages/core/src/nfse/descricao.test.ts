import { describe, expect, it } from 'vitest';
import { competenciaAnterior, CONFIG_PADRAO, DESCRICAO_PADRAO, descricaoDaNota, descricaoPadrao, modeloDaDescricao } from './index';

describe('a descrição automática das notas', () => {
  it('sem modelo, o texto da nota real do escritório', () => {
    expect(CONFIG_PADRAO.descricao).toBe(DESCRICAO_PADRAO);
    expect(descricaoDaNota('', '2026-09')).toBe('Serviços Contábeis Ref. 09/2026');
    expect(modeloDaDescricao(undefined)).toBe(DESCRICAO_PADRAO);
    expect(modeloDaDescricao('   ')).toBe(DESCRICAO_PADRAO);
  });
  it('troca a competência, o mês por extenso e o ano', () => {
    expect(descricaoDaNota('Honorários de {mes}/{ano} (Ref. {competencia})', '2026-03')).toBe('Honorários de março/2026 (Ref. 03/2026)');
    expect(descricaoDaNota('Assessoria {desconhecida} {competencia}', '2026-12-31')).toBe('Assessoria {desconhecida} 12/2026');
  });
  it('sem competência, não deixa o "Ref." pendurado', () => {
    expect(descricaoDaNota(DESCRICAO_PADRAO, '')).toBe('Serviços Contábeis');
  });
  it('a competência é o mês anterior à data', () => {
    expect(competenciaAnterior('2026-10-23')).toBe('2026-09');
    expect(competenciaAnterior('2026-01-05')).toBe('2025-12');
    expect(competenciaAnterior('')).toBe('');
    expect(descricaoPadrao('2026-10-20', 'Contabilidade {mes} de {ano}')).toBe('Contabilidade setembro de 2026');
  });
});
