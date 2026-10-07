import { describe, expect, it } from 'vitest';
import { atencaoDoHistorico, atencoesDoMes, coberturaDoRazao, mesesCredores, mesesErrados, saldoErrado, razaoDeTeste, dataDoRazao, lerRazao, mesesDoRazao, precisaDoCreditor, valorComLado } from './razao';
import { caixaDeTeste, inssDeTeste, razaoDaFolhaDeTeste } from './deTeste';
import { conferirInss } from './inss';
import { ROTINA_CONTABIL } from '../rotinas/contabil';
import { adicionarEtapa, etapaNoMes, execucaoNova, fazer, proximaEtapa, retirarEtapa, situacaoDa } from './execucao';

// o começo do razão do caixa da 292 (conciliação do Alterdata, 01/2026)
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const CAIXA_292 = [
  CAB,
  ['VERDADEIRO', 'Não conciliado', 46027, '', '10503', 'Banco Sicoob - 01', -15.5, '', 'DÉB.CONV.DEM.EMPRES DOC.: MASTERCARD', -104952.55, ''],
  ['VERDADEIRO', 'Não conciliado', 46027, '', '36006', 'Pro Labore a Pagar ', 1351.02, '00124', 'Pagamento de retirada pró-labore <12/2025> MARCOS DE OLIVEIRA ROCHA', -103601.53, ''],
  ['VERDADEIRO', 'Não conciliado', 46029, '', '10503', 'Banco Sicoob - 01', -5647.5, '', 'PIX EMIT.OUTRA IF', -109249.03, ''],
];

describe('razão da conciliação do Alterdata', () => {
  it('lê os lançamentos, o saldo de antes e o do fim', () => {
    const r = lerRazao(CAIXA_292);
    expect(r.lancamentos).toHaveLength(3);
    expect(r.lancamentos[1]).toEqual({
      data: '2026-01-05', contrapartida: '36006', nomeContrapartida: 'Pro Labore a Pagar', valor: 1351.02,
      codigoHistorico: '00124', historico: 'Pagamento de retirada pró-labore <12/2025> MARCOS DE OLIVEIRA ROCHA', saldo: -103601.53,
    });
    expect(r.saldoInicial).toBe(-104937.05);
    expect(r.saldoFinal).toBe(-109249.03);
    expect([r.inicio, r.fim]).toEqual(['2026-01-05', '2026-01-07']);
  });
  it('a data em texto também serve; linha sem data ou sem valor fica de fora', () => {
    expect(dataDoRazao('11/02/2026')).toBe('2026-02-11');
    const r = lerRazao([CAB, ['', '', 'Total', '', '', '', 10, '', '', 0, ''], ['', '', '11/02/2026', '', '40007', 'Rescisoes a Pagar', '10,13', '00118', 'INSS', '2.915,04', '']]);
    expect(r.lancamentos.map(l => [l.data, l.valor, l.saldo])).toEqual([['2026-02-11', 10.13, 2915.04]]);
  });
  it('planilha que não é razão: avisa', () => {
    expect(() => lerRazao([['Conta', 'Saldo'], ['Caixa', 10]])).toThrow(/colunas do razão/);
    expect(() => lerRazao([CAB])).toThrow(/nenhum lançamento/);
  });
  it('débito/devedor é negativo', () => {
    expect([valorComLado(-15.5), valorComLado(1200), valorComLado(0)]).toEqual(['15,50 D', '1.200,00 C', '0,00']);
  });
});

