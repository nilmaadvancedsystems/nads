import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { excluirMesesDoArquivo, relerExtrato, VERSAO_DO_LEITOR } from './importacao';

const l = (data: string, valor: number): Lancamento => ({ data, valor, historico: 'H ' + data });
const agora = new Date('2026-10-21T12:00:00Z');

// o extrato que o cliente mandou quebrado: 12/2025 a 02/2026 num PDF só, com o saldo anterior e os saldos do dia
const PDF: ArquivoImportado = {
  id: 'x', lado: 'banco', nome: 'Extrato_12.2025 a 02.2026.pdf', importadoEm: '2026-10-21', modo: 'primeira', banco: 'itau',
  saldoAnterior: 1000, drive: { id: 'd1', nome: 'Extrato_12.2025 a 02.2026.pdf' },
  lancamentos: [l('2025-12-10', 500), l('2026-01-05', -200), l('2026-01-20', 300), l('2026-02-03', -100)],
  saldosDoDia: [{ data: '2025-12-10', saldo: 1500 }, { data: '2026-01-05', saldo: 1300 }, { data: '2026-01-20', saldo: 1600 }, { data: '2026-02-03', saldo: 1500 }],
};
const OUTRO: ArquivoImportado = { id: 'y', lado: 'sistema', nome: 'razao.xls', importadoEm: '2026-10-21', modo: 'primeira', lancamentos: [l('2026-01-05', -200)] };
const empresa = (...arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'Teste', arquivos, auditoria: [] });

describe('excluir só o mês do arquivo', () => {
  it('corta o arquivo por mês: o mês escolhido sai, os outros ficam com o saldo anterior e os saldos do dia deles', () => {
    const e = excluirMesesDoArquivo(empresa(PDF, OUTRO), 'x', ['2025-12'], agora);
    expect(e.arquivos.map(a => a.id)).toEqual(['x|2026-01', 'x|2026-02', 'y']);
    const [jan, fev] = e.arquivos;
    expect(jan.lancamentos).toEqual([l('2026-01-05', -200), l('2026-01-20', 300)]);
    expect(jan.saldoAnterior).toBe(1500);
    expect(jan.saldosDoDia?.map(s => s.data)).toEqual(['2026-01-05', '2026-01-20']);
    expect(fev.saldoAnterior).toBe(1600);
    expect(fev.drive).toEqual(PDF.drive);
    expect(e.auditoria[0].acao).toBe('Excluiu o mês do arquivo');
    expect(e.auditoria[0].detalhe).toContain('12/2025');
  });
  it('o mês do meio também (no razão é igual: sem saldo)', () => {
    const e = excluirMesesDoArquivo(empresa({ ...PDF, lado: 'sistema', saldoAnterior: undefined, saldosDoDia: undefined }), 'x', ['2026-01'], agora);
    expect(e.arquivos.map(a => [a.id, a.lancamentos.length, a.saldoAnterior])).toEqual([['x|2025-12', 1, undefined], ['x|2026-02', 1, undefined]]);
  });
  it('sem mês que fique, sai o arquivo inteiro; mês que o arquivo não tem, nada muda', () => {
    expect(excluirMesesDoArquivo(empresa(PDF, OUTRO), 'x', ['2025-12', '2026-01', '2026-02'], agora).arquivos.map(a => a.id)).toEqual(['y']);
    const e = empresa(PDF);
    expect(excluirMesesDoArquivo(e, 'x', ['2026-05'], agora)).toBe(e);
  });
  it('o pedaço que veio do Drive, relido pelo leitor novo, fica só com o mês dele e o saldo anterior certo', () => {
    const cortada = excluirMesesDoArquivo(empresa({ ...PDF, leitor: 1 }), 'x', ['2025-12'], agora);
    const lido = { nome: PDF.nome, erro: null, saldoAnterior: 1000, lancamentos: PDF.lancamentos, saldosDoDia: PDF.saldosDoDia };
    const e = relerExtrato(cortada, 'x|2026-02', lido, agora);
    const fev = e.arquivos.find(a => a.id === 'x|2026-02')!;
    expect(fev.leitor).toBe(VERSAO_DO_LEITOR);
    expect(fev.saldoAnterior).toBe(1600);
    expect(fev.saldosDoDia?.map(s => s.data)).toEqual(['2026-02-03']);
  });
});
