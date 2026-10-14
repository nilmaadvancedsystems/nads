// As chaves do nads, na organização nova do Cadastro (Vitor, 13/10/2026: "reveja a estrutura inteira do cadastro"):
//   - ProtecaoDoLogin: a faixa no topo de Cadastro › Equipe (liberar cada computador com o código de um admin);
//   - RobosEAgentes: Cadastro › Sistema e agentes ("troca de robô para sistema") — a saúde do sistema (a nuvem e o PC), a leitura da agência e da conta
//     dos extratos, e os agentes do Claude Code (o painel ao vivo). Antes ficavam espalhados em Configurações e Agentes.
// Só o admin muda as chaves.
import { Dica, Esqueleto, Icone, Interruptor, useCarregando, useEntradaAnimada } from '@nads/ui';
import { useState } from 'react';
import { PainelDosAgentes } from '../agentes/PainelDosAgentes';
import { useConfiguracoesDoNads } from './useConfiguracoesDoNads';

/** A faixa da proteção do login, no topo da Equipe. */
export function ProtecaoDoLogin() {
  const vm = useConfiguracoesDoNads();
  if (vm.carregando) return null;
  return (
    <div className="cad-faixa">
      <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="lock" /></span>
      <div className="cad-faixa-texto">
        <b>Proteção do login
          <Dica texto="Quem entrar num computador ainda não liberado precisa do código de um administrador. O pedido aparece no canto da tela dos administradores; quem aprova recebe o código e passa para a pessoa. Os administradores não precisam de liberação." />
        </b>
        <span className="hint">
          {vm.liberados} {vm.liberados === 1 ? 'computador liberado' : 'computadores liberados'}
          {vm.pendentes > 0 && <> · <b>{vm.pendentes} {vm.pendentes === 1 ? 'pedido esperando' : 'pedidos esperando'}</b></>}
        </span>
      </div>
      <Interruptor ligado={vm.protecao} onMudar={() => void vm.alternarProtecao()} rotulo="Proteção do login" />
    </div>
  );
}

/** Cadastro › Robôs e agentes. */
export function RobosEAgentes() {
  const vm = useConfiguracoesDoNads();
  useCarregando(vm.carregando);
  // a saúde do robô: os itens chegam em cascata na primeira leitura (a releitura de 30 em 30 s não anima)
  const saude = useEntradaAnimada<HTMLDivElement>('.saude-lista', [!!vm.saude], 'repetida');
  // enxuto (13/10/2026: "achei com muita informação"): o placar e só o que precisa de atenção; "Ver todos" abre o resto
  const [todos, setTodos] = useState(false);
  const problemas = (vm.saude || []).filter(i => i.tom === 'erro' || i.tom === 'aviso');
  const mostrar = todos ? vm.saude || [] : problemas;
  return (
    <section className="cad-robos">
      {!vm.admin && <p className="hint">Só um administrador liga ou desliga; aqui você acompanha.</p>}
      <div className="cad-robos-grade">
        {vm.veSaude && (
          <div ref={saude} className="card cad-secao">
            <div className="cad-secao-topo">
              <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="monitor" /></span>
              <h3>Saúde do sistema
                <Dica texto="O sistema na nuvem (Gmail, Drive, cobrança) e no PC do escritório (arquivador, SIEG, painel dos agentes). Atualiza sozinho a cada 30 segundos." />
              </h3>
            </div>
            {!vm.saude ? <Esqueleto linhas={4} /> : (
              <>
              <div className={'cad-placar' + (problemas.length ? ' atencao' : '')}>
                <span className="saude-ponto" aria-hidden="true" />
                <b>{problemas.length ? (problemas.length === 1 ? '1 item precisa de atenção' : problemas.length + ' itens precisam de atenção') : 'Tudo funcionando'}</b>
                <span className="tarefas-barra-espaco" />
                <button type="button" className="btn btn-ghost" onClick={() => setTodos(t => !t)}>{todos ? 'Só o que precisa de atenção' : 'Ver todos (' + vm.saude.length + ')'}</button>
              </div>
              {mostrar.length > 0 && <ul className="saude-lista">
                {mostrar.map(i => (
                  <li key={i.id} className={'saude-' + i.tom}>
                    <span className="saude-ponto" aria-hidden="true" />
                    <span className="saude-rotulo">{i.rotulo}</span>
                    <span className="saude-texto">{i.texto}{i.detalhe && <span className="fraco">{i.detalhe}</span>}</span>
                  </li>
                ))}
              </ul>}
              </>
            )}
          </div>
        )}
        <div className="card cad-secao">
          <div className="cad-secao-topo">
            <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="settings" /></span>
            <h3>O que o sistema faz</h3>
          </div>
          <div className="cad-chave">
            <div className="cad-chave-texto">
              <b>Ler a agência e a conta dos extratos
                <Dica texto='O sistema lê a agência e a conta do cabeçalho dos extratos que chegam pelo Gmail e pelo Drive; a lista de empresas usa quando a empresa ainda não tem os bancos cadastrados.' />
              </b>
              <span className="hint">Gmail e Drive</span>
            </div>
            <Interruptor ligado={vm.robo} onMudar={() => void vm.alternarRobo()} rotulo="Ler a agência e a conta dos extratos" />
          </div>
        </div>
      </div>
      <h2 className="cad-titulo-secao"><Icone nome="robo" />Agentes do Claude
        <Dica texto="As sessões do Claude Code do PC do escritório, ao vivo: o que cada agente está fazendo. Clique numa sessão para ver como está funcionando. Só o admin vê." />
      </h2>
      <PainelDosAgentes />
    </section>
  );
}
