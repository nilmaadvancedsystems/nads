// O ajuste das etapas por empresa (plano do Acessórias, ficha E08) e o regime com data de início (ficha E10), na rotina.
import { afterEach, describe, expect, it } from 'vitest';
import { ajustarEtapa, cadastroDoDocumento, cadastroVazio, definirRegime, tirarMudancaDeRegime, documentoDoCadastro, regimeNaCompetencia, mudarRegime, type AjustesDasEtapas, type CadastroDaEmpresa } from '../../empresas/cadastro';
import { prazoDaEtapa } from './prazos';
import { ajusteDaEtapa, etapaNoMes, execucaoNova, regimeDaEmpresa, usarAjustesDoCadastro, usarRegimesDoCadastro } from './execucao';
import { resumoPorEtapa } from './visao';
import { ROTINA_FISCAL } from '../rotinas/fiscal';

const AGORA = new Date(2026, 10, 25, 12);
const ex = (competencia: string) => execucaoNova('Teste', 9001, competencia, 'fiscal');

afterEach(() => { usarAjustesDoCadastro(() => undefined); usarRegimesDoCadastro(() => ''); });

describe('etapa ligada ou desligada por empresa (E08)', () => {
  it('"não tem, desde 11/2026": some de 11/2026 em diante; 10/2026 continua com a etapa', () => {
    usarRegimesDoCadastro(() => 'Presumido');
    const ajustes: AjustesDasEtapas = { fiscal: { 'fiscal-iss': { ligada: false, desde: '2026-11' } } };
    usarAjustesDoCadastro(c => (c === 9001 ? ajustes : undefined));
    expect(etapaNoMes(ex('2026-10'), 'fiscal-iss')).toBe(true);
    expect(etapaNoMes(ex('2026-11'), 'fiscal-iss')).toBe(false);
    expect(etapaNoMes(ex('2026-12'), 'fiscal-iss')).toBe(false);
  });
  it('"tem": uma etapa do Presumido entra numa empresa do Simples', () => {
    usarRegimesDoCadastro(() => 'Simples');
    expect(etapaNoMes(ex('2026-11'), 'fiscal-piscofins')).toBe(false);
    usarAjustesDoCadastro(() => ({ fiscal: { 'fiscal-piscofins': { ligada: true } } }));
    expect(etapaNoMes(ex('2026-11'), 'fiscal-piscofins')).toBe(true);
  });
  it('o ajuste de outro setor não vale; a retirada do mês vale por cima do "tem"', () => {
    usarRegimesDoCadastro(() => 'Simples');
    usarAjustesDoCadastro(() => ({ contabil: { 'fiscal-piscofins': { ligada: true } } }));
    expect(etapaNoMes(ex('2026-11'), 'fiscal-piscofins')).toBe(false);
    usarAjustesDoCadastro(() => ({ fiscal: { 'fiscal-piscofins': { ligada: true } } }));
    expect(etapaNoMes({ ...ex('2026-11'), retiradas: ['fiscal-piscofins'] }, 'fiscal-piscofins')).toBe(false);
  });
  it('só o dia do prazo não muda se a etapa entra', () => {
    usarRegimesDoCadastro(() => 'Simples');
    usarAjustesDoCadastro(() => ({ fiscal: { 'fiscal-piscofins': { dia: 15 } } }));
    expect(etapaNoMes(ex('2026-11'), 'fiscal-piscofins')).toBe(false);
    expect(ajusteDaEtapa(ex('2026-11'), 'fiscal-piscofins')).toEqual({ dia: 15 });
  });
  it('o dia do prazo da empresa no lugar do da tabela', () => {
    expect(prazoDaEtapa('fiscal', 'fiscal-iss', '2026-10')?.legal).toBe('2026-11-10');
    expect(prazoDaEtapa('fiscal', 'fiscal-iss', '2026-10', 16)?.legal).toBe('2026-11-16');
  });
  it('a visão de cima conta a etapa só nas empresas que a têm', () => {
    usarRegimesDoCadastro(() => 'Presumido');
    usarAjustesDoCadastro(c => (c === 9001 ? { fiscal: { 'fiscal-iss': { ligada: false } } } : undefined));
    const r = resumoPorEtapa([], ROTINA_FISCAL, 2, [9001, 9002], '2026-11').find(x => x.etapa === 'fiscal-iss')!;
    expect(r.total).toBe(1);
  });
});

