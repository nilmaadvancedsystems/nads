import { describe, expect, it } from 'vitest';
import { baixasGuardadas, comBaixa, faltaDaNota, mesmoLancamento, palavrasDoNome, selosDaSugestao, sugestoesDeBaixa, type LancamentoDoBanco } from './sugestaoDeBaixa';

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
  it('cliente: o total com o nome primeiro, o total sem o nome depois; o valor que não é parcela, antes da nota e saída, não', () => {
    const s = sugestoesDeBaixa({ data: '2026-02-25', valor: 1070 }, 'ALFAMINERA COMERCIO LTDA', EXTRATO, 1);
    expect(s.map(x => [x.data, x.valor, x.como, x.mesmoValor, x.mesmoNome])).toEqual([
      ['2026-03-12', 107000, 'total', true, true],
      ['2026-03-01', 107000, 'total', true, false],
    ]);
  });
  it('fornecedor: só o que saiu', () => {
    expect(sugestoesDeBaixa({ data: '2026-02-25', valor: 1070 }, 'ALFAMINERA', EXTRATO, -1).map(x => x.data)).toEqual(['2026-03-20']);
  });
  it('sem nada parecido: nenhuma', () => {
    expect(sugestoesDeBaixa({ data: '2026-02-25', valor: 12.34 }, 'GAMA LTDA', EXTRATO, 1)).toEqual([]);
  });

  // vendida 3.000,00 em 3x; a 1ª paga em 10/01; falta 2.000,00
  const NOTA = { data: '2025-12-10', valor: 2000, vendido: 3000, pagos: [{ data: '2026-01-10', valor: 1000 }] };
  const PARCELAS = [
    L('2026-01-10', 100000, 'PIX RECEBIDO ALFAMINERA'), // a já paga: fora
    L('2026-02-10', 100000, 'PIX RECEBIDO OUTRA PESSOA'), // igual à paga, sem o nome: vale
    L('2026-03-12', 105000, 'PIX RECEBIDO ALFAMINERA'), // a parcela com juros, com o nome
    L('2026-03-20', 66667, 'PIX RECEBIDO OUTRA PESSOA'), // o aberto em 3x, sem o nome: não
  ];
  it('as parcelas: igual à já paga, com juros pelo nome, na data esperada; a já paga e a divisão sem o nome, não', () => {
    const s = sugestoesDeBaixa(NOTA, 'ALFAMINERA LTDA', PARCELAS, 1);
    expect(s.map(x => [x.data, x.como, x.parcela, x.dataEsperada, x.mesmoNome])).toEqual([
      ['2026-02-10', 'parcela', 'como a de 10/01', true, false],
      ['2026-03-12', 'juros', 'como a de 10/01', true, true],
    ]);
    expect(selosDaSugestao(s[1], 'cliente').map(x => x.texto)).toEqual(['Igual à de 10/01', 'Com juros/multa', 'Data esperada', 'Mesmo nome']);
  });
  it('a divisão em 2 a 10x com o nome', () => {
    const s = sugestoesDeBaixa(NOTA, 'ALFAMINERA', [L('2026-04-25', 50000, 'PIX ALFAMINERA')], 1);
    expect(s.map(x => [x.como, x.parcela])).toEqual([['parcela', 'em 4x do aberto']]);
    expect(selosDaSugestao(s[0], 'cliente').map(x => x.texto)).toEqual(['Aberto em 4x', 'Mesmo nome']);
  });

  it('as palavras do nome que identificam', () => {
    expect(palavrasDoNome('Alfaminera Comércio e Indústria LTDA')).toEqual(['alfaminera']);
  });
});

describe('a baixa aceita', () => {
  const a = L('2026-03-12', 107000, 'PIX RECEBIDO ALFAMINERA');
  const b = L('2026-04-12', 50000, 'PIX RECEBIDO ALFAMINERA');
  it('aceita mais de uma na nota, desfaz uma, desfaz todas', () => {
    const um = comBaixa(undefined, 'k1', a, true);
    expect(um).toEqual({ k1: [a] });
    expect(comBaixa(um, 'k1', a, true)).toEqual({ k1: [a] });
    const dois = comBaixa(um, 'k1', b, true);
    expect(dois?.k1).toEqual([a, b]);
    expect(comBaixa(dois, 'k1', a, false)).toEqual({ k1: [b] });
    expect(comBaixa(um, 'k1', a, false)).toBeUndefined();
    expect(Object.keys(comBaixa(um, 'k2', a, true) || {})).toEqual(['k1', 'k2']);
    expect(mesmoLancamento(a, { ...a })).toBe(true);
    expect(mesmoLancamento(a, { ...a, valor: 1 })).toBe(false);
  });
  it('o que falta: com saldo, diminui; quitada (ou com juros), 0', () => {
    expect(faltaDaNota(2000, [a])).toBe(93000);
    expect(faltaDaNota(1070, [a])).toBe(0);
    expect(faltaDaNota(1000, [a])).toBe(0);
    expect(faltaDaNota(1070, [])).toBe(107000);
  });
  it('o guardado conferido (a de antes, uma só, vira lista)', () => {
    expect(baixasGuardadas({ k1: a, k2: { data: 1 }, k3: [b] })).toEqual({ k1: [a], k3: [b] });
    expect(baixasGuardadas(null)).toBeUndefined();
  });
});
