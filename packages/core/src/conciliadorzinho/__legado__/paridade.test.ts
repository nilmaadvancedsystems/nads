// Paridade: a mesma entrada no código original (recortado do conciliadorZINHO.html, rodando com o
// SheetJS 0.18.5 colado nele) e na cópia (SheetJS 0.20.3 do nads) tem de dar a mesma saída.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  BANDEIRAS, brl, campoCsv, chaveDaData, compararMeses, conciliar, conferirTotais, contarMeses, extensaoValida, EXTENSOES_EXTRATO,
  EXTENSOES_VENDAS, lerDataFlexivel, lerExtrato, lerNumeroFlexivel, lerVendas, limparHistorico, linhasDaBandeira, nomeBaseBandeira,
  noPeriodo, notaDoHistorico, ordemDasBandeiras, planilhaXls, porCalendario, rotuloMes, saidasPorMes, slugMeses, textoCsv, totaisPorMes, valorBR,
} from '../index';
import type { Conciliacao, Contas, IdBandeira, Mes, MesContagem, ResultadoBandeira, Transacao, Venda } from '../index';
import { carregarLegado, temLegado } from './carregar';
import type { DatasetL, Legado, MesL, StateL, TxL, VendaL } from './carregar';

// leg() = o original com a leitura de datas/números corrigida (ver carregar.ts); puro() = como era.
// As outras correções aprovadas em 2026-09-28 (vendas e conferência só nos meses conciliados;
// meses em ordem de calendário) são aplicadas na ENTRADA do original em rodar(), e cada uma tem
// o seu teste de "diferença de propósito".
const L = temLegado() ? carregarLegado(true) : null;
const LP = temLegado() ? carregarLegado(false) : null;
const d = L ? describe : describe.skip;
const leg = (): Legado => L as Legado;
const puro = (): Legado => LP as Legado;

// ---------- planilhas em memória ----------
function planilha(aoa: unknown[][], bookType: 'xlsx' | 'biff8' = 'xlsx'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Plan1');
  return XLSX.write(wb, { bookType, type: 'array' });
}
const texto = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const arquivo = (buf: ArrayBuffer) => ({ arrayBuffer: () => Promise.resolve(buf) });
const serial = (dia: number, mes: number, ano = 2026) => Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86400000);

// Três bandeiras disputando 05/07 R$ 100,00 e 06/07 R$ 50,00; datas como Date, série e texto;
// valores com vírgula, R$ e parênteses; agosto só no cartão; setembro só nas vendas.
const EXTRATOS: Record<'cielo' | 'rede' | 'getnet', ArrayBuffer[]> = {
  cielo: [
    planilha([
      ['Data', 'Valor Bruto', 'Valor da Taxa'],
      [new Date(2026, 6, 5), 100, 2.5],
      ['05/07/2026', 'R$ 100,00', '(2,40)'],
      [serial(6, 7), '50,00', '1,10'],
      ['2026-07-06', 50, 1.1],
      ['07.07.26', 'R$ 1.234,56', 'R$ 30,86'],
      ['Total', 1534.56, 37.86],
      [new Date(2026, 7, 1), 80, 2],
    ]),
    planilha([['08/07/2026', '12,345', '0,3'], ['09/07/2026', '(5,00)', 0]], 'biff8'),
  ],
  rede: [
    planilha([
      [serial(5, 7), 100, 3],
      ['6/7/2026', '50', '1'],
      ['10/07/2026', 'R$ 70,00', '1,75'],
      ['02/08/2026', 40, 1],
      ['03/08/2026', 33.333, 0.555],
    ]),
  ],
  getnet: [
    planilha([['05/07/2026', 100, 2], ['11/07/2026', 20, 0.5]]),
    texto('05/07/2026;100,00;2,00\n12/07/2026;"1.000,00";"25,00"\n'),
  ],
};

