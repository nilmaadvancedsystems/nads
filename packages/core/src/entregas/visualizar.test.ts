import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { comoVer, letraDaColuna, planilhaParaVer, textoParaVer, VER_MAX_BYTES } from './visualizar';

const it_ = (n: string, extra: Partial<{ s: number; t: 'd' | 'f' | 'g' }> = {}) => ({ n, t: 'f' as const, ...extra });

describe('ver o arquivo do Drive na tela', () => {
  it('planilha e texto veem na tela; PDF, imagem, pasta, Google e arquivo grande não', () => {
    expect(['Rec. 01.2026 Ouro Verde M.xls', 'Emprestimos 2026..xlsx', 'a.CSV', 'b.ods'].map(n => comoVer(it_(n)))).toEqual(['planilha', 'planilha', 'planilha', 'planilha']);
    expect(['nota.xml', 'extrato.ofx', 'leia.txt'].map(n => comoVer(it_(n)))).toEqual(['texto', 'texto', 'texto']);
    expect([comoVer(it_('guia.pdf')), comoVer(it_('foto.jpg')), comoVer(it_('PASTA', { t: 'd' })), comoVer(it_('Planilha', { t: 'g' })), comoVer(it_('grande.xlsx', { s: VER_MAX_BYTES + 1 }))]).toEqual([null, null, null, null, null]);
  });

  it('as abas da planilha, com as células como no Excel e sem as linhas vazias do fim', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Data', 'Valor'], [new Date(Date.UTC(2026, 0, 5)), 1234.5], [], []], { cellDates: true }), 'Janeiro');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['só uma']]), 'Resumo');
    const bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
    const abas = planilhaParaVer(bytes, 'x.xlsx');
    expect(abas.map(a => [a.nome, a.totalLinhas, a.colunas, a.cortada])).toEqual([['Janeiro', 2, 2, false], ['Resumo', 1, 1, false]]);
    expect(abas[0].linhas[0]).toEqual(['Data', 'Valor']);
    expect(abas[0].linhas[1][1]).toBe('1234.5');
  });

  it('CSV com acento em Windows-1252 e separador ponto e vírgula', () => {
    const bytes = new Uint8Array([...'Descrição;Valor\nJuros;1,00\n'].map(c => c.charCodeAt(0)));
    const [aba] = planilhaParaVer(bytes, 'r.csv');
    expect(aba.linhas).toEqual([['Descrição', 'Valor'], ['Juros', '1,00']]);
  });

  it('.xls que na verdade é texto (o Alterdata exporta assim): acentos e datas como estão', () => {
    const [aba] = planilhaParaVer(new TextEncoder().encode('Data;Histórico\n05/01/2026;Tarifa bancária\n'), 'Rec. 01.2026 Ouro Verde M.xls');
    expect(aba.linhas).toEqual([['Data', 'Histórico'], ['05/01/2026', 'Tarifa bancária']]);
  });

  it('texto em UTF-8; arquivo que não é planilha dá erro claro', () => {
    expect(textoParaVer(new TextEncoder().encode('<nota>São Paulo</nota>'))).toEqual({ texto: '<nota>São Paulo</nota>', cortado: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), 'A');
    const inteira = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
    expect(() => planilhaParaVer(inteira.slice(0, 200), 'cortada.xlsx')).toThrow(/não consegui ler a planilha/);
    expect([letraDaColuna(0), letraDaColuna(25), letraDaColuna(26), letraDaColuna(701)]).toEqual(['A', 'Z', 'AA', 'ZZ']);
  });
});
