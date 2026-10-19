// O Demonstrativo de Caixa em planilha (19/10/2026: "preciso de um relatório em planilha obedecendo os filtros"), no jeito
// do Demonstrativo do Toriba: o título com o período, o Saldo inicial, o cabeçalho (Data, Histórico, Conta, Entradas,
// Saídas, Observações), uma linha por lançamento listado, os totais e o Saldo final. Puro: a tela manda o que está nela.
import * as XLSX from 'xlsx';
import type { ContaDoPlano, LancamentoDeCaixa } from './index';

export type CelulaDoDemonstrativo = string | number;

export interface EntradaDoDemonstrativo {
  /** AAAA-MM-DD */
  de: string;
  ate: string;
  /** o saldo de antes do período (o do cartão da tela, que não depende dos filtros) */
  saldoInicial: number;
  /** exatamente as linhas que estão na tela (período, busca e tipo) */
  itens: { lancamento: LancamentoDeCaixa; conta?: ContaDoPlano }[];
  /** a busca ou o tipo estão filtrando: o saldo final considera só as linhas listadas */
  filtrado: boolean;
}

export const CABECALHO_DO_DEMONSTRATIVO = ['Data', 'Histórico', 'Conta', 'Entradas', 'Saídas', 'Observações'] as const;

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;

/** O nome do arquivo: "Caixa AAAA-MM-DD a AAAA-MM-DD.xlsx". */
export const nomeDoDemonstrativo = (de: string, ate: string) => `Caixa ${de} a ${ate}.xlsx`;

export interface LinhasDoDemonstrativo {
  /** a planilha como linhas de células (as colunas de valor são números; a outra ponta fica vazia) */
  linhas: CelulaDoDemonstrativo[][];
  entradas: number;
  saidas: number;
  saldoFinal: number;
  /** o índice (0) das linhas que têm só números de valor, para a planilha formatar como R$ */
  linhaDoCabecalho: number;
}

/** As linhas do relatório, na ordem em que a planilha as mostra. */
export function linhasDoDemonstrativo(e: EntradaDoDemonstrativo): LinhasDoDemonstrativo {
  let ent = 0, sai = 0;
  const corpo: CelulaDoDemonstrativo[][] = e.itens.map(({ lancamento: l, conta }) => {
    const c = centavos(l.valor);
    if (l.tipo === 'E') ent += c; else sai += c;
    return [dataBr(l.data), l.descricao, conta ? `${conta.codigo} ${conta.descricao}` : '', l.tipo === 'E' ? l.valor : '', l.tipo === 'S' ? l.valor : '', l.observacoes ?? ''];
  });
  const saldoFinal = reais(centavos(e.saldoInicial) + ent - sai);
  const linhas: CelulaDoDemonstrativo[][] = [
    [`Demonstrativo de Caixa — ${dataBr(e.de)} a ${dataBr(e.ate)}`],
    [],
    ['', 'Saldo inicial', '', e.saldoInicial],
    [...CABECALHO_DO_DEMONSTRATIVO],
    ...corpo,
    ['', 'Totais', '', reais(ent), reais(sai)],
    ['', 'Saldo final', '', saldoFinal],
  ];
  if (e.filtrado) linhas.push([], ['Há filtro de busca ou de tipo: o saldo final considera só as linhas listadas acima.']);
  return { linhas, entradas: reais(ent), saidas: reais(sai), saldoFinal, linhaDoCabecalho: 3 };
}

/** O .xlsx do demonstrativo (aba "Caixa"), com os valores formatados em R$. */
export function planilhaDoDemonstrativo(e: EntradaDoDemonstrativo): Uint8Array {
  const { linhas } = linhasDoDemonstrativo(e);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (const [endereco, cel] of Object.entries(ws)) {
    if (endereco[0] !== '!' && (cel as XLSX.CellObject).t === 'n') (cel as XLSX.CellObject).z = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  }
  ws['!cols'] = [{ wch: 12 }, { wch: 44 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 36 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Caixa');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
