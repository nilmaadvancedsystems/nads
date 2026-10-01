// Cadastro › Configurações: as chaves do nads (só o admin muda): a proteção do login (liberar cada computador com o
// código de um admin), o robô que lê a agência e a conta dos extratos e a saúde do robô do Entregas.
import { Esqueleto, Icone, Interruptor, useCarregando, useEntradaAnimada } from '@nads/ui';
import { useConfiguracoesDoNads } from './useConfiguracoesDoNads';

export function ConfiguracoesDoNads() {
  const vm = useConfiguracoesDoNads();
  useCarregando(vm.carregando);
  // a saúde do robô: os itens chegam em cascata na primeira leitura (a releitura de 30 em 30 s não anima)
  const saude = useEntradaAnimada<HTMLDivElement>('.saude-lista', [!!vm.saude], 'repetida');
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
      {vm.veSaude && (
        <div ref={saude} className="card config-item">
          <div className="config-item-topo">
            <Icone nome="monitor" />
            <div>
              <h3>Saúde do robô</h3>
              <p className="fraco">O robô da nuvem (Gmail, Drive, cobrança) e o arquivador do PC do escritório. Atualiza sozinho a cada 30 segundos.</p>
            </div>
          </div>
          {!vm.saude ? <Esqueleto linhas={4} className="config-detalhe" /> : (
            <ul className="saude-lista">
              {vm.saude.map(i => (
                <li key={i.id} className={'saude-' + i.tom}>
                  <span className="saude-ponto" aria-hidden="true" />
                  <span className="saude-rotulo">{i.rotulo}</span>
                  <span className="saude-texto">{i.texto}{i.detalhe && <span className="fraco">{i.detalhe}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
