// Ler o relatório do banco, venha ele do computador, do Drive ou do e-mail: só o PDF nos dois formatos aceitos (Vitor,
// 14/10/2026: "esse é o formato do Creditor, não aceite outro formato"; creditor/arquivos/formatos.ts). O .txt fica só
// para o relatório de exemplo (os dados de exemplo e o Drive de exemplo).
import { creditor as cr } from '@nads/core';
import workerPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export async function lerRelatorio(nome: string, buf: ArrayBuffer): Promise<cr.RelatorioBanco> {
  const n = nome.toLowerCase();
  if (n.endsWith('.pdf')) return cr.lerRelatorioPdf(buf, workerPdf);
  if (n.endsWith('.txt')) {
    const texto = new TextDecoder().decode(buf);
    if (/BANCO EXEMPLO/.test(texto)) return cr.lerRelatorioTexto(texto);
  }
  throw new Error(cr.FORMATO_NAO_ACEITO);
}

/** A mensagem para a tela. Página aberta antes de uma atualização não acha mais o leitor de PDF antigo. */
export function mensagemDeErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  if (/dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(m)) {
    return 'O Creditor foi atualizado enquanto a página estava aberta. Recarregue a página (F5) e escolha o arquivo de novo.';
  }
  return m || 'Não foi possível ler o arquivo.';
}
