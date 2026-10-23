// Fiscal › Faturamento (Heverton, 20/10/2026: "relação de faturamento dos clientes"): o período, a busca e o regime em
// cima, a fonte numa dica e o Exportar e o Imprimir no Mais; os números do período (o último mês com a variação); a
// tabela com o cliente parado na rolagem, o total e a variação logo depois dele e um mês por coluna (23/10/2026). Clicar no
// cliente abre o faturamento detalhado (JanelaDoFaturamento, 22/10/2026). Só as peças do
// catálogo (Segmentado, SeletorMes, a busca curta, MenuSuspenso, chip, Tabela padrão, Vazio, Esqueleto).
import { baixarBytes, Dica, Esqueleto, Icone, MenuSuspenso, Segmentado, SeletorMes, Stat, useCarregando, Variacao, Vazio } from '@nads/ui';
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
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <MenuSuspenso rotulo={vm.regime || 'Regime'} titulo="Regime" className={'btn btn-outline' + (vm.regime ? ' ativo' : '')}
          itens={[{ rotulo: 'Todos', marcado: !vm.regime, onClick: () => vm.setRegime('') }, ...vm.regimes.map(r => ({ rotulo: r, marcado: r === vm.regime, onClick: () => vm.setRegime(r) }))]} />
        <button type="button" className={'chip-f' + (vm.soComDado ? ' on' : '')} aria-pressed={vm.soComDado} onClick={vm.alternarSoComDado}>Só com faturamento</button>
        <span className="tarefas-barra-espaco" />
        {/* a fonte numa dica (23/10/2026: sem o parágrafo de explicação) */}
        <Dica texto={'Fonte: ' + vm.fonte + ' (a soma das notas do mês, sem as canceladas; a NFS-e ainda não entra). Mês sem dado fica vazio' + (vm.semDado ? ' (' + vm.semDado + ' clientes sem dado no período)' : '') + '.'} />
        <MenuSuspenso rotulo="Mais" titulo="Exportar e imprimir" direita largura={200}
          itens={[
            { rotulo: 'Exportar Excel', icone: 'download', desabilitado: !vm.linhas.length, onClick: () => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } },
            { rotulo: 'Imprimir', icone: 'printer', desabilitado: !vm.linhas.length, onClick: vm.imprimir },
          ]} />
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: só umas empresas têm saídas do SIEG, com valores inventados.</p>}
      {!vm.carregando && vm.linhas.length > 0 && (
        <div className="stat-grid">
          <Stat rotulo={'Faturamento · ' + vm.rotuloDoPeriodo} valor={'R$ ' + brl(vm.totalGeral)} sub={vm.linhas.length + (vm.linhas.length === 1 ? ' cliente' : ' clientes')} />
          {vm.numeros.ultimo && (
            <Stat rotulo={vm.numeros.ultimo.rotulo} valor={'R$ ' + brl(vm.numeros.ultimo.valor)}
              sub={vm.numeros.ultimo.anterior ? <><Variacao pct={vm.numeros.ultimo.variacao} /> sobre {vm.numeros.ultimo.anterior}</> : 'o único mês com dado'} />
          )}
          <Stat rotulo="Clientes que faturaram" valor={String(vm.numeros.clientes)} />
          {vm.numeros.maior && <Stat rotulo="Maior cliente no período" valor={'R$ ' + brl(vm.numeros.maior.valor)} sub={<span className="fat-maior-nome">{vm.numeros.maior.nome}</span>} />}
        </div>
      )}
      {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? (
        <Vazio icone="dinheiro" titulo="Nenhum faturamento no período" texto={vm.soComDado ? 'Nenhum cliente com as saídas do SIEG nestes meses. Desligue "Só com faturamento" para ver todos.' : 'Nenhum cliente com essa busca.'} />
      ) : (
        <div className="table-wrap faturamento-tabela">
          <table className="table-compact">
            <thead>
              <tr>
                <th className="fat-fixa fat-fixa-cod">Cód.</th><th className="fat-fixa fat-fixa-nome">Cliente</th>
                <th className="num fat-col-total">Total</th><th className="num" title="O último mês com dado contra o anterior">Variação</th>
                {vm.competencias.map(c => <th key={c.chave} className="num">{c.rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.codigo} className="fat-linha" onClick={() => vm.abrir(l.codigo)} title={'Ver o faturamento detalhado de ' + l.nome}>
                  <td className="num fraco fat-fixa fat-fixa-cod">{l.codigo}</td>
                  <td className="faturamento-nome fat-fixa fat-fixa-nome">
                    <button type="button" className="fat-nome-btn" onClick={ev => { ev.stopPropagation(); vm.abrir(l.codigo); }}>{l.nome}</button>
                    {l.regime && <span className="fat-regime">{l.regime}</span>}
                  </td>
                  <td className="num fat-col-total"><b>{brl(l.total)}</b></td>
                  <td className="num"><Variacao pct={l.variacao} titulo="O último mês com dado contra o anterior" /></td>
                  {vm.competencias.map(c => {
                    const v = l.meses[c.chave];
                    return <td key={c.chave} className="num" title={v ? 'Fonte: ' + vm.fonte : 'Sem dado neste mês'}>{v ? brl(v.valor) : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="fat-fixa fat-fixa-cod" /><td className="fat-fixa fat-fixa-nome"><b>Total ({vm.linhas.length} {vm.linhas.length === 1 ? 'cliente' : 'clientes'})</b></td>
                <td className="num fat-col-total"><b>{brl(vm.totalGeral)}</b></td><td />
                {vm.competencias.map(c => <td key={c.chave} className="num"><b>{brl(c.total)}</b></td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {vm.aberto && <JanelaDoFaturamento cliente={vm.aberto} competencias={vm.competenciasDoPeriodo} rotuloDoPeriodo={vm.rotuloDoPeriodo} anual={vm.periodo === 'ano'} fechar={vm.fechar} />}
    </section>
  );
}
