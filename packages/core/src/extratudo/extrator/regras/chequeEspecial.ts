// O cheque especial de cada banco direto do extrato já importado (Vitor, 13/10/2026: a etapa Cheque especial acoplada na
// Tarefa, banco por banco; "só irei precisar do razão, da conta do cheque especial daquele banco e o histórico, que é
// 92029 para tudo"). Os dias que fecham negativos vêm do saldo do extrato; os que o razão já tem (o ajuste e o estorno)
// ficam de fora. Para os outros, o ajuste no próprio dia (D banco / C cheque especial) e o estorno no próximo dia do
// extrato (D cheque especial / C banco), como a ferramenta Cheque especial sempre fez (cheque-especial/regras/lancamentos).
import { gerarLancamentos, HISTORICO_PADRAO } from '../../cheque-especial/regras/lancamentos';
import type { DiaSaldo, Lancamento as LancamentoDoCheque } from '../../cheque-especial/tipos';
import type { EmpresaExtrator } from '../tipos';
import { arquivosDoBanco } from './bancos';
import { movimentoDoExtrato } from './movimento';
import { conferenciaDoBanco, diasNegativos, type DiaNegativo } from './situacaoDoBanco';

export interface ChequeEspecialDoBanco {
  /** os dias negativos do período sem o cheque especial no razão (os que vão para o arquivo) */
  faltam: DiaNegativo[];
  /** todos os dias negativos do período */
  negativos: DiaNegativo[];
  /**
   * O banco entra na etapa (Vitor, 16/11/2026: "don't compute the cheque especial in banks with the balance right", os dois): fica
   * de fora o que nunca fecha negativo no período e o que já está com o saldo certo (o razão bate com o extrato e os dias negativos
   * já têm o cheque especial).
   */
  calcula: boolean;
  /** as pendências entre o extrato e o razão no período (o cheque especial sai mesmo com elas; a tela avisa) */
  pendencias: number;
  /** os meses com o extrato e sem o razão: os dias negativos deles entram todos (não dá para ver o que o razão já tem) */
  semRazao: string[];
}

const diaLocal = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const isoLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Os dias negativos do banco no período e os que ainda faltam no razão. */
// (16/11/2026, o chamado do cheque especial que não aparecia: qualquer pendência entre o extrato e o razão — duas datas lidas um dia
// antes, por exemplo — zerava os dias negativos do banco inteiro. Os dias negativos vêm do extrato e o que falta, do razão; a
// pendência de outro lançamento não muda isso. Só sem o extrato ou o razão de algum mês é que não dá para saber.)
// (Vitor, 16/11/2026, na 429: "Tem bancos no cheque especial" — sem nenhum razão importado, o Itaú e o Santander fechavam
// negativos quase todo dia e a etapa dizia que nenhum banco precisava. O mês com o extrato e sem o razão entra com todos os
// dias negativos do extrato; o mês completo continua tirando o que o razão já tem.)
export function chequeEspecialDoBanco(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): ChequeEspecialDoBanco {
  const c = conferenciaDoBanco(e, banco, primeiro, meses, semMovimento);
  if (c.completo) {
    const pendencias = c.pendencias.reduce((t, p) => t + p.linhas.length, 0);
    return { faltam: c.faltamCheque, negativos: c.negativos, calcula: c.faltamCheque.length > 0, pendencias, semRazao: [] };
  }
  const comMovimento = meses.filter(m => !semMovimento.includes(m));
  const completos = comMovimento.filter(m => conferenciaDoBanco(e, banco, primeiro, [m]).completo);
  const temNoMes = (lado: 'banco' | 'sistema', m: string) => arquivosDoBanco(e, banco, primeiro, lado, m).some(a => a.lancamentos.some(l => l.data.startsWith(m)));
  const semRazao = comMovimento.filter(m => !completos.includes(m) && temNoMes('banco', m) && !temNoMes('sistema', m));
  const doRazao = completos.length ? conferenciaDoBanco(e, banco, primeiro, completos) : null;
  const soDoExtrato = semRazao.length ? diasNegativos(e, banco, primeiro, semRazao) : [];
  const porData = (a: DiaNegativo, b: DiaNegativo) => a.data.localeCompare(b.data);
  const faltam = [...(doRazao?.faltamCheque || []), ...soDoExtrato].sort(porData);
  const pendencias = (doRazao?.pendencias || []).reduce((t, p) => t + p.linhas.length, 0);
  return { faltam, negativos: [...(doRazao?.negativos || []), ...soDoExtrato].sort(porData), calcula: faltam.length > 0, pendencias, semRazao };
}

/**
 * Os lançamentos (ajuste e estorno) dos dias que faltam, com o histórico 92029. O saldo de cada dia é o do fim do dia no
 * extrato; o estorno vai para o próximo dia que o extrato tem (ou o próximo dia útil, no último).
 */
export function lancamentosDoChequeEspecial(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], faltam: readonly DiaNegativo[], contaBanco: string, contaCheque: string, historico: string = HISTORICO_PADRAO): LancamentoDoCheque[] {
  const ms = meses.slice().sort();
  if (!ms.length || !faltam.length) return [];
  const fim = new Map<string, number>();
  for (const l of movimentoDoExtrato(e, banco, primeiro, ms[0], ms[ms.length - 1]).linhas) {
    if (ms.includes(l.data.slice(0, 7))) fim.set(l.data, l.saldo);
  }
  const dias: DiaSaldo[] = [...fim].sort((a, b) => a[0].localeCompare(b[0])).map(([data, saldo]) => ({ data: diaLocal(data), saldo: saldo / 100 }));
  const todos = gerarLancamentos(dias, contaBanco, contaCheque, historico).lancamentos;
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