const HIST = (nf: string, doc: string, nome: string) => 'Pelas vendas de mercadorias a vista conforme NF-e nº ' + nf + ' - ' + doc + ' - ' + nome;
const VENDAS = planilha([
  ['Emp', 'Lote', 'Data', 'Conta', 'Contrapartida', 'X', 'Valor Bruto', 'Hist', 'Histórico'],
  ['', '', '05/07/2026', '', ' 11201 ', '', 100, 300, HIST('1001', '0', 'CONSUMIDOR FINAL')],
  ['', '', new Date(2026, 6, 5), '', '11201', '', 'R$ 100,00', '300', HIST('1002', '123.456.789-00', 'MARIA; DA "SILVA"')],
  ['', '', serial(6, 7), '', '11202', '', '50,00', 300, '1003-0-JOAO'],
  ['', '', '06/07/2026', '', '11202', '', 50, 300, '1004 - 11.222.333/0001-00 - MERCADO X'],
  ['', '', '07/07/2026', '', '11203', '', '1.234,56', 301, HIST('1005', '0', 'CONSUMIDOR FINAL')],
  ['', '', '07/07/2026', '', '11203', '', 999.99, 301, 'SEM NUMERO'],
  ['', '', '10/07/2026', '', '', '', '(10,00)', null, null],
  ['', '', '10/07/2026', '', '11204', '', 70, 300, '1008-0-A'],
  ['', '', '15/07/2026', '', '11204', '', 15.5, 300, '1009-0-B'],
  ['', '', '01/09/2026', '', '11205', '', 45, 300, '1010-0-SETEMBRO'],
  ['', '', '02/09/2026', '', '11205', '', 46, 300, '1011-0-SETEMBRO'],
  ['', '', '01/10/2026', '', '11205', '', 47, 300, '1012-0-OUTUBRO'],
  ['', '', 'Total', '', '', '', 2742.05, '', ''],
]);

// ---------- conversões entre as formas ----------
const txL = (t: Transacao): TxL => ({ date: t.data, dateKey: t.chaveData, bruto: t.bruto, taxa: t.taxa });
const mesL = (m: Mes): MesL => ({ month: m.mes, year: m.ano });
const mesN = (m: MesL): Mes => ({ mes: m.month, ano: m.year });
const mesContN = (m: MesL): MesContagem => ({ mes: m.month, ano: m.year, qtd: m.count as number });
const vendaN = (v: VendaL): Venda => ({ data: v.date, chaveData: v.dateKey, bruto: v.bruto, nf: v.nf, historico: v.historico, contrapartida: v.contrapartida, codigoHistorico: v.historicoCode });
const resultadoN = (ds: DatasetL): ResultadoBandeira => ({
  meses: ds.months.map(mesContN), aprovadas: ds.approvedCount, casadas: ds.matchedCount, semNota: ds.unmatchedCount,
  totalBruto: ds.totalBruto, totalTaxa: ds.totalTaxa,
  linhas: ds.entries.map(e => ({ tipo: e.tipo, casou: e.matched, chaveData: e.dateKey, valor: e.valor, historico: e.historico, complemento: e.complemento, nota: e.nota })),
});

/** Células de um .xls lido de volta (valor, tipo e formato), para comparar os dois lados. */
function celulas(bytes: ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { type: 'array', cellNF: true });
  const abas = wb.SheetNames.map(nome => {
    const ws = wb.Sheets[nome];
    const cel = Object.keys(ws).filter(k => k[0] !== '!').sort().map(k => [k, ws[k].t, ws[k].v, ws[k].z]);
    return { nome, ref: ws['!ref'], cel };
  });
  return abas;
}

