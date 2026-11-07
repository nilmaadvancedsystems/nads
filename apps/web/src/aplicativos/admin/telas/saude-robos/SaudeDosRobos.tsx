// Admin › Saúde dos robôs (Vitor, 07/11/2026): um cartão por robô com o último batimento, o último trabalho, a fila, os últimos
// erros e o estado (ok / atenção / parado). Parado = sem batimento há mais de 15 min (ou robô desligado); atenção = batimento
// atrasado, pedido esperando há mais de 1 hora, módulo desligado ou erro sem trabalho depois; o resto é ok.
import { Dica, Esqueleto, Vazio, useCarregando } from '@nads/ui';
import { CartaoDeSaudeDoRobo } from '../../../tarefas/telas/cadastro/painel-robo/partes/CartaoDeSaudeDoRobo';
import { useSaudeDosRobos } from './useSaudeDosRobos';

export function SaudeDosRobos() {
  const vm = useSaudeDosRobos();
  useCarregando(vm.carregando);
  if (vm.semPermissao) {
    return <Vazio icone="lock" titulo="Sem acesso à saúde dos robôs" texto="Só o administrador e o diretor veem o estado dos robôs." />;
  }
  return (
    <section className="robo-painel">
      <div className="card">
        <div className="card-head">
          <h3>Estado geral
            <Dica texto="Parado: sem batimento há mais de 15 minutos ou robô desligado. Atenção: batimento atrasado (3 min), pedido esperando há mais de 1 hora, módulo desligado ou erro nas últimas 24 h sem trabalho feito depois. O robô bate o ponto a cada minuto." />
          </h3>
        </div>
        {vm.carregando ? <Esqueleto linhas={2} /> : (
          <div className={'cad-placar' + (vm.placar.tom === 'ok' ? '' : ' atencao')}>
            <span className="saude-ponto" aria-hidden="true" />
            <b>{vm.resumo}</b>
          </div>
        )}
      </div>
      <div className="robo-grade">
        {vm.carregando
          ? <><div className="card"><Esqueleto linhas={5} /></div><div className="card"><Esqueleto linhas={5} /></div></>
          : vm.cartoes.map(c => <CartaoDeSaudeDoRobo key={c.id} c={c} />)}
      </div>
    </section>
  );
}
