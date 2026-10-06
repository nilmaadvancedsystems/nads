import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import {
  bancoDoTexto, bancoNoNomeDoArquivo, ehExtratoDoBancoDoBrasil, lancamentosDoBancoDoBrasil, marcaDoBanco, nomeDaAba, nomeDoXls, planilhaDoExtrato,
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
