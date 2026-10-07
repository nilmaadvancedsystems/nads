// A etapa Empréstimos e financiamentos (Vitor, 07/10/2026: "monte uma tela para o usuário upar os razões e selecionar o
// banco daquele empréstimo"): um razão por contrato, cada um com o banco dele. O banco já vem sugerido pelo próprio razão
// (a contrapartida das parcelas é a conta contábil do banco no Cadastro). A conta é do passivo: fica credora ou zera.
import type { RazaoDaConta, MesDoRazao } from './razao';

/** Um banco da empresa no Cadastro, com a conta contábil dele (ex.: 10503). */
export interface BancoDoEmprestimo { id: string; nome: string; contaContabil?: string }

/**
 * O banco do empréstimo pelo razão: a conta contábil do banco que mais aparece de contrapartida (as parcelas pagas e o
 * crédito do empréstimo). null = nenhuma contrapartida é conta de banco do Cadastro.
 */
export function bancoDoRazao(r: RazaoDaConta, bancos: readonly BancoDoEmprestimo[]): string | null {
  const conta = new Map(bancos.filter(b => b.contaContabil).map(b => [b.contaContabil as string, b.id]));
  const vezes = new Map<string, number>();
  for (const l of r.lancamentos) {
    const id = conta.get(l.contrapartida.trim());
    if (id) vezes.set(id, (vezes.get(id) || 0) + 1);
  }
  return [...vezes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Os meses que fecham devedor (o saldo do fim do mês negativo no Alterdata): empréstimo é passivo, fica credor ou zera. */
export function mesesDevedores(meses: readonly MesDoRazao[]): string[] {
  return meses.filter(m => m.saldoFinal < -0.005).map(m => m.mes);
}
