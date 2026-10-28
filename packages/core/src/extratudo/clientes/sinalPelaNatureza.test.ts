import { describe, expect, it } from 'vitest';
import { lerBalanceteDinamicoComoContas } from '../../conferencia/arquivos';
import { clientesDoDinamico, credoresNoPeriodo, lerBalanceteDinamico } from './index';

// o dinâmico "pela natureza" (Vitor, 28/10/2026): no Passivo e na Receita o credor vem positivo (dados fictícios)
const PELA_NATUREZA = [
  ['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '01/2026', '02/2026'],
  ['1', '1', 'ATIVO', 5000, 6000, 7000],
  ['100', '1.1.2.01', 'CLIENTES', 1200, 900, 700],
  ['101', '1.1.2.01.001', 'CLIENTE ALFA', 1000, 1000, 1000],
  ['102', '1.1.2.01.002', 'CLIENTE BETA', 200, -100, -300],
  ['2', '2', 'PASSIVO', 5000, 6000, 7000],
  ['320', '2.1.1.01', 'FORNECEDORES', 800, 600, 400],
  ['321', '2.1.1.01.001', 'FORNECEDOR GAMA', 800, 700, 500],
  ['322', '2.1.1.01.002', 'FORNECEDOR DELTA', 0, -100, -100],
  ['4', '4', 'RECEITAS', 0, 3000, 6000],
];
// o mesmo no jeito de sempre: devedor +, credor −
const DE_SEMPRE = PELA_NATUREZA.map((r, i) => (i && /^[24]/.test(String(r[1])) ? r.map((v, k) => (k >= 3 ? -(v as number) : v)) : r));

describe('o sinal do balancete dinâmico (de sempre × pela natureza)', () => {
  for (const [nome, rows] of [['pela natureza', PELA_NATUREZA], ['de sempre', DE_SEMPRE]] as const) {
    it(nome + ': o fornecedor credor é o certo; só o devedor aparece', () => {
      const d = lerBalanceteDinamico(rows);
      expect(clientesDoDinamico(d, '2026-02', 'fornecedores').map(x => [x.codigo, x.saldo])).toEqual([['321', 500], ['322', -100]]);
      expect(credoresNoPeriodo(d, '2026-02', 'fornecedores').map(x => x.codigo)).toEqual(['322']);
    });
    it(nome + ': o cliente devedor é o certo; só o credor aparece', () => {
      const d = lerBalanceteDinamico(rows);
      expect(clientesDoDinamico(d, '2026-02', 'clientes').map(x => [x.codigo, x.saldo])).toEqual([['101', 1000], ['102', -300]]);
      expect(credoresNoPeriodo(d, '2026-02', 'clientes').map(x => x.codigo)).toEqual(['102']);
    });
    it(nome + ': como balancete, o fornecedor credor sai C e a receita C', () => {
      const b = lerBalanceteDinamicoComoContas(rows);
      expect(b?.contas['321'].dc).toBe('C');
      expect(b?.contas['322'].dc).toBe('D');
      expect(b?.contas['4'].dc).toBe('C');
      expect(b?.contas['101'].dc).toBe('D');
    });
  }
});
