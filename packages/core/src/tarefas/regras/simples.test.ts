import { describe, expect, it } from 'vitest';
import { competenciaDoDas, conferirSimples, ehDasDoSimples } from './simples';
import type { RazaoDaConta } from './razao';

// o razão do Simples a recolher (credor positivo, como o Alterdata dá no passivo), com valores inventados
const razao = (saldoInicial: number, linhas: [string, number, string][]): RazaoDaConta => {
  let saldo = saldoInicial;
  const lancamentos = linhas.map(([data, valor, historico]) => {
    saldo = Math.round((saldo + valor) * 100) / 100;
    return { data, contrapartida: valor > 0 ? '76506' : '10501', nomeContrapartida: '', valor, codigoHistorico: '', historico, saldo };
  });
  return { lancamentos, saldoInicial, saldoFinal: saldo, inicio: lancamentos[0].data, fim: lancamentos[lancamentos.length - 1].data };
};

describe('o DAS do Simples no extrato', () => {
  it('reconhece o DAS (e não a GPS nem o "das" de um nome)', () => {
    expect(ehDasDoSimples('123 DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES EMPRESA REF JUN202')).toBe(true);
    expect(ehDasDoSimples('123 DÉB.CONV.TRIBUTOS FEDERAIS - RFB GPS EMPRESA REF Jun2026')).toBe(false);
    expect(ehDasDoSimples('Pix PIX EMITIDO Aluguel casa Vale das Pedras')).toBe(false);
  });
  it('a competência do "REF": o ano cortado vem do pagamento', () => {
    expect(competenciaDoDas('RFB DAS SIMPLES EMPRESA REF JUN202', '2026-07-20')).toBe('2026-06');
    expect(competenciaDoDas('RFB DAS SIMPLES REF DEZ202', '2026-01-21')).toBe('2025-12');
    expect(competenciaDoDas('RFB DAS SIMPLES', '2026-01-21')).toBe('');
  });
});

describe('o pagamento do Simples pelo banco (16/10/2026)', () => {
  const r = razao(1000, [
    ['2026-01-31', 2000, 'Pelo valor do Simples nacional a recolher.'],
    ['2026-02-20', -2000, 'Pago Simples Nacional referente 01/2026 conforme DARF quitado.'],
    ['2026-02-28', 1500, 'Pelo valor do Simples nacional a recolher.'],
    ['2026-03-31', 1800, 'Pelo valor do Simples nacional a recolher.'],
  ]);
  const extrato = [
    // o saldo anterior pago com atraso e juros (sem o REF)
    { data: '2026-01-25', valor: -102000, historico: 'DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES EMPRESA', banco: 'b1' },
    // o de janeiro: já está no razão
    { data: '2026-02-20', valor: -200000, historico: 'DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES EMPRESA', banco: 'b1' },
    // o de fevereiro, com o REF
    { data: '2026-03-20', valor: -150000, historico: 'DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES EMPRESA REF FEV202', banco: 'b1' },
  ];
  // o de fevereiro passou pelo caixa; o anterior, não
  const caixa = razao(0, [['2026-03-20', -1500, 'DÉB.CONV.TRIBUTOS FEDERAIS - RFB DAS SIMPLES']]);

  it('cada obrigação com o pagamento; o que o banco pagou vira a baixa (com os juros), contra o caixa ou o banco', () => {
    const c = conferirSimples(r, ['2026-01', '2026-02', '2026-03'], extrato, caixa);
    expect(c.obrigacoes.map(o => [o.competencia, o.anterior, o.valor, o.situacao, o.juros])).toEqual([
      ['2025-12', true, 1000, 'banco', 20], ['2026-01', false, 2000, 'ok', 0], ['2026-02', false, 1500, 'banco', 0], ['2026-03', false, 1800, 'depois', 0],
    ]);
    expect(c.sugestoes.map(s => [s.data, s.tipo, s.contra, s.valor])).toEqual([
      ['2026-01-25', 'pagamento', 'banco', 1000], ['2026-01-25', 'juros', 'banco', 20], ['2026-03-20', 'pagamento', 'caixa', 1500],
    ]);
    expect(c.sugestoes[0].historico).toBe('Pago Simples Nacional referente 12/2025 conforme DARF quitado.');
    // o razão em 4.300 (1.000 + 2.000 − 2.000 + 1.500 + 1.800); com as baixas, 1.800 (o de março, que vence em abril)
    expect([c.saldoDoRazao, c.saldoAjustado, c.saldoEsperado, c.diferenca]).toEqual([4300, 1800, 1800, 0]);
  });
});
