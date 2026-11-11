// Área do Cliente › Solicitações (Vitor, 16/10/2026): o que os clientes pediram. Filtro por situação, busca, a linha abre
// a solicitação embaixo; ali o escritório responde (o cliente vê "Escritório") e muda a situação. Sem chat (11/11/2026:
// "por existir o WhatsApp, não precisa de um chat"): o pedido e a resposta, um embaixo do outro; responder pode já concluir.
import { areaCliente as ac } from '@nads/core';
import { Alerta, Esqueleto, Icone, MenuSuspenso, Segmentado, useCarregando } from '@nads/ui';
import { Fragment } from 'react';
import { SITUACOES_DO_CHAMADO } from '../../dados/areaCliente';
import { PedidoDoChamado } from './partes/PedidoDoChamado';
import { FILTROS_DOS_CHAMADOS, rotuloDoFiltro, rotuloDoTipo, useChamadosDoCliente } from './useChamadosDoCliente';

const SELO = { aberto: 'badge badge-warn', 'em andamento': 'badge badge-neutral', respondido: 'badge badge-conferido', concluido: 'badge badge-ok' } as const;

export function ChamadosDoCliente() {
  const vm = useChamadosDoCliente();
  useCarregando(vm.carregando);
  const d = vm.detalhe;
  return (
    <section>
      {vm.exemplos && (
        <div className="alerta-linha">
          <Alerta titulo="Dados de exemplo" texto="As solicitações são de mentira e as respostas ficam só neste navegador." />
        </div>
      )}
      {vm.erro && (
        <div className="alerta-linha">
          <Alerta titulo="O banco não deixou ler as solicitações" texto={vm.erro} />
        </div>
      )}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <Segmentado valor={vm.filtro} onMudar={vm.setFiltro}
          opcoes={FILTROS_DOS_CHAMADOS.map(f => ({ valor: f, rotulo: rotuloDoFiltro(f) + ' (' + vm.contagem(f) + ')' }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa ou assunto" aria-label="Buscar solicitação" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : (
        // sem a rolagem própria: a solicitação abre embaixo da linha e só a página rola (11/11/2026)
        <div className="table-wrap mandei-central">
          <table className="table-compact">
            <thead><tr><th>Empresa</th><th>Assunto</th><th>Situação</th><th>Atualizado</th></tr></thead>
            <tbody>
              {vm.linhas.map(c => (
                <Fragment key={c.id}>
                  <tr className="linha-abre" tabIndex={0} onClick={() => vm.abrir(c.id)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(c.id); }} aria-expanded={d?.id === c.id}>
                    <td className="wrap">{c.empresa}</td>
                    <td className="wrap"><b>{c.titulo}</b><span className="hint" style={{ display: 'block' }}>{rotuloDoTipo(c.tipo)}</span></td>
                    <td><span className={SELO[c.situacao]}>{ac.ROTULO_DA_SITUACAO_DO_CHAMADO[c.situacao]}</span></td>
                    <td className="fraco">{vm.data(c.atualizadoEm)}</td>
                  </tr>
                  {d?.id === c.id && (
                    <tr><td colSpan={4}>
                      <div className="card" style={{ margin: '4px 0 8px' }}>
                        <div className="card-head">
                          <h3>{d.titulo}</h3>
                          <span className="card-head-ctl">
                            <MenuSuspenso rotulo={'Situação: ' + ac.ROTULO_DA_SITUACAO_DO_CHAMADO[d.situacao]} className="btn btn-outline" direita dica="Mudar a situação da solicitação"
                              itens={SITUACOES_DO_CHAMADO.map(s => ({ rotulo: ac.ROTULO_DA_SITUACAO_DO_CHAMADO[s], marcado: d.situacao === s, onClick: () => void vm.mudarSituacao(d.id, s) }))} />
                          </span>
                        </div>
                        <div className="ac-chamado">
                          <p className="hint">{d.empresa} · aberto em {vm.data(d.criadoEm)}</p>
                          <PedidoDoChamado mensagens={d.mensagens} />
                          <div className="field">
                            <label htmlFor="ac-resposta">Resposta ao cliente</label>
                            <textarea id="ac-resposta" rows={3} value={vm.resposta} onChange={e => vm.setResposta(e.target.value)} placeholder="O cliente vê a resposta como vinda do Escritório. Para conversar, o WhatsApp." />
                          </div>
                          <div className="btn-row">
                            <button type="button" className="btn" disabled={!vm.resposta.trim() || vm.enviando} onClick={() => void vm.responder()}>
                              <Icone nome="aviao" width={16} height={16} />Responder
                            </button>
                            <button type="button" className="btn btn-primary" disabled={!vm.resposta.trim() || vm.enviando} onClick={() => void vm.responder(true)}>
                              {vm.enviando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" width={16} height={16} />}Responder e concluir
                            </button>
                          </div>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nenhuma solicitação neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
