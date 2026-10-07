import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { planilhaXlsx } from './planilha';

describe('planilhaXlsx', () => {
  it('a aba com o cabeçalho e as linhas', () => {
    const bytes = planilhaXlsx('Obrigações', ['Cód.', 'Cliente', 'Folha'], [[462, '3M', 'Feita'], [356, 'A7', null]]);
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Obrigações']);
    expect(XLSX.utils.sheet_to_json(wb.Sheets['Obrigações'], { header: 1 })).toEqual([['Cód.', 'Cliente', 'Folha'], [462, '3M', 'Feita'], [356, 'A7', '']]);
  });
});
