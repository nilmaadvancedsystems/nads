import { describe, expect, it } from 'vitest';
import { anoDoTexto, lancamentosDoPdf, saldoAnteriorDoPdf, type ItemDeTexto } from './extrato';

/** Monta uma página: cada linha é [texto, x] com a mesma altura; as linhas descem de 14 em 14. */
function pagina(linhas: [string, number][][]): ItemDeTexto[] {
  const itens: ItemDeTexto[] = [];
  linhas.forEach((l, i) => {
    for (const [texto, x] of l) itens.push({ texto, x, y: 800 - i * 14, largura: texto.length * 5 });
  });
  return itens;
}

describe('extrato em PDF', () => {
  it('coluna Valor com sinal e coluna Saldo ignorada; histórico da linha de baixo junta', () => {
    const p = pagina([
      [['BANCO EXEMPLO S.A. Período: 01/08/2026 a 31/08/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]],
      [['31/07/2026', 40], ['SALDO ANTERIOR', 100], ['10.000,00', 480]],
      [['03/08/2026', 40], ['PIX RECEBIDO', 100], ['4.500,00', 400], ['14.500,00', 480]],
      [['CLIENTE ALFA', 100]],
      [['04/08/2026', 40], ['PAGTO BOLETO ENERGIA', 100], ['-1.289,00', 400], ['13.211,00', 480]],
      [['TARIFA PACOTE', 100], ['-45,90', 400], ['13.165,10', 480]],
      [['SALDO DO DIA', 100], ['13.165,10', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2000)).toEqual([
      { data: '2026-08-03', valor: 450000, historico: 'PIX RECEBIDO CLIENTE ALFA' },
      { data: '2026-08-04', valor: -128900, historico: 'PAGTO BOLETO ENERGIA' },
      { data: '2026-08-04', valor: -4590, historico: 'TARIFA PACOTE' },
    ]);
  });

  it('colunas Débito e Crédito dão o sinal; D/C colado no valor também', () => {
    const p = pagina([
      [['Data', 40], ['Histórico', 100], ['Débito', 330], ['Crédito', 410], ['Saldo', 490]],
      [['05/08', 40], ['SAQUE', 100], ['200,00', 330], ['800,00', 490]],
      [['06/08', 40], ['DEPOSITO', 100], ['300,00', 410], ['1.100,00', 490]],
      [['07/08', 40], ['ESTORNO', 100], ['50,00', 300], ['C', 332]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-08-05', -20000], ['2026-08-06', 30000], ['2026-08-07', 5000],
    ]);
  });

  it('no razão (sistema) débito na conta do banco é entrada', () => {
    const p = pagina([
      [['Data', 40], ['Histórico', 100], ['Débito', 330], ['Crédito', 410]],
      [['05/08/2026', 40], ['Recebimento', 100], ['100,00', 330]],
      [['06/08/2026', 40], ['Pagamento', 100], ['40,00', 410]],
    ]);
    expect(lancamentosDoPdf([p], 'sistema').map(l => l.valor)).toEqual([10000, -4000]);
  });

  it('sem coluna nem sinal, o histórico decide; data do dia vale para as linhas seguintes', () => {
    const p = pagina([
      [['10/08/2026', 40], ['TARIFA MENSAL', 100], ['30,00', 400]],
      [['PIX RECEBIDO JOAO', 100], ['70,00', 400]],
    ]);
    expect(lancamentosDoPdf([p], 'banco')).toEqual([
      { data: '2026-08-10', valor: -3000, historico: 'TARIFA MENSAL' },
      { data: '2026-08-10', valor: 7000, historico: 'PIX RECEBIDO JOAO' },
    ]);
  });

  it('ano das datas sem ano: o que mais aparece no texto', () => {
    expect(anoDoTexto('Período 01/08/2025 a 31/08/2025 emitido em 02/09/2026', 2000)).toBe(2025);
    expect(anoDoTexto('Extrato de agosto de 2024', 2000)).toBe(2024);
    expect(anoDoTexto('nada', 2000)).toBe(2000);
  });
});

describe('palavra de saldo solta no histórico não esconde o lançamento (Vitor, 09/10/2026)', () => {
  it('"IOF S/ UTILIZACAO LIMITE", "TRANSPORTES" e "TOTAL" no histórico entram; as linhas de saldo e total não', () => {
    const p = pagina([
      [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]],
      [['31/12/2025', 40], ['SALDO ANTERIOR', 100], ['-537,11', 480]],
      [['05/01/2026', 40], ['IOF S/ UTILIZACAO LIMITE 8210846', 100], ['-414,60', 400], ['24.017,18', 480]],
      [['PIX RECEBIDO DELLAS TRANSPORTES LTDA', 100], ['1.000,00', 400], ['25.017,18', 480]],
      [['PAGTO TOTAL ATACADO LTDA', 100], ['-17,18', 400], ['25.000,00', 480]],
      [['Total', 100], ['568,22', 400]],
      [['Limite disponível', 100], ['5.000,00', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2000).map(l => l.valor)).toEqual([-41460, 100000, -1718]);
  });
});

describe('data curta no fim de um histórico quebrado não abre dia novo (Vitor, 09/10/2026)', () => {
  it('"REM: FULANO" / "21/03" no meio do dia 23/03 continua no 23/03', () => {
    const p = pagina([
      [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]],
      [['23/03/2026', 40], ['PIX RECEBIDO REM: ROGERIO 23/03', 100], ['2.000,00', 400], ['10.000,00', 480]],
      [['TRANSFERENCIA PIX REM: LEONARDO MENDES', 100], ['2.465,00', 400], ['12.465,00', 480]],
      [['21/03', 100]],
      [['TRANSFERENCIA PIX REM: ANDERSON 21/03', 100], ['880,00', 400], ['13.345,00', 480]],
      [['24/03/2026', 40], ['TARIFA', 100], ['-10,00', 400], ['13.335,00', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2000).map(l => l.data + ' ' + l.valor)).toEqual(['2026-03-23 200000', '2026-03-23 246500', '2026-03-23 88000', '2026-03-24 -1000']);
  });
});

describe('saldo anterior do extrato (abre a conta quando não há mês antes)', () => {
  it('a linha SALDO ANTERIOR: o valor da direita, com o sinal', () => {
    const p = pagina([
      [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]],
      [['31/12/2025', 40], ['SALDO ANTERIOR', 100], ['10.000,00', 480]],
      [['02/01/2026', 40], ['PIX RECEBIDO', 100], ['4.500,00', 400], ['14.500,00', 480]],
    ]);
    expect(saldoAnteriorDoPdf([p])).toBe(1000000);
    const d = pagina([[['SALDO ANTERIOR', 100], ['1.250,30', 470], ['D', 520]]]);
    expect(saldoAnteriorDoPdf([d])).toBe(-125030);
    expect(saldoAnteriorDoPdf([pagina([[['02/01/2026', 40], ['PIX', 100], ['10,00', 400]]])])).toBeNull();
  });
});
