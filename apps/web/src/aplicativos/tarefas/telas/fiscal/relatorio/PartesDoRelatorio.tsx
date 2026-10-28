// As peças do Relatório (Fiscal › Relatório Simples / Relatório Presumido), vindas do Controle de tributos (27/10/2026: a
// folha do Protocolo de Entrega de Tributos; 28/10/2026: "remove a tela de controle de tributos, e pegue os dados de lá e
// coloque na tela nova"): o campo de valor, a conferência do quadro de retificação, a entrega, as Observações e a
// Retificação. Só peças do catálogo.
import { tarefas as t } from '@nads/core';
import { BotaoIcone, Icone } from '@nads/ui';
import type { VmRelatorio } from './useRelatorioGeral';

/** O campo de valor da tabela: escreve à vontade e guarda ao sair (Enter também sai) */
/** estreito: o campo na largura da coluna da tabela do relatório (as guias e a data lado a lado) */
export function Valor({ valor, sugestao, rotulo, pode, aoSalvar, largo, estreito }: { valor: string; sugestao?: string; rotulo: string; pode: boolean; aoSalvar: (v: string) => void; largo?: boolean; estreito?: boolean }) {
  return (
    <input key={valor} type="text" className={'fin-valor-edita' + (largo ? '' : ' num')} defaultValue={valor} placeholder={sugestao || ''} aria-label={rotulo}
      title={sugestao && !valor ? 'Do Entregas: ' + sugestao : undefined} readOnly={!pode}
      style={estreito ? { width: 92, minWidth: 0 } : undefined}
      onBlur={e => { if (e.target.value !== valor) aoSalvar(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = valor; e.currentTarget.blur(); } }} />
  );
}

/** A conferência: em branco, OK ou não se aplica (—); clicar passa para a próxima */
export function MarcaDoControle({ marca, rotulo, pode, aoVirar }: { marca: t.MarcaDoControle | undefined; rotulo: string; pode: boolean; aoVirar: () => void }) {
  const m = marca || '';
  return (
    <button type="button" className={'ctrl-marca' + (m ? ' ctrl-marca-' + m : '')} disabled={!pode} onClick={aoVirar}
      aria-label={rotulo + ': ' + (m === 'ok' ? 'conferido' : m === 'na' ? 'não se aplica' : 'falta')} title={rotulo}>
      {m === 'ok' ? <Icone nome="check" width={14} height={14} /> : m === 'na' ? '—' : ''}
    </button>
  );
}

export function Entrega({ valor, pode, rotulo, aoMudar }: { valor: t.EntregaDoControle; pode: boolean; rotulo: string; aoMudar: (e: t.EntregaDoControle) => void }) {
  return (
    <select className={'pessoal-select ctrl-entrega' + (valor ? ' ctrl-entrega-feita' : '')} value={valor} disabled={!pode} aria-label={rotulo}
      onChange={e => aoMudar(e.target.value as t.EntregaDoControle)}>
      {t.ENTREGAS_DO_CONTROLE.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}

export function Observacoes({ vm }: { vm: VmRelatorio }) {
  const obs = vm.folha.observacoes;
  return (
    <section className="card">
      <div className="card-head">
        <h3>Observações</h3>
        {vm.podeGravar && obs.length < t.MAX_OBSERVACOES && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.mudarObservacoes([...obs, ''])}><Icone nome="plus" width={14} height={14} />Observação</button>
        )}
      </div>
      {!obs.length ? <p className="hint">Nenhuma observação neste mês.</p> : (
        <div className="table-wrap"><table className="table-compact">
          <thead><tr><th>Descrição</th><th className="ctrl-acao" aria-label="Tirar" /></tr></thead>
          <tbody>
            {obs.map((o, i) => (
              <tr key={i}>
                <td><Valor largo valor={o} rotulo={'Observação ' + (i + 1)} pode={vm.podeGravar} aoSalvar={v => vm.mudarObservacoes(obs.map((x, j) => (j === i ? v.slice(0, 500) : x)))} /></td>
                <td className="ctrl-acao">{vm.podeGravar && <BotaoIcone pequeno icone="lixeira" titulo="Tirar a observação" onClick={() => vm.mudarObservacoes(obs.filter((_, j) => j !== i))} />}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}

export function Retificacao({ vm }: { vm: VmRelatorio }) {
  const rets = vm.folha.retificacoes;
  const g = vm.grupo;
  const mudar = (i: number, r: Partial<t.RetificacaoDoControle>) => vm.mudarRetificacoes(rets.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const nova: t.RetificacaoDoControle = { codigo: null, referencia: '', valores: {}, marcas: {}, entregue: '' };
  return (
    <section className="card">
      <div className="card-head">
        <h3>Retificação</h3>
        {vm.podeGravar && rets.length < t.MAX_RETIFICACOES && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.mudarRetificacoes([...rets, nova])}><Icone nome="plus" width={14} height={14} />Retificação</button>
        )}
      </div>
      {!rets.length ? <p className="hint">Nenhuma retificação neste mês.</p> : (
        <div className="table-wrap"><table className="table-compact ctrl-tabela">
          <thead><tr>
            <th className="ctrl-cod">Cód.</th><th className="ctrl-nome">Empresa</th><th className="ctrl-ref">Referência</th>
            {g.colunas.map(c => <th key={c.id} className="num">{c.rotulo}</th>)}
            {g.marcas.map(m => <th key={m.id} className="ctrl-mk" title={m.dica}>{m.rotulo}</th>)}
            <th>Entregue</th><th className="ctrl-acao" aria-label="Tirar" />
          </tr></thead>
          <tbody>
            {rets.map((r, i) => (
              <tr key={i}>
                <td className="ctrl-cod"><Valor valor={r.codigo == null ? '' : String(r.codigo)} rotulo={'Código da retificação ' + (i + 1)} pode={vm.podeGravar}
                  aoSalvar={v => mudar(i, { codigo: /^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : null })} /></td>
                <td className="ctrl-nome">{vm.nomeDe(r.codigo)}</td>
                <td className="ctrl-ref"><Valor largo valor={r.referencia} rotulo={'Referência da retificação ' + (i + 1)} pode={vm.podeGravar} aoSalvar={v => mudar(i, { referencia: v.slice(0, 30) })} /></td>
                {g.colunas.map(c => (
                  <td key={c.id} className="num"><Valor valor={r.valores[c.id] || ''} rotulo={c.rotulo + ' da retificação ' + (i + 1)} pode={vm.podeGravar}
                    aoSalvar={v => { const valores = { ...r.valores }; const x = t.valorDoControle(v); if (x) valores[c.id] = x; else delete valores[c.id]; mudar(i, { valores }); }} /></td>
                ))}
                {g.marcas.map(m => (
                  <td key={m.id} className="ctrl-mk"><MarcaDoControle marca={r.marcas[m.id]} rotulo={m.dica} pode={vm.podeGravar}
                    aoVirar={() => { const marcas = { ...r.marcas }; const p = t.PROXIMA_MARCA[r.marcas[m.id] || '']; if (p) marcas[m.id] = p; else delete marcas[m.id]; mudar(i, { marcas }); }} /></td>
                ))}
                <td><Entrega valor={r.entregue} pode={vm.podeGravar} rotulo={'Entrega da retificação ' + (i + 1)} aoMudar={e => mudar(i, { entregue: e })} /></td>
                <td className="ctrl-acao">{vm.podeGravar && <BotaoIcone pequeno icone="lixeira" titulo="Tirar a retificação" onClick={() => vm.mudarRetificacoes(rets.filter((_, j) => j !== i))} />}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
