import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { correcoesDoRazao } from './correcoes';

const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[]): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-01T12:00:00Z', modo: 'primeira', lancamentos });
const L = (data: string, valor: number, historico: string): Lancamento => ({ data, valor, historico });
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria: [] });

describe('o que corrigir no razão', () => {
  // a 292 no Sicoob: 130,96 lançados em 06/03 que entraram no banco em 18/05; e um cliente com a data trocada
  const e = emp([
    arq('e3', 'banco', [L('2026-03-06', 95814, 'CRÉD.LIQ.COBRANÇA DOC.: 1948608'), L('2026-03-06', 781276, 'CRÉD.LIQ.COBRANÇA DOC.: 1949517'), L('2026-03-16', 94730, 'CRÉD.LIQ.COBRANÇA DOC.: 2034985')]),
    arq('r3', 'sistema', [L('2026-03-06', 108910, 'GONCALVES E AQUINO'), L('2026-03-06', 398190, 'UNIAO'), L('2026-03-06', 383086, 'CAMPOS'), L('2026-03-17', 94730, 'DONA BEIJA')]),
    arq('e5', 'banco', [L('2026-05-18', 839818, 'CRÉD.LIQ.COBRANÇA DOC.: 2096255')]),
    arq('r5', 'sistema', [L('2026-05-18', 510972, 'QUEBA'), L('2026-05-18', 315750, 'SANTOS E OLIVEIRA')]),
  ]);
  const r = correcoesDoRazao(e, 'sicoob', 'sicoob', ['2026-03', '2026-04', '2026-05']);
  it('cada problema dito para corrigir, na ordem das datas', () => {
    expect(r.map(c => [c.data, c.tipo, c.texto])).toEqual([
      ['2026-03-06', 'lote', 'CRÉD.LIQ.COBRANÇA DOC.: 1948608 foi 958,14 no banco; no razão, GONCALVES E AQUINO 1.089,10 somam 1.089,10. 130,96 a mais no razão.'],
      ['2026-03-16', 'data', 'DONA BEIJA (947,30) está no razão em 17/03; no banco foi em 16/03. Mudar a data.'],
      ['2026-05-18', 'lote', 'CRÉD.LIQ.COBRANÇA DOC.: 2096255 foi 8.398,18 no banco; no razão, QUEBA 5.109,72, SANTOS E OLIVEIRA 3.157,50 somam 8.267,22. 130,96 a menos no razão.'],
    ]);
  });
  it('a mesma diferença ao contrário liga os dois dias', () => {
    expect(r[0].dica).toBe('Os 130,96 a mais parecem ser de 18/05/2026 (lá faltam 130,96 no razão).');
    expect(r[2].dica).toBe('Os 130,96 que faltam parecem estar lançados em 06/03/2026 (lá sobram 130,96 no razão).');
  });
  it('mês sem razão, ou sem movimento, fica de fora', () => {
    expect(correcoesDoRazao(e, 'sicoob', 'sicoob', ['2026-03'], ['2026-03'])).toEqual([]);
    expect(correcoesDoRazao(emp([arq('e3', 'banco', [L('2026-03-06', 100, 'X')])]), 'sicoob', 'sicoob', ['2026-03'])).toEqual([]);
  });
});
