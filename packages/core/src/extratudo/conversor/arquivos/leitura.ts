// Lê o extrato escolhido e devolve as linhas do .xls. Primeiro tenta o leitor do layout do banco (o Banco do Brasil
// e a Cora); se não for um layout conhecido, usa o leitor genérico do Extrator (PDF, OFX, Excel, CSV).
// O arquivo é lido na memória e descartado: nada é guardado.
import { lerArquivo } from '../../extrator/arquivos/leitura';
import { ehPdf, itensDoPdf } from '../../extrator/arquivos/pdf';
import { montarLinhas } from '../../extrator/regras/extrato';
import { bancoDoTexto } from '../regras/arquivo';
import { ehExtratoDoBancoDoBrasil, lancamentosDoBancoDoBrasil } from '../regras/bancoDoBrasil';
import { ehExtratoDaCora, lancamentosDaCora } from '../regras/cora';
import type { ExtratoConvertido } from '../tipos';

export const EXTENSOES_CONVERSOR: readonly string[] = ['.pdf', '.ofx', '.xlsx', '.xls', '.csv', '.txt'];

/** O topo da primeira página (onde fica o nome do banco; o resto do extrato tem nomes de banco nos históricos). */
function topoDaPrimeiraPagina(paginas: Awaited<ReturnType<typeof itensDoPdf>>): string {
  return paginas.length ? montarLinhas(paginas[0]).slice(0, 12).map(l => l.texto).join('\n') : '';
}

export async function converterArquivo(nome: string, bytes: Uint8Array, anoPadrao = new Date().getFullYear()): Promise<ExtratoConvertido> {
  try {
    if (ehPdf(bytes) || /\.pdf$/i.test(nome)) {
      const paginas = await itensDoPdf(bytes);
      if (ehExtratoDoBancoDoBrasil(paginas)) {
        const linhas = lancamentosDoBancoDoBrasil(paginas);
        return { arquivo: nome, banco: 'Banco do Brasil', leitor: 'banco-do-brasil', linhas, erro: linhas.length ? null : 'Não achei lançamentos neste extrato do Banco do Brasil.' };
      }
      if (ehExtratoDaCora(paginas)) {
        const linhas = lancamentosDaCora(paginas);
        return { arquivo: nome, banco: 'Cora', leitor: 'cora', linhas, erro: linhas.length ? null : 'Não achei lançamentos neste extrato da Cora.' };
      }
      const lido = await lerArquivo(nome, bytes, 'banco', anoPadrao);
      return { arquivo: nome, banco: bancoDoTexto(topoDaPrimeiraPagina(paginas), nome), leitor: 'generico', linhas: lido.lancamentos, erro: lido.erro };
    }
    const lido = await lerArquivo(nome, bytes, 'banco', anoPadrao);
    const inicio = new TextDecoder('windows-1252').decode(bytes.subarray(0, 3000));
    return { arquivo: nome, banco: bancoDoTexto(/<(OFX|BANKID|ORG)/i.test(inicio) ? inicio : '', nome), leitor: 'generico', linhas: lido.lancamentos, erro: lido.erro };
  } catch (e) {
    return { arquivo: nome, banco: '', leitor: 'generico', linhas: [], erro: 'Não consegui ler o arquivo' + (e instanceof Error && e.message ? ' (' + e.message + ')' : '') + '.' };
  }
}
