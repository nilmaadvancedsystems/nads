// Testes combinatórios do Creditor: laços determinísticos (semente fixa), dados fictícios. Relatório do banco em texto e planilha,
// cruzamento com o balancete e o sistema, os lançamentos e o fechamento por dia, o casamento com o extrato e a junção dos relatórios.
// Invariantes: nenhum centavo com erro, soma do detalhe = total, nada perdido ou duplicado, zero quando tudo bate.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { lerRelatorioPlanilha, lerRelatorioTexto, TOTAIS_VAZIOS } from './arquivos/banco';
import { lerCarteiraDeCobranca, tituloDaCarteira } from './arquivos/formatos';
import { livroDeImportacao, LINHAS_EM_BRANCO } from './arquivos/gerar';
import { linhasDoCsv } from './arquivos/planilha';
import { lerSistema } from './arquivos/sistema';
import { contaAprendida } from './regras/aprendizado';
import { juntarSemRepetir } from './regras/automatico';
import { cruzarPeloBalancete } from './regras/clientes';
import { juntarRelatorios, mesesDaCompetencia, rotuloCompetencia, titulosForaDaCompetencia } from './regras/competencia';
import { conferirGrupo, conferirTotalGeral, relatorioConferido, tituloCoerente } from './regras/conferencia';
import { cruzar, pendentes, type Cruzamento, type Decisao } from './regras/cruzamento';
import { casarComExtrato, creditosDeLiquidacao, titulosDescontados, type CreditoDeLiquidacao } from './regras/extrato';
import { fecharPeloExtrato, fecharPorDia, gerarLancamentos, titulosFora } from './regras/lancamentos';
import { dataBR, dinheiro, liquidoDoTitulo, r2, somar } from './regras/numeros';
import { CONTAS_PADRAO, type Grupo, type RelatorioBanco, type Titulo } from './tipos';

