// Entregas › Painel (16/10/2026, a cópia fiel da aba Painel do entregas.html: "só copia o entregas e joga aqui no design
// n1"): Entregas (o cartão "Painel de entregas" com Exportar PDF e Exportar planilha, a competência, a busca e a situação,
// e a lista — cliente abre a página dele só para ler —; "Sem entrega há tempo") e Números ("Entregas por dia", o ranking
// da equipe com a meta e o cartão do mapa com o anel). As peças: abas sublinhadas, cartão, seletor de mês, busca, seleção,
// selo, barras em coluna, ranking, rosca com legenda.
import { BarrasEmColuna, Esqueleto, Icone, RoscaComLegenda, SeletorMes, useCarregando, useLinhasQueSeMovem } from '@nads/ui';
import { FaixaDasGravacoes } from './FaixaDasGravacoes';
import { JanelasDasEntregas } from './JanelasDasEntregas';
import { usePainelDeEntregas } from './usePainelDeEntregas';

export function PainelDeEntregas() {
  return <JanelasDasEntregas><Painel /></JanelasDasEntregas>;
}

type Vm = ReturnType<typeof usePainelDeEntregas>;

function Painel() {
  const vm = usePainelDeEntregas();
  useCarregando(vm.carregando);
  return (
    <section className="ent-tela">
      <FaixaDasGravacoes />
      <nav className="menu ent-categorias" role="tablist" aria-label="Categorias">
        {vm.categorias.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={vm.categoria === c.id} className={'menu-item' + (vm.categoria === c.id ? ' active' : '')} onClick={() => vm.setCategoria(c.id)}>
            <Icone nome={c.icone} /><span>{c.rotulo}</span>
          </button>
        ))}
      </nav>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {vm.avisoDoLimite && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.avisoDoLimite}</p>}
      {vm.categoria === 'entregas' ? <Entregas vm={vm} /> : <Numeros vm={vm} />}
    </section>
  );
}

