// Combinações dos leitores (valor, data, planilha, OFX, PDF gerado): laços determinísticos com semente fixa, sem dado de
// cliente. Cada laço confere um invariante: o valor lido é o escrito, a soma não muda, nenhum centavo com erro de arredondamento.
import { describe, expect, it } from 'vitest';
import { extratoDoPdf, saldoAnteriorDoPdf, type ItemDeTexto } from './extrato';
import { lancamentosDoOfx, saldoAnteriorDoOfx } from './ofx';
import { lancamentosDaPlanilha, type Celula } from './planilha';
import { centavos, lerData, temSinal } from './texto';

/** gerador congruencial com semente fixa: a mesma sequência em toda execução */
function sorteador(semente: number) {
  let s = semente >>> 0;
  const n = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { n, ate: (m: number) => Math.floor(n() * m), de: <T,>(l: readonly T[]) => l[Math.floor(n() * l.length)] };
}
type Sorteador = ReturnType<typeof sorteador>;

const VALORES = [1, 2, 9, 10, 50, 99, 100, 101, 110, 999, 1000, 1001, 12345, 99999, 100000, 123456, 999999, 1000000, 100000000, 123456789, 999999999, 100000000000];
function maisValores(semente: number, qtd: number): number[] {
  const r = sorteador(semente);
  const out = VALORES.slice();
  for (let i = 0; i < qtd; i++) out.push(1 + r.ate(10 ** (1 + r.ate(10))));
  return out;
}

