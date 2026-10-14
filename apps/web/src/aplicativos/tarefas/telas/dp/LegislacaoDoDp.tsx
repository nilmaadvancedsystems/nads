// DP › Legislação (Vitor, 14/10/2026: "importa as legislações em uma aba no DP"): a lista dos assuntos que vieram do Toriba,
// com a busca; clicar no assunto abre o texto legal (e as observações, quando há) na janela lateral, como nas Configurações.
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { useLegislacaoDoDp, type TopicoDaLegislacao } from './useLegislacaoDoDp';

export function LegislacaoDoDp() {
  const vm = useLegislacaoDoDp();
  const l = vm.item;
  const topicos: TopicoDaJanela<TopicoDaLegislacao>[] = [
    { id: 'texto', rotulo: 'Texto legal', icone: 'scale' },
    ...(l?.observacoes ? [{ id: 'observacoes' as const, rotulo: 'Observações', icone: 'fileText' }] : []),
  ];
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Assunto ou palavra do texto" aria-label="Buscar na legislação (assunto ou texto)" />
        </label>
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
                    <td><strong>{x.assunto}</strong></td>
                    <td className="num fraco">{vm.data(x.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco dp-vazio">Nada com "{vm.busca}".</p>}
      </section>

      {l && (
        <JanelaLateral rotulo={l.assunto} topicos={topicos} topico={vm.topico} mudar={vm.setTopico} fechar={vm.fechar} resumo={(
          <div className="usuario-quem">
            <b>{l.assunto}</b>
            <span className="fraco">Cadastrada em {vm.data(l.data)} (Toriba)</span>
          </div>
        )}>
          <section className="card pessoal-cartao">
            <div className="gm-texto-corpo">{vm.topico === 'observacoes' ? l.observacoes : l.texto}</div>
          </section>
        </JanelaLateral>
      )}
    </section>
  );
}
