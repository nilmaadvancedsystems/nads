// Cadastro › Configurações: as chaves do nads (só o admin muda): a proteção do login (liberar cada computador com o
// código de um admin) e o robô que lê a agência e a conta dos extratos.
import { Icone, Interruptor, useCarregando } from '@nads/ui';
import { useConfiguracoesDoNads } from './useConfiguracoesDoNads';

export function ConfiguracoesDoNads() {
  const vm = useConfiguracoesDoNads();
  useCarregando(vm.carregando);
  return (
    <section className="config-nads">
      {!vm.admin && <p className="hint">Só um administrador muda as configurações.</p>}
      <div className="card config-item">
        <div className="config-item-topo">
          <Icone nome="lock" />
          <div>
            <h3>Proteção do login</h3>
            <p className="fraco">Quem entrar num computador ainda não liberado precisa do código de um administrador. O pedido aparece no canto da
              tela dos administradores; quem aprova recebe o código e passa para a pessoa. Os administradores não precisam de liberação.</p>
          </div>
          <Interruptor ligado={vm.protecao} onMudar={() => void vm.alternarProtecao()} rotulo="Proteção do login" />
        </div>
        <p className="fraco config-detalhe">{vm.liberados} {vm.liberados === 1 ? 'login liberado' : 'logins liberados'} · {vm.pendentes} {vm.pendentes === 1 ? 'pedido esperando' : 'pedidos esperando'} (em Usuários, cada pessoa mostra os computadores dela).</p>
      </div>
      <div className="card config-item">
        <div className="config-item-topo">
          <Icone nome="robo" />
          <div>
            <h3>Robô lê agência e conta</h3>
            <p className="fraco">O robô do Entregas lê a agência e a conta do cabeçalho dos extratos (Gmail e Drive) e o Cadastro mostra em "O robô já sabe".</p>
          </div>
          <Interruptor ligado={vm.robo} onMudar={() => void vm.alternarRobo()} rotulo="Robô lê agência e conta" />
        </div>
      </div>
    </section>
  );
}