/** centavos → "1.234,56" */
function br(c: number): string {
  const s = String(c).padStart(3, '0');
  return s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s.slice(-2);
}
const semMilhar = (c: number) => br(c).replace(/\./g, '');
const americano = (c: number) => br(c).replace(/\./g, '#').replace(',', '.').replace(/#/g, ',');
const ponto = (c: number) => semMilhar(c).replace(',', '.');

describe('centavos: todo formato, os dois sinais, de 0,01 a bilhões', () => {
  const corpos = [br, semMilhar, americano, ponto];
  const negativos: ((s: string) => string)[] = [
    s => '-' + s, s => s + '-', s => '(' + s + ')', s => s + ' D', s => s + 'D', s => 'D ' + s, s => '(-) ' + s, s => 'R$ -' + s, s => 'R$-' + s,
    s => '-R$ ' + s, s => '- R$ ' + s, s => '- ' + s, s => '−' + s, s => '−R$ ' + s, s => '–' + s, s => 'R$ (' + s + ')',
  ];
  const positivos: ((s: string) => string)[] = [s => s, s => '+' + s, s => s + ' C', s => s + 'C', s => '(+) ' + s, s => 'R$ ' + s, s => 'R$' + s];
  const lista = maisValores(11, 300);

  it('negativo em qualquer escrita', () => {
    for (const c of lista) for (const corpo of corpos) for (const f of negativos) expect(centavos(f(corpo(c))), f(corpo(c))).toBe(-c);
  });
  it('positivo em qualquer escrita', () => {
    for (const c of lista) for (const corpo of corpos) for (const f of positivos) expect(centavos(f(corpo(c))), f(corpo(c))).toBe(c);
  });
  it('número da planilha: sem erro de ponto flutuante', () => {
    for (let c = 1; c <= 20000; c++) { expect(centavos(c / 100)).toBe(c); expect(centavos(-c / 100)).toBe(-c); }
    for (const c of lista) expect(centavos(c / 100)).toBe(c);
  });
  it('zero não fica "-0" e não vira saldo negativo', () => {
    for (const s of ['0,00', '-0,00', '0,00 D', '(0,00)', '0,00-', 'R$ -0,00', -0, -0.001]) expect(Object.is(centavos(s), 0), String(s)).toBe(true);
  });
  it('o sinal só vale nas pontas: traço e letra no meio não são valor (documento, data, conta)', () => {
    for (const s of ['1-2', '12-34', '1234-5', '01-02-2026', '123.456-7', '1D2', '12C34', 'R$', 'D', 'C', '-', '()', '', '   ', 'abc', 'CD 123', 'DOC 123', '123 CD']) expect(centavos(s), s).toBeNull();
  });
  it('temSinal concorda com o que centavos lê', () => {
    for (const c of lista.slice(0, 40)) {
      expect(temSinal(br(c))).toBe(false);
      for (const f of [(s: string) => '-' + s, (s: string) => s + '-', (s: string) => s + ' D', (s: string) => s + 'C', (s: string) => '(' + s + ')', (s: string) => '−' + s]) expect(temSinal(f(br(c))), f(br(c))).toBe(true);
    }
  });
});

describe('lerData: todos os dias de 2024 a 2027, em cada escrita', () => {
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dd = (n: number) => String(n).padStart(2, '0');
  const dias: { a: number; m: number; d: number; iso: string }[] = [];
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2027, 11, 31); t += 864e5) {
    const x = new Date(t);
    const a = x.getUTCFullYear(), m = x.getUTCMonth() + 1, d = x.getUTCDate();
    dias.push({ a, m, d, iso: a + '-' + dd(m) + '-' + dd(d) });
  }
  it('as escritas de texto, o Date e o serial do Excel', () => {
    for (const { a, m, d, iso } of dias) {
      for (const s of [
        dd(d) + '/' + dd(m) + '/' + a, d + '/' + m + '/' + a, dd(d) + '/' + dd(m) + '/' + String(a).slice(2), dd(d) + '.' + dd(m) + '.' + a, dd(d) + '-' + dd(m) + '-' + a,
        iso, iso + 'T12:30:00', iso + ' 23:59:59', d + ' ' + MES[m - 1] + ' ' + a, dd(d) + '/' + MES[m - 1] + '/' + a, dd(d) + MES[m - 1] + a,
        dd(d) + '/' + dd(m) + '/' + a + ' 10:30', dd(d) + '/' + dd(m) + '/' + a + ' 10:30:59',
      ]) expect(lerData(s, 1999), s).toBe(iso);
      expect(lerData(new Date(a, m - 1, d), 1999)).toBe(iso);
      expect(lerData(Date.UTC(a, m - 1, d) / 864e5 + 25569, 1999)).toBe(iso);
      expect(lerData(Date.UTC(a, m - 1, d) / 864e5 + 25569 + 0.75, 1999)).toBe(iso);
    }
  });
  it('sem o ano, vale o ano padrão; o que não existe é null', () => {
    expect(lerData('29/02', 2024)).toBe('2024-02-29');
    expect(lerData('29/02', 2026)).toBeNull();
    for (const s of ['31/02/2026', '29/02/2025', '32/01/2026', '00/01/2026', '15/13/2026', '15/00/2026', '2026-02-30', '31/04/2026', '31/06/26']) expect(lerData(s, 2026), s).toBeNull();
    for (const v of ['', null, undefined, 'abc', 'Total', 12, 19999, 80001]) expect(lerData(v, 2026)).toBeNull();
  });
});

