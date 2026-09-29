// Ler o relatório do banco, venha ele anexado (etapa Relatório do banco) ou do Drive (etapa
// Competência): PDF no navegador (pdf.js), .txt, ou planilha.
import { creditor as cr } from '@nads/core';
import workerPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export async function lerRelatorio(nome: string, buf: ArrayBuffer): Promise<cr.RelatorioBanco> {
  const n = nome.toLowerCase();
  if (n.endsWith('.pdf')) return cr.lerRelatorioPdf(buf, workerPdf);
  if (n.endsWith('.txt')) return cr.lerRelatorioTexto(new TextDecoder().decode(buf));
  return cr.lerRelatorioPlanilha(buf, nome);
}

/** A mensagem para a tela. Página aberta antes de uma atualização não acha mais o leitor de PDF antigo. */
export function mensagemDeErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  if (/dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(m)) {
    return 'O Creditor foi atualizado enquanto a página estava aberta. Recarregue a página (F5) e escolha o arquivo de novo.';
  }
  return m || 'Não foi possível ler o arquivo.';
}
