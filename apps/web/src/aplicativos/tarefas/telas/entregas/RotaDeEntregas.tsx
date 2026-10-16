// Entregas › Rota (16/10/2026, a cópia fiel da aba Rota do entregas.html: "só copia o entregas e joga aqui no design n1"):
// as categorias de lá nas abas sublinhadas do nads — Paradas (o cartão "Rota de entregas" com Ler guia, Protocolo e os
// filtros, a lista na ordem da rota com o puxador para arrastar, e os cartões Vencendo, Atestados para buscar e Obrigações
// do mês), Ordem fixa (o admin), Protocolos e Qualidade (o admin). As peças: cartão, busca, seleção, menu suspenso,
// tabela, selo, botão.
import { CampoData, Esqueleto, Icone, MenuSuspenso, useCarregando, useLinhasQueSeMovem } from '@nads/ui';
import { useRef, type PointerEvent as EventoDoPonteiro } from 'react';
import { FaixaDasGravacoes } from './FaixaDasGravacoes';
import { JanelasDasEntregas } from './JanelasDasEntregas';
import { useRotaDeEntregas } from './useRotaDeEntregas';

export function RotaDeEntregas() {
  return <JanelasDasEntregas><Rota /></JanelasDasEntregas>;
}

type Vm = ReturnType<typeof useRotaDeEntregas>;

function Rota() {
  const vm = useRotaDeEntregas();
  useCarregando(vm.carregando);
  return (
    <section className="ent-tela">
      <FaixaDasGravacoes />
      {vm.categorias.length > 1 && (
        <nav className="menu ent-categorias" role="tablist" aria-label="Categorias">
          {vm.categorias.map(c => (
            <button key={c.id} type="button" role="tab" aria-selected={vm.categoria === c.id} className={'menu-item' + (vm.categoria === c.id ? ' active' : '')} onClick={() => vm.setCategoria(c.id)}>
              <Icone nome={c.icone} /><span>{c.rotulo}</span>
            </button>
          ))}
        </nav>
      )}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {vm.categoria === 'paradas' && <Paradas vm={vm} />}
      {vm.categoria === 'ordem' && <OrdemFixa vm={vm} />}
      {vm.categoria === 'protocolos' && <Protocolos vm={vm} />}
      {vm.categoria === 'qualidade' && <Qualidade vm={vm} />}
    </section>
  );
}