function semente(inicial: number): () => number {
  let s = inicial | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Sorte = () => number;
const entre = (r: Sorte, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const um = <T,>(r: Sorte, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function embaralhar<T>(r: Sorte, xs: readonly T[]): T[] {
  const o = [...xs];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const CENTAVOS = [1, 2, 7, 29, 57, 99, 100, 101, 1005, 1115, 123456, 99999, 100000, 1000001, 123456789];
const buf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const brl = (c: number, milhar = '.') => String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, milhar) + ',' + String(Math.abs(c) % 100).padStart(2, '0');
const SACADOS = ['MERCADO BOM PRECO LTDA', 'PADARIA SAO JOSE ME', 'ACOUGUE BOI GORDO', 'EMPORIO VERDE EIRELI', 'RESTAURANTE SABOR', 'COMERCIAL TOTAL LTDA', 'TOTAL ATACADO', 'SUPERTOTAL MERCADOS', 'LOJA DOIS IRMAOS'];
const DIAS = ['28/12/2025', '30/12/2025', '31/12/2025', '02/01/2026', '05/01/2026', '30/01/2026', '02/02/2026'];

function geraTitulo(r: Sorte, id: number, data = um(r, DIAS)): Titulo {
  const valor = um(r, CENTAVOS), mora = r() < 0.3 ? um(r, CENTAVOS) : 0, outros = r() < 0.15 ? um(r, CENTAVOS) : 0;
  const desconto = r() < 0.3 ? Math.max(0, Math.min(valor - 1, um(r, CENTAVOS))) : 0;
  const v = (n: number) => n / 100;
  return { id, sacado: um(r, SACADOS), nossoNumero: '0001' + String(100000 + id), nf: String(4000 + id), valor: v(valor), mora: v(mora), desconto: v(desconto), outros: v(outros), liquidacao: data, cobrado: r() < 0.7 ? v(valor + mora + outros - desconto) : null };
}
const emCentavos = (n: number) => Math.round(n * 100);
const somaC = (ts: readonly Titulo[], f: (t: Titulo) => number) => ts.reduce((s, t) => s + emCentavos(f(t)), 0) / 100;
function grupoDe(id: number, titulos: Titulo[]): Grupo {
  return { id, titulos, registros: titulos.length, impresso: { valor: somaC(titulos, t => t.valor), mora: somaC(titulos, t => t.mora), desconto: somaC(titulos, t => t.desconto), outros: somaC(titulos, t => t.outros), cobrado: somaC(titulos, liquidoDoTitulo) } };
}
function relatorioDe(grupos: Grupo[]): RelatorioBanco {
  const ts = grupos.flatMap(g => g.titulos);
  return { grupos, totalGeral: { valor: somaC(ts, t => t.valor), mora: somaC(ts, t => t.mora), desconto: somaC(ts, t => t.desconto), outros: somaC(ts, t => t.outros), cobrado: somaC(ts, liquidoDoTitulo) }, registrosGeral: ts.length, ignorados: 0, avisos: [] };
}
function porDia(r: Sorte, n: number): Grupo[] {
  const ts = Array.from({ length: n }, (_, i) => geraTitulo(r, i + 1));
  return [...new Set(ts.map(t => t.liquidacao))].map((d, i) => grupoDe(i + 1, ts.filter(t => t.liquidacao === d)));
}
const cruzadosOk = (ts: readonly Titulo[]): Cruzamento[] => ts.map(t => ({ tituloId: t.id, situacao: 'ok', linha: { linha: 1, nf: t.nf, cliente: t.sacado, contrapartida: '11201', historico: '', valor: t.valor }, valorBanco: t.valor, valorSistema: t.valor, nota: '' }));

describe('o fechamento do Creditor', () => {
  it('tudo bate: nenhum grupo diverge, cada dia fecha em zero, débito = crédito por título', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = semente(seed);
      const rel = relatorioDe(porDia(r, entre(r, 1, 30)));
      const ts = rel.grupos.flatMap(g => g.titulos);
      expect(relatorioConferido(rel), 'seed ' + seed).toBe(true);
      expect(conferirTotalGeral(rel).ok).toBe(true);
      for (const t of ts) expect(tituloCoerente(t)).toBe(true);
      const c = cruzadosOk(ts);
      const ls = gerarLancamentos(ts, c, {}, CONTAS_PADRAO);
      expect(titulosFora(ts, c, {})).toEqual([]);
      const dias = fecharPorDia(rel.grupos, ls, [], CONTAS_PADRAO);
      for (const d of dias) { expect(d.situacao).toBe('ok'); expect(d.diferenca).toBe(0); }
      // cada título: o que entrou no banco é o líquido dele, sem resto
      for (const t of ts) {
        const dele = ls.filter(l => l.tituloId === t.id);
        const banco = dele.reduce((s, l) => s + (l.debito === CONTAS_PADRAO.banco ? emCentavos(l.valor) : 0) - (l.credito === CONTAS_PADRAO.banco ? emCentavos(l.valor) : 0), 0);
        expect(banco).toBe(emCentavos(liquidoDoTitulo(t)));
        for (const l of dele) expect(l.valor).toBe(emCentavos(l.valor) / 100);
      }
      expect(gerarLancamentos(ts, c, {}, CONTAS_PADRAO)).toEqual(ls);
      // a ordem de entrada dos títulos não muda o que vai em cada data
      const outra = gerarLancamentos(embaralhar(r, ts), c, {}, CONTAS_PADRAO);
      expect(fecharPorDia(rel.grupos, outra, [], CONTAS_PADRAO)).toEqual(dias);
    }
  });

  it('título excluído: a diferença do dia é exatamente a dele (explicada), e nada se perde nem duplica', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = semente(seed * 3);
      const rel = relatorioDe(porDia(r, entre(r, 2, 20)));
      const ts = rel.grupos.flatMap(g => g.titulos);
      const c = cruzadosOk(ts);
      const fora = ts.filter(() => r() < 0.3);
      const decisoes: Record<number, Decisao> = Object.fromEntries(fora.map(t => [t.id, { tipo: 'excluir' }]));
      const ls = gerarLancamentos(ts, c, decisoes, CONTAS_PADRAO);
      const deFora = titulosFora(ts, c, decisoes);
      expect(new Set(deFora.map(t => t.id))).toEqual(new Set(fora.map(t => t.id)));
      expect(new Set(ls.map(l => l.tituloId)).size + deFora.length).toBe(ts.length);
      for (const d of fecharPorDia(rel.grupos, ls, deFora, CONTAS_PADRAO)) {
        const doDia = deFora.filter(t => t.liquidacao === d.data);
        expect(d.fora).toBe(somaC(doDia, liquidoDoTitulo));
        expect(d.situacao).toBe(doDia.some(t => emCentavos(liquidoDoTitulo(t)) > 0) ? 'explicada' : 'ok');
      }
    }
  });

  it('um centavo de diferença no impresso diverge', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 5);
      const g = grupoDe(1, Array.from({ length: entre(r, 1, 10) }, (_, i) => geraTitulo(r, i + 1, '05/01/2026')));
      const c = um(r, ['valor', 'cobrado'] as const);
      const errado = { ...g, impresso: { ...g.impresso, [c]: r2((g.impresso[c] as number) + um(r, [0.01, -0.01])) } };
      expect(conferirGrupo(errado).situacao).toBe('diverge');
    }
  });
});

