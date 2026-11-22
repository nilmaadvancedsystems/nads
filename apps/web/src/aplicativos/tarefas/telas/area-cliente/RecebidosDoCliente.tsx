// Área do Cliente › Recebidos (Vitor, 16/10/2026): o que os clientes mandaram pelo link da Área do Cliente: a empresa, o
// arquivo, o tipo, quando chegou e em que pasta do Drive ficou.
import { Alerta, BotaoFechar, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { FILTROS_DOS_RECEBIDOS, rotuloDoEnvio, useRecebidosDoCliente } from './useRecebidosDoCliente';

export function RecebidosDoCliente() {
  const vm = useRecebidosDoCliente();
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.exemplos && (
        <div className="alerta-linha">
          <Alerta titulo="Dados de exemplo" texto="Os arquivos recebidos são de mentira; nada foi para o Drive." />
        </div>
      )}
      {vm.erro && (
        <div className="alerta-linha">
          <Alerta titulo="O banco não deixou ler os recebidos" texto={vm.erro} />
        </div>
      )}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <Segmentado valor={vm.filtro} onMudar={vm.setFiltro}
          opcoes={FILTROS_DOS_RECEBIDOS.map(f => ({ valor: f.valor, rotulo: f.rotulo + ' (' + vm.contagem(f.valor) + ')' }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa ou arquivo" aria-label="Buscar arquivo recebido" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Empresa</th><th>Arquivo</th><th>Tipo</th><th className="num">Tamanho</th><th>Recebido</th><th>Pasta no Drive</th><th></th></tr></thead>
            <tbody>
              {vm.linhas.map(r => (
                <tr key={r.id}>
                  <td className="wrap"><span className="num">{r.codigo}</span> · {r.empresa}</td>
                  <td className="wrap"><Icone nome="fileText" width={16} height={16} /> {r.nome}{r.guia && <div className="hint">{r.guia}</div>}</td>
                  <td><span className="badge badge-neutral">{rotuloDoEnvio(r.tipo)}</span></td>
                  <td className="num">{vm.tamanho(r.tamanho)}</td>
                  <td className="fraco">{vm.data(r.recebidoEm)}</td>
                  <td className="wrap fraco"><Icone nome="pasta" width={16} height={16} /> {r.pastaDrive || '—'}</td>
                  {/* a recusa com o motivo que o cliente vê (22/11/2026, Documentos do cliente) */}
                  <td className="wrap">{vm.recusaDe(r)
                    ? <span className="badge badge-danger" title={vm.recusaDe(r)}>Recusado</span>
                    : <button type="button" className="btn btn-sm btn-outline" onClick={() => vm.recusa.abrir(r)}>Recusar</button>}</td>
                </tr>
              ))}
              {!vm.linhas.length && <tr><td colSpan={7} className="hint">Nada recebido{vm.total ? ' neste filtro' : ' ainda'}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {vm.recusa.aberta && <JanelaDaRecusa vm={vm} />}
    </section>
  );
}

/** a janela da recusa: o arquivo, os motivos prontos e o motivo escrito (o cliente vê) */
function JanelaDaRecusa({ vm }: { vm: ReturnType<typeof useRecebidosDoCliente> }) {
  const r = vm.recusa.aberta!;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.recusa.fechar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Recusar o arquivo" style={{ maxWidth: 520 }}>
        <header className="modal-topo" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 16px 8px' }}>
          <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>Recusar o arquivo</h3><p className="hint" style={{ margin: '4px 0 0' }}>{r.codigo} · {r.empresa} · {r.nome}</p></div>
          <BotaoFechar onClick={vm.recusa.fechar} />
        </header>
        <div style={{ padding: '0 16px 16px' }}>
        <p className="hint">O cliente vê o motivo na Área do Cliente, e o aviso "Falta mandar" volta para ele.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
          {vm.recusa.prontos.map(m => <button key={m} type="button" className={'btn btn-sm ' + (vm.recusa.motivo === m ? 'btn-primary' : 'btn-outline')} onClick={() => vm.recusa.setMotivo(m)}>{m}</button>)}
        </div>
        <label className="campo" style={{ display: 'block' }}>
          <span className="rotulo">Motivo</span>
          <textarea rows={3} maxLength={300} value={vm.recusa.motivo} onChange={e => vm.recusa.setMotivo(e.target.value)} placeholder="Escreva o motivo ou escolha um acima" style={{ width: '100%' }} />
        </label>
        {vm.recusa.erro && <p className="erro-campo" role="alert">{vm.recusa.erro}</p>}
        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-outline" onClick={vm.recusa.fechar} disabled={vm.recusa.enviando}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={() => void vm.recusa.confirmar()} disabled={vm.recusa.enviando}>{vm.recusa.enviando ? 'Recusando…' : 'Recusar'}</button>
        </footer>
        </div>
      </div>
    </div>
  );
}
