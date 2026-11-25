// Os prazos do mês (plano do Acessórias, ficha E04).
import { afterEach, describe, expect, it } from 'vitest';
import { ROTINA_FISCAL } from '../rotinas/fiscal';
import type { EstadoEtapa, Execucao } from '../tipos';
import { execucaoNova, usarRegimesDoCadastro } from './execucao';
import { contarPrazos, linhasDoMes, situacaoDoPrazo } from './situacaoDoPrazo';

const HOJE = '2026-11-17';
const feita = (em: string): EstadoEtapa => ({ situacao: 'feita', por: 'Ana', em });
afterEach(() => usarRegimesDoCadastro(() => ''));

describe('situação do prazo (E04)', () => {
  it('as oito situações', () => {
    // legal 20/11, interno 17/11
    expect(situacaoDoPrazo(null, '2026-11-20', '2026-11-17', '2026-11-10')).toBe('a-fazer');
    expect(situacaoDoPrazo(null, '2026-11-20', '2026-11-17', HOJE)).toBe('prazo-interno');
    expect(situacaoDoPrazo({ situacao: 'interrompida', por: 'Ana', em: '2026-11-01T12:00:00Z' }, '2026-11-10', '2026-11-05', HOJE)).toBe('atrasada');
    expect(situacaoDoPrazo(feita('2026-11-03T12:00:00Z'), '2026-11-20', '2026-11-17', HOJE)).toBe('entregue-antes');
    expect(situacaoDoPrazo(feita('2026-11-18T12:00:00Z'), '2026-11-20', '2026-11-17', HOJE)).toBe('entregue-no-prazo');
    expect(situacaoDoPrazo(feita('2026-11-21T12:00:00Z'), '2026-11-20', '2026-11-17', HOJE)).toBe('entregue-com-atraso');
    expect(situacaoDoPrazo({ situacao: 'dispensada', por: 'Ana', em: '2026-11-01T12:00:00Z' }, '2026-11-20', '2026-11-17', HOJE)).toBe('dispensada');
    expect(situacaoDoPrazo(null, null, null, HOJE)).toBe('sem-prazo');
  });
  it('feita no dia exato do legal = no prazo (pelo dia de Brasília: 23h de Brasília ainda é o mesmo dia)', () => {
    expect(situacaoDoPrazo(feita('2026-11-21T01:30:00Z'), '2026-11-20', '2026-11-17', HOJE)).toBe('entregue-no-prazo');
  });
});

describe('linhas do mês (E04)', () => {
  const entrada = (execucoes: Execucao[]) => ({
    execucoes, departamento: 'fiscal' as const, competencia: '2026-10', hoje: '2026-11-24',
    empresas: [{ nome: 'Simples', codigo: 9001 }, { nome: 'Presumido', codigo: 9002 }],
    etapasDaEmpresa: () => ROTINA_FISCAL.etapas, responsavelDe: (e: { codigo: number | null }) => (e.codigo === 9001 ? 'Ana' : 'Bia'),
  });
  it('a empresa do Simples não tem PIS/COFINS; a sem execução no mês entra (não some); o responsável vem junto', () => {
    usarRegimesDoCadastro(c => (c === 9001 ? 'Simples' : 'Presumido'));
    const l = linhasDoMes(entrada([]));
    expect(l.some(x => x.codigo === 9001 && x.etapa === 'fiscal-piscofins')).toBe(false);
    expect(l.some(x => x.codigo === 9002 && x.etapa === 'fiscal-piscofins')).toBe(true);
    const das = l.find(x => x.codigo === 9001 && x.etapa === 'fiscal-simples')!;
    expect(das).toMatchObject({ situacao: 'atrasada', legal: '2026-11-23', responsavel: 'Ana' });
    // só as etapas com prazo
    expect(l.every(x => x.legal)).toBe(true);
  });
  it('a feita mostra quem e quando; contar soma certo', () => {
    usarRegimesDoCadastro(() => 'Simples');
    const ex = { ...execucaoNova('Simples', 9001, '2026-10', 'fiscal'), etapas: { 'fiscal-simples': feita('2026-11-12T15:00:00Z') } } as Execucao;
    const l = linhasDoMes(entrada([ex]));
    const das = l.find(x => x.codigo === 9001 && x.etapa === 'fiscal-simples')!;
    expect(das).toMatchObject({ situacao: 'entregue-antes', feitaPor: 'Ana', feitaEm: '2026-11-12' });
    const c = contarPrazos(l);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(l.length);
    expect(c['entregue-antes']).toBe(1);
  });
});
