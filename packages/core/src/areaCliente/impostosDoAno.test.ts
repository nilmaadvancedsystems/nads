import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { impostosDoAno, planilhaDosImpostos } from './impostosDoAno';

const g = (tipo: string, competencia: string, valor: number, tributo?: string) => ({ tipo: tipo as 'DAS', competencia, valor, ...(tributo ? { tributo } : {}) });

describe('os impostos das guias do ano (2A.15)', () => {
  const guias = [g('DAS', '2026-10', 1000), g('DAS', '2026-11', 500.5), g('DARF', '2026-10', 200, 'IRRF'), g('FGTS', '2026-10', 300), g('DAS', '2025-12', 999)];
  it('só as guias do ano, por imposto e mês, o maior primeiro', () => {
    const l = impostosDoAno(guias, 2026);
    expect(l.map(x => [x.imposto, x.total])).toEqual([['DAS', 1500.5], ['FGTS', 300], ['DARF IRRF', 200]]);
    expect(l[0].meses[9]).toBe(1000);
    expect(l[0].meses[10]).toBe(500.5);
  });
  it('a planilha diz que é das guias emitidas e fecha o total', () => {
    const wb = XLSX.read(planilhaDosImpostos('PADARIA BOA', guias, 2026), { type: 'array' });
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(String(aoa[1][0])).toContain('guias emitidas');
    expect(String(aoa[1][0])).not.toMatch(/quanto paguei/i);
    expect(aoa[aoa.length - 1][13]).toBe(2000.5);
  });
});
