// Lê um arquivo escolhido (ou baixado) e devolve os lançamentos. Aceita PDF, OFX, Excel e CSV.
// Nada do arquivo é guardado: quem chama recebe só os lançamentos (ou o motivo de não dar).
import * as XLSX from 'xlsx';
import { extratoDoPdf, mesesSemMovimento, saldoAnteriorDoPdf } from '../regras/extrato';
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

/** Linhas de cada aba da planilha, com os valores crus (Date, número ou texto). */
export function abasDaPlanilha(bytes: Uint8Array, csv: boolean): Celula[][][] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true, raw: csv });
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_json<Celula[]>(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: false }));
}

export async function lerArquivo(nome: string, bytes: Uint8Array, lado: Lado, anoPadrao = new Date().getFullYear()): Promise<ArquivoLido> {
  const ext = extensao(nome);
  const letrasDe = (ps: ItemDeTexto[][]) => ps.reduce((s, p) => s + p.reduce((t, i) => t + i.texto.length, 0), 0);
  // as páginas (do texto do PDF ou do OCR) → os lançamentos, o sem movimento e o saldo anterior
  const doTexto = (paginas: ItemDeTexto[][], porOcr: boolean): ArquivoLido => {
    const marca = porOcr ? { ocr: true } : {};
    const { lancamentos: l, saldoAnteriorPelaLinha } = extratoDoPdf(paginas, lado, anoPadrao);
    // o extrato que diz que não teve movimento: o mês fica marcado como sem movimento (não é erro de leitura)
    const semMov = !l.length && lado === 'banco' ? mesesSemMovimento(paginas.map(p => p.map(i => i.texto).join(' ')).join('\n')) : null;
    if (semMov) return { nome, lancamentos: [], erro: 'Extrato sem movimento.', semMovimento: semMov, ...marca };
    // sem a linha do saldo anterior, o da coluna Saldo (o Stone; 26/10/2026)
    const saldo = lado === 'banco' ? saldoAnteriorDoPdf(paginas) ?? saldoAnteriorPelaLinha : null;
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
      const texto = new TextDecoder('windows-1252').decode(bytes);
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
