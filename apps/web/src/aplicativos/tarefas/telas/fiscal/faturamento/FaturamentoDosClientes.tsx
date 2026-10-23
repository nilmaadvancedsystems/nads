// Fiscal › Faturamento (Heverton, 20/10/2026: "relação de faturamento dos clientes"): o período, a busca e o regime em
// cima; a tabela com um mês por coluna, o total, a variação e a fonte; exportar para o Excel e imprimir. Clicar no
// cliente abre o faturamento detalhado (JanelaDoFaturamento, 22/10/2026). Só as peças do
// catálogo (Segmentado, SeletorMes, a busca curta, MenuSuspenso, chip, Tabela padrão, Vazio, Esqueleto).
import { baixarBytes, Esqueleto, Icone, MenuSuspenso, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { JanelaDoFaturamento } from './JanelaDoFaturamento';
import { useFaturamentoDosClientes } from './useFaturamentoDosClientes';

const brl = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function FaturamentoDosClientes() {
  const vm = useFaturamentoDosClientes();
  useCarregando(vm.carregando);
  return (
    <section className="faturamento">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.periodo} opcoes={[...vm.periodos]} onMudar={vm.setPeriodo} />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <MenuSuspenso rotulo={vm.regime || 'Regime'} titulo="Regime" direita className={'btn btn-outline' + (vm.regime ? ' ativo' : '')}
          itens={[{ rotulo: 'Todos', marcado: !vm.regime, onClick: () => vm.setRegime('') }, ...vm.regimes.map(r => ({ rotulo: r, marcado: r === vm.regime, onClick: () => vm.setRegime(r) }))]} />
        <button type="button" className={'chip-f' + (vm.soComDado ? ' on' : '')} aria-pressed={vm.soComDado} onClick={vm.alternarSoComDado}>Só com faturamento</button>
        <button type="button" className="btn btn-outline" disabled={!vm.linhas.length} onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
          <Icone nome="download" width={16} height={16} />Exportar Excel
        </button>
        <button type="button" className="btn btn-outline" disabled={!vm.linhas.length} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
      </div>
      <p className="hint">
        {vm.rotuloDoPeriodo}. Fonte: <b>{vm.fonte}</b> (a soma das notas do mês, sem as canceladas; a NFS-e ainda não entra). O PGDAS, o SINTEGRA e o balancete
        não ficam guardados por mês no nads. Mês sem dado fica vazio{vm.semDado ? ' (' + vm.semDado + ' clientes sem dado no período)' : ''}.
      </p>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: só umas empresas têm saídas do SIEG, com valores inventados.</p>}
      {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? (
        <Vazio icone="dinheiro" titulo="Nenhum faturamento no período" texto={vm.soComDado ? 'Nenhum cliente com as saídas do SIEG nestes meses. Desligue "Só com faturamento" para ver todos.' : 'Nenhum cliente com essa busca.'} />
      ) : (
        <div className="table-wrap faturamento-tabela">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Cód.</th><th>Cliente</th><th>Regime</th>
                {vm.competencias.map(c => <th key={c.chave} className="num">{c.rotulo}</th>)}
                <th className="num">Total</th><th className="num" title="O último mês com dado contra o anterior">Var.</th><th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.codigo} className="fat-linha" onClick={() => vm.abrir(l.codigo)} title={'Ver o faturamento detalhado de ' + l.nome}>
                  <td className="num fraco">{l.codigo}</td>
                  <td className="faturamento-nome"><button type="button" className="fat-nome-btn" onClick={ev => { ev.stopPropagation(); vm.abrir(l.codigo); }}>{l.nome}</button></td>
                  <td>{l.regime || <span className="fraco">—</span>}</td>
                  {vm.competencias.map(c => {
                    const v = l.meses[c.chave];
                    return <td key={c.chave} className="num" title={v ? 'Fonte: ' + vm.fonte : 'Sem dado neste mês'}>{v ? brl(v.valor) : ''}</td>;
                  })}
                  <td className="num"><b>{brl(l.total)}</b></td>
                  <td className={'num' + (l.variacao == null ? '' : l.variacao < 0 ? ' faturamento-caiu' : ' faturamento-subiu')}>{l.variacao == null ? '' : (l.variacao > 0 ? '+' : '') + String(l.variacao).replace('.', ',') + '%'}</td>
                  <td className="fraco">{l.fontes.length ? 'SIEG' : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td /><td><b>Total ({vm.linhas.length} {vm.linhas.length === 1 ? 'cliente' : 'clientes'})</b></td><td />
                {vm.competencias.map(c => <td key={c.chave} className="num"><b>{brl(c.total)}</b></td>)}
                <td className="num"><b>{brl(vm.totalGeral)}</b></td><td /><td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {vm.aberto && <JanelaDoFaturamento cliente={vm.aberto} competencias={vm.competenciasDoPeriodo} rotuloDoPeriodo={vm.rotuloDoPeriodo} fechar={vm.fechar} />}
    </section>
  );
}
