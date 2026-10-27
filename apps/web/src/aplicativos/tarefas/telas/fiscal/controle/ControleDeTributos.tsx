// Fiscal › Controle de tributos (27/10/2026: "vamos implementar essa planilha de controle como modulo do fiscal"): a folha
// do Protocolo de Entrega de Tributos preenchida na tela, no Simples e no Lucro Presumido. Só peças do catálogo
// (Segmentado, SeletorMes, a busca curta, chips, números em painéis, a Tabela padrão com valor editável, Vazio, Esqueleto);
// a conferência (OK / — ) é a peça "Marca do controle", no catálogo.
import { tarefas as t } from '@nads/core';
import { BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { dataBr, useControleDeTributos, type VmControleDeTributos } from './useControleDeTributos';

/** O campo de valor da tabela: escreve à vontade e guarda ao sair (Enter também sai) */
function Valor({ valor, sugestao, rotulo, pode, aoSalvar, largo }: { valor: string; sugestao?: string; rotulo: string; pode: boolean; aoSalvar: (v: string) => void; largo?: boolean }) {
  return (
    <input key={valor} type="text" className={'fin-valor-edita' + (largo ? '' : ' num')} defaultValue={valor} placeholder={sugestao || ''} aria-label={rotulo}
      title={sugestao && !valor ? 'Do Entregas: ' + sugestao : undefined} readOnly={!pode}
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

function Entrega({ valor, pode, rotulo, aoMudar }: { valor: t.EntregaDoControle; pode: boolean; rotulo: string; aoMudar: (e: t.EntregaDoControle) => void }) {
  return (
    <select className={'pessoal-select ctrl-entrega' + (valor ? ' ctrl-entrega-feita' : '')} value={valor} disabled={!pode} aria-label={rotulo}
      onChange={e => aoMudar(e.target.value as t.EntregaDoControle)}>
      {t.ENTREGAS_DO_CONTROLE.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}

function Observacoes({ vm }: { vm: VmControleDeTributos }) {
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

function Retificacao({ vm }: { vm: VmControleDeTributos }) {
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

export function ControleDeTributos() {
  const vm = useControleDeTributos();
  useCarregando(vm.carregando);
  const g = vm.grupo;
  return (
    <section className="ctrl-tributos">
      <div className="tarefas-barra-topo">
        <Segmentado valor={g.id} opcoes={vm.grupos} onMudar={vm.setGrupo} />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" max={vm.ultimoMes} />
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Buscar empresa" aria-label="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.podeGravar && vm.comSugestaoParaUsar > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => void vm.usarSugestoes()} title="Passa o que o Entregas já entregou para os campos em branco">
            <Icone nome="download" width={16} height={16} />Preencher com o Entregas ({vm.comSugestaoParaUsar})
          </button>
        )}
        <button type="button" className="btn btn-outline" disabled={!vm.total} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se escreve fica só nesta aba.</p>}
      {!vm.podeGravar && <p className="hint">Só o Fiscal preenche o controle; você está vendo.</p>}
      {vm.carregando ? <Esqueleto linhas={10} numeros={4} /> : !vm.total ? (
        <Vazio icone="briefcase" titulo={'Nenhuma empresa no ' + g.rotulo} texto="As empresas entram pelo regime no Cadastro do nads." />
      ) : (
        <>
          <div className="stat-grid dp-numeros">
            <div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="briefcase" width={18} height={18} /></span><p className="stat-label">Empresas</p><p className="stat-value num">{vm.total}</p></div>
            <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="checkCircle" width={18} height={18} /></span><p className="stat-label">Entregues</p><p className="stat-value num">{vm.porSituacao.entregue}</p></div>
            <div className="stat painel-numero painel-aviso"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="clock" width={18} height={18} /></span><p className="stat-label">Começadas</p><p className="stat-value num">{vm.porSituacao.comecada}</p></div>
            <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="fileText" width={18} height={18} /></span><p className="stat-label">Em branco</p><p className="stat-value num">{vm.porSituacao.falta}</p></div>
          </div>
          <div className="chip-row">
            <span className="chip-lbl">Situação</span>
            <button type="button" className={'chip-f' + (!vm.situacao ? ' on' : '')} onClick={() => vm.setSituacao('')}>Todas ({vm.total})</button>
            {vm.situacoes.map(s => (
              <button key={s.id} type="button" className={'chip-f' + (vm.situacao === s.id ? ' on' : '')} onClick={() => vm.setSituacao(vm.situacao === s.id ? '' : s.id)}>
                {s.rotulo} ({vm.porSituacao[s.id]})
              </button>
            ))}
          </div>
          {!vm.linhas.length ? <Vazio compacto icone="search" texto="Nenhuma empresa com essa busca ou situação." /> : (
            <div className="table-wrap ctrl-rola"><table className="table-compact ctrl-tabela">
              <thead><tr>
                <th className="ctrl-cod">Cód.</th><th className="ctrl-nome">Empresa</th>
                {g.colunas.map(c => <th key={c.id} className="num">{c.rotulo}</th>)}
                <th className="ctrl-data">Data</th>
                {g.marcas.map(m => <th key={m.id} className="ctrl-mk" title={m.dica}>{m.rotulo}</th>)}
                <th>Entregue</th>
              </tr></thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.codigo} className={l.situacao === 'entregue' ? 'ctrl-linha-entregue' : undefined}>
                    <td className="ctrl-cod num">{l.codigo}</td>
                    <td className="ctrl-nome" title={l.nome}>{l.nome}</td>
                    {g.colunas.map(c => (
                      <td key={c.id} className="num"><Valor valor={l.linha.valores[c.id] || ''} sugestao={l.sugestao?.valores[c.id]} rotulo={c.rotulo + ' de ' + l.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarValor(l.codigo, c.id, v)} /></td>
                    ))}
                    <td className="ctrl-data"><Valor valor={dataBr(l.linha.data)} sugestao={l.sugestao?.data ? dataBr(l.sugestao.data) : 'dd/mm/aaaa'} rotulo={'Data de ' + l.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarData(l.codigo, v)} /></td>
                    {g.marcas.map(m => (
                      <td key={m.id} className="ctrl-mk"><MarcaDoControle marca={l.linha.marcas[m.id]} rotulo={m.dica + ' de ' + l.nome} pode={vm.podeGravar} aoVirar={() => vm.virarMarca(l.codigo, m.id)} /></td>
                    ))}
                    <td><Entrega valor={l.linha.entregue} pode={vm.podeGravar} rotulo={'Entrega de ' + l.nome} aoMudar={e => vm.mudarEntrega(l.codigo, e)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={2}>Total do grupo</td>
                {vm.totais.map(x => <td key={x.id} className="num">{x.valor}</td>)}
                <td colSpan={g.marcas.length + 2} />
              </tr></tfoot>
            </table></div>
          )}
          <p className="hint">Nos valores: o número, "-" quando não tem guia ou "0". Em cinza, o que o Entregas já entregou. As conferências: clique para OK, de novo para "não se aplica" (—) e de novo para limpar.</p>
          <Observacoes vm={vm} />
          <Retificacao vm={vm} />
        </>
      )}
    </section>
  );
}
