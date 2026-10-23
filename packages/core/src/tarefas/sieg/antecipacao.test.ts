import { describe, expect, it } from 'vitest';
import { arred, calcularAntecipacao, cfopDeEntrada, contaDaAntecipacao, filtrarAntecipacao, htmlDaAntecipacao, linhasDaAntecipacao, resumoDaAntecipacao, totaisDaAntecipacao, type LinhaDaAntecipacao, type NotaDoSieg, type NotasSieg } from '.';

// a aba CÁLCULO da planilha "Antecipação ICMS-ES 585.xlsx" (Heverton, 22/10/2026): NF-e, data, CST, valor da operação (E),
// base ICMS NF (F), alíquota interestadual (G), ICMS destacado (H), e o que a planilha calculou: ICMS interno (K) e antecipação (L)
const PLANILHA: [string, string, string, number, number, number, number, number, number][] = [
  ['213719', '06/01/2026', '000', 4577.6, 4433.52, 7, 310.35, 778.19, 467.84],
  ['213719', '06/01/2026', '500', 1446.01, 1400.5, 7, 98.04, 245.82, 147.78],
  ['213719', '06/01/2026', '100', 1879.15, 1820, 4, 72.8, 319.46, 246.66],
  ['14696', '13/02/2026', '000', 2076, 2076, 7, 145.34, 352.92, 207.58],
  ['215846', '19/02/2026', '000', 5382.42, 5212.99, 7, 364.92, 915.01, 550.09],
  ['216621', '06/03/2026', '500', 1485.67, 1438.91, 7, 100.73, 252.56, 151.83],
  ['216621', '06/03/2026', '000', 4171.23, 4039.93, 7, 282.8, 709.11, 426.31],
  ['15024', '14/05/2026', '000', 2874.69, 2812, 7, 196.84, 488.7, 291.86],
  ['221235', '03/06/2026', '000', 976.75, 946, 7, 66.22, 166.05, 99.83],
  ['221235', '03/06/2026', '500', 3819.9, 3699.66, 7, 258.98, 649.38, 390.4],
  ['221235', '03/06/2026', '100', 346.98, 325.8, 4, 13.03, 58.99, 45.96],
  ['15093', '03/06/2026', '000', 5790.29, 5664.95, 7, 396.56, 984.35, 587.79],
  ['15093', '03/06/2026', '200', 262.45, 262.45, 4, 10.5, 44.62, 34.12],
  ['189854', '01/07/2026', '000', 1655.89, 1603.76, 7, 112.26, 281.5, 169.24],
  ['189854', '01/07/2026', '100', 9374.26, 9079.18, 4, 363.18, 1593.62, 1230.44],
  ['224432', '04/08/2026', '000', 1630.75, 1579.42, 7, 110.56, 277.23, 166.67],
  ['224432', '04/08/2026', '500', 1157.13, 1120.7, 7, 78.45, 196.71, 118.26],
  ['112123', '10/08/2026', '000', 3330.46, 3225.62, 7, 225.79, 566.18, 340.39],
  ['112123', '10/08/2026', '300', 165.2, 160, 4, 6.4, 28.08, 21.68],
  ['15363', '19/08/2026', '000', 2827.33, 2747.6, 7, 192.33, 480.65, 288.32],
  ['238992', '20/08/2026', '000', 7468.21, 7233.13, 7, 506.32, 1269.6, 763.28],
  ['225519', '25/08/2026', '000', 1173, 1136.09, 7, 79.53, 199.41, 119.88],
  ['225519', '25/08/2026', '100', 201.59, 189.28, 4, 7.57, 34.27, 26.7],
  ['225519', '25/08/2026', '000', 2191.95, 2122.96, 7, 148.61, 372.63, 224.02],
  ['488782', '27/08/2026', '000', 1654.25, 1553.29, 7, 108.73, 281.22, 172.49],
  ['488782', '27/08/2026', '500', 6244.08, 5863, 7, 410.41, 1061.49, 651.08],
  ['89444', '01/09/2026', '000', 4400, 4261.5, 7, 298.3, 748, 449.7],
  ['89685', '09/09/2026', '000', 22000, 21307.5, 7, 1491.53, 3740, 2248.47],
  ['15484', '17/09/2026', '000', 2098.04, 2032, 7, 142.24, 356.67, 214.43],
  ['192062', '18/09/2026', '100', 4560.27, 4416.73, 4, 176.67, 775.25, 598.58],
  ['192062', '18/09/2026', '000', 3740.21, 3622.48, 7, 253.57, 635.84, 382.27],
  ['16114', '22/09/2026', '101', 6080, 6080, 7, 425.6, 1033.6, 608],
  ['114800', '25/09/2026', '000', 6456.25, 6456.25, 7, 451.94, 1097.56, 645.62],
];

