// Fiscal › SIEG (31/10/2026): a empresa e o mês na barra; embaixo, o painel do SIEG da rotina (as notas do mês com Contar
// agora e Baixar XMLs) e a sequência das saídas. Só as peças do catálogo (Botão com borda, busca curta, SeletorMes, Vazio).
import { SeletorMes, Vazio } from '@nads/ui';
import { SiegDaEtapa } from '../../executor/partes/SiegDaEtapa';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { useBaixarDoSieg } from './useBaixarDoSieg';

export function BaixarDoSieg() {
  const vm = useBaixarDoSieg();
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <EmpresaDaBarra vm={vm} id="sieg-empresas" />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
      </div>
      {!vm.empresa
        ? <div className="card fc-cartao"><Vazio icone="download" titulo="Escolha a empresa" texto="Depois o mês: as notas do SIEG e o Baixar XMLs." /></div>
        : (
          <>
            <SiegDaEtapa key={'c' + vm.empresa.codigo + vm.competencia} tipo="contagem" codigo={String(vm.empresa.codigo)} competencia={vm.competencia} />
            <SiegDaEtapa key={'s' + vm.empresa.codigo + vm.competencia} tipo="saidas" codigo={String(vm.empresa.codigo)} competencia={vm.competencia} />
          </>
        )}
    </section>
  );
}
