// O cheque especial de cada banco direto do extrato já importado (Vitor, 13/10/2026: a etapa Cheque especial acoplada na
// Tarefa, banco por banco; "só irei precisar do razão, da conta do cheque especial daquele banco e o histórico, que é
// 92029 para tudo"). Os dias que fecham negativos vêm do saldo do extrato; os que o razão já tem (o ajuste e o estorno)
// ficam de fora. Para os outros, o ajuste no próprio dia (D banco / C cheque especial) e o estorno no próximo dia do
// extrato (D cheque especial / C banco), como a ferramenta Cheque especial sempre fez (cheque-especial/regras/lancamentos).
import { gerarLancamentos, HISTORICO_PADRAO } from '../../cheque-especial/regras/lancamentos';
import type { DiaSaldo, Lancamento as LancamentoDoCheque } from '../../cheque-especial/tipos';
import type { EmpresaExtrator } from '../tipos';
import { movimentoDoExtrato } from './movimento';
import { situacaoDoBancoNoPeriodo, type DiaNegativo } from './situacaoDoBanco';

export interface ChequeEspecialDoBanco {
  /** os dias negativos do período sem o cheque especial no razão (os que vão para o arquivo) */
  faltam: DiaNegativo[];
  /** todos os dias negativos do período */
  negativos: DiaNegativo[];
}

const diaLocal = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const isoLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Os dias negativos do banco no período e os que ainda faltam no razão. */
export function chequeEspecialDoBanco(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): ChequeEspecialDoBanco {
  const s = situacaoDoBancoNoPeriodo(e, banco, primeiro, meses, semMovimento);
  if (s.tipo === 'pendente') return { faltam: [], negativos: [] };
  return s.tipo === 'falta-cheque' ? { faltam: s.faltam, negativos: s.negativos } : { faltam: [], negativos: s.negativos };
}

/**
 * Os lançamentos (ajuste e estorno) dos dias que faltam, com o histórico 92029. O saldo de cada dia é o do fim do dia no
 * extrato; o estorno vai para o próximo dia que o extrato tem (ou o próximo dia útil, no último).
 */
export function lancamentosDoChequeEspecial(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], faltam: readonly DiaNegativo[], contaBanco: string, contaCheque: string): LancamentoDoCheque[] {
  const ms = meses.slice().sort();
  if (!ms.length || !faltam.length) return [];
  const fim = new Map<string, number>();
  for (const l of movimentoDoExtrato(e, banco, primeiro, ms[0], ms[ms.length - 1]).linhas) {
    if (ms.includes(l.data.slice(0, 7))) fim.set(l.data, l.saldo);
  }
  const dias: DiaSaldo[] = [...fim].sort((a, b) => a[0].localeCompare(b[0])).map(([data, saldo]) => ({ data: diaLocal(data), saldo: saldo / 100 }));
  const todos = gerarLancamentos(dias, contaBanco, contaCheque, HISTORICO_PADRAO).lancamentos;
  // só o par (ajuste e o estorno logo depois) dos dias que faltam no razão
  const querem = new Set(faltam.map(f => f.data));
  const out: LancamentoDoCheque[] = [];
  let levaOEstorno = false;
  for (const l of todos) {
    if (l.tipo === 'Estorno') { if (levaOEstorno) out.push(l); levaOEstorno = false; }
    if (l.tipo === 'Ajuste') { levaOEstorno = querem.has(isoLocal(l.data)); if (levaOEstorno) out.push(l); }
  }
  return out;
}
