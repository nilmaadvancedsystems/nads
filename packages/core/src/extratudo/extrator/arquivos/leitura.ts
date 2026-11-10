// Lê um arquivo escolhido (ou baixado) e devolve os lançamentos. Aceita PDF, OFX, Excel e CSV.
// Nada do arquivo é guardado: quem chama recebe só os lançamentos (ou o motivo de não dar).
import * as XLSX from 'xlsx';
import { ehFaturaDeCartao, ehRelatorioDeTitulos, extratoDoPdf, mesesSemMovimento, saldoAnteriorDoPdf } from '../regras/extrato';
import { ehOfx, lancamentosDoOfx, saldoAnteriorDoOfx } from '../regras/ofx';
import { lancamentosDaPlanilha, type Celula } from '../regras/planilha';
import type { ArquivoLido, Lado } from '../tipos';
import type { ItemDeTexto } from '../regras/extrato';
import { ehPdf, itensDoPdf, ocrDefinido } from './pdf';

/** o extrato escaneado em imagem (foto ou scanner) entra pelo OCR (Vitor, 13/10/2026) */
export const EXTENSOES_IMAGEM: readonly string[] = ['.jpg', '.jpeg', '.png'];
export const EXTENSOES_EXTRATO: readonly string[] = ['.pdf', '.ofx', ...EXTENSOES_IMAGEM];
export const EXTENSOES_SISTEMA: readonly string[] = ['.xlsx', '.xls', '.csv', '.txt', '.pdf', '.ofx'];

function extensao(nome: string): string {
  const m = nome.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}

/** O texto do arquivo: UTF-8, ou Windows-1252 quando o UTF-8 não serve (o byte inválido vira U+FFFD), como no Creditor. */
function decodificarTexto(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes(String.fromCharCode(0xfffd)) ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

/** O começo de um .xlsx (zip, "PK"), de um .xls antigo (OLE, D0 CF) ou do texto em UTF-16 (o "Texto Unicode" do Excel): a biblioteca lê pelos bytes. */
function ehPlanilhaBinaria(b: Uint8Array): boolean {
  return (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf) || (b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff);
}

/** Linhas de cada aba da planilha, com os valores crus (Date, número ou texto). */
export function abasDaPlanilha(bytes: Uint8Array, csv: boolean): Celula[][][] {
  // o .csv de verdade vai como texto, já decodificado (em UTF-8 sem BOM, os acentos do histórico se perdiam); a planilha com a
  // extensão trocada (.csv que é .xlsx ou .xls) continua pelos bytes
  const comoTexto = csv && !ehPlanilhaBinaria(bytes);
  const wb = comoTexto ? XLSX.read(decodificarTexto(bytes), { type: 'string', cellDates: true, raw: true }) : XLSX.read(bytes, { type: 'array', cellDates: true, raw: csv });
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_json<Celula[]>(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false }));
}