describe('ajustarEtapa (E08)', () => {
  it('grava, registra no histórico e volta para a rotina', () => {
    const c = ajustarEtapa(cadastroVazio('Teste', 9001), 'fiscal', 'fiscal-iss', { ligada: false, desde: '2026-11' }, 'ISS', 'Ana', AGORA);
    expect(c.etapas).toEqual({ fiscal: { 'fiscal-iss': { ligada: false, desde: '2026-11' } } });
    expect(c.historico[0]).toMatchObject({ acao: 'Obrigação', detalhe: 'Fiscal › ISS: não tem, desde 11/2026' });
    expect(ajustarEtapa(c, 'fiscal', 'fiscal-iss', { ligada: false, desde: '2026-11' }, 'ISS', 'Ana', AGORA)).toBe(c);
    const volta = ajustarEtapa(c, 'fiscal', 'fiscal-iss', null, 'ISS', 'Ana', AGORA);
    expect(volta.etapas).toBeUndefined();
    expect(volta.historico[0].detalhe).toBe('Fiscal › ISS: como a rotina');
    expect(() => ajustarEtapa(c, 'fiscal', 'fiscal-iss', { dia: 32 }, 'ISS', 'Ana', AGORA)).toThrow();
    expect(() => ajustarEtapa(c, 'fiscal', 'fiscal-iss', { ligada: true, desde: '2026-13' }, 'ISS', 'Ana', AGORA)).toThrow();
  });
});

describe('regime com data de início (E10)', () => {
  const simples = (): CadastroDaEmpresa => ({ ...cadastroVazio('Teste', 9001), regime: 'Simples' });

  it('Simples até 12/2026 e Presumido desde 01/2027: cada mês com o seu', () => {
    const c = mudarRegime(simples(), 'Presumido', '2027-01', 'Simples', 'Ana', AGORA);
    expect(c.regimes).toEqual([{ regime: 'Simples', desde: '' }, { regime: 'Presumido', desde: '2027-01' }]);
    expect(c.regime).toBe('Simples'); // a troca ainda não chegou
    expect(regimeNaCompetencia(c, '2026-12')).toBe('Simples');
    expect(regimeNaCompetencia(c, '2027-01')).toBe('Presumido');
    expect(c.historico[0]).toMatchObject({ acao: 'Regime', detalhe: 'Simples → Presumido, a partir de 01/2027' });
    // na rotina: o PGDAS em 12/2026 e o PIS/COFINS em 01/2027
    usarRegimesDoCadastro((_codigo, competencia) => (competencia ? regimeNaCompetencia(c, competencia) : c.regime || ''));
    expect(etapaNoMes(ex('2026-12'), 'fiscal-simples')).toBe(true);
    expect(etapaNoMes(ex('2026-12'), 'fiscal-piscofins')).toBe(false);
    expect(etapaNoMes(ex('2027-01'), 'fiscal-simples')).toBe(false);
    expect(etapaNoMes(ex('2027-01'), 'fiscal-piscofins')).toBe(true);
    expect(regimeDaEmpresa(9001)).toBe('Simples');
  });
  it('a troca que já vale muda o regime de hoje; sem lista, vale o regime', () => {
    const c = mudarRegime(simples(), 'Presumido', '2026-11', 'Simples', 'Ana', AGORA);
    expect(c.regime).toBe('Presumido');
    expect(regimeNaCompetencia(c, '2026-10')).toBe('Simples');
    expect(regimeNaCompetencia(simples(), '2020-01')).toBe('Simples');
  });
  it('desfazer a troca e voltar para a lista tiram as datas; com datas, escolher vale deste mês em diante', () => {
    const c = mudarRegime(simples(), 'Presumido', '2027-01', 'Simples', 'Ana', AGORA);
    const desfeita = tirarMudancaDeRegime(c, '2027-01', 'Ana', AGORA);
    expect(desfeita.regimes).toBeUndefined();
    expect(desfeita.regime).toBe('Simples');
    const real = definirRegime(c, 'Real', 'Ana', AGORA);
    expect(real.regimes).toEqual([{ regime: 'Simples', desde: '' }, { regime: 'Real', desde: '2026-11' }, { regime: 'Presumido', desde: '2027-01' }]);
    expect(real.regime).toBe('Real');
    const lista = definirRegime(c, null, 'Ana', AGORA);
    expect(lista.regimes).toBeUndefined();
    expect(lista.regime).toBeUndefined();
  });
  it('o documento guarda e lê as trocas e os ajustes (e larga o que está torto)', () => {
    const c = { ...mudarRegime(simples(), 'Presumido', '2027-01', 'Simples', 'Ana', AGORA), etapas: { fiscal: { 'fiscal-iss': { ligada: false, desde: '2026-11' } } } };
    const doc = documentoDoCadastro(c);
    const lido = cadastroDoDocumento('Teste', 9001, doc);
    expect(lido.regimes).toEqual(c.regimes);
    expect(lido.etapas).toEqual(c.etapas);
    const torto = cadastroDoDocumento('Teste', 9001, { ...doc, regimes: [{ regime: 'Xis', desde: '2027-01' }], etapas: { dp: { a: { ligada: true } }, fiscal: { b: { dia: 40 } } } });
    expect(torto.regimes).toBeUndefined();
    expect(torto.etapas).toBeUndefined();
  });
});
