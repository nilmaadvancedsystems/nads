// 2ª rodada do Conversor: cada banco com layouts variados (cabeçalho repetido por página, página sem cabeçalho, linhas vazias, virada de
// ano, várias páginas) e os encodings dos arquivos que não são PDF. A 1ª rodada cobriu sinal, centavos e o .xls. Extratos fictícios.
import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import { bancoDoTexto, converterArquivo, ehExtratoDaCora, ehExtratoDaInfinitePay, ehExtratoDaUnicred, ehExtratoDoBancoDoBrasil, ehExtratoDoNubank, lancamentosDaCora, lancamentosDaInfinitePay, lancamentosDaUnicred, lancamentosDoBancoDoBrasil, lancamentosDoNubank, mesDoExtrato, nomeDoXls, planilhaDoExtrato } from '.';
import * as XLSX from 'xlsx';

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
const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });
const brl = (c: number) => String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(Math.abs(c) % 100).padStart(2, '0');
const iso = (d: string) => d.slice(6) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);

interface Mov { dia: string; c: number; nome: string }
/** n movimentos em ordem crescente de data, atravessando a virada de ano (dez → jan). */
function movimentos(r: Sorte, n: number): Mov[] {
  const dias = Array.from({ length: n }, () => { const dez = r() < 0.5; const d = entre(r, 1, 28); return { k: (dez ? 0 : 100) + d, s: String(d).padStart(2, '0') + (dez ? '/12/2025' : '/01/2026') }; }).sort((a, b) => a.k - b.k);
  return dias.map((d, i) => ({ dia: d.s, c: (r() < 0.5 ? -1 : 1) * entre(r, 1, 900000), nome: 'CONTRAPARTE ' + i }));
}
/** Divide em páginas de até k movimentos. */
function porPagina<T>(xs: readonly T[], k: number): T[][] {
  const o: T[][] = [];
  for (let i = 0; i < xs.length; i += k) o.push(xs.slice(i, i + k));
  return o.length ? o : [[]];
}
const VAZIOS = (y: number) => [t('   ', 200, y), t('', 300, y)];

describe('Banco do Brasil', () => {
  const cab = (y: number) => [t('Dia', 30, y), t('Lote', 99, y), t('Documento', 148, y), t('Histórico', 265, y), t('Valor', 550, y)];
  const linha = (m: Mov, y: number) => [t(m.dia, 30, y), t('13105', 99, y), t('Pix - ' + m.nome, 265, y), t(brl(m.c), 530, y), t(m.c < 0 ? '(-)' : '(+)', 562, y)];

  it('cabeçalho em cada página, o topo da página e linhas vazias: tudo lido, nada repetido, atravessa o ano', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed);
      const movs = movimentos(r, entre(r, 1, 40));
      const paginas = porPagina(movs, entre(r, 3, 9)).map((ms, p) => {
        let y = 780;
        return [t('Extrato de Conta Corrente', 25, 803), t('Página ' + (p + 1), 500, 803), ...cab(y), ...ms.flatMap(m => { y -= 20; return [...linha(m, y), ...VAZIOS(y - 5)]; }), t('SAC 0800 000 0000', 30, 40)];
      });
      expect(ehExtratoDoBancoDoBrasil(paginas), 'seed ' + seed).toBe(true);
      expect(lancamentosDoBancoDoBrasil(paginas).map(l => [l.data, l.valor]), 'seed ' + seed).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });

  it('a página que continua sem repetir o cabeçalho também é lida; as Informações Adicionais continuam fora', () => {
    const m1: Mov = { dia: '02/01/2026', c: 1000, nome: 'A' }, m2: Mov = { dia: '03/01/2026', c: -2000, nome: 'B' };
    const p1 = [...cab(780), ...linha(m1, 760)];
    const p2 = [...linha(m2, 760), t('Informações Adicionais', 30, 700), t('10/01/2026', 30, 680), t('Limite', 265, 680), t('999,00', 530, 680), t('(+)', 562, 680)];
    expect(lancamentosDoBancoDoBrasil([p1, p2]).map(l => [l.data, l.valor])).toEqual([['2026-01-02', 1000], ['2026-01-03', -2000]]);
  });

  it('antes do primeiro cabeçalho nada entra', () => {
    const lixo = [t('10/01/2026', 30, 700), t('Comunicado', 265, 700), t('1,00', 530, 700)];
    expect(lancamentosDoBancoDoBrasil([lixo])).toEqual([]);
  });
});

