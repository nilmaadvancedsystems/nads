// Paridade: a mesma entrada no código original (recortado do cheque_especial.html) e na
// cópia tem de dar a mesma saída — linhas lidas, colunas, saldos, lançamentos, números da
// tela e a planilha gerada (comparada célula a célula depois de ler de volta).
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  acharColunas, arredondarCentavos, dataBR, dataDaCelula, dataParaSerialExcel, diaUtil, EXTENSOES_CHEQUE, extensaoValida,
  gerarLancamentos, HISTORICO_PADRAO, LINHAS_EM_BRANCO, lerPlanilhaCheque, livroDeLancamentos, normalizarCabecalho,
  planilhaDeLancamentos, proximoDiaUtil, resumoDoAjuste, saldoDaCelula, saldosDeFechamento,
} from '..';
import type { DiaSaldo, Lancamento } from '../tipos';
import { carregarLegado, temLegado, type DiaLegado, type LancamentoLegado } from './carregar';

// leg() = o original COM as correções aprovadas (datas por serial e saldo em texto; ver
// carregar.ts). puro() = o original como estava, usado para mostrar as diferenças de propósito.
const L = temLegado() ? carregarLegado(true) : null;
const LP = temLegado() ? carregarLegado(false) : null;
const d = L ? describe : describe.skip;
const leg = () => L as NonNullable<typeof L>;
const puro = () => LP as NonNullable<typeof LP>;

// ---------- planilhas de entrada montadas em memória ----------
const texto = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
function planilha(aoa: unknown[][], bookType: XLSX.BookType = 'xlsx'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Extrato');
  return XLSX.write(wb, { bookType, type: 'array' });
}
const dt = (dia: number, mes = 1) => new Date(2026, mes - 1, dia);

const CASOS: [string, () => ArrayBuffer][] = [
  ['csv com C/D, datas repetidas, fim negativo numa sexta', () => texto([
    'Extrato de conta corrente;;;',
    'Data;Histórico;Valor;Saldo',
    '29/12/2025;Saldo anterior;;150,00 C',
    '30/12/2025;Tarifa;10,00 D;140,00 C',
    '31/12/2025;Cheque;500,00 D;360,00 D',
    '31/12/2025;Depósito;100,00 C;260,00 D',
    '02/01/2026;TED;1.000,00 C;740,00 C',
    '05/01/2026;Boleto;2.000,00 D;1.260,00 D',
    '07/01/2026;Boleto;1,00 D;1.261,00 D',
    '09/01/2026;Pix;10,00 D;0,00 D',
    '16/01/2026;Cheque;1.234,56 D;1.234,56 D',
    'Total;;;',
  ].join('\n'))],
  ['csv com vírgula, aspas e ano com 2 dígitos', () => texto([
    'DATA,SALDO',
    '5/1/26,"1.000,00 d"',
    '6/1/26,"1.000,00 c"',
    '7/1/26,"-50,00"',
    '8/1/26,abc',
  ].join('\n'))],
  ['xlsx com números e datas, cabeçalho na 3ª linha', () => planilha([
    ['Banco X'], [],
    ['Dáta', 'Histórico', 'Saldo'],
    [dt(5), 'a', 100],
    [dt(5), 'b', -250.456],
    [dt(6), 'c', -0.0000000000164],
    [dt(7), 'd', 300],
    [dt(8), 'e', -40],
    [dt(8), 'f', -45.5],
    ['', 'sem data', -1],
    [dt(9), 'g', null],
  ])],
  ['xlsx sem nenhum negativo', () => planilha([
    ['Data', 'Saldo'], [dt(5), 10], [dt(6), 0], [dt(7), 20],
  ])],
  ['xlsx com serial numérico e data em texto', () => planilha([
    ['Data', 'Saldo'], [46027, -5], ['06/01/2026', -6], ['46029', 7], [46030.75, -8],
  ])],
  ['xls (97-2003) terminando negativo num sábado', () => planilha([
    ['Data', 'Saldo'], [dt(2), 5], [dt(3), -12.34],
  ], 'biff8')],
  ['cabeçalho fora das 10 primeiras linhas', () => planilha([
    ...Array.from({ length: 10 }, (_, i) => ['linha ' + i]), ['Data', 'Saldo'], [dt(5), -1],
  ])],
  ['cabeçalho sem Saldo exato', () => texto('Data;Saldo (R$)\n05/01/2026;1,00 D\n')],
  ['só cabeçalho', () => texto('Data;Saldo\n')],
];

// ---------- comparação ----------
const arquivo = (buf: ArrayBuffer) => ({ arrayBuffer: () => Promise.resolve(buf) });
const diasPlano = (ds: (DiaSaldo | DiaLegado)[]) => ds.map(x => ({ t: ('data' in x ? x.data : x.date).getTime(), saldo: x.saldo }));
const lancPlano = (ls: (Lancamento | LancamentoLegado)[]) => ls.map(l => ({ ...l, data: l.data.getTime() }));

