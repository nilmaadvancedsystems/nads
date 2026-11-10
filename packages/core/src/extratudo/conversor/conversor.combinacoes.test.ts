// Testes combinatórios do Conversor: laços determinísticos (semente fixa), extratos fictícios nas posições do PDF de cada banco.
// Invariantes: nenhum lançamento perdido ou duplicado, sinal e centavos exatos, linhas ruins fora e o .xls com o mesmo conteúdo.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import { lancamentosDaCora, lancamentosDaInfinitePay, lancamentosDaUnicred, lancamentosDoBancoDoBrasil, lancamentosDoNubank, mesDoExtrato, nomeDaAba, nomeDoXls, planilhaDoExtrato, type LinhaConvertida } from '.';

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
const CENTAVOS = [1, 2, 7, 29, 57, 99, 100, 101, 1005, 1115, 123456, 99999, 100000, 1000001, 123456789];
const brl = (c: number) => String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(Math.abs(c) % 100).padStart(2, '0');
const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });
interface Mov { dia: string; c: number; nome: string }
const NOMES = ['FULANO DE TAL', 'SALDO FORTE COMERCIO', 'MERCADO SALDO BOM', 'JOÃO DA SILVA', 'EMPRESA, VÍRGULA LTDA', 'O SALDO DO MES ME'];
const movimentos = (r: Sorte, n: number, mes = '09/2026'): Mov[] => {
  // do dia mais velho para o mais novo
  const dias = Array.from({ length: n }, () => entre(r, 1, 28)).sort((a, b) => a - b);
  return dias.map(d => ({ dia: String(d).padStart(2, '0') + '/' + mes, c: (r() < 0.5 ? -1 : 1) * um(r, CENTAVOS), nome: um(r, NOMES) }));
};
const iso = (d: string) => d.slice(6) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);

describe('cada banco: nenhum lançamento perdido, sinal e centavos exatos', () => {
  it('Cora: mesmo com "saldo" no nome da contraparte', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed);
      const movs = movimentos(r, entre(r, 1, 20));
      // a Cora vem do dia mais novo para o mais velho, com o resumo no topo e a linha do dia
      const dias = [...new Set(movs.map(m => m.dia))].reverse();
      let y = 780;
      const itens: ItemDeTexto[] = [t('Cora SCFI', 34, 800), t('Saldo inicial disponível', 30, 790), t('R$ 1.000,00', 501, 790)];
      for (const d of dias) {
        y -= 12; itens.push(t(d, 30, y), t('Saldo do dia', 430, y), t('R$ 5,00', 501, y));
        for (const m of movs.filter(x => x.dia === d).reverse()) { y -= 12; itens.push(t('Transf Pix', 54, y), t(m.nome, 219, y), t((m.c < 0 ? '- ' : '+ ') + 'R$ ' + brl(m.c), 500, y)); }
      }
      expect(lancamentosDaCora([itens])).toEqual(movs.map(m => ({ data: iso(m.dia), valor: m.c, historico: 'Transf Pix ' + m.nome })));
    }
  });

  it('Banco do Brasil: o sinal ao lado; a linha de saldo fica de fora', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 3);
      const movs = movimentos(r, entre(r, 1, 20));
      let y = 780;
      const itens: ItemDeTexto[] = [t('Dia', 30, y), t('Lote', 99, y), t('Documento', 148, y), t('Histórico', 265, y), t('Valor', 550, y)];
      y -= 20; itens.push(t('31/08/2026', 30, y), t('1', 99, y), t('Saldo Anterior', 265, y), t('10,00', 530, y), t('(+)', 562, y));
      for (const m of movs) { y -= 20; itens.push(t(m.dia, 30, y), t('13105', 99, y), t('Pix - ' + m.nome, 265, y), t(brl(m.c), 530, y), t(m.c < 0 ? '(-)' : '(+)', 562, y)); }
      expect(lancamentosDoBancoDoBrasil([itens]).map(l => [l.data, l.valor])).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });

  it('Unicred: o "-" solto ou grudado', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 5);
      const movs = movimentos(r, entre(r, 1, 20));
      const grudado = r() < 0.5;
      let y = 780;
      const itens: ItemDeTexto[] = [t('Data', 21, y), t('Lançamentos', 91, y), t('Valor', 396, y), t('(R$)', 424, y), t('Saldo', 514, y), t('(R$)', 543, y)];
      for (const m of movs) {
        y -= 25;
        itens.push(t(m.dia, 21, y), t(m.nome, 91, y));
        if (m.c < 0 && !grudado) itens.push(t('-', 382, y));
        itens.push(t((m.c < 0 && grudado ? '-' : '') + brl(m.c), 392, y), t('600,00', 509, y));
      }
      expect(lancamentosDaUnicred([itens]).map(l => [l.data, l.valor])).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });

  it('InfinitePay: a data só na primeira linha do dia; o sinal grudado', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 7);
      const movs = movimentos(r, entre(r, 1, 20));
      let y = 780;
      const itens: ItemDeTexto[] = [t('Data', 13, y), t('Hora', 97, y), t('Tipo', 164, y), t('Nome', 299, y), t('Detalhe', 568, y), t('Valor', 788, y)];
      let antes = '';
      for (const m of movs) {
        y -= 25;
        if (m.dia !== antes) { itens.push(t(m.dia.slice(0, 2), 13, y), t('Set,', 30, y), t('2026', 55, y)); antes = m.dia; }
        itens.push(t('15:12', 97, y), t('Pix', 164, y), t(m.nome, 299, y), t('Enviado', 568, y), t((m.c < 0 ? '-' : '+') + brl(m.c), 796, y));
      }
      expect(lancamentosDaInfinitePay([itens]).map(l => [l.data, l.valor])).toEqual(movs.map(m => [iso(m.dia), m.c]));
    }
  });

  it('Nubank: entrada ou saída pelo total de cima; a data vira a cada dia', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = semente(seed * 11);
      const movs = movimentos(r, entre(r, 1, 20));
      let y = 780;
      const itens: ItemDeTexto[] = [t('VALORES EM R$', 469, y)];
      const esperado: LinhaConvertida[] = [];
      for (const d of [...new Set(movs.map(m => m.dia))]) {
        const entradas = movs.filter(m => m.dia === d && m.c > 0), saidas = movs.filter(m => m.dia === d && m.c < 0);
        y -= 20;
        const dia = d.slice(0, 2) + ' SET 2026';
        itens.push(t(dia, 58, y), t(entradas.length ? 'Total de entradas' : 'Total de saídas', 120, y), t('1,00', 494, y));
        for (const m of entradas) { y -= 20; itens.push(t('Transferência recebida', 120, y), t(m.nome, 259, y), t(brl(m.c), 505, y)); esperado.push({ data: iso(m.dia), valor: m.c, historico: 'Transferência recebida ' + m.nome }); }
        if (entradas.length && saidas.length) { y -= 20; itens.push(t('Total de saídas', 120, y), t('1,00', 496, y)); }
        for (const m of saidas) { y -= 20; itens.push(t('Pagamento efetuado', 120, y), t(m.nome, 259, y), t(brl(m.c), 505, y)); esperado.push({ data: iso(m.dia), valor: m.c, historico: 'Pagamento efetuado ' + m.nome }); }
        y -= 20; itens.push(t('Saldo do dia', 120, y), t('5,00', 505, y));
      }
      expect(lancamentosDoNubank([itens]).map(l => [l.data, l.valor])).toEqual(esperado.map(l => [l.data, l.valor]));
    }
  });
});

