import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import {
  bancoDoTexto, bancoNoNomeDoArquivo, ehExtratoDaCora, ehExtratoDoBancoDoBrasil, lancamentosDaCora, lancamentosDoBancoDoBrasil, marcaDoBanco, nomeDaAba, nomeDoXls, planilhaDoExtrato,
} from '.';

// Página do extrato do BB montada à mão, nas posições do PDF de verdade (x: Dia 30, Lote 99, Documento 148,
// Histórico 265, valor ~530, sinal 562; y cresce para cima).
const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });
const cabecalho = (y: number) => [t('Dia', 30, y), t('Lote', 99, y), t('Documento', 148, y), t('Histórico', 265, y), t('Valor', 550, y)];
const lanc = (y: number, data: string, valor: string, sinal: string, hist = '') =>
  [t(data, 30, y), t('13105', 99, y), t('90201', 148, y), ...(hist ? [t(hist, 265, y)] : []), t(valor, 530, y), t(sinal, 562, y)];

const PAGINA_1: ItemDeTexto[] = [
  t('Extrato de Conta Corrente', 25, 803),
  ...cabecalho(726),
  ...lanc(711, '31/08/2026', '0,00', '(+)', 'Saldo Anterior'),
  ...lanc(695, '01/09/2026', '1.168,71', '(+)', 'Cielo Vendas Crédito'),
  t('Pix - Enviado', 265, 488), ...lanc(483, '02/09/2026', '2.000,00', '(-)'), t('02/09 08:34 RENALD DA CRUZ', 265, 477),
  // histórico em três linhas: acima, na linha da data e abaixo, um pouco mais longe
  t('Pix - Enviado', 265, 464), ...lanc(453, '02/09/2026', '9.660,90', '(-)', '02/09 08:38 CLAUDINEIA FERREIRA'), t('BARRO', 265, 441),
  ...lanc(283, '02/09/2026', '0,00', '(+)', 'Saldo do dia'),
  // no pé da página: o começo do histórico do primeiro lançamento da página seguinte
  t('Recebimentos Diversos', 265, 30),
];
const PAGINA_2: ItemDeTexto[] = [
  ...cabecalho(731),
  ...lanc(712, '03/09/2026', '57,40', '(+)', '06.207.421/0001-74 REDEFLEX COMERCIO'), t('E', 265, 700),
  ...lanc(144, '30/09/2026', '1.226,19', '(+)', 'BB Rende Fácil'),
  ...lanc(128, '30/09/2026', '0,00', '(+)', 'S A L D O'),
  t('Informações Adicionais', 30, 106),
  t('- Limite Ouro Empresarial', 33, 92), t('10.000,00', 510, 92), t('(+)', 556, 92),
];

describe('extrato do Banco do Brasil', () => {
  it('reconhece o layout', () => {
    expect(ehExtratoDoBancoDoBrasil([PAGINA_1, PAGINA_2])).toBe(true);
    expect(ehExtratoDoBancoDoBrasil([[t('Data', 30, 700), t('Histórico', 100, 700), t('Valor', 400, 700)]])).toBe(false);
  });

  it('junta o histórico de cima, o da linha e o de baixo; pula os saldos e as informações adicionais', () => {
    expect(lancamentosDoBancoDoBrasil([PAGINA_1, PAGINA_2])).toEqual([
      { data: '2026-09-01', valor: 116871, historico: 'Cielo Vendas Crédito' },
      { data: '2026-09-02', valor: -200000, historico: 'Pix - Enviado 02/09 08:34 RENALD DA CRUZ' },
      { data: '2026-09-02', valor: -966090, historico: 'Pix - Enviado 02/09 08:38 CLAUDINEIA FERREIRA BARRO' },
      { data: '2026-09-03', valor: 5740, historico: 'Recebimentos Diversos 06.207.421/0001-74 REDEFLEX COMERCIO E' },
      { data: '2026-09-30', valor: 122619, historico: 'BB Rende Fácil' },
    ]);
  });
});

// Páginas do extrato da Cora montadas à mão, nas posições do PDF de verdade (nomes e documentos inventados): a linha do
// dia em x 30 com "Saldo do dia"; o lançamento em x 54, o nome em 219, as reticências em ~317, o documento em 347 e o
// valor com o sinal em ~500.
const linhaDoDia = (y: number, data: string, saldo: string) => [t(data, 30, y), t('Saldo do dia', 430, y), t('R$ ' + saldo, 501, y)];
const lancCora = (y: number, desc: string, nome: string, doc: string, valor: string) =>
  [t(desc, 54, y), t(nome, 219, y), t('…', 317, y), ...(doc ? [t(doc, 347, y)] : []), t(valor, 500, y)];
