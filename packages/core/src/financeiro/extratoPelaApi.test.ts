import { describe, expect, it } from 'vitest';
import { linhasDoExtrato } from './banco';
import {
  emendarComOManual, fecharImportacao, idDaImportacaoPelaApi, importacoesPelaApi, juntarArquivosDoExtrato, lidasDoSicoob, loteDaConta,
  lotesDoCnab240, mesesParaBuscar, ultimoDiaDoMes, ultimoDiaManual, type LoteDoCnab,
} from './extratoPelaApi';

// uma linha CNAB 240: os campos nas posições (1-based, como no manual da FEBRABAN)
function linhaCnab(campos: [number, string][]): string {
  const l = Array.from({ length: 240 }, () => ' ');
  for (const [pos, v] of campos) for (let i = 0; i < v.length; i++) l[pos - 1 + i] = v[i];
  return l.join('');
}
const valor18 = (centavos: number) => String(centavos).padStart(18, '0');
const headerDoLote = (conta: string, dv: string, data: string, saldo: number, dc = 'C') =>
  linhaCnab([[1, '364'], [4, '0001'], [8, '1'], [9, 'E'], [10, '04'], [53, '00001'], [59, conta.padStart(12, '0')], [71, dv], [73, 'NILMA CONTABILIDADE LTDA'], [143, data], [151, valor18(saldo)], [169, dc], [170, 'F']]);
const segmentoE = (data: string, centavos: number, dc: string, historico: string, complemento = '') =>
  linhaCnab([[1, '364'], [4, '0001'], [8, '3'], [14, 'E'], [114, complemento], [143, data], [151, valor18(centavos)], [169, dc], [177, historico]]);
const trailerDoLote = (data: string, saldo: number, dc = 'C') => linhaCnab([[1, '364'], [4, '0001'], [8, '5'], [143, data], [151, valor18(saldo)], [169, dc], [170, 'F']]);

describe('a resposta do extrato do Sicoob (API Conta Corrente)', () => {
  const resposta = {
    resultado: {
      saldoAnterior: '1000.00', saldoAtual: '1405.50',
      transacoes: [
        { tipo: 'CREDITO', valor: '500.00', data: '2026-11-03T00:00:00-03:00', descricao: 'PIX RECEBIDO', descInfComplementar: 'CLIENTE ABC LTDA' },
        { tipo: 'DEBITO', valor: '94.50', data: '2026-11-04T00:00:00-03:00', descricao: 'TARIFA PACOTE' },
        { tipo: 'DEBITO', valor: 0, data: '2026-11-04', descricao: 'ZERADO' },
        { tipo: 'CREDITO', valor: '1405.50', data: '2026-11-04', descricao: 'SALDO DO DIA' },
        { tipo: 'CREDITO', valor: '10', descricao: 'SEM DATA' },
      ],
    },
  };
  it('as linhas em centavos com o sinal pelo tipo, o histórico com o complemento, sem saldo, zero nem sem data', () => {
    const r = lidasDoSicoob(resposta);
    expect(r.lidas).toEqual([
      { data: '2026-11-03', valor: 50000, historico: 'PIX RECEBIDO - CLIENTE ABC LTDA' },
      { data: '2026-11-04', valor: -9450, historico: 'TARIFA PACOTE' },
    ]);
    expect(r.saldoAnterior).toBe(100000);
    expect(r.saldoAtual).toBe(140550);
  });
  it('aceita sem o "resultado", valor em número ou com vírgula, C/D e o sinal no próprio valor', () => {
    const r = lidasDoSicoob({ transacoes: [
      { tipo: 'C', valor: 12.3, data: '05/11/2026', descricao: 'TED' },
      { tipo: 'D', valor: '1.234,56', data: '2026-11-05', descricao: 'BOLETO PAGO' },
      { valor: '-7.00', data: '2026-11-05', descricao: 'IOF' },
    ] });
    expect(r.lidas.map(l => l.valor)).toEqual([1230, -123456, -700]);
    expect(r.lidas[0].data).toBe('2026-11-05');
    expect(r.saldoAnterior).toBeUndefined();
  });
  it('resposta vazia ou estranha não quebra', () => {
    expect(lidasDoSicoob(null).lidas).toEqual([]);
    expect(lidasDoSicoob({ resultado: { transacoes: 'x' } }).lidas).toEqual([]);
  });
});

