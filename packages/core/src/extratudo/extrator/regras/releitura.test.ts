import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { ehFaturaDeCartao, extratoDoPdf, type ItemDeTexto } from './extrato';
import { extratosParaReler, relerExtrato, VERSAO_DO_LEITOR } from './importacao';

describe('reler o extrato do Drive com o leitor novo (Vitor, 14/10/2026)', () => {
  const velho: ArquivoImportado = { id: 'a', lado: 'banco', nome: '08-2026.pdf', importadoEm: '2026-10-13T00:00:00Z', modo: 'primeira', banco: 'bnb', drive: { id: 'x', nome: '08-2026.pdf' },
    lancamentos: [{ data: '2026-08-10', valor: 165000, historico: 'SELETA' }, { data: '2026-08-10', valor: 3907, historico: 'BNB AUTOMATICO FIF (*)' }] };
  const e: EmpresaExtrator = { nome: 'X', auditoria: [], arquivos: [velho, { ...velho, id: 'b', drive: undefined, nome: 'do-pc.pdf' }] };
  it('só os do Drive com leitor mais velho', () => {
    expect(extratosParaReler(e).map(a => a.id)).toEqual(['a']);
  });
  it('troca os lançamentos, marca a versão e fica no histórico', () => {
    const r = relerExtrato(e, 'a', { nome: '08-2026.pdf', erro: null, lancamentos: [{ data: '2026-08-10', valor: 165000, historico: 'RECEBIMENTO VIA PIX SELETA' }], saldoAnterior: 0 }, new Date('2026-10-14T12:00:00Z'));
    const a = r.arquivos.find(x => x.id === 'a')!;
    expect(a.lancamentos.map(l => l.historico)).toEqual(['RECEBIMENTO VIA PIX SELETA']);
    expect([a.leitor, a.saldoAnterior, a.drive?.id]).toEqual([VERSAO_DO_LEITOR, 0, 'x']);
    expect(r.auditoria[0].acao).toBe('Releu o extrato');
    expect(extratosParaReler(r)).toEqual([]);
  });
  it('a fatura do cartão que entrou como extrato sai, e fica no histórico (09/11/2026)', () => {
    const r = relerExtrato(e, 'a', { nome: '08-2026.pdf', erro: 'É a fatura do cartão, não o extrato da conta.', lancamentos: [], faturaDeCartao: true }, new Date('2026-11-09T12:00:00Z'));
    expect(r.arquivos.map(x => x.id)).toEqual(['b']);
    expect(r.auditoria[0].acao).toBe('Tirou a fatura do cartão');
  });
});

describe('a fatura do cartão e o extrato (09/11/2026)', () => {
  it('a fatura não é extrato; o extrato que paga fatura continua sendo', () => {
    expect(ehFaturaDeCartao('Resumo da fatura em R$ Total desta fatura 100,00 Vencimento: 15/02/2026')).toBe(true);
    expect(ehFaturaDeCartao('Esta é a sua fatura de fevereiro. Data de vencimento: 15 FEV 2026')).toBe(true);
    expect(ehFaturaDeCartao('Saldo inicial 0,00 Movimentações Pagamento de fatura 90,00 Vencimento')).toBe(false);
  });
});

describe('o "extrato mensal" do Itaú (09/11/2026)', () => {
  const pedaco = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 4 });
  const pagina: ItemDeTexto[] = [
    pedaco('extrato mensal', 400, 760), pedaco('ag 1234 cc 56789-0', 460, 760), pedaco('fev 2026', 515, 760),
    pedaco('data', 150, 248), pedaco('descrição', 207, 248), pedaco('entradas R$', 357, 248), pedaco('saídas R$', 426, 248), pedaco('saldo R$', 520, 248),
    pedaco('30/01', 150, 230), pedaco('Saldo anterior', 207, 230), pedaco('100,00-', 517, 230),
    pedaco('03/02', 150, 182.7), pedaco('Tarifa', 207, 182.7), pedaco('10,00-', 436, 182.7), pedaco('Para demais siglas', 56, 181.6),
    pedaco('PIX TRANSF FULANO', 207, 173), pedaco('500,00', 366, 173), pedaco('390,00', 521, 173),
    pedaco('Saldo final', 207, 150), pedaco('390,00', 521, 150),
    pedaco('totalizador de aplicações automáticas', 207, 130), pedaco('entrada R$', 357, 130),
    pedaco('18/02/26', 150, 110), pedaco('BUSINESS', 207, 110), pedaco('77,00', 436, 110),
  ];
  it('o valor sem "-" é entrada, a data não some com a legenda e os quadros do fim ficam de fora', () => {
    expect(extratoDoPdf([pagina], 'banco', 2026).lancamentos.map(l => [l.data, l.valor, l.historico])).toEqual([
      ['2026-02-03', -1000, 'Tarifa'], ['2026-02-03', 50000, 'PIX TRANSF FULANO'],
    ]);
  });
});
