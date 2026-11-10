// Rodada 2 do Concilia aí: o que os formatos compartilhados mudam na leitura dos arquivos e na importação, e o pareamento pelo valor
// do Verificar por conta (ordem das linhas, 1:N e N:1, datas no limite). Semente fixa e dados inventados.
import { describe, expect, it } from 'vitest';
import { comp } from '../formatos';
import { conta, empresa, nota, servico } from './__legado__/fixtures';
import { lerBalancete, lerNotas, lerRazao, lerServicos, type Linhas } from './arquivos';
import { chaveNaturezaNota } from './regras/cfop';
import { mesclarServicos, mesesSemNotas, soDoPeriodo } from './regras/importacao';
import { conferirConta, type LinhaRazao } from './regras/verificarConta';
import type { NotaServico } from './tipos';

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

const VALORES: [string, number][] = [
  ['1.234,56', 1234.56], ['1234,56', 1234.56], ['R$ 1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234.567', 1234567], ['1.234.567,89', 1234567.89],
  ['-1.234,56', -1234.56], ['(1.234,56)', -1234.56], ['-R$ 10,00', -10], ['(R$ 10,00)', -10], ['\u00a010,50\u00a0', 10.5], ['1234.5', 1234.5], ['12.500', 12.5],
];

describe('lendo os arquivos: toda forma do valor', () => {
  it('notas fiscais: nenhuma linha some e o valor é o certo', () => {
    const rows: Linhas = [['CFOP', 'Número', 'Valor Contábil', 'Data'], ...VALORES.map(([v], i) => ['1102', String(i + 1), v, '05/07/2026'])];
    expect(lerNotas(rows).map(n => n.valor)).toEqual(VALORES.map(([, v]) => v));
  });

  it('serviços: nenhuma linha some e o valor é o certo', () => {
    const rows: Linhas = [['Data', 'Nr.', 'Nome do Fornecedor', 'Valor do Documento'], ...VALORES.map(([v], i) => ['05/07/2026', String(i + 1), 'X', v])];
    expect(lerServicos(rows, 'tomados').notas.map(n => n.valor)).toEqual(VALORES.map(([, v]) => v));
  });

  it('razão: o valor absoluto e o sinal', () => {
    const rows: Linhas = [['Data', 'Histórico', 'Valor'], ...VALORES.map(([v], i) => ['05/07/2026', 'Linha ' + i, v])];
    expect(lerRazao(rows).map(l => l.valor * l.sinal)).toEqual(VALORES.map(([, v]) => v));
  });

  it('balancete: a letra D/C maiúscula ou minúscula, com o saldo lido', () => {
    const linha = (cod: string, saldo: string) => ['', '', ' Conta [' + cod + ']', '', '', '', '', saldo];
    const m = lerBalancete([linha('1', '1.234,56 D'), linha('2', '1.234,56 C'), linha('3', '1.234,56 d'), linha('4', '1.234,56 c'), linha('5', 'R$ 1.234.567 C')]);
    expect(Object.values(m).map(c => [c.codigo, c.valor, c.dc])).toEqual([['1', 1234.56, 'D'], ['2', 1234.56, 'C'], ['3', 1234.56, 'D'], ['4', 1234.56, 'C'], ['5', 1234567, 'C']]);
  });
});

describe('competência que não existe na importação', () => {
  const comData = (data: string) => ({ data, comp: comp(data) });

  it('a nota com o mês impossível fica de fora do período, com aviso, como antes de o comp validar', () => {
    const r = soDoPeriodo([comData('05/07/2026'), comData('05/13/2026'), comData('5-13-26')], ['2026-07']);
    expect(r.dentro.map(n => n.data)).toEqual(['05/07/2026']);
    expect(r.fora.map(n => n.data)).toEqual(['05/13/2026', '5-13-26']);
  });

  it('a nota sem data continua dentro, e sem período fica tudo', () => {
    expect(soDoPeriodo([comData(''), comData('sem data'), { comp: '' }], ['2026-07']).dentro).toHaveLength(3);
    expect(soDoPeriodo([comData('05/13/2026')]).dentro).toHaveLength(1);
    expect(soDoPeriodo([comData('05/13/2026')], []).fora).toEqual([]);
  });

  it('não conta como mês com nota', () => {
    expect(mesesSemNotas([comData('05/13/2026')], ['2026-07'])).toEqual(['2026-07']);
  });
});

describe('reimportar serviços', () => {
  it('relatório sem a coluna de ISS não apaga o ISS guardado nem conta como atualização', () => {
    const velha: NotaServico = { ...servico('1', 'X', 100, '527'), iss: 5 };
    const semIss: NotaServico = { ...velha };
    delete semIss.iss;
    const r = mesclarServicos([velha], [semIss], 'novas');
    expect(r.notas[0].iss).toBe(5);
    expect([r.adicionadas, r.atualizadas, r.semMudanca]).toEqual([0, 0, 1]);
  });

  it('o ISS que veio no relatório continua valendo, inclusive o zero', () => {
    const velha: NotaServico = { ...servico('1', 'X', 100, '527'), iss: 5 };
    for (const iss of [7, 0]) {
      const r = mesclarServicos([velha], [{ ...velha, iss }], 'novas');
      expect(r.notas[0].iss).toBe(iss);
      expect(r.atualizadas).toBe(1);
    }
  });
});

