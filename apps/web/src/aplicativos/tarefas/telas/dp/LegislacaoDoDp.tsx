// DP › Legislação (Vitor, 14/10/2026: "importa as legislações em uma aba no DP"): a lista dos assuntos (os do Toriba e os
// cadastrados no nads), com a busca; clicar no assunto abre o texto legal (e as observações, quando há) na janela lateral,
// como nas Configurações. O DP e o admin cadastram ("Nova legislação", no canto) e editam (o tópico Editar da janela).
import { Icone } from '@nads/ui';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { useLegislacaoDoDp, type TopicoDaLegislacao } from './useLegislacaoDoDp';

export function LegislacaoDoDp() {
  const vm = useLegislacaoDoDp();
  const l = vm.item;
  const r = vm.rascunho;
  const nova = !!r && !r.id;
  const topicos: TopicoDaJanela<TopicoDaLegislacao>[] = nova
    ? [{ id: 'editar', rotulo: 'Nova legislação', icone: 'plus' }]
    : [
      { id: 'texto', rotulo: 'Texto legal', icone: 'scale' },
      ...(l?.observacoes ? [{ id: 'observacoes' as const, rotulo: 'Observações', icone: 'fileText' as const }] : []),
      ...(vm.podeEditar ? [{ id: 'editar' as const, rotulo: 'Editar', icone: 'lapis' as const }] : []),
    ];
  const mudarTopico = (t: TopicoDaLegislacao) => (t === 'editar' ? vm.editar() : vm.setTopico(t));
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Assunto ou palavra do texto" aria-label="Buscar na legislação (assunto ou texto)" />
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
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Assunto</th><th>Cadastrada em</th></tr></thead>
              <tbody>
                {vm.itens.map(x => (
                  <tr key={x.id} className="dp-linha-abre" onClick={() => vm.abrir(x.id)} title={'Abrir ' + x.assunto}>
                    <td><strong>{x.assunto}</strong>{x.origem === 'nads' && <span className="badge badge-neutral dp-selo-mudado">nova</span>}</td>
                    <td className="num fraco">{vm.data(x.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco dp-vazio">Nada com "{vm.busca}".</p>}
      </section>

      {(l || nova) && (
        <JanelaLateral rotulo={nova || !l ? 'Nova legislação' : l.assunto} topicos={topicos} topico={vm.topico} mudar={mudarTopico} fechar={vm.fechar}
          resumo={nova || !l ? (
            <div className="usuario-quem"><b>Nova legislação</b><span className="fraco">Fica na lista do DP para todos</span></div>
          ) : (
            <div className="usuario-quem">
              <b>{l.assunto}</b>
              <span className="fraco">Cadastrada em {vm.data(l.data)}{l.origem === 'Toriba' ? ' (Toriba)' : ''}</span>
              {l.atualizadoPor && <span className="fraco">Editada por {l.atualizadoPor}</span>}
            </div>
          )}
          pe={vm.topico === 'editar' && r ? (
            <>
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={() => (nova ? vm.fechar() : vm.setTopico('texto'))}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={!vm.valido || vm.salvando} onClick={() => void vm.salvar()}>
                {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" width={16} height={16} />}{nova ? 'Cadastrar' : 'Salvar'}
              </button>
            </>
          ) : undefined}>
          {vm.topico === 'editar' && r ? (
            <section className="card pessoal-cartao">
              <div className="field">
                <label htmlFor="leg-assunto">Assunto</label>
                <input id="leg-assunto" type="text" value={r.assunto} onChange={e => vm.mudar('assunto', e.target.value)} maxLength={200} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="leg-texto">Texto legal</label>
                <textarea id="leg-texto" rows={14} value={r.texto} onChange={e => vm.mudar('texto', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="leg-obs">Observações</label>
                <textarea id="leg-obs" rows={3} value={r.observacoes} onChange={e => vm.mudar('observacoes', e.target.value)} />
              </div>
            </section>
          ) : l && (
            <section className="card pessoal-cartao">
              <div className="gm-texto-corpo">{vm.topico === 'observacoes' ? l.observacoes : l.texto}</div>
            </section>
          )}
        </JanelaLateral>
      )}
    </section>
  );
}
