import { describe, expect, it } from 'vitest';
import type { ArquivoLido, Lancamento } from '../tipos';
import { empresaNova, importar, TAMANHO_PARA_CORTAR } from './importacao';

// um razão grande (como o do BB de um posto: ~7 mil lançamentos, mais de 1 MB): 8 meses de 900 lançamentos
const lancamentos: Lancamento[] = [];
for (let m = 1; m <= 8; m++) for (let i = 0; i < 900; i++) {
  lancamentos.push({ data: '2026-0' + m + '-' + String(1 + (i % 28)).padStart(2, '0'), valor: (i % 2 ? -1 : 1) * (1000 + i), historico: 'Cielo Vendas Débito', conta: '11005', complemento: '0000 14024 732 Cielo Vendas Débito 47.206.312.001 lançamento ' + i });
}
const lido: ArquivoLido = { nome: 'BANCO DO BRASIL.xls', lancamentos, erro: null };

describe('o arquivo grande demais para um documento do banco (Vitor, 26/10/2026: o razão do BB da 237 sumia)', () => {
  it('entra cortado por mês, cada pedaço abaixo do limite, sem perder lançamento', () => {
    let n = 0;
    const r = importar(empresaNova('t'), 'sistema', [lido], 'primeira', new Date('2026-10-26T12:00:00Z'), () => 'a' + ++n);
    expect(JSON.stringify(lancamentos).length).toBeGreaterThan(1_048_576);
    expect(r.empresa.arquivos.length).toBe(8);
    expect(r.empresa.arquivos.every(a => JSON.stringify(a).length < TAMANHO_PARA_CORTAR)).toBe(true);
    expect(r.empresa.arquivos.flatMap(a => a.lancamentos)).toEqual(lancamentos);
    expect(r.gravados).toBe(7200);
    expect(r.arquivos).toBe(1);
  });
  it('o arquivo pequeno continua inteiro', () => {
    const r = importar(empresaNova('t'), 'sistema', [{ ...lido, lancamentos: lancamentos.slice(0, 50) }], 'primeira', new Date(), () => 'b');
    expect(r.empresa.arquivos.map(a => a.id)).toEqual(['b']);
  });
});