describe('Cora', () => {
  const rodape = (p: number) => [t('Cora SCFI - CNPJ 00.000.000/0001-00', 34, 42), t('pág ' + p, 511, 12)];
  const pagCora = (r: Sorte, movs: Mov[]) => {
    const dias = [...new Set(movs.map(m => m.dia))].reverse();
    const blocos = dias.flatMap(d => [{ dia: d, m: null as Mov | null }, ...movs.filter(x => x.dia === d).reverse().map(m => ({ dia: d, m }))]);
    return porPagina(blocos, entre(r, 3, 9)).map((bs, p) => {
      let y = 760;
      return [...bs.flatMap(b => { y -= 14; return b.m ? [t('Transf Pix', 54, y), t(b.m.nome, 219, y), t((b.m.c < 0 ? '- ' : '+ ') + 'R$ ' + brl(b.m.c), 500, y)] : [t(b.dia, 30, y), t('Saldo do dia', 430, y), t('R$ 5,00', 501, y)]; }), ...rodape(p + 1)];
    });
  };
  it('dia que passa de página, virada de ano e rodapé: do mais velho ao mais novo', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed * 3);
      const movs = movimentos(r, entre(r, 1, 30));
      const pgs = pagCora(r, movs);
      expect(ehExtratoDaCora(pgs)).toBe(true);
      const l = lancamentosDaCora(pgs);
      expect([...l].sort((a, b) => a.data.localeCompare(b.data) || a.valor - b.valor).map(x => [x.data, x.valor])).toEqual([...movs].map(m => [iso(m.dia), m.c]).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || (a[1] as number) - (b[1] as number)));
    }
  });
  it('o resumo do topo repetido em outra página (totais de entradas e saídas) não vira lançamento', () => {
    const resumo = (y: number) => [t('Saldo inicial disponível', 30, y), t('R$ 1.000,00', 501, y), t('Total de entradas', 30, y - 14), t('+ R$ 750,00', 483, y - 14), t('Total de saídas', 30, y - 28), t('- R$ 357,35', 488, y - 28), t('Saldo final disponível', 30, y - 42), t('R$ 2,00', 501, y - 42)];
    const p1 = [...resumo(700), t('30/09/2026', 30, 600), t('Saldo do dia', 430, 600), t('R$ 5,00', 501, 600), t('Boleto pago', 54, 580), t('Luz', 219, 580), t('- R$ 10,00', 500, 580), ...rodape(1)];
    const p2 = [...resumo(780), t('29/09/2026', 30, 680), t('Saldo do dia', 430, 680), t('R$ 5,00', 501, 680), t('Pix', 54, 660), t('Ana', 219, 660), t('+ R$ 20,00', 500, 660), ...rodape(2)];
    expect(lancamentosDaCora([p1, p2]).map(l => [l.data, l.valor])).toEqual([['2026-09-29', 2000], ['2026-09-30', -1000]]);
  });
});

