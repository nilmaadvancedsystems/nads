// Movimento › Verificar por conta (página escondida; abre pelo "Revisar" do Relatório).
// Origem: conferencia.html ~L1264-1310 (#view-conferencia); com resultado na tela o formulário
// sai e fica só o resultado (vcMostrarResultado ~L3822).
import { Formulario } from './partes/Formulario';
import { Resultado } from './partes/Resultado';
import { useVerificarConta } from './useVerificarConta';

export function VerificarConta() {
  const vm = useVerificarConta();
  return (
    <section>
      <button className="btn btn-ghost" id="btVoltarMov" type="button" style={{ marginBottom: 14, paddingLeft: 4 }} onClick={vm.voltar}>&larr; Voltar para Movimento</button>
      {/* o formulário só se esconde (os campos de arquivo continuam lá pro "Corrigi, quero reconferir") */}
      <Formulario vm={vm} oculto={!!vm.resultado} />
      {vm.resultado && <Resultado vm={vm} r={vm.resultado} />}
    </section>
  );
}