export async function lerArquivo(nome: string, bytes: Uint8Array, lado: Lado, anoPadrao = new Date().getFullYear()): Promise<ArquivoLido> {
  const ext = extensao(nome);
  const letrasDe = (ps: ItemDeTexto[][]) => ps.reduce((s, p) => s + p.reduce((t, i) => t + i.texto.length, 0), 0);
  // as páginas (do texto do PDF ou do OCR) → os lançamentos, o sem movimento e o saldo anterior
  const doTexto = (paginas: ItemDeTexto[][], porOcr: boolean): ArquivoLido => {
    const marca = porOcr ? { ocr: true } : {};
    if (lado === 'banco' && ehFaturaDeCartao(paginas.map(p => p.map(i => i.texto).join(' ')).join('\n'))) return { nome, lancamentos: [], erro: 'É a fatura do cartão, não o extrato da conta.', faturaDeCartao: true, ...marca };
    if (lado === 'banco' && ehRelatorioDeTitulos(paginas.map(p => p.map(i => i.texto).join(' ')).join('\n'))) return { nome, lancamentos: [], erro: 'É o relatório de cobrança (títulos por período), não o extrato da conta.', ...marca };
    const { lancamentos: l, saldoAnteriorPelaLinha, saldoAnteriorConferido } = extratoDoPdf(paginas, lado, anoPadrao);
    // o extrato que diz que não teve movimento: o mês fica marcado como sem movimento (não é erro de leitura)
    const semMov = !l.length && lado === 'banco' ? mesesSemMovimento(paginas.map(p => p.map(i => i.texto).join(' ')).join('\n')) : null;
    if (semMov) return { nome, lancamentos: [], erro: 'Extrato sem movimento.', semMovimento: semMov, ...marca };
    // sem a linha do saldo anterior, o da coluna Saldo (o Stone; 26/10/2026); no Bradesco escaneado, o saldo anterior conferido
    // com a 1ª linha (o OCR leu o "−11.234,56" como "71.234,56"; Vitor, 06/11/2026)
    const saldo = lado === 'banco' ? saldoAnteriorConferido ?? saldoAnteriorDoPdf(paginas) ?? saldoAnteriorPelaLinha : null;
    return { nome, lancamentos: l, erro: l.length ? null : 'Não achei lançamentos com data e valor neste ' + (porOcr ? 'arquivo, nem pelo OCR' : 'PDF') + '.', ...(saldo != null ? { saldoAnterior: saldo } : {}), ...marca };
  };
  try {
    const ocr = ocrDefinido();
    if (EXTENSOES_IMAGEM.includes(ext)) {
      if (!ocr) return { nome, lancamentos: [], erro: 'A imagem precisa do OCR, que só roda no navegador.' };
      const paginas = await ocr(bytes, 'imagem');
      if (letrasDe(paginas) < 40) return { nome, lancamentos: [], erro: 'O OCR não achou texto nesta imagem (está nítida e de pé?).', ocr: true };
      return doTexto(paginas, true);
    }
    if (ehPdf(bytes) || ext === '.pdf') {
      const paginas = await itensDoPdf(bytes);
      if (letrasDe(paginas) >= 40) return doTexto(paginas, false);
      // o PDF escaneado (sem texto): o OCR lê as páginas como imagem
      if (!ocr) return { nome, lancamentos: [], erro: 'O PDF não tem texto (parece digitalizado). Baixe o extrato em PDF pelo site do banco.' };
      const lidas = await ocr(bytes, 'pdf');
      if (letrasDe(lidas) < 40) return { nome, lancamentos: [], erro: 'O PDF é imagem e o OCR não achou texto nele (está nítido?).', ocr: true };
      return doTexto(lidas, true);
    }
    const inicio = new TextDecoder('windows-1252').decode(bytes.subarray(0, 4000));
    if (ext === '.ofx' || ehOfx(inicio)) {
      const texto = decodificarTexto(bytes);
      const l = lancamentosDoOfx(texto);
      const saldo = lado === 'banco' ? saldoAnteriorDoOfx(texto, l) : null;
      return { nome, lancamentos: l, erro: l.length ? null : 'Não achei lançamentos neste OFX.', ...(saldo != null ? { saldoAnterior: saldo } : {}) };
    }
    let melhor: { lancamentos: ArquivoLido['lancamentos']; erro: string | null } = { lancamentos: [], erro: 'Não achei as colunas de data, histórico e valor.' };
    for (const aba of abasDaPlanilha(bytes, ext === '.csv' || ext === '.txt')) {
      const r = lancamentosDaPlanilha(aba, lado, anoPadrao);
      if (r.lancamentos.length > melhor.lancamentos.length) melhor = r;
    }
    return { nome, ...melhor };
  } catch (e) {
    return { nome, lancamentos: [], erro: 'Não consegui ler o arquivo' + (e instanceof Error && e.message ? ' (' + e.message + ')' : '') + '.' };
  }
}