function Entregas({ vm }: { vm: Vm }) {
  const lista = useLinhasQueSeMovem<HTMLDivElement>(vm.linhas.map(l => l.l.chave).join(','), vm.busca);
  return (
    <>
      <section className="card ent-cartao">
        <div className="card-head">
          <h3><Icone nome="barChart" width={16} height={16} /> Painel de entregas</h3>
          <span className="card-head-ctl">
            {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
            <button type="button" className="btn btn-outline" onClick={vm.exportarPdf}><Icone nome="fileDown" />Exportar PDF</button>
            <button type="button" className="btn btn-primary" onClick={vm.exportarPlanilha}><Icone nome="download" />Exportar planilha</button>
          </span>
        </div>
        <div className="tarefas-barra-topo ent-filtros">
          <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
          <label className="busca-curta"><Icone nome="search" />
            <input type="text" enterKeyHint="search" placeholder="Nome, código ou CNPJ" aria-label="Buscar cliente" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
          </label>
          <select className="select-compact" aria-label="Situação" value={vm.filtro} onChange={e => vm.setFiltro(e.target.value as typeof vm.filtro)}>
            {vm.filtros.map(f => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </select>
        </div>
        {vm.carregando ? <Esqueleto linhas={6} /> : !vm.linhas.length ? <p className="empty">Nenhum cliente encontrado com esse filtro.</p> : (
          <div className="table-wrap ent-painel-wrap" ref={lista}>
            <table className="cad-lista ent-painel">
              <tbody>
                {vm.linhas.map(x => (
                  <tr key={x.l.chave} data-linha={x.l.chave} className="linha-abre" tabIndex={0} title={'Abrir ' + x.l.nome} onClick={() => vm.abrir(x.l)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vm.abrir(x.l); } }}>
                    <td><span className="cad-empresa-nome">{x.l.nome}</span><span className="fraco ent-rota-sub">{x.sub}</span></td>
                    <td className="ent-acoes"><span className={'badge badge-' + x.tom}>{x.rotulo}</span>
                      {x.l.cliente ? <Icone nome="chevronRight" width={16} height={16} className="fraco" /> : <span className="btn btn-outline"><Icone nome="olho" />Ver</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {vm.semEntrega > 0 && (
        <section className="card ent-cartao">
          <div className="card-head">
            <h3><Icone nome="alert" width={16} height={16} /> Sem entrega há tempo</h3>
            <span className="card-head-ctl"><button type="button" className="btn btn-outline" onClick={vm.verSemEntrega}>{vm.semEntrega + (vm.semEntrega === 1 ? ' cliente' : ' clientes')}</button></span>
          </div>
        </section>
      )}
    </>
  );
}

function Numeros({ vm }: { vm: Vm }) {
  return (
    <>
      <section className="card ent-cartao">
        <div className="card-head"><h3><Icone nome="barChart" width={16} height={16} /> Entregas por dia</h3></div>
        {vm.porDia.length ? <div className="ent-barras"><BarrasEmColuna colunas={vm.porDia} ativa={vm.diaEscolhido} onEscolher={vm.escolherDia} /></div>
          : <p className="empty">Nenhuma entrega confirmada nesta competência ainda.</p>}
      </section>
      <section className="card ent-cartao">
        <div className="card-head">
          <h3><Icone nome="trofeu" width={16} height={16} /> Ranking da equipe</h3>
          {vm.podeDefinirMeta && <span className="card-head-ctl"><button type="button" className="btn btn-outline" onClick={vm.definirMeta}><Icone nome="alvo" />Meta do mês</button></span>}
        </div>
        {vm.meta && (
          <div className="ent-meta">
            <p className="hint">{vm.meta.texto}</p>
            <span className="tarefas-barra"><span style={{ width: vm.meta.pct + '%' }} /></span>
          </div>
        )}
        {!vm.ranking.length ? <p className="empty">Nenhuma entrega confirmada nesta competência ainda.</p> : (
          <div className="rank">
            {vm.ranking.map(r => (
              <div key={r.nome} className="rank-item" title={vm.meta ? r.total + ' de ' + (vm.meta.alvo / Math.max(1, vm.ranking.length)) + ' (' + r.pct + '%)' : undefined}>
                <span className="rank-nome">{r.posicao}. {r.nome}</span>
                <span className="rank-val"><span className="badge badge-ok">{r.total + (r.total === 1 ? ' entrega' : ' entregas')}</span></span>
                {vm.meta && <span className="rank-barra"><span style={{ width: r.pct + '%', background: r.batida ? 'var(--success)' : 'var(--accent)' }} /></span>}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card ent-cartao">
        <div className="card-head">
          <h3><Icone nome="mapaPin" width={16} height={16} /> Mapa de entregas</h3>
          <span className="card-head-ctl"><button type="button" className="btn btn-outline" aria-expanded={vm.mapaAberto} onClick={vm.alternarMapa}>{vm.mapaAberto ? 'Esconder' : 'Mostrar'}</button></span>
        </div>
        <div className="ent-resumo-mes">
          <RoscaComLegenda total={vm.numeros.porcento} subtitulo="% receberam" ativa={null} onEscolher={vm.filtrarPeloAnel}
            fatias={[{ id: 'receberam', rotulo: 'Já receberam', valor: vm.numeros.entregue, tom: 'ok' }, { id: 'faltam', rotulo: 'Ainda não', valor: vm.numeros.total - vm.numeros.entregue, tom: 'neutro' }]} />
          <p>{vm.resumoDoMes}</p>
        </div>
        {vm.mapaAberto && (
          <div className="ent-mapa">
            {/* o mapa do Entregas usa os mosaicos do OpenStreetMap (Leaflet): é uma conexão nova para o nads, desligada até ser
                liberada; enquanto isso, a lista das entregas com o lugar, cada uma com o link para o mapa */}
            <p className="registro-dica"><Icone nome="alert" />O mapa precisa de liberação (OpenStreetMap). Enquanto isso, as entregas com o lugar da confirmação:</p>
            {!vm.pontos.length ? <p className="empty">Nenhuma entrega com localização capturada ainda.</p> : (
              <ul className="ent-linhas">
                {vm.pontos.map(p => (
                  <li key={p.id}><span className={'ent-ponto' + (p.falha ? ' falha' : '')} aria-hidden="true" />
                    <div><b>{p.nome}</b><span className="fraco">{p.texto} · {p.quando}</span></div>
                    <a className="btn btn-ghost" href={p.link} target="_blank" rel="noopener noreferrer"><Icone nome="mapaPin" />ver no mapa</a></li>
                ))}
              </ul>
            )}
            <p className="hint ent-legenda"><span className="ent-ponto" aria-hidden="true" /> Entregue <span className="ent-ponto falha" aria-hidden="true" /> Não entregue</p>
          </div>
        )}
      </section>
    </>
  );
}
