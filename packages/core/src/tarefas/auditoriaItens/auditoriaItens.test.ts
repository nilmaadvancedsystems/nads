import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { auditarItem, auditarPlanilha, colunasDoCabecalho, lerPlanilhaDeItens, ncmLimpo, planilhaAuditada, valoresDaAuditoria } from './index';

describe('PIS/COFINS', () => {
  it('perfumaria é monofásica (CST 04), menos o odorizador de ambiente', () => {
    const a = auditarItem({ ncm: '3304.99.90', descricao: 'CREME HIDRATANTE' });
    expect([a.monofasico, a.regime, a.cstPisCofins]).toEqual([true, 'Monofásico', '04']);
    expect(a.basePisCofins).toContain('10.147');
    expect(auditarItem({ ncm: '33074900', descricao: 'ODORIZADOR' }).monofasico).toBe(false);
  });
  it('cigarro é CST 05', () => {
    expect(auditarItem({ ncm: '24022000', descricao: 'CIGARRO' }).cstPisCofins).toBe('05');
  });
  it('peça de moto (8714) não é monofásica; 8708 é', () => {
    expect(auditarItem({ ncm: '87141000', descricao: 'PECA MOTO' }).regime).toBe('Tributado Integralmente');
    expect(auditarItem({ ncm: '87083090', descricao: 'PASTILHA FREIO' }).regime).toBe('Monofásico');
  });
  it('carne, leite e absorvente são alíquota zero (CST 06)', () => {
    for (const ncm of ['02071200', '04012010', '96190000', '49019900']) {
      const a = auditarItem({ ncm, descricao: '' });
      expect([a.monofasico, a.regime, a.cstPisCofins]).toEqual([false, 'Alíquota Zero', '06']);
    }
  });
  it('o resto é tributado: 01 na venda, 49 em outras saídas', () => {
    expect(auditarItem({ ncm: '18063210', descricao: 'CHOCOLATE', cfop: '5102' }).cstPisCofins).toBe('01');
    expect(auditarItem({ ncm: '18063210', descricao: 'CHOCOLATE', cfop: '5949' }).cstPisCofins).toBe('49');
  });
  it('o NCM de 7 dígitos ganha o zero da frente', () => {
    expect(ncmLimpo(2071200)).toBe('02071200');
    expect(ncmLimpo('abc')).toBe('');
  });
});

describe('ICMS-ST de Minas', () => {
  it('pelo NCM no Anexo VII', () => {
    const a = auditarItem({ ncm: '22021000', descricao: 'REFRIGERANTE' });
    expect([a.st, a.origemSt, a.diagnostico]).toEqual([true, 'ncm', 'Ambos']);
    expect(a.segmentoSt).toContain('Cap. 3');
  });
  it('o documento vale mais que o NCM: frango com CSOSN 500 e CEST é ST', () => {
    const a = auditarItem({ ncm: '02071200', descricao: 'FRANGO', cfop: '5405', csosn: '500', cest: '1708700' });
    expect([a.st, a.origemSt, a.diagnostico]).toEqual([true, 'documento', 'Somente ST']);
    expect(a.segmentoSt).toContain('CEST 17.087.00');
  });
  it('o CSOSN na coluna do CST é reconhecido', () => {
    expect(auditarItem({ ncm: '19053100', descricao: 'BISCOITO', cst: '500' }).st).toBe(true);
    expect(auditarItem({ ncm: '19053100', descricao: 'BISCOITO', cst: '102' }).st).toBe(false);
  });
  it('CST 060 (com a origem) é ST; CFOP 5102 é normal mesmo com NCM do anexo, e avisa', () => {
    expect(auditarItem({ ncm: '19053100', descricao: 'BISCOITO', cst: '060' }).st).toBe(true);
    const a = auditarItem({ ncm: '22021000', descricao: 'REFRIGERANTE', cfop: '5102', cst: '000' });
    expect([a.st, a.diagnostico]).toEqual([false, 'Somente Monofásico']);
    expect(a.baseSt).toContain('Cap. 3');
  });
  it('sem nada: Não', () => {
    const a = auditarItem({ ncm: '39241000', descricao: 'POTE PLASTICO' });
    expect([a.st, a.monofasico, a.diagnostico]).toEqual([false, false, 'Não']);
  });
});

describe('planilha', () => {
  it('acha as colunas pelo cabeçalho', () => {
    const c = colunasDoCabecalho(['Código', 'Descrição do produto', 'NCM', 'CFOP', 'CST ICMS', 'CST PIS', 'CEST']);
    expect(c).toEqual({ ncm: 2, descricao: 1, cfop: 3, cst: 4, csosn: -1, cest: 6 });
  });
  it('lê, audita e grava a planilha com estilo, que o SheetJS relê', () => {
    const aba = XLSX.utils.aoa_to_sheet([
      ['RELATÓRIO DE ITENS'],
      [],
      ['Código', 'Descrição', 'NCM', 'CFOP', 'CSOSN', 'Valor'],
      [1, 'REFRIGERANTE COLA 2L', '2202.10.00', '5405', '500', 8.5],
      [2, 'SHAMPOO', 33051000, '5102', '102', 12],
      [null, 'TOTAL', null, null, null, 20.5],
    ]);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, 'Itens');
    const bytes = new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const p = lerPlanilhaDeItens(bytes);
    expect(p.cabecalho).toEqual(['Código', 'Descrição', 'NCM', 'CFOP', 'CSOSN', 'Valor']);
    expect(p.linhas).toHaveLength(3);
    const linhas = auditarPlanilha(p);
    expect(linhas[0].auditoria?.diagnostico).toBe('Ambos');
    expect(linhas[1].auditoria?.diagnostico).toBe('Somente Monofásico');
    expect(linhas[2].auditoria).toBeNull();
    expect(valoresDaAuditoria(null).every(v => v === '')).toBe(true);

    const saida = planilhaAuditada(p, linhas);
    const relido = XLSX.read(saida, { type: 'array', cellStyles: true });
    const f = relido.Sheets[relido.SheetNames[0]];
    const m = XLSX.utils.sheet_to_json<unknown[]>(f, { header: 1, defval: null });
    expect(m[0]).toEqual(['Código', 'Descrição', 'NCM', 'CFOP', 'CSOSN', 'Valor', 'Monofásico (PIS/COFINS)', 'ICMS-ST (MG)', 'Diagnóstico Combinado',
      'PIS/COFINS Regime', 'PIS/COFINS CST Saída Sugerido', 'PIS/COFINS Embasamento Legal', 'ICMS-ST Segmento / Capítulo', 'ICMS-ST Embasamento (RICMS/MG)']);
    expect(m[1].slice(6, 11)).toEqual(['SIM', 'SIM', 'Ambos', 'Monofásico', '04']);
    expect(m[2].slice(6, 9)).toEqual(['SIM', 'NÃO', 'Somente Monofásico']);
    expect(m[1][5]).toBe(8.5);
  });
  it('sem coluna NCM: erro', () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'X');
    expect(() => lerPlanilhaDeItens(new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer))).toThrow(/NCM/);
  });
});
