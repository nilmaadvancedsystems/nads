import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { NotaDoSieg } from './index';
import { icmsDosNcms, ratear, rateioDoCte, rateioDosNcms, temSt } from './rateio';
import { htmlDoRateio, planilhaDoRateio, relatorioDoRateio, textoDaCelula } from './rateioExportar';

const pessoa = { doc: '11111111000111', nome: 'FORNECEDOR (TESTE)' };
// a NF-e T502 e o CT-e T701 dos dados de exemplo: 600 tributado e 400 com ST, frete de 500
const t502: NotaDoSieg = {
  tipo: 'NF-e', chave: 'T4', numero: 'T502', serie: '1', data: '08/11/2026', emitente: pessoa, destinatario: pessoa, valor: 1536,
  itens: [
    { ncm: '39241000', cfop: '2102', cst: '000', cest: '', valor: 600, icms: 72 },
    { ncm: '39241000', cfop: '2403', cst: '010', cest: '', valor: 200, st: 20, ipi: 10 },
    { ncm: '69120000', cfop: '2403', cst: '010', cest: '', valor: 100, st: 6 },
    { ncm: '70134900', cfop: '2403', cst: '060', cest: '', valor: 100 },
  ],
};

function pelaTela() {
  const doCte = rateioDoCte({ valor: 500 }, [t502]);
  const iSt = doCte.grupos.findIndex(g => temSt(g.id));
  const st = icmsDosNcms(rateioDosNcms(doCte.grupos[iSt], doCte.rateio.linhas[iSt].frete, 0), { '69120000': 12 });
  return relatorioDoRateio({
    empresa: { codigo: 101, nome: 'EMPRESA EXEMPLO (TESTE)' }, competencia: '2026-11',
    cte: { numero: 'T701/1', transportadora: 'TRANSPORTADORA EXEMPLO (TESTE)', data: '08/11/2026', valor: 500 },
    agrupar: 'tributacao', rateio: doCte.rateio, detalhes: doCte.grupos.map(g => g.detalhe), notas: doCte.notas,
    ncms: [{ titulo: doCte.grupos[iSt].rotulo, ...st }],
  });
}