describe('o caixa mês a mês e os pontos de atenção', () => {
  // históricos reais do caixa da 292 (01 a 08/2026)
  const L = (data: string, valor: number, saldo: number, historico: string) => ['', '', data, '', '10503', 'Banco Sicoob - 01', valor, '', historico, saldo, ''];
  const R = lerRazao([CAB,
    L('05/01/2026', -100, -1000, 'Recebimento de clientes 9925 -DUP.001'),
    L('09/02/2026', 74000, 4873.24, 'PIX RECEB.OUTRA IF Recebimento Pix MARCOS Mutuo financeiro'),
    L('09/02/2026', -1292.83, -1000, 'DÉB.CONV.ORGÃOS GOV IPVA OQV3402 DOC.: 15019076'),
    L('10/02/2026', -641, 2532.24, 'DÉB.TIT.COMPE.EFETI lj sistemas DOC.: 15252174'),
    L('20/07/2026', -2611.15, -3000, 'DB.CONV.TR FD-RFB inss ref. 06 2026 DOC.: 16631818'),
    L('03/08/2026', 1712.08, -1287.92, 'CRÉD.LIQ.COBRANÇA DOC.: 2254082'),
  ]);

  it('cada mês do período com os lançamentos e os saldos (mês sem lançamento repete o saldo)', () => {
    const ms = mesesDoRazao(R, ['2026-01', '2026-02', '2026-03', '2026-08']);
    expect(ms.map(m => [m.mes, m.lancamentos.length, m.saldoInicial, m.saldoFinal])).toEqual([
      ['2026-01', 1, -900, -1000], ['2026-02', 3, -1000, 2532.24], ['2026-03', 0, 2532.24, 2532.24], ['2026-08', 1, -3000, -1287.92],
    ]);
    // 09/02 termina devedor (o último lançamento do dia); 10/02 fica credor
    expect(ms[1].diasCredor).toEqual(['2026-02-10']);
  });

  it('os históricos do banco que caem no caixa', () => {
    expect([
      'CRÉD.LIQ.COBRANÇA DOC.: 2315761', 'DB.CONV.TR FD-RFB PIS/COFINS DOC.: 16656252', 'DÉB. TIT. COBRANÇA',
      'DÉB.TIT.COB.EFETIV ace DOC.: 15029802', 'DÉB.CONV.ORGÃOS GOV DOC.: 15252730', 'DÉB.CONV.SANEAMENTO copasa', 'Recebimento de clientes',
    ].map(atencaoDoHistorico)).toEqual(['liquidacao-cobranca', 'impostos-federais', 'boletos', 'boletos', 'impostos-orgaos', null, null]);
  });

  it('os pontos de cada mês, o obrigatório primeiro; o Creditor só no mês da liquidação', () => {
    const [fev, jul, ago] = mesesDoRazao(R, ['2026-02', '2026-07', '2026-08']);
    expect(atencoesDoMes(fev).map(p => [p.tipo, p.lancamentos.length, p.total])).toEqual([
      ['caixa-credor', 1, 2532.24], ['impostos-orgaos', 1, 1292.83], ['boletos', 1, 641],
    ]);
    expect(atencoesDoMes(jul).map(p => p.tipo)).toEqual(['impostos-federais']);
    expect(atencoesDoMes(ago)[0]).toMatchObject({ tipo: 'liquidacao-cobranca', obrigatorio: true, total: 1712.08 });
    expect([fev, jul, ago].map(precisaDoCreditor)).toEqual([false, false, true]);
  });

  it('o razão × o período: o mês que falta, os meses a mais e a liquidação fora do período', () => {
    expect(coberturaDoRazao(R, ['2026-01', '2026-02', '2026-03'])).toEqual({ faltam: ['2026-03'], aMais: ['2026-07', '2026-08'], liquidacaoFora: ['2026-08'] });
    expect(coberturaDoRazao(R, ['2026-01', '2026-02', '2026-07', '2026-08'])).toEqual({ faltam: [], aMais: [], liquidacaoFora: [] });
  });
});

describe('a etapa Creditor só quando adicionada', () => {
  const ex = execucaoNova('FITO', 292, '2026-08', 'contabil');
  it('sem adicionar, não entra no mês e conta como concluída', () => {
    expect(etapaNoMes(ex, 'creditor')).toBe(false);
    expect(situacaoDa(ex, 'creditor')).toBe('dispensada');
    expect(situacaoDa(ex, 'caixa')).toBe('pendente');
    expect(proximaEtapa(ex, ROTINA_CONTABIL)?.id).not.toBe('creditor');
  });
  it('adicionada, fica pendente e é a próxima depois do caixa; retirada, sai de novo', () => {
    const agora = new Date('2026-10-05T12:00:00Z');
    const a = adicionarEtapa(ex, 'creditor', 'CRÉD.LIQ.COBRANÇA no caixa', 'Vitor', agora);
    expect(a.evento).toMatchObject({ tipo: 'adicionada', etapa: 'creditor' });
    expect(situacaoDa(a.execucao, 'creditor')).toBe('pendente');
    const ate = ROTINA_CONTABIL.etapas.findIndex(e => e.id === 'creditor');
    let feita = a.execucao;
    for (const e of ROTINA_CONTABIL.etapas.slice(0, ate)) feita = fazer(feita, e.id, 'Vitor', agora).execucao;
    expect(proximaEtapa(feita, ROTINA_CONTABIL)?.id).toBe('creditor');
    expect(situacaoDa(retirarEtapa(a.execucao, 'creditor', '', 'Vitor', agora).execucao, 'creditor')).toBe('dispensada');
  });
});

