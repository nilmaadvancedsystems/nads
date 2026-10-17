// a nota real de exemplo (o tomador fictício) fica só nos testes: não sai pelo @nads/core
import { XML_DA_NOTA_AUTORIZADA } from '../../../../../../../packages/core/src/nfse/danfse.fixture';
import { nfse } from '@nads/core';
import { writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { desenharDanfse } from './danfsePdf';

describe('o PDF da DANFSe (15/10/2026: "faz o danf poder ser baixado")', () => {
  it('desenha uma página A4 a partir do XML da nota autorizada', async () => {
    const pdf = await desenharDanfse(nfse.dadosDaDanfse(XML_DA_NOTA_AUTORIZADA, { '3130655': 'Indaiabira' }));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
    // para olhar o resultado: DANFSE_SAIDA=C:/pasta/danfse.pdf npx vitest run apps/web/src/aplicativos/tarefas/telas/financeiro/danfsePdf
    const saida = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DANFSE_SAIDA;
    if (saida) writeFileSync(saida, pdf);
  }, 30000);

  it('é uma única página A4 em retrato (NT 008, item 2.2), também com a descrição enorme e em homologação', async () => {
    const medidas = async (xml: string) => {
      const doc = await PDFDocument.load(await desenharDanfse(nfse.dadosDaDanfse(xml)));
      const { width, height } = doc.getPage(0).getSize();
      return { paginas: doc.getPageCount(), largura: Math.round(width), altura: Math.round(height) };
    };
    expect(await medidas(XML_DA_NOTA_AUTORIZADA)).toEqual({ paginas: 1, largura: 595, altura: 842 });
    const longa = XML_DA_NOTA_AUTORIZADA.replace('Serviços Contábeis Ref. 09/2026', 'Serviços Contábeis. '.repeat(70));
    expect(await medidas(longa)).toEqual({ paginas: 1, largura: 595, altura: 842 });
    expect(await medidas(XML_DA_NOTA_AUTORIZADA.replace('<tpAmb>1</tpAmb>', '<tpAmb>2</tpAmb>'))).toEqual({ paginas: 1, largura: 595, altura: 842 });
  }, 30000);
});
