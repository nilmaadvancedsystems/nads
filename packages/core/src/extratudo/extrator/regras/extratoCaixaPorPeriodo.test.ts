import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { extratoDoPdf, type ItemDeTexto } from './extrato';
import { diasNegativos } from './situacaoDoBanco';

// as posições de verdade do OCR do "Extrato por período" da Caixa (chamado 03CP5C, na 474): data 40, documento 127,
// histórico 163, Valor 443 e Saldo 489, as duas alinhadas à esquerda
const linha = (y: number, partes: [string, number][]): ItemDeTexto[] => partes.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 4.5 }));
const lanc = (y: number, data: string, hora: string, hist: string, ...numeros: [string, number][]) =>
  linha(y, [[data, 40], ['-', 79], [hora, 84], ['000000', 127], [hist, 163], ...numeros]);

const cabecalho = [
  ...linha(794, [['CAIXA', 40]]),
  ...linha(760, [['Extrato', 41], ['por', 82], ['período', 102]]),
  ...linha(679, [['Mês', 41], ['Maio', 168]]),
  ...linha(662, [['Período', 41], ['dos', 65], ['lançamentos', 78], ['01/05/2026', 168], ['até', 207], ['31/05/2026', 219]]),
  ...linha(641, [['SALDO', 316], ['ANTERIOR', 339], ['R$', 489], ['5,27', 500], ['C', 515]]),
  ...linha(617, [['Nr', 127], ['Doc', 138], ['Histórico/Complemento', 163], ['Favorecido', 316], ['CPF/CNPJ', 387], ['Valor', 443], ['Saldo', 489]]),
];
const maio = (valorDoDebito: string) => [
  ...cabecalho,
  ...lanc(409, '08/05/2026', '07:57:32', 'PIX', ['5.400,00', 443], ['C', 476], ['27,43', 489], ['C', 509]),
  ...lanc(386, '07/05/2026', '00:00:00', 'SALDO DIA', ['0,00', 443], ['C', 459], ['5.372,57', 489], ['D', 519]),
  ...lanc(363, '07/05/2026', '02:49:09', 'DEBITO PRESTA SIEMP', [valorDoDebito, 443], ['5.372,57D', 489]),
  ...lanc(340, '04/05/2026', '00:00:00', 'SALDO DIA', ['0,00', 443], ['C', 459], ['4,90', 489], ['C', 505]),
  ...lanc(317, '05/05/2026', '02:58:24', 'DEBITO DE IOF', ['0,37', 443], ['D', 459], ['4,90', 489], ['C', 505]),
];
const valorDe = (ls: Lancamento[], data: string) => ls.filter(l => l.data === data).map(l => l.valor);

describe('o "Extrato por período" da Caixa escaneado (chamado 03CP5C, na 474)', () => {
  it('o valor com letra do OCR ("5.377,A7D") é o valor, e não o saldo devedor da linha', () => {
    const r = extratoDoPdf([maio('5.377,A7D')], 'banco', 2026);
    expect(valorDe(r.lancamentos, '2026-05-07')).toEqual([-537747]);
    expect(r.lancamentos.map(l => l.valor)).toEqual([540000, -537747, -37]);
  });

  it('sem valor legível na coluna Valor, o saldo não entra no lugar: o lançamento fica de fora', () => {
    const r = extratoDoPdf([maio('5.3#7,A7D')], 'banco', 2026);
    expect(valorDe(r.lancamentos, '2026-05-07')).toEqual([]);
    expect(r.lancamentos.map(l => l.valor)).toEqual([540000, -37]);
  });

  it('o saldo do dia negativo do cheque especial sai certo', () => {
    const { lancamentos } = extratoDoPdf([maio('5.377,A7D')], 'banco', 2026);
    const arquivo: ArquivoImportado = { id: 'a', lado: 'banco', nome: 'maio.pdf', importadoEm: '2026-11-09', modo: 'primeira', banco: 'caixa', saldoAnterior: 527, lancamentos };
    const empresa: EmpresaExtrator = { nome: 'T', auditoria: [], arquivos: [arquivo] };
    expect(diasNegativos(empresa, 'caixa', 'caixa', ['2026-05'])).toEqual([{ data: '2026-05-07', saldo: -537257 }]);
  });
});
