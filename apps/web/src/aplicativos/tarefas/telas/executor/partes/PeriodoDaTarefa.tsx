// O período em todas as etapas do Contábil (Vitor, 07/10/2026), com as peças da Importação: o botão do período (MenuSuspenso
// com o calendário, o mesmo do seletor da Importação). Fica no cabeçalho, no canto direito (Vitor, 07/10/2026: "coloque isso
// na parte superior direita da tela, dentro do cabeçalho"); o "🏛 1 banco", que ficava ao lado, vai para dentro do menu. O
// menu só mostra: os meses do período, os bancos e o aviso de que a troca é na Importação (só ela troca o período; Vitor,
// 05/10/2026).
import { Icone, MenuSuspenso } from '@nads/ui';
import { usePeriodoDaTarefa } from './usePeriodoDaTarefa';

export function PeriodoDaTarefa({ nome, codigo, meses }: { nome: string; codigo: number | null; meses: readonly string[] }) {
  const vm = usePeriodoDaTarefa(nome, codigo, meses);
  const bancos = <span className="imp-topo-num"><Icone nome="landmark" /><b>{vm.bancos}</b> {vm.bancos === 1 ? 'banco' : 'bancos'}</span>;
  return (
    <MenuSuspenso icone="calendar" rotulo={vm.rotulo} largura={300} dica={vm.dica} direita
      className={'btn btn-outline' + (vm.emLote ? ' imp-periodo-ativo' : '')}
      conteudo={() => (
        <div className="comp-pop">
          {vm.emLote ? (
            <div className="comp-varios">
              <p className="comp-varios-texto">A empresa está nos meses <b>{vm.rotulo}</b> ({vm.meses.length} meses).</p>
              <div className="imp-mes-chips">{vm.meses.map(m => <span key={m.valor} className="imp-mes-chip">{m.curto}</span>)}</div>
              {bancos}
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
              {bancos}
              <p className="hint">A competência se troca na Importação, a primeira etapa.</p>
            </div>
          )}
        </div>
      )} />
  );
}
