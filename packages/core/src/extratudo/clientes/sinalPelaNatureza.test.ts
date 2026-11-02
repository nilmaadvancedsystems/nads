import { describe, expect, it } from 'vitest';
import { lerBalanceteDinamicoComoContas } from '../../conferencia/arquivos';
import { credoraPelaNatureza, dinamicoPelaNatureza, grupoDasReceitas } from '../../formatos/sinalDoDinamico';
import { clientesDoDinamico, credoresNoPeriodo, lerBalanceteDinamico } from './index';

// o dinâmico "pela natureza" (Vitor, 28/10/2026): no Passivo e nas Receitas o credor vem positivo (dados fictícios), no
// plano do Alterdata: 3 = Receitas, 4 = Custos e Despesas (devedores, positivos nos dois jeitos)
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
  ['3', '3', 'RECEITAS', 0, 3000, 6000],
  ['4', '4', 'CUSTOS E DESPESAS', 0, 2000, 4000],
  ['400', '4.1.01', 'ALUGUEIS', 0, 2000, 4000],
];
// o mesmo no jeito de sempre: devedor +, credor − (só o Passivo e as Receitas mudam; as despesas são devedoras nos dois)
const DE_SEMPRE = PELA_NATUREZA.map((r, i) => (i && /^[23]/.test(String(r[1])) ? r.map((v, k) => (k >= 3 ? -(v as number) : v)) : r));

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
    it(nome + ': como balancete, o fornecedor credor sai C, a receita C e a despesa D', () => {
      const b = lerBalanceteDinamicoComoContas(rows as unknown as string[][]);
      expect(b?.contas['321'].dc).toBe('C');
      expect(b?.contas['322'].dc).toBe('D');
      expect(b?.contas['3'].dc).toBe('C');
      expect(b?.contas['400'].dc).toBe('D');
      expect(b?.contas['101'].dc).toBe('D');
    });
  }

  it('o de sempre com despesa (o 4 positivo) e sem receita não vira "pela natureza" (30/10/2026)', () => {
    // só despesa no resultado: antes o 4 positivo era tomado como Receita credora e trocava o sinal do Passivo e do 4
    const soDespesa = DE_SEMPRE.filter(r => String(r[1]) !== '3');
    const linhas = soDespesa.slice(1).map(r => ({ classificacao: String(r[1]), descricao: String(r[2]), valores: r.slice(3) as number[] }));
    expect(dinamicoPelaNatureza(linhas)).toBe(false);
    const b = lerBalanceteDinamicoComoContas(soDespesa as unknown as string[][]);
    expect(b?.contas['321'].dc).toBe('C');
    expect(b?.contas['400'].dc).toBe('D');
    expect(lerBalanceteDinamico(soDespesa).linhas.find(l => l.codigo === '321')?.saldos['2026-02']).toBe(-500);
  });

  it('as contas credoras pela natureza: o Passivo e as Receitas (o 3; o 4 é Custos e Despesas)', () => {
    expect(['2', '2.1.1.01', '3', '3.1.01', '4', '4.1.01', '1.1', '21'].map(c => credoraPelaNatureza(c))).toEqual([true, true, true, true, false, false, false, false]);
    // o grupo das Receitas pelo nome, quando o plano não é o do Alterdata
    expect(grupoDasReceitas([{ classificacao: '3', descricao: 'CUSTOS' }, { classificacao: '4', descricao: 'RECEITAS OPERACIONAIS' }])).toBe('4');
    expect(grupoDasReceitas([{ classificacao: '1', descricao: 'ATIVO' }])).toBe('3');
    expect(credoraPelaNatureza('4.1', '4')).toBe(true);
  });
});
