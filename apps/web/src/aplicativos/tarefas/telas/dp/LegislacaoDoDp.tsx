// DP › Legislação (Vitor, 14/10/2026: "importa as legislações em uma aba no DP"): a lista dos assuntos (os do Toriba e os
// cadastrados no nads), com a busca; clicar no assunto abre a janela dele, numa tela só (Vitor,
// 28/10/2026: "texto legal e editar em uma tela só; o lápis em outro lugar, para ter mais tela; salvar e cancelar só quando
// o lápis é clicado, um check e um cancelar"). O DP e o admin cadastram ("Nova legislação", no canto) e editam (o lápis).
import { BotaoFechar, BotaoIcone, Icone, useEntradaAnimada, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useLegislacaoDoDp } from './useLegislacaoDoDp';

type Vm = ReturnType<typeof useLegislacaoDoDp>;

export function LegislacaoDoDp() {
  const vm = useLegislacaoDoDp();
  // o DP animado (14/10/2026): a lista entra em cascata ao abrir e ao buscar
  const lista = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.busca], 'lista');
  const nova = !!vm.rascunho && !vm.rascunho.id;
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        {/* a barra no padrão do resto do app (revisão da UI, 16/10/2026): a busca de lupa e os filtros em menus numa linha */}
        <label className="busca-curta dp-busca-larga">
          <Icone nome="search" />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Assunto ou palavra do texto" aria-label="Buscar na legislação (assunto ou texto)"
            onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        {vm.podeEditar && (
          <>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" width={16} height={16} />Nova legislação</button>
          </>
        )}
      </div>
      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Legislação</h3>
          <span className="badge badge-neutral">{vm.itens.length === vm.total ? vm.total : vm.itens.length + ' de ' + vm.total}</span>
        </div>
        {vm.itens.length ? (
          <div className="table-wrap" ref={lista}>
            <table className="dp-tabela">
              <thead><tr><th>Assunto</th><th>Editada por</th><th>Cadastrada em</th></tr></thead>
              <tbody>
                {vm.itens.map(x => (
                  <tr key={x.id} className="dp-linha-abre" onClick={() => vm.abrir(x.id)} title={'Abrir ' + x.assunto}>
                    <td>
                      <strong>{x.assunto}</strong>{x.origem === 'nads' && <span className="badge badge-neutral dp-selo-mudado">nova</span>}
                    </td>
                    <td className="fraco">{x.atualizadoPor || '—'}</td>
                    <td className="num fraco">{vm.data(x.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco dp-vazio">Nada com "{vm.busca}".</p>}
      </section>

      {(vm.item || nova) && <JanelaDaLegislacao vm={vm} nova={nova} />}
    </section>
  );
}

/** A janela do assunto: o título e quem cadastrou no alto, com o lápis (ou o ✓ e o ✕ enquanto edita); o texto embaixo, na tela toda. */
function JanelaDaLegislacao({ vm, nova }: { vm: Vm; nova: boolean }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const l = vm.item;
  const r = vm.rascunho;
  const titulo = nova || !l ? 'Nova legislação' : l.assunto;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela usuario-janela" role="dialog" aria-modal="true" aria-label={titulo}>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <div className="usuario-quem">
              <h2>{titulo}</h2>
              {nova || !l ? <span className="fraco">Fica na lista do DP para todos</span> : (
                <span className="fraco">
                  Cadastrada em {vm.data(l.data)}{l.origem === 'Toriba' ? ' (Toriba)' : ''}{l.atualizadoPor ? ' · editada por ' + l.atualizadoPor : ''}
                </span>
              )}
            </div>
            <span className="tarefas-barra-espaco" />
            {r ? (
              <>
                <BotaoIcone icone="check" titulo={nova ? 'Cadastrar' : 'Salvar'} disabled={!vm.valido || vm.salvando} onClick={() => void vm.salvar()} />
                <BotaoIcone icone="x" titulo="Cancelar" disabled={vm.salvando} onClick={vm.cancelar} />
              </>
            ) : (
              <>
                {vm.podeEditar && <BotaoIcone icone="lapis" titulo="Editar" onClick={vm.editar} />}
                <BotaoFechar onClick={vm.fechar} />
              </>
            )}
          </header>
          <div className="pessoal-rola">
            {r ? (
              <section className="card pessoal-cartao">
                <div className="field">
                  <label htmlFor="leg-assunto">Assunto</label>
                  <input id="leg-assunto" type="text" value={r.assunto} onChange={e => vm.mudar('assunto', e.target.value)} maxLength={200} autoFocus />
                </div>
                <div className="field">
                  <label htmlFor="leg-texto">Texto legal</label>
                  <textarea id="leg-texto" rows={16} value={r.texto} onChange={e => vm.mudar('texto', e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="leg-obs">Observações</label>
                  <textarea id="leg-obs" rows={3} value={r.observacoes} onChange={e => vm.mudar('observacoes', e.target.value)} />
                </div>
              </section>
            ) : l && (
              <>
                <section className="card pessoal-cartao">
                  <div className="gm-texto-corpo">{l.texto}</div>
                </section>
                {l.observacoes && (
                  <section className="card pessoal-cartao">
                    <div className="card-head"><h3>Observações</h3></div>
                    <div className="gm-texto-corpo">{l.observacoes}</div>
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
