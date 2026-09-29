// Lê um arquivo escolhido (ou baixado) e devolve os lançamentos. Aceita PDF, OFX, Excel e CSV.
// Nada do arquivo é guardado: quem chama recebe só os lançamentos (ou o motivo de não dar).
import * as XLSX from 'xlsx';
import { lancamentosDoPdf } from '../regras/extrato';
import { ehOfx, lancamentosDoOfx } from '../regras/ofx';
import { lancamentosDaPlanilha, type Celula } from '../regras/planilha';
import type { ArquivoLido, Lado } from '../tipos';
import { ehPdf, itensDoPdf } from './pdf';

export const EXTENSOES_EXTRATO: readonly string[] = ['.pdf', '.ofx'];
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
  try {
    if (ehPdf(bytes) || ext === '.pdf') {
      const paginas = await itensDoPdf(bytes);
      const letras = paginas.reduce((s, p) => s + p.reduce((t, i) => t + i.texto.length, 0), 0);
      if (letras < 40) return { nome, lancamentos: [], erro: 'O PDF não tem texto (parece digitalizado). Baixe o extrato em PDF pelo site do banco.' };
      const l = lancamentosDoPdf(paginas, lado, anoPadrao);
      return { nome, lancamentos: l, erro: l.length ? null : 'Não achei lançamentos com data e valor neste PDF.' };
    }
    const inicio = new TextDecoder('windows-1252').decode(bytes.subarray(0, 4000));
    if (ext === '.ofx' || ehOfx(inicio)) {
      const l = lancamentosDoOfx(new TextDecoder('windows-1252').decode(bytes));
      return { nome, lancamentos: l, erro: l.length ? null : 'Não achei lançamentos neste OFX.' };
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
