import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { dataDaCelula, descricaoPadrao, lerPlanilhaDeRecebimentos, valorDaCelula } from './recebimentos';
import { lerArquivoDeRecebimentos } from './planilha';

describe('a planilha de recebimentos', () => {
  it('lê o código, o nome, a data e o valor (linhas fictícias)', () => {
    const r = lerPlanilhaDeRecebimentos([
      ['(00462)', 'CLIENTE FICTICIO A LTDA', 46315, 670, ''],
      ['(00007)', 'CLIENTE FICTICIO B', '10/20/26', '1,200.00', ''],
      ['(01234)', 'CLIENTE FICTICIO C', new Date(2026, 9, 21), '1.200,50'],
      [-5, 'CSV: (00005) lido como -5', 46315, 10],
      [99, 'CODIGO COMO NUMERO (formato do xlsx do banco)', 46315, 10],
    ]);
    expect(r.avisos).toEqual([]);
    expect(r.recebimentos).toEqual([
      { codigo: 462, nome: 'CLIENTE FICTICIO A LTDA', data: '2026-10-20', valor: 670 },
      { codigo: 7, nome: 'CLIENTE FICTICIO B', data: '2026-10-20', valor: 1200 },
      { codigo: 1234, nome: 'CLIENTE FICTICIO C', data: '2026-10-21', valor: 1200.5 },
      { codigo: 5, nome: 'CSV: (00005) lido como -5', data: '2026-10-20', valor: 10 },
      { codigo: 99, nome: 'CODIGO COMO NUMERO (formato do xlsx do banco)', data: '2026-10-20', valor: 10 },
    ]);
  });

  it('ignora com aviso a linha sem código, sem valor ou com data inválida; pula as vazias', () => {
    const r = lerPlanilhaDeRecebimentos([
      ['', '', '', ''],
      ['462', 'SEM PARENTESES', '10/20/26', 100],
      ['(00462)', 'SEM VALOR', '10/20/26', ''],
      ['(00462)', 'DATA RUIM', '31/31/2026', 100],
      ['(00462)', 'BOA', '10/20/26', 100],
    ]);
    expect(r.recebimentos).toHaveLength(1);
    expect(r.avisos).toEqual([
      'Linha 2: ignorada, sem o código do cliente no formato (00000).',
      'Linha 3: ignorada, sem valor.',
      'Linha 4: ignorada, a data não é válida.',
    ]);
  });

  it('entende as datas: M/D/AA, D/M/AAAA, ISO e número de série', () => {
    expect(dataDaCelula('10/20/26')).toBe('2026-10-20');
    expect(dataDaCelula('03/04/26')).toBe('2026-03-04');
    expect(dataDaCelula('20/10/2026')).toBe('2026-10-20');
    expect(dataDaCelula('05/06/2026')).toBe('2026-06-05');
    expect(dataDaCelula('2026-10-20')).toBe('2026-10-20');
    expect(dataDaCelula(46315)).toBe('2026-10-20');
    expect(dataDaCelula('abc')).toBe('');
    expect(dataDaCelula(5)).toBe('');
  });

  it('entende o valor em número e em texto', () => {
    expect(valorDaCelula(670)).toBe(670);
    expect(valorDaCelula('1,200.00')).toBe(1200);
    expect(valorDaCelula('1.200,00')).toBe(1200);
    expect(valorDaCelula('R$ 670,5')).toBe(670.5);
    expect(valorDaCelula('1.200')).toBe(1200);
    expect(valorDaCelula('670.00')).toBe(670);
    expect(valorDaCelula('')).toBe(0);
  });

  it('a descrição padrão é do mês anterior', () => {
    expect(descricaoPadrao('2026-10-20')).toBe('Serviços Contábeis Ref. 09/2026');
    expect(descricaoPadrao('2026-01-05')).toBe('Serviços Contábeis Ref. 12/2025');
  });

  it('lê um arquivo xlsx de verdade (feito aqui, fictício)', () => {
    const ws = XLSX.utils.aoa_to_sheet([['(00462)', 'CLIENTE FICTICIO', new Date(2026, 9, 20, 12), 670]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const r = lerArquivoDeRecebimentos(buf);
    expect(r.avisos).toEqual([]);
    expect(r.recebimentos).toEqual([{ codigo: 462, nome: 'CLIENTE FICTICIO', data: '2026-10-20', valor: 670 }]);
  });
});
