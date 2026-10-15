import { describe, expect, it } from 'vitest';
import { palavrasDoNome, sugestoesDeBaixa, type LancamentoDoBanco } from './sugestaoDeBaixa';

// nomes e valores inventados
const L = (data: string, valor: number, historico: string, banco = 'Sicoob'): LancamentoDoBanco => ({ data, valor, historico, banco });
const EXTRATO = [
  L('2026-03-01', 107000, 'PIX RECEBIDO OUTRA PESSOA'),
  L('2026-03-12', 107000, 'PIX RECEBIDO ALFAMINERA LTDA'),
  L('2026-03-15', 60000, 'PIX RECEBIDO ALFAMINERA LTDA'),
  L('2026-03-20', -107000, 'PIX ENVIADO ALFAMINERA'),
  L('2025-10-01', 107000, 'PIX RECEBIDO ALFAMINERA', 'BB'),
  L('2026-02-20', 99999, 'TED RECEBIDA BETA COMERCIO'),
];

describe('sugestoesDeBaixa (a nota em aberto × o extrato)', () => {
  it('cliente: o que entrou com o mesmo valor e o nome primeiro; parcial com o nome depois; fora do prazo e saída não', () => {
    const s = sugestoesDeBaixa({ data: '2026-02-25', valor: 1070 }, 'ALFAMINERA COMERCIO LTDA', EXTRATO, 1);
    expect(s.map(x => [x.data, x.valor, x.mesmoValor, x.mesmoNome])).toEqual([
      ['2026-03-12', 107000, true, true],
      ['2026-03-01', 107000, true, false],
      ['2026-03-15', 60000, false, true],
    ]);
  });
  it('fornecedor: só o que saiu', () => {
    expect(sugestoesDeBaixa({ data: '2026-02-25', valor: 1070 }, 'ALFAMINERA', EXTRATO, -1).map(x => x.data)).toEqual(['2026-03-20']);
  });
  it('sem nada parecido: nenhuma', () => {
    expect(sugestoesDeBaixa({ data: '2026-02-25', valor: 12.34 }, 'GAMA LTDA', EXTRATO, 1)).toEqual([]);
  });
  it('as palavras do nome que identificam', () => {
    expect(palavrasDoNome('Alfaminera Comércio e Indústria LTDA')).toEqual(['alfaminera']);
  });
});
