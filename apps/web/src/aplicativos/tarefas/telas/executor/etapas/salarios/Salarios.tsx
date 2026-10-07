// A etapa Salários, INSS e FGTS como tela própria (Vitor, 07/10/2026): a mesma conferência de antes (Salários a pagar,
// INSS a recolher e FGTS a recolher), agora dizendo à Tarefa o que falta — o mês devedor trava o Próximo.
import { tarefas } from '@nads/core';
import { InssDaEtapa } from '../../partes/InssDaEtapa';
import { useSalarios } from './useSalarios';

const CONFERIR = tarefas.ROTINA_CONTABIL.etapas.find(e => e.id === 'folha')?.conferir;

export function Salarios() {
  const vm = useSalarios();
  return <InssDaEtapa inss={vm.inss} conferir={CONFERIR} teste={vm.teste} folha={vm.folha} />;
}