describe('o extrato em CNAB 240 (API Extratos do Efí)', () => {
  const arquivo = [
    linhaCnab([[1, '364'], [4, '0000'], [8, '0']]),
    headerDoLote('998877', '1', '01112026', 200000),
    segmentoE('03112026', 15000, 'C', 'PIX RECEBIDO', 'FULANO DE TAL'),
    segmentoE('04112026', 2500, 'D', 'TARIFA'),
    segmentoE('04112026', 0, 'D', 'ZERADO'),
    trailerDoLote('04112026', 212500),
    headerDoLote('112233', '4', '01112026', 5000, 'D'),
    segmentoE('03112026', 100, 'C', 'RENDIMENTO').trimEnd(),
    trailerDoLote('03112026', 4900, 'D'),
    linhaCnab([[1, '364'], [4, '9999'], [8, '9']]),
  ].join('\r\n');
  const lotes = lotesDoCnab240(arquivo);
  it('um lote por conta, com saldo inicial, lançamentos e saldo final (D = devedor)', () => {
    expect(lotes).toHaveLength(2);
    expect(lotes[0]).toEqual({
      agencia: '1', conta: '998877-1',
      saldoInicial: { valor: 200000, data: '2026-11-01' },
      lidas: [{ data: '2026-11-03', valor: 15000, historico: 'PIX RECEBIDO - FULANO DE TAL' }, { data: '2026-11-04', valor: -2500, historico: 'TARIFA' }],
      saldoFinal: { valor: 212500, data: '2026-11-04' },
    });
    // a linha sem os brancos do fim também vale
    expect(lotes[1].lidas).toEqual([{ data: '2026-11-03', valor: 100, historico: 'RENDIMENTO' }]);
    expect(lotes[1].saldoFinal).toEqual({ valor: -4900, data: '2026-11-03' });
  });
  it('o lote da conta pelo número (com ou sem o dígito, com zeros); um lote só é ele', () => {
    expect(loteDaConta(lotes, '998877-1')?.conta).toBe('998877-1');
    expect(loteDaConta(lotes, '0000998877')?.conta).toBe('998877-1');
    expect(loteDaConta(lotes, '11223-3')).toBeNull();
    expect(loteDaConta(lotes, '112233-4')?.conta).toBe('112233-4');
    expect(loteDaConta([lotes[0]], '555')?.conta).toBe('998877-1');
    expect(loteDaConta(lotes, undefined)).toBeNull();
  });
  it('arquivos que se sobrepõem: cada dia de um arquivo só (o mais novo), e o saldo mais adiante', () => {
    const doMes: LoteDoCnab = { agencia: '1', conta: '1', lidas: [{ data: '2026-11-03', valor: 100, historico: 'A' }, { data: '2026-11-04', valor: 200, historico: 'B' }], saldoFinal: { valor: 300, data: '2026-11-04' } };
    const doDia: LoteDoCnab = { agencia: '1', conta: '1', lidas: [{ data: '2026-11-04', valor: 200, historico: 'B' }, { data: '2026-11-04', valor: 50, historico: 'C' }], saldoFinal: { valor: 350, data: '2026-11-04' } };
    const r = juntarArquivosDoExtrato([{ geradoEm: '2026-11-05T08:00:00', lote: doMes }, { geradoEm: '2026-11-05T09:00:00', lote: doDia }]);
    expect(r.lidas.map(l => l.historico)).toEqual(['A', 'B', 'C']);
    expect(r.saldo).toEqual({ valor: 350, data: '2026-11-04' });
  });
});

describe('o período e a emenda com o extrato manual', () => {
  it('os meses que busca: o atual e, até o dia 5, também o anterior (virando o ano)', () => {
    expect(mesesParaBuscar('2026-11-19')).toEqual(['2026-11']);
    expect(mesesParaBuscar('2026-11-05')).toEqual(['2026-10', '2026-11']);
    expect(mesesParaBuscar('2027-01-02')).toEqual(['2026-12', '2027-01']);
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29');
    expect(ultimoDiaDoMes('2026-12')).toBe('2026-12-31');
  });
  it('o último dia manual: só os arquivos desta conta (a importação pela API não conta)', () => {
    const imps = [
      { id: 'arq1', ate: '2026-10-31', contaBancaria: 'c1' },
      { id: 'arq2', ate: '2026-11-10', contaBancaria: 'c1' },
      { id: idDaImportacaoPelaApi('c1', '2026-11'), ate: '2026-11-19', contaBancaria: 'c1' },
      { id: 'arq3', ate: '2026-11-15', contaBancaria: 'c2' },
    ];
    expect(ultimoDiaManual(imps, 'c1')).toBe('2026-11-10');
    expect(ultimoDiaManual(imps, 'c3')).toBeNull();
  });
  it('emenda: antes do último dia manual nada; no dia, só o que não bate em valor e sentido; depois, tudo', () => {
    const lidas = [
      { data: '2026-11-09', valor: 100, historico: 'antes' },
      { data: '2026-11-10', valor: 500, historico: 'igual ao manual' },
      { data: '2026-11-10', valor: 500, historico: 'segundo de 5,00 (o manual só tinha um)' },
      { data: '2026-11-10', valor: -500, historico: 'saída de 5,00 (o manual era entrada)' },
      { data: '2026-11-11', valor: 700, historico: 'depois' },
    ];
    const r = emendarComOManual(lidas, '2026-11-10', [{ valor: 5, tipo: 'E' }]);
    expect(r.map(l => l.historico)).toEqual(['segundo de 5,00 (o manual só tinha um)', 'saída de 5,00 (o manual era entrada)', 'depois']);
    expect(emendarComOManual(lidas, null, [])).toHaveLength(5);
  });
});

