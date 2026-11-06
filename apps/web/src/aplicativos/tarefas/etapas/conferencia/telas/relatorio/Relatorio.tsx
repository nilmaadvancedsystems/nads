// Movimento › Relatório (#view-mov-conferencia, conferencia.html ~L1192-1231): abas
// Geral/Entradas/Saídas/Tomados/Prestados (#confSeg) — confAba (~L3371).
import { Segmentado } from '@nads/ui';
import { ForaDoPadraoFiscal } from './partes/ForaDoPadraoFiscal';
import { Geral } from './partes/Geral';
import { Servicos } from './partes/Servicos';
import { useRelatorio } from './useRelatorio';

export function Relatorio() {
  const vm = useRelatorio();
  return (
    <section>
      <Segmentado id="confSeg" valor={vm.aba} opcoes={vm.abas} onMudar={vm.escolherAba} />
      {!vm.ehServ && <Geral vm={vm} />}
      {vm.tipoNf && <ForaDoPadraoFiscal vm={vm} tipo={vm.tipoNf} />}
      {vm.tipoServ && <Servicos vm={vm} tipo={vm.tipoServ} />}
    </section>
  );
}