/** Tudo o que interessa de cada célula lida de volta (valor, tipo, formato) e as larguras. */
function lerDeVolta(bytes: ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(bytes, { type: 'array', cellNF: true, cellStyles: true });
  return wb.SheetNames.map(nome => {
    const ws = wb.Sheets[nome];
    const celulas: Record<string, unknown> = {};
    for (const k of Object.keys(ws)) if (k[0] !== '!') celulas[k] = { t: ws[k].t, v: ws[k].v, z: ws[k].z, w: ws[k].w };
    return { nome, ref: ws['!ref'], cols: ws['!cols'], celulas };
  });
}

/** Os números que o renderResults escreveu nos cartões. */
function cartoes(html: string): string[] {
  return [...html.matchAll(/stat-value num">([^<]*)</g)].map(m => m[1]);
}

d('paridade com o original (cheque_especial.html)', () => {
  it('constantes', () => {
    expect([...EXTENSOES_CHEQUE]).toEqual(leg().VALID_EXTS);
    expect(LINHAS_EM_BRANCO).toBe(leg().BLANK_LEAD_ROWS);
    expect(HISTORICO_PADRAO).toBe('92029');
    for (const n of ['a.csv', 'B.XLSX', 'c.xlsm', 'd.xls', 'e.ods', 'f.txt', 'xlsx', '']) expect(extensaoValida(n)).toBe(leg().validExt(n));
  });

  it('normalizeHeader', () => {
    for (const v of ['Data', ' SALDO ', 'Dáta', 'Saldo (R$)', 'Histórico', null, undefined, 12, 'ção']) expect(normalizarCabecalho(v)).toBe(leg().normalizeHeader(v));
  });

  it('parseDateCell', () => {
    const valores: unknown[] = [null, undefined, '', 0, 999, 1001, 46027, 46027.99, -5, '46027', '46027,5', '999', '05/01/2026', '5/1/26',
      '31/02/2026', '05/01/2026 10:00', ' 1/1/1 ', 'abc', true, new Date(2026, 0, 5, 23, 59), new Date(NaN), {}];
    for (const v of valores) expect(dataDaCelula(v)?.getTime() ?? null).toBe(leg().parseDateCell(v)?.getTime() ?? null);
  });

  for (const inv of [true, false]) {
    it('parseSaldoCell (invertCD ' + inv + ')', () => {
      leg().usarInvertCD(inv);
      const valores: unknown[] = [null, undefined, '', 0, -0, 10, -10.005, 1234.567, -0.0000000000164, NaN, '1.234,56 C', '1.234,56 D', '1.234,56c',
        '1.234,56d', '-1.234,56', '1234.56', 'R$ 10,50', 'abc', '1-2', '0,00 D', ' 5 C ', 'C', true, new Date(2026, 0, 5)];
      // igual ao original em tudo o que não foi corrigido
      puro().usarInvertCD(inv);
      const corrigidos = new Set<unknown>(['-1.234,56', '1234.56', 'abc', '1-2', 'C', true, NaN]);
      for (const v of valores) if (!corrigidos.has(v) && !(v instanceof Date)) expect(saldoDaCelula(v, inv)).toBe(puro().parseSaldoCell(v));
    });
  }

  it('diferenças de propósito (correções aprovadas em 2026-09-28)', () => {
    for (const inv of [true, false]) {
      puro().usarInvertCD(inv);
      // texto sem C/D: o original perdia o "-"; agora fica negativo
      expect(puro().parseSaldoCell('-1.234,56')).toBe(1234.56);
      expect(saldoDaCelula('-1.234,56', inv)).toBe(-1234.56);
      // ponto decimal: o original lia 1234.56 como 123456
      expect(puro().parseSaldoCell('1234.56')).toBe(123456);
      expect(saldoDaCelula('1234.56', inv)).toBe(1234.56);
      // sem número: o original virava saldo 0; agora a linha é ignorada
      expect(puro().parseSaldoCell('abc')).toBe(0);
      for (const v of ['abc', 'C', true, NaN, new Date(2026, 0, 5)]) expect(saldoDaCelula(v, inv)).toBeNull();
    }
    // serial do Excel: 46027 é 05/01/2026 em qualquer fuso (o original, no Brasil, dava 04/01)
    expect(dataBR(dataDaCelula(46027) as Date)).toBe('05/01/2026');
    expect(dataBR(dataDaCelula('46027') as Date)).toBe('05/01/2026');
  });

  it('roundCents, dias úteis, fmtDateBR e dateToExcelSerial num ano inteiro', () => {
    for (const n of [0, -0, 1.005, -1.005, 2.675, -0.004, 0.005, 1e-12, -1e-12, 123456.785]) expect(Object.is(arredondarCentavos(n), leg().roundCents(n))).toBe(true);
    for (let i = 0; i < 400; i++) {
      const dia = new Date(2025, 11, 1 + i);
      expect(diaUtil(dia)).toBe(leg().isBusinessDay(dia));
      expect(proximoDiaUtil(dia).getTime()).toBe(leg().nextBusinessDay(dia).getTime());
      expect(dataBR(dia)).toBe(leg().fmtDateBR(dia));
      expect(dataParaSerialExcel(dia)).toBe(leg().dateToExcelSerial(dia));
    }
  });

  it('readSheet: mesmas mensagens de erro', async () => {
    const ruins: ArrayBuffer[] = [new ArrayBuffer(0), new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer,
      new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]).buffer];
    for (const buf of ruins) {
      const velho = await leg().readSheet(arquivo(buf));
      expect(velho.ok).toBe(false);
      expect(() => lerPlanilhaCheque(buf)).toThrow(velho.reason);
    }
  });

  for (const [nome, montar] of CASOS) {
    for (const inv of [true, false]) {
      it(nome + ' — invertCD ' + inv, async () => {
        const buf = montar();
        leg().usarInvertCD(inv);

        // 1. leitura
        const velho = await leg().readSheet(arquivo(buf));
        expect(velho.ok).toBe(true);
        const linhas = lerPlanilhaCheque(buf);
        expect(linhas).toEqual(velho.rows);
        const rows = velho.rows as unknown[][];

        // 2. colunas
        const colsV = leg().findColumns(rows);
        const cols = acharColunas(linhas);
        expect(cols && { headerRow: cols.linhaCabecalho, dataCol: cols.colData, saldoCol: cols.colSaldo }).toEqual(colsV);
        if (!cols || !colsV) return;

        // 3. saldos de fechamento
        const diasV = leg().buildDailyClosingBalances(rows, colsV);
        const dias = saldosDeFechamento(linhas, cols, inv);
        expect(diasPlano(dias)).toEqual(diasPlano(diasV));
        if (!dias.length) return;

        // 4. lançamentos
        const resV = leg().buildLancamentos(diasV, '10509', '90503', '92029');
        const res = gerarLancamentos(dias, '10509', '90503', '92029');
        expect(lancPlano(res.lancamentos)).toEqual(lancPlano(resV.lancamentos));
        expect(res.projetado).toBe(resV.trailing);

        // 5. números da tela
        leg().renderResults(resV, diasV, '10509', '90503', '92029');
        const html = leg().htmlResultado();
        const r = resumoDoAjuste(res, dias);
        const esperado = res.lancamentos.length
          ? [String(r.diasAnalisados), String(r.diasNegativos), String(r.qtdLancamentos), 'R$ ' + leg().fmtMoney(r.totalAjustado)]
          : [String(r.diasAnalisados), '0'];
        expect(cartoes(html)).toEqual(esperado);
        if (res.projetado) expect(html).toContain('(' + dataBR(proximoDiaUtil(dias[dias.length - 1].data)) + ')');
        else expect(html).not.toContain('Estorno projetado');

        // 6. planilha gerada
        const wbV = leg().buildLancamentosSheet(resV.lancamentos);
        expect(livroDeLancamentos(res.lancamentos)).toEqual(wbV);
        for (const [formato, bookType] of [['xlsx', 'xlsx'], ['xls', 'biff8']] as const) {
          const bytesV: ArrayBuffer = XLSX.write(wbV, { bookType, type: 'array' });
          expect(lerDeVolta(planilhaDeLancamentos(res.lancamentos, formato))).toEqual(lerDeVolta(bytesV));
        }
      });
    }
  }

  it('os casos cobrem o que importa', async () => {
    // garante que a paridade acima não passou "de graça" (casos vazios)
    leg().usarInvertCD(false);
    const resumo = CASOS.map(([, montar]) => {
      const linhas = lerPlanilhaCheque(montar());
      const cols = acharColunas(linhas);
      if (!cols) return 'sem colunas';
      const dias = saldosDeFechamento(linhas, cols, false);
      const res = gerarLancamentos(dias, 'B', 'C', 'H');
      if (!res.lancamentos.length) return 'nenhum';
      return res.projetado ? 'com projetado' : 'sem projetado';
    });
    // o 2º caso passou a ter projetado: "-50,00" agora é negativo e "abc" (último dia) é ignorado
    expect(resumo).toEqual(['com projetado', 'com projetado', 'com projetado', 'nenhum', 'com projetado', 'com projetado', 'sem colunas', 'sem colunas', 'nenhum']);
  });
});
