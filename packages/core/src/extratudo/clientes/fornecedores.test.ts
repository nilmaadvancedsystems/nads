import { describe, expect, it } from 'vitest';
import { lerRazao } from '../../tarefas/regras/razao';
import { clientesDoDinamico, credores, credoresNoPeriodo, dinamicoDeTeste, lerBalanceteDinamico, situacaoDe } from './index';
import { conferirRazaoDoCliente, razaoDaMarca } from './razao';

// o balancete dinâmico da 292 (bdinamico.xls): devedor positivo, credor negativo
const ROWS = [
  ['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '07/2026', '08/2026'],
  ['21398', '1.1.2.03.006', 'Adiantamento a Fornecedores', '0', '0', '0'],
  ['320', '2.1.1.01', 'FORNECEDORES', '-30707.07', '-418613.2', '-537701.24'],
  ['32004', '2.1.1.01.054', 'GRAO NATURAL IND. E COMERCIO DE CERAIS LTDA ME', '0', '0', '3610'],
  ['32029', '2.1.1.01.067', 'HILE IND. DE ALIMENTOS LTDA', '0', '-26172.21', '-15495.31'],
  ['32032', '2.1.1.01.075', 'APIARIOS CASAGRANDE LTDA', '0', '-1910.6', '0'],
  ['32016', '2.1.1.01.072', 'BIOSOFT IND. E COM. DE PDTOS. ALIM. EIRELI', '-4516.55', '1235.23', '-1719.91'],
];

describe('fornecedores (a etapa Fornecedores da Tarefa)', () => {
  const d = lerBalanceteDinamico(ROWS);
  it('as contas debaixo de FORNECEDORES do Passivo, com o sinal trocado: positivo = a empresa deve', () => {
    const f = clientesDoDinamico(d, '2026-08', 'fornecedores');
    expect(f.map(x => [x.codigo, x.saldo])).toEqual([['32004', -3610], ['32029', 15495.31], ['32032', -0], ['32016', 1719.91]]);
    // o Adiantamento a fornecedores (Ativo) não entra
    expect(f.some(x => x.codigo === '21398')).toBe(false);
  });
  it('o fornecedor devedor é o errado (o "credor" do cliente): a prioridade', () => {
    expect(credores(clientesDoDinamico(d, '2026-08', 'fornecedores')).map(x => x.codigo)).toEqual(['32004']);
    // devedor em algum mês: a BIOSOFT em 07/2026
    expect(credoresNoPeriodo(d, '2026-08', 'fornecedores').map(x => x.codigo)).toEqual(['32004', '32016']);
  });
  it('zerado é Ok; com saldo, Pendente', () => {
    const [grao, hile, apiarios] = clientesDoDinamico(d, '2026-08', 'fornecedores');
    expect([situacaoDe(grao), situacaoDe(hile), situacaoDe(apiarios)]).toEqual(['pendente', 'pendente', 'ok']);
  });
  it('o dinâmico de teste dos fornecedores tem dois devedores', () => {
    const t = dinamicoDeTeste('2026-08', true, 'fornecedores');
    expect(credores(clientesDoDinamico(t, '2026-08', 'fornecedores'))).toHaveLength(2);
    expect(credores(clientesDoDinamico(dinamicoDeTeste('2026-08', false, 'fornecedores'), '2026-08', 'fornecedores'))).toHaveLength(0);
  });
});

// o razão de um fornecedor no formato da conciliação do Alterdata (crédito positivo), valores inventados
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
let saldo = 0;
const L = (data: string, contra: string, nome: string, valor: number, hist: string) => {
  saldo = Math.round((saldo + valor) * 100) / 100;
  return ['Falso', 'Conciliação manual', data, '', contra, nome, valor, '', hist, saldo, ''];
};
const CNPJ = '11222333000144-FORNECEDOR TESTE LTDA';
const RAZAO = [CAB,
  // NF 500: comprada e paga (fecha)
  L('05/08/2026', '41101', 'Compras de mercadorias', 1000, 'Pelas compras de mercadorias a prazo conf. NF-e - 500-' + CNPJ),
  L('20/08/2026', '10503', 'Banco', -1000, 'Pagamento a fornecedores 500 - FORNECEDOR TESTE LTDA'),
  // NF 501: paga a menos (fica 200,00 em aberto)
  L('10/08/2026', '41101', 'Compras de mercadorias', 700, 'Pelas compras de mercadorias a prazo conf. NF-e - 501-' + CNPJ),
  L('25/08/2026', '10503', 'Banco', -500, 'Pagamento a fornecedores 501 - FORNECEDOR TESTE LTDA'),
  // um Pix sem a nota
  L('28/08/2026', '10503', 'Banco', -50, 'Pix enviado FORNECEDOR TESTE'),
];

describe('o razão do fornecedor', () => {
  const r = conferirRazaoDoCliente(lerRazao(RAZAO), '2026-08', 'fornecedores');
  it('as notas que o pagamento não fechou, e o saldo que a empresa deve', () => {
    expect(r.emAberto.map(n => [n.nf, n.aberto])).toEqual([['501', 200]]);
    expect(r.saldo).toBe(150);
    expect(r.saldoDoRazao).toBe(150);
  });
  it('a relação fala de compra e pagamento', () => {
    const m = razaoDaMarca('razao.xls', r, 'fornecedores');
    // a nota fiscal na coluna dela (Vitor, 07/10/2026: "Data, nota fiscal, descrição, valor")
    expect(m.itens.map(i => [i.nf, i.descricao.replace(/\s/g, ' '), i.valor, i.status])).toEqual([
      ['501', 'Compra a prazo (comprado R$ 700,00, pago R$ 500,00)', 200, 'aberto'],
      ['', 'Pix enviado FORNECEDOR TESTE', -50, 'pagamento'],
    ]);
  });
});
