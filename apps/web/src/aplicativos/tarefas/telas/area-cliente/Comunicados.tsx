// Área do Cliente › Comunicados (22/11/2026, ficha comunicados; o dono: "pode fazer tudo"): os avisos do escritório para os
// clientes, com o alvo (todos, um regime ou empresas) e o período. Vai num sentido só: a resposta do cliente segue pelo
// WhatsApp ou numa solicitação.
import { Alerta, BotaoFechar, Esqueleto, Icone, useCarregando } from '@nads/ui';
import { useComunicados } from './useComunicados';

export function Comunicados() {
  const vm = useComunicados();
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.exemplos && <div className="alerta-linha"><Alerta titulo="Dados de exemplo" texto="Os comunicados são de mentira; nada vai para a Área do Cliente." /></div>}
      {vm.erroDaLista && <div className="alerta-linha"><Alerta titulo="O banco não deixou ler os comunicados" texto={vm.erroDaLista} /></div>}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <p className="hint" style={{ margin: 0 }}>O aviso aparece no sino da Área do Cliente das empresas escolhidas, só dentro do período. O cliente não responde por aqui.</p>
        <span className="tarefas-barra-espaco" />
        {vm.podeEditar && <button type="button" className="btn btn-primary" onClick={vm.novo}><Icone nome="plus" width={16} height={16} />Novo comunicado</button>}
      </div>
      {vm.carregando ? <Esqueleto linhas={4} /> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Comunicado</th><th>Para quem</th><th>Período</th><th>Situação</th><th>Por</th>{vm.podeEditar && <th></th>}</tr></thead>
            <tbody>
              {vm.linhas.map(c => (
                <tr key={c.id}>
                  <td className="wrap"><b>{c.titulo}</b><div className="hint">{c.texto}</div></td>
                  <td className="wrap">{c.alvoTexto}</td>
                  <td className="fraco">{c.periodo}</td>
                  <td><span className={'badge ' + c.tom}>{c.situacao}</span></td>
                  <td className="fraco">{c.por}{c.quando && <div className="hint">{c.quando}</div>}</td>
                  {vm.podeEditar && <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => vm.editar(c)}>Editar</button>{' '}
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => void vm.apagar(c)}>Apagar</button>
                  </td>}
                </tr>
              ))}
              {!vm.linhas.length && <tr><td colSpan={vm.podeEditar ? 6 : 5} className="hint">Nenhum comunicado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {vm.aberto && <JanelaDoComunicado vm={vm} />}
    </section>
  );
}

function JanelaDoComunicado({ vm }: { vm: ReturnType<typeof useComunicados> }) {
  const f = vm.form;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Comunicado aos clientes" style={{ maxWidth: 560 }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 16px 8px' }}>
          <h3 style={{ margin: 0, flex: 1 }}>{vm.editando ? 'Editar o comunicado' : 'Novo comunicado'}</h3>
          <BotaoFechar onClick={vm.fechar} />
        </header>
        <div style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
          <label className="campo"><span className="rotulo">Título</span>
            <input type="text" maxLength={vm.limiteDoTitulo} value={f.titulo} onChange={e => vm.mudar({ titulo: e.target.value })} placeholder="Ex.: Recesso de fim de ano" style={{ width: '100%' }} /></label>
          <label className="campo"><span className="rotulo">Texto ({f.texto.length}/{vm.limiteDoTexto})</span>
            <textarea rows={4} maxLength={vm.limiteDoTexto} value={f.texto} onChange={e => vm.mudar({ texto: e.target.value })} style={{ width: '100%' }} /></label>
          <div className="campo"><span className="rotulo">Para quem</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {([['todos', 'Todos os clientes'], ['regimes', 'Por regime'], ['codigos', 'Empresas escolhidas']] as const).map(([v, r]) => (
                <button key={v} type="button" className={'btn btn-sm ' + (f.tipo === v ? 'btn-primary' : 'btn-outline')} onClick={() => vm.mudar({ tipo: v })}>{r}</button>
              ))}
            </div>
            {f.tipo === 'regimes' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {vm.regimes.map(r => <button key={r} type="button" className={'btn btn-sm ' + (f.regimes.includes(r) ? 'btn-primary' : 'btn-outline')} onClick={() => vm.alternarRegime(r)}>{r}</button>)}
            </div>}
            {f.tipo === 'codigos' && <input type="text" value={f.codigos} onChange={e => vm.mudar({ codigos: e.target.value })} placeholder="Os códigos das empresas, separados por vírgula (ex.: 292, 515)" style={{ width: '100%', marginTop: 8 }} />}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label className="campo"><span className="rotulo">Aparece de</span><input type="date" value={f.publicarEm} onChange={e => vm.mudar({ publicarEm: e.target.value })} /></label>
            <label className="campo"><span className="rotulo">até</span><input type="date" value={f.ate} onChange={e => vm.mudar({ ate: e.target.value })} /></label>
          </div>
          {vm.erro && <p className="erro-campo" role="alert" style={{ margin: 0 }}>{vm.erro}</p>}
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={vm.fechar} disabled={vm.gravando}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={() => void vm.salvar()} disabled={vm.gravando}>{vm.gravando ? 'Gravando…' : vm.editando ? 'Salvar' : 'Publicar'}</button>
          </footer>
        </div>
      </div>
    </div>
  );
}