const RODAPE = (p: number) => [t('Cora SCFI - CNPJ 37.880.206/0001-63', 34, 42), t('Extrato gerado no dia 07/10/2026 às 11:04', 34, 12), t('pág ' + p + ' de 2', 511, 12)];
const CORA_1: ItemDeTexto[] = [
  t('EMPRESA EXEMPLO LTDA', 32, 788), t('Agência: 0001 - Conta: 1234567-0', 32, 749),
  t('Extrato do período', 30, 682), t('01/09/2026 a 30/09/2026', 427, 684),
  t('Saldo inicial disponível', 30, 641), t('R$ 1.000,00', 501, 641),
  t('Total de entradas', 30, 611), t('+ R$ 750,00', 483, 611),
  t('Total de saídas', 30, 581), t('- R$ 357,35', 488, 581),
  t('Transações', 30, 501),
  ...linhaDoDia(457, '30/09/2026', '1.392,65'),
  ...lancCora(424, 'Transf Pix recebida', 'FULANO DE TAL', '000.111.222-33', '+ R$ 600,00'),
  ...lancCora(397, 'Boleto pago', 'Cemig Distribuicao', '', '- R$ 157,35'),
  ...linhaDoDia(304, '29/09/2026', '950,00'),
  ...RODAPE(1),
];
const CORA_2: ItemDeTexto[] = [
  t('EMPRESA EXEMPLO LTDA', 32, 788), t('Agência: 0001 - Conta: 1234567-0', 32, 749),
  // continua o dia 29 da página anterior
  ...lancCora(702, 'Transf Pix enviada', 'BELTRANO SILVA', '12.345.678/0001-90', '- R$ 1.200,00'),
  ...linhaDoDia(663, '01/09/2026', '2.150,00'),
  ...lancCora(630, 'Devolução Pix enviada', 'CICLANO SOUZA', '444.555.666-77', '+ R$ 150,00'),
  ...RODAPE(2),
];

describe('extrato da Cora', () => {
  it('reconhece o layout (e não confunde com o do BB)', () => {
    expect(ehExtratoDaCora([CORA_1, CORA_2])).toBe(true);
    expect(ehExtratoDaCora([PAGINA_1, PAGINA_2])).toBe(false);
    expect(ehExtratoDoBancoDoBrasil([CORA_1, CORA_2])).toBe(false);
  });

  it('um lançamento por linha, no dia de cima (também o que passou de página); sem o resumo e os saldos; do mais velho para o mais novo', () => {
    expect(lancamentosDaCora([CORA_1, CORA_2])).toEqual([
      { data: '2026-09-01', valor: 15000, historico: 'Devolução Pix enviada CICLANO SOUZA 444.555.666-77' },
      { data: '2026-09-29', valor: -120000, historico: 'Transf Pix enviada BELTRANO SILVA 12.345.678/0001-90' },
      { data: '2026-09-30', valor: -15735, historico: 'Boleto pago Cemig Distribuicao' },
      { data: '2026-09-30', valor: 60000, historico: 'Transf Pix recebida FULANO DE TAL 000.111.222-33' },
    ]);
  });
});

describe('banco e nome do arquivo', () => {
  it('acha o banco pelo texto ou pelo nome do arquivo', () => {
    expect(bancoDoTexto('SICOOB - Sistema de Cooperativas')).toBe('Sicoob');
    expect(bancoDoTexto('Extrato', 'extrato_itau_09-2026.pdf')).toBe('Itaú');
    expect(bancoDoTexto('Extrato de conta')).toBe('');
    expect(marcaDoBanco('Banco do Brasil')).toBe('banco-do-brasil');
  });

  it('nomeia como o escritório: BANCO BRASIL 08.2026.xls', () => {
    expect(bancoNoNomeDoArquivo('Banco do Brasil')).toBe('BANCO BRASIL');
    expect(bancoNoNomeDoArquivo('Itaú')).toBe('ITAU');
    const linhas = [{ data: '2026-07-31', valor: 1, historico: 'a' }, { data: '2026-08-03', valor: 1, historico: 'b' }, { data: '2026-08-04', valor: 1, historico: 'c' }];
    expect(nomeDoXls('Banco do Brasil', linhas)).toBe('BANCO BRASIL 08.2026.xls');
    expect(nomeDaAba('Banco: do/Brasil')).toBe('Banco do Brasil');
  });
});

describe('o .xls', () => {
  it('é um Excel 97-2003 com a aba do banco, as 4 colunas, a data em texto e o valor contábil', () => {
    const bytes = planilhaDoExtrato('Banco do Brasil', [
      { data: '2026-08-03', valor: 219374, historico: 'Cielo Vendas Crédito' },
      { data: '2026-08-03', valor: -157767, historico: 'BB GIRO FGO PRONAMPE' },
    ]);
    expect([...bytes.subarray(0, 4)]).toEqual([0xD0, 0xCF, 0x11, 0xE0]);
    const wb = XLSX.read(bytes, { type: 'array', cellNF: true });
    expect(wb.SheetNames).toEqual(['Banco do Brasil']);
    const ws = wb.Sheets['Banco do Brasil'];
    expect(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })).toEqual([
      ['Data Lançamento', 'Valor Lançamento', 'Descrição Histórico', 'Finalidade de operação'],
      ['03/08/2026', 2193.74, 'Cielo Vendas Crédito', ''],
      ['03/08/2026', -1577.67, 'BB GIRO FGO PRONAMPE', ''],
    ]);
    expect(ws.B2.z).toBe('_-[$R$-416]\\ * #,##0.00_-;\\-[$R$-416]\\ * #,##0.00_-;_-[$R$-416]\\ * "-"??_-;_-@_-');
    expect(ws['!autofilter']?.ref).toBe('A1:D3');
  });
});