describe('planilha: colunas, sinais, ordem, linhas de saldo', () => {
  type Mov = { data: string; valor: number; historico: string };
  const dataBR = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  function movimento(semente: number): Mov[] {
    const r = sorteador(semente);
    const dias = ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-27', '2026-02-28', '2026-03-01', '2024-02-29', '2025-12-31', '2026-01-01'];
    return Array.from({ length: 40 }, (_, i) => {
      const c = 1 + r.ate(10 ** (1 + r.ate(9)));
      return { data: r.de(dias), valor: r.n() < 0.5 ? c : -c, historico: 'LANCAMENTO DE TESTE ' + i };
    });
  }
  const celula = (r: Sorteador, c: number): Celula => (r.n() < 0.5 ? br(c) : c / 100);
  const debitaNaConta = (m: Mov, lado: 'banco' | 'sistema') => (lado === 'sistema') === (m.valor > 0);

  // cada layout: o cabeçalho e como escrever a linha
  const layouts: { nome: string; cab: string[]; linha: (m: Mov, lado: 'banco' | 'sistema', r: Sorteador) => Celula[] }[] = [
    { nome: 'valor com sinal', cab: ['Data', 'Histórico', 'Valor'], linha: (m, _l, r) => [dataBR(m.data), m.historico, r.n() < 0.5 ? (m.valor < 0 ? '-' : '') + br(Math.abs(m.valor)) : m.valor / 100] },
    { nome: 'débito e crédito', cab: ['Data', 'Histórico', 'Débito', 'Crédito'], linha: (m, l, r) => { const v = celula(r, Math.abs(m.valor)); return debitaNaConta(m, l) ? [dataBR(m.data), m.historico, v, ''] : [dataBR(m.data), m.historico, '', v]; } },
    { nome: 'valor e D/C', cab: ['Data', 'Histórico', 'Valor', 'D/C'], linha: (m, l, r) => [dataBR(m.data), m.historico, celula(r, Math.abs(m.valor)), debitaNaConta(m, l) ? 'D' : 'C'] },
    { nome: 'valor e natureza por extenso', cab: ['Dt', 'Descrição', 'Vlr', 'Natureza'], linha: (m, l, r) => [dataBR(m.data), m.historico, celula(r, Math.abs(m.valor)), debitaNaConta(m, l) ? 'Débito' : 'Crédito'] },
    { nome: 'conta débito e crédito', cab: ['Data', 'Conta Débito', 'Conta Crédito', 'Valor', 'Histórico'], linha: (m, _l, r) => [dataBR(m.data), m.valor > 0 ? '1.1.1' : '2.2.' + r.ate(9), m.valor > 0 ? '2.2.' + r.ate(9) : '1.1.1', celula(r, Math.abs(m.valor)), m.historico] },
  ];

  for (const lado of ['banco', 'sistema'] as const) for (const l of layouts) {
    it(lado + ' · ' + l.nome + ': nada se perde e o sinal é o do banco', () => {
      for (let semente = 1; semente <= 25; semente++) {
        const r = sorteador(semente * 97);
        const mov = movimento(semente);
        const corpo = mov.map(m => l.linha(m, lado, r));
        const linhas: Celula[][] = [['Empresa de teste'], l.cab, ...(semente % 2 ? corpo : corpo.slice().reverse())];
        const lido = lancamentosDaPlanilha(linhas, lado, 2026).lancamentos;
        expect(lido.length).toBe(mov.length);
        expect(lido.reduce((t, x) => t + x.valor, 0)).toBe(mov.reduce((t, x) => t + x.valor, 0));
        for (const x of lido) expect(Number.isInteger(x.valor)).toBe(true);
        const chave = (x: Mov) => x.data + '|' + x.valor + '|' + x.historico;
        expect(lido.map(chave).sort()).toEqual(mov.map(chave).sort());
      }
    });
  }

  it('linhas de saldo e total não viram lançamento', () => {
    for (const hist of ['SALDO ANTERIOR', 'Saldo inicial', 'SALDO FINAL', 'Total do dia', 'SALDO DO DIA', 'Saldo do dia', 'SALDO ATUAL']) {
      const l = lancamentosDaPlanilha([['Data', 'Histórico', 'Valor'], ['05/01/2026', 'TARIFA', '-10,00'], ['05/01/2026', hist, '5.000,00']], 'banco', 2026).lancamentos;
      expect(l.map(x => x.valor), hist).toEqual([-1000]);
    }
  });
  it('a coluna "Tipo" com o nome da operação não decide o sinal (Depósito não é débito, Cartão não é crédito)', () => {
    const l = lancamentosDaPlanilha([['Data', 'Histórico', 'Valor', 'Tipo'],
      ['05/01/2026', 'DEPOSITO', '100,00', 'Depósito'], ['05/01/2026', 'CARTAO', '-30,00', 'Cartão'], ['05/01/2026', 'TARIFA', '10,00', 'D'], ['05/01/2026', 'PIX', '20,00', 'Crédito'], ['05/01/2026', 'BOLETO', '40,00', 'Débito automático'], ['05/01/2026', 'TED', '50,00', 'C - Crédito']], 'banco', 2026).lancamentos;
    expect(l.map(x => x.valor)).toEqual([10000, -3000, -1000, 2000, -4000, 5000]);
  });
  it('"Valor do lançamento" é a coluna do valor em qualquer posição', () => {
    for (const linhas of [
      [['Data', 'Valor do lançamento', 'Histórico'], ['05/01/2026', '-10,00', 'TARIFA']],
      [['Data', 'Histórico', 'Valor do lançamento'], ['05/01/2026', 'TARIFA', '-10,00']],
    ]) expect(lancamentosDaPlanilha(linhas, 'banco', 2026).lancamentos).toEqual([{ data: '2026-01-05', valor: -1000, historico: 'TARIFA' }]);
  });
  it('sem cabeçalho: o número do documento não vira o valor', () => {
    const linhas = Array.from({ length: 12 }, (_, i) => ['0' + (i % 9 + 1) + '/01/2026', String(556000 + i * 37), 'PAGAMENTO FORNECEDOR ' + i, br(1050 + i * 13), br(90000 + i)]);
    const l = lancamentosDaPlanilha(linhas, 'banco', 2026).lancamentos;
    expect(l.map(x => x.valor)).toEqual(linhas.map((_, i) => 1050 + i * 13));
  });
  it('sem cabeçalho e sem documento: a primeira coluna de valor continua valendo', () => {
    const l = lancamentosDaPlanilha([['05/01/2026', 'TARIFA', '-10,00', '990,00'], ['06/01/2026', 'PIX', '20,00', '1.010,00']], 'banco', 2026).lancamentos;
    expect(l.map(x => x.valor)).toEqual([-1000, 2000]);
  });
});

