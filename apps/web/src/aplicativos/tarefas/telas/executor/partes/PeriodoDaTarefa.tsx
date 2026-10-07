// A linha do período em todas as etapas do Contábil (Vitor, 07/10/2026), com as peças da Importação: o botão do período
// (MenuSuspenso com o calendário, o mesmo do seletor da Importação) e o "🏛 1 banco" ao lado. O menu só mostra: os meses
// do período e o aviso de que a troca é na Importação (só ela troca o período; Vitor, 05/10/2026).
import { Icone, MenuSuspenso } from '@nads/ui';
import type { ReactNode } from 'react';
import { usePeriodoDaTarefa } from './usePeriodoDaTarefa';

export function PeriodoDaTarefa({ nome, codigo, meses, children }: { nome: string; codigo: number | null; meses: readonly string[]; children?: ReactNode }) {
  const vm = usePeriodoDaTarefa(nome, codigo, meses);
  return (
    <div className="imp-topo">
      <MenuSuspenso icone="calendar" rotulo={vm.rotulo} largura={300} dica={vm.dica}
        className={'btn btn-outline' + (vm.emLote ? ' imp-periodo-ativo' : '')}
        conteudo={() => (
          <div className="comp-pop">
            {vm.emLote ? (
              <div className="comp-varios">
                <p className="comp-varios-texto">A empresa está nos meses <b>{vm.rotulo}</b> ({vm.meses.length} meses).</p>
                <div className="imp-mes-chips">{vm.meses.map(m => <span key={m.valor} className="imp-mes-chip">{m.curto}</span>)}</div>
                <p className="hint">O período se troca na Importação, a primeira etapa.</p>
              </div>
            ) : (
              <div className="comp-varios">
                <div className="comp-lista">
                  {vm.meses.map(m => (
                    <span key={m.valor} className="popover-item" role="menuitem" aria-disabled="true">
                      <span className="popover-marca"><Icone nome="check" /></span>
                      <span className="popover-texto">{m.rotulo}</span>
                    </span>
                  ))}
                </div>
                <p className="hint">A competência se troca na Importação, a primeira etapa.</p>
              </div>
            )}
          </div>
        )} />
      <span className="imp-topo-num"><Icone nome="landmark" /><b>{vm.bancos}</b> {vm.bancos === 1 ? 'banco' : 'bancos'}</span>
      <span className="imp-topo-meio" />
      {children}
    </div>
  );
}
