import { describe, expect, it } from 'vitest';
import { ROTINA_FISCAL } from './fiscal';
import { rotinaDo } from './rotinaDo';

describe('rotina do Fiscal (o Notion do Heverton)', () => {
  it('os grupos na ordem: Importação de Notas, Conferência, Apuração, Envio', () => {
    expect([...new Set(ROTINA_FISCAL.etapas.map(e => e.secao))]).toEqual(['Importação de Notas', 'Conferência', 'Apuração', 'Envio']);
  });
  it('toda etapa é um checklist, com ids únicos', () => {
    for (const e of ROTINA_FISCAL.etapas) {
      expect(e.checklist?.length).toBeGreaterThan(0);
      expect(new Set(e.checklist?.map(i => i.id)).size).toBe(e.checklist?.length);
    }
    expect(new Set(ROTINA_FISCAL.etapas.map(e => e.id)).size).toBe(ROTINA_FISCAL.etapas.length);
  });
  it('cada departamento com a sua rotina', () => {
    expect(rotinaDo('fiscal')).toBe(ROTINA_FISCAL);
    expect(rotinaDo('contabil')?.departamento).toBe('contabil');
    expect(rotinaDo('dp')).toBeNull();
  });
});