describe('OFX: formatos do valor, CRLF, bloco sem fechar', () => {
  const ofx = (linhas: string[], saldo?: string) => 'OFXHEADER:100\r\n<OFX><BANKTRANLIST>\r\n' + linhas.join('\r\n') + '\r\n</BANKTRANLIST>' + (saldo ? '<LEDGERBAL><BALAMT>' + saldo + '<DTASOF>20260131</LEDGERBAL>' : '') + '</OFX>';
  const bloco = (d: string, v: string, memo: string, fecha = true) => '<STMTTRN><TRNTYPE>OTHER<DTPOSTED>' + d + '<TRNAMT>' + v + '<MEMO>' + memo + (fecha ? '</STMTTRN>' : '');
  it('todas as escritas do valor', () => {
    for (const c of maisValores(5, 200)) {
      for (const f of [ponto, semMilhar, americano, br]) {
        const [a] = lancamentosDoOfx(ofx([bloco('20260105120000[-3:BRT]', '-' + f(c), 'X')]));
        expect(a.valor, f(c)).toBe(-c);
        const [b] = lancamentosDoOfx(ofx([bloco('20260105', f(c), 'X', false)]));
        expect(b.valor, f(c)).toBe(c);
      }
    }
  });
  it('o padrão do OFX continua: o ponto é decimal, com uma, duas ou três casas', () => {
    expect(lancamentosDoOfx(ofx([bloco('20260105', '-1234.5', 'X'), bloco('20260105', '123.456', 'Y'), bloco('20260105', '100', 'Z')])).map(l => l.valor)).toEqual([-123450, 12346, 10000]);
  });
  it('data que não existe fica de fora, valor zero também', () => {
    expect(lancamentosDoOfx(ofx([bloco('20260231', '-1.00', 'X'), bloco('20260105', '0.00', 'Y'), bloco('20260106', '2.00', 'Z')])).map(l => l.data)).toEqual(['2026-01-06']);
  });
  it('o saldo anterior é o saldo final menos o movimento, em qualquer escrita', () => {
    for (const s of ['1234.56', '1.234,56', '1234,56', '1,234.56']) {
      const t = ofx([bloco('20260105', '-10.00', 'X'), bloco('20260106', '4.56', 'Y')], s);
      expect(saldoAnteriorDoOfx(t, lancamentosDoOfx(t)), s).toBe(123456 + 1000 - 456);
    }
  });
});

