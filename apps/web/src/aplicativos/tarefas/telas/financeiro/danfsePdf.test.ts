// a nota real de exemplo (o tomador fictício) fica só nos testes: não sai pelo @nads/core
import { XML_DA_NOTA_AUTORIZADA } from '../../../../../../../packages/core/src/nfse/danfse.fixture';
import { nfse } from '@nads/core';
import { writeFileSync } from 'node:fs';
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
});
