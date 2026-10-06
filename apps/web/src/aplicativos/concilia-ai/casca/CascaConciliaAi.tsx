// View da casca da empresa aberta (usa a Casca do design e o ViewModel useCascaConciliaAi).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes, useTrilhaDoTopo } from '../../../comum/topo';
import { useAvisoDeBloqueio } from '../../../comum/modoDesenvolvedor';
import { useCascaConciliaAi } from './useCascaConciliaAi';

export function CascaConciliaAi({ children }: { children: ReactNode }) {
  const vm = useCascaConciliaAi();
  const trilha = useTrilhaDoTopo();
  useAvisoDeBloqueio();
  return (
    <Casca
      sistema="Concilia aí"
      empresa={vm.empresa}
      versao={vm.versao}
      trilha={trilha}
      secoes={vm.secoes}
      paginas={vm.paginas}
      titulo={vm.titulo}
      acoes={<LugarDasAcoes />}
      onSecao={vm.onSecao}
      onPagina={vm.onPagina}
      onInicio={vm.sair}
      onEmpresa={vm.voltarInicioDaEmpresa}
      inteiroNaEtapa
      abasNaEtapa={vm.abasNaEtapa}
      onAbaNaEtapa={vm.onAbaNaEtapa}
    >
      {children}
    </Casca>
  );
}