/** O que o renderTotalsBreakdown escreveu, na ordem: título, valores em destaque e células da tabela. */
function textosDoHtml(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<h4>(.*?)<\/h4>|<strong class="num">(.*?)<\/strong>|<td[^>]*>(.*?)<\/td>/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
function textosDosTotais(c: Conciliacao, ordem: IdBandeira[]): string[] {
  const out: string[] = [];
  for (const t of totaisPorMes(c, ordem)) {
    out.push(t.rotulo, brl(t.vendasComCartao), brl(t.vendasSemCartao), brl(t.vendasComCartao), brl(t.vendasSemCartao), brl(t.totalVendas));
    for (const b of t.porBandeira) out.push(BANDEIRAS.find(x => x.id === b.id)!.rotulo, brl(b.bruto), brl(b.taxa));
  }
  return out;
}

// ---------- os dois lados, do arquivo até o fim ----------
interface Cenario {
  selecionadas: IdBandeira[];
  contas: Contas;
  contaBandeira: Partial<Record<IdBandeira, string>>;
  /** 'auto' = o que o wireStep2 decidiria (prosseguir com os meses em comum quando há meses extras). */
  meses: 'auto' | Mes[] | null;
}

async function rodar(cen: Cenario) {
  const Lg = leg();
  // --- leitura ---
  const txNovo: Partial<Record<IdBandeira, Transacao[]>> = {};
  const brandData: StateL['brandData'] = {};
  for (const id of cen.selecionadas) {
    const bufs = EXTRATOS[id as keyof typeof EXTRATOS];
    const arqNovo = bufs.map(b => lerExtrato(b));
    const arqVelho = await Promise.all(bufs.map(b => Lg.parseCardStatementFile(arquivo(b))));
    arqNovo.forEach((r, i) => {
      const v = arqVelho[i];
      expect(r != null).toBe(v.ok);
      if (r && v.ok) {
        expect(r.transacoes.map(txL)).toEqual(v.transactions);
        expect(mesL(r.mes)).toEqual(v.month);
      }
    });
    txNovo[id] = arqNovo.flatMap(r => (r ? r.transacoes : []));
    brandData[id] = { files: arqVelho.filter(v => v.ok).map(v => ({ transactions: v.transactions as TxL[] })), conta: cen.contaBandeira[id] ?? '' };
  }
  const vendasNovo = lerVendas(VENDAS);
  const vendasVelho = await Lg.parseSalesFile(arquivo(VENDAS));
  expect(vendasNovo).not.toBeNull();
  expect(vendasNovo!.vendas).toEqual((vendasVelho.entries as VendaL[]).map(vendaN));
  expect(vendasNovo!.meses).toEqual((vendasVelho.months as MesL[]).map(mesContN));

  // --- meses ---
  const todas = cen.selecionadas.flatMap(id => txNovo[id] ?? []);
  const mesesCartao = contarMeses(todas);
  expect(mesesCartao).toEqual(Lg.computeMonthTally(todas.map(txL)).map(mesContN));
  const comp = compararMeses(mesesCartao, vendasNovo!.meses);
  const compV = Lg.compararMeses(mesesCartao.map(mesL), (vendasVelho.months as MesL[]));
  expect(comp.extras.map(mesL)).toEqual(compV.extras.map(m => ({ month: m.month, year: m.year })));
  expect(comp.comuns.map(mesL)).toEqual(compV.comuns.map(m => ({ month: m.month, year: m.year })));
  expect(comp.excluidos.map(mesL)).toEqual(compV.excluidos.map(m => ({ month: m.month, year: m.year })));
  const permitidos = cen.meses === 'auto' ? (comp.extras.length ? comp.comuns : null) : cen.meses;
  const excluidos = cen.meses === 'auto' && permitidos ? comp.excluidos : [];
  // correção: só as vendas dos meses conciliados entram (o original punha as outras nas Saídas)
  const dentro = noPeriodo(permitidos);
  const entradasV = (vendasVelho.entries as VendaL[]).filter(e => dentro(e.date));

  // --- estado do original ---
  const state: StateL = {
    brands: cen.selecionadas.slice(), brandOrder: cen.selecionadas.slice(), brandData,
    sales: { entries: entradasV },
    reconcileMonths: permitidos ? permitidos.map(mesL) : null,
    excludedMonths: excluidos.map(mesL),
    accounts: { revenda: cen.contas.vendas, taxa: cen.contas.taxas, caixaPadrao: cen.contas.caixaPadrao, caixa: cen.contas.caixa },
    datasets: null, leftoverSales: null,
  };
  Lg.usarEstado(state);

  // --- ordem e conciliação ---
  const ordem = ordemDasBandeiras(txNovo, cen.selecionadas);
  state.brandOrder = Lg.computeBrandOrder();
  expect(ordem).toEqual(state.brandOrder);
  const c = conciliar({ ordem, transacoes: txNovo, vendas: vendasNovo!.vendas, mesesPermitidos: permitidos });
  const r = Lg.generateMultiBrandDatasets();
  state.datasets = r.byBrand;
  state.leftoverSales = r.leftoverSales;
  expect(Object.keys(c.porBandeira)).toEqual(Object.keys(r.byBrand));
  for (const id of ordem) expect(c.porBandeira[id]).toEqual(resultadoN(r.byBrand[id]));
  expect(c.sobras).toEqual(r.leftoverSales.map(vendaN));

  // --- conferência e totais ---
  const conf = conferirTotais(c, ordem, txNovo, vendasNovo!.vendas, permitidos);
  // correção: a conferência olha o extrato só nos meses conciliados (o original, o extrato inteiro)
  const brandDataTudo = state.brandData;
  state.brandData = {};
  for (const id of cen.selecionadas) {
    const b = brandDataTudo[id]!;
    state.brandData[id] = { conta: b.conta, files: [{ transactions: b.files.flatMap(f => f.transactions).filter(x => dentro(x.date)) }] };
  }
  const confV = Lg.validateTotals();
  state.brandData = brandDataTudo;
  expect(conf).toEqual({ ok: confV.ok, problemas: confV.issues });
  Lg.renderTotalsBreakdown();
  // correção: meses em ordem de calendário; comparamos mês a mês, na ordem nova
  const blocosV = (Lg.elemento('totalsBreakdown').innerHTML ?? '').split('<div class="brand-result-card">').slice(1).map(textosDoHtml);
  const ordemV = new Map(blocosV.map(b => [b[0], b]));
  expect(textosDosTotais(c, ordem)).toEqual(totaisPorMes(c, ordem).flatMap(m => ordemV.get(m.rotulo) ?? []));

  // --- arquivos finais ---
  Lg.buildFinalOutputs();
  const finais = Lg.finalOutputs();
  expect(Object.keys(finais)).toEqual(ordem);
  for (const id of ordem) {
    const res = c.porBandeira[id]!;
    const linhas = linhasDaBandeira(res, cen.contaBandeira[id] ?? '', cen.contas);
    const f = finais[id];
    expect(linhas.map(l => ({ devedora: l.devedora, credora: l.credora, data: l.data, valor: valorBR(l.valor), valor_num: l.valor, historico: l.historico, complemento: l.complemento, nota: l.nota, matched: l.casou, tipo: l.tipo })))
      .toEqual(f.rows);
    expect(nomeBaseBandeira(id, res.meses)).toBe(f.filenameBase);
    expect(textoCsv(linhas)).toBe(f.csvText);
    expect(f.xlsBytes).not.toBeNull();
    expect(celulas(planilhaXls(linhas, 'Conciliacao'))).toEqual(celulas(f.xlsBytes as ArrayBuffer));
  }

  const saidasV = Lg.finalSaidaOutputs();
  const saidas = saidasPorMes(c.sobras, cen.contas.vendas);
  expect(saidas.map(s => s.chave)).toEqual(Object.keys(saidasV).sort(porCalendario));
  for (const s of saidas) {
    const v = saidasV[s.chave];
    expect(mesL(s.mes)).toEqual(v.month);
    expect(s.rotulo).toBe(v.label);
    expect(s.nomeBase).toBe(v.filenameBase);
    expect(s.linhas.map(l => ({ contrapartida: l.devedora, contaVendas: l.credora, data: l.data, valor: valorBR(l.valor), valor_num: l.valor, historicoCode: l.historico, complemento: l.complemento, nota: l.nota })))
      .toEqual(v.rows);
    expect(textoCsv(s.linhas)).toBe(v.csvText);
    expect(celulas(planilhaXls(s.linhas, 'Saidas'))).toEqual(celulas(v.xlsBytes as ArrayBuffer));
  }
  return { c, conf, ordem, saidas, permitidos };
}

const CONTAS: Contas = { vendas: ' 30101 ', taxas: '40101 ', caixaPadrao: true, caixa: '' };
const CONTA_BANDEIRA = { cielo: ' 21105', rede: '21106 ', getnet: '21107' };

d('paridade com o original (conciliadorZINHO.html)', () => {
  it('BRAND_META/BRAND_LIST: mesmos ids, rótulos e slugs', () => {
    expect(BANDEIRAS.map(b => b.id)).toEqual(leg().BRAND_LIST);
    for (const b of BANDEIRAS) expect({ label: b.rotulo, slug: b.slug }).toEqual({ label: leg().BRAND_META[b.id].label, slug: leg().BRAND_META[b.id].slug });
  });

  it('formatos: datas, números, histórico, csv, mês, dinheiro, slug, extensão', () => {
    const Lg = leg();
    const datas: unknown[] = [new Date(2026, 6, 5, 13, 30), new Date('x'), 46208, 46208.9, 20000, 20001, 80000, 1, '5/7/26', '05-07-2026', '05.07.2026 10:00',
      '31/02/2026', '32/01/2026', '01/13/2026', '2026-07-05', '2026-7-5', ' 05/07/2026 ', 'Data', '', null, undefined, true];
    // iguais ao original, menos a data que não existe (corrigido: '31/02/2026' era aceito como 03/03)
    for (const v of datas) {
      if (v === '31/02/2026') continue;
      const a = lerDataFlexivel(v), b = puro().parseDateFlexible(v);
      expect(a ? a.getTime() : null).toBe(b ? b.getTime() : null);
    }
    expect(puro().parseDateFlexible('31/02/2026')?.getDate()).toBe(3);
    expect(lerDataFlexivel('31/02/2026')).toBeNull();
    const nums: unknown[] = [0, -1.5, NaN, Infinity, 'R$ 1.234,56', 'r$1.234,56', '(1.234,56)', '-10,5', '1.234', '1,234', '1,234.56', '1.234,567',
      ' 12 345,6 ', '10-', '(abc)', '', '  ', 'abc', null, undefined, {}, '1.2.3,45'];
    // iguais ao original, menos os corrigidos
    const corrigidos: Record<string, [number | null, number | null]> = {
      '1.234': [1.234, 1234], '1,234': [1234, 1.234], '1.234,567': [1.234567, 1234.567], '10-': [10, null],
    };
    for (const v of nums) {
      if (typeof v === 'string' && v in corrigidos) continue;
      expect(lerNumeroFlexivel(v)).toEqual(puro().parseNumberFlexible(v));
    }
    for (const [v, [antes, agora]] of Object.entries(corrigidos)) {
      expect(puro().parseNumberFlexible(v)).toBeCloseTo(antes as number, 5);
      expect(lerNumeroFlexivel(v)).toBe(agora);
    }
    expect(lerNumeroFlexivel('1.000')).toBe(1000);
    const hists: unknown[] = [HIST('200294', '0', 'CONSUMIDOR FINAL'), '200294 - 0 - X - Y', 'NF 12-34', 'SEM NUMERO', '  ', null, 123, '1-2-3', 'A - 1 - 2 - B'];
    for (const v of hists) {
      expect(limparHistorico(v)).toBe(Lg.cleanHistorico(v));
      expect(notaDoHistorico(limparHistorico(v))).toBe(Lg.extractNfFromHistorico(Lg.cleanHistorico(v)));
    }
    for (const v of ['a', 'a;b', 'a"b', 'a\nb', '', null, 0, 1.5]) expect(campoCsv(v)).toBe(Lg.csvField(v));
    for (const n of [0, 1234.5, -0.005, 1e9, 0.1 + 0.2, -1234.567]) {
      expect(valorBR(n)).toBe(Lg.fmtBR(n));
      expect(brl(n)).toBe(Lg.fmtBRL(n));
    }
    for (let mes = 1; mes <= 12; mes++) expect(rotuloMes({ mes, ano: 2026 })).toBe(Lg.monthLabel({ month: mes, year: 2026 }));
    expect(chaveDaData(new Date(2026, 0, 9))).toBe(Lg.fmtDate(new Date(2026, 0, 9)));
    for (const n of [0, 1, 4, 5, 7]) {
      const ms = Array.from({ length: n }, (_, i) => ({ mes: (i % 12) + 1, ano: 2026 }));
      expect(slugMeses(ms)).toBe(Lg.monthsSlug(ms.map(mesL)));
    }
    for (const nome of ['a.CSV', 'a.xls', 'a.xlsx', 'a.XLSM', 'a.ods', 'xls', 'a.xls.txt']) {
      expect(extensaoValida(nome, EXTENSOES_EXTRATO)).toBe(Lg.validExt(nome, ['.csv', '.xls', '.xlsx', '.xlsm']));
      expect(extensaoValida(nome, EXTENSOES_VENDAS)).toBe(Lg.validExt(nome, ['.xls', '.xlsx']));
    }
  });

  it('arquivos ilegíveis ou sem lançamento', async () => {
    const Lg = leg();
    for (const buf of [texto(''), texto('nada aqui'), planilha([['Data', 'Bruto', 'Taxa']]), planilha([[1, 2, 3]])]) {
      expect(lerExtrato(buf) != null).toBe((await Lg.parseCardStatementFile(arquivo(buf))).ok);
      expect(lerVendas(buf) != null).toBe((await Lg.parseSalesFile(arquivo(buf))).ok);
    }
  });

  it('três bandeiras sem filtro de mês, caixa padrão', async () => {
    const { c, ordem } = await rodar({ selecionadas: ['getnet', 'rede', 'cielo'], contas: CONTAS, contaBandeira: CONTA_BANDEIRA, meses: null });
    expect(ordem).toEqual(['cielo', 'rede', 'getnet']);
    // as três disputaram 05/07 R$ 100,00 (só há duas notas): a terceira ficou sem nota
    expect(c.porBandeira.getnet!.linhas[0]).toMatchObject({ chaveData: '05/07/2026', casou: false, historico: '181' });
    expect(c.sobras.length).toBeGreaterThan(0);
  });

  it('meses extras nas vendas: concilia só os meses em comum, e agora os totais batem (corrigido)', async () => {
    const { conf, permitidos, saidas } = await rodar({
      selecionadas: ['cielo', 'rede', 'getnet'], contas: { ...CONTAS, caixaPadrao: false, caixa: ' 10105 ' }, contaBandeira: CONTA_BANDEIRA, meses: 'auto',
    });
    expect(permitidos).toEqual([{ mes: 7, ano: 2026, qtd: expect.any(Number) }]);
    // o original travava aqui (conferência acusava agosto, que só está no cartão) e mandava
    // as vendas de setembro e outubro para as Saídas
    expect(conf).toEqual({ ok: true, problemas: [] });
    expect(saidas.map(s => s.chave)).toEqual(['2026-7']);
  });

  it('duas bandeiras com empate de volume e lista de meses vazia (= sem filtro)', async () => {
    await rodar({ selecionadas: ['rede', 'getnet'], contas: CONTAS, contaBandeira: { rede: '1', getnet: ' 2 ' }, meses: [] });
    await rodar({ selecionadas: ['getnet', 'cielo'], contas: CONTAS, contaBandeira: CONTA_BANDEIRA, meses: [{ mes: 8, ano: 2026 }, { mes: 7, ano: 2026 }] });
  });
});
