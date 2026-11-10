// 2ª rodada: a planilha que sai para o programa do LCDPR. Layout, ordem, acentos, zeros à frente e a ida e volta do .xls
// (BIFF8) lendo os bytes de novo. Dados fictícios; semente fixa.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { ABA_DA_PLANILHA, COLUNAS_DA_PLANILHA, linhasDaPlanilha, planilhaDoLcdpr } from './planilha';
import { dataDaCelula, numeroDaCelula } from './relatorios';
import type { Lancamento } from './tipos';

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const lanc = (id: number, data: string, valor: number, o: Partial<Lancamento> = {}): Lancamento => ({
  id, origem: 'NF', data, documento: '000123', contaDeved: '101', contaCred: '205', codHist: '7', historico: 'Compra de ração', valor, imovel: '001', tipoDoc: '4', tipoLanc: '2', cnpj: '01234567000189', produto: 'Ração', ...o,
} as unknown as Lancamento);

function reler(bytes: Uint8Array): { abas: string[]; linhas: unknown[][] } {
  const wb = XLSX.read(bytes, { type: 'array' });
  return { abas: wb.SheetNames, linhas: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }) };
}

describe('o .xls do LCDPR', () => {
  it('é BIFF8 (Excel 97), com a aba e as 13 colunas na ordem do programa', () => {
    const b = planilhaDoLcdpr([lanc(1, '2026-03-05', 10)]);
    expect([...b.slice(0, 4)]).toEqual([0xd0, 0xcf, 0x11, 0xe0]);
    const { abas, linhas } = reler(b);
    expect(abas).toEqual([ABA_DA_PLANILHA]);
    expect(linhas[0]).toEqual([...COLUNAS_DA_PLANILHA]);
    expect(linhas[1]).toHaveLength(13);
  });

  it('ida e volta: acento, cedilha, data, valor com centavos e zeros à frente ficam iguais', () => {
    const ls = [
      lanc(1, '2026-02-28', 1234.56, { historico: 'Aquisição de adubação — coração', produto: 'Maçã çãõ', documento: '000045', cnpj: '00123456000191', imovel: '007' }),
      lanc(2, '2024-02-29', 0.01, { historico: 'Ano bissexto', cnpj: '01234567890', contaDeved: '0101' }),
      lanc(3, '2026-12-31', 9999999.99, { historico: 'Fim de ano' }),
    ];
    const { linhas } = reler(planilhaDoLcdpr(ls));
    const porId = linhas.slice(1);
    expect(porId.map(l => l[1])).toEqual(['29/02/2024', '28/02/2026', '31/12/2026']);
    expect(porId.map(l => l[6])).toEqual([0.01, 1234.56, 9999999.99]);
    expect(porId[1][5]).toBe('Aquisição de adubação — coração');
    expect(porId[1][12]).toBe('Maçã çãõ');
    expect(porId[1][7]).toBe('000045');
    expect(porId[1][11]).toBe('00123456000191');
    expect(porId[1][8]).toBe('007');
    expect(porId[0][2]).toBe('0101');
    expect(porId[0][11]).toBe('01234567890');
  });

  it('a primeira coluna (Lancamento Automatico) vai vazia em toda linha', () => {
    for (const l of linhasDaPlanilha([lanc(1, '2026-01-01', 1), lanc(2, '2026-01-02', 2)]).slice(1)) expect(l[0]).toBe('');
  });

  it('em ordem de data, sem mexer na ordem dos do mesmo dia, sorteado', () => {
    const r = gerador(77);
    const ls = Array.from({ length: 400 }, (_, i) => lanc(i + 1, '2026-0' + (1 + Math.floor(r() * 3)) + '-1' + Math.floor(r() * 9), i + 1));
    const saida = linhasDaPlanilha(ls).slice(1);
    const chave = (l: (string | number)[]) => String(l[1]).split('/').reverse().join('-');
    for (let i = 1; i < saida.length; i++) {
      expect(chave(saida[i - 1]) <= chave(saida[i])).toBe(true);
      if (chave(saida[i - 1]) === chave(saida[i])) expect(Number(saida[i - 1][6])).toBeLessThan(Number(saida[i][6]));
    }
  });

  it('a soma dos valores relidos fecha em centavos com a soma do que entrou (800 linhas sorteadas)', () => {
    const r = gerador(4242);
    let soma = 0;
    const ls = Array.from({ length: 800 }, (_, i) => { const c = Math.floor(r() * 5_000_000) + 1; soma += c; return lanc(i + 1, '2026-05-10', c / 100); });
    const relidos = reler(planilhaDoLcdpr(ls)).linhas.slice(1);
    expect(relidos.reduce((t: number, l) => t + Math.round(Number(l[6]) * 100), 0)).toBe(soma);
  });

  it('o histórico ou o produto com quebra de linha saem numa linha só', () => {
    const [, l] = linhasDaPlanilha([lanc(1, '2026-03-05', 10, { historico: 'NF 12\n  ração', produto: 'Milho\r\nverde' })]);
    expect(l[5]).toBe('NF 12 ração');
    expect(l[12]).toBe('Milho verde');
  });

  it('sem lançamento nenhum: só o cabeçalho', () => {
    expect(reler(planilhaDoLcdpr([])).linhas).toEqual([[...COLUNAS_DA_PLANILHA]]);
  });
});

describe('o que volta das células', () => {
  it('a data de série e a data em texto dão o mesmo dia, nos limites do mês', () => {
    for (const [serie, iso] of [[45351, '2024-02-29'], [46022, '2025-12-31'], [46023, '2026-01-01']] as const) {
      expect(dataDaCelula(serie)).toBe(iso);
      expect(dataDaCelula(iso.split('-').reverse().join('/'))).toBe(iso);
    }
    expect(dataDaCelula('29/02/2026')).toBe('');
  });
  it('o valor em texto brasileiro', () => {
    expect(numeroDaCelula('R$ 1.234,56')).toBe(1234.56);
    expect(numeroDaCelula('1234.56')).toBe(1234.56);
    expect(numeroDaCelula('0,01')).toBe(0.01);
    expect(numeroDaCelula('')).toBe(0);
    expect(numeroDaCelula('abc')).toBe(0);
  });
});