describe('a junção dos relatórios', () => {
  it('os totais somam no centavo; os ids renumeram sem repetir', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 7);
      const rels = Array.from({ length: entre(r, 2, 5) }, () => relatorioDe(porDia(r, entre(r, 1, 8))));
      const j = juntarRelatorios(rels);
      const ts = j.grupos.flatMap(g => g.titulos);
      expect(ts.length).toBe(rels.reduce((n, x) => n + x.grupos.flatMap(g => g.titulos).length, 0));
      expect(new Set(ts.map(t => t.id)).size).toBe(ts.length);
      expect(new Set(j.grupos.map(g => g.id)).size).toBe(j.grupos.length);
      expect(conferirTotalGeral(j).ok).toBe(true);
      expect(j.totalGeral.valor).toBe(somaC(ts, t => t.valor));
    }
  });

  it('dois relatórios com títulos em comum: nada duplicado, nada perdido, na ordem que for', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 11);
      const base = Array.from({ length: entre(r, 2, 14) }, (_, i) => geraTitulo(r, i + 1));
      const a = base.filter(() => r() < 0.7), b = base.filter(() => r() < 0.7);
      if (!a.length || !b.length) continue;
      const rels = [relatorioDe([grupoDe(1, a)]), relatorioDe([grupoDe(1, b)])];
      for (const lista of [rels, [...rels].reverse()]) {
        const j = juntarSemRepetir(lista).relatorio;
        const chaves = j.grupos.flatMap(g => g.titulos).map(t => t.nossoNumero);
        expect(chaves.length).toBe(new Set(chaves).size);
        expect(new Set(chaves)).toEqual(new Set([...a, ...b].map(t => t.nossoNumero)));
      }
    }
  });
});

