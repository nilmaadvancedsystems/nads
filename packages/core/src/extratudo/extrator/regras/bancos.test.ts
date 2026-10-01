import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { adicionarBanco, arquivosDoBanco, bancoOkNoPeriodo, bancosDaEmpresaNa, bancosNaCompetencia } from './bancos';

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

describe('bancos do Cadastro no Extrator', () => {
  const cadastro = (bancos: { id: string; marca: string; nome: string; desde?: string; ate?: string }[] | null) =>
    ({ nome: 'FITO', codigo: 292, bancos, contasPadrao: null, historico: [] });

  it('sem cadastro, como antes (a lista provisória e os adicionados na tela)', () => {
    const e = { ...emp(), bancos: [{ id: 'itau-1-2', nome: 'Itaú', marca: 'itau', desde: '2026-08' }] };
    const r = bancosDaEmpresaNa(e, null, 292, '2026-08');
    expect(r.bancos.map(b => b.id)).toEqual(['sicoob', 'itau-1-2']);
    expect(r.primeiro).toBe('sicoob');
    expect(bancosDaEmpresaNa(e, cadastro(null), 292, '2026-08').primeiro).toBe('sicoob');
  });

  it('com cadastro, as contas que valem na competência (os adicionados de antes ficam de fora)', () => {
    const e = { ...emp(), bancos: [{ id: 'velho', nome: 'Velho', desde: '2026-01' }] };
    const c = cadastro([{ id: 'sicoob', marca: 'sicoob', nome: 'Sicoob' }, { id: 'itau-1-2', marca: 'itau', nome: 'Itaú', desde: '2026-09' }]);
    expect(bancosDaEmpresaNa(e, c, 292, '2026-08').bancos.map(b => b.id)).toEqual(['sicoob']);
    expect(bancosDaEmpresaNa(e, c, 292, '2026-09').bancos.map(b => b.id)).toEqual(['sicoob', 'itau-1-2']);
  });

  it('arquivo da linha genérica "Banco" vai para o primeiro banco do cadastro', () => {
    const e = emp([arq('a', 'banco', '2026-08-03', 'banco'), arq('b', 'banco', '2026-08-04')]);
    const c = cadastro([{ id: 'itau-1-2', marca: 'itau', nome: 'Itaú' }]);
    const { primeiro } = bancosDaEmpresaNa(e, c, null, '2026-08');
    expect(arquivosDoBanco(e, 'itau-1-2', primeiro, 'banco', '2026-08').map(a => a.id)).toEqual(['a', 'b']);
    expect(bancosDaEmpresaNa(e, cadastro([]), null, '2026-08')).toEqual({ bancos: GENERICO, primeiro: 'banco' });
  });
});

describe('banco Ok no período (extrato e razão batem)', () => {
  const MESES = ['2026-07', '2026-08'];
  it('todo mês com extrato e razão iguais: Ok', () => {
    const e = emp([arq('e7', 'banco', '2026-07-10'), arq('r7', 'sistema', '2026-07-10'), arq('e8', 'banco', '2026-08-05'), arq('r8', 'sistema', '2026-08-05')]);
    expect(bancoOkNoPeriodo(e, 'sicoob', 'sicoob', MESES)).toBe(true);
  });
  it('falta o razão de um mês, ou sobra pendência: não está Ok', () => {
    const semRazao = emp([arq('e7', 'banco', '2026-07-10'), arq('r7', 'sistema', '2026-07-10'), arq('e8', 'banco', '2026-08-05')]);
    expect(bancoOkNoPeriodo(semRazao, 'sicoob', 'sicoob', MESES)).toBe(false);
    const dataDiferente = emp([arq('e7', 'banco', '2026-07-10'), arq('r7', 'sistema', '2026-07-11'), arq('e8', 'banco', '2026-08-05'), arq('r8', 'sistema', '2026-08-05')]);
    expect(bancoOkNoPeriodo(dataDiferente, 'sicoob', 'sicoob', MESES)).toBe(false);
  });
  it('mês sem movimento fica de fora; só sem movimento, não está Ok', () => {
    const e = emp([arq('e7', 'banco', '2026-07-10'), arq('r7', 'sistema', '2026-07-10')]);
    expect(bancoOkNoPeriodo(e, 'sicoob', 'sicoob', MESES, ['2026-08'])).toBe(true);
    expect(bancoOkNoPeriodo(emp(), 'sicoob', 'sicoob', MESES, MESES)).toBe(false);
  });
});
