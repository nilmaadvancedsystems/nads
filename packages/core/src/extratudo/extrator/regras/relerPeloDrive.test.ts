import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator, Lancamento } from '../tipos';
import { extratosParaRelerPeloDrive, leituraCobreOArquivo, VERSAO_DO_LEITOR } from './importacao';

const l = (data: string, valor: number): Lancamento => ({ data, valor, historico: 'H' });
const arq = (id: string, lancamentos: Lancamento[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado =>
  ({ id, lado: 'banco', nome: id + '.pdf', importadoEm: '2026-10-01', modo: 'primeira', lancamentos, ...extra });
const lido = (lancamentos: Lancamento[]): ArquivoLido => ({ nome: 'x.pdf', lancamentos, erro: null });
const tres = (mes: string) => [l(mes + '-01', 1), l(mes + '-02', 2), l(mes + '-03', 3)];

describe('o importado do computador relido pelo PDF do Drive (Vitor, 26/10/2026)', () => {
  it('só o extrato em PDF ou imagem, sem o Drive, lido por um leitor mais velho', () => {
    const e: EmpresaExtrator = { nome: 'T', auditoria: [], arquivos: [
      arq('velho', tres('2026-01'), { leitor: VERSAO_DO_LEITOR - 1 }),
      arq('semVersao', tres('2026-01')),
      arq('novo', tres('2026-01'), { leitor: VERSAO_DO_LEITOR }),
      arq('doDrive', tres('2026-01'), { leitor: 1, drive: { id: 'd', nome: 'd.pdf' } }),
      arq('razao', tres('2026-01'), { lado: 'sistema' }),
      { ...arq('ofx', tres('2026-01')), nome: 'extrato.ofx' },
    ] };
    expect(extratosParaRelerPeloDrive(e).map(a => a.id)).toEqual(['velho', 'semVersao']);
  });
  it('troca só quando a leitura cobre os meses com 3 ou mais lançamentos (o lançamento falso do leitor velho pode sumir)', () => {
    const junho = arq('j', [...tres('2026-06'), l('2026-07-27', 6767888)]);
    expect(leituraCobreOArquivo(junho, lido(tres('2026-06')))).toBe(true);
    const doisMeses = arq('s', [...tres('2026-01'), ...tres('2026-02')]);
    expect(leituraCobreOArquivo(doisMeses, lido(tres('2026-01')))).toBe(false);
    expect(leituraCobreOArquivo(doisMeses, lido([...tres('2026-01'), ...tres('2026-02')]))).toBe(true);
    expect(leituraCobreOArquivo(junho, lido([]))).toBe(false);
    expect(leituraCobreOArquivo(junho, { ...lido(tres('2026-06')), erro: 'falhou' })).toBe(false);
  });
});
