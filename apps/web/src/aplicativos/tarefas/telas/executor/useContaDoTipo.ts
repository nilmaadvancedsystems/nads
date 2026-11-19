// O código da conta de um tipo de razão (Caixa, INSS, Salários…), para o botão Vitor pedir o razão dela (19/11/2026): pelo
// balancete dinâmico da empresa (contabilDaEmpresa) e, sem ele, pelo nome da conta no balancete da Conferência.
import { useContasDoBalancete } from '../../etapas/conferencia/importadosNaEtapa';

type Tipo = 'caixa' | 'salarios' | 'fgts' | 'inss' | 'prolabore' | 'honorarios' | 'simples' | string;

const PELO_NOME: Record<string, RegExp> = {
  caixa: /^caixa( geral)?$/i,
  inss: /inss.*(a )?recolher/i,
  salarios: /sal[aá]rios?.*(a )?pagar/i,
  fgts: /^fgts.*(a )?recolher/i,
  prolabore: /pr[oó].?labore.*(a )?pagar/i,
  simples: /simples nacional.*(a )?recolher/i,
  honorarios: /honor[aá]rios.*(a )?pagar/i,
};
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function useContaDoTipo(empresa: string, tipo: Tipo | null, doDinamico: string): string {
  const contas = useContasDoBalancete(empresa && tipo && !doDinamico ? empresa : '');
  if (doDinamico || !tipo) return doDinamico;
  const re = PELO_NOME[tipo];
  if (!re || !contas) return '';
  const achadas = contas.filter(c => !c.sintetica && re.test(sem(c.nome)));
  return achadas.length === 1 ? achadas[0].codigo : '';
}
