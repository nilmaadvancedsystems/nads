import { describe, expect, it } from 'vitest';
import { lancamentosDoOfx } from './ofx';
import { lancamentosDaPlanilha } from './planilha';

describe('planilha', () => {
  it('razão com Débito/Crédito: débito entra no banco; continuação do histórico junta; saldo anterior fica de fora', () => {
    const r = lancamentosDaPlanilha([
      ['Razão analítico - Banco'], [],
      ['Data', 'Histórico', 'Débito', 'Crédito', 'Saldo'],
      ['01/08/2026', 'Saldo anterior', '', '', '1.000,00'],
      ['03/08/2026', 'Recebimento cliente Alfa', '4.500,00', '', ''],
      ['04/08/2026', 'Pagamento energia', '', '1.289,00', ''],
      ['', 'NF 123', '', '', ''],
    ], 'sistema');
    expect(r.erro).toBeNull();
    expect(r.lancamentos).toEqual([
      { data: '2026-08-03', valor: 450000, historico: 'Recebimento cliente Alfa' },
      { data: '2026-08-04', valor: -128900, historico: 'Pagamento energia NF 123' },
    ]);
  });

  it('extrato em Excel com Débito/Crédito: débito sai do banco', () => {
    const r = lancamentosDaPlanilha([['Data', 'Descrição', 'Débito', 'Crédito'], [new Date(2026, 7, 3), 'TARIFA', 12.9, '']], 'banco');
    expect(r.lancamentos).toEqual([{ data: '2026-08-03', valor: -1290, historico: 'TARIFA' }]);
  });

  it('Valor + D/C', () => {
    const l = [['Data', 'Histórico', 'Valor', 'D/C'], ['03/08/2026', 'A', '10,00', 'D'], ['04/08/2026', 'B', '5,00', 'C']];
    expect(lancamentosDaPlanilha(l, 'sistema').lancamentos.map(x => x.valor)).toEqual([1000, -500]);
    expect(lancamentosDaPlanilha(l, 'banco').lancamentos.map(x => x.valor)).toEqual([-1000, 500]);
  });

  it('Conta Débito / Conta Crédito: a conta que mais aparece é a do banco', () => {
    const r = lancamentosDaPlanilha([
      ['Data', 'Conta Débito', 'Conta Crédito', 'Valor', 'Histórico'],
      ['03/08/2026', '5', '30101', '100,00', 'Recebimento'],
      ['04/08/2026', '410', '5', '40,00', 'Energia'],
      ['05/08/2026', '5', '30102', '7,00', 'Outro'],
    ], 'sistema');
    expect(r.lancamentos.map(x => x.valor)).toEqual([10000, -4000, 700]);
  });

  it('sem cabeçalho: adivinha data, valor e histórico', () => {
    const r = lancamentosDaPlanilha([
      ['03/08/2026', 'PAGAMENTO FORNECEDOR X', '-50,00'],
      ['04/08/2026', 'RECEBIMENTO CLIENTE Y', '80,00'],
    ], 'banco');
    expect(r.lancamentos).toEqual([
      { data: '2026-08-03', valor: -5000, historico: 'PAGAMENTO FORNECEDOR X' },
      { data: '2026-08-04', valor: 8000, historico: 'RECEBIMENTO CLIENTE Y' },
    ]);
  });

  it('sem data nem valor: erro', () => {
    expect(lancamentosDaPlanilha([['a', 'b'], ['c', 'd']], 'banco').erro).toBe('Não achei as colunas de data e valor.');
  });
});

describe('OFX', () => {
  it('lê cada STMTTRN (com ou sem fechamento)', () => {
    const t = 'OFXHEADER:100\n<OFX><BANKTRANLIST>' +
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805120000[-3:BRT]<TRNAMT>-45.90<MEMO>TARIFA PACOTE</STMTTRN>' +
      '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260806<TRNAMT>100,00<NAME>JOAO\n' +
      '</BANKTRANLIST></OFX>';
    expect(lancamentosDoOfx(t)).toEqual([
      { data: '2026-08-05', valor: -4590, historico: 'TARIFA PACOTE' },
      { data: '2026-08-06', valor: 10000, historico: 'JOAO' },
    ]);
  });
});