describe('o casamento com o extrato', () => {
  it('cada crédito fica com títulos que somam ele, nenhum título em dois créditos; o resto é o sem crédito', () => {
    for (let seed = 1; seed <= 250; seed++) {
      const r = semente(seed * 13);
      const ts = Array.from({ length: entre(r, 1, 20) }, (_, i) => geraTitulo(r, i + 1));
      const dias = [...new Set(ts.map(t => t.liquidacao))];
      const naoCreditado = new Set(dias.filter(() => r() < 0.2));
      const iso = (d: string) => d.slice(6) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
      const creditos = creditosDeLiquidacao(dias.filter(d => !naoCreditado.has(d)).map(d => ({ data: iso(d), valor: Math.round(somaC(ts.filter(t => t.liquidacao === d), liquidoDoTitulo) * 100), historico: um(r, ['CRÉD.LIQ.COBRANÇA', 'CRÉD.LIQUIDAÇÃO COBRANÇA', 'CRED LIQ']) })));
      const meses = [...new Set(ts.map(t => iso(t.liquidacao).slice(0, 7)))];
      const m = casarComExtrato(embaralhar(r, ts), embaralhar(r, creditos), meses);
      const usados = m.creditos.flatMap(c => c.titulos);
      expect(usados.length).toBe(new Set(usados).size);
      for (const c of m.creditos) if (c.titulos.length) expect(emCentavos(somaC(ts.filter(t => c.titulos.includes(t.id)), liquidoDoTitulo))).toBe(emCentavos(c.credito.valor));
      expect(usados.length + m.semCredito.length).toBe(ts.length);
      const ls = gerarLancamentos(ts, cruzadosOk(ts), {}, CONTAS_PADRAO, m.dataDoCredito);
      for (const d of fecharPeloExtrato(m, ls, [], CONTAS_PADRAO)) expect(d.diferenca).toBe(m.semCredito.some(t => m.dataDoCredito.get(t.id) === d.data) ? d.diferenca : 0);
    }
  });

  it('mês sem extrato: o título não vira "sem crédito"; janela de 7 dias na virada de ano', () => {
    const t = (id: number, d: string, v: number): Titulo => ({ id, sacado: 'A', nossoNumero: String(id), nf: String(id), valor: v, mora: 0, desconto: 0, outros: 0, liquidacao: d, cobrado: null });
    const c = (d: string, v: number): CreditoDeLiquidacao => ({ data: d, valor: v, historico: 'CRED LIQ' });
    expect(casarComExtrato([t(1, '30/12/2025', 10)], [c('05/01/2026', 10)], ['2025-12']).dataDoCredito.get(1)).toBe('05/01/2026');
    expect(casarComExtrato([t(1, '20/12/2025', 10)], [c('05/01/2026', 10)], ['2025-12']).semCredito.map(x => x.id)).toEqual([1]);
    expect(casarComExtrato([t(1, '20/12/2025', 10)], [], ['2026-01']).semCredito).toEqual([]);
  });

  it('TD: nunca passa do valor da liberação', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 17);
      const ts = Array.from({ length: entre(r, 1, 20) }, (_, i) => geraTitulo(r, i + 1));
      const tds: CreditoDeLiquidacao[] = Array.from({ length: entre(r, 1, 3) }, () => ({ data: um(r, ['01/10/2025', '15/12/2025']), valor: um(r, CENTAVOS) / 100, historico: 'CRED LIBERACAO TD' }));
      const de = titulosDescontados(ts, tds);
      for (const td of tds) expect(emCentavos(somaC(ts.filter(t => de.get(t.id) === td), liquidoDoTitulo))).toBeLessThanOrEqual(emCentavos(td.valor));
    }
  });
});

