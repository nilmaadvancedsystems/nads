// View da casca do Extratudo (a Casca comum do nads): ferramentas na barra lateral, páginas da
// ferramenta nas abas de cima. As três ferramentas desenham a tela delas dentro desta casca.
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useAvisoDeBloqueio } from '../../../comum/modoDesenvolvedor';
import { useCascaExtratudo, type PropsCascaExtratudo } from './useCascaExtratudo';

export function CascaExtratudo({ acoes, acima, children, ...p }: PropsCascaExtratudo & {
  /** ações da ferramenta, antes das da página (ex.: Cancelar do Creditor) */
  acoes?: ReactNode;
  /** linha acima da tela (ex.: "Etapa 2 de 5") */
  acima?: ReactNode;
  children: ReactNode;
}) {
  const vm = useCascaExtratudo(p);
  useAvisoDeBloqueio();
  return (
    <Casca sistema="Extratudo" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<>{acoes}<LugarDasAcoes /></>} onSecao={vm.onSecao} onPagina={vm.onPagina} onInicio={vm.inicio} onEmpresa={vm.empresaInicio}>
      {acima}
      {children}
    </Casca>
  );
}