describe('Unicred', () => {
  const cab = (y: number) => [t('Data', 21, y), t('Lançamentos', 91, y), t('Valor', 396, y), t('(R$)', 424, y), t('Saldo', 514, y), t('(R$)', 543, y)];
  const linha = (m: Mov, y: number) => [t(m.dia, 21, y), t(m.nome, 91, y), ...(m.c < 0 ? [t('-', 382, y)] : []), t(brl(m.c), 392, y), t('600,00', 509, y)];

  it('cabeçalho em cada página, topo e linhas vazias', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed * 5);
      const movs = movimentos(r, entre(r, 1, 30));
      const pgs = porPagina(movs, entre(r, 3, 9)).map(ms => { let y = 650; return [t('Coop: 1 - AG: 1 - Conta: 1', 387, 747), ...cab(y), ...ms.flatMap(m => { y -= 25; return [...linha(m, y), ...VAZIOS(y - 8)]; })]; });
      expect(ehExtratoDaUnicred(pgs)).toBe(true);
      expect(lancamentosDaUnicred(pgs).map(l => [l.data, l.valor])).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });

  it('a página que continua sem repetir o cabeçalho é lida; o saldo final e os lançamentos futuros continuam fora', () => {
    const m1: Mov = { dia: '02/01/2026', c: 1000, nome: 'A' }, m2: Mov = { dia: '03/01/2026', c: -2000, nome: 'B' }, fut: Mov = { dia: '13/02/2026', c: -77, nome: 'FUTURO' };
    const p1 = [...cab(650), ...linha(m1, 620)];
    const p2 = [...linha(m2, 620), t('Saldo no final do período', 20, 500), t('1.100,10', 504, 500), t('Lançamentos futuros', 20, 480), ...linha(fut, 460)];
    expect(lancamentosDaUnicred([p1, p2]).map(l => [l.data, l.valor])).toEqual([['2026-01-02', 1000], ['2026-01-03', -2000]]);
  });

  it('a Saldo na mesma linha, perto do valor, não entra como o valor', () => {
    const m: Mov = { dia: '02/01/2026', c: 1000, nome: 'A' };
    const p = [...cab(650), t(m.dia, 21, 620), t(m.nome, 91, 620), t(brl(m.c), 392, 620), t('999.999,99', 480, 620)];
    expect(lancamentosDaUnicred([p]).map(l => l.valor)).toEqual([1000]);
  });
});

describe('InfinitePay', () => {
  const cab = (y: number) => [t('Data', 13, y), t('Hora', 97, y), t('Tipo', 164, y), t('Nome', 299, y), t('Detalhe', 568, y), t('Valor', 788, y)];
  const mes = (d: string) => (d.slice(3, 5) === '12' ? 'Dez,' : 'Jan,');
  it('a data numa página vale para a seguinte até mudar; com ou sem cabeçalho repetido; atravessa o ano', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed * 7);
      const movs = movimentos(r, entre(r, 1, 30));
      const repetir = r() < 0.5;
      let antes = '';
      const pgs = porPagina(movs, entre(r, 3, 9)).map((ms, p) => {
        let y = 700;
        const itens: ItemDeTexto[] = [t('CLOUDWALK', 689, 735), t('InfinitePay', 16, 740), ...(p === 0 || repetir ? cab(y) : [])];
        for (const m of ms) {
          y -= 25;
          if (m.dia !== antes) { itens.push(t(m.dia.slice(0, 2), 13, y), t(mes(m.dia), 30, y), t(m.dia.slice(6), 55, y)); antes = m.dia; }
          itens.push(t('15:12', 97, y), t('Pix', 164, y), t(m.nome, 299, y), t('Enviado', 568, y), t((m.c < 0 ? '-' : '+') + brl(m.c), 796, y), ...VAZIOS(y - 9));
        }
        return itens;
      });
      expect(ehExtratoDaInfinitePay(pgs)).toBe(true);
      expect(lancamentosDaInfinitePay(pgs).map(l => [l.data, l.valor]), 'seed ' + seed).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });
  it('a data vinda num pedaço só ("08 Set, 2026") também vale', () => {
    const p = [...cab(700), t('08 Set, 2026', 13, 675), t('15:12', 97, 675), t('Pix', 164, 675), t('ANA', 299, 675), t('Enviado', 568, 675), t('-10,00', 796, 675)];
    expect(lancamentosDaInfinitePay([p]).map(l => [l.data, l.valor])).toEqual([['2026-09-08', -1000]]);
  });
});