describe('o relatório do banco lido', () => {
  const cabecalho = 'Sacado  Nosso Numero  Seu Numero  Vencimento  Valor (R$)  Vlr. Mora  Vlr. Desc. Acresc.  Dt. Liquidacao  Vlr. Cobrado';
  const linha = (t: Titulo, milhar: string) => [t.sacado, t.nossoNumero, t.nf, t.liquidacao, brl(emCentavos(t.valor), milhar), brl(emCentavos(t.mora), milhar), brl(emCentavos(t.desconto), milhar), t.liquidacao, brl(emCentavos(liquidoDoTitulo(t)), milhar)].join('  ');
  const semOutros = (t: Titulo): Titulo => { const c = r2(t.valor + t.mora - t.desconto); return { ...t, outros: 0, cobrado: c }; };

  for (const milhar of ['.', '']) {
    it('em texto, valores ' + (milhar ? 'com' : 'sem') + ' o ponto do milhar: nenhum título some, nem o do cliente com TOTAL no nome', () => {
      for (let seed = 1; seed <= 120; seed++) {
        const r = semente(seed * 19);
        const grupos = porDia(r, entre(r, 1, 15)).map(g => ({ ...g, titulos: g.titulos.map(semOutros) })).map(g => grupoDe(g.id, g.titulos));
        const texto = ['Liquidacao', cabecalho, ...grupos.flatMap(g => [...g.titulos.map(t => linha(t, milhar)), 'Total de Valores do grupo  ' + [g.impresso.valor, g.impresso.mora, g.impresso.desconto, g.impresso.cobrado].map(v => brl(emCentavos(v as number), milhar)).join('  ')])].join('\n');
        const lido = lerRelatorioTexto(texto);
        expect(lido.grupos.length).toBe(grupos.length);
        expect(lido.grupos.flatMap(g => g.titulos).map(t => t.nf)).toEqual(grupos.flatMap(g => g.titulos).map(t => t.nf));
        expect(lido.grupos.flatMap(g => g.titulos).map(t => t.valor)).toEqual(grupos.flatMap(g => g.titulos).map(t => t.valor));
        expect(lido.grupos.every(g => conferirGrupo(g).situacao === 'ok')).toBe(true);
      }
    });
  }

  const planilhaCsv = (ts: readonly Titulo[], sep: string, aspas: boolean, primeira?: string) => {
    const q = (s: string) => (aspas || s.includes(sep) ? '"' + s + '"' : s);
    return [...(primeira ? [primeira] : []), ['Sacado', 'Nosso Numero', 'Seu Numero', 'Valor', 'Vlr. Mora', 'Vlr. Desc.', 'Dt. Liquidacao', 'Vlr. Cobrado'].map(q).join(sep),
      ...ts.map(t => [t.sacado, t.nossoNumero, t.nf, brl(emCentavos(t.valor)), brl(emCentavos(t.mora)), brl(emCentavos(t.desconto)), t.liquidacao, brl(emCentavos(liquidoDoTitulo(semOutros(t))))].map(q).join(sep))].join('\r\n');
  };

  for (const sep of [';', '\t', ',']) {
    for (const aspas of [false, true]) {
      for (const titulo of [undefined, 'Relatório de títulos, período de 01/2026']) {
        it('csv com ' + JSON.stringify(sep) + (aspas ? ', com aspas' : '') + (titulo ? ', com uma linha de título' : '') + ': todas as linhas, no centavo', () => {
          for (let seed = 1; seed <= 25; seed++) {
            const r = semente(seed * 23);
            const ts = Array.from({ length: entre(r, 1, 12) }, (_, i) => semOutros(geraTitulo(r, i + 1)));
            const lido = lerRelatorioPlanilha(buf(planilhaCsv(ts, sep, aspas, titulo)), 'a.csv');
            const out = lido.grupos.flatMap(g => g.titulos).sort((a, b) => +a.nf - +b.nf);
            expect(out.map(t => t.nf)).toEqual(ts.map(t => t.nf));
            expect(out.map(t => t.valor)).toEqual(ts.map(t => t.valor));
            expect(out.map(t => t.desconto)).toEqual(ts.map(t => t.desconto));
            expect(out.map(t => t.liquidacao)).toEqual(ts.map(t => t.liquidacao));
          }
        });
      }
    }
  }

  it('linha com total de grupo e cliente com TOTAL na mesma planilha: o total vira o impresso, o cliente segue título', () => {
    const csv = ['Sacado;Seu Numero;Valor;Dt. Liquidacao;Vlr. Cobrado', 'TOTAL ATACADO;11;10,00;05/01/2026;10,00', 'OUTRO;12;20,00;05/01/2026;20,00', 'Total de Valores do grupo;;30,00;;30,00', 'Total de Valores Liquidados;;30,00;;30,00'].join('\n');
    const lido = lerRelatorioPlanilha(buf(csv), 'a.csv');
    expect(lido.grupos.map(g => g.titulos.map(t => t.nf))).toEqual([['11', '12']]);
    expect(lido.grupos[0].impresso.valor).toBe(30);
    expect(lido.totalGeral.valor).toBe(30);
  });

  it('xlsx com valores numéricos e datas de verdade (Date e número de série)', () => {
    for (const data of [new Date(2026, 0, 5), 46027, '05/01/2026']) {
      const ws = XLSX.utils.aoa_to_sheet([['Sacado', 'Seu Numero', 'Valor', 'Dt. Liquidacao'], ['A', 4521, 1234.56, data], ['B', 4522.0, 0.07, data]], { cellDates: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'x');
      const lido = lerRelatorioPlanilha(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 'a.xlsx');
      expect(lido.grupos.flatMap(g => g.titulos).map(t => [t.nf, t.valor, t.liquidacao])).toEqual([['4521', 1234.56, '05/01/2026'], ['4522', 0.07, '05/01/2026']]);
    }
  });

  it('a carteira do Bradesco: a oscilação vira mora ou desconto; o mesmo título em duas páginas conta uma vez', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = semente(seed * 29);
      const v = um(r, CENTAVOS), dif = um(r, [-1, 0, 1, 37]);
      const c = Math.max(1, v + dif);
      const l = `53500000${seed}  NF${seed}-B  CLIENTE X  13/02/2026  09/02/2026  ${brl(v)}  ${brl(Math.abs(c - v))}  ${brl(c)}  2`;
      const t = tituloDaCarteira(l, 1)!;
      expect(emCentavos(t.valor + t.mora - t.desconto)).toBe(c);
      const cab = 'Nosso Número  Seu Número  Nome do Pagador  Vencimento  Data Pagto  Valor  Osc  Cobrado';
      const rel = lerCarteiraDeCobranca([[cab, l], [cab, l]]);
      expect(rel.grupos[0].titulos.length).toBe(1);
    }
  });

  it('o arquivo do sistema com os recebimentos negativos vira positivo; linhas ruins fora', () => {
    const csv = ['Documento;Cliente;Contrapartida;Histórico;Valor', '4521;A;11201;Recebimento de clientes 4521;-1.250,00', '4533;B;11201;Recebimento de clientes 4533;-0,07', ';;;;', 'x;C;11201;Sem número;abc'].join('\n');
    const s = lerSistema(buf(csv), 's.csv');
    expect(s.map(l => [l.nf, l.valor])).toEqual([['4521', 1250], ['4533', 0.07], ['x', null]]);
  });
});

