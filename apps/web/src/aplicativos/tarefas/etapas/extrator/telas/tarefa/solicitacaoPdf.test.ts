import { extrator as x } from '@nads/core';
import { writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { desenharSolicitacao } from './solicitacaoPdf';

const pedido: x.PedidoDeExtratos = {
  cliente: 'PADARIA BOA LTDA',
  competencias: ['2026-10'],
  documentos: [
    ...x.documentosDoPedido([{ id: 'sicoob', nome: 'Sicoob', conta: 'Ag. 3046 · C/C 12345-6' }, { id: 'bb', nome: 'Banco do Brasil' }]).slice(0, 4),
    { id: 'outro:lj', nome: 'Relatórios da LJ 🙂', detalhe: '' },
  ],
};

describe('o PDF da Solicitação de documentos (o anexo do WhatsApp, 17/11/2026)', () => {
  it('desenha uma página A4, mesmo com letra que a fonte não tem', async () => {
    const pdf = await desenharSolicitacao({ pedido, prazo: '25/11/2026', emitidoEm: new Date(2026, 10, 17) });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    // pequeno o bastante para ir numa parte só do pedido (a regra do banco aceita 900 mil letras em base64)
    expect(pdf.length).toBeLessThan(600000);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    // para olhar o resultado: SOLICITACAO_SAIDA=C:/pasta/solicitacao.pdf npx vitest run .../solicitacaoPdf
    const saida = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SOLICITACAO_SAIDA;
    if (saida) writeFileSync(saida, pdf);
  }, 30000);

  it('a lista grande passa para a página seguinte', async () => {
    const muitos = { ...pedido, documentos: Array.from({ length: 40 }, (_, k) => ({ id: 'd' + k, nome: 'Documento ' + k, detalhe: 'Uma explicação curta do documento.' })) };
    const pdf = await desenharSolicitacao({ pedido: muitos, prazo: '', emitidoEm: new Date(2026, 10, 17) });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
  }, 30000);
});