describe('Nubank', () => {
  const topo = (y: number) => [t('EMPRESA TESTE LTDA', 389, y + 76), t('01 DE DEZEMBRO DE 2025', 57, y), t('a', 175, y), t('31 DE JANEIRO DE 2026', 182, y), t('VALORES EM R$', 469, y)];
  it('virada de ano, entradas e saídas no mesmo dia e o dia que passa de página', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = semente(seed * 11);
      const movs = movimentos(r, entre(r, 1, 25));
      const dias = [...new Set(movs.map(m => m.dia))];
      const linhas: ((y: number) => ItemDeTexto[])[] = [];
      const esperado: [string, number][] = [];
      for (const d of dias) {
        const nome = d.slice(0, 2) + (d.slice(3, 5) === '12' ? ' DEZ 2025' : ' JAN 2026');
        const ent = movs.filter(m => m.dia === d && m.c > 0), sai = movs.filter(m => m.dia === d && m.c < 0);
        linhas.push(y => [t(nome, 58, y), t(ent.length ? 'Total de entradas' : 'Total de saídas', 120, y), t('1,00', 494, y)]);
        for (const m of ent) { linhas.push(y => [t('Transferência recebida', 120, y), t(m.nome, 259, y), t(brl(m.c), 505, y)]); esperado.push([iso(m.dia), m.c]); }
        if (ent.length && sai.length) linhas.push(y => [t('Total de saídas', 120, y), t('1,00', 496, y)]);
        for (const m of sai) { linhas.push(y => [t('Pagamento efetuado', 120, y), t(m.nome, 259, y), t(brl(m.c), 505, y)]); esperado.push([iso(m.dia), m.c]); }
        linhas.push(y => [t('Saldo do dia', 120, y), t('5,00', 505, y)]);
      }
      const pgs = porPagina(linhas, entre(r, 4, 12)).map(ls => { let y = 680; return [...topo(700), ...ls.flatMap(f => { y -= 20; return f(y); }), t('disponíveis em nubank.com.br/contatos', 57, 60)]; });
      expect(ehExtratoDoNubank(pgs)).toBe(true);
      expect(lancamentosDoNubank(pgs).map(l => [l.data, l.valor]), 'seed ' + seed).toEqual(esperado);
    }
  });
});

