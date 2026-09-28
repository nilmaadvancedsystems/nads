// View da casca da empresa aberta (usa a Casca do design e o ViewModel useCascaConciliaAi).
// Nas ferramentas (Conciliadorzinho, Cheque especial), as abas, o título e as ações próprias vêm
// da ferramenta (prop `ferramenta`); a barra lateral e a empresa são sempre as do Concilia aí.
import { Casca, type PaginaCasca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaConciliaAi } from './useCascaConciliaAi';

export interface CascaDaFerramenta {
  paginas: PaginaCasca[];
  titulo: string;
  onPagina: (id: string) => void;
  /** clique no código da empresa (padrão: a página atual da ferramenta) */
  onEmpresa?: () => void;
  acoes?: ReactNode;
}

export function CascaConciliaAi({ ferramenta: f, children }: { ferramenta?: CascaDaFerramenta; children: ReactNode }) {
  const vm = useCascaConciliaAi();
  const atual = f?.paginas.find(x => x.ativa);
  return (
    <Casca
      sistema="Concilia aí"
      empresa={vm.empresa}
      versao={vm.versao}
      secoes={vm.secoes}
      paginas={f ? f.paginas : vm.paginas}
      titulo={f ? f.titulo : vm.titulo}
      acoes={<>{f?.acoes}<LugarDasAcoes /></>}
      onSecao={vm.onSecao}
      onPagina={f ? f.onPagina : vm.onPagina}
      onInicio={vm.sair}
      onEmpresa={f ? (f.onEmpresa || (() => { if (atual) f.onPagina(atual.id); })) : vm.voltarInicioDaEmpresa}
    >
      {children}
    </Casca>
  );
}
