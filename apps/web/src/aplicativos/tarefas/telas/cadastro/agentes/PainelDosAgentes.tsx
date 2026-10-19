// Os agentes do Claude em Cadastro › Sistema e agentes (Vitor, 13/10/2026: "tem como upar uma página no nads disso?";
// 14/10/2026: separado por computador, só admin, só computadores cadastrados). As conversas de cada computador (o nome
// dele é o cabeçalho do grupo): o nome da conversa, a pasta, o estado, o nível do porteiro, o pedido, o que faz agora e os
// subagentes; as inativas recolhidas numa faixa. Embaixo, os computadores: cadastrar (a chave aparece uma vez), renomear
// e desativar. Clicar numa conversa abre a janela "Como está funcionando".
import { Alerta, Esqueleto, Icone, useCarregando } from '@nads/ui';
import { createPortal } from 'react-dom';
import type { AgenteNoPainel } from '../../../dados/agentes';
import { JanelaDaExplicacao } from './JanelaDaExplicacao';
import { NIVEL, STATUS, nomeDaFerramenta, useAgentesNoPainel, type ConversaNaTela } from './useAgentesNoPainel';

const limpo = (t: string) => t.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();

/** O que o agente faz agora, numa linha: a ferramenta e o alvo. */
const fazendo = (a: AgenteNoPainel) => (a.agora ? nomeDaFerramenta(a.agora.fer) + (a.agora.txt ? ' · ' + limpo(a.agora.txt) : '') : '');

function Conversa({ s, abrir }: { s: ConversaNaTela; abrir: (id: string) => void }) {
  const st = STATUS[s.status] || STATUS.parado;
  const principal = s.agentes.find(a => a.chave === 'principal');
  const subs = s.agentes.filter(a => a.chave !== 'principal');
  const rodando = subs.filter(a => a.status === 'trabalhando');
  const terminaram = subs.length - rodando.length;
  const agora = principal ? fazendo(principal) : '';
  const titulo = s.titulo || s.projeto || 'Conversa';
  return (
    <div className="ag-conversa" role="button" tabIndex={0} aria-label={'Como está funcionando: ' + titulo}
      onClick={() => abrir(s.sessao)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(s.sessao); } }}>
      <div className="ag-conversa-topo">
        <b className="ag-conversa-titulo">{titulo}</b>
        {s.titulo && s.projeto && <span className="ag-conversa-pasta">{s.projeto}</span>}
        <span className={'badge ' + st.badge}>{st.rotulo}</span>
        {s.nivel && <span className="badge badge-neutral">{NIVEL[s.nivel] || s.nivel}</span>}
        <span className="ag-conversa-ha">{s.haQuanto}</span>
      </div>
      {s.pedido && <p className="ag-conversa-linha" title={limpo(s.pedido)}><b>Pedido:</b> {limpo(s.pedido)}</p>}
      {s.status === 'esperando' && s.aviso
        ? <p className="ag-conversa-linha"><b>Esperando você:</b> {limpo(s.aviso)}</p>
        : agora ? <p className="ag-conversa-linha" title={agora}><b>Agora:</b> {agora}</p> : null}
      {subs.length > 0 && (
        <div className="ag-conversa-agentes">
          {rodando.map(a => <span key={a.chave} className="badge badge-ok" title={fazendo(a)}>{a.tipo}{a.modelo ? ' · ' + a.modelo : ''}</span>)}
          {terminaram > 0 && <span className="badge badge-neutral">{terminaram === 1 ? '1 terminou' : terminaram + ' terminaram'}</span>}
        </div>
      )}
    </div>
  );
}

