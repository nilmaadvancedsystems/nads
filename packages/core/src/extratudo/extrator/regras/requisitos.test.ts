import { describe, expect, it } from 'vitest';
import { requisitosDaImportacao, requisitosDoChequeEspecial } from './requisitos';

const TUDO = { balancete: true, entradas: true, saidas: true, tomados: true, prestados: true };

describe('requisitos para seguir da Importação', () => {
  it('bancos Ok e tudo importado: pronto', () => {
    expect(requisitosDaImportacao([{ nome: 'Sicoob', ok: true, semMovimento: false }], TUDO, true)).toEqual({ pronto: true, faltam: [], alvos: [] });
  });
  it('banco sem Ok e o que não foi importado: falta', () => {
    const r = requisitosDaImportacao([{ nome: 'Sicoob', ok: false, semMovimento: false }, { nome: 'Itaú', ok: false, semMovimento: true }],
      { ...TUDO, saidas: false, prestados: false }, true);
    expect(r).toEqual({ pronto: false, faltam: ['Sicoob: extrato e razão batendo', 'Saídas', 'Prestados'], alvos: [null, 'aba:saidas', 'aba:prestados'] });
  });
  it('Prestados só se a empresa presta serviço; a Conferência sem carregar não está pronta', () => {
    expect(requisitosDaImportacao([], { ...TUDO, prestados: false }, false).pronto).toBe(true);
    expect(requisitosDaImportacao([], { ...TUDO, prestados: false }, null).pronto).toBe(true);
    expect(requisitosDaImportacao([], null, false)).toEqual({ pronto: false, faltam: ['a Conferência carregar'], alvos: [null] });
  });
});

describe('requisitos da etapa Cheque especial', () => {
  it('na Importação, o banco que só falta o cheque passa; no Cheque especial, não', () => {
    expect(requisitosDaImportacao([{ nome: 'Sicoob', ok: false, semMovimento: false, faltaCheque: true }], TUDO, false).pronto).toBe(true);
    expect(requisitosDoChequeEspecial([{ nome: 'Sicoob', ok: false, semMovimento: false, diasSemCheque: 3 }]))
      .toEqual({ pronto: false, faltam: ['Sicoob: o cheque especial de 3 dias negativos e o razão importado de novo'], alvos: [null] });
    expect(requisitosDoChequeEspecial([{ nome: 'Sicoob', ok: true, semMovimento: false, diasSemCheque: 0 }]).pronto).toBe(true);
  });
  it('o banco com id diz onde resolver', () => {
    expect(requisitosDaImportacao([{ id: 'sicoob', nome: 'Sicoob', ok: false, semMovimento: false }], TUDO, false).alvos).toEqual(['banco:sicoob']);
  });
});
