// Rodada 2 dos formatos compartilhados: laços combinatórios (separador × sinal × espaço × tipo; datas nos limites), semente fixa e
// dados inventados. O que está aqui é contrato: quem mudar um formato vê o que muda para todos os aplicativos.
import { describe, expect, it } from 'vitest';
import {
  brl, comp, dataOrdem, diaEmBrasilia, docLimpo, lancComZeros, lancN, mascaraData, mascaraDocumento, mesCurto, MES, nomeNorm, normalizarTexto,
  normExportado, num, numeroDigitado, reais, rot, slug,
} from './index';
import { credoraPelaNatureza, dinamicoInvertido, dinamicoPelaNatureza, sinalDoDinamico } from './sinalDoDinamico';

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

const NBSP = '\u00a0';
const agrupar = (inteiro: string, sep: string) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const partes = (c: number) => ({ i: String(Math.floor(c / 100)), d: String(c % 100).padStart(2, '0') });
const FORMATOS: [string, (c: number) => string][] = [
  ['brasileiro', c => { const { i, d } = partes(c); return agrupar(i, '.') + ',' + d; }],
  ['vírgula sem milhar', c => { const { i, d } = partes(c); return i + ',' + d; }],
  ['americano', c => { const { i, d } = partes(c); return agrupar(i, ',') + '.' + d; }],
  ['ponto sem milhar', c => { const { i, d } = partes(c); return i + '.' + d; }],
];

/** O texto em volta do número e o sinal que ele dá. */
const EMBRULHOS: [string, (s: string) => string, 1 | -1][] = [
  ['puro', s => s, 1],
  ['menos', s => '-' + s, -1],
  ['parênteses', s => '(' + s + ')', -1],
  ['menos e parênteses', s => '-(' + s + ')', -1],
  ['D', s => s + ' D', 1],
  ['C', s => s + ' C', 1],
  ['D colado', s => s + 'D', 1],
  ['d minúsculo', s => s + ' d', 1],
  ['c minúsculo', s => s + ' c', 1],
  ['espaços', s => '  ' + s + '  ', 1],
  ['NBSP', s => NBSP + s + NBSP, 1],
  ['D com NBSP', s => s + NBSP + 'D', 1],
  ['R$', s => 'R$ ' + s, 1],
  ['R$ colado', s => 'R$' + s, 1],
  ['R$ com NBSP', s => 'R$' + NBSP + s, 1],
  ['r$ minúsculo', s => 'r$ ' + s, 1],
  ['menos antes do R$', s => '-R$ ' + s, -1],
  ['menos depois do R$', s => 'R$ -' + s, -1],
  ['R$ dentro dos parênteses', s => '(R$ ' + s + ')', -1],
  ['R$ fora dos parênteses', s => 'R$ (' + s + ')', -1],
  ['R$ e D', s => 'R$ ' + s + ' D', 1],
];

const r = sorteador(20261110);
const CENTAVOS = [0, 1, 9, 10, 99, 100, 101, 12345, 99999, 100000, 123456, 999999, 1000000, 123456789, 100000000, 999999999, 12345678901, 100000000000,
  ...Array.from({ length: 40 }, () => Math.floor(r() * 1e12))];

describe('num: separador × sinal × espaço', () => {
  it('toda combinação dá o valor e o sinal certos', () => {
    for (const c of CENTAVOS) for (const [nomeF, f] of FORMATOS) for (const [nomeE, e, sinal] of EMBRULHOS) {
      const texto = e(f(c));
      const lido = num(texto);
      expect(lido, nomeF + ' / ' + nomeE + ': ' + texto).not.toBeNull();
      expect(Math.round((lido as number) * 100), nomeF + ' / ' + nomeE + ': ' + texto).toBe(c === 0 ? 0 : sinal * c);
    }
  });

  it('só o milhar, sem centavos: dois ou mais separadores iguais só podem ser milhar (o "1.234.567" virava 1,234)', () => {
    for (const [t, v] of [['1.234.567', 1234567], ['12.345.678', 12345678], ['1.000.000.000', 1e9], ['1,234,567', 1234567], ['-1.234.567', -1234567], ['(1.234.567)', -1234567], ['1.234.567 D', 1234567], ['R$ 1.234.567', 1234567]] as const)
      expect(num(t), t).toBe(v);
  });

  it('decisão consciente: um separador só com três casas continua decimal', () => {
    // a célula numérica do Excel chega aqui sem o milhar ("1234.5", "12.500" da máscara 0.000; arquivos/acertarCelula): o ponto é decimal,
    // e o "1,234" é a vírgula decimal do Alterdata. Ler como milhar multiplicaria por mil o que hoje está certo.
    expect(num('1.234')).toBe(1.234);
    expect(num('12.500')).toBe(12.5);
    expect(num('1,234')).toBe(1.234);
  });

  it('o que já funcionava continua igual', () => {
    for (const [t, v] of [['1.234,56', 1234.56], ['(1.234,56)', -1234.56], ['1.234,56 D', 1234.56], ['10,5 C', 10.5], ['-3', -3], ['1234.5', 1234.5], ['.5', 0.5], [',5', 0.5], ['1.234,567', 1234.567], ['1,2,3', 1.2]] as const)
      expect(num(t), t).toBe(v);
  });

  it('o que não é número dá null, de qualquer tipo', () => {
    for (const v of ['abc', 'R$', 'R$ abc', '-', '()', 'D', 'C', ' ', NBSP, '', '1.234,56 X', '12 34', '10%', '10 R$', null, undefined, true, false, {}, [], new Date(2026, 0, 1), NaN, Infinity, -Infinity])
      expect(num(v), String(v)).toBeNull();
  });

  it('número já é número (o serial do Excel também passa)', () => {
    for (const v of [0, 1.5, -1.5, 46208, 1e12]) expect(num(v)).toBe(v);
  });
});

