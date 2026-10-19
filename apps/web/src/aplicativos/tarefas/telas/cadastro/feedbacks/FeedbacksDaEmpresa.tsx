// Os feedbacks de uma empresa (Vitor, 19/10/2026): liga o BlocoDeFeedbacks aos dados e às ações. Na janela da empresa do
// Cadastro (o sênior, o diretor e o admin escrevem; todos, abertos e resolvidos) e na página da empresa (soAbertos: só os
// em aberto, e o bloco some quando não há nenhum).
import { BlocoDeFeedbacks } from './partes/BlocoDeFeedbacks';
import { useFeedbacksDaEmpresa } from './useFeedbacksDaEmpresa';

export function FeedbacksDaEmpresa({ nome, codigo, soAbertos }: { nome: string; codigo: number | null; soAbertos?: boolean }) {
  const vm = useFeedbacksDaEmpresa({ nome, codigo });
  if (soAbertos && (vm.carregando || !vm.abertos)) return null;
  return (
    <BlocoDeFeedbacks linhas={soAbertos ? vm.linhas.filter(l => !l.resolvido) : vm.linhas} abertos={vm.abertos} carregando={vm.carregando} erro={vm.erro} podeEscrever={vm.podeEscrever}
      texto={vm.texto} prioridade={vm.prioridade} aoMudarTexto={vm.setTexto} aoMudarPrioridade={vm.setPrioridade}
      aoEnviar={() => void vm.enviar()} enviando={vm.enviando} ocupado={vm.ocupado}
      aoResolver={(id, r) => void vm.resolver(id, r)} aoApagar={id => void vm.apagar(id)} />
  );
}
