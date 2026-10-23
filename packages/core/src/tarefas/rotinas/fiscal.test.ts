import { describe, expect, it } from 'vitest';
import { EMPRESAS } from '../../empresas/lista';
import { etapaNoMes, execucaoNova, regimeDaEmpresa, usarRegimesDoCadastro } from '../regras/execucao';
import { ROTINA_FISCAL } from './fiscal';
import { rotinaDo } from './rotinaDo';

// Desde 23/10/2026 a rotina do Fiscal é o fluxo operacional por regime (fluxoFiscal.ts; os testes do fluxo em
// regras/fluxoFiscal.test.ts); a rotina antiga, de checklists, fica só nos regimes sem fluxo (MEI, isentas, física e domésticas).
describe('rotina do Fiscal', () => {
  it('ids únicos; as etapas do fluxo e as antigas, cada uma no seu regime', () => {
    expect(new Set(ROTINA_FISCAL.etapas.map(e => e.id)).size).toBe(ROTINA_FISCAL.etapas.length);
    for (const e of ROTINA_FISCAL.etapas) {
      expect(e.regimes?.length).toBeGreaterThan(0);
      if (e.id.startsWith('fiscal-')) expect(e.regimes!.every(r => ['MEI', 'Isentas', 'Física', 'Domésticas'].includes(r))).toBe(true);
    }
    expect(ROTINA_FISCAL.etapas.find(e => e.id === 'fiscal-mei')?.regimes).toEqual(['MEI']);
    expect(ROTINA_FISCAL.etapas.some(e => e.id === 'fiscal-simples' || e.id === 'fiscal-icms')).toBe(false);
  });
  it('pelo regime: o Presumido no fluxo dele; o IRPJ/CSLL trimestral só no fim do trimestre', () => {
    const ex = (codigo: number, competencia: string) => execucaoNova('X', codigo, competencia, 'fiscal');
    // 292 é Presumido (lista de empresas)
    expect(regimeDaEmpresa(292)).toBe('Presumido');
    expect(etapaNoMes(ex(292, '2026-09'), 'fp-4-icms')).toBe(true);
    expect(etapaNoMes(ex(292, '2026-09'), 'fs-6-das')).toBe(false);
    expect(etapaNoMes(ex(292, '2026-09'), 'fiscal-mei')).toBe(false);
    expect(etapaNoMes(ex(292, '2026-09'), 'fp-5-irpj')).toBe(true);
    expect(etapaNoMes(ex(292, '2026-10'), 'fp-5-irpj')).toBe(false);
    const simples = EMPRESAS.find(e => e.codigo != null && regimeDaEmpresa(e.codigo) === 'Simples');
    if (simples?.codigo != null) expect(etapaNoMes(ex(simples.codigo, '2026-09'), 'fs-6-das')).toBe(true);
  });
  it('o regime do cadastro vale no lugar do da lista (13/10/2026)', () => {
    const ex = execucaoNova('X', 292, '2026-10', 'fiscal');
    usarRegimesDoCadastro(c => (c === 292 ? 'Simples' : ''));
    try {
      expect(regimeDaEmpresa(292)).toBe('Simples');
      expect(etapaNoMes(ex, 'fs-6-das')).toBe(true);
      expect(etapaNoMes(ex, 'fp-4-icms')).toBe(false);
    } finally { usarRegimesDoCadastro(() => ''); }
    expect(regimeDaEmpresa(292)).toBe('Presumido');
  });
  it('cada departamento com a sua rotina', () => {
    expect(rotinaDo('fiscal')).toBe(ROTINA_FISCAL);
    expect(rotinaDo('contabil')?.departamento).toBe('contabil');
    expect(rotinaDo('dp')?.departamento).toBe('dp');
  });
});