describe('brl e reais', () => {
  const manual = (c: number) => { const { i, d } = partes(c); return agrupar(i, '.') + ',' + d; };

  it('todo valor em centavos, positivo e negativo', () => {
    for (const c of CENTAVOS) {
      expect(brl(c / 100), String(c)).toBe(manual(c));
      if (c) expect(brl(-c / 100), String(-c)).toBe('-' + manual(c));
    }
  });

  it('o que arredonda para zero não sai negativo', () => {
    for (const n of [-0, -0.001, -0.004, -0.0049, -1e-9]) {
      expect(brl(n), String(n)).toBe('0,00');
      expect(reais(n), String(n)).toBe('R$' + NBSP + '0,00');
    }
    expect(brl(0)).toBe('0,00');
  });

  it('o negativo de verdade continua negativo', () => {
    expect(brl(-0.01)).toBe('-0,01');
    expect(brl(-0.006)).toBe('-0,01');
    expect(reais(-0.01)).toBe('−R$' + NBSP + '0,01');
    expect(reais(-1234.5)).toBe('−R$' + NBSP + '1.234,50');
    expect(reais(1234.5)).toBe('R$' + NBSP + '1.234,50');
  });

  it('num lê de volta o que brl escreve', () => {
    for (const c of CENTAVOS) expect(Math.round((num(brl(c / 100)) as number) * 100), String(c)).toBe(c);
  });
});

