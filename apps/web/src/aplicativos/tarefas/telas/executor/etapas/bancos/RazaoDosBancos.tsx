// O razão dos bancos pedido sozinho ao robô do Alterdata (Vitor, 07/11/2026: "razão ainda não foi gerado" e "não tenho o saldo
// diário" eram objeções frequentes). Ao chegar no Bancos de uma rotina ainda aberta, a empresa e os meses da etapa vão para a
// fila do robô (um pedido por empresa e mês; o que já anda ou ficou pronto há pouco é reaproveitado, no máximo 6 por hora por
// navegador). Com os meses prontos, os lançamentos viram o razão da empresa, de onde saem o saldo de cada dia (o negativo vai
// para o Cheque especial). O bloco é o mesmo da Importação (BlocoDoRobo), com o botão de pedir de novo.
import { useEtapaAberta } from '../contexto';
import { usePonteDaTarefa } from '../ponte';
import { BlocoDoRobo } from '../../../../etapas/extrator/telas/tarefa/BlocoDoRobo';
import { useRazaoDoRobo } from '../../../../etapas/extrator/telas/tarefa/useRazaoDoRobo';

export function RazaoDosBancos() {
  const { nome, codigo, meses } = useEtapaAberta();
  const ponte = usePonteDaTarefa();
  const robo = useRazaoDoRobo({ nome, codigo, meses, automatico: !ponte.etapaConcluida });
  if (!robo.disponivel) return null;
  return <div className="imp-lista"><BlocoDoRobo robo={robo} /></div>;
}