export function PainelDosAgentes() {
  const vm = useAgentesNoPainel();
  useCarregando(!vm.carregada);
  if (vm.erro) return <Alerta naLinha titulo="Sem o painel" texto={vm.erro}><div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => location.reload()}>Tentar de novo</button></div></Alerta>;
  if (!vm.carregada) return <Esqueleto linhas={4} />;
  return (
    <>
      {vm.grupos.length > 0 && (
        <p className="hint">
          {vm.trabalhando} trabalhando · {vm.esperando} esperando você{vm.exemplos ? ' · dados de exemplo' : ''}
        </p>
      )}
      {vm.grupos.map(g => (
        <div key={g.chave} className="card">
          <h3>{g.nome}</h3>
          {g.ativas.map(s => <Conversa key={s.sessao} s={s} abrir={vm.abrir} />)}
          {!g.ativas.length && <p className="hint">Nenhuma conversa ativa.</p>}
          {g.inativas.length > 0 && (
            <div className={'imp-faixa' + (g.inativasAbertas ? ' aberta' : '')}>
              <button className="imp-faixa-barra" type="button" aria-expanded={g.inativasAbertas} onClick={() => vm.alternarInativas(g.chave)}>
                <Icone nome="caretDown" className="imp-faixa-seta" /><b>Inativas</b><span className="imp-faixa-qtd">{g.inativas.length}</span>
              </button>
              {g.inativasAbertas && <div className="imp-faixa-corpo">{g.inativas.map(s => <Conversa key={s.sessao} s={s} abrir={vm.abrir} />)}</div>}
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <h3>Computadores</h3>
        {vm.chaveMostrada && (
          <div className="ag-chave-caixa"><Alerta naLinha tom="ok" titulo={'A chave de ' + vm.chaveMostrada.nome} texto="Cole no instalador do kit (instalar.ps1) nesse computador. Ela não aparece de novo.">
            <p className="ag-chave"><button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={vm.copiarChave}>{vm.chaveMostrada.chave}</button></p>
            <button type="button" className="btn" onClick={vm.esconderChave}>Pronto</button>
          </Alerta></div>
        )}
        {vm.computadores.length > 0 ? (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Nome</th><th className="num">Conversas ativas</th><th>Cadastrado</th><th aria-label="Ações" /></tr></thead>
              <tbody>
                {vm.computadores.map(m => (
                  <tr key={m.chave}>
                    <td>
                      {vm.renomeando?.chave === m.chave ? (
                        <input type="text" aria-label="Nome do computador" value={vm.renomeando.nome} autoFocus
                          onChange={e => vm.mudarNome(e.target.value)} onBlur={vm.salvarNome}
                          onKeyDown={e => { if (e.key === 'Enter') vm.salvarNome(); if (e.key === 'Escape') vm.cancelarNome(); }} />
                      ) : (
                        <><b>{m.nome}</b>{!m.ativo && <> <span className="badge badge-neutral">Desativado</span></>}</>
                      )}
                    </td>
                    <td className="num">{m.ativo ? m.conversasAtivas : '—'}</td>
                    <td>{m.desde}{m.criadoPor ? ' · ' + m.criadoPor : ''}</td>
                    <td className="ag-acoes">
                      <button type="button" className="icon-btn" title="Renomear" aria-label={'Renomear ' + m.nome} onClick={() => vm.renomear(m)}><Icone nome="lapis" /></button>
                      <button type="button" className={m.ativo ? 'btn btn-danger' : 'btn'} onClick={() => vm.alternar(m)}>{m.ativo ? 'Desativar' : 'Reativar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gh-blank">
            <Icone nome="monitor" />
            <h4>Nenhum computador cadastrado</h4>
            <p>Cadastre o computador e cole a chave no instalador do kit.</p>
          </div>
        )}
        <form className="ag-novo" onSubmit={e => { e.preventDefault(); void vm.cadastrar(); }}>
          <div className="field">
            <label htmlFor="agNovoComputador">Cadastrar computador</label>
            <div className="ag-novo-linha">
              <input id="agNovoComputador" type="text" placeholder="Ex.: PC do Fiscal" value={vm.nome} maxLength={60} onChange={e => vm.setNome(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={vm.cadastrando}>{vm.cadastrando ? <><span className="btn-spinner" />Cadastrando…</> : <><Icone nome="plus" />Cadastrar</>}</button>
            </div>
          </div>
        </form>
      </div>
      {vm.explicacao && createPortal(<JanelaDaExplicacao e={vm.explicacao} fechar={vm.fechar} />, document.body)}
    </>
  );
}
