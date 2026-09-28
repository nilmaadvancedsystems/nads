// Cadastro › Configurações: Entradas / Saídas / Tomados / Prestados (conferencia.html #view-cad-cfop ~L1157-1174).
// Sem ações no topo.
import { Segmentado } from '@nads/ui';
import { CadastroServicos } from './partes/CadastroServicos';
import { Naturezas } from './partes/Naturezas';
import { useConfiguracoes } from './useConfiguracoes';

export function Configuracoes() {
  const vm = useConfiguracoes();
  return (
    <section id="view-cad-cfop">
      <Segmentado id="cadSeg" valor={vm.aba} opcoes={vm.abas} onMudar={vm.mudarAba} />
      {vm.naturezas && <Naturezas n={vm.naturezas} entradas={vm.aba === 'entradas'} vm={vm} />}
      {vm.servicos && <CadastroServicos sv={vm.servicos} />}
    </section>
  );
}