describe('os números do Creditor', () => {
  it('dinheiro em qualquer formato, no centavo; soma sem erro de ponto flutuante', () => {
    for (const c of CENTAVOS) {
      const n = c / 100;
      for (const v of [n, brl(c), 'R$ ' + brl(c), 'R$' + brl(c, ''), brl(c, ''), brl(c) + ' D', brl(c) + ' C']) expect(dinheiro(v), String(v)).toBe(n);
      expect(dinheiro('(' + brl(c) + ')')).toBe(-n);
      expect(dinheiro('-' + brl(c))).toBe(-n);
    }
    expect(dinheiro('1.234.567')).toBe(1234567);
    expect(dinheiro('1.234.567,89')).toBe(1234567.89);
    expect(dinheiro('abc')).toBe(null);
    expect(dinheiro('')).toBe(null);
    expect(somar(Array(1000).fill(0.1))).toBe(100);
    expect(somar([0.1, 0.2, -0.3])).toBe(0);
  });

  it('a data em qualquer formato', () => {
    for (const v of [new Date(2026, 0, 5), 46027, '05/01/2026', '5/1/26', '05-01-2026', '05.01.2026', '2026-01-05']) expect(dataBR(v), String(v)).toBe('05/01/2026');
    expect(dataBR('nada')).toBe('');
  });

  it('competência: em ordem e sem repetir, na virada de ano; títulos fora dela', () => {
    expect(mesesDaCompetencia('2026-01,2025-12,2026-01')).toEqual(['2025-12', '2026-01']);
    expect(rotuloCompetencia('2025-12,2026-01')).toBe('12/2025 a 01/2026');
    const t = { id: 1, liquidacao: '31/12/2025' } as Titulo;
    expect(titulosForaDaCompetencia([t], '2026-01').length).toBe(1);
    expect(titulosForaDaCompetencia([t], '2025-12,2026-01').length).toBe(0);
  });

  it('o cliente chamado como uma propriedade do objeto não acha uma conta que não existe', () => {
    expect(contaAprendida({}, 'Constructor')).toBeNull();
  });
});