describe('comp e dataOrdem', () => {
  const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const diasDoMes = (m: number, a: number) => [31, ehBissexto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const dois = (n: number) => String(n).padStart(2, '0');

  it('todo dia de 2023 a 2029, em toda máscara: a competência certa e a ordem crescente', () => {
    let anterior = 0;
    for (let a = 2023; a <= 2029; a++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= diasDoMes(m, a); d++) {
      const esperado = a + '-' + dois(m);
      const ordem = a * 10000 + m * 100 + d;
      const mascaras = [`${dois(d)}/${dois(m)}/${a}`, `${d}/${m}/${a}`, `${dois(d)}-${dois(m)}-${a}`, `${dois(d)}/${dois(m)}/${String(a).slice(2)}`, `${d}-${m}-${String(a).slice(2)}`, `${dois(d)}/${dois(m)}/${a} 10:30:00`];
      for (const t of mascaras) {
        expect(comp(t), t).toBe(esperado);
        expect(dataOrdem(t), t).toBe(ordem);
      }
      expect(ordem).toBeGreaterThan(anterior);
      anterior = ordem;
    }
  });

  it('mês que não existe não vira competência (o "05/13/2026" dava 2026-13)', () => {
    for (const t of ['05/13/2026', '05-13-2026', '5/13/26', '01/00/2026', '31/99/2026']) expect(comp(t), t).toBe('');
    for (let m = 1; m <= 12; m++) expect(comp('15/' + dois(m) + '/2026')).toBe('2026-' + dois(m));
  });

  it('o que não é data: vazio e zero', () => {
    for (const t of ['', null, undefined, 'x', '2026', '05/2026']) {
      expect(comp(t), String(t)).toBe('');
      expect(dataOrdem(t), String(t)).toBe(0);
    }
  });

  it('competência e rótulo em todos os meses', () => {
    for (let m = 1; m <= 12; m++) {
      const c = '2026-' + dois(m);
      expect(rot(c)).toBe(MES[m] + ' de 2026');
      expect(mesCurto(c)).toBe(MES[m].slice(0, 3) + '/26');
    }
  });
});

describe('numeroDigitado', () => {
  it('o que a pessoa digita, em toda forma', () => {
    for (const c of CENTAVOS) {
      const { i, d } = partes(c);
      expect(numeroDigitado(agrupar(i, '.') + ',' + d), 'br ' + c).toBe(c / 100);
      expect(numeroDigitado(i + ',' + d), 'vírgula ' + c).toBe(c / 100);
      expect(numeroDigitado(i + '.' + d), 'ponto ' + c).toBe(c / 100);
      expect(numeroDigitado('R$ ' + agrupar(i, '.') + ',' + d), 'R$ ' + c).toBe(c / 100);
      expect(numeroDigitado(agrupar(i, ',') + '.' + d), 'americano ' + c).toBe(c / 100);
    }
  });

  it('o milhar e o sinal continuam como eram', () => {
    for (const [t, v] of [['1.234', 1234], ['1.234.567', 1234567], ['1234.5', 1234.5], ['1234,5', 1234.5], ['-10', -10], ['+10', 10], ['R$ -10', -10], ['1 000', 1000], [' 10 ', 10], ['0.125', 0.125], ['0.500', 0.5], ['-0.125', -0.125]] as const)
      expect(numeroDigitado(t), t).toBe(v);
  });

  it('o que não é número dá null (o "1e5" virava 100.000 e o "." virava zero)', () => {
    for (const t of ['', ' ', '.', ',', '-', '..', '.,', 'abc', '1e5', '1E5', '0x10', '0b11', 'Infinity', 'NaN', '1e400', '10%', '(10)']) expect(numeroDigitado(t), t).toBeNull();
  });
});

describe('os outros formatos', () => {
  const rr = sorteador(7);
  const textos = Array.from({ length: 200 }, () => Array.from({ length: 1 + Math.floor(rr() * 30) }, () => 'aãÁ çÇ-_.,/ 019Zé\u00a0&'.charAt(Math.floor(rr() * 20))).join(''));

  it('nomeNorm, normalizarTexto e slug: só o permitido, e repetir não muda', () => {
    for (const t of textos) {
      for (const f of [nomeNorm, normalizarTexto]) {
        expect(f(t), t).toMatch(/^[a-z0-9]*( [a-z0-9]+)*$/);
        expect(f(f(t)), t).toBe(f(t));
      }
      expect(slug(t), t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slug(slug(t)), t).toBe(slug(t));
    }
    expect(nomeNorm('  São  João-ME ')).toBe('sao joao me');
    expect(slug('')).toBe('empresa');
  });

  it('lancN: máscara não muda o lançamento', () => {
    for (let i = 0; i < 300; i++) {
      const n = String(i * 37);
      for (const t of [n, '000' + n, n + '.0', '  ' + n + ' ', '00' + n + '.0']) expect(lancN(t), t).toBe(n);
      expect(lancN(Number(n))).toBe(n);
      expect(lancN(lancComZeros(n, '00000000'))).toBe(n);
    }
    expect(lancN(null)).toBe('');
    expect(lancN('A01')).toBe('A01');
  });

  it('lancComZeros: só completa quando o modelo tem zero na frente', () => {
    expect(lancComZeros('182', '00006')).toBe('00182');
    expect(lancComZeros('182', '10006')).toBe('182');
    expect(lancComZeros('123456', '00006')).toBe('123456');
    expect(lancComZeros('A1', '00006')).toBe('A1');
    expect(lancComZeros(null, null)).toBe('');
  });

  it('docLimpo: com ou sem máscara, e zero é vazio', () => {
    for (const [t, v] of [['11.222.333/0001-81', '11222333000181'], ['111.444.777-35', '11144477735'], ['000.000.000-00', ''], ['0', ''], ['', ''], [null, ''], ['ab-12', 'AB12']] as const) expect(docLimpo(t), String(t)).toBe(v);
  });

  it('normExportado', () => {
    for (const [t, v] of [['Sim', 'Sim'], ['S', 'Sim'], [' s ', 'Sim'], ['SIM', 'Sim'], ['Não', 'Não'], ['NAO', 'Não'], ['n', 'Não'], ['', ''], [null, ''], ['talvez', '']] as const) expect(normExportado(t), String(t)).toBe(v);
  });

  it('máscaras: só números, no máximo do tamanho, e passar de novo não muda', () => {
    for (let i = 0; i < 500; i++) {
      const dig = Array.from({ length: Math.floor(rr() * 20) }, () => String(Math.floor(rr() * 10))).join('');
      const d = mascaraData(dig);
      expect(d.replace(/\D/g, '')).toBe(dig.slice(0, 8));
      expect(mascaraData(d)).toBe(d);
      const m = mascaraDocumento(dig);
      expect(m.replace(/\D/g, '')).toBe(dig.slice(0, 14));
      expect(mascaraDocumento(m)).toBe(m);
    }
  });

  it('o dia em Brasília: virada do dia às 03:00 UTC, em todo mês e na virada do ano', () => {
    for (let m = 0; m < 12; m++) {
      const dia = (d: number) => '2026-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      expect(diaEmBrasilia(new Date(Date.UTC(2026, m, 15, 2, 59, 59)))).toBe(dia(14));
      expect(diaEmBrasilia(new Date(Date.UTC(2026, m, 15, 3, 0, 0)))).toBe(dia(15));
    }
    expect(diaEmBrasilia('2027-01-01T02:59:59.000Z')).toBe('2026-12-31');
    expect(diaEmBrasilia('2024-02-29T12:00:00.000Z')).toBe('2024-02-29');
    expect(diaEmBrasilia(' 2026-09-15 ')).toBe('2026-09-15');
    expect(diaEmBrasilia(new Date('x'))).toBe('');
  });
});

describe('sinal do balancete dinâmico: jeito do arquivo × plano × contas de cima', () => {
  type Jeito = 'sempre' | 'natureza' | 'invertido';
  /** classificação, descrição e o saldo no "de sempre" (devedor +, credor −) */
  const PLANOS: [string, [string, string, number][], string][] = [
    ['receita no 3', [['1', 'ATIVO', 500], ['1.1', 'CIRCULANTE', 500], ['2', 'PASSIVO', -200], ['2.1', 'FORNECEDORES', -200], ['3', 'RECEITAS', -900], ['3.1', 'VENDAS', -900], ['4', 'CUSTOS E DESPESAS', 600], ['4.1', 'DESPESAS', 600]], '3'],
    ['receita no 4', [['1', 'ATIVO', 500], ['1.1', 'CIRCULANTE', 500], ['2', 'PASSIVO', -200], ['2.1', 'FORNECEDORES', -200], ['3', 'CUSTOS', 600], ['3.1', 'DESPESAS', 600], ['4', 'RECEITAS', -900], ['4.1', 'VENDAS', -900]], '4'],
  ];
  const noArquivo = (j: Jeito, cla: string, v: number, rec: string) => (j === 'invertido' ? -v : j === 'natureza' && credoraPelaNatureza(cla, rec) ? -v : v);

  it('todo jeito volta para o de sempre, com e sem as contas de cima', () => {
    for (const [nome, plano, rec] of PLANOS) for (const j of ['sempre', 'natureza', 'invertido'] as Jeito[]) for (const soNivel2 of [false, true]) {
      const usadas = soNivel2 ? plano.filter(([c]) => c.includes('.')) : plano;
      const descricoes = soNivel2 ? usadas.map(([c, d]) => [c, d.replace(/^VENDAS$/, 'RECEITAS DE VENDAS')] as const) : usadas;
      const linhas = usadas.map(([c, , v], i) => ({ classificacao: c, descricao: descricoes[i][1], valores: [noArquivo(j, c, v, rec)] }));
      const s = sinalDoDinamico(linhas);
      // sem a conta de cima com o nome "Receita", o grupo vem do padrão 3: o plano com receita no 4 só dá para acertar com ela
      if (soNivel2 && rec !== '3') continue;
      for (const [c, , v] of usadas) expect(noArquivo(j, c, v, rec) * s(c), nome + ' / ' + j + ' / ' + c).toBe(v);
    }
  });

  it('a ordem das linhas não muda a leitura do sinal', () => {
    const rr = sorteador(99);
    for (const [, plano, rec] of PLANOS) for (const j of ['sempre', 'natureza', 'invertido'] as Jeito[]) {
      const linhas = plano.map(([c, d, v]) => ({ classificacao: c, descricao: d, valores: [noArquivo(j, c, v, rec)] }));
      const base = [dinamicoInvertido(linhas), dinamicoPelaNatureza(linhas)];
      for (let i = 0; i < 20; i++) {
        const outra = linhas.map(l => ({ l, o: rr() })).sort((a, b) => a.o - b.o).map(x => x.l);
        expect([dinamicoInvertido(outra), dinamicoPelaNatureza(outra)]).toEqual(base);
      }
    }
  });

  it('lista vazia e tudo zerado: fica o de sempre', () => {
    expect(sinalDoDinamico([])('2.1')).toBe(1);
    expect(sinalDoDinamico([{ classificacao: '1', valores: [0] }, { classificacao: '2', valores: [0] }, { classificacao: '3', valores: [0] }])('2.1')).toBe(1);
  });
});
