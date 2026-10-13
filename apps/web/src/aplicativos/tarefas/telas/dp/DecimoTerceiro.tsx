// DP › 13º salário (Vitor, 13/10/2026): os clientes com folha e as duas parcelas, no visual das Obrigações do mês —
// 1ª parcela (novembro): recibos e folha; 2ª parcela (dezembro): recibos, folha, eSocial (S-1200, S-1210, S-1299),
// DCTFWeb e DARF. A bolinha marca a etapa como feita (quem e quando); clicar de novo desfaz.
import { baixarBytes, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { useDecimoTerceiro, type EstadoDoDecimo } from './useDecimoTerceiro';

const MARCA: Record<EstadoDoDecimo, string> = { 'a-fazer': '', feita: '✓', parada: '!' };

export function DecimoTerceiro() {
  const vm = useDecimoTerceiro();
  const f = vm.filtros;
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro">
          <span className="hint">13º de</span>
          <select className="select-compact" value={vm.ano} onChange={e => vm.setAno(Number(e.target.value))}>
            {vm.anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Nome ou código" aria-label="Buscar cliente (nome ou código)" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Responsável</span>
          <select className="select-compact" value={f.responsavel} onChange={e => f.setResponsavel(e.target.value)}>
            <option value="">Todos</option>
            {f.responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field dp-filtro">
          <span className="hint">Status</span>
          <select className="select-compact" value={f.status} onChange={e => f.setStatus(e.target.value as typeof f.status)}>
            <option value="">Todos</option>
            <option value="pendentes">Pendentes</option>
            <option value="concluidas">Concluídos</option>
          </select>
        </label>
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}>Limpar filtros</button>}
      </div>

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card dp-lista">
          <div className="dp-lista-topo">
            <h3 className="dp-titulo">13º salário de {vm.ano}</h3>
            <span className="badge badge-neutral">{vm.total}</span>
            <span className="hint">1ª parcela: <b className="num">{vm.primeiraFeitas}</b> de {vm.total} · 2ª parcela: <b className="num">{vm.segundaFeitas}</b> de {vm.total}</span>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline" onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <Icone nome="download" />Exportar Excel
            </button>
            <Segmentado valor={vm.parcela} opcoes={vm.parcelas} onMudar={vm.setParcela} />
          </div>
          {vm.linhas.length === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
            <div className="table-wrap">
              <table className="dp-tabela">
                <thead>
                  <tr className="dp-cabeca-grupo">
                    <th colSpan={3} />
                    {vm.gruposDeColunas.map(g => <th key={g.rotulo} colSpan={g.colunas} className="dp-ob-grupo dp-ob-primeira">{g.rotulo}</th>)}
                    <th />
                  </tr>
                  <tr>
                    <th>Cód.</th><th>Cliente</th><th>Responsável</th>
                    {vm.colunas.map(col => <th key={col.chave} className={'dp-ob' + (vm.primeiras.has(col.chave) ? ' dp-ob-primeira' : '')} title={col.nome}>{col.rotulo}</th>)}
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {vm.linhas.map(c => (
                    <tr key={c.codigo} className={'dp-linha' + (c.concluida ? ' feita' : '')}>
                      <td className="num fraco">{c.codigo}</td>
                      <td className="dp-cliente"><span className="dp-cliente-nome" title={c.nome}>{c.nome}</span></td>
                      <td>{c.temResponsavel ? c.responsavelNome : <span className="fraco">—</span>}</td>
                      {c.marcas.map(m => (
                        <td key={m.chave} className={'dp-ob' + (vm.primeiras.has(m.chave) ? ' dp-ob-primeira' : '')}>
                          <button type="button" className={'dp-marca ' + m.estado} disabled={vm.carregando} onClick={() => vm.alternar(c.codigo, m.etapa)}
                            title={m.nome + ': ' + (m.estado === 'feita' ? 'feita por ' + m.quem + ' (clique para desfazer)' : 'clique quando fizer')}
                            aria-label={m.nome + ' de ' + c.nome + (m.estado === 'feita' ? ': feita' : ': a fazer')} aria-pressed={m.estado === 'feita'}>
                            {MARCA[m.estado]}
                          </button>
                        </td>
                      ))}
                      <td><span className={'badge ' + (c.concluida ? 'badge-ok' : c.primeira ? 'badge-warn' : c.situacao === 'Em andamento' ? 'badge-warn' : 'badge-neutral')}>{c.situacao}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