describe('PDF gerado: layouts, ordem, virada de mês e de ano', () => {
  type Mov = { dia: string; valor: number; historico: string };
  const pagina = (linhas: [string, number][][]): ItemDeTexto[] => linhas.flatMap((l, i) => l.map(([texto, x]) => ({ texto, x, y: 800 - i * 14, largura: texto.length * 5 })));
  function movimento(semente: number, dias: string[], qtd = 30): Mov[] {
    const r = sorteador(semente);
    return Array.from({ length: qtd }, (_, i) => { const c = 1 + r.ate(10 ** (1 + r.ate(8))); return { dia: dias[Math.min(dias.length - 1, Math.floor(i * dias.length / qtd))], valor: r.n() < 0.5 ? c : -c, historico: 'OPERACAO TESTE ' + i }; });
  }
  const iso = (d: string) => d.slice(6) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);
  const sinal = (v: number, f: string) => (f === 'D/C' ? br(Math.abs(v)) + (v < 0 ? ' D' : ' C') : f === 'colado' ? br(Math.abs(v)) + (v < 0 ? 'D' : 'C') : f === 'menos' ? (v < 0 ? '-' : '') + br(Math.abs(v)) : f === 'tipografico' ? (v < 0 ? '−' : '') + br(Math.abs(v)) : (v < 0 ? '-' : '') + 'R$' + br(Math.abs(v)));

  for (const f of ['D/C', 'colado', 'menos', 'tipografico', 'R$']) it('valor e saldo com sinal "' + f + '": a soma fecha com o saldo', () => {
    for (let semente = 1; semente <= 30; semente++) {
      const dias = ['30/01/2026', '02/02/2026', '03/02/2026', '27/02/2026', '28/02/2026'];
      const mov = movimento(semente, dias);
      let saldo = semente % 3 === 0 ? -semente * 1234 : semente * 5678;
      const abertura = saldo;
      const linhas: [string, number][][] = [[['Data', 40], ['Histórico', 100], ['Valor', 380], ['Saldo', 480]], [['SALDO ANTERIOR', 100], [sinal(saldo, f), 480]]];
      let ant = '';
      for (const m of mov) {
        saldo += m.valor;
        linhas.push([...(m.dia !== ant ? [[m.dia, 40] as [string, number]] : []), [m.historico, 100], [sinal(m.valor, f), 380], [sinal(saldo, f), 480]]);
        ant = m.dia;
      }
      const p = pagina(linhas);
      const r = extratoDoPdf([p], 'banco', 2026);
      expect(r.lancamentos.map(l => [l.data, l.valor]), 'semente ' + semente).toEqual(mov.map(m => [iso(m.dia), m.valor]));
      expect(saldoAnteriorDoPdf([p])).toBe(abertura);
    }
  });

  it('extrato do mais novo para o mais velho: a soma é a mesma', () => {
    for (let semente = 1; semente <= 20; semente++) {
      const mov = movimento(semente, ['27/02/2026', '26/02/2026', '25/02/2026', '02/02/2026'], 20);
      let saldo = 100000000;
      const linhas: [string, number][][] = [[['Data', 40], ['Histórico', 100], ['Valor', 380], ['Saldo', 480]]];
      for (const m of mov) { linhas.push([[m.dia, 40], [m.historico, 100], [(m.valor < 0 ? '-' : '') + br(Math.abs(m.valor)), 380], [br(saldo), 480]]); saldo -= m.valor; }
      const r = extratoDoPdf([pagina(linhas)], 'banco', 2026);
      expect(r.lancamentos.reduce((t, l) => t + l.valor, 0)).toBe(mov.reduce((t, m) => t + m.valor, 0));
      expect(r.lancamentos.length).toBe(mov.length);
    }
  });

  it('29/02 e meses de 30 dias existem; 30/02 não abre dia', () => {
    const p = pagina([
      [['Data', 40], ['Histórico', 100], ['Valor', 380]],
      [['29/02/2024', 40], ['A', 100], ['-1,00', 380]],
      [['30/04/2024', 40], ['B', 100], ['-2,00', 380]],
      [['30/02/2024', 40], ['C', 100], ['-3,00', 380]],
    ]);
    expect(extratoDoPdf([p], 'banco', 2024).lancamentos.map(l => l.data)).toEqual(['2024-02-29', '2024-04-30', '2024-04-30']);
  });

  const lanc = (d: string, h: string, v: string, s: string): [string, number][] => [[d, 40], [h, 100], [v, 380], [s, 480]];
  const cab: [string, number][] = [['Data', 40], ['Histórico', 100], ['Valor', 380], ['Saldo', 480]];
  const datas = (p: ItemDeTexto[]) => extratoDoPdf([p], 'banco', 2026).lancamentos.map(l => l.data);

  it('virada do ano com a data sem o ano: janeiro traz 31/12 (do ano de antes), e não dezembro do ano que vem', () => {
    expect(datas(pagina([[['Período:', 40], ['01/01/2026', 100], ['a', 170], ['31/01/2026', 190]], cab,
      lanc('31/12', 'PIX RECEBIDO', '10,00', '110,00'), lanc('02/01', 'TARIFA', '-5,00', '105,00'), lanc('05/01', 'PIX', '3,00', '108,00')]))).toEqual(['2025-12-31', '2026-01-02', '2026-01-05']);
  });
  it('dezembro emitido em janeiro, com a data sem o ano: fica em dezembro do ano de antes', () => {
    expect(datas(pagina([[['Emitido', 40], ['em', 80], ['05/01/2026', 100]], cab,
      lanc('02/12', 'TARIFA', '-5,00', '95,00'), lanc('30/12', 'PIX', '3,00', '98,00')]))).toEqual(['2025-12-02', '2025-12-30']);
  });
  it('dezembro e janeiro no mesmo extrato, com mais datas de dezembro no texto: janeiro fica no ano seguinte', () => {
    expect(datas(pagina([[['Período', 40], ['15/12/2025', 100], ['a', 170], ['15/01/2026', 190], ['Conta', 260], ['01/12/2025', 300], ['10/12/2025', 370]], cab,
      lanc('20/12', 'PIX', '3,00', '98,00'), lanc('02/01', 'TARIFA', '-5,00', '93,00')]))).toEqual(['2025-12-20', '2026-01-02']);
  });
  it('sem nenhuma data completa, dezembro e janeiro juntos: dezembro é do ano de antes', () => {
    expect(datas(pagina([cab, lanc('30/12', 'PIX', '3,00', '98,00'), lanc('02/01', 'TARIFA', '-5,00', '93,00')]))).toEqual(['2025-12-30', '2026-01-02']);
  });
  it('agosto com a data sem o ano e um contrato de janeiro no texto: continua em agosto do mesmo ano', () => {
    expect(datas(pagina([[['Contrato', 40], ['15/01/2026', 100]], cab, lanc('10/08', 'PIX', '3,00', '98,00')]))).toEqual(['2026-08-10']);
  });
  it('dezembro com a emissão também em dezembro: fica no mesmo ano', () => {
    expect(datas(pagina([[['Emitido', 40], ['em', 80], ['31/12/2026', 100]], cab, lanc('02/12', 'TARIFA', '-5,00', '95,00')]))).toEqual(['2026-12-02']);
  });
  it('a data com o ano escrito não é mexida', () => {
    expect(datas(pagina([[['Emitido', 40], ['em', 80], ['05/01/2026', 100]], cab, lanc('30/12/2026', 'PIX', '3,00', '98,00')]))).toEqual(['2026-12-30']);
  });
  it('janeiro a dezembro sem data completa é um ano só: novembro e dezembro não voltam um ano', () => {
    const linhas = Array.from({ length: 12 }, (_, m) => lanc('10/' + String(m + 1).padStart(2, '0'), 'PIX ' + m, '-1,00', '10,00'));
    expect(new Set(datas(pagina([cab, ...linhas])).map(d => d.slice(0, 4)))).toEqual(new Set(['2026']));
  });
  it('fevereiro, junho e novembro sem data completa: novembro fica no mesmo ano', () => {
    expect(datas(pagina([cab, lanc('10/02', 'PIX A', '-1,00', '10,00'), lanc('10/06', 'PIX B', '-1,00', '9,00'), lanc('10/11', 'PIX C', '-1,00', '8,00')])))
      .toEqual(['2026-02-10', '2026-06-10', '2026-11-10']);
  });
  it('dezembro com um vencimento distante no texto: o vencimento não decide o ano', () => {
    expect(datas(pagina([[['Emitido', 40], ['10/12/2026', 100]], [['Periodo', 40], ['01/12/2026', 100]], cab, lanc('05/12', 'PIX A', '-1,00', '10,00'), lanc('15/12', 'PIX B', '-1,00', '9,00'), [['Contrato', 40], ['15/02/2030', 100]]])))
      .toEqual(['2026-12-05', '2026-12-15']);
  });
  it('novembro com a emissão lida errado pelo OCR: fica no ano do extrato', () => {
    expect(datas(pagina([[['Emitido', 40], ['10/02/2028', 100]], [['Periodo', 40], ['01/11/2026', 100]], [['Fim', 40], ['30/11/2026', 100]], [['Conta', 40], ['01/11/2026', 100]], cab, lanc('05/11', 'PIX A', '-1,00', '10,00')])))
      .toEqual(['2026-11-05']);
  });
});

