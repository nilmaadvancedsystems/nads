// A leitura dos relatórios do SIEG (.xlsx) no LCDPR, como no lcdpr.html: o Relatório de Detalhamento de Produtos (uma
// linha por item; as linhas viram uma nota por número, série e emitente) e o Relatório de CT-e (um frete por linha). Só
// os autorizados; da nota, só as de Saída do fornecedor (as compras do produtor; as de Entrada são venda, fora do
// LCDPR); do CT-e, só os que têm o produtor como destinatário (o frete pago pela trading fica de fora).
import * as XLSX from 'xlsx';
import { lancamentoDoDocumento, ncmCompleto, soDigitos, type DocumentoDoSieg } from './classificar';
import type { ConfigLcdpr, Lancamento, OrigemDoDocumento } from './tipos';

type Linha = Record<string, unknown>;
const texto = (v: unknown) => String(v ?? '').trim();

/** O número da célula: número como veio; texto "1.234,56" ou "1234.56"; o resto, 0. */
export function numeroDaCelula(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = texto(v).replace(/^R\$\s*/, '');
  if (!s) return 0;
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A data da célula em aaaa-mm-dd: o número de série do Excel, a data, "dd/mm/aaaa…" ou "aaaa-mm-dd…" ('' se não der).
 * Sem fuso: a página antiga mostrava a data de texto um dia antes no Brasil (a meia-noite em UTC).
 */
export function dataDaCelula(v: unknown): string {
  const iso = (a: number, m: number, d: number) => (a > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '');
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number' && v > 0) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = texto(v);
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  return '';
}

/** aaaa-mm-dd → dd/mm/aaaa */
export const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso || ''; };

/** A série sem os zeros e sem ",0" (1 = 1,0 = "001"). */
export function serieNormal(s: unknown): string {
  if (s === undefined || s === null || s === '') return '';
  const n = parseFloat(String(s));
  return isNaN(n) ? String(s).trim() : String(n);
}

/** O documento: o número, e "/série" quando a série não é 1. */
export function numeroDoDocumento(numero: unknown, serie: unknown): string {
  const num = texto(numero);
  const ser = serieNormal(serie);
  return !ser || ser === '1' ? num : num + '/' + ser;
}

export type TipoDeRelatorio = 'detalhamento' | 'cte' | 'desconhecido';

/** Qual relatório é, pelas colunas. */
export function tipoDoRelatorio(colunas: readonly string[]): TipoDeRelatorio {
  if (colunas.includes('Valor_Transporte') || colunas.includes('Prod_Predominante')) return 'cte';
  if (colunas.includes('Produto') && colunas.includes('Valor_Unitario')) return 'detalhamento';
  return 'desconhecido';
}

const autorizado = (r: Linha) => texto(r.Status).startsWith('Autorizado');

/** As notas do Detalhamento de Produtos: as linhas de cada nota juntas (número, série e emitente). */
export function notasDoDetalhamento(linhas: readonly Linha[]): DocumentoDoSieg[] {
  const grupos = new Map<string, DocumentoDoSieg & { produtos: string[] }>();
  for (const r of linhas) {
    if (!texto(r.Numero)) continue;
    if (!autorizado(r)) continue;
    const tp = texto(r.Tp_NF);
    if (tp !== 'Saída' && tp !== 'Saida') continue;
    // o emitente entra na chave: na página antiga, a nota 123 de dois fornecedores virava um lançamento só
    const chave = texto(r.Numero) + '|' + serieNormal(r.Serie) + '|' + soDigitos(r.CNPJ_CPF_Emit);
    let g = grupos.get(chave);
    if (!g) {
      g = {
        documento: numeroDoDocumento(r.Numero, r.Serie), fornecedor: texto(r.Rz_Emit), cnpj: soDigitos(r.CNPJ_CPF_Emit),
        valor: numeroDaCelula(r.Valor_Total_Nota), data: dataDaCelula(r.Dt_Emissao), ieDest: texto(r.IE_Dest),
        produto: '', ncm: '', linhas: [], produtos: [],
      };
      grupos.set(chave, g);
    }
    const prod = texto(r.Produto);
    if (prod) g.produtos.push(prod);
    g.linhas.push({ ncm: r.NCM, valor: numeroDaCelula(r.Valor_Produto) });
  }
  return [...grupos.values()].map(({ produtos, ...g }) => ({
    ...g, produto: produtos.join(' | '), ncm: [...new Set(g.linhas.map(l => ncmCompleto(l.ncm)).filter(Boolean))].join(', '),
  }));
}

/** Os fretes do relatório de CT-e (só os do produtor, quando o CPF/CNPJ dele está na Configuração geral). */
export function fretesDoCte(linhas: readonly Linha[], cpfProdutor: string): DocumentoDoSieg[] {
  // o CPF guardado como número na planilha perde os zeros da frente: compara sem eles
  const semZeros = (s: unknown) => soDigitos(s).replace(/^0+/, '');
  const produtor = semZeros(cpfProdutor);
  const fretes: DocumentoDoSieg[] = [];
  for (const r of linhas) {
    if (!texto(r.Numero)) continue;
    if (!autorizado(r)) continue;
    if (produtor && semZeros(r.CNPJ_CPF_Dest) !== produtor) continue;
    fretes.push({
      documento: numeroDoDocumento(r.Numero, r.Serie), fornecedor: texto(r.Rz_Emit), cnpj: soDigitos(r.CNPJ_CPF_Emitente),
      valor: numeroDaCelula(r.Valor_Transporte), data: dataDaCelula(r.Dt_Emissao), ieDest: '', produto: texto(r.Prod_Predominante), ncm: '', linhas: [],
    });
  }
  return fretes;
}

/** O que saiu de um arquivo: os lançamentos ou por que não entrou nada. */
export interface LeituraDoRelatorio { tipo: TipoDeRelatorio; lancamentos: Lancamento[]; erro: string }

/** Os lançamentos das linhas de um relatório (a primeira aba, uma linha por objeto com o nome das colunas). */
export function lerRelatorio(linhas: readonly Linha[], c: ConfigLcdpr, proximoId: () => number): LeituraDoRelatorio {
  if (!linhas.length) return { tipo: 'desconhecido', lancamentos: [], erro: 'planilha vazia' };
  const tipo = tipoDoRelatorio(Object.keys(linhas[0]));
  if (tipo === 'desconhecido') return { tipo, lancamentos: [], erro: 'não é Detalhamento de Produtos nem CT-e' };
  const origem: OrigemDoDocumento = tipo === 'cte' ? 'CTe' : 'NF';
  const docs = tipo === 'cte' ? fretesDoCte(linhas, c.config.cpfProdutor) : notasDoDetalhamento(linhas);
  return { tipo, lancamentos: docs.map(d => lancamentoDoDocumento(d, origem, c, proximoId())), erro: '' };
}

/** As linhas da primeira aba do arquivo (xlsx ou xls), com o nome das colunas; as datas como número de série. */
export function linhasDoArquivo(buf: ArrayBuffer): Linha[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const aba = wb.Sheets[wb.SheetNames[0]];
  return aba ? XLSX.utils.sheet_to_json<Linha>(aba, { defval: '', raw: true }) : [];
}
