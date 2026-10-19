import { describe, expect, it } from 'vitest';
import { definirDriveDoArquivo } from './movimento';
import type { EmpresaExtrator } from '../tipos';

describe('o extrato que subiu para o Drive (19/10/2026)', () => {
  const e = { arquivos: [{ id: 'a1', lado: 'banco', nome: 'Extrato.pdf', importadoEm: '', modo: 'primeira', lancamentos: [] }], auditoria: [] } as unknown as EmpresaExtrator;
  it('passa a apontar para o arquivo do Drive, com o registro na auditoria', () => {
    const n = definirDriveDoArquivo(e, 'a1', { id: 'd1', nome: '06-2026.pdf' }, new Date('2026-10-19T12:00:00Z'));
    expect(n.arquivos[0].drive).toEqual({ id: 'd1', nome: '06-2026.pdf' });
    expect(n.auditoria[0].acao).toBe('Ligou ao Drive');
    // o mesmo de novo não muda nada
    expect(definirDriveDoArquivo(n, 'a1', { id: 'd1', nome: '06-2026.pdf' }, new Date())).toBe(n);
  });
});