describe('o que o leitor aceitava e não pode perder', () => {
  const uma = (dc: unknown, lado: 'banco' | 'sistema', cab = 'D/C', valor: unknown = 100) =>
    lancamentosDaPlanilha([['Data', 'Histórico', 'Valor', cab], ['05/10/2026', 'PIX', valor, dc]], lado, 2026).lancamentos.map(l => l.valor);
  it.each(['D', 'DB', 'Db', 'DR', 'Débito', 'DEB', 'Devedor', 'Devedora'])('"%s" na coluna D/C é débito', dc => {
    expect(uma(dc, 'banco')).toEqual([-10000]);
    expect(uma(dc, 'sistema')).toEqual([10000]);
  });
  it.each(['C', 'CR', 'Cr', 'Crédito', 'CRED', 'Credor', 'Credora'])('"%s" na coluna D/C é crédito', dc => {
    expect(uma(dc, 'banco')).toEqual([10000]);
    expect(uma(dc, 'sistema')).toEqual([-10000]);
  });
  it.each([['Depósito', '100,00', 10000], ['Compra', '-100,00', -10000], ['Cartão', '-50,00', -5000], ['Cheque', '-20,00', -2000]])('"%s" na coluna Tipo é o nome da operação: o sinal é o do valor', (tipo, valor, esperado) => {
    expect(uma(tipo, 'banco', 'Tipo', valor)).toEqual([esperado]);
  });

  const LINHAS: Celula[][] = [
    ['05/10/2026', 'PIX RECEBIDO FULANO', -100, 900.5], ['06/10/2026', 'PIX ENVIADO BELTRANO', -200, 700.5],
    ['07/10/2026', 'TED RECEBIDA SICRANO', 300, 1000.5], ['08/10/2026', 'BOLETO ENERGIA', -50.25, 950.25],
  ];
  it('sem cabeçalho, o valor em quantias redondas não perde para o Saldo com centavos', () => {
    expect(lancamentosDaPlanilha(LINHAS, 'banco', 2026).lancamentos.map(l => l.valor)).toEqual([-10000, -20000, 30000, -5025]);
    expect(lancamentosDaPlanilha(LINHAS.map(l => l.map(String)), 'banco', 2026).lancamentos.map(l => l.valor)).toEqual([-10000, -20000, 30000, -5025]);
  });
  it('sem cabeçalho, o número do documento continua não sendo o valor', () => {
    const l = [['05/10/2026', '556000', 'PIX RECEBIDO FULANO', '10,50', '100,00'], ['06/10/2026', '556001', 'PIX ENVIADO BELTRANO', '20,50', '120,50']];
    expect(lancamentosDaPlanilha(l, 'banco', 2026).lancamentos.map(x => x.valor)).toEqual([1050, 2050]);
  });

  const ofx = (v: string) => '<OFX><STMTTRN><DTPOSTED>20261005<TRNAMT>' + v + '<MEMO>x</STMTTRN>';
  it.each([['-.50', -50], ['.50', 50], ['+.50', 50], ['-1234.56', -123456], ['1.234,56', 123456]])('OFX %s', (v, c) => {
    expect(lancamentosDoOfx(ofx(v)).map(l => l.valor)).toEqual([c]);
  });
  it('OFX: o saldo sem o zero na frente', () => {
    expect(saldoAnteriorDoOfx('<OFX><LEDGERBAL><BALAMT>.50</LEDGERBAL>', [])).toBe(50);
  });

  it.each(['10,00 CR', '10,00CR', 'CR 10,00'])('"%s" é valor de crédito', v => expect(centavos(v)).toBe(1000));
  it.each(['CD 123', '1-2', '01-02-2026'])('"%s" continua não sendo valor', v => expect(centavos(v)).toBeNull());
});
