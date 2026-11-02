import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { tirarSobreposicaoDosExtratos } from './importacao';

const l = (data: string, valor: number, historico = 'H'): Lancamento => ({ data, valor, historico });
const arq = (id: string, banco: string, lancamentos: Lancamento[], lado: 'banco' | 'sistema' = 'banco'): ArquivoImportado =>
  ({ id, lado, nome: id + '.pdf', importadoEm: '2026-10-26', modo: 'primeira', banco, lancamentos });
const bancoDe = (a: ArquivoImportado) => a.banco || 'x';
const agora = new Date('2026-10-26T12:00:00Z');

describe('o mesmo lançamento em dois extratos do mesmo banco (Vitor, 26/10/2026: a página da virada do mês)', () => {
  // o PDF de janeiro e o de fevereiro do Stone levam os dois o 31/01; o histórico pode sair diferente em cada um
  const jan = arq('jan', 'stone', [l('2026-01-30', 500), l('2026-01-31', -122, 'Saída Tarifa'), l('2026-01-31', 24500), l('2026-02-01', 1), l('2026-02-01', 1)]);
  const fev = arq('fev', 'stone', [l('2026-01-31', -122, 'Saída Tarifa Fulano'), l('2026-01-31', 24500), l('2026-02-01', 1), l('2026-02-01', 1), l('2026-02-01', 1), l('2026-02-02', 900)]);
  it('o dia fica com o arquivo que tem mais dele; a repetição de verdade (o mesmo valor várias vezes no dia) fica', () => {
    const e: EmpresaExtrator = { nome: 'T', auditoria: [], arquivos: [jan, fev] };
    const r = tirarSobreposicaoDosExtratos(e, bancoDe, agora);
    expect(r.tirados).toBe(4);
    // o 31/01: empate, fica no de janeiro; o 01/02: o de fevereiro tem os três rendimentos, fica nele
    expect(r.empresa.arquivos.find(a => a.id === 'jan')!.lancamentos).toEqual(jan.lancamentos.slice(0, 3));
    expect(r.empresa.arquivos.find(a => a.id === 'fev')!.lancamentos).toEqual(fev.lancamentos.slice(2));
    expect(r.empresa.auditoria[0].acao).toBe('Tirou lançamentos repetidos entre extratos');
    // de novo: nada a fazer
    expect(tirarSobreposicaoDosExtratos(r.empresa, bancoDe, agora).tirados).toBe(0);
  });
  it('outro banco e o razão não entram; o arquivo que fica vazio sai', () => {
    const e: EmpresaExtrator = { nome: 'T', auditoria: [], arquivos: [
      arq('a', 'stone', [l('2026-01-31', 24500)]), arq('b', 'sicoob', [l('2026-01-31', 24500)]),
      arq('r1', 'stone', [l('2026-01-31', 24500)], 'sistema'), arq('r2', 'stone', [l('2026-01-31', 24500)], 'sistema'),
      arq('c', 'stone', [l('2026-01-31', 24500)]),
    ] };
    const r = tirarSobreposicaoDosExtratos(e, bancoDe, agora);
    expect(r.tirados).toBe(1);
    expect(r.empresa.arquivos.map(a => a.id)).toEqual(['a', 'b', 'r1', 'r2']);
  });
});