describe('as importações pela API (uma por conta e mês)', () => {
  const conta = { id: 'sicoob-3144-123456', marca: 'sicoob', nome: 'Sicoob', agencia: '3144', conta: '12345-6', apelido: 'PJ' };
  const lidas = [
    { data: '2026-10-30', valor: 10000, historico: 'PIX RECEBIDO' },
    { data: '2026-11-03', valor: 50000, historico: 'PIX RECEBIDO' },
    { data: '2026-11-04', valor: -9450, historico: 'TARIFA' },
  ];
  const imps = importacoesPelaApi({ banco: 'sicoob', conta, contaDoPlano: 'plano1', lidas, saldo: { valor: 140550, data: '2026-11-04' }, hoje: '2026-11-04' });
  it('o mês passado vai até o último dia; o corrente, até hoje, com o saldo; as linhas com o mesmo id do extrato por arquivo', () => {
    expect(imps.map(i => i.importacao)).toEqual([
      { id: 'api_sicoob-3144-123456_2026-10', banco: 'Sicoob', marca: 'sicoob', contaBancaria: conta.id, conta: 'plano1', rotuloDaConta: 'PJ · Ag. 3144 · C/C 12345-6', arquivo: 'API do Sicoob · 10/2026', de: '2026-10-30', ate: '2026-10-31' },
      { id: 'api_sicoob-3144-123456_2026-11', banco: 'Sicoob', marca: 'sicoob', contaBancaria: conta.id, conta: 'plano1', rotuloDaConta: 'PJ · Ag. 3144 · C/C 12345-6', arquivo: 'API do Sicoob · 11/2026', de: '2026-11-03', ate: '2026-11-04', saldoFinal: 1405.5 },
    ]);
    const nov = imps[1].linhas;
    expect(nov.map(l => [l.tipo, l.valor, l.importacao, l.contaBancaria, l.conta])).toEqual([
      ['E', 500, imps[1].importacao.id, conta.id, 'plano1'], ['S', 94.5, imps[1].importacao.id, conta.id, 'plano1'],
    ]);
    expect(nov.map(l => l.id)).toEqual(linhasDoExtrato(lidas.slice(1), 'Sicoob', 'qualquer', conta.id).map(l => l.id));
  });
  it('só o saldo (mês sem lançamento) ainda vira a importação do mês; saldo de antes do último dia manual não', () => {
    const so = importacoesPelaApi({ banco: 'efi', conta: { id: 'efi-1-998877', marca: 'efi', nome: 'Efí' }, lidas: [], saldo: { valor: 5000, data: '2026-11-19' }, hoje: '2026-11-19' });
    expect(so).toHaveLength(1);
    expect(so[0].importacao).toMatchObject({ banco: 'Efí', arquivo: 'API do Efí · 11/2026', de: '2026-11-01', ate: '2026-11-19', saldoFinal: 50 });
    expect(so[0].importacao).not.toHaveProperty('conta');
    expect(importacoesPelaApi({ banco: 'efi', conta: { id: 'e', marca: 'efi', nome: 'Efí' }, lidas: [], saldo: { valor: 5000, data: '2026-11-09' }, hoje: '2026-11-19', ultimoDiaManual: '2026-11-10' })).toEqual([]);
  });
  it('fechar: as novas para gravar e o resumo só das linhas desta importação (as de outra já estavam)', () => {
    const nov = imps[1];
    const [a, b] = nov.linhas;
    expect(fecharImportacao(nov, [])).toEqual({ novas: [a, b], resumo: { quantos: 2, entradas: 500, saidas: 94.5 } });
    // puxar de novo no dia seguinte: nada novo, o resumo continua o mesmo
    expect(fecharImportacao(nov, [{ id: a.id, importacao: nov.importacao.id }, { id: b.id, importacao: nov.importacao.id }])).toEqual({ novas: [], resumo: { quantos: 2, entradas: 500, saidas: 94.5 } });
    // a linha que já estava gravada por um arquivo não é dela
    expect(fecharImportacao(nov, [{ id: a.id, importacao: 'arquivo-x' }])).toEqual({ novas: [b], resumo: { quantos: 1, entradas: 0, saidas: 94.5 } });
  });
});
