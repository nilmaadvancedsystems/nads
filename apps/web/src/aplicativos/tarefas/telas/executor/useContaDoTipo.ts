// O código da conta de um tipo de razão (Caixa, INSS, Salários…), para o botão Vitor pedir o razão dela (19/11/2026): a informada
// na etapa (gravada no Cadastro da empresa, "razao-<tipo>"); senão, a do balancete dinâmico; senão, pelo nome no balancete da
// Conferência. Sem nenhuma, a etapa pede para informar (Vitor, 19/11/2026: "sempre que o nads ver que nao tem a conta, pede
// para informar e grave na etapa, para o robo conseguir puxar").
import { empresas } from '@nads/core';
import { useContasDoBalancete } from '../../etapas/conferencia/importadosNaEtapa';
import { useCadastro } from '../../dados/repo';
import { useOperador } from '../../casca/operador';
import { roboDePcDoUsuario } from '../../dados/notasDoFiscal.firestore';

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
const campo = (tipo: string) => ('razao-' + tipo) as empresas.cadastro.CampoContaDoRazao;

/** informar: só para o dono do robô de PC (o botão Vitor é só dele) */
export interface ContaDoRazao { conta: string; informada: boolean; informar?: (codigo: string) => void }

/** soInformada: o nads não adivinha (os adiantamentos; Vitor, 19/11/2026: "peca a conta, o robo nao vai saber") */
export function useContaDoTipo(empresa: string, codigo: number | null, tipo: string | null, doDinamico: string, soInformada = false): ContaDoRazao {
  const vivo = useCadastro(empresa, codigo);
  const op = useOperador().operador;
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const informada = tipo ? cadastro?.contasPadrao?.contas[campo(tipo)] || '' : '';
  const contas = useContasDoBalancete(empresa && tipo && !informada && !doDinamico && !soInformada ? empresa : '');
  let conta = informada || (soInformada ? '' : doDinamico);
  if (!conta && tipo && contas && !soInformada) {
    const re = PELO_NOME[tipo];
    const achadas = re ? contas.filter(c => !c.sintetica && re.test(sem(c.nome))) : [];
    if (achadas.length === 1) conta = achadas[0].codigo;
  }
  return {
    conta, informada: !!informada,
    informar: !roboDePcDoUsuario() ? undefined : (cod: string) => {
      if (!cadastro || !tipo) return;
      const novo = empresas.cadastro.definirContaPadrao(cadastro, campo(tipo), cod.replace(/\D/g, ''), null, op?.nome || 'Tarefa', new Date());
      if (novo !== cadastro) vivo.salvar(novo);
    },
  };
}
