import { describe, expect, it } from 'vitest';
import { arquivosDoBanco, indiceDosArquivos } from './bancos';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';

// o índice dá o mesmo que o arquivosDoBanco (19/10/2026: a tela dos bancos chamava o arquivosDoBanco a cada desenho)
describe('indiceDosArquivos', () => {
  const arq = (id: string, lado: 'banco' | 'sistema', banco: string | undefined, datas: string[]): ArquivoImportado =>
    ({ id, lado, nome: id, importadoEm: '2026-10-01T00:00:00Z', modo: 'primeira', ...(banco ? { banco } : {}), lancamentos: datas.map(d => ({ data: d, valor: 100, historico: 'x' })) });
  const e: EmpresaExtrator = { nome: 'E', auditoria: [], arquivos: [
    arq('a', 'banco', 'sicoob', ['2026-01-05', '2026-02-03']), arq('b', 'sistema', 'sicoob', ['2026-01-10']),
    arq('c', 'banco', undefined, ['2026-01-20']), arq('d', 'banco', 'banco', ['2026-02-01']), arq('e', 'banco', 'bnb', ['2026-01-02']),
  ] };
  it('igual ao arquivosDoBanco em todos os bancos, lados e meses', () => {
    const i = indiceDosArquivos(e, 'bnb');
    for (const b of ['sicoob', 'bnb', 'banco']) for (const l of ['banco', 'sistema'] as const) for (const m of ['2026-01', '2026-02', '2026-03']) {
      expect(i(b, l, m).map(a => a.id)).toEqual(arquivosDoBanco(e, b, 'bnb', l, m).map(a => a.id));
    }
  });
});
