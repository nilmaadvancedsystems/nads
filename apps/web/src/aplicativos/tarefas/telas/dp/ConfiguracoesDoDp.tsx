// DP › Configurações: os parâmetros de cada cliente do DP, um por linha — o movimento, as obrigações do mês (clicar liga e
// desliga), a REINF, a entrega e o agrupamento. Grava ao mudar; o que foi mudado ganha o "Voltar à planilha".
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { useConfiguracoesDoDp } from './useConfiguracoesDoDp';

export function ConfiguracoesDoDp() {
  const vm = useConfiguracoesDoDp();
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome ou código" aria-label="Buscar cliente (nome ou código)" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Movimento</span>
          <select className="select-compact" value={vm.movimento} onChange={e => vm.setMovimento(e.target.value)}>
            <option value="">Todos</option>
            {vm.movimentos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="dp-check">
          <input type="checkbox" checked={vm.soMudados} onChange={e => vm.setSoMudados(e.target.checked)} />
          Só os mudados ({vm.mudados})
        </label>
      </div>
      <p className="hint dp-config-dica">Os parâmetros de cada cliente vêm da planilha do DP. O que você mudar aqui vale na tabela do Painel na hora; o responsável fica em Cadastro › Responsáveis.</p>
      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card dp-lista">
          <div className="dp-lista-topo">
            <h3 className="dp-titulo">Clientes do DP</h3>
            <span className="badge badge-neutral">{vm.linhas.length}</span>
          </div>
          <div className="table-wrap">
            <table className="dp-tabela dp-config">
              <thead>
                <tr><th>Cód.</th><th>Cliente</th><th>Movimento</th><th>Obrigações do mês</th><th className="dp-centro" title="REINF autorizada">REINF</th><th>Entrega e agrupamento</th><th /></tr>
              </thead>
              <tbody>
                {vm.linhas.map(c => (
                  <tr key={c.codigo} className={c.mudado ? 'dp-mudado' : undefined}>
                    <td className="num fraco">{c.codigo}</td>
                    <td className="dp-cliente"><span className="dp-cliente-nome">{c.nomeNaTela}</span><span className="dp-cliente-info">{c.enquadramento}</span></td>
                    <td>
                      <select className="select-compact" value={c.movimento} onChange={e => vm.mudarMovimento(c.codigo, e.target.value)} aria-label={'Movimento de ' + c.nomeNaTela}>
                        {vm.movimentos.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="dp-chips" role="group" aria-label={'Obrigações de ' + c.nomeNaTela}>
                        {vm.obrigacoes.map(o => {
                          const tem = (c.obrigacoes as string[]).includes(o.id);
                          return <button key={o.id} type="button" className={'dp-chip' + (tem ? ' ligado' : '')} aria-pressed={tem} title={o.nome}
                            onClick={() => vm.alternarObrigacao(c.codigo, o.id)}>{o.rotulo}</button>;
                        })}
                      </div>
                    </td>
                    <td className="dp-centro">
                      <input type="checkbox" checked={c.reinfAutorizada} onChange={e => vm.mudarReinf(c.codigo, e.target.checked)} aria-label={'REINF autorizada de ' + c.nomeNaTela} />
                    </td>
                    <td className="dp-empilhado">
                      <select className="select-compact" value={c.entrega} onChange={e => vm.mudarEntrega(c.codigo, e.target.value)} aria-label={'Entrega de ' + c.nomeNaTela}>
                        {[...new Set([...vm.entregas, c.entrega])].filter(Boolean).map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <input type="text" className="dp-agrup" list="dp-agrupamentos" defaultValue={c.agrupamento} key={c.agrupamento} placeholder="—"
                        aria-label={'Agrupamento de ' + c.nomeNaTela}
                        onBlur={e => { if (e.target.value.trim() !== c.agrupamento) vm.mudarAgrupamento(c.codigo, e.target.value); }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                    </td>
                    <td className="num">
                      {c.mudado && <button type="button" className="icon-btn icon-btn-sm" title="Voltar à planilha (desfaz o que foi mudado)" aria-label="Voltar à planilha" onClick={() => vm.voltarAPlanilha(c.codigo)}><Icone nome="girar" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="dp-agrupamentos">{vm.agrupamentos.map(a => <option key={a} value={a} />)}</datalist>
          </div>
        </section>
      )}
    </section>
  );
}
