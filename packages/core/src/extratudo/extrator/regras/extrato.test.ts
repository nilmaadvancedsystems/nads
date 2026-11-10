import { describe, expect, it } from 'vitest';
import { conferir } from './conferencia';
import { anoDoTexto, ehConsultasDoBB, ehItauPorPeriodo, ehPagBank, extratoDoPdf, lancamentosDoPdf, mesesSemMovimento, paginasPorMes, periodoDoExtrato, saldoAnteriorDoPdf, saldosDoDiaDoPdf, type ItemDeTexto } from './extrato';

/** Monta uma página: cada linha é [texto, x] com a mesma altura; as linhas descem de 14 em 14. */
function pagina(linhas: [string, number][][]): ItemDeTexto[] {
  const itens: ItemDeTexto[] = [];
  linhas.forEach((l, i) => {
    for (const [texto, x] of l) itens.push({ texto, x, y: 800 - i * 14, largura: texto.length * 5 });
  });
  return itens;
}

describe('extrato em PDF', () => {
  const CABECALHO: [string, number][] = [['Data', 40], ['Historico', 120], ['Valor', 400], ['Saldo', 500]];

  it('o valor de mil para cima sem o ponto é lido, e o saldo não vira o valor', () => {
    const p = pagina([CABECALHO,
      [['02/03/2026', 40], ['PIX RECEBIDO CLIENTE', 120], ['2500,00', 400], ['12345,67', 500]],
      [['03/03/2026', 40], ['TARIFA PACOTE', 120], ['-35,90', 400], ['12309,77', 500]],
      [['04/03/2026', 40], ['PAGTO FORNECEDOR', 120], ['-1200,00', 400], ['11109,77', 500]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026)).toEqual([
      { data: '2026-03-02', valor: 250000, historico: 'PIX RECEBIDO CLIENTE' },
      { data: '2026-03-03', valor: -3590, historico: 'TARIFA PACOTE' },
      { data: '2026-03-04', valor: -120000, historico: 'PAGTO FORNECEDOR' },
    ]);
  });

  it('o extrato que vira o ano: a data sem ano cai no ano certo pelo período escrito', () => {
    const p = pagina([
      [['Periodo:', 40], ['15/12/2025', 90], ['a', 150], ['15/01/2026', 160]],
      CABECALHO,
      [['20/12', 40], ['PIX RECEBIDO A', 120], ['100,00', 400], ['1.100,00', 500]],
      [['05/01', 40], ['PIX RECEBIDO B', 120], ['300,00', 400], ['1.400,00', 500]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.data)).toEqual(['2025-12-20', '2026-01-05']);
  });

  it('o extrato dentro de um ano só não muda com o período escrito', () => {
    const p = pagina([
      [['Periodo:', 40], ['01/03/2026', 90], ['a', 150], ['31/03/2026', 160]],
      CABECALHO,
      [['05/03', 40], ['PIX RECEBIDO A', 120], ['100,00', 400], ['1.100,00', 500]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.data)).toEqual(['2026-03-05']);
  });

  it('o nome que abre com palavra de resumo é lançamento; o total de verdade continua de fora', () => {
    const p = pagina([CABECALHO,
      [['02/03/2026', 40], ['TOTAL ATACADO LTDA', 120], ['150,00', 400], ['1.150,00', 500]],
      [['03/03/2026', 40], ['LIMITE ENGENHARIA SA', 120], ['250,00', 400], ['1.400,00', 500]],
      [['04/03/2026', 40], ['TRANSPORTE RODOVIARIO SILVA', 120], ['350,00', 400], ['1.750,00', 500]],
      [['05/03/2026', 40], ['TOTAL DE CREDITOS', 120], ['750,00', 400]],
      [['05/03/2026', 40], ['LIMITE DISPONIVEL', 120], ['5.000,00', 400]],
      [['TOTAL ATACADO LTDA', 120], ['999,00', 400]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.valor)).toEqual([15000, 25000, 35000]);
  });

  it('o BB com "(+)" escrito: o "Pagamento Débito" da maquininha é entrada (10/11/2026)', () => {
    const p = pagina([
      [['02/03/2026', 40]],
      [['14024', 40], ['Stone', 120], ['Pagamento', 150], ['Débito', 210], ['129,47', 400], ['(+)', 435]],
      [['02/03/2026', 40], ['Tarifa', 120], ['10,00', 400], ['(-)', 435]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.valor)).toEqual([12947, -1000]);
  });

  it('o "Saldo inicial" e o "Saldo final" na mesma linha: o saldo anterior é o inicial (10/11/2026)', () => {
    const p = pagina([[['Saldo', 40], ['inicial:', 70], ['40.980,06', 110], ['Saldo', 200], ['final:', 230], ['41.897,84', 270]]]);
    expect(saldoAnteriorDoPdf([p])).toBe(4098006);
  });

  it('o Inter: o dia por extenso, a saída com "-R$" e o saldo do dia na linha da data (10/11/2026)', () => {
    const p = pagina([
      [['Instituição:', 40], ['Banco', 100], ['Inter', 135]],
      [['2', 40], ['de', 50], ['Março', 62], ['de', 95], ['2026', 107], ['Saldo', 140], ['do', 170], ['dia:', 185], ['1.000,00', 210]],
      [['Pix', 40], ['recebido:', 60], ['FULANO', 120], ['300,00', 400], ['1.300,00', 480]],
      [['Pix', 40], ['enviado:', 60], ['CICLANO', 120], ['-R$', 395], ['300,00', 415], ['1.000,00', 480]],
    ]);
    const r = extratoDoPdf([p], 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-03-02', 30000], ['2026-03-02', -30000]]);
    expect(r.saldoAnteriorPelaLinha).toBe(100000);
    expect(r.saldosDoDia).toEqual([{ data: '2026-03-02', saldo: 100000 }]);
  });

  it('o InfinitePay: a data "01 Mar, 2026", as linhas só com a hora e o "+" no valor (10/11/2026)', () => {
    const p = pagina([
      [['01', 40], ['Mar,', 55], ['2026', 80], ['08:22', 110], ['Pix', 150], ['FULANO', 200], ['Recebido', 300], ['+100,00', 480]],
      [['09:11', 110], ['Pix', 150], ['CICLANO', 200], ['Enviado', 300], ['-50,00', 480]],
      [['Saldo', 110], ['do', 140], ['dia', 155], ['+', 470], ['150,00', 480]],
      [['02', 40], ['Mar,', 55], ['2026', 80], ['10:00', 110], ['Pix', 150], ['BELTRANO', 200], ['Recebido', 300], ['+20,00', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([['2026-03-01', 10000], ['2026-03-01', -5000], ['2026-03-02', 2000]]);
  });

  it('o Nubank pelo OCR: o dia lido com letra ("O8FEV2026") e o ano em pedaço separado não viram lançamento (20/10/2026)', () => {
    const p = pagina([
      [['01', 57], ['DE', 70], ['FEVEREIRO', 84], ['DE', 137], ['2026', 151], ['VALORES', 469], ['EM', 513], ['R$', 528]],
      [['O8FEV2026', 59], ['Totaldesaídas', 120], ['-19,47', 508]],
      [['Transferência', 120], ['enviada', 173], ['pelo', 205], ['Pix', 224], ['LOJA', 263], ['EXEMPLO', 293], ['19,47', 514]],
      [['Saldo', 120], ['do', 144], ['dia', 156], ['4,84', 515]],
      [['11', 58], ['FEV', 67], ['2026', 83], ['Total', 120], ['de', 142], ['saídas', 153], ['-3,00', 510]],
      [['Compra', 120], ['no', 153], ['débito', 164], ['PADARIA', 261], ['EXEMPLO', 303], ['3,00', 515]],
      [['Saldo', 120], ['do', 144], ['dia', 156], ['1,84', 517]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026)).toEqual([
      { data: '2026-02-08', valor: -1947, historico: 'Transferência enviada pelo Pix LOJA EXEMPLO' },
      { data: '2026-02-11', valor: -300, historico: 'Compra no débito PADARIA EXEMPLO' },
    ]);
  });

  it('os "Últimos Lançamentos" do Bradesco, depois do Total do período, não entram (19/10/2026)', () => {
    const p = pagina([
      [['Extrato de: Ag: 1 | CC: 2 | Entre 01/01/2026 e 31/01/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Crédito (R$)', 330], ['Débito (R$)', 400], ['Saldo (R$)', 480]],
      [['30/01/2026', 40], ['PIX QR CODE ESTATIC', 100], ['300,00', 330], ['1.300,00', 480]],
      [['TARIFA BANCARIA', 100], ['-13,87', 400], ['1.286,13', 480]],
      [['Total', 40], ['300,00', 330], ['-13,87', 400], ['1.286,13', 480]],
      [['Últimos Lançamentos', 40]],
      [['Data', 40], ['Lançamento', 100], ['Crédito (R$)', 330], ['Débito (R$)', 400], ['Saldo (R$)', 480]],
      [['03/03/2026', 40], ['SALDO ANTERIOR', 100], ['9.759,92', 480]],
      [['APLIC.INVEST FACIL', 100], ['-9.758,92', 400], ['1,00', 480]],
      [['04/03/2026', 40], ['LIQUIDACAO DE COBRANCA', 100], ['1.196,78', 330], ['1.197,78', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.data + ' ' + l.valor)).toEqual(['2026-01-30 30000', '2026-01-30 -1387']);
  });
  it('o Bradesco pelo OCR fica no período do "Entre … e …": o ano lido errado e a data do 1º dia embaralhada (06/11/2026)', () => {
    const p = pagina([
      [['Extrato de: Ag: 1 | CC: 2 | Entre 01/02/2026 e 28/02/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Crédito (R$)', 330], ['Débito (R$)', 400], ['Saldo (R$)', 480]],
      [['30/01/2026', 40], ['SALDO ANTERIOR', 100], ['1,00', 480]],
      // a data do 2/2 que o OCR embaralhou: o lançamento herdava o 30/01 do saldo anterior
      [['c2102/20268', 40], ['PAGTO ELETRON COBRANCA', 100], ['-100,00', 400], ['-99,00', 480]],
      [['TARIFA BANCARIA', 100], ['-0,90', 400], ['-99,90', 480]],
      // o "2026" lido "2028" e "2068"
      [['13/02/2028', 40], ['RESGATE INVEST FACIL', 100], ['1.000,00', 330], ['900,10', 480]],
      [['20/02/2068', 40], ['PIX RECEBIDO', 100], ['250,00', 330], ['1.150,10', 480]],
    ]);
    // a data embaralhada é lida (02/02), e não fica no 1º dia
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.data + ' ' + l.valor)).toEqual([
      '2026-02-02 -10000', '2026-02-02 -90', '2026-02-13 100000', '2026-02-20 25000',
    ]);
  });
  it('o Bradesco pelo OCR: o "c2r01r2026" é o 02/01, e a linha seguinte sem data fica no mesmo dia (não no saldo anterior)', () => {
    const p = pagina([
      [['Extrato de: Ag: 1 | CC: 2 | Entre 01/01/2026 e 31/01/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Crédito (R$)', 330], ['Débito (R$)', 400], ['Saldo (R$)', 480]],
      [['30/12/2025', 40], ['SALDO ANTERIOR', 100], ['1,00', 480]],
      [['c2r01r2026', 40], ['LIQUIDACAO DE COBRANCA', 100], ['131,25', 330], ['132,25', 480]],
      [['xx', 40], ['TARIFA BANCARIA', 100], ['-0,90', 400], ['131,35', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.data + ' ' + l.valor)).toEqual(['2026-01-02 13125', '2026-01-02 -90']);
  });
  it('o Bradesco pelo OCR: os valores sem vírgula, partidos e com o "−" lido como "1" ficam certos pelo saldo (06/11/2026)', () => {
    // (como no OCR: o título em palavras soltas, e os números terminando uns 25 pontos depois da palavra — Crédito em 365,
    // Débito em 430, Saldo em 505; os valores em 390, 455 e 530)
    const p = pagina([
      [['Extrato de: Ag: 1 | CC: 2 | Entre 01/01/2026 e 31/01/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Dcto.', 260], ['Crédito', 330], ['(R$)', 370], ['Débito', 400], ['(R$)', 435], ['Saldo', 480], ['(R$)', 510]],
      [['31/12/2025', 40], ['SALDO ANTERIOR', 100], ['200,00', 500]],
      // o "−12,34" lido "112,34", e o saldo 187,66 lido "18766"
      [['06/01/2026', 40], ['PAGTO ELETRON COBRANCA', 100], ['1001', 260], ['112,34', 425], ['18766', 505]],
      [['APLIC.INVEST FACIL', 100], ['1002', 260], ['-87,66', 425], ['100,00', 500]],
      // o crédito 1.234,56 lido "123456"
      [['09/01/2026', 40], ['RESGATE INVEST FACIL', 100], ['1003', 260], ['123456', 360], ['1.334,56', 490]],
      // o crédito 2.345,67 partido em "2.345" e "67"
      [['12/01/2026', 40], ['RESGATE INVEST FACIL', 100], ['1003', 260], ['2.345', 348], ['67', 380], ['3.680,23', 490]],
    ]);
    const ls = lancamentosDoPdf([p], 'banco', 2026);
    expect(ls.map(l => l.data + ' ' + l.valor)).toEqual(['2026-01-06 -1234', '2026-01-06 -8766', '2026-01-09 123456', '2026-01-12 234567']);
    // o Dcto fica no histórico, como veio
    expect(ls[0].historico).toContain('1001');
    expect(ls[2].historico).toContain('1003');
  });
  it('o Bradesco pelo OCR com o saldo negativo: o "−" perdido, o saldo anterior "7…", o saldo ilegível e o erro que a linha de baixo conserta (06/11/2026)', () => {
    const p = pagina([
      [['Extrato de: Ag: 1 | CC: 2 | Entre 01/02/2026 e 28/02/2026', 40]],
      [['Data', 40], ['Lançamento', 100], ['Dcto.', 260], ['Crédito', 330], ['(R$)', 370], ['Débito', 400], ['(R$)', 435], ['Saldo', 480], ['(R$)', 510]],
      // o "−11.234,56" lido "71.234,56" (o "−1" virou "7")
      [['30/01/2026', 40], ['SALDO ANTERIOR', 100], ['71.234,56', 485]],
      // os saldos negativos sem o "−"
      [['02/02/2026', 40], ['PAGTO ELETRON COBRANCA', 100], ['1001', 260], ['500,00', 425], ['11.734,56', 485]],
      // o saldo ilegível: a corrente anda com o valor (−10.734,56)
      [['TRANSFERENCIA PIX', 100], ['1002', 260], ['1.000,00', 350], ['x34,56', 500]],
      // um dígito trocado só no saldo (−12.734,56 lido "12.734,59"): fica o valor
      [['DEVOL.CHEQUE DEPOSITADO', 100], ['1003', 260], ['2.000,00', 415], ['12.734,59', 485]],
      [['CHEQUE COMPENSADO', 100], ['1004', 260], ['300,00', 425], ['13.034,56', 485]],
      // o valor e o saldo errados na mesma linha (600,00 e −12.434,56 lidos "800,00" e "12.434,06"): a de baixo conserta
      [['TRANSFERENCIA PIX', 100], ['1005', 260], ['800,00', 360], ['12.434,06', 485]],
      [['RENTAB INVEST FACILCRED*', 100], ['1006', 260], ['0,01', 370], ['12.434,55', 485]],
    ]);
    const r = extratoDoPdf([p], 'banco', 2026);
    expect(r.lancamentos.map(l => l.valor)).toEqual([-50000, 100000, -200000, -30000, 60000, 1]);
    expect(r.saldoAnteriorConferido).toBe(-1123456);
  });
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

describe('as páginas de cada mês (o PDF de vários meses quebrado para o Drive, Vitor, 09/10/2026)', () => {
  const cab: [string, number][] = [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]];
  it('a página que vira o mês entra nos dois; a do resumo, sem lançamento, fica com a de antes', () => {
    const p1 = pagina([cab, [['30/01/2026', 40], ['PIX RECEBIDO', 100], ['10,00', 400], ['10,00', 480]]]);
    const p2 = pagina([cab, [['31/01/2026', 40], ['TARIFA', 100], ['-1,00', 400], ['9,00', 480]], [['02/02/2026', 40], ['PIX RECEBIDO', 100], ['5,00', 400], ['14,00', 480]]]);
    const p3 = pagina([cab, [['03/02/2026', 40], ['TARIFA', 100], ['-1,00', 400], ['13,00', 480]]]);
    const p4 = pagina([[['Resumo do período', 40]]]);
    expect(paginasPorMes([p1, p2, p3, p4], 2000)).toEqual({ '2026-01': [0, 1], '2026-02': [1, 2, 3] });
  });
});

describe('o quadro RESUMO do fim não é lançamento (Vitor, 13/10/2026)', () => {
  it('"Cheque especial contratado: 10.000,00C" e os provisionados ficam de fora', () => {
    const p = pagina([
      [['Data', 40], ['Lançamento', 100], ['Valor (R$)', 400], ['Saldo (R$)', 480]],
      [['30/01/2026', 40], ['DÉB.TIT.COMPE EFETIVADO', 100], ['4.364,77D', 400], ['432,15D', 480]],
      [['RESUMO', 40]],
      [['Saldo em conta:', 40], ['432,15D', 480]],
      [['Cheque especial contratado:', 40], ['10.000,00C', 480]],
      [['Juros vencidos provisionados:', 40], ['12,00D', 480]],
      [['ENCARGOS VENCIDOS REMANESCENTES', 40]],
      [['Tarifas vencidas remanescentes:', 40], ['3,00D', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2000).map(l => l.valor)).toEqual([-436477]);
  });
});

describe('o extrato da Caixa (Vitor, 13/10/2026)', () => {
  // as colunas de verdade do PDF da Caixa: data 25, documento ~105, texto 147, valor ~410, saldo ~530
  const linha = (y: number, partes: [string, number][]) => partes.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 5 }));
  const p = [
    ...linha(630, [['Saldo anterior a 01/01/2026 R$ 10,40 C', 426]]),
    ...linha(604, [['2 de janeiro de 2026, sexta-feira', 26]]),
    ...linha(572, [['Data/Hora', 25], ['Nr. Doc.', 95], ['Descrição/Detalhamento', 147], ['Valor (R$)', 406], ['Saldo(R$)', 527]]),
    ...linha(551, [['02/01/2026', 25], ['AZCX VS CD', 147]]),
    ...linha(546, [['6726', 107], ['226,19 C', 417], ['236,59 C', 537]]),
    ...linha(542, [['07:30:31', 25]]),
    ...linha(527, [['DEB PIX INS MANUAL DADOS', 147]]),
    ...linha(517, [['02/01/2026', 25], ['11426314000177 LEONARDO MENDES', 147]]),
    ...linha(513, [['20925', 105], ['70,00 D', 421], ['166,59 C', 537]]),
    ...linha(508, [['09:25:41', 25], ['MARQUES', 147]]),
    ...linha(484, [['03/01/2026', 25], ['DEBITO DE IOF', 147]]),
    ...linha(479, [['0', 114], ['30,39 D', 421], ['136,20 C', 537]]),
    ...linha(475, [['03:48:54', 25]]),
    ...linha(459, [['SALDO DIA', 147]]),
    ...linha(454, [['0', 114], ['136,20 C', 537]]),
  ];
  it('cada bloco é um lançamento com o texto dele; o SALDO DIA não entra', () => {
    expect(lancamentosDoPdf([p], 'banco', 2000)).toEqual([
      { data: '2026-01-02', valor: 22619, historico: 'AZCX VS CD 6726' },
      { data: '2026-01-02', valor: -7000, historico: 'DEB PIX INS MANUAL DADOS 11426314000177 LEONARDO MENDES 20925 MARQUES' },
      { data: '2026-01-03', valor: -3039, historico: 'DEBITO DE IOF' },
    ]);
  });
});

describe('o depósito bloqueado não é lançamento (Sicoob, Vitor, 13/10/2026)', () => {
  it('"DEP.CHEQUE BLOQ.1D 2.300,00*" e o texto embaixo ficam de fora; a liberação entra limpa', () => {
    const p = pagina([
      [['Data', 40], ['Histórico', 100], ['Valor', 480]],
      [['06/08/2026', 40], ['DEP.CHEQUE BLOQ.1D', 100], ['2.300,00*', 480]],
      [['07/08/2026', 40], ['LIBERAÇÃO DE DEPÓSITO BLOQUEADO', 100], ['2.300,00C', 480]],
      [['10/08/2026', 40], ['DEP.CHEQUE BLOQ.1D', 100], ['5.780,00*', 480]],
      [['ENVELOPE: 0162682306', 100]],
      [['10/08/2026', 40], ['PIX RECEBIDO', 100], ['1.047,00C', 480]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2000)).toEqual([
      { data: '2026-08-07', valor: 230000, historico: 'LIBERAÇÃO DE DEPÓSITO BLOQUEADO' },
      { data: '2026-08-10', valor: 104700, historico: 'PIX RECEBIDO' },
    ]);
  });
});

describe('o extrato sem movimento (Vitor, 13/10/2026)', () => {
  it('a frase e os meses do período', () => {
    expect(mesesSemMovimento('Período: 01/01/2026 até 31/01/2026 … Nenhuma movimentação encontrada.')).toEqual(['2026-01']);
    expect(mesesSemMovimento('de 01/02/2026 a 30/04/2026 — Não há lançamentos no período')).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(mesesSemMovimento('Período: 01/01/2026 até 31/01/2026 PIX RECEBIDO 10,00')).toBeNull();
    // o período por extenso do Nubank (19/10/2026)
    expect(mesesSemMovimento('01 DE JANEIRO DE 2026 a 31 DE JANEIRO DE 2026 VALORES EM R$ Saldo inicial 1,00 Nenhuma movimentação realizada.')).toEqual(['2026-01']);
    expect(mesesSemMovimento('01 DE MARÇO DE 2026 a 30 DE ABRIL DE 2026 Nenhuma movimentação realizada.')).toEqual(['2026-03', '2026-04']);
  });
  it('o Extrato Consolidado do BNB: sem movimento só se toda conta corrente disser; o mês do "Mês:"', () => {
    const conta = (frase: string) => '> CONTA CORRENTE AGENCIA: 1 CONTA 2-3 SALDO ATUAL 0,00 ' + frase + ' > APLICACOES FINANCEIRAS: FUNDOS FUNDO EXEMPLO 10,00 ***NAO HOUVE MOVIMENTACAO NESTA CONTA NO MES DE REFERENCIA***. ';
    const nao = '***NAO HOUVE MOVIMENTACAO NESTA CONTA NO MES DE REFERENCIA***.';
    const inicio = 'Internet Banking BNB Extrato Consolidado Titular: EXEMPLO Mês: Outubro/2026 Data de Emissão: 09/11/2026 ';
    expect(mesesSemMovimento(inicio + conta(nao) + conta(nao))).toEqual(['2026-10']);
    expect(mesesSemMovimento(inicio + conta(nao) + conta('10 PIX RECEBIDO 5,00'))).toBeNull();
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

describe('BB "Consultas - Extrato de conta corrente": o período do extrato manda (empresa 380)', () => {
  it('lê o "Período do extrato 02 / 2026"', () => {
    expect(periodoDoExtrato('Agência 2705-7\nPeríodo do 02 / 2026\nextrato')).toBe('2026-02');
    expect(periodoDoExtrato('Período: 01/08/2026 a 31/08/2026')).toBeNull();
  });
  it('a linha com a Dt. balancete do mês anterior e a Dt. movimento no mês do extrato fica no mês do extrato', () => {
    const p = pagina([
      [['Período do', 40], ['02 / 2026', 160]],
      [['Dt. balancete', 40], ['Dt. movimento', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]],
      [['30/01/2026', 40], ['000 Saldo Anterior', 200], ['17,31 D', 480]],
      [['02/02/2026', 40], ['821 Pix - Recebido', 200], ['20.000,00 C', 400]],
      [['30/01/2026', 40], ['02/02/2026', 100], ['610 Estorno de Débito', 200], ['608,25 C', 400]],
      [['30/01/2026', 40], ['02/02/2026', 100], ['177 Débito Serviço Cobrança', 200], ['0,27 D', 400]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-02-02', 2000000], ['2026-02-02', 60825], ['2026-02-02', -27],
    ]);
  });
});

describe('BB "Consultas": vale a Dt. movimento (empresa 380)', () => {
  it('reconhece o layout e usa a 2ª data, também dentro do mês', () => {
    const p = pagina([
      [['Consultas - Extrato de conta corrente', 120]],
      [['Período do', 40], ['01 / 2026', 160]],
      [['Dt.', 40], ['Dt.', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]],
      [['balancete', 40], ['movimento', 100]],
      [['31/12/2025', 40], ['000 Saldo Anterior', 200], ['24,28 D', 480]],
      [['02/01/2026', 40], ['02/01/2026', 100], ['624 Cobrança', 200], ['300,69 C', 400]],
      [['02/01/2026', 40], ['05/01/2026', 100], ['610 Estorno de Débito', 200], ['276,41 C', 400]],
      [['05/01/2026', 40], ['06/01/2026', 100], ['610 Estorno de Débito', 200], ['152,48 C', 400]],
    ]);
    expect(ehConsultasDoBB(p.map(i => i.texto).join('\n'))).toBe(true);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-01-02', 30069], ['2026-01-05', 27641], ['2026-01-06', 15248],
    ]);
  });
});

describe('BB "Cliente - Conta atual": o mesmo cabeçalho Dt. balancete / Dt. movimento, vale a Dt. movimento (empresa 10)', () => {
  it('o "Movimento do Dia" de balancete 07/07 e movimento 08/07 sai em 08/07', () => {
    const p = pagina([
      [['Cliente - Conta atual', 40]],
      [['Período do extrato', 40], ['07 / 2026', 160]],
      [['Dt. balancete', 40], ['Dt. movimento', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]],
      [['01/07/2026', 40], ['000 Saldo Anterior', 200], ['0,00 C', 480]],
      [['07/07/2026', 40], ['435 Tarifa Pacote de Serviços', 200], ['12,00 D', 400]],
      [['07/07/2026', 40], ['08/07/2026', 100], ['900 Movimento do Dia', 200], ['100,00 C', 400], ['88,00 C', 480]],
    ]);
    expect(ehConsultasDoBB(p.map(i => i.texto).join('\n'))).toBe(true);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-07-07', -1200], ['2026-07-08', 10000],
    ]);
  });
});

describe('BB "Consultas": cada extrato só com o seu mês, sem repetir (empresa 380)', () => {
  const cab = (mes: string): [string, number][][] => [
    [['Consultas - Extrato de conta corrente', 120]], [['Período do', 40], [mes + ' / 2026', 160]],
    [['Dt.', 40], ['Dt.', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]], [['balancete', 40], ['movimento', 100]],
  ];
  it('janeiro não leva o 30/01 → 02/02 (vem no de fevereiro); o S A L D O do fim não é lançamento', () => {
    const jan = pagina([...cab('01'),
      [['31/12/2025', 40], ['000 Saldo Anterior', 200], ['24,28 D', 480]],
      [['05/01/2026', 40], ['05/01/2026', 100], ['624 Cobrança', 200], ['1.000,00 C', 400]],
      [['30/01/2026', 40], ['02/02/2026', 100], ['610 Estorno de Débito', 200], ['608,25 C', 400], ['1.583,97 C', 480]],
      [['31/01/2026', 40], ['0000', 160], ['00000', 180], ['999 S A L D O', 200], ['1.583,97 C', 480]],
    ]);
    const fev = pagina([...cab('02'),
      [['30/01/2026', 40], ['000 Saldo Anterior', 200], ['975,72 C', 480]],
      [['30/01/2026', 40], ['02/02/2026', 100], ['610 Estorno de Débito', 200], ['608,25 C', 400]],
      [['03/02/2026', 40], ['03/02/2026', 100], ['624 Cobrança', 200], ['10,00 C', 400]],
    ]);
    expect(lancamentosDoPdf([jan], 'banco', 2026).map(x => [x.data, x.valor])).toEqual([['2026-01-05', 100000]]);
    expect(lancamentosDoPdf([fev], 'banco', 2026).map(x => [x.data, x.valor])).toEqual([['2026-02-02', 60825], ['2026-02-03', 1000]]);
  });
});

describe('BB "Consultas": o valor com * (bloqueado) não é lançamento (empresa 380)', () => {
  it('"911 Depósito bloquead.1d útil 4.837,00 *" fica de fora', () => {
    const p = pagina([
      [['Consultas - Extrato de conta corrente', 120]], [['Período do', 40], ['05 / 2026', 160]],
      [['Dt.', 40], ['Dt.', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]], [['balancete', 40], ['movimento', 100]],
      [['29/05/2026', 40], ['911 Depósito bloquead.1d útil', 200], ['4.837,00', 400], ['*', 440]],
      [['29/05/2026', 40], ['624 Cobrança', 200], ['4.636,48 C', 400]],
    ]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(x => [x.data, x.valor])).toEqual([['2026-05-29', 463648]]);
  });
});

describe('o saldo do dia impresso no extrato (o Cheque especial se guia por ele)', () => {
  it('BB "Consultas": o Saldo da última linha do dia (pela Dt. balancete) e o S A L D O do fim no último dia', () => {
    const p = pagina([
      [['Consultas - Extrato de conta corrente', 120]], [['Período do', 40], ['01 / 2026', 160]],
      [['Dt.', 40], ['Dt.', 100], ['Histórico', 200], ['Valor R$', 400], ['Saldo', 480]], [['balancete', 40], ['movimento', 100]],
      [['31/12/2025', 40], ['000 Saldo Anterior', 200], ['24,28 D', 480]],
      [['02/01/2026', 40], ['02/01/2026', 100], ['624 Cobrança', 200], ['300,69 C', 400]],
      [['02/01/2026', 40], ['05/01/2026', 100], ['610 Estorno de Débito', 200], ['276,41 C', 400], ['276,31 C', 465]],
      [['30/01/2026', 40], ['30/01/2026', 100], ['264 Juros Saldo Devedor', 200], ['577,02 D', 400]],
      [['31/01/2026', 40], ['999 S A L D O', 200], ['0,02 D', 480]],
    ]);
    expect(saldosDoDiaDoPdf([p], 2026)).toEqual([{ data: '2026-01-02', saldo: 27631 }, { data: '2026-01-30', saldo: -2 }]);
  });
});

describe('PagBank: o sinal das saídas vem escrito, o valor sem sinal é entrada (empresa 10)', () => {
  const linhas = (cab: [string, number][][]): [string, number][][] => [
    ...cab,
    [['Periodo: 01/07/2026 a 31/07/2026', 40]],
    [['Data', 40], ['Descrição', 100], ['Valor', 480]],
    [['11/07/2026', 40], ['Vendas - Disponivel DEBITO VISA', 100], ['R$', 470], ['376,01', 500]],
    [['12/07/2026', 40], ['Pix enviado - Conta Teste', 100], ['-R$', 470], ['30,00', 500]],
    [['13/07/2026', 40], ['Pagamento de PIX do PagBank', 100], ['120,00', 500]],
  ];
  it('"Vendas - Disponivel DEBITO" e "Pagamento de PIX" sem sinal são entrada; o "-R$" solto é a saída', () => {
    const p = pagina(linhas([[['290 - PagSeguro Internet S/A', 300]]]));
    expect(ehPagBank(p.map(i => i.texto).join('\n'))).toBe(true);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-07-11', 37601], ['2026-07-12', -3000], ['2026-07-13', 12000],
    ]);
  });
  it('outro banco que só cita o PagSeguro (num Pix) não é PagBank', () => {
    expect(ehPagBank('Nu Pagamentos S.A.\nPix enviado PAGSEGURO INTERNET IP S.A.')).toBe(false);
  });
});

describe('Itaú "Lançamentos do período": o sinal das saídas vem escrito (report PGL7X5, 09/11/2026)', () => {
  const corpo: [string, number][][] = [
    [['01/04/2026', 35], ['REND PAGO APLIC AUT MAIS', 105], ['0,07', 481]],
    [['01/04/2026', 35], ['BOLETO PAGO LOJA TESTE', 105], ['-600,00', 465]],
    [['02/04/2026', 35], ['RECEBIMENTO REDE ELO', 105], ['EMPRESA DE PAGAMENTO S.A.', 241], ['91,02', 475]],
    [['02/04/2026', 35], ['SALDO TOTAL DISPONÍVEL DIA', 105], ['1.000,00', 526]],
  ];
  const cabecalho: [string, number][] = [['Data', 35], ['Lançamentos', 105], ['Razão Social', 241], ['CNPJ/CPF', 378], ['Valor (R$)', 460], ['Saldo (R$)', 520]];

  it('"REND PAGO" e o "PAGAMENTO" da razão social, sem sinal, são entrada; o "-" é a saída', () => {
    const p = pagina([[['Lançamentos do período:', 34], ['01/04/2026 até 30/04/2026', 131]], cabecalho, ...corpo]);
    expect(ehItauPorPeriodo(p.map(i => i.texto).join(' '))).toBe(true);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-04-01', 7], ['2026-04-01', -60000], ['2026-04-02', 9102],
    ]);
  });

  it('com o razão da conciliação do Alterdata (o crédito positivo), tudo confere, sem sinal trocado', () => {
    const p = pagina([cabecalho, ...corpo]);
    const extrato = lancamentosDoPdf([p], 'banco', 2026).map((l, i) => ({ ...l, id: 'b' + i, idArquivo: 'b', lado: 'banco' as const }));
    const razao = [['2026-04-01', -7], ['2026-04-01', 60000], ['2026-04-02', -9102]].map(([data, valor], i) => ({ data: data as string, valor: valor as number, historico: 'Caixa', conta: '10101', id: 's' + i, idArquivo: 's', lado: 'sistema' as const }));
    const r = conferir(extrato, razao);
    expect([r.sistemaInvertido, r.contagem.ok, r.contagem.diferente, r.contagem.faltando, r.contagem.amais]).toEqual([true, 3, 0, 0, 0]);
  });

  it('o extrato sem esse cabeçalho continua pelo histórico', () => {
    const p = pagina([[['Data', 35], ['Lançamentos', 105], ['Valor (R$)', 460]], [['01/04/2026', 35], ['BOLETO PAGO LOJA TESTE', 105], ['600,00', 475]]]);
    expect(lancamentosDoPdf([p], 'banco', 2026).map(l => l.valor)).toEqual([-60000]);
  });
});
