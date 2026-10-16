// A aba Agenda da Área do Cliente (Vitor, 16/10/2026): o que vence no mês escolhido e se o escritório já fez. Como as
// colunas do protótipo: o que ainda falta, o que já foi feito e o que não precisa neste mês, cada uma com o seu contador.
import { Icone, SeletorMes } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useAgenda } from './useAgenda';
import type { DaCasca } from './useAreaCliente';

export function Agenda(props: DaCasca) {
  const vm = useAgenda(props);
  return (
    <>
      <div className="cli-barra">
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês da agenda" max={vm.ultimo} />
        {vm.itens.length > 0 && (
          <span className="cli-barra-resumo">
            <span className="cli-selo cli-selo-ok">{vm.feitos} feito(s)</span>
            <span className={'cli-selo ' + (vm.aFazer ? 'cli-selo-warn' : 'cli-selo-ok')}>{vm.aFazer} por fazer</span>
          </span>
        )}
      </div>
      {vm.itens.length ? (
        <div className="cli-colunas">
          {vm.colunas.map(col => (
            <section key={col.id} className={'cli-grupo cli-grupo-' + col.tom}>
              <div className="cli-grupo-topo"><h2>{col.titulo}</h2><span className="cli-grupo-conta">{col.itens.length}</span></div>
              {col.itens.length
                ? <ul className="cli-lista">{col.itens.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
                : <p className="cli-grupo-vazio">{col.vazio}</p>}
            </section>
          ))}
        </div>
      ) : (
        <div className="cli-cartao cli-vazio">
          <span className="cli-vazio-ico"><Icone nome="calendar" width={26} height={26} /></span>
          <h3>Nada marcado para este mês</h3>
          <p>Escolha outro mês no calendário acima.</p>
        </div>
      )}
    </>
  );
}
