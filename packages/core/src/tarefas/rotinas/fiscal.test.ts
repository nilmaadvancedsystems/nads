import { describe, expect, it } from 'vitest';
import { EMPRESAS } from '../../empresas/lista';
import { etapaNoMes, execucaoNova, regimeDaEmpresa } from '../regras/execucao';
import { ROTINA_FISCAL } from './fiscal';
import { rotinaDo } from './rotinaDo';

describe('rotina do Fiscal (o Notion do Heverton)', () => {
  it('os grupos na ordem: Importação de Notas, Conferência, Apuração, Envio', () => {
    expect([...new Set(ROTINA_FISCAL.etapas.map(e => e.secao))]).toEqual(['Relatório inicial', 'Importação de Notas', 'Conferência', 'Apuração', 'Obrigações', 'Regularidade', 'Anuais', 'Envio', 'Relatório final']);
  });
  it('toda etapa é um checklist (menos a Importação, que abre a do Contábil), com ids únicos', () => {
    const imp = ROTINA_FISCAL.etapas.find(e => e.id === 'fiscal-importacao')!;
    expect(imp.ferramenta?.caminho('x')).toBe('/extratudo/x/extrator/tarefa/extratos?etapa=fiscal');
    expect(imp.ferramenta?.requisitos).toBe(true);
    for (const e of ROTINA_FISCAL.etapas) {
      if (e === imp) continue;
      expect(e.checklist?.length).toBeGreaterThan(0);
      expect(new Set(e.checklist?.map(i => i.id)).size).toBe(e.checklist?.length);
    }
    expect(new Set(ROTINA_FISCAL.etapas.map(e => e.id)).size).toBe(ROTINA_FISCAL.etapas.length);
  });
  it('pelo regime: o Simples só no Simples; ICMS e as obrigações só no Presumido e no Real; IRPJ/CSLL só no fim do trimestre', () => {
    const ex = (codigo: number, competencia: string) => execucaoNova('X', codigo, competencia, 'fiscal');
    // 292 é Presumido (lista de empresas)
    expect(regimeDaEmpresa(292)).toBe('Presumido');
    expect(etapaNoMes(ex(292, '2026-10'), 'fiscal-simples')).toBe(false);
    expect(etapaNoMes(ex(292, '2026-10'), 'fiscal-icms')).toBe(true);
    expect(etapaNoMes(ex(292, '2026-10'), 'fiscal-irpj-csll')).toBe(false);
    expect(etapaNoMes(ex(292, '2026-09'), 'fiscal-irpj-csll')).toBe(true);
    const simples = EMPRESAS.find(e => e.regime === 'Simples')!.codigo!;
    expect(etapaNoMes(ex(simples, '2026-10'), 'fiscal-simples')).toBe(true);
    expect(etapaNoMes(ex(simples, '2026-10'), 'fiscal-efd-icms')).toBe(false);
    // regime desconhecido: entra (nada some por engano); as de todos, sempre
    expect(etapaNoMes(ex(999999, '2026-10'), 'fiscal-icms')).toBe(true);
    expect(etapaNoMes(ex(292, '2026-10'), 'fiscal-envio')).toBe(true);
  });
  it('cada departamento com a sua rotina', () => {
    expect(rotinaDo('fiscal')).toBe(ROTINA_FISCAL);
    expect(rotinaDo('contabil')?.departamento).toBe('contabil');
    expect(rotinaDo('dp')?.departamento).toBe('dp');
  });
});