function Paradas({ vm }: { vm: Vm }) {
  const corpo = useLinhasQueSeMovem<HTMLDivElement>(vm.linhas.map(l => l.e.id).join(','));
  const arraste = useRef<{ id: string } | null>(null);
  function aoMover(ev: EventoDoPonteiro<HTMLButtonElement>) {
    const a = arraste.current;
    const raiz = corpo.current;
    if (!a || !raiz) return;
    const linhas = Array.from(raiz.querySelectorAll<HTMLElement>('tbody > tr[data-linha]')).filter(tr => tr.dataset.linha !== a.id);
    let para = linhas.length;
    for (let i = 0; i < linhas.length; i++) {
      const r = linhas[i].getBoundingClientRect();
      if (ev.clientY < r.top + r.height / 2) { para = i; break; }
    }
    vm.arrastarPara(a.id, para);
  }
  return (
    <>
      <section className="card ent-cartao">
        <div className="card-head">
          <h3><Icone nome="caminhao" width={16} height={16} /> Rota de entregas{vm.previsao && <span className="fraco ent-previsao" title={vm.previsao.dica}> {vm.previsao.texto}</span>}</h3>
          <span className="card-head-ctl">
            {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
            {vm.lerGuia && <button type="button" className="btn btn-outline" onClick={vm.lerGuia}><Icone nome="codigoBarras" />Ler guia</button>}
            <button type="button" className="btn btn-outline" onClick={vm.protocoloDaRota}><Icone nome="printer" />Protocolo</button>
            <button type="button" className="btn btn-primary" onClick={vm.adicionarARota}><Icone nome="plus" />Adicionar à rota</button>
          </span>
        </div>
        <div className="tarefas-barra-topo ent-filtros">
          <label className="busca-curta"><Icone nome="search" />
            <input type="text" enterKeyHint="search" placeholder="Nome, código ou CNPJ" aria-label="Buscar cliente" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
          </label>
          <select className="select-compact" aria-label="Pessoa" value={vm.pessoa} onChange={e => vm.setPessoa(e.target.value)}>
            <option value="">Todas as pessoas</option>{vm.pessoas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <MenuSuspenso icone="mapaPin" rotulo={vm.rotuloDasZonas} titulo="Região" className={'btn btn-outline' + (vm.zonas.length ? ' ativo' : '')}
            itens={vm.zonasDaRota.map(z => ({ rotulo: z.rotulo, marcado: vm.zonas.includes(z.valor), onClick: () => vm.alternarZona(z.valor) }))} />
        </div>
        {vm.carregando ? <Esqueleto linhas={4} /> : !vm.linhas.length ? <p className="empty">Nenhuma entrega na rota.</p> : (
          <div className="table-wrap ent-rota-wrap" ref={corpo}>
            <table className="cad-lista ent-rota">
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.e.id} data-linha={l.e.id} className="linha-abre" onClick={ev => { if (!(ev.target as HTMLElement).closest('.ent-puxador, .ent-juntas')) vm.abrirParada(l.e); }}>
                    <td className="ent-puxa-td">
                      <button type="button" className="icon-btn icon-btn-sm ent-puxador" aria-label={'Mover ' + (l.e.clienteNome || 'parada') + ' na ordem da rota. Alt com seta para cima ou para baixo.'} title="Arrastar para mudar a ordem"
                        onPointerDown={ev => { ev.preventDefault(); ev.currentTarget.setPointerCapture(ev.pointerId); arraste.current = { id: l.e.id }; }}
                        onPointerMove={aoMover}
                        onPointerUp={() => { if (arraste.current) { arraste.current = null; vm.soltar(); } }}
                        onPointerCancel={() => { arraste.current = null; vm.soltar(); }}
                        onKeyDown={ev => { const p = ({ ArrowUp: -1, ArrowDown: 1 } as Record<string, -1 | 1>)[ev.key]; if (p && ev.altKey) { ev.preventDefault(); vm.moverComTeclado(l.e.id, p); } }}>
                        <Icone nome="arrastar" />
                      </button>
                    </td>
                    <td className="num fraco ent-pos">{l.posicao}</td>
                    <td className="ent-rota-conteudo">
                      <span className="cad-empresa-nome">{l.e.clienteNome}</span>
                      {l.lembretes > 0 && <span className="ent-sino" title={'Lembrete pra falar com o cliente: ' + l.lembretesTexto}><Icone nome="sino" width={14} height={14} />{l.lembretes > 1 && l.lembretes}</span>}
                      <span className="fraco ent-rota-sub">{l.sub}</span>
                      {l.aviso && <span className="ent-aviso"><Icone nome="alert" width={12} height={12} />{l.aviso}</span>}
                    </td>
                    <td className="ent-acoes">
                      {l.e.tentativa > 1 && <span className="badge badge-danger">{l.e.tentativa}ª vez</span>}
                      <button type="button" className="btn btn-outline" onClick={ev => { ev.stopPropagation(); vm.abrirParada(l.e); }}><Icone nome="lapis" />Assinar</button>
                      {l.juntas && <button type="button" className="btn btn-outline ent-juntas" title={l.juntas.dica} onClick={ev => { ev.stopPropagation(); if (l.juntas) vm.abrirJuntas(l.juntas.titulo, l.juntas.lista); }}><Icone nome="checklist" />Assinar as {l.juntas.n}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {vm.vencimentos.length > 0 && (
        <section className="card ent-cartao">
          <div className="card-head"><h3><Icone nome="clock" width={16} height={16} /> Vencendo</h3></div>
          <ul className="ent-linhas">
            {vm.vencimentos.map(v => (
              <li key={v.e.id}><button type="button" className="ent-linha-abre" onClick={() => vm.abrirParada(v.e)}>
                <div><b>{v.e.clienteNome || 'sem cliente'}</b><span className="fraco">{v.sub}</span></div>
                <span className={'badge ' + (v.vencido ? 'badge-danger' : 'badge-warn')}>{v.prazo}</span>
                <span className="btn btn-outline"><Icone nome="lapis" />Assinar</span>
              </button></li>
            ))}
          </ul>
          {vm.maisVencimentos && <button type="button" className="btn btn-ghost" onClick={vm.alternarVencimentos}>{vm.maisVencimentos}</button>}
        </section>
      )}

      {vm.atestados.length > 0 && (
        <section className="card ent-cartao">
          <div className="card-head"><h3><Icone nome="fileText" width={16} height={16} /> Atestados para buscar</h3></div>
          <ul className="ent-linhas">
            {vm.atestados.map(a => (
              <li key={a.s.id}><span className="num fraco ent-pos">{a.posicao}</span>
                <div><b>{a.titulo}</b><span className="fraco">{a.sub}</span></div>
                <span className={'badge ' + (a.s.urgente ? 'badge-warn' : 'badge-neutral')}>{a.s.urgente ? 'Urgente' : 'Pendente'}</span>
                {a.podeConcluir && <button type="button" className="btn btn-outline" onClick={() => void vm.concluirAtestado(a.s.id)}><Icone nome="check" />Buscado</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {vm.obrigacoes.length > 0 && (
        <section className="card ent-cartao">
          <div className="card-head"><h3><Icone nome="calendar" width={16} height={16} /> Obrigações do mês</h3></div>
          <ul className="ent-linhas">
            {vm.obrigacoes.map(o => (
              <li key={o.obrigacao.id}>
                <div><b>{o.obrigacao.nome}</b><span className="fraco">{o.data}{o.naRota ? ' · ' + o.naRota + (o.naRota === 1 ? ' guia na rota' : ' guias na rota') : ''}</span></div>
                <span className={'badge ' + (o.classe === 'hoje' ? 'badge-danger' : o.classe === 'perto' ? 'badge-warn' : 'badge-neutral')}>{o.prazo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function OrdemFixa({ vm }: { vm: Vm }) {
  const arraste = useRef<{ zona: 'superior' | 'central' | 'inferior'; id: string } | null>(null);
  return (
    <section className="card ent-cartao">
      <div className="card-head">
        <h3><Icone nome="list" width={16} height={16} /> Ordem fixa da rota</h3>
        <span className="card-head-ctl"><button type="button" className="btn btn-primary" disabled={vm.salvandoFixa} onClick={() => void vm.salvarFixa()}>
          {vm.salvandoFixa ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}Salvar</button></span>
      </div>
      {vm.zonasDaOrdemFixa.map(z => {
        const ids = vm.fixa[z.id];
        const sugestoes = vm.sugestoesDaFixa(z.id);
        return (
          <div key={z.id} className="ent-fixa-zona">
            <div className="gm-grupo-rotulo"><b>{z.rotulo}</b> <span className="menu-contador">{ids.length}</span></div>
            {!ids.length ? <p className="hint">Nenhum cliente.</p> : (
              <ul className="ent-linhas ent-fixa-lista">
                {ids.map((id, i) => (
                  <li key={id} data-fixa={id}
                    onPointerMove={ev => {
                      const a = arraste.current;
                      if (!a || a.zona !== z.id || a.id === id) return;
                      const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                      const base = i - (ids.indexOf(a.id) < i ? 1 : 0);
                      vm.moverNaFixa(z.id, a.id, ev.clientY < r.top + r.height / 2 ? base : base + 1);
                    }}>
                    <button type="button" className="icon-btn icon-btn-sm ent-puxador" aria-label={'Mover ' + vm.nomeDoCliente(id) + ' na ordem. Alt com seta para cima ou para baixo.'}
                      onPointerDown={ev => { ev.preventDefault(); arraste.current = { zona: z.id, id }; const fim = () => { arraste.current = null; document.removeEventListener('pointerup', fim); }; document.addEventListener('pointerup', fim); }}
                      onKeyDown={ev => { const p = ({ ArrowUp: -1, ArrowDown: 1 } as Record<string, number>)[ev.key]; if (p && ev.altKey) { ev.preventDefault(); vm.moverNaFixa(z.id, id, Math.max(0, i + p)); } }}>
                      <Icone nome="arrastar" />
                    </button>
                    <span className="num fraco ent-pos">{i + 1}</span>
                    <div><b>{vm.nomeDoCliente(id)}</b></div>
                    <button type="button" className="icon-btn icon-btn-sm" aria-label={'Tirar ' + vm.nomeDoCliente(id) + ' da rota fixa'} title="Tirar da rota fixa" onClick={() => vm.tirarDaFixa(z.id, id)}><Icone nome="x" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="ent-combo">
              <input type="text" placeholder="Adicionar cliente…" aria-label={'Adicionar cliente em ' + z.rotulo} value={vm.buscaFixa[z.id] || ''} onChange={e => vm.setBuscaFixa(z.id, e.target.value)} />
              {sugestoes && (
                <ul className="nf-achados ent-achados">
                  {sugestoes.length ? sugestoes.map(s => <li key={s.id}><button type="button" className="popover-item" onClick={() => vm.incluirNaFixa(z.id, s.id)}><span className="popover-texto">{s.nome}</span></button></li>)
                    : <li className="hint">Nenhum cliente livre com esse nome.</li>}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Protocolos({ vm }: { vm: Vm }) {
  return (
    <section className="card ent-cartao">
      <div className="card-head">
        <h3><Icone nome="printer" width={16} height={16} /> Protocolos {vm.contagemProt > 0 && <span className="menu-contador">{vm.contagemProt}</span>}</h3>
        <span className="card-head-ctl"><button type="button" className="btn btn-primary" disabled={vm.rotuloImprimir === 'Imprimir selecionados'} onClick={vm.imprimirSelecionadas}><Icone nome="printer" />{vm.rotuloImprimir}</button></span>
      </div>
      <div className="tarefas-barra-topo ent-filtros">
        <label className="ent-filtro"><span className="hint">De</span><CampoData valor={vm.de} onMudar={vm.setDe} rotulo="De" /></label>
        <label className="ent-filtro"><span className="hint">Até</span><CampoData valor={vm.ate} onMudar={vm.setAte} rotulo="Até" /></label>
        <label className="busca-curta"><Icone nome="search" /><input type="text" enterKeyHint="search" placeholder="Nome, código ou CNPJ" aria-label="Cliente" value={vm.buscaProt} onChange={e => vm.setBuscaProt(e.target.value)} /></label>
        <select className="select-compact" aria-label="Quem entregou" value={vm.pessoaProt} onChange={e => vm.setPessoaProt(e.target.value)}>
          <option value="">Todas as pessoas</option>{vm.pessoasProt.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {vm.contagemProt > 0 && <label className="ent-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} />Marcar todas da lista</label>}
      {vm.carregandoProt ? <Esqueleto linhas={3} /> : vm.erroProt ? <p className="empty">{vm.erroProt}</p> : !vm.diasProt.length ? (
        <p className="empty">Nenhuma entrega feita nesse período{vm.filtrandoProt ? ' com esse filtro' : ''}.</p>
      ) : vm.diasProt.map(d => (
        <div key={d.dia} className="ent-mes">
          <div className="gm-grupo-rotulo ent-mes-topo"><b>{d.rotulo}</b><span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-ghost" onClick={() => vm.fechamentoDoDia(d.dia)}><Icone nome="fileDown" />Fechamento do dia</button></div>
          <ul className="ent-linhas">
            {d.linhas.map(l => (
              <li key={l.e.id}>
                <input type="checkbox" checked={l.marcada} onChange={e => vm.marcar(l.e.id, e.target.checked)} aria-label="Incluir no protocolo" />
                <div><b>{l.e.clienteNome || 'sem cliente'}</b><span className="fraco">{l.sub}</span></div>
                <button type="button" className="btn btn-outline" onClick={() => vm.imprimirUma(l.e)}><Icone nome="printer" />Imprimir</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Qualidade({ vm }: { vm: Vm }) {
  const lista = (itens: Vm['semZona'], vazio: string) => (!itens.length ? <p className="empty">{vazio}</p> : (
    <ul className="ent-linhas">
      {itens.map(x => (
        <li key={x.c.id}><button type="button" className="ent-linha-abre" onClick={() => vm.corrigir(x.c.id)}>
          <div><b>{x.nome}</b><span className="fraco">{x.sub}</span></div>
          {x.naRota && <span className="badge badge-warn">Na rota</span>}
          <span className="btn btn-outline"><Icone nome="mapaPin" />Corrigir</span>
        </button></li>
      ))}
    </ul>
  ));
  return (
    <section className="card ent-cartao">
      <div className="card-head"><h3><Icone nome="mapaPin" width={16} height={16} /> Qualidade da rota</h3></div>
      <div className="field">
        <label>Sem região {vm.totalSemZona > 0 && <span className="menu-contador">{vm.totalSemZona}</span>}</label>
        {lista(vm.semZona, 'Todo cliente ativo já tem região definida.')}
        {vm.maisSemZona && <button type="button" className="btn btn-ghost" onClick={vm.alternarSemZona}>{vm.maisSemZona}</button>}
      </div>
      <div className="field">
        <label>Endereço impreciso {vm.totalImprecisos > 0 && <span className="menu-contador">{vm.totalImprecisos}</span>}</label>
        {lista(vm.imprecisos, 'Todo cliente ativo tem um ponto confiável no mapa.')}
        {vm.maisImprecisos && <button type="button" className="btn btn-ghost" onClick={vm.alternarImprecisos}>{vm.maisImprecisos}</button>}
      </div>
    </section>
  );
}
