import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { impostosDoAno, planilhaDosImpostos, quadroDosImpostos } from './impostosDoAno';

const g = (tipo: string, competencia: string, valor: number, tributo?: string) => ({ tipo: tipo as 'DAS', competencia, valor, ...(tributo ? { tributo } : {}) });
const guias = [g('DAS', '2026-10', 1000), g('DAS', '2026-11', 500.5), g('DARF', '2026-10', 200, 'IRRF'), g('FGTS', '2026-10', 300), g('DAS', '2025-12', 999)];

describe('os impostos do ano (2A.15)', () => {
  it('só as guias do ano, por imposto e mês, o maior primeiro', () => {
    const l = impostosDoAno(guias, 2026);
    expect(l.map(x => [x.imposto, x.total])).toEqual([['DAS', 1500.5], ['FGTS', 300], ['DARF IRRF', 200]]);
  });
  it('o quadro: faturamento das empresas somado, a folha, cada imposto, o total e o %; até o mês de hoje', () => {
    const q = quadroDosImpostos({
      ano: 2026, hoje: new Date(2026, 10, 23),
      faturamento: [{ meses: [{ competencia: '2026-10', total: 10000 }, { competencia: '2026-11', total: null }] }, { meses: [{ competencia: '2026-10', total: 5000 }] }],
      folha: [{ competencia: '2026-10', base: 4000 }],
      guias,
    });
    expect(q.colunas).toEqual(['DAS', 'FGTS', 'DARF IRRF']);
    expect(q.meses.length).toBe(11);
    const out = q.meses[9];
    expect([out.faturamento, out.folha, out.impostos, out.total, out.porcento]).toEqual([15000, 4000, [1000, 300, 200], 1500, 0.1]);
    expect(q.meses[10].faturamento).toBeNull();
    expect([q.totais.faturamento, q.totais.folha, q.totais.total]).toEqual([15000, 4000, 2000.5]);
    expect(q.temDado).toBe(true);
  });
  it('mais de 6 impostos: o resto em "Outras guias"', () => {
    const muitas = ['DAS', 'DAE', 'DAM', 'FGTS', 'GPS', 'ISS', 'TAXA', 'ALVARA'].map((t, i) => g(t, '2026-03', 100 - i));
    const q = quadroDosImpostos({ ano: 2026, hoje: new Date(2026, 5, 1), faturamento: [], folha: [], guias: muitas });
    expect(q.colunas.length).toBe(7);
    expect(q.colunas[6]).toBe('Outras guias');
    expect(q.meses[2].impostos[6]).toBe(93 + 94);
  });
  it('a planilha diz que é das guias emitidas e fecha o total', () => {
    const q = quadroDosImpostos({ ano: 2026, hoje: new Date(2026, 10, 23), faturamento: [], folha: [], guias });
    const wb = XLSX.read(planilhaDosImpostos('PADARIA BOA', q), { type: 'array' });
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(String(aoa[1][0])).toContain('guias que o escritório emitiu');
    expect(aoa[3]).toEqual(['Mês', 'Faturamento (notas)', 'Folha (base do FGTS)', 'DAS', 'FGTS', 'DARF IRRF', 'Total das guias', '% do faturamento']);
    expect(aoa[aoa.length - 1][6]).toBe(2000.5);
  });
});
