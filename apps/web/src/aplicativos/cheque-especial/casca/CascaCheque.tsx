// View da casca do Cheque especial (a Casca comum do nads).
import type { empresas } from '@nads/core';
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaCheque } from './useCascaCheque';

export function CascaCheque({ empresa, rota, pagina, children }: { empresa: empresas.EmpresaDoEscritorio; rota: string; pagina: string; children: ReactNode }) {
  const vm = useCascaCheque(empresa, rota, pagina);
  return (
    <Casca sistema="Cheque especial" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<LugarDasAcoes />} onSecao={vm.onSecao} onPagina={vm.onPagina} onInicio={vm.sair} onAplicativos={vm.aplicativos}
      onEmpresa={() => vm.onPagina(pagina)} onSair={vm.sair}>
      {children}
    </Casca>
  );
}
