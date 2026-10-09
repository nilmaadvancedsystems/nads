// O extrato importado do computador, um arquivo por mês, para mandar ao Drive (Vitor, 09/10/2026: "quando não tiver no
// drive e o usuário upar na aplicação, upe no drive; às vezes o PDF vem tudo junto: quebre e coloque em cada mês").
// O PDF de vários meses vira um PDF por mês com as páginas daquele mês (a página que vira o mês vai nos dois); o OFX e a
// planilha só vão inteiros, quando são de um mês só.
import { paginasPorMes } from '../regras/extrato';
import type { ArquivoLido } from '../tipos';
import { ehPdf, itensDoPdf } from './pdf';

export interface ExtratoDoMes { mes: string; nome: string; bytes: Uint8Array }

/** "Extrato CAIXA 01-2026.pdf" */
export function nomeDoExtratoDoMes(banco: string, mes: string, extensao: string): string {
  const b = banco.replace(/[/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase() || 'BANCO';
  return 'Extrato ' + b + ' ' + mes.slice(5) + '-' + mes.slice(0, 4) + extensao;
}

/** As páginas escolhidas do PDF, num PDF novo. */
export async function pdfComAsPaginas(bytes: Uint8Array, paginas: readonly number[]): Promise<Uint8Array> {
  // o pdf-lib só vem quando precisa (não pesa a abertura da tela)
  const { PDFDocument } = await import('pdf-lib');
  const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const novo = await PDFDocument.create();
  for (const p of await novo.copyPages(origem, [...paginas])) novo.addPage(p);
  return novo.save();
}

/**
 * O arquivo lido, em um por mês: os meses dos lançamentos; no PDF, as páginas de cada um. Arquivo que não é PDF e tem
 * mais de um mês não dá para quebrar: não volta nada.
 */
export async function extratoPorMes(nome: string, bytes: Uint8Array, lido: ArquivoLido, banco: string, anoPadrao = new Date().getFullYear()): Promise<ExtratoDoMes[]> {
  const meses = [...new Set(lido.lancamentos.map(l => l.data.slice(0, 7)))].sort();
  if (!meses.length) return [];
  const ext = (/.[a-z0-9]+$/i.exec(nome)?.[0] || '').toLowerCase();
  if (!ehPdf(bytes) && ext !== '.pdf') return meses.length === 1 ? [{ mes: meses[0], nome: nomeDoExtratoDoMes(banco, meses[0], ext), bytes }] : [];
  if (meses.length === 1) return [{ mes: meses[0], nome: nomeDoExtratoDoMes(banco, meses[0], '.pdf'), bytes }];
  const porMes = paginasPorMes(await itensDoPdf(bytes.slice()), anoPadrao);
  const out: ExtratoDoMes[] = [];
  for (const m of meses) {
    const paginas = porMes[m];
    if (!paginas?.length) continue;
    out.push({ mes: m, nome: nomeDoExtratoDoMes(banco, m, '.pdf'), bytes: await pdfComAsPaginas(bytes, paginas) });
  }
  return out;
}
