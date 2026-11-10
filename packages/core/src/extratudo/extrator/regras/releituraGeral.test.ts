import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator, Lancamento } from '../tipos';
import { VERSAO_DO_LEITOR } from './importacao';
import { aplicarReleituras } from './releituraGeral';

const l = (data: string, valor = 100): Lancamento => ({ data, valor, historico: 'H' });
const arquivo = (id: string, datas: string[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado => ({
  id, lado: 'banco', nome: id + '.pdf', importadoEm: '2026-11-01T00:00:00Z', modo: 'primeira', lancamentos: datas.map(d => l(d)), leitor: 1, drive: { id: 'd' + id, nome: id + '.pdf' }, ...extra,
});
const empresa = (...arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'X', arquivos, auditoria: [] });
const lido = (lancamentos: Lancamento[], extra: Partial<ArquivoLido> = {}): ArquivoLido => ({ nome: 'n.pdf', lancamentos, erro: null, ...extra });
const agora = new Date('2026-11-10T12:00:00Z');
const tresDias = (m: string) => [m + '-05', m + '-06', m + '-07'];

describe('a releitura de todas as empresas', () => {
  it('troca a leitura, marca o leitor novo e conta o que não fecha com o saldo', () => {
    const e = empresa(arquivo('a', tresDias('2026-01')));
    const naoFecha = { conferidos: 3, naoFecham: 1, exemplos: [{ data: '2026-01-06', impresso: 300, calculado: 200 }] };
    const r = aplicarReleituras(e, new Map([['a', lido([l('2026-01-05', 150), l('2026-01-06', 50)], { conferenciaPeloSaldo: naoFecha })]]), agora);
    expect(r.relidos).toBe(1);
    expect(r.naoFecham).toEqual(['a.pdf']);
    expect(r.empresa.arquivos[0].leitor).toBe(VERSAO_DO_LEITOR);
    expect(r.empresa.arquivos[0].lancamentos.map(x => x.valor)).toEqual([150, 50]);
  });

  it('não troca o que perderia um mês nem o que deixaria de fechar com o saldo, e diz o porquê', () => {
    const fecha = { conferidos: 3, naoFecham: 0, exemplos: [] };
    const e = empresa(arquivo('a', [...tresDias('2026-01'), ...tresDias('2026-02')]), arquivo('b', tresDias('2026-03'), { conferenciaPeloSaldo: fecha }));
    const r = aplicarReleituras(e, new Map([
      ['a', lido([l('2026-02-05')])],
      ['b', lido([l('2026-03-05')], { conferenciaPeloSaldo: { conferidos: 3, naoFecham: 2, exemplos: [] } })],
    ]), agora);
    expect(r.relidos).toBe(0);
    expect(r.mantidos).toEqual([
      { nome: 'a.pdf', motivo: 'a leitura nova perderia um mês' },
      { nome: 'b.pdf', motivo: 'a leitura nova deixaria de fechar com o saldo do banco' },
    ]);
    expect(r.empresa).toBe(e);
  });

  it('o arquivo que sumiu enquanto os PDFs baixavam (outra pessoa excluiu) fica de fora', () => {
    const e = empresa(arquivo('a', tresDias('2026-01')));
    const r = aplicarReleituras(e, new Map([['z', lido([l('2026-01-05')])]]), agora);
    expect(r.relidos).toBe(0);
    expect(r.empresa).toBe(e);
  });
});
