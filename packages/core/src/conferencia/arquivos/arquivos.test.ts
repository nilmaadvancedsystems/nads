import { describe, expect, it } from 'vitest';
import { ErroTipoErrado, lerBalancete, lerNotas, lerRazao, lerServicos } from './index';

const linhaBal = (desc: string, saldo: string) => ['', '', desc, '', '', '', '', saldo];

describe('lerBalancete', () => {
  const m = lerBalancete([
    ['Balancete de verificação'],
    linhaBal('ATIVO [10000]', '1.234,56 D'),
    linhaBal('        Caixa Geral - [11101]', '1.234,56 D'),
    linhaBal('PASSIVO [20000]', '500,00 C'),
    linhaBal('        Fornecedores [21101]', '500,00 C'),
    linhaBal('RECEITAS [40000]', 'sem valor'),
  ]);
  it('código, nome, saldo e D/C da coluna H', () => {
    expect(m['11101']).toMatchObject({ codigo: '11101', nome: 'Caixa Geral', valor: 1234.56, dc: 'D', grupo: 'Ativo' });
    expect(m['21101']).toMatchObject({ valor: 500, dc: 'C', grupo: 'Passivo' });
  });
  it('recuo maior na linha seguinte = sintética', () => {
    expect(m['10000'].sintetica).toBe(true);
    expect(m['11101'].sintetica).toBe(false);
  });
  it('linha sem saldo fica de fora; ordem do plano', () => {
    expect(m['40000']).toBeUndefined();
    expect([m['10000'].ordem, m['11101'].ordem, m['20000'].ordem]).toEqual([0, 1, 2]);
  });
});

describe('lerNotas', () => {
  const rows = [
    ['RELATÓRIO DE ENTRADAS'],
    ['CFOP', 'Lanc', 'Valor Contábil', 'Número', 'Nome Forn/Cliente', 'Dt. Escritura', 'Descrição do CFOP', 'CNPJ/CPF', 'Exportado'],
    ['1102', '00006.0', '1.234,56', '4101', 'FORN A', '05/07/2026', 'Compra', '11.222.333/0001-00', 'Sim'],
    ['Total', '', '9.999,00'],
    ['5102/01', '1', '10,00', '9', 'CLIENTE', '06/07/2026', '', '', 'N'],
  ];
  it('acha o cabeçalho e lê as notas', () => {
    const n = lerNotas(rows);
    expect(n.length).toBe(2);
    expect(n[0]).toEqual({ cfop: '1102', lanc: '00006', valor: 1234.56, numero: '4101', nome: 'FORN A', data: '05/07/2026', desc: 'Compra', doc: '11.222.333/0001-00', exportado: 'Sim', comp: '2026-07' });
    expect(n[1]).toMatchObject({ cfop: '5102', exportado: 'Não' });
  });
  it('sem coluna CFOP: erro', () => {
    expect(() => lerNotas([['Data', 'Valor']])).toThrow('Não achei a coluna CFOP');
  });
});

describe('lerServicos', () => {
  it('arquivo de fornecedor importado como prestados: ErroTipoErrado', () => {
    try {
      lerServicos([['Data', 'Nome do Fornecedor', 'Valor do Documento']], 'prestados');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ErroTipoErrado);
      expect((err as ErroTipoErrado).tipoCerto).toBe('tomados');
    }
  });
  it('lê notas e conta canceladas', () => {
    const r = lerServicos([
      ['Data', 'Nr.', 'Lanc', 'Nome do Cliente', 'Valor Base', 'ISS Valor', 'Cancelada'],
      ['05/07/2026', '00012', '0160', 'CLINICA', '1.000,00', '20,00', 'N'],
      ['06/07/2026', '13', '160', 'CLINICA', '500,00', '10,00', 'S'],
    ], 'prestados');
    expect(r.canceladas).toBe(1);
    expect(r.notas).toEqual([{ data: '05/07/2026', comp: '2026-07', numero: '12', lanc: '160', codPart: '', cnpj: '', nome: 'CLINICA', valor: 1000, iss: 20 }]);
  });
});

describe('lerRazao', () => {
  it('junta as colunas de histórico, valor sempre positivo com o sinal', () => {
    const l = lerRazao([
      ['Data', 'Histórico', 'Complemento / Descrição', 'Valor', 'Contrapartida'],
      ['05/07/2026', 'Compra', 'NF 100-11222333000100-FORN', '-1.234,56', ' 21101 '],
      ['', '', '', '', ''],
      ['06/07/2026', 'Pagamento', '', '50,00', ''],
    ]);
    expect(l).toEqual([
      { txt: 'Compra NF 100-11222333000100-FORN', data: '05/07/2026', valor: 1234.56, sinal: -1, contra: '21101' },
      { txt: 'Pagamento ', data: '06/07/2026', valor: 50, sinal: 1, contra: '' },
    ]);
  });
});
