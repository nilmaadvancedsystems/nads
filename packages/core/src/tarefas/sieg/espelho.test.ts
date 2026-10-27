import { describe, expect, it } from 'vitest';
import { espelhoDaNota, type NotaDoSieg } from '.';

describe('o espelho da nota', () => {
  it('a chave em blocos, o que ela diz e os totais dos itens', () => {
    const n: NotaDoSieg = { tipo: 'NF-e', chave: '31261011222333000181550010000005021000000019', numero: '502', serie: '1', data: '08/09/2026', emitente: { doc: '11222333000181', nome: 'X' }, destinatario: { doc: '', nome: 'Y' }, valor: 1510,
      frete: 500, itens: [{ ncm: '1', cfop: '2102', cst: '00', cest: '', valor: 600, icms: 72 }, { ncm: '2', cfop: '2403', cst: '10', cest: '', valor: 400, ipi: 10, st: 30.5 }] };
    const e = espelhoDaNota(n);
    expect(e.titulo).toBe('NF-e 502 · série 1 · 08/09/2026');
    expect(e.chave.split(' ')).toHaveLength(11);
    expect(e.daChave).toEqual({ uf: '31', anoMes: '10/2026', modelo: '55' });
    expect(e.totais).toEqual({ produtos: 1000, icms: 72, st: 30.5, ipi: 10, frete: 500, desconto: 0, total: 1510 });
    expect(espelhoDaNota({ ...n, itens: undefined, chave: '1' }).semItens).toBe(true);
  });
});