describe('o que não é PDF: encodings e planilhas variadas', () => {
  const latin1 = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
  const utf8 = (s: string) => new TextEncoder().encode(s);
  const utf8Bom = (s: string) => new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8(s)]);
  const utf16Bom = (s: string) => { const o = [0xFF, 0xFE]; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o.push(c & 255, c >> 8); } return new Uint8Array(o); };
  const CSV = 'Data;Histórico;Valor\r\n05/01/2026;AÇOUGUE SÃO JOSÉ;-10,50\r\n\r\n;;\r\n06/01/2026;JOÃO & FILHOS;1.000,00\r\n';

  it.each([['Windows-1252', latin1], ['UTF-8 com BOM', utf8Bom]] as [string, (s: string) => Uint8Array][])('csv em %s: os acentos e os valores chegam', async (_n, cod) => {
    const r = await converterArquivo('extrato.csv', cod(CSV), 2026);
    expect(r.erro).toBeNull();
    expect(r.linhas.map(l => [l.data, l.valor])).toEqual([['2026-01-05', -1050], ['2026-01-06', 100000]]);
    expect(r.linhas.map(l => l.historico)).toEqual(['AÇOUGUE SÃO JOSÉ', 'JOÃO & FILHOS']);
  });

  it('csv em UTF-8 sem BOM: os valores chegam', async () => {
    const r = await converterArquivo('extrato.csv', utf8(CSV), 2026);
    expect(r.erro).toBeNull();
    expect(r.linhas.map(l => [l.data, l.valor])).toEqual([['2026-01-05', -1050], ['2026-01-06', 100000]]);
  });
  it('csv em UTF-8 sem BOM: os acentos do histórico chegam', async () => {
    const r = await converterArquivo('extrato.csv', utf8(CSV), 2026);
    expect(r.linhas.map(l => l.historico)).toEqual(['AÇOUGUE SÃO JOSÉ', 'JOÃO & FILHOS']);
  });

  it('csv em UTF-16 (o "Texto Unicode" do Excel): os valores chegam', async () => {
    const r = await converterArquivo('extrato.csv', utf16Bom(CSV), 2026);
    expect(r.linhas.map(l => l.valor)).toEqual([-1050, 100000]);
  });

  const OFX = (corpo: string) => 'OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nCHARSET:1252\r\n\r\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>756</BANKACCTFROM><BANKTRANLIST>' + corpo + '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
  const trn = (d: string, v: string, m: string, id: string) => '<STMTTRN><TRNTYPE>OTHER<DTPOSTED>' + d + '<TRNAMT>' + v + '<FITID>' + id + '<MEMO>' + m + '</STMTTRN>';

  it('OFX em UTF-8: os valores chegam', async () => {
    const r = await converterArquivo('extrato_sicoob.ofx', utf8(OFX(trn('20260105', '-10.50', 'AÇOUGUE SÃO JOSÉ', '1')).replace('CHARSET:1252', 'CHARSET:UTF-8')), 2026);
    expect(r.linhas.map(l => l.valor)).toEqual([-1050]);
  });
  it('OFX em UTF-8: os acentos do histórico chegam', async () => {
    const r = await converterArquivo('extrato_sicoob.ofx', utf8(OFX(trn('20260105', '-10.50', 'AÇOUGUE SÃO JOSÉ', '1')).replace('CHARSET:1252', 'CHARSET:UTF-8')), 2026);
    expect(r.linhas.map(l => l.historico)).toEqual(['AÇOUGUE SÃO JOSÉ']);
  });

  it('OFX em Windows-1252: os acentos chegam', async () => {
    const r = await converterArquivo('extrato_sicoob.ofx', latin1(OFX(trn('20260105', '-10.50', 'AÇOUGUE SÃO JOSÉ', '1') + trn('20260106', '1000.00', 'PIX JOÃO', '2'))), 2026);
    expect(r.erro).toBeNull();
    expect(r.linhas.map(l => [l.data, l.valor, l.historico])).toEqual([['2026-01-05', -1050, 'AÇOUGUE SÃO JOSÉ'], ['2026-01-06', 100000, 'PIX JOÃO']]);
    expect(r.banco).toBe('Sicoob');
  });

  it('xlsx com linhas vazias e cabeçalho repetido', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Extrato fictício'], [], ['Data', 'Histórico', 'Valor'], ['05/01/2026', 'A', -10.5], [], ['Data', 'Histórico', 'Valor'], ['06/01/2026', 'B', 1000]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'x');
    const r = await converterArquivo('extrato.xlsx', new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 2026);
    expect(r.linhas.map(l => [l.data, l.valor])).toEqual([['2026-01-05', -1050], ['2026-01-06', 100000]]);
  });

  it('arquivo vazio ou lixo: erro, sem lançamento inventado', async () => {
    for (const bytes of [new Uint8Array(0), utf8('nada aqui'), new Uint8Array([0, 1, 2, 3, 4])]) {
      const r = await converterArquivo('x.csv', bytes, 2026);
      expect(r.linhas).toEqual([]);
      expect(r.erro).toBeTruthy();
    }
  });
});

describe('o nome e o .xls na virada de ano', () => {
  it('o mês com mais lançamentos dá o nome do arquivo; empate fica com o primeiro', () => {
    const l = (d: string) => ({ data: d, valor: 1, historico: '' });
    expect(nomeDoXls('Banco do Brasil', [l('2025-12-31'), l('2026-01-02'), l('2026-01-03')])).toBe('BANCO BRASIL 01.2026.xls');
    expect(mesDoExtrato([l('2025-12-31'), l('2026-01-02')])).toBe('2025-12');
  });
  it('o banco pelo nome do arquivo com separadores', () => {
    expect(bancoDoTexto('', 'extrato_banco-do-brasil.09.2026.pdf')).toBe('Banco do Brasil');
    expect(bancoDoTexto('', 'CORA_09_2026.pdf')).toBe('Cora');
  });
  it('a linha de valor zero e o histórico vazio não quebram o .xls', () => {
    const wb = XLSX.read(planilhaDoExtrato('Cora', [{ data: '2026-01-02', valor: 0, historico: '' }]), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Cora']);
  });
  it('o histórico maior que 255 caracteres é cortado, sem estragar o arquivo', () => {
    const wb = XLSX.read(planilhaDoExtrato('Cora', [{ data: '2026-01-02', valor: 100, historico: 'x'.repeat(400) }]), { type: 'array' });
    const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Cora, { header: 1, raw: true });
    expect(String(m[1][2]).length).toBe(255);
  });
});
