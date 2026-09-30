// Conferência › Extrato × sistema: mês e tolerância, os números por situação (clicáveis), os
// totais dos dois lados e a tabela de cada par. "Baixar CSV" no topo.
import { extrator as x } from '@nads/core';
import { baixarArquivo, Icone, Segmentado, Stat } from '@nads/ui';
import { AcoesDoTopo } from '../../../../../../comum/topo';
import { TabelaConferencia } from './partes/TabelaConferencia';
import { LIMITE_LINHAS, useConferencia } from './useConferencia';

/**
 * naTarefa: dentro da etapa da Tarefas — sem a barra de mês, tolerância e Baixar CSV (pedido do Vitor,
 * 30/09/2026): confere o mês da tarefa (competencia) com a tolerância padrão.
 */
export function Conferencia({ naTarefa, doArquivo, competencia }: { naTarefa?: boolean; doArquivo?: (a: x.ArquivoImportado) => boolean; competencia?: string } = {}) {
  const vm = useConferencia(doArquivo, naTarefa ? competencia : undefined);
  const csv = <button className={'btn ' + (naTarefa ? 'btn-outline btn-sm' : 'btn-primary')} type="button" onClick={() => { const a = vm.csv(); baixarArquivo(a.texto, a.nome); }}>Baixar CSV</button>;
  return (
    <section>
      {!naTarefa && <AcoesDoTopo>{csv}</AcoesDoTopo>}

      {!naTarefa && <div className="ext-filtros">
        <div className="chip-row">
          {vm.meses.map(m => (
            <button key={m.valor} type="button" className={'chip-f' + (m.ativo ? ' on' : '')} onClick={() => vm.escolherPeriodo(m.valor)}>{m.rotulo}</button>
          ))}
          {vm.variosMeses && <button type="button" className={'chip-f' + (vm.tudoAtivo ? ' on' : '')} onClick={() => vm.escolherPeriodo('tudo')}>Tudo</button>}
        </div>
        <label className="toggle-row" htmlFor="extTolerancia">
          Aceitar data até
          <select id="extTolerancia" className="select-compact ext-select" value={vm.tolerancia} onChange={ev => vm.escolherTolerancia(Number(ev.target.value))}>
            {vm.tolerancias.map(t => <option key={t} value={t}>{t} {t === 1 ? 'dia' : 'dias'}</option>)}
          </select>
          de diferença
        </label>
      </div>}

      <div className="stat-grid">
        {vm.stats.map(st => (
          <button key={st.id} type="button" className={'stat stat-clicavel' + (st.ativo ? ' active' : '')} onClick={() => vm.escolherStat(st.id)}>
            <p className="stat-label">{st.rotulo}</p>
            <p className="stat-value">{st.qtd}</p>
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <Stat rotulo="Extrato · entradas / saídas" grande={false} valor={<><span className="ext-pos">{x.valorBR(vm.extrato.entradas)}</span> / <span className="ext-neg">{x.valorBR(vm.extrato.saidas)}</span></>} />
        <Stat rotulo="Sistema · entradas / saídas" grande={false} valor={<><span className="ext-pos">{x.valorBR(vm.sistema.entradas)}</span> / <span className="ext-neg">{x.valorBR(vm.sistema.saidas)}</span></>} />
        <Stat rotulo="Diferença no movimento" grande={false} valor={<span className={vm.diferenca ? 'ext-neg' : 'ext-pos'}>{vm.diferenca ? x.valorBR(vm.diferenca) : 'Zerada'}</span>} />
      </div>
      {vm.sistemaInvertido && <p className="hint" style={{ marginBottom: 16 }}>O sistema veio com os sinais trocados (débito como saída). A conferência inverteu; o que foi importado não mudou.</p>}

      <Segmentado valor={vm.filtro} opcoes={vm.filtros} onMudar={vm.escolherFiltro} />

      <div className="gh-box">
        <div className="gh-box-head cons-head">
          <div className="gh-search cons-busca">
            <input type="text" id="extBuscaConf" value={vm.busca} autoComplete="off" placeholder="Procurar por histórico, valor ou data" onChange={ev => vm.setBusca(ev.target.value)} />
            {vm.busca && <button type="button" className="gh-search-clear" title="Limpar busca" aria-label="Limpar busca" onClick={() => vm.setBusca('')}>&times;</button>}
          </div>
        </div>
        <p className="cons-resumo">
          <b>{vm.qtd}</b> de {vm.qtdTotal}<span className="cons-sep">·</span>{vm.qtdExtrato} no extrato<span className="cons-sep">·</span>{vm.qtdSistema} no sistema
        </p>
        {!vm.qtd ? (
          <div className="gh-blank">
            <Icone nome={vm.busca ? 'search' : 'checkCircle'} />
            <h4>{vm.busca ? 'Nada bate com a busca' : vm.vazioDoFiltro}</h4>
          </div>
        ) : <TabelaConferencia linhas={vm.linhas} />}
        {vm.cortado && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {LIMITE_LINHAS} de {vm.qtd}. Use a busca ou escolha um mês.</p>}
      </div>
    </section>
  );
}
