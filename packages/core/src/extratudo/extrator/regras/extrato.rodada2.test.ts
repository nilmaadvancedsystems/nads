// Rodada 2: bugs achados relendo os extratos originais (10/11/2026). Layouts reais, dados fictícios.
import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, EmpresaExtrator } from '../tipos';
import { ehRelatorioDeTitulos, extratoDoPdf, type ItemDeTexto } from './extrato';
import { relerExtrato } from './importacao';

const item = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });
const linha = (y: number, partes: [string, number][]): ItemDeTexto[] => partes.map(([t, x]) => item(t, x, y));
const AGORA = new Date('2026-11-10T12:00:00Z');

describe('os "Últimos Lançamentos" do Bradesco', () => {
  const cabecalho = [
    ...linha(779, [['Extrato de: Ag:', 40], ['Entre', 180], ['01/06/2026', 215], ['e', 259], ['30/06/2026', 265]]),
    ...linha(746, [['Data', 44], ['Lançamento', 105], ['Dcto.', 273], ['Crédito', 344], ['Débito', 436], ['Saldo', 528]]),
    ...linha(728, [['31/05/2026', 41], ['SALDO ANTERIOR', 102], ['100,00', 540]]),
    ...linha(713, [['29/06/2026', 41], ['PIX RECEBIDO', 102], ['50,00', 364], ['150,00', 540]]),
    ...linha(700, [['Total', 41], ['50,00', 364], ['150,00', 540]]),
  ];
  const ultimos = (depois: ItemDeTexto[]) => [[...cabecalho, ...linha(680, [['Últimos Lançamentos', 40]]), ...linha(660, [['Data', 44], ['Lançamento', 105], ['Crédito', 344], ['Débito', 436], ['Saldo', 528]]), ...depois]];

  it('o dia do período que só existe ali entra (com o texto de cima), e o saldo anterior da seção não troca o do extrato', () => {
    const r = extratoDoPdf(ultimos([
      ...linha(640, [['29/06/2026', 41], ['SALDO ANTERIOR', 102], ['150,00', 540]]),
      ...linha(624, [['DEP DINHEIRO', 102]]),
      ...linha(620, [['30/06/2026', 41], ['123', 270], ['20,00', 364], ['170,00', 540]]),
      ...linha(600, [['Total', 41], ['20,00', 364], ['170,00', 540]]),
    ]), 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-06-29', 5000], ['2026-06-30', 2000]]);
    expect(r.lancamentos[1].historico).toContain('DEP DINHEIRO');
  });

  it('o dia depois do período continua de fora (a seção segue sendo só aviso)', () => {
    const r = extratoDoPdf(ultimos([
      ...linha(640, [['30/06/2026', 41], ['SALDO ANTERIOR', 102], ['150,00', 540]]),
      ...linha(620, [['01/07/2026', 41], ['PIX ENVIADO', 102], ['20,00', 436], ['130,00', 540]]),
    ]), 'banco', 2026);
    expect(r.lancamentos.map(l => l.data)).toEqual(['2026-06-29']);
  });

  it('o mesmo dia de um ano depois (o PDF antigo tirado hoje) não entra no período', () => {
    const r = extratoDoPdf(ultimos(linha(620, [['30/06/2027', 41], ['PIX ENVIADO', 102], ['20,00', 436], ['130,00', 540]])), 'banco', 2026);
    expect(r.lancamentos.map(l => l.data)).toEqual(['2026-06-29']);
  });

  it('com a tabela já no último dia do período, nada da seção entra', () => {
    const [p] = ultimos([...linha(620, [['30/06/2026', 41], ['PIX', 102], ['20,00', 364], ['170,00', 540]])]);
    const fim = p.map(i => (i.texto === '29/06/2026' ? { ...i, texto: '30/06/2026' } : i));
    expect(extratoDoPdf([fim], 'banco', 2026).lancamentos).toHaveLength(1);
  });
});

describe('o "Extrato Unificado - Pessoa Jurídica" do Bradesco', () => {
  const p = [
    ...linha(793, [['Extrato Unificado - Pessoa Jurídica', 355]]),
    ...linha(765, [['01/01/2026 a 31/01/2026', 417]]),
    ...linha(591, [['Saldo em', 426], ['Saldo em', 522]]),
    ...linha(579, [['31/12/2025', 416], ['31/01/2026', 512]]),
    ...linha(550, [['Invest Fácil', 37], ['500,00', 423], ['700,00', 519]]),
    ...linha(381, [['Demonstrativo da Movimentação', 37]]),
    ...linha(367, [['Data', 47], ['Histórico', 153], ['Docto', 278], ['Crédito', 341], ['Débito', 428], ['Saldo', 515]]),
    ...linha(354, [['30/12', 46], ['Saldo Anterior', 77], ['1,00', 553]]),
    ...linha(342, [['02/01', 46], ['Dep Corban', 77], ['123', 274], ['300,00', 366]]),
    ...linha(330, [['Aplic.invest Facil', 77], ['124', 274], ['300,00', 451]]),
    ...linha(318, [['1,00', 553]]),
    ...linha(304, [['Total', 77], ['300,00', 358], ['300,00', 443], ['1,00', 553]]),
    ...linha(280, [['Investimentos', 266]]),
    ...linha(260, [['04', 41], ['05/01/2026', 65], ['30/12/2025', 122], ['8.835,62', 221], ['8.835,74', 535]]),
    ...linha(248, [['20/12/2027', 122], ['8.836,35', 221]]),
  ];
  it('só a tabela da conta entra, com a data curta, sem o resumo, o fecho do dia e o Invest Fácil', () => {
    const r = extratoDoPdf([p], 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-01-02', 30000], ['2026-01-02', -30000]]);
  });
  it.each(['Investimentos Alfa Ltda', 'Invest Facil 123', 'Poupanca Maria'])('o favorecido "%s" embaixo do lançamento não fecha a tabela', nome => {
    const comFavorecido = p.flatMap(i => (i.texto === 'Aplic.invest Facil' ? [...linha(336, [[nome, 77]]), i] : [i]));
    const r = extratoDoPdf([comFavorecido], 'banco', 2026);
    expect(r.lancamentos.map(l => l.valor)).toEqual([30000, -30000]);
    expect(r.lancamentos[0].historico).toContain(nome);
  });
  it('sem o título "Investimentos", a linha do Total fecha a tabela', () => {
    const r = extratoDoPdf([p.filter(i => i.texto !== 'Investimentos')], 'banco', 2026);
    expect(r.lancamentos.map(l => l.valor)).toEqual([30000, -30000]);
  });
});

describe('o Sicoob do SISBR na virada da página', () => {
  it('o valor no fim da página é da linha da data que abre a seguinte (aqui, o saldo do dia): não vira lançamento', () => {
    const p1 = [
      ...linha(625, [['DATA', 115], ['HISTÓRICO', 154], ['VALOR', 449]]),
      ...linha(600, [['03/06', 115], ['PIX RECEB', 154], ['10,00C', 451]]),
      ...linha(46, [['23.236,51', 440]]),
    ];
    const p2 = [
      ...linha(798, [['03/06', 115], ['SALDO DO DIA', 154], ['C', 474]]),
      ...linha(786, [['05/06', 115], ['PIX EMIT', 154], ['900,00D', 446]]),
    ];
    const r = extratoDoPdf([p1, p2], 'banco', 2026);
    expect(r.lancamentos.map(l => l.valor)).toEqual([1000, -90000]);
    expect(r.saldosDoDia).toEqual([{ data: '2026-06-03', saldo: 2323651 }]);
  });
  it('o layout com o valor embaixo da data: cada número fica com a data de cima, mesmo na virada', () => {
    const p1 = [...linha(625, [['DATA', 115], ['HISTÓRICO', 154], ['VALOR', 449]]), ...linha(600, [['05/06', 115], ['PIX A', 154]]), ...linha(590, [['100,00', 449]]), ...linha(560, [['06/06', 115], ['PIX B', 154]]), ...linha(550, [['200,00', 449]])];
    const p2 = [...linha(798, [['07/06', 115], ['PIX C', 154]]), ...linha(788, [['300,00', 449]]), ...linha(760, [['08/06', 115], ['PIX D', 154]]), ...linha(750, [['400,00', 449]])];
    expect(extratoDoPdf([p1, p2], 'banco', 2026).lancamentos.map(l => [l.data, l.valor, l.historico])).toEqual([['2026-06-05', 10000, 'PIX A'], ['2026-06-06', 20000, 'PIX B'], ['2026-06-07', 30000, 'PIX C'], ['2026-06-08', 40000, 'PIX D']]);
  });
  it('o número sozinho no fim da página, com a página seguinte começando por outra coisa, fica como estava', () => {
    const p1 = [...linha(600, [['03/06', 115], ['PIX RECEB', 154], ['10,00C', 451]]), ...linha(46, [['1,00', 440]])];
    const p2 = [...linha(798, [['Página 2', 115]]), ...linha(786, [['05/06', 115], ['PIX', 154], ['2,00C', 446]])];
    expect(extratoDoPdf([p1, p2], 'banco', 2026).lancamentos.map(l => l.valor)).toEqual([1000, 100, 200]);
  });
});

describe('o "extrato mensal" do Itaú com a aplicação automática', () => {
  const pagina = (aplic: boolean) => [
    ...linha(764, [['extrato', 406], ['mensal', 426], ['ag 1234 cc 56789-0', 466], ['abr 2026', 514]]),
    ...linha(502, [['01. Conta Corrente e Aplicações Automáticas', 58], ['R$ 1.594,16', 430], ['R$ 10,78', 520]]),
    ...linha(248, [['data', 150], ['descrição', 208], ['entradas R$', 357], ['saídas R$', 426], ['saldo R$', 521]]),
    ...linha(230, [['31/03', 150], ['Saldo anterior', 208], ['1.594,16', 521]]),
    ...linha(206, [['01/04', 150], ['JUROS LIMITE', 208], ['119,43-', 436]]),
    ...linha(197, aplic ? [['Res Aplic Aut Mais', 208], ['119,43', 375], ['1,00', 535]] : [['PIX RECEBIDO', 208], ['119,43', 375], ['1.594,16', 535]]),
  ];
  it('o saldo anterior é o da conta (a coluna Saldo da 1ª linha), sem a aplicação', () => {
    expect(extratoDoPdf([pagina(true)], 'banco', 2026).saldoAnteriorConferido).toBe(100);
  });
  it('sem a aplicação automática, nada muda', () => {
    expect(extratoDoPdf([pagina(false)], 'banco', 2026).saldoAnteriorConferido).toBeNull();
  });
});

describe('o cabeçalho do PDF no histórico', () => {
  it('o que vem antes do título da tabela não vai para o 1º lançamento; o texto depois dele, sim', () => {
    const p = [
      ...linha(790, [['Extrato de conta corrente', 77]]),
      ...linha(775, [['Emitido em 14 setembro 2026', 77]]),
      ...linha(709, [['DATA', 26], ['TIPO', 79], ['DESCRIÇÃO', 124], ['VALOR', 287], ['SALDO', 354]]),
      ...linha(691, [['Rendimento automático', 124]]),
      ...linha(685, [['02/02/26', 26], ['Entrada', 79], ['R$ 0,01', 287], ['R$ 10,01', 354]]),
    ];
    expect(extratoDoPdf([p], 'banco', 2026).lancamentos[0].historico).toBe('Rendimento automático Entrada');
  });
});

describe('o relatório de cobrança na pasta do extrato', () => {
  it('reconhece só o relatório de títulos', () => {
    expect(ehRelatorioDeTitulos('Relatório - Títulos por Período Sacado Nosso Número Vlr. Cobrado')).toBe(true);
    expect(ehRelatorioDeTitulos('Extrato conta corrente LIQUIDACAO COBRANCA Nosso Número 123')).toBe(false);
    expect(ehRelatorioDeTitulos('Relatório - Títulos por Período')).toBe(false);
    expect(ehRelatorioDeTitulos('Extrato conta corrente Saldo anterior 10,00 Relatório - Títulos por Período Sacado Nosso Número')).toBe(false);
  });
});

describe('reler o pedaço com o ano errado quando o mês já veio em outro extrato do banco', () => {
  const lanc = (data: string, valor: number) => ({ data, valor, historico: 'x' });
  const arq = (id: string, lancamentos: ArquivoImportado['lancamentos']): ArquivoImportado => ({ id, lado: 'banco', nome: id + '.pdf', importadoEm: '2026-11-01T00:00:00Z', modo: 'primeira', banco: 'b', lancamentos });
  const certos = Array.from({ length: 10 }, (_, i) => lanc('2026-01-1' + i, 100 + i));
  const lido = (l: ArquivoImportado['lancamentos']): ArquivoLido => ({ nome: 'p.pdf', lancamentos: l, erro: null });
  const empresa = (): EmpresaExtrator => ({ nome: 'T', auditoria: [], arquivos: [arq('texto', certos), arq('ocr', [lanc('2028-01-10', 100)])] });

  it('quase tudo repetido: o pedaço sai, e o que o OCR leu diferente não entra como movimento', () => {
    const r = relerExtrato(empresa(), 'ocr', lido([...certos.slice(0, 9), lanc('2026-01-26', 109)]), AGORA);
    expect(r.arquivos.map(a => a.id)).toEqual(['texto']);
    expect(r.auditoria[0].detalhe).toContain('ano errado');
  });
  it('o resto do mês que só este arquivo tem (nenhum lançamento do outro extrato ficou sem par): o arquivo fica, com o que é novo', () => {
    const resto = Array.from({ length: 4 }, (_, i) => lanc('2026-01-2' + i, 500 + i));
    const r = relerExtrato(empresa(), 'ocr', lido([...certos, ...resto]), AGORA);
    expect(r.arquivos.find(a => a.id === 'ocr')?.lancamentos.map(l => l.valor)).toEqual([500, 501, 502, 503]);
  });
  it('a maior parte nova: fica com a leitura nova', () => {
    const r = relerExtrato(empresa(), 'ocr', lido([certos[0], lanc('2026-03-01', 1), lanc('2026-03-02', 2)]), AGORA);
    expect(r.arquivos.find(a => a.id === 'ocr')?.lancamentos.map(l => l.valor)).toEqual([1, 2]);
  });
  it('o arquivo sem ano errado não muda de regra', () => {
    const e: EmpresaExtrator = { nome: 'T', auditoria: [], arquivos: [arq('texto', certos), arq('novo', [lanc('2026-01-10', 100), lanc('2026-01-26', 109)])] };
    const r = relerExtrato(e, 'novo', lido([...certos.slice(0, 9), lanc('2026-01-26', 109)]), AGORA);
    expect(r.arquivos.find(a => a.id === 'novo')?.lancamentos.map(l => l.data)).toEqual(['2026-01-26']);
  });
});
