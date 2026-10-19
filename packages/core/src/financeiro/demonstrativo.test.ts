import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { linhasDoDemonstrativo, nomeDoDemonstrativo, planilhaDoDemonstrativo, type ContaDoPlano, type LancamentoDeCaixa } from './index';

const l = (id: string, data: string, tipo: 'E' | 'S', valor: number, obs?: string): LancamentoDeCaixa => ({ id, data, descricao: 'Item ' + id, valor, tipo, observacoes: obs, origem: 'nads', criadoEm: '', criadoPor: '' });
const conta: ContaDoPlano = { id: 'c', codigo: '4.1.01', descricao: 'Honorários', tipo: 'RECEITA', nivel: 3, pai: null, ativo: true, movimentavel: true };
const entrada = (filtrado: boolean) => ({
  de: '2026-10-01', ate: '2026-10-19', saldoInicial: 500.1, filtrado,
  itens: [{ lancamento: l('1', '2026-10-02', 'E', 100.2, 'obs'), conta }, { lancamento: l('2', '2026-10-03', 'S', 30.15) }],
});

describe('o demonstrativo de caixa', () => {
  it('monta o título, saldo inicial, cabeçalho, linhas, totais e saldo final', () => {
    const r = linhasDoDemonstrativo(entrada(false));
    expect(r.linhas[0]).toEqual(['Demonstrativo de Caixa — 01/10/2026 a 19/10/2026']);
    expect(r.linhas[2]).toEqual(['', 'Saldo inicial', '', 500.1]);
    expect(r.linhas[3]).toEqual(['Data', 'Histórico', 'Conta', 'Entradas', 'Saídas', 'Observações']);
    expect(r.linhas[4]).toEqual(['02/10/2026', 'Item 1', '4.1.01 Honorários', 100.2, '', 'obs']);
    expect(r.linhas[5]).toEqual(['03/10/2026', 'Item 2', '', '', 30.15, '']);
    expect(r.linhas[6]).toEqual(['', 'Totais', '', 100.2, 30.15]);
    expect(r.linhas[7]).toEqual(['', 'Saldo final', '', 570.15]);
    expect(r.linhas).toHaveLength(8);
  });
  it('avisa na última linha quando há filtro', () => {
    const r = linhasDoDemonstrativo(entrada(true));
    expect(r.linhas.at(-1)![0]).toMatch(/considera só as linhas listadas/);
  });
  it('gera o xlsx com os números formatados', () => {
    const wb = XLSX.read(planilhaDoDemonstrativo(entrada(false)), { type: 'array', cellNF: true });
    const ws = wb.Sheets['Caixa'];
    expect(ws['D5'].v).toBe(100.2);
    expect(String(ws['D5'].z)).toContain('R$');
    expect(nomeDoDemonstrativo('2026-10-01', '2026-10-19')).toBe('Caixa 2026-10-01 a 2026-10-19.xlsx');
  });
});
