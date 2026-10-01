import { describe, expect, it } from 'vitest';
import { requisitosDaImportacao } from './requisitos';

const TUDO = { balancete: true, entradas: true, saidas: true, tomados: true, prestados: true };

describe('requisitos para seguir da Importação', () => {
  it('bancos Ok e tudo importado: pronto', () => {
    expect(requisitosDaImportacao([{ nome: 'Sicoob', ok: true, semMovimento: false }], TUDO, true)).toEqual({ pronto: true, faltam: [] });
  });
  it('banco sem Ok e o que não foi importado: falta', () => {
    const r = requisitosDaImportacao([{ nome: 'Sicoob', ok: false, semMovimento: false }, { nome: 'Itaú', ok: false, semMovimento: true }],
      { ...TUDO, saidas: false, prestados: false }, true);
    expect(r).toEqual({ pronto: false, faltam: ['Sicoob: extrato e razão batendo', 'Saídas', 'Prestados'] });
  });
  it('Prestados só se a empresa presta serviço; a Conferência sem carregar não está pronta', () => {
    expect(requisitosDaImportacao([], { ...TUDO, prestados: false }, false).pronto).toBe(true);
    expect(requisitosDaImportacao([], { ...TUDO, prestados: false }, null).pronto).toBe(true);
    expect(requisitosDaImportacao([], null, false)).toEqual({ pronto: false, faltam: ['a Conferência carregar'] });
  });
});