describe('o cruzamento', () => {
  it('um resultado por título, na ordem, com o valor do banco; o que não acha fica pendente até decidir', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 31);
      const ts = Array.from({ length: entre(r, 1, 20) }, (_, i) => geraTitulo(r, i + 1));
      const sistema = ts.filter(() => r() < 0.6).map((t, i) => ({ linha: i + 1, nf: um(r, ['00', '', 'NF ']) + t.nf + um(r, ['', '/2']), cliente: t.sacado, contrapartida: '112' + (i % 3), historico: 'Recebimento NF ' + t.nf, valor: r() < 0.5 ? t.valor : r2(t.valor + 1) }));
      const cs = cruzar(ts, sistema);
      expect(cs.map(c => c.tituloId)).toEqual(ts.map(t => t.id));
      expect(cs.map(c => c.valorBanco)).toEqual(ts.map(t => t.valor));
      for (const c of cs) if (c.linha && c.situacao === 'ok') expect(c.linha.contrapartida).toBeTruthy();
      const p = pendentes(cs, {});
      expect(p.every(c => c.situacao === 'nao-encontrada')).toBe(true);
      expect(pendentes(cs, Object.fromEntries(p.map(c => [c.tituloId, { tipo: 'excluir' }])))).toEqual([]);
      const b = cruzarPeloBalancete(ts, [{ codigo: '1', nome: 'MERCADO BOM PRECO LTDA' }, { codigo: '2', nome: 'MERCADO BOM PRECO LTDA' }, { codigo: '3', nome: 'LOJA DOIS IRMAOS' }], {});
      expect(b.map(c => c.tituloId)).toEqual(ts.map(t => t.id));
      for (let i = 0; i < ts.length; i++) {
        if (ts[i].sacado === 'MERCADO BOM PRECO LTDA') expect(b[i].opcoes?.map(o => o.codigo)).toEqual(['1', '2']);
        if (ts[i].sacado === 'LOJA DOIS IRMAOS') expect(b[i].linha?.contrapartida).toBe('3');
      }
    }
  });
});

describe('o arquivo de importação', () => {
  it('as linhas no padrão: 4 em branco, data serial, valor com 2 casas, códigos numéricos', () => {
    const wb = livroDeImportacao([
      { automatico: '', data: '05/01/2026', debito: '10503', credito: '11201', codHistorico: '246', historico: 'NF 1 - A', valor: 1234567.89, documento: '004521' },
      { automatico: '', data: '31/12/2025', debito: '10503', credito: 'X1', codHistorico: '246', historico: '', valor: 0.01, documento: '' },
    ]);
    const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Importacao, { header: 1, raw: true, defval: '' });
    expect(m.length).toBe(LINHAS_EM_BRANCO + 2);
    // a data: o número de série, mostrado DD/MM/AAAA (o sheet_to_json devolveria um Date)
    const ws = wb.Sheets.Importacao;
    const celula = (r: number) => ws[XLSX.utils.encode_cell({ r, c: 3 })] as XLSX.CellObject;
    expect([celula(LINHAS_EM_BRANCO).v, celula(LINHAS_EM_BRANCO).z]).toEqual([46027, 'dd/mm/yyyy']);
    expect(celula(LINHAS_EM_BRANCO + 1).v).toBe(46022);
    const semData = (l: unknown[]) => [...l.slice(0, 3), ...l.slice(4)];
    expect(semData(m[LINHAS_EM_BRANCO])).toEqual(['', 10503, 11201, 1234567.89, 246, 'NF 1 - A', '', '', 4521]);
    expect(semData(m[LINHAS_EM_BRANCO + 1])).toEqual(['', 10503, 'X1', 0.01, 246, '', '', '', '']);
  });

  it('linhasDoCsv: aspas, separador no meio, aspas dobradas, BOM e linha em branco', () => {
    expect(linhasDoCsv('﻿a;b\r\n\r\n"c;d";"e""f"\n')).toEqual([['a', 'b'], ['c;d', 'e"f']]);
    void TOTAIS_VAZIOS;
  });
});