const linhaDa = ([numero, data, cst, valor, base, aliq, icms]: (typeof PLANILHA)[number], i: number): LinhaDaAntecipacao => ({
  id: 'L' + i, chave: 'CH' + numero, numero, data, competencia: data.slice(6) + '-' + data.slice(3, 5), fornecedor: { doc: '', nome: '' },
  cfop: '2102', cfopDoFornecedor: '6102', cst, valorOperacao: valor, baseNf: base, aliquotaInterestadual: aliq, icmsDestacado: icms,
  aliquotaEstimada: false, ncms: [], sugestao: 'a-conferir', motivo: '',
});
const todasConferidas = Object.fromEntries(PLANILHA.map((_, i) => ['L' + i, { situacao: 'conferido' as const, por: 'Heverton', em: '2026-09-30T12:00:00.000Z' }]));

describe('a antecipação do ICMS do ES (a planilha do cliente 585)', () => {
  it('cada linha bate com a aba CÁLCULO (ICMS interno e antecipação, 17%)', () => {
    const calc = calcularAntecipacao(PLANILHA.map(linhaDa), 17, todasConferidas);
    calc.forEach((l, i) => {
      const [, , , valor, , , , interno, antecipacao] = PLANILHA[i];
      expect(l.baseAntecipacao).toBe(valor);
      expect(l.icmsInterno).toBe(interno);
      expect(l.antecipacao).toBe(antecipacao);
    });
  });
  it('o RESUMO bate: 33 NF-e, 123.498,01, ICMS 7.907,10, antecipação 13.087,57, 33 conferidas', () => {
    const r = resumoDaAntecipacao(calcularAntecipacao(PLANILHA.map(linhaDa), 17, todasConferidas));
    expect(r.linhas).toBe(33);
    expect(r.notas).toBe(20);
    expect(r.valorOperacao).toBe(123498.01);
    expect(r.icmsDestacado).toBe(7907.1);
    expect(r.baseNf).toBe(119923.2);
    expect(r.baseAntecipacao).toBe(123498.01);
    expect(r.icmsInterno).toBe(20994.67);
    expect(r.antecipacao).toBe(13087.57);
    expect(r.aRecolher).toBe(13087.57);
    expect(r.porSituacao).toEqual({ 'a-conferir': 0, conferido: 33, revisar: 0, dispensado: 0, 'nao-se-aplica': 0 });
    expect(r.porMes.map(m => m.mes)).toEqual(['2026-01', '2026-02', '2026-03', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(r.porMes[0].antecipacao).toBe(862.28);
  });
  it('o RELATÓRIO de setembro: 7 linhas, 49.334,77 e 5.147,07 (o que a aba RELATÓRIO mostrava)', () => {
    const set = filtrarAntecipacao(calcularAntecipacao(PLANILHA.map(linhaDa), 17, todasConferidas), { mes: '2026-09', situacao: 'conferido' });
    const t = totaisDaAntecipacao(set);
    expect([t.linhas, t.valorOperacao, t.icmsDestacado, t.icmsInterno, t.antecipacao]).toEqual([7, 49334.77, 3239.85, 8386.92, 5147.07]);
    const html = htmlDaAntecipacao({ empresa: { razaoSocial: 'MORONI & XAVIER AUTOPEÇAS LTDA - ME', cnpj: '62.768.139/0002-18', inscricaoEstadual: '84704462', regime: 'SIMPLES NACIONAL', endereco: '', municipio: 'ALFREDO CHAVES/ES', responsavel: '' }, filtros: { mes: '09 - Setembro', ano: '2026', situacao: 'Conferido' }, linhas: set, aliquotaInterna: 17, elaboradoPor: 'Heverton', emitidoEm: new Date(2026, 8, 30) });
    expect(html).toContain('size:A4 landscape');
    expect(html).toContain('MORONI &amp; XAVIER');
    expect(html).toContain('5.147,07');
  });
  it('a alíquota interna muda as contas; o arredondamento é o da planilha', () => {
    expect(contaDaAntecipacao(4577.6, 310.35, 17)).toEqual({ base: 4577.6, icmsInterno: 778.19, antecipacao: 467.84 });
    expect(contaDaAntecipacao(1000, 120, 19.5)).toEqual({ base: 1000, icmsInterno: 195, antecipacao: 75 });
    expect(arred(0.125)).toBe(0.13);
    expect(arred(-0.125)).toBe(-0.13);
  });
});

describe('as linhas a partir dos XMLs do SIEG', () => {
  const nota = (numero: string, data: string, itens: NotaDoSieg['itens'], extra: Partial<NotaDoSieg> = {}): NotaDoSieg => ({
    tipo: 'NF-e', chave: 'CH' + numero, numero, serie: '1', data, emitente: { doc: '11', nome: 'FORNECEDOR SP' }, destinatario: { doc: '22', nome: 'EU' }, valor: 0, itens, ...extra,
  });
  const mes = (competencia: string, recebidas: NotaDoSieg[]): NotasSieg => ({ codigo: '585', competencia, em: '', pasta: '', arquivos: 0, novos: 0, emitidas: [], recebidas, resumo: 3 });

  it('as notas da planilha viram linhas (por CST e alíquota) e as contas batem', () => {
    const porNota = new Map<string, NotaDoSieg>();
    for (const [numero, data, cst, valor, base, aliq, icms] of PLANILHA) {
      const n = porNota.get(numero) || nota(numero, data, []);
      n.itens!.push({ ncm: '87089990', cfop: '6102', cst, cest: '', valor: base, ipi: arred(valor - base), bc: base, aliq, icms });
      porNota.set(numero, n);
    }
    const linhas = linhasDaAntecipacao([mes('2026-01', [...porNota.values()])]);
    // a 225519 tem duas linhas CST 000 a 7% na planilha: aqui viram uma
    expect(linhas.length).toBe(32);
    expect(linhas.every(l => l.cfop === '2102' && l.sugestao === 'a-conferir')).toBe(true);
    const r = resumoDaAntecipacao(calcularAntecipacao(linhas, 17));
    expect([r.notas, r.valorOperacao, r.icmsDestacado, r.icmsInterno, r.antecipacao]).toEqual([20, 123498.01, 7907.1, 20994.67, 13087.57]);
    expect(r.porSituacao['a-conferir']).toBe(32);
  });
  it('só as NF-e recebidas de fora do estado, sem as canceladas e sem repetir a nota de outro mês', () => {
    const it6102 = { ncm: '1', cfop: '6102', cst: '000', cest: '', valor: 100, bc: 100, aliq: 12, icms: 12 };
    const linhas = linhasDaAntecipacao([
      mes('2026-08', [nota('1', '10/08/2026', [it6102]), nota('2', '11/08/2026', [{ ...it6102, cfop: '5102' }]), nota('3', '12/08/2026', [it6102], { cancelada: true }), nota('4', '13/08/2026', [it6102], { tipo: 'NFC-e' })]),
      mes('2026-09', [nota('1', '10/08/2026', [it6102])]),
      null,
    ]);
    expect(linhas.map(l => l.numero)).toEqual(['1']);
  });
  it('a sugestão: com ST ou fora do 2102, Não se aplica; sem a alíquota no item, estimada', () => {
    const linhas = linhasDaAntecipacao([mes('2026-09', [
      nota('5', '01/09/2026', [{ ncm: '1', cfop: '6403', cst: '010', cest: '', valor: 100, icms: 7, st: 9 }]),
      nota('6', '02/09/2026', [{ ncm: '1', cfop: '6910', cst: '000', cest: '', valor: 50, icms: 3.5 }]),
      nota('7', '03/09/2026', [{ ncm: '1', cfop: '6102', cst: '000', cest: '', valor: 200, desp: 10, icms: 14.7 }, { ncm: '2', cfop: '6102', cst: '000', cest: '', valor: 100, icms: 7 }]),
    ])]);
    expect(linhas.map(l => [l.numero, l.cfop, l.sugestao, l.motivo])).toEqual([
      ['5', '2403', 'nao-se-aplica', 'Com ICMS-ST na nota'],
      ['6', '2910', 'nao-se-aplica', 'CFOP 2910: não é compra para comercialização'],
      ['7', '2102', 'a-conferir', ''],
    ]);
    const l7 = linhas[2];
    expect([l7.aliquotaInterestadual, l7.aliquotaEstimada, l7.valorOperacao, l7.baseNf, l7.icmsDestacado, l7.ncms]).toEqual([7, true, 310, 310, 21.7, ['1', '2']]);
  });
  it('o CFOP de entrada', () => {
    expect(['6102', '6101', '6403', '6910', '5102', ''].map(cfopDeEntrada)).toEqual(['2102', '2102', '2403', '2910', '', '']);
  });
  it('a marca vale no lugar da sugerida; o "a recolher" tira Dispensado e Não se aplica', () => {
    const linhas = calcularAntecipacao(PLANILHA.slice(0, 2).map(linhaDa), 17);
    const marcas = { L1: { situacao: 'dispensado' as const, por: 'Heverton', em: '2026-10-22T12:00:00.000Z' } };
    expect(calcularAntecipacao(PLANILHA.slice(0, 2).map(linhaDa), 17, marcas)[1].marca).toEqual(marcas.L1);
    const t = totaisDaAntecipacao(calcularAntecipacao(PLANILHA.slice(0, 2).map(linhaDa), 17, marcas));
    expect([t.antecipacao, t.aRecolher]).toEqual([615.62, 467.84]);
    expect(linhas[1].situacao).toBe('a-conferir');
  });
});