describe('o .xls do conversor', () => {
  it('ida e volta: as mesmas linhas, data em texto, centavos exatos, acentos e símbolos', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = semente(seed * 13);
      const linhas: LinhaConvertida[] = movimentos(r, entre(r, 1, 300)).map(m => ({ data: iso(m.dia), valor: m.c, historico: m.nome + ' ' + um(r, ['•••.015.386-••', 'Ação & Cia', '€ teste', '"aspas" ; vírgula']) }));
      const wb = XLSX.read(planilhaDoExtrato('Banco: do/Brasil', linhas), { type: 'array' });
      expect(wb.SheetNames).toEqual(['Banco do Brasil']);
      const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
      expect(m.length).toBe(linhas.length + 1);
      m.slice(1).forEach((l, i) => {
        expect(l[0]).toBe(linhas[i].data.slice(8) + '/' + linhas[i].data.slice(5, 7) + '/' + linhas[i].data.slice(0, 4));
        expect(Math.round((l[1] as number) * 100)).toBe(linhas[i].valor);
        expect(l[2]).toBe(linhas[i].historico);
      });
    }
  });

  it('o extrato vazio ainda abre, só com o cabeçalho', () => {
    const wb = XLSX.read(planilhaDoExtrato('', []), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Extrato']);
    expect(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Extrato, { header: 1 }).length).toBe(1);
  });

  it('o nome da aba e do arquivo', () => {
    expect(nomeDaAba('x'.repeat(40)).length).toBe(31);
    expect(nomeDoXls('Unicred', [])).toBe('BANCO UNICRED.xls');
    expect(mesDoExtrato([])).toBe('');
    expect(mesDoExtrato([{ data: '2025-12-31', valor: 1, historico: '' }, { data: '2026-01-02', valor: 1, historico: '' }, { data: '2026-01-03', valor: 1, historico: '' }])).toBe('2026-01');
  });
});
