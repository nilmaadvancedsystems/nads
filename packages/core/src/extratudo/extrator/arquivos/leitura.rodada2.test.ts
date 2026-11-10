// Rodada 2: a decodificação do OFX e do CSV (UTF-8, ou Windows-1252 quando o UTF-8 não serve). Dados fictícios.
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { abasDaPlanilha, lerArquivo } from './leitura';

const utf8 = (s: string) => new TextEncoder().encode(s);
/** latin1 cobre os acentos usados aqui (o que o Windows-1252 grava igual) */
const cp1252 = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260105<TRNAMT>-10.50<MEMO>AÇOUGUE SÃO JOÃO</STMTTRN></BANKTRANLIST></OFX>';
const csv = 'Data;Histórico;Valor\n05/01/2026;AÇOUGUE SÃO JOÃO;-10,50\n';

describe('os acentos do OFX', () => {
  it('em UTF-8', async () => {
    const r = await lerArquivo('e.ofx', utf8(ofx), 'banco', 2026);
    expect(r.lancamentos).toEqual([{ data: '2026-01-05', valor: -1050, historico: 'AÇOUGUE SÃO JOÃO' }]);
  });
  it('em Windows-1252 continua certo', async () => {
    const r = await lerArquivo('e.ofx', cp1252(ofx), 'banco', 2026);
    expect(r.lancamentos[0].historico).toBe('AÇOUGUE SÃO JOÃO');
  });
});

describe('os acentos do CSV', () => {
  it('em UTF-8 sem BOM', async () => {
    const r = await lerArquivo('r.csv', utf8(csv), 'sistema', 2026);
    expect(r.lancamentos.map(l => [l.valor, l.historico])).toEqual([[-1050, 'AÇOUGUE SÃO JOÃO']]);
  });
  it('em Windows-1252 continua certo', () => {
    expect(abasDaPlanilha(cp1252(csv), true)[0][1][1]).toBe('AÇOUGUE SÃO JOÃO');
  });
  it('o BOM do UTF-8 não entra no título da 1ª coluna', () => {
    expect(abasDaPlanilha(utf8(String.fromCharCode(0xfeff) + csv), true)[0][0][0]).toBe('Data');
  });
  it('o "Texto Unicode" do Excel (UTF-16 com BOM) continua sendo lido', () => {
    const utf16 = Uint8Array.from([0xff, 0xfe, ...[...'Data\tHistórico\r\n05/01/2026\tAÇOUGUE\r\n'].flatMap(c => [c.charCodeAt(0), 0])]);
    expect(abasDaPlanilha(utf16, true)[0][1][1]).toBe('AÇOUGUE');
  });
  it('a planilha de verdade com a extensão .csv continua sendo lida pelos bytes', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Data', 'Histórico'], ['05/01/2026', 'AÇOUGUE']]), 'A');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(abasDaPlanilha(bytes, true)[0][1][1]).toBe('AÇOUGUE');
  });
});