describe('Verificar por conta: pelo valor', () => {
  const montar = (notas: [string, number, string][]) => {
    const ns = notas.map(([num, v, data]) => nota('1102', '6', v, num, { data }));
    const k = chaveNaturezaNota(ns[0]);
    return { k, e: empresa({ contas: [conta('66005', 'Conta')], entradas: ns, naturezaConta: { [k]: ['66005'] } }) };
  };
  const conferir = (m: ReturnType<typeof montar>, linhas: LinhaRazao[]) =>
    conferirConta({ empresa: m.e, contas: [m.e.contas[0]], razaoPorConta: { 66005: linhas }, cfopGrupo: m.k, servTipo: null });
  const banco = (data: string, valor: number, i = 0): LinhaRazao => ({ txt: 'Pago no banco ' + 'abcdefghij'.charAt(i), data, valor, sinal: 1, contra: '' });

  it('uma nota, várias linhas iguais: casa a mais perto, em qualquer ordem', () => {
    const m = montar([['5001', 100, '10/07/2026']]);
    const linhas = [banco('06/07/2026', 100, 0), banco('09/07/2026', 100, 1), banco('15/07/2026', 100, 2)];
    for (let s = 1; s <= 30; s++) {
      const r = conferir(m, embaralhar(linhas, sorteador(s)));
      expect(r.peloValor.map(x => x.linha.data), 'semente ' + s).toEqual(['09/07/2026']);
      expect(r.aMais, 'semente ' + s).toHaveLength(2);
    }
  });

  it('várias notas iguais × uma linha: só uma casa, a outra falta', () => {
    const m = montar([['5001', 100, '10/07/2026'], ['5002', 100, '10/07/2026']]);
    const r = conferir(m, [banco('10/07/2026', 100)]);
    expect([r.peloValor.length, r.faltando.length, r.aMais.length]).toEqual([1, 1, 0]);
  });

  it('a soma de partes (1:N) não casa pelo valor', () => {
    const m = montar([['5001', 100, '10/07/2026']]);
    const r = conferir(m, [banco('10/07/2026', 60, 0), banco('10/07/2026', 40, 1)]);
    expect([r.peloValor.length, r.faltando.length, r.aMais.length]).toEqual([0, 1, 2]);
  });

  it('listas vazias: sem linha, tudo falta; sem quebrar', () => {
    const m = montar([['5001', 100, '10/07/2026']]);
    const r = conferir(m, []);
    expect([r.faltando.length, r.peloValor.length, r.aMais.length]).toEqual([1, 0, 0]);
  });

  it('notas e linhas embaralhadas: os mesmos pares, nenhuma nota some, nenhuma linha é usada duas vezes, todo par respeita valor e prazo', () => {
    const diaDe = (d: string) => Number(d.slice(0, 2));
    for (let s = 1; s <= 300; s++) {
      const r = sorteador(s);
      const dia = () => String(1 + Math.floor(r() * 12)).padStart(2, '0') + '/07/2026';
      const valores = [100, 200];
      const notas = Array.from({ length: 2 + Math.floor(r() * 4) }, (_, i): [string, number, string] => [String(5001 + i), valores[Math.floor(r() * 2)], dia()]);
      const linhas = Array.from({ length: 1 + Math.floor(r() * 5) }, (_, i) => banco(dia(), valores[Math.floor(r() * 2)], i));
      const m = montar(notas);
      const x = conferir({ ...m, e: { ...m.e, entradas: embaralhar(m.e.entradas, r) } }, embaralhar(linhas, r));
      expect(x.peloValor.map(p => p.nota.numero + '>' + p.linha.data).sort(), 'semente ' + s).toEqual(conferir(m, linhas).peloValor.map(p => p.nota.numero + '>' + p.linha.data).sort());
      expect(x.peloValor.length + x.faltando.length, 'semente ' + s).toBe(notas.length);
      expect(new Set(x.peloValor.map(p => p.linha)).size, 'semente ' + s).toBe(x.peloValor.length);
      expect(x.peloValor.length + x.aMais.length, 'semente ' + s).toBe(linhas.length);
      for (const p of x.peloValor) {
        expect(p.linha.valor, 'semente ' + s).toBe(p.nota.valor);
        expect(Math.abs(diaDe(p.linha.data) - diaDe(p.nota.data)), 'semente ' + s).toBeLessThanOrEqual(5);
      }
    }
  });
});
