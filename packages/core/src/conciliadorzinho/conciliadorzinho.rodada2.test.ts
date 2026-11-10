// Rodada 2 do Conciliadorzinho: leitura (data × número × arquivo) e motor da conciliação (ordem das linhas, duplicatas, 1:N e N:1,
// valores iguais em datas diferentes, tolerância no limite, listas vazias). Semente fixa e dados inventados.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  campoCsv, chaveDaData, chaveMes, compararMeses, conciliar, conferirTotais, contarMeses, dataDoSerialExcel, lerDataFlexivel, lerExtrato, lerNumeroFlexivel, lerVendas,
  LINHAS_EM_BRANCO, linhasDaBandeira, noPeriodo, ordemDasBandeiras, porCalendario, saidasPorMes, slugMeses, TOLERANCIA, textoCsv, totaisPorMes,
} from './index';
import type { Conciliacao, IdBandeira, Mes, Transacao, Venda } from './index';

function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar<T>(l: readonly T[], r: () => number): T[] {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const cent = (v: number) => Math.round(v * 100);
const dois = (n: number) => String(n).padStart(2, '0');
const chave = (d: Date | null) => (d ? chaveDaData(d) : null);
const NBSP = '\u00a0';

describe('lerDataFlexivel', () => {
  const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const diasDoMes = (m: number, a: number) => [31, ehBissexto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

  it('todo dia de 2023 a 2029, em toda forma: texto, ISO, Date e serial do Excel', () => {
    for (let a = 2023; a <= 2029; a++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= diasDoMes(m, a); d++) {
      const k = dois(d) + '/' + dois(m) + '/' + a;
      for (const t of [k, `${d}/${m}/${a}`, `${dois(d)}-${dois(m)}-${a}`, `${dois(d)}.${dois(m)}.${a}`, `${dois(d)}/${dois(m)}/${String(a).slice(2)}`, `${a}-${dois(m)}-${dois(d)}`, `${a}-${dois(m)}-${dois(d)}T10:00:00`, ` ${k} 23:59 `])
        expect(chave(lerDataFlexivel(t)), t).toBe(k);
      expect(chave(lerDataFlexivel(new Date(a, m - 1, d, 23, 59))), k).toBe(k);
      const serial = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
      expect(chave(lerDataFlexivel(serial)), k + ' serial').toBe(k);
      expect(chave(lerDataFlexivel(serial + 0.75)), k + ' serial com hora').toBe(k);
    }
  });

  it('data que não existe é ignorada também no ISO (o "2026-02-31" virava 03/03)', () => {
    for (const t of ['2026-02-31', '2026-02-29', '2025-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00', '2026-01-32', '31/02/2026', '29/02/2026', '32/01/2026', '01/13/2026', '00/01/2026', '01/00/2026'])
      expect(lerDataFlexivel(t), t).toBeNull();
    for (const [t, k] of [['2024-02-29', '29/02/2024'], ['29/02/2024', '29/02/2024'], ['29/02/28', '29/02/2028']] as const) expect(chave(lerDataFlexivel(t)), t).toBe(k);
  });

  it('o que não é data dá null, de qualquer tipo', () => {
    for (const v of ['', ' ', 'Data', 'abc', '1.234,56', '2026', null, undefined, true, {}, [], new Date('x'), NaN, Infinity, 20000, 80000, 1, -46208]) expect(lerDataFlexivel(v), String(v)).toBeNull();
  });

  it('serial do Excel: a hora não muda o dia e o limite do intervalo', () => {
    expect(chave(dataDoSerialExcel(46208.99999))).toBe('05/07/2026');
    expect(lerDataFlexivel(20001)).not.toBeNull();
    expect(lerDataFlexivel(79999)).not.toBeNull();
  });
});

describe('lerNumeroFlexivel: separador × sinal × espaço', () => {
  const agrupar = (i: string, sep: string) => i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const partes = (c: number) => ({ i: String(Math.floor(c / 100)), d: dois(c % 100) });
  const FORMATOS: ((c: number) => string)[] = [
    c => { const { i, d } = partes(c); return agrupar(i, '.') + ',' + d; },
    c => { const { i, d } = partes(c); return i + ',' + d; },
    c => { const { i, d } = partes(c); return agrupar(i, ',') + '.' + d; },
  ];
  const EMBRULHOS: [(s: string) => string, 1 | -1][] = [
    [s => s, 1], [s => '-' + s, -1], [s => '(' + s + ')', -1], [s => '  ' + s + ' ', 1], [s => NBSP + s + NBSP, 1],
    [s => 'R$ ' + s, 1], [s => 'R$' + s, 1], [s => 'R$' + NBSP + s, 1], [s => 'r$ ' + s, 1],
    [s => 'R$ -' + s, -1], [s => 'R$ (' + s + ')', -1], [s => '-R$ ' + s, -1], [s => '-R$' + NBSP + s, -1], [s => '(R$ ' + s + ')', -1], [s => '- R$ ' + s, -1],
  ];
  const r = sorteador(4242);
  const CENTAVOS = [1, 10, 99, 100, 12345, 99999, 123456, 123456789, 100000000000, ...Array.from({ length: 30 }, () => 1 + Math.floor(r() * 1e11))];

  it('toda combinação (a taxa vem "-R$ 1,23" no extrato em texto e a linha sumia)', () => {
    for (const c of CENTAVOS) for (const f of FORMATOS) for (const [e, sinal] of EMBRULHOS) {
      const t = e(f(c));
      expect(lerNumeroFlexivel(t), t).toBe(sinal * c / 100);
    }
  });

  it('só ponto: milhar quando em grupos de três, senão decimal', () => {
    for (const [t, v] of [['1.000', 1000], ['1.234.567', 1234567], ['12.5', 12.5], ['12.50', 12.5], ['1234.567', 1234.567], ['0.001', 0.001]] as const) expect(lerNumeroFlexivel(t), t).toBe(v);
  });

  it('o que não é número dá null, de qualquer tipo', () => {
    for (const v of ['', ' ', 'abc', 'R$', '-', '()', '10-', '1.2.3', '1,2,3', '10%', 'R$ abc', null, undefined, true, {}, [], new Date(2026, 0, 1), NaN, Infinity, -Infinity]) expect(lerNumeroFlexivel(v), String(v)).toBeNull();
  });
});

// ---------- arquivo ----------
function planilha(aoa: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Plan1');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

describe('lerExtrato e lerVendas', () => {
  it('a taxa negativa com R$ em texto não derruba a linha', () => {
    const ex = lerExtrato(planilha([['Data', 'Bruto', 'Taxa'], ['05/07/2026', 'R$ 100,00', '-R$ 1,23'], ['06/07/2026', '(R$ 50,00)', 'R$ 0,50']]));
    expect(ex?.transacoes.map(t => [t.chaveData, t.bruto, t.taxa])).toEqual([['05/07/2026', 100, -1.23], ['06/07/2026', -50, 0.5]]);
  });

  it('a ordem das linhas não muda o que foi lido; cabeçalho e rodapé caem fora', () => {
    for (let s = 1; s <= 20; s++) {
      const r = sorteador(s);
      const linhas = Array.from({ length: 30 }, (_, i) => [dois(1 + i % 28) + '/0' + (1 + (i % 3)) + '/2026', Math.floor(r() * 1e6) / 100, Math.floor(r() * 1e4) / 100]);
      const a = lerExtrato(planilha([['Data', 'Bruto', 'Taxa'], ...linhas, ['Total', '', '']]));
      const b = lerExtrato(planilha([['Data', 'Bruto', 'Taxa'], ...embaralhar(linhas, r), ['Total', '', '']]));
      const ord = (x: typeof a) => x!.transacoes.map(t => t.chaveData + '|' + t.bruto + '|' + t.taxa).sort();
      expect(ord(b), 'semente ' + s).toEqual(ord(a));
      expect(b!.mes, 'semente ' + s).toEqual(a!.mes);
      expect(a!.transacoes).toHaveLength(30);
    }
  });

  it('arquivo sem lançamento: null, sem quebrar', () => {
    expect(lerExtrato(planilha([['Data', 'Bruto', 'Taxa']]))).toBeNull();
    expect(lerVendas(planilha([['a', 'b', 'Data', 'd', 'e', 'f', 'Valor', 'h', 'i']]))).toBeNull();
    expect(lerExtrato(new ArrayBuffer(0))).toBeNull();
  });

  it('venda: colunas, valor em texto e NF do histórico', () => {
    const v = lerVendas(planilha([[null, null, 'Data', null, 'Contra', null, 'Valor', 'Cod', 'Hist'], [null, null, '05/07/2026', null, 123, null, 'R$ 1.234,56', 15, 'Pelas vendas NF-e nº 200294 - 0 - CONSUMIDOR FINAL']]));
    expect(v?.vendas[0]).toMatchObject({ chaveData: '05/07/2026', bruto: 1234.56, contrapartida: '123', codigoHistorico: '15', historico: '200294-0-CONSUMIDOR FINAL', nf: '200294' });
  });
});

// ---------- o motor ----------
const data = (d: number, m = 7, a = 2026) => new Date(a, m - 1, d);
const tx = (d: Date, bruto: number, taxa = 1): Transacao => ({ data: d, chaveData: chaveDaData(d), bruto, taxa });
const venda = (d: Date, bruto: number, nf = '1'): Venda => ({ data: d, chaveData: chaveDaData(d), bruto, nf, historico: nf + '-0-X', contrapartida: '999', codigoHistorico: '15' });
const BANDEIRAS_T: IdBandeira[] = ['cielo', 'rede', 'getnet', 'stone', 'pagbank'];

function cenario(s: number) {
  const r = sorteador(s);
  const valores = [10, 10.1, 19.99, 100, 0.01, 1234.56];
  const dia = () => data(1 + Math.floor(r() * 6), r() < 0.5 ? 7 : 8);
  const transacoes: Partial<Record<IdBandeira, Transacao[]>> = {};
  for (const id of BANDEIRAS_T.slice(0, 1 + Math.floor(r() * 5))) transacoes[id] = Array.from({ length: Math.floor(r() * 25) }, () => tx(dia(), valores[Math.floor(r() * valores.length)], Math.floor(r() * 500) / 100));
  const vendas = Array.from({ length: Math.floor(r() * 60) }, (_, i) => venda(dia(), valores[Math.floor(r() * valores.length)], String(i + 1)));
  return { r, transacoes, vendas, ordem: Object.keys(transacoes) as IdBandeira[] };
}
/** o que não depende de qual nota, entre as iguais, foi usada */
const resumo = (c: Conciliacao) => ({
  b: Object.entries(c.porBandeira).map(([id, x]) => [id, x!.aprovadas, x!.casadas, x!.semNota, cent(x!.totalBruto), cent(x!.totalTaxa), x!.meses]),
  sobras: c.sobras.map(v => v.chaveData + '|' + v.bruto).sort(),
});

describe('conciliar', () => {
  it('a ordem das linhas (extrato e vendas) não muda quantas casam, os totais e o que sobra', () => {
    for (let s = 1; s <= 200; s++) {
      const { r, transacoes, vendas, ordem } = cenario(s);
      const base = conciliar({ ordem, transacoes, vendas, mesesPermitidos: null });
      const outras: typeof transacoes = {};
      for (const id of ordem) outras[id] = embaralhar(transacoes[id]!, r);
      expect(resumo(conciliar({ ordem, transacoes: outras, vendas: embaralhar(vendas, r), mesesPermitidos: null })), 'semente ' + s).toEqual(resumo(base));
    }
  });

  it('nada some: cada venda casa uma vez ou sobra; a conferência passa; quem chamou não é mexido', () => {
    for (let s = 1; s <= 200; s++) {
      const { transacoes, vendas, ordem } = cenario(s);
      const antes = JSON.stringify({ transacoes, vendas });
      const c = conciliar({ ordem, transacoes, vendas, mesesPermitidos: null });
      expect(JSON.stringify({ transacoes, vendas }), 'semente ' + s).toBe(antes);
      let casadas = 0;
      for (const id of ordem) {
        const x = c.porBandeira[id]!;
        expect(x.casadas + x.semNota, 'semente ' + s).toBe(x.aprovadas);
        expect(x.linhas, 'semente ' + s).toHaveLength(2 * x.aprovadas);
        casadas += x.casadas;
      }
      expect(casadas + c.sobras.length, 'semente ' + s).toBe(vendas.length);
      expect(conferirTotais(c, ordem, transacoes, vendas), 'semente ' + s).toEqual({ ok: true, problemas: [] });
    }
  });

  it('a ordem das bandeiras não muda quantas casam no total nem o que sobra', () => {
    for (let s = 1; s <= 100; s++) {
      const { r, transacoes, vendas, ordem } = cenario(s);
      const total = (c: Conciliacao) => Object.values(c.porBandeira).reduce((t, x) => t + x!.casadas, 0);
      const a = conciliar({ ordem, transacoes, vendas, mesesPermitidos: null });
      const b = conciliar({ ordem: embaralhar(ordem, r), transacoes, vendas, mesesPermitidos: null });
      expect(total(b), 'semente ' + s).toBe(total(a));
      expect(resumo(b).sobras, 'semente ' + s).toEqual(resumo(a).sobras);
    }
  });

  it('reprocessar dá o mesmo', () => {
    for (let s = 1; s <= 30; s++) {
      const { transacoes, vendas, ordem } = cenario(s);
      expect(conciliar({ ordem, transacoes, vendas, mesesPermitidos: null })).toEqual(conciliar({ ordem, transacoes, vendas, mesesPermitidos: null }));
    }
  });

  const umaBandeira = (t: Transacao[], v: Venda[]) => {
    const c = conciliar({ ordem: ['cielo'], transacoes: { cielo: t }, vendas: v, mesesPermitidos: null });
    return { c, x: c.porBandeira.cielo! };
  };

  it('listas vazias', () => {
    const c = conciliar({ ordem: [], transacoes: {}, vendas: [], mesesPermitidos: null });
    expect(c).toEqual({ porBandeira: {}, sobras: [] });
    expect(conferirTotais(c, [], {}, [])).toEqual({ ok: true, problemas: [] });
    expect(totaisPorMes(c, [])).toEqual([]);
    expect(saidasPorMes([], '123')).toEqual([]);
    const semExtrato = conciliar({ ordem: ['cielo'], transacoes: {}, vendas: [venda(data(1), 10)], mesesPermitidos: null });
    expect(semExtrato.porBandeira.cielo).toMatchObject({ aprovadas: 0, casadas: 0, semNota: 0, totalBruto: 0, totalTaxa: 0, linhas: [] });
    expect(semExtrato.sobras).toHaveLength(1);
    expect(conciliar({ ordem: ['cielo'], transacoes: { cielo: [tx(data(1), 10)] }, vendas: [], mesesPermitidos: [] }).porBandeira.cielo).toMatchObject({ casadas: 0, semNota: 1 });
  });

  it('importar o extrato duas vezes: a venda casa uma vez só e o resto fica sem nota', () => {
    const t = tx(data(5), 100);
    const { c, x } = umaBandeira([t, { ...t }], [venda(data(5), 100)]);
    expect([x.casadas, x.semNota]).toEqual([1, 1]);
    expect(c.sobras).toEqual([]);
  });

  it('venda em dobro: casa uma e a outra sobra para as Saídas', () => {
    const { c, x } = umaBandeira([tx(data(5), 100)], [venda(data(5), 100, '1'), venda(data(5), 100, '2')]);
    expect([x.casadas, x.semNota]).toEqual([1, 0]);
    expect(x.linhas[0].nota).toBe('1'); // FIFO, a primeira da planilha
    expect(c.sobras.map(v => v.nf)).toEqual(['2']);
  });

  it('valores iguais em datas diferentes não casam', () => {
    const { c, x } = umaBandeira([tx(data(5), 100)], [venda(data(6), 100)]);
    expect([x.casadas, x.semNota]).toEqual([0, 1]);
    expect(c.sobras).toHaveLength(1);
  });

  it('1:N e N:1: o pareamento é exato, soma de partes não casa', () => {
    const umParaMuitos = umaBandeira([tx(data(5), 100)], [venda(data(5), 60), venda(data(5), 40)]);
    expect([umParaMuitos.x.casadas, umParaMuitos.x.semNota, umParaMuitos.c.sobras.length]).toEqual([0, 1, 2]);
    const muitosParaUm = umaBandeira([tx(data(5), 60), tx(data(5), 40)], [venda(data(5), 100)]);
    expect([muitosParaUm.x.casadas, muitosParaUm.x.semNota, muitosParaUm.c.sobras.length]).toEqual([0, 2, 1]);
  });

  it('um centavo de diferença não casa; o valor que difere só depois do centavo casa', () => {
    expect(umaBandeira([tx(data(5), 100.01)], [venda(data(5), 100)]).x.casadas).toBe(0);
    expect(umaBandeira([tx(data(5), 0.1 + 0.2)], [venda(data(5), 0.3)]).x.casadas).toBe(1);
  });

  it('virada de ano e bissexto: cada lançamento no seu mês', () => {
    const t = [tx(data(31, 12, 2025), 1), tx(data(1, 1, 2026), 2), tx(data(29, 2, 2024), 3)];
    expect(contarMeses(t)).toEqual([{ mes: 2, ano: 2024, qtd: 1 }, { mes: 12, ano: 2025, qtd: 1 }, { mes: 1, ano: 2026, qtd: 1 }]);
    const sel: Mes[] = [{ mes: 1, ano: 2026 }];
    expect(conciliar({ ordem: ['cielo'], transacoes: { cielo: t }, vendas: [], mesesPermitidos: sel }).porBandeira.cielo!.aprovadas).toBe(1);
    expect(noPeriodo(sel)(data(31, 12, 2025))).toBe(false);
    expect(noPeriodo(sel)(data(1, 1, 2026))).toBe(true);
    expect(noPeriodo([])(data(1, 1, 1999))).toBe(true);
    expect(noPeriodo(null)(data(1, 1, 1999))).toBe(true);
  });

  it('só os meses em comum: as vendas e o extrato de fora não entram e a conferência passa', () => {
    for (let s = 1; s <= 60; s++) {
      const { transacoes, vendas, ordem } = cenario(s);
      const meses: Mes[] = [{ mes: 7, ano: 2026 }];
      const c = conciliar({ ordem, transacoes, vendas, mesesPermitidos: meses });
      expect(c.sobras.every(v => v.data.getMonth() === 6), 'semente ' + s).toBe(true);
      for (const id of ordem) expect(c.porBandeira[id]!.linhas.every(l => l.chaveData.slice(3) === '07/2026'), 'semente ' + s).toBe(true);
      expect(conferirTotais(c, ordem, transacoes, vendas, meses).ok, 'semente ' + s).toBe(true);
    }
  });

  it('empate no tamanho mantém a ordem da seleção', () => {
    expect(ordemDasBandeiras({ cielo: [tx(data(1), 1)], rede: [tx(data(1), 1)], stone: [tx(data(1), 1), tx(data(2), 1)] }, ['rede', 'cielo', 'stone'])).toEqual(['stone', 'rede', 'cielo']);
  });
});

describe('conferirTotais: tolerância no limite', () => {
  const r = sorteador(777);
  const bases = [0.01, 0.1, 1, 1.02, 8.03, 19.99, 100, 1000.1, 123456.78, ...Array.from({ length: 300 }, () => (1 + Math.floor(r() * 1e8)) / 100)];
  const conferir = (brutoArquivo: number, brutoExtrato: number) => {
    const c: Conciliacao = { porBandeira: { cielo: { meses: [], aprovadas: 1, casadas: 0, semNota: 1, totalBruto: brutoArquivo, totalTaxa: 0, linhas: [] } }, sobras: [] };
    return conferirTotais(c, ['cielo'], { cielo: [tx(data(5), brutoExtrato, 0)] }, []);
  };
  const emCentavos = (c: number) => c / 100;

  it('exatamente 2 centavos passa, em todo valor e nos dois sentidos; 3 centavos não (1,02 × 1,00 era acusado pelo resto do ponto flutuante)', () => {
    expect(TOLERANCIA).toBe(0.02);
    for (const b of bases) {
      const c = cent(b);
      for (const d of [0, 1, 2, -1, -2]) expect(conferir(emCentavos(c + d), emCentavos(c)).ok, c + ' + ' + d).toBe(true);
      for (const d of [3, -3, 100]) expect(conferir(emCentavos(c + d), emCentavos(c)).ok, c + ' + ' + d).toBe(false);
    }
  });

  it('a planilha de vendas: mesma tolerância', () => {
    const planilha = (somaContada: number, somaVendas: number) => {
      const c: Conciliacao = { porBandeira: {}, sobras: [venda(data(5), somaContada)] };
      return conferirTotais(c, [], {}, [venda(data(5), somaVendas)]);
    };
    for (const b of bases) {
      const c = cent(b);
      for (const d of [2, -2]) expect(planilha(emCentavos(c + d), emCentavos(c)).ok, c + ' + ' + d).toBe(true);
      for (const d of [3, -3]) expect(planilha(emCentavos(c + d), emCentavos(c)).ok, c + ' + ' + d).toBe(false);
    }
  });
});

describe('totais e arquivos', () => {
  it('totais por mês fecham com as vendas e os extratos', () => {
    for (let s = 1; s <= 80; s++) {
      const { transacoes, vendas, ordem } = cenario(s);
      const c = conciliar({ ordem, transacoes, vendas, mesesPermitidos: null });
      const t = totaisPorMes(c, ordem);
      expect(cent(t.reduce((a, m) => a + m.totalVendas, 0)), 'semente ' + s).toBe(cent(vendas.reduce((a, v) => a + v.bruto, 0)));
      for (const id of ordem) {
        expect(cent(t.reduce((a, m) => a + m.porBandeira.find(b => b.id === id)!.bruto, 0)), 'semente ' + s).toBe(cent(transacoes[id]!.reduce((a, x) => a + x.bruto, 0)));
      }
      const chaves = t.map(m => chaveMes(m.mes));
      expect(chaves.slice().sort(porCalendario), 'semente ' + s).toEqual(chaves);
    }
  });

  it('Saídas: cada sobra uma vez, no seu mês, em ordem de data', () => {
    for (let s = 1; s <= 60; s++) {
      const { transacoes, vendas, ordem } = cenario(s);
      const c = conciliar({ ordem, transacoes, vendas, mesesPermitidos: null });
      const saidas = saidasPorMes(c.sobras, ' 7000 ');
      expect(saidas.reduce((a, m) => a + m.linhas.length, 0), 'semente ' + s).toBe(c.sobras.length);
      for (const m of saidas) {
        expect(m.linhas.every(l => l.credora === '7000' && l.data.slice(3) === dois(m.mes.mes) + '/' + m.mes.ano), 'semente ' + s).toBe(true);
        const ordemDatas = m.linhas.map(l => +l.data.slice(0, 2));
        expect(ordemDatas.slice().sort((a, b) => a - b), 'semente ' + s).toEqual(ordemDatas);
      }
    }
  });

  it('linhas do arquivo: débito e crédito pelo tipo e por ter casado', () => {
    const c = conciliar({ ordem: ['cielo'], transacoes: { cielo: [tx(data(5), 100, 2), tx(data(6), 50, 1)] }, vendas: [venda(data(5), 100, '9')], mesesPermitidos: null });
    const l = linhasDaBandeira(c.porBandeira.cielo!, ' 1111 ', { vendas: ' 2 ', taxas: ' 3 ', caixaPadrao: true, caixa: '' });
    expect(l.map(x => [x.tipo, x.devedora, x.credora, x.historico])).toEqual([
      ['Bruto', '1111', '2', '15'], ['Taxa', '3', '1111', '92060'],
      ['Bruto', '1111', '10101', '181'], ['Taxa', '3', '1111', '92060'],
    ]);
  });

  it('CSV: toda linha com 10 colunas, mesmo com ; aspas ou quebra no texto', () => {
    const textos = ['simples', 'a;b', 'diz "oi"', 'linha\nquebrada', ';;"', ''];
    const linhas = textos.map(t => ({ devedora: t, credora: '1', data: '05/07/2026', valor: 1234.5, historico: '15', complemento: t, nota: t, tipo: 'Saida' as const, casou: false }));
    const csv = textoCsv(linhas).slice(1);
    // separa respeitando as aspas
    const reg: string[][] = [[]];
    let campo = '', aspas = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (aspas) { if (ch === '"' && csv[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch; }
      else if (ch === '"') aspas = true;
      else if (ch === ';') { reg[reg.length - 1].push(campo); campo = ''; }
      else if (ch === '\r' && csv[i + 1] === '\n') { reg[reg.length - 1].push(campo); campo = ''; reg.push([]); i++; }
      else campo += ch;
    }
    reg[reg.length - 1].push(campo);
    expect(reg).toHaveLength(LINHAS_EM_BRANCO + textos.length);
    expect(reg.every(l => l.length === 10)).toBe(true);
    expect(reg.slice(LINHAS_EM_BRANCO).map(l => l[1])).toEqual(textos);
    expect(reg[LINHAS_EM_BRANCO][4]).toBe('1.234,50');
    expect(campoCsv('a\nb')).toBe('"a\nb"');
  });

  it('meses: comparação e nome do arquivo', () => {
    const m = (mes: number, ano = 2026): Mes => ({ mes, ano });
    expect(compararMeses([], [])).toEqual({ extras: [], comuns: [], excluidos: [] });
    expect(compararMeses([m(7), m(8)], [m(8), m(9)])).toEqual({ extras: [m(9)], comuns: [m(8)], excluidos: [m(7)] });
    expect(compararMeses([m(12, 2025)], [m(12, 2026)])).toEqual({ extras: [m(12, 2026)], comuns: [], excluidos: [m(12, 2025)] });
    expect(slugMeses([])).toBe('');
    expect(slugMeses([m(1), m(2), m(3), m(4), m(5), m(6)])).toBe('2026-01_2026-02_2026-03_2026-04_e-mais-2');
    expect(['2026-10', '2026-9', '2025-12', '2026-1'].sort(porCalendario)).toEqual(['2025-12', '2026-1', '2026-9', '2026-10']);
  });
});