describe('o Rateio de frete para exportar e imprimir (25/11/2026)', () => {
  it('pelo CT-e: o cabeçalho, os totais e as três tabelas da tela', () => {
    const rel = pelaTela();
    expect(rel.cabecalho).toEqual([
      ['Empresa', '101 · EMPRESA EXEMPLO (TESTE)'], ['Competência', '11/2026'], ['CT-e', 'T701/1'],
      ['Transportadora', 'TRANSPORTADORA EXEMPLO (TESTE)'], ['Data do CT-e', '08/11/2026'], ['Valor do CT-e', 500],
    ]);
    expect(rel.totais).toEqual([['Total dos produtos', 1000], ['Frete', 500], ['Desconto', 0]]);
    expect(rel.tabelas.map(t => t.titulo)).toEqual(['Notas transportadas', 'Pelas tributações', 'ICMS-ST · pelos NCMs']);
    expect(rel.nome).toBe('Rateio de frete 101 CT-e T701-1 2026-11');
  });
  it('as notas do CT-e com o frete de cada uma e a soma', () => {
    const notas = pelaTela().tabelas[0];
    expect(notas.linhas).toEqual([['T502', 'FORNECEDOR (TESTE)', 1000, 100, 500]]);
    expect(notas.soma).toEqual(['Total', '', 1000, 100, 500]);
  });
  it('pelas tributações: valor, IPI, %, frete, desconto e base (os números da planilha), com os CFOPs e a soma', () => {
    const trib = pelaTela().tabelas[1];
    expect(trib.colunas.map(c => c.rotulo)).toEqual(['Tributação', 'CFOPs', 'Valor', 'IPI', '%', 'Frete', 'Desconto', 'Base de cálculo']);
    expect(trib.linhas).toEqual([['Tributado', '2102', 600, 0, 60, 300, 0, 900], ['ICMS-ST', '2403', 400, 10, 40, 200, 0, 610]]);
    expect(trib.soma).toEqual(['Total', '', 1000, 10, 100, 500, 0, 1510]);
  });
  it('os NCMs do ST com a alíquota (4% ou a escolhida) e o ICMS, como a planilha RATEIO - FRETE', () => {
    const ncms = pelaTela().tabelas[2];
    expect(ncms.colunas.map(c => c.rotulo)).toEqual(['NCM', 'Valor', 'IPI', '%', 'Frete', 'Base de cálculo', 'Alíquota', 'ICMS']);
    expect(ncms.linhas).toEqual([
      ['39241000', 200, 10, 50, 100, 310, 4, 12.4],
      ['69120000', 100, 0, 25, 50, 150, 12, 18],
      ['70134900', 100, 0, 25, 50, 150, 4, 6],
    ]);
    expect(ncms.soma).toEqual(['Total', 400, 10, 100, 200, 610, '', 36.4]);
  });
  it('digitado: "Origem: digitado", com o desconto e a linha que fica fora (o total maior que as linhas)', () => {
    const r = ratear({ total: 1100, frete: 500, desconto: 110, linhas: [{ rotulo: '2102', valor: 600 }, { rotulo: 'ST', valor: 400, ipi: 10 }] });
    const st = icmsDosNcms(ratear({ frete: r.linhas[1].frete, linhas: [{ rotulo: '39241000', valor: 400 }] }));
    const rel = relatorioDoRateio({ rateio: r, ncms: [{ titulo: 'ICMS-ST', ...st }] });
    expect(rel.cabecalho).toEqual([['Origem', 'Digitado (sem o XML)']]);
    expect(rel.nome).toBe('Rateio de frete digitado');
    const trib = rel.tabelas[0];
    expect(trib.colunas.map(c => c.rotulo)).toEqual(['Tributação', 'Valor', 'IPI', '%', 'Frete', 'Desconto', 'Base de cálculo']);
    expect(trib.linhas[2]).toEqual(['Fora das linhas', 100, '', (100 * 100) / 1100, r.foraDaLista!.frete, r.foraDaLista!.desconto, '']);
    expect(trib.soma).toEqual(['Total', 1100, 10, 100, 500, 110, r.soma.base]);
    expect(rel.tabelas[1].soma.at(-1)).toBe(st.icms);
  });
  it('a planilha: uma aba com o cabeçalho, os totais, as tabelas e os números formatados', () => {
    const wb = XLSX.read(planilhaDoRateio(pelaTela()), { type: 'array', cellNF: true });
    expect(wb.SheetNames).toEqual(['Rateio']);
    const ws = wb.Sheets.Rateio;
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true, defval: '' });
    expect(linhas[0][0]).toBe('Rateio de frete');
    expect(linhas.find(l => l[0] === 'Valor do CT-e')?.[1]).toBe(500);
    const iTrib = linhas.findIndex(l => l[0] === 'Pelas tributações');
    expect(linhas[iTrib + 1]).toEqual(['Tributação', 'CFOPs', 'Valor', 'IPI', '%', 'Frete', 'Desconto', 'Base de cálculo']);
    expect(linhas[iTrib + 4]).toEqual(['Total', '', 1000, 10, 100, 500, 0, 1510]);
    // a base em dinheiro e o % com o sinal
    expect((ws[XLSX.utils.encode_cell({ r: iTrib + 2, c: 7 })] as XLSX.CellObject).z).toBe('#,##0.00');
    expect((ws[XLSX.utils.encode_cell({ r: iTrib + 2, c: 4 })] as XLSX.CellObject).z).toBe('0.00"%"');
    const iNcm = linhas.findIndex(l => l[0] === 'ICMS-ST · pelos NCMs');
    expect(linhas[iNcm + 5]).toEqual(['Total', 400, 10, 100, 200, 610, '', 36.4]);
  });
  it('a folha: A4, os números como na tela, a soma no rodapé de cada tabela e o texto escapado', () => {
    const rel = pelaTela();
    rel.cabecalho[0][1] = '101 · A & B <TESTE>';
    const html = htmlDoRateio(rel, { logo: { definicao: '<svg id="def"></svg>', uso: '<svg id="uso"></svg>' }, emitidoEm: new Date(2026, 10, 25) });
    expect(html).toContain('@page{size:A4 portrait');
    expect(html).toContain('A &amp; B &lt;TESTE&gt;');
    expect(html).toContain('<svg id="uso"></svg>');
    expect(html.match(/<tfoot>/g)).toHaveLength(3);
    expect(html).toContain('<td>1.510,00</td>');
    expect(html).toContain('<td>36,40</td>');
    expect(html).toContain('Emitido em 25/11/2026');
    expect(textoDaCelula(12.5, 'pct')).toBe('12,50%');
  });
});
