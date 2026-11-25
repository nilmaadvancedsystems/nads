import { afterEach, describe, expect, it } from 'vitest';
import { ROTINA_FISCAL } from '../rotinas/fiscal';
import { execucaoNova, usarAjustesDoCadastro, usarRegimesDoCadastro } from './execucao';
import { pendenciasDaEmpresa, resumoDasPendencias } from './pendenciasNaTroca';
import type { Execucao } from '../tipos';

const EMPRESA = { nome: 'Teste', codigo: 9001 };
afterEach(() => { usarRegimesDoCadastro(() => ''); usarAjustesDoCadastro(() => undefined); });

describe('pendências na troca de responsável (M02)', () => {
  it('Simples em 10/2026: o DAS (dia 20, feriado: vai para 23/11) está atrasado em 24/11 e no prazo interno em 18/11; feito, sai', () => {
    usarRegimesDoCadastro(() => 'Simples');
    const atrasado = pendenciasDaEmpresa(null, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-24');
    expect(atrasado.find(p => p.etapa === 'fiscal-simples')).toMatchObject({ tipo: 'atrasada', legal: '2026-11-23' });
    // as do Presumido não entram no Simples
    expect(atrasado.some(p => p.etapa === 'fiscal-piscofins')).toBe(false);
    const interno = pendenciasDaEmpresa(null, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-18');
    expect(interno.find(p => p.etapa === 'fiscal-simples')?.tipo).toBe('no-interno');
    const feito: Execucao = { ...execucaoNova('Teste', 9001, '2026-10', 'fiscal'), etapas: { 'fiscal-simples': { situacao: 'feita', em: '2026-11-15T10:00:00Z', por: 'Ana' } } } as Execucao;
    expect(pendenciasDaEmpresa(feito, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-24').some(p => p.etapa === 'fiscal-simples')).toBe(false);
  });
  it('a parada sem prazo conta como parada; o dia da empresa muda o atraso', () => {
    usarRegimesDoCadastro(() => 'Simples');
    const parada = { ...execucaoNova('Teste', 9001, '2026-10', 'fiscal'), etapas: { 'fiscal-conf-saidas': { situacao: 'interrompida', em: '2026-11-03T10:00:00Z', por: 'Ana' } } } as Execucao;
    expect(pendenciasDaEmpresa(parada, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-05').find(p => p.etapa === 'fiscal-conf-saidas')?.tipo).toBe('parada');
    expect(pendenciasDaEmpresa(null, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-26').find(p => p.etapa === 'fiscal-simples')?.tipo).toBe('atrasada');
    // dia 28 (sábado): vai para 30/11; o interno é 25/11
    usarAjustesDoCadastro(() => ({ fiscal: { 'fiscal-simples': { dia: 28 } } }));
    expect(pendenciasDaEmpresa(null, EMPRESA, ROTINA_FISCAL, '2026-10', '2026-11-26').find(p => p.etapa === 'fiscal-simples')?.tipo).toBe('no-interno');
  });
  it('o resumo numa frase', () => {
    expect(resumoDasPendencias([])).toBe('');
    expect(resumoDasPendencias([{ etapa: 'a', nome: 'A', tipo: 'atrasada' }])).toBe('1 atrasada');
    expect(resumoDasPendencias([
      { etapa: 'a', nome: 'A', tipo: 'atrasada' }, { etapa: 'b', nome: 'B', tipo: 'atrasada' },
      { etapa: 'c', nome: 'C', tipo: 'no-interno' }, { etapa: 'd', nome: 'D', tipo: 'parada' },
    ])).toBe('2 atrasadas, 1 no prazo interno e 1 parada');
  });
});