describe('a linha de total não vira título, e o cliente com TOTAL no nome continua título', () => {
  const resumo = (r: ReturnType<typeof lerRelatorioTexto>) => ({ nomes: r.grupos.flatMap(g => g.titulos.map(t => t.sacado)), geral: r.totalGeral.valor, grupo: r.grupos.map(g => g.impresso.valor) });
  const CAB_2 = 'Sacado  Nosso Numero  Seu Numero  Vencimento  Valor (R$)  Vlr. Mora  Vlr. Desc. Acresc.  Dt. Liquidacao  Vlr. Cobrado';
  const CAB_1 = 'Sacado  Nosso Numero  Seu Numero  Valor (R$)  Vlr. Mora  Vlr. Desc. Acresc.  Dt. Liquidacao  Vlr. Cobrado';
  const COM_2 = ['Liquidacao', CAB_2, 'ALFA LTDA  111111  9001  05/10/2026  100,00  0,00  0,00  05/10/2026  100,00'];
  const COM_1 = ['Liquidacao', CAB_1, 'ALFA LTDA  111111  9001  100,00  0,00  0,00  05/10/2026  100,00'];
  it.each([
    ['Total do dia 05/10/2026  12  100,00  0,00  0,00  100,00'], ['TOTAL DE TITULOS 05/10/2026  12  100,00  0,00  0,00  100,00'],
    ['TOTAL DOS TITULOS 05/10/2026  12  100,00  0,00  0,00  100,00'], ['TOTAL: 05/10/2026  12  100,00  0,00  0,00  100,00'],
  ])('em texto, cabeçalho com uma data: %s é total', total => {
    expect(resumo(lerRelatorioTexto([...COM_1, total].join('\n')))).toEqual({ nomes: ['ALFA LTDA'], geral: null, grupo: [100] });
  });
  it('em texto, o total geral com duas datas é total geral', () => {
    expect(resumo(lerRelatorioTexto([...COM_2, 'TOTAL LIQUIDADOS EM 05/10/2026  ATE 05/10/2026  12  100,00  0,00  0,00  100,00'].join('\n')))).toMatchObject({ nomes: ['ALFA LTDA'], geral: 100 });
  });
  it('em texto, sem cabeçalho: o total com a contagem é total, o cliente com os dois números é título', () => {
    expect(resumo(lerRelatorioTexto(['ALFA LTDA  111111  9001  05/10/2026  100,00', 'TOTAL 05/10/2026  12  100,00'].join('\n')))).toEqual({ nomes: ['ALFA LTDA'], geral: null, grupo: [100] });
    expect(resumo(lerRelatorioTexto('TOTAL ATACADO LTDA  222222  9002  05/10/2026  50,00')).nomes).toEqual(['TOTAL ATACADO LTDA']);
  });
  it('em texto, com cabeçalho: TOTAL ATACADO é título', () => {
    const r = lerRelatorioTexto([...COM_2, 'TOTAL ATACADO LTDA  222222  9002  05/10/2026  50,00  0,00  0,00  05/10/2026  50,00'].join('\n'));
    expect(r.grupos.flatMap(g => g.titulos.map(t => t.nf))).toEqual(['9001', '9002']);
  });

  const lerPlan = (rows: unknown[][]) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'x');
    return resumo(lerRelatorioPlanilha(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 'a.xlsx'));
  };
  const SEM_DATA = ['Sacado', 'Seu Numero', 'Valor', 'Mora'], COM_DATA = ['Sacado', 'Seu Numero', 'Valor', 'Dt. Liquidacao'];
  it('na planilha, a contagem na coluna do número não faz do total um título', () => {
    expect(lerPlan([SEM_DATA, ['ALFA', '9001', 100, 0], ['TOTAL', '1', 100, 0]])).toEqual({ nomes: ['ALFA'], geral: null, grupo: [100] });
    expect(lerPlan([SEM_DATA, ['ALFA', '9001', 100, 0], ['TOTAL LIQUIDADOS', '1', 100, 0]])).toMatchObject({ nomes: ['ALFA'], geral: 100 });
    expect(lerPlan([COM_DATA, ['ALFA', '9001', 100, '05/10/2026'], ['TOTAL', '1', 100, '05/10/2026']])).toEqual({ nomes: ['ALFA'], geral: null, grupo: [100] });
  });
  it('na planilha, TOTAL ATACADO com número, valor e data é título', () => {
    expect(lerPlan([COM_DATA, ['TOTAL ATACADO', '9001', 100, '05/10/2026'], ['ALFA', '9002', 50, '05/10/2026'], ['TOTAL', '2', 150, null]])).toEqual({ nomes: ['TOTAL ATACADO', 'ALFA'], geral: null, grupo: [150] });
  });
});
