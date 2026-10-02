// Movimento › Verificar por conta (página escondida; abre pelo "Revisar" do Relatório).
// Origem: conferencia.html ~L1264-1310 (#view-conferencia); com resultado na tela o formulário
// sai e fica só o resultado (vcMostrarResultado ~L3822).
import { TrilhaDoTopo } from '../../../../comum/topo';
import { Formulario } from './partes/Formulario';
import { Resultado } from './partes/Resultado';
import { useVerificarConta } from './useVerificarConta';

export function VerificarConta() {
  const vm = useVerificarConta();
  return (
    <section>
      {/* voltar é pela barra de cima: Concilia aí / 292 / Movimento / Verificar por conta (Vitor, 02/10/2026) */}
      <TrilhaDoTopo itens={[{ rotulo: 'Movimento', titulo: 'Voltar para Movimento', onClick: vm.voltar }, { rotulo: 'Verificar por conta' }]} />
      {/* o formulário só se esconde (os campos de arquivo continuam lá pro "Corrigi, quero reconferir") */}
      <Formulario vm={vm} oculto={!!vm.resultado} />
      {vm.resultado && <Resultado vm={vm} r={vm.resultado} />}
    </section>
  );
}
