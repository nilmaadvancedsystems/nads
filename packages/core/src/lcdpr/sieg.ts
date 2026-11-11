// O LCDPR pelo SIEG (11/11/2026: "também quero que puxe do sieg"): no lugar de baixar os dois relatórios no SIEG e
// importar, as notas que o robô já baixa no "Baixar XMLs do SIEG" (o resumo siegNotas do mês). Entram, das recebidas:
// as NF-e (e NFC-e) autorizadas que o fornecedor emitiu como saída — as compras do produtor; a nota de entrada (quem
// emitiu foi o comprador: é venda do produtor) fica de fora, como no relatório — e os CT-e que o produtor tomou (o frete
// que ele pagou). O produto, a IE da fazenda e a entrada só vêm no resumo 6 em diante: o resumo de antes pede baixar de novo.
import type { NotaDoSieg, NotasSieg } from '../tarefas/sieg';
import { lancamentoDoDocumento, ncmCompleto, soDigitos, type DocumentoDoSieg } from './classificar';
import { dataDaCelula, numeroDoDocumento } from './relatorios';
import type { ConfigLcdpr, Lancamento } from './tipos';

/** A versão do resumo do SIEG que traz o que o LCDPR precisa (a entrada, a IE do destinatário e os produtos). */
export const RESUMO_DO_LCDPR = 6;

/** O resumo do mês serve para o LCDPR? (baixado com o robô novo) */
export const resumoServeParaOLcdpr = (n: Pick<NotasSieg, 'resumo'> | null | undefined): boolean => !!n && (n.resumo ?? 1) >= RESUMO_DO_LCDPR;

const ehNota = (n: NotaDoSieg) => n.tipo === 'NF-e' || n.tipo === 'NFC-e';

/** O documento do LCDPR de uma NF-e recebida (os itens pela classificação; o NCM e o produto para a tela). */
function documentoDaNota(n: NotaDoSieg): DocumentoDoSieg {
  const itens = n.itens || [];
  return {
    documento: numeroDoDocumento(n.numero, n.serie), fornecedor: n.emitente.nome, cnpj: soDigitos(n.emitente.doc), valor: Number(n.valor) || 0,
    data: dataDaCelula(n.data), ieDest: n.ieDest || '', produto: n.produto || '', chave: n.chave || undefined,
    ncm: [...new Set(itens.map(i => ncmCompleto(i.ncm)).filter(Boolean))].join(', '),
    linhas: itens.map(i => ({ ncm: i.ncm, valor: Number(i.valor) || 0 })),
  };
}

/** O frete de um CT-e tomado pelo produtor. */
const documentoDoFrete = (n: NotaDoSieg): DocumentoDoSieg => ({
  documento: numeroDoDocumento(n.numero, n.serie), fornecedor: n.emitente.nome, cnpj: soDigitos(n.emitente.doc), valor: Number(n.valor) || 0,
  data: dataDaCelula(n.data), ieDest: '', produto: '', ncm: '', linhas: [], chave: n.chave || undefined,
});

/**
 * A nota do SIEG de um lançamento (para abrir a DANFE): pela chave; sem ela (o que veio dos relatórios .xlsx), pelo
 * número/série e o CNPJ do emitente nas recebidas do mês. null quando não acha (o lançamento à mão, o resumo sem a nota).
 */
export function notaDoLancamento(l: Pick<Lancamento, 'chave' | 'documento' | 'cnpj' | 'origem'>, n: Pick<NotasSieg, 'recebidas'> | null | undefined): NotaDoSieg | null {
  if (!n || l.origem === 'Manual') return null;
  const recebidas = n.recebidas || [];
  if (l.chave) return recebidas.find(x => x.chave === l.chave) || null;
  const doc = soDigitos(l.cnpj);
  return recebidas.find(x => (l.origem === 'CTe' ? x.tipo === 'CT-e' : x.tipo !== 'CT-e') && soDigitos(x.emitente.doc) === doc && numeroDoDocumento(x.numero, x.serie) === l.documento) || null;
}

/** O que saiu do SIEG: os lançamentos, quantos de cada e o que ficou de fora. */
export interface LeituraDoSieg {
  lancamentos: Lancamento[];
  notas: number;
  fretes: number;
  /** as canceladas e as notas de entrada (venda do produtor) */
  canceladas: number;
  entradas: number;
  /** o resumo passou do tamanho e veio sem os itens: as notas vão para REVISAR */
  semItens: boolean;
}

/** Os lançamentos das notas e dos CT-e recebidos no mês. */
export function lerDoSieg(n: NotasSieg, c: ConfigLcdpr, proximoId: () => number): LeituraDoSieg {
  let canceladas = 0, entradas = 0;
  const notas: DocumentoDoSieg[] = [];
  const fretes: DocumentoDoSieg[] = [];
  for (const x of n.recebidas || []) {
    if (!ehNota(x) && x.tipo !== 'CT-e') continue;
    if (x.cancelada) { canceladas++; continue; }
    if (x.tipo === 'CT-e') { fretes.push(documentoDoFrete(x)); continue; }
    if (x.entrada) { entradas++; continue; }
    notas.push(documentoDaNota(x));
  }
  return {
    lancamentos: [...notas.map(d => lancamentoDoDocumento(d, 'NF', c, proximoId())), ...fretes.map(d => lancamentoDoDocumento(d, 'CTe', c, proximoId()))],
    notas: notas.length, fretes: fretes.length, canceladas, entradas, semItens: !!n.itensCortados,
  };
}