describe('os razões de teste (o ⚡ do modo desenvolvedor)', () => {
  it('o caixa: o Creditor só com o CRÉD.LIQ.COBRANÇA, e dias de caixa credor', () => {
    const com = mesesDoRazao(caixaDeTeste(['2026-07', '2026-08'], true), ['2026-07', '2026-08']);
    expect(com.filter(precisaDoCreditor).map(m => m.mes)).toEqual(['2026-07']);
    expect(atencoesDoMes(com[0]).map(a => a.tipo)).toContain('caixa-credor');
    const sem = mesesDoRazao(caixaDeTeste(['2026-08'], false), ['2026-08']);
    expect(sem.some(precisaDoCreditor)).toBe(false);
  });
  it('o INSS: a guia do último mês com a patronal 10,00 a mais e o Adicional GILRAT fora da provisão', () => {
    const { razao, guias } = inssDeTeste(['2026-07', '2026-08']);
    const c = conferirInss(razao, guias, ['2026-07', '2026-08']);
    const ago = c.meses.find(m => m.mes === '2026-08');
    expect(ago?.grupos.find(g => g.grupo === 'patronal')?.diferenca).toBe(10);
    expect(ago?.naoProvisionadas.map(v => v.grupo)).toEqual(['adicional-gilrat']);
  });
});

describe('adiantamento a fornecedores: ou fica devedor ou zera', () => {
  it('o razão de verdade (devedor e zerando) não tem mês credor; um mês fechando credor aparece', () => {
    const L = (data: string, valor: number, saldo: number) => ['', '', data, '', '10503', 'Banco', valor, '', 'x', saldo, ''];
    const r = lerRazao([CAB, L('06/01/2026', -1520, -1520), L('12/01/2026', 1520, 0), L('05/02/2026', -800, -800), L('20/02/2026', 1000, 200), L('10/03/2026', -200, 0)]);
    expect(mesesCredores(mesesDoRazao(r, ['2026-01', '2026-02', '2026-03']))).toEqual(['2026-02']);
    expect(mesesCredores(mesesDoRazao(r, ['2026-01', '2026-03']))).toEqual([]);
  });
  it('o razão de teste do ⚡: sem credor fica devedor/zerado; com credor, o penúltimo mês fecha credor', () => {
    const ms = ['2026-06', '2026-07', '2026-08'];
    expect(mesesCredores(mesesDoRazao(razaoDeTeste(ms, false), ms))).toEqual([]);
    expect(mesesCredores(mesesDoRazao(razaoDeTeste(ms, true), ms))).toEqual(['2026-07']);
  });
});

describe('adiantamento de clientes (o de fornecedores ao contrário)', () => {
  const meses = ['2026-01', '2026-02', '2026-03'];
  it('o de clientes fica credor ou zera: o mês devedor é o errado', () => {
    expect(mesesErrados(mesesDoRazao(razaoDeTeste(meses, false, 'clientes'), meses), 'clientes')).toEqual([]);
    expect(mesesErrados(mesesDoRazao(razaoDeTeste(meses, true, 'clientes'), meses), 'clientes')).toEqual(['2026-02']);
  });
  it('o de fornecedores continua: o mês credor é o errado', () => {
    expect(mesesErrados(mesesDoRazao(razaoDeTeste(meses, true), meses), 'fornecedores')).toEqual(['2026-02']);
    expect([saldoErrado(10, 'fornecedores'), saldoErrado(-10, 'fornecedores'), saldoErrado(-10, 'clientes'), saldoErrado(10, 'clientes')]).toEqual([true, false, true, false]);
  });
});

describe('salários e FGTS a recolher (o razão de teste da etapa da folha)', () => {
  const meses = ['2026-06', '2026-07', '2026-08'];
  it('fica credor ou zera; com devedor, o último mês fecha devedor', () => {
    expect(mesesErrados(mesesDoRazao(razaoDaFolhaDeTeste(meses, 'salarios', false), meses), 'clientes')).toEqual([]);
    expect(mesesErrados(mesesDoRazao(razaoDaFolhaDeTeste(meses, 'fgts', true), meses), 'clientes')).toEqual(['2026-08']);
  });
});
