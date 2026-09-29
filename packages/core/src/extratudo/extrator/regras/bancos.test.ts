import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { adicionarBanco, arquivosDoBanco, bancosNaCompetencia } from './bancos';

const agora = new Date('2026-09-29T12:00:00Z');
const arq = (id: string, lado: 'banco' | 'sistema', data: string, banco?: string): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: agora.toISOString(), modo: 'primeira', lancamentos: [{ data, valor: 100, historico: 'PIX' }], ...(banco ? { banco } : {}) });
const emp = (arquivos: ArquivoImportado[] = []): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria: [] });
const SICOOB = [{ id: 'sicoob', nome: 'Sicoob' }];
const GENERICO = [{ id: 'banco', nome: 'Banco' }];

describe('bancos da empresa no Extrator', () => {
  it('adicionado vale da competência em diante; fica na auditoria; não repete', () => {
    let e = adicionarBanco(emp(), { id: 'itau', nome: 'Itaú' }, '2026-08', agora);
    e = adicionarBanco(e, { id: 'itau', nome: 'Itaú' }, '2026-09', agora);
    expect(e.bancos).toEqual([{ id: 'itau', nome: 'Itaú', desde: '2026-08' }]);
    expect(e.auditoria[0]).toMatchObject({ acao: 'Adicionou banco', detalhe: 'Itaú · a partir de 08/2026' });
    expect(bancosNaCompetencia(e, SICOOB, '2026-07').map(b => b.id)).toEqual(['sicoob']);
    expect(bancosNaCompetencia(e, SICOOB, '2026-08').map(b => b.id)).toEqual(['sicoob', 'itau']);
  });
  it('conta com agência: id próprio, aparece no nome da auditoria', () => {
    const e = adicionarBanco(emp(), { id: 'itau-3001-123456', nome: 'Itaú', marca: 'itau', agencia: '3001', conta: '12345-6' }, '2026-08', agora);
    expect(e.auditoria[0].detalhe).toBe('Itaú · Ag. 3001 · C/C 12345-6 · a partir de 08/2026');
    expect(bancosNaCompetencia(e, SICOOB, '2026-08')[1]).toEqual({ id: 'itau-3001-123456', nome: 'Itaú', marca: 'itau', agencia: '3001', conta: '12345-6' });
  });
  it('a linha genérica sai quando há banco adicionado e ela não tem arquivo', () => {
    const e = adicionarBanco(emp(), { id: 'itau', nome: 'Itaú' }, '2026-08', agora);
    expect(bancosNaCompetencia(e, GENERICO, '2026-08').map(b => b.id)).toEqual(['itau']);
    const comArquivo = { ...e, arquivos: [arq('a', 'banco', '2026-07-10')] };
    expect(bancosNaCompetencia(comArquivo, GENERICO, '2026-08').map(b => b.id)).toEqual(['banco', 'itau']);
  });
  it('arquivos de cada banco e lado na competência (sem banco = do primeiro)', () => {
    const e = emp([arq('a', 'banco', '2026-08-01'), arq('b', 'banco', '2026-08-02', 'itau'), arq('c', 'banco', '2026-07-30')]);
    expect(arquivosDoBanco(e, 'sicoob', 'sicoob', 'banco', '2026-08').map(a => a.id)).toEqual(['a']);
    expect(arquivosDoBanco(e, 'itau', 'sicoob', 'banco', '2026-08').map(a => a.id)).toEqual(['b']);
  });
});
