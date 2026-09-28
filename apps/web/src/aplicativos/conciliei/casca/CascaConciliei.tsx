// View da casca do Conciliei: a Casca comum do nads com a caixa de ferramentas à esquerda
// (lateral="caixa", no lugar da barra lateral). Cada ferramenta passa as abas dela (páginas ou
// etapas), o título e as ações próprias; as da página entram depois, pelo <AcoesDoTopo>.
import { Casca, type PaginaCasca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import type { IdFerramenta } from './ferramentas';
import { useCascaConciliei } from './useCascaConciliei';

export function CascaConciliei(p: {
  ferramenta: IdFerramenta;
  empresa: { nome: string; codigo: number | null };
  rota: string;
  paginas: PaginaCasca[];
  titulo: string;
  onPagina: (id: string) => void;
  /** clique no código da empresa (padrão: a página atual) */
  onEmpresa?: () => void;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const vm = useCascaConciliei(p.ferramenta, p.empresa, p.rota);
  const atual = p.paginas.find(x => x.ativa);
  return (
    <Casca lateral="caixa" rotuloLateral="Ferramentas" sistema="Conciliei" empresa={vm.empresa} versao={vm.versao}
      secoes={vm.ferramentas} paginas={p.paginas} titulo={p.titulo} acoes={<>{p.acoes}<LugarDasAcoes /></>}
      onSecao={vm.abrirFerramenta} onPagina={p.onPagina} onInicio={vm.sair} onAplicativos={vm.aplicativos}
      onEmpresa={p.onEmpresa || (() => { if (atual) p.onPagina(atual.id); })}
      aplicativos={vm.menuAplicativos} onAplicativo={vm.abrirAplicativo}>
      {p.children}
    </Casca>
  );
}
