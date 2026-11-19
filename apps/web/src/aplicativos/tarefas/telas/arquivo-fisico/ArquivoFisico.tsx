// Arquivo físico (19/11/2026): as caixas do arquivo do escritório e os envelopes dentro delas. Quatro páginas na lateral —
// Caixas, Encontrar, Retirados e Descarte — e a caixa numa janela por cima (também pelo QR da etiqueta: ?caixa=…).
// Desenha o que o useArquivoFisico devolve; a impressão das etiquetas fica em imprimirEtiquetas.ts.
import type { arquivoFisico as af } from '@nads/core';
import { Alerta, BotaoFechar, BotaoIcone, CampoDataComCalendario, Esqueleto, Icone, Vazio, useJanela } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { imprimirEtiquetasDasCaixas, imprimirEtiquetasDasFileiras, imprimirEtiquetasDosEnvelopes, imprimirPlacasDasPrateleiras } from './imprimirEtiquetas';
import { MESES_DO_ANO, useArquivoFisico, type PaginaDoArquivo, type VmDoArquivo } from './useArquivoFisico';
import './arquivoFisico.css';

const TOM: Record<af.SituacaoDaCaixa, string> = { 'no-lugar': 'badge-ok', 'envelope-fora': 'badge-warn', retirada: 'badge-bad', descartada: 'badge-neutral' };

export function ArquivoFisico({ pagina }: { pagina: string }) {
  const p: PaginaDoArquivo = pagina === 'encontrar' || pagina === 'retirados' || pagina === 'descarte' ? pagina : 'caixas';
  const vm = useArquivoFisico(p);
  return (
    <section className="dp-painel af">
      {vm.exemplos && <Alerta naLinha titulo="Dados de exemplo" texto="Nada aqui é do arquivo de verdade." />}
      {vm.erro && <Alerta naLinha titulo="Não deu para ler as caixas" texto={vm.erro} />}
      {!vm.carregada ? <Esqueleto linhas={6} /> : p === 'encontrar' ? <Encontrar vm={vm} /> : p === 'retirados' ? <Retirados vm={vm} /> : p === 'descarte' ? <Descarte vm={vm} /> : <Caixas vm={vm} />}
      {vm.aberta && <JanelaDaCaixa vm={vm} c={vm.aberta} />}
      {vm.abertaSumiu && <Alerta naLinha titulo="A caixa da etiqueta não está na lista" texto="Ela pode ter sido apagada." onFechar={vm.fechar} />}
      {vm.form && <JanelaDoFormulario vm={vm} />}
      {vm.prateleiras && <JanelaDasPrateleiras vm={vm} />}
    </section>
  );
}

/** A célula da empresa: o código em destaque e o nome. */
const Empresa = ({ c }: { c: af.Caixa }) => <><strong className="af-cod">{c.codigo}</strong> {c.nome}</>;
const Situacao = ({ vm, c }: { vm: VmDoArquivo; c: af.Caixa }) => { const s = vm.situacao(c); return <span className={'badge ' + TOM[s]}>{vm.rotuloDaSituacao(s)}</span>; };

// ---------------------------------------------------------------------------------------------------------------------
// Caixas
// ---------------------------------------------------------------------------------------------------------------------
function Caixas({ vm }: { vm: VmDoArquivo }) {
  const f = vm.filtro;
  const imprimir = async () => {
    const lista = vm.achados.map(a => a.caixa);
    if (lista.length > 30 && !window.confirm('Imprimir as etiquetas de ' + lista.length + ' caixas?')) return;
    await imprimirEtiquetasDasCaixas(lista);
  };
  return (
    <>
      <div className="tarefas-barra-topo dp-filtros-linha">
        <label className="busca-curta dp-busca-larga">
          <Icone nome="search" />
          <input type="text" value={f.texto} onChange={e => vm.mudarFiltro({ texto: e.target.value })} placeholder="Código, nome, local ou observação" aria-label="Buscar caixa"
            onKeyDown={e => { if (e.key === 'Escape') vm.mudarFiltro({ texto: '' }); }} />
        </label>
        <MenuDeFiltro rotulo="Departamento" valor={f.departamento} mudar={v => vm.mudarFiltro({ departamento: v as af.Departamento | '' })} opcoes={vm.departamentos} />
        <MenuDeFiltro rotulo="Ano" valor={f.ano == null ? '' : String(f.ano)} mudar={v => vm.mudarFiltro({ ano: v ? Number(v) : null })} opcoes={vm.anos.map(String)} />
        <MenuDeFiltro rotulo="Situação" valor={f.situacao === 'ativas' ? '' : f.situacao || 'todas'} todos="Sem as descartadas"
          mudar={v => vm.mudarFiltro({ situacao: (v === 'todas' ? '' : v || 'ativas') as af.FiltroDoArquivo['situacao'] })}
          opcoes={[{ valor: 'no-lugar', rotulo: 'No lugar' }, { valor: 'envelope-fora', rotulo: 'Envelope fora' }, { valor: 'retirada', rotulo: 'Retirada' }, { valor: 'descartada', rotulo: 'Descartada' }, { valor: 'todas', rotulo: 'Todas' }]} />
        <span className="tarefas-barra-espaco" />
        {!vm.exemplos && <BotaoIcone icone="repeat" titulo="Ler as caixas de novo" onClick={vm.recarregar} />}
        <button type="button" className="btn btn-outline" onClick={vm.abrirPrateleiras} title="As placas das prateleiras e as etiquetas das fileiras, com o QR code">
          <Icone nome="grade" width={16} height={16} />Prateleiras
        </button>
        <button type="button" className="btn btn-outline" disabled={!vm.achados.length} onClick={() => void imprimir()} title="As etiquetas das caixas da lista, duas por folha, com o QR code">
          <Icone nome="qrCode" width={16} height={16} />Etiquetas
        </button>
        <button type="button" className="btn btn-primary" onClick={() => vm.novaCaixa()}><Icone nome="plus" width={16} height={16} />Nova caixa</button>
      </div>
      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Caixas</h3>
          <span className="badge badge-neutral">{vm.achados.length === vm.total ? vm.total : vm.achados.length + ' de ' + vm.total}</span>
          {vm.local && <button type="button" className="chip-f on af-lugar" onClick={vm.tirarLocal} title="Ver todas as caixas"><Icone nome="mapaPin" width={14} height={14} />{vm.local}<Icone nome="x" width={14} height={14} /></button>}
        </div>
        {vm.achados.length ? (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Empresa</th><th>Ano</th><th>Tipo</th><th>Caixa</th><th>Envelopes</th><th>Local</th><th>Situação</th></tr></thead>
              <tbody>
                {vm.achados.map(({ caixa: c }) => (
                  <tr key={c.id} className="dp-linha-abre" onClick={() => vm.abrir(c.id)} title={'Abrir ' + vm.rotulo(c)}>
                    <td><Empresa c={c} /></td>
                    <td className="num">{c.ano}</td>
                    <td>{c.tipo}</td>
                    <td className="num"><strong>{vm.codigo(c.numero)}</strong></td>
                    <td>{c.envelopes.length}{vm.meses(c) && <span className="fraco"> · {vm.meses(c)}</span>}</td>
                    <td>{c.local || <span className="fraco">—</span>}</td>
                    <td><Situacao vm={vm} c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : vm.local ? <Vazio compacto icone="mapaPin" texto={'Nenhuma caixa cadastrada em ' + vm.local + '.'} /> : vm.total ? <Vazio compacto texto="Nenhuma caixa com esse filtro." /> : (
          <Vazio icone="arquivo" titulo="Nenhuma caixa ainda" texto="Cadastre a primeira caixa do arquivo: a empresa, o ano e o código dela.">
            <button type="button" className="btn btn-primary" onClick={() => vm.novaCaixa()}><Icone nome="plus" width={16} height={16} />Nova caixa</button>
          </Vazio>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Encontrar
// ---------------------------------------------------------------------------------------------------------------------
function Encontrar({ vm }: { vm: VmDoArquivo }) {
  const p = vm.procura;
  return (
    <>
      <section className="card af-procura">
        <div className="af-procura-campos">
          <div className="field af-procura-empresa">
            <label htmlFor="af-q">Empresa</label>
            <input id="af-q" type="text" value={p.texto} onChange={e => vm.mudarProcura({ texto: e.target.value })} placeholder="Código ou nome" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="af-dep">Departamento</label>
            <select id="af-dep" value={p.departamento} onChange={e => vm.mudarProcura({ departamento: e.target.value as af.Departamento | '' })}>
              <option value="">Todos</option>
              {vm.departamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="af-ano">Ano</label>
            <select id="af-ano" value={p.ano ?? ''} onChange={e => vm.mudarProcura({ ano: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Todos</option>
              {vm.anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="af-mes">Mês</label>
            <select id="af-mes" value={p.mes ?? ''} onChange={e => vm.mudarProcura({ mes: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Qualquer</option>
              {MESES_DO_ANO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
      </section>
      {!vm.procurou ? <Vazio icone="search" titulo="Onde está o documento?" texto="Diga a empresa (o código ou o nome) e, se souber, o ano e o mês." />
        : !vm.achados.length ? <Vazio compacto texto="Nenhuma caixa com isso. Confira o ano, ou procure sem o mês." />
          : (
            <div className="af-achados">
              {vm.achados.map(({ caixa: c, envelopes }) => (
                <button key={c.id} type="button" className="card af-achado" onClick={() => vm.abrir(c.id, envelopes.length === 1 ? envelopes[0].id : undefined)}>
                  <div className="af-achado-topo">
                    <span className="af-achado-caixa">Caixa {vm.codigo(c.numero)}</span>
                    <span><Empresa c={c} /></span>
                    <span className="tarefas-barra-espaco" />
                    <Situacao vm={vm} c={c} />
                  </div>
                  <div className="af-achado-onde"><Icone nome="mapaPin" width={16} height={16} />{c.local || 'Local não informado'}<span className="fraco"> · {c.ano} · {c.tipo}</span></div>
                  <div className="af-envelopes-mini">
                    {envelopes.map(e => (
                      <span key={e.id} className={'af-env-mini' + (vm.retiradaAberta(e.retiradas) ? ' fora' : '')} title={vm.retiradaAberta(e.retiradas) ? 'Retirado por ' + vm.retiradaAberta(e.retiradas)?.quem : undefined}>
                        {vm.competencia(e.competencia)}{e.observacao && ' · ' + e.observacao}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Retirados
// ---------------------------------------------------------------------------------------------------------------------
function Retirados({ vm }: { vm: VmDoArquivo }) {
  return (
    <section className="card dp-lista">
      <div className="dp-lista-topo">
        <h3 className="dp-titulo">Fora do arquivo</h3>
        <span className="badge badge-neutral">{vm.fora.length}</span>
      </div>
      {vm.fora.length ? (
        <div className="table-wrap">
          <table className="dp-tabela">
            <thead><tr><th>O quê</th><th>Empresa</th><th>Quem levou</th><th>Desde</th><th>Para quê</th><th /></tr></thead>
            <tbody>
              {vm.fora.map(x => (
                <tr key={x.caixa.id + (x.envelope?.id || '')}>
                  <td>
                    <button type="button" className="link-btn" onClick={() => vm.abrir(x.caixa.id, x.envelope?.id)}>
                      {x.envelope ? 'Envelope ' + vm.competencia(x.envelope.competencia) : 'Caixa inteira'}
                    </button>
                    <div className="fraco">Caixa {vm.codigo(x.caixa.numero)} · {x.caixa.ano} · {x.caixa.tipo}</div>
                  </td>
                  <td><Empresa c={x.caixa} /></td>
                  <td>{x.retirada.quem}</td>
                  <td className="num">{vm.quando(x.retirada.em)}<div className={x.dias > 7 ? 'af-atrasado' : 'fraco'}>{x.dias === 0 ? 'hoje' : x.dias === 1 ? 'há 1 dia' : 'há ' + x.dias + ' dias'}</div></td>
                  <td>{x.retirada.motivo || <span className="fraco">—</span>}</td>
                  <td><button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(x.caixa.id, x.envelope?.id ?? null)}>Devolvido</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Vazio compacto icone="check" texto="Nada fora: todas as caixas e envelopes estão no arquivo." />}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Descarte
// ---------------------------------------------------------------------------------------------------------------------
function Descarte({ vm }: { vm: VmDoArquivo }) {
  return (
    <>
      <section className="card af-prazos">
        <h3 className="dp-titulo">Prazos de guarda</h3>
        <p className="fraco">Contados do 1º de janeiro do ano seguinte ao da caixa. São os prazos comuns; confira com o escritório antes de descartar.</p>
        <div className="af-prazos-lista">
          {vm.departamentos.map(d => <span key={d} className="badge badge-suave">{d}: {vm.prazos[d]} anos</span>)}
        </div>
        {!vm.podeDescartar && <p className="fraco">Só o admin marca a caixa como descartada.</p>}
      </section>
      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Já podem ser descartadas</h3>
          <span className="badge badge-neutral">{vm.vencidas.length}</span>
        </div>
        {vm.vencidas.length ? (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Empresa</th><th>Ano</th><th>Tipo</th><th>Caixa</th><th>Local</th><th>Pode desde</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {vm.vencidas.map(c => (
                  <tr key={c.id}>
                    <td><button type="button" className="link-btn" onClick={() => vm.abrir(c.id)}><Empresa c={c} /></button></td>
                    <td className="num">{c.ano}</td>
                    <td>{c.tipo}</td>
                    <td className="num"><strong>{vm.codigo(c.numero)}</strong></td>
                    <td>{c.local || <span className="fraco">—</span>}</td>
                    <td className="num">{vm.liberadaEm(c)}</td>
                    <td><Situacao vm={vm} c={c} /></td>
                    <td>{vm.podeDescartar && <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado || vm.situacao(c) !== 'no-lugar'} onClick={() => void vm.descartar(c)}>Descartada</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vazio compacto icone="check" texto="Nenhuma caixa passou do prazo de guarda." />}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// a janela da caixa
// ---------------------------------------------------------------------------------------------------------------------
function JanelaDaCaixa({ vm, c }: { vm: VmDoArquivo; c: af.Caixa }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const situacao = vm.situacao(c);
  const foraACaixa = vm.retiradaAberta(c.retiradas);
  const descartada = situacao === 'descartada';
  const destaque = useRef<HTMLLIElement>(null);
  // o QR do envelope: a linha dele em destaque, à vista
  useEffect(() => { destaque.current?.scrollIntoView({ block: 'center' }); }, [vm.envelopeEmDestaque]);
  const r = vm.retirando;
  const historico = [...c.retiradas.map(x => ({ x, o: 'Caixa inteira' })), ...c.envelopes.flatMap(e => e.retiradas.map(x => ({ x, o: 'Envelope ' + vm.competencia(e.competencia) })))]
    .filter(h => h.x.devolvidaEm).sort((a, b) => b.x.em.localeCompare(a.x.em));
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela usuario-janela af-janela" role="dialog" aria-modal="true" aria-label={vm.rotulo(c)}>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <div className="usuario-quem">
              <h2><span className="af-cod">{c.codigo}</span> {c.nome}</h2>
              <span className="fraco">Caixa {vm.codigo(c.numero)} · {c.ano} · {c.tipo} · {c.departamento}</span>
            </div>
            <span className="tarefas-barra-espaco" />
            <Situacao vm={vm} c={c} />
            <BotaoIcone icone="qrCode" titulo="Imprimir a etiqueta da caixa" onClick={() => void imprimirEtiquetasDasCaixas([c])} />
            {!descartada && <BotaoIcone icone="lapis" titulo="Editar a caixa" onClick={() => vm.editarCaixa(c)} />}
            {!c.envelopes.length && !foraACaixa && <BotaoIcone icone="lixeira" titulo="Apagar a caixa vazia" disabled={vm.ocupado} onClick={() => void vm.apagar(c)} />}
            <BotaoFechar onClick={vm.fechar} />
          </header>
          <div className="pessoal-rola">
            <section className="card pessoal-cartao af-dados">
              <div><span className="af-rot">Localização</span><strong>{c.local || '—'}</strong></div>
              <div><span className="af-rot">Arquivada em</span>{vm.dataBr(c.arquivadaEm) || '—'}</div>
              <div><span className="af-rot">Pode descartar desde</span>{vm.liberadaEm(c)}</div>
              {c.descartadaEm && <div><span className="af-rot">Descartada</span>{vm.dataBr(c.descartadaEm)} por {c.descartadaPor}</div>}
              {c.observacoes && <div className="af-dados-obs"><span className="af-rot">Observações</span>{c.observacoes}</div>}
            </section>

            {!descartada && (
              <section className="card pessoal-cartao">
                {foraACaixa ? (
                  <div className="af-fora">
                    <Icone nome="alert" width={18} height={18} />
                    <span>A caixa inteira está com <strong>{foraACaixa.quem}</strong> desde {vm.quando(foraACaixa.em)}{foraACaixa.motivo && ' (' + foraACaixa.motivo + ')'}.</span>
                    <span className="tarefas-barra-espaco" />
                    <button type="button" className="btn btn-primary btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(c.id, null)}>Devolvida</button>
                  </div>
                ) : r && r.alvo.envelope == null ? <FormDaRetirada vm={vm} titulo="Retirar a caixa inteira" /> : (
                  <div className="af-fora">
                    <span className="fraco">A caixa está no lugar.</span>
                    <span className="tarefas-barra-espaco" />
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.comecarRetirada(null)}>Retirar a caixa</button>
                  </div>
                )}
              </section>
            )}

            <section className="card pessoal-cartao">
              <div className="card-head af-env-topo">
                <h3>Envelopes ({c.envelopes.length})</h3>
                <span className="tarefas-barra-espaco" />
                {c.envelopes.length > 0 && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void imprimirEtiquetasDosEnvelopes(c, c.envelopes)} title="Uma etiqueta por envelope, como as do mês, com o QR code">
                    <Icone nome="qrCode" width={14} height={14} />Etiquetas dos envelopes
                  </button>
                )}
              </div>
              {c.envelopes.length ? (
                <ul className="af-envelopes">
                  {c.envelopes.map(e => {
                    const fora = vm.retiradaAberta(e.retiradas);
                    const emDestaque = vm.envelopeEmDestaque === e.id;
                    return (
                      <li key={e.id} ref={emDestaque ? destaque : undefined} className={'af-envelope' + (emDestaque ? ' destaque' : '') + (fora ? ' fora' : '')}>
                        <strong className="af-env-mes">{vm.competencia(e.competencia)}</strong>
                        <ObservacaoDoEnvelope vm={vm} e={e} travado={descartada} />
                        {fora ? (
                          <span className="af-env-fora">Com <strong>{fora.quem}</strong> desde {vm.quando(fora.em)}</span>
                        ) : null}
                        <span className="tarefas-barra-espaco" />
                        {!descartada && (fora
                          ? <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(c.id, e.id)}>Devolvido</button>
                          : !foraACaixa && <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.comecarRetirada(e.id)}>Retirar</button>)}
                        <BotaoIcone icone="qrCode" pequeno titulo="Imprimir a etiqueta deste envelope" onClick={() => void imprimirEtiquetasDosEnvelopes(c, [e])} />
                        {!descartada && !fora && <BotaoIcone icone="x" pequeno titulo="Tirar o envelope da caixa" disabled={vm.ocupado} onClick={() => void vm.removerEnvelope(e)} />}
                        {r && r.alvo.envelope === e.id && <div className="af-env-retirada"><FormDaRetirada vm={vm} titulo={'Retirar o envelope ' + vm.competencia(e.competencia)} /></div>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="fraco">Nenhum envelope ainda.</p>}

              {!descartada && (
                <div className="af-novos">
                  <span className="af-rot">Guardar envelopes de {c.ano}</span>
                  <div className="chip-row">
                    {MESES_DO_ANO.map((m, i) => {
                      const comp = c.ano + '-' + String(i + 1).padStart(2, '0');
                      return <button key={comp} type="button" className={'chip-f' + (vm.mesesMarcados.includes(comp) ? ' on' : '')} aria-pressed={vm.mesesMarcados.includes(comp)} onClick={() => vm.marcarMes(comp)}>{m}</button>;
                    })}
                    <button type="button" className={'chip-f' + (vm.mesesMarcados.includes(String(c.ano)) ? ' on' : '')} aria-pressed={vm.mesesMarcados.includes(String(c.ano))} onClick={() => vm.marcarMes(String(c.ano))} title="Um envelope do ano todo (DEFIS, balanço…)">Ano todo</button>
                    <span className="chip-sep" />
                    <button type="button" className="chip-f" onClick={vm.marcarOsQueFaltam}>Os que faltam</button>
                  </div>
                  <div className="af-novos-linha">
                    <input type="text" value={vm.obsDoEnvelope} onChange={e => vm.setObsDoEnvelope(e.target.value)} placeholder="Observação (opcional): notas de entrada, folha, extratos…" aria-label="Observação dos envelopes" maxLength={120} />
                    <button type="button" className="btn btn-primary" disabled={!vm.mesesMarcados.length || vm.ocupado} onClick={() => void vm.adicionarEnvelopes()}>
                      <Icone nome="plus" width={16} height={16} />Guardar {vm.mesesMarcados.length > 1 ? vm.mesesMarcados.length + ' envelopes' : 'envelope'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {historico.length > 0 && (
              <section className="card pessoal-cartao">
                <div className="card-head"><h3>Retiradas que já voltaram</h3></div>
                <ul className="af-historico">
                  {historico.slice(0, 20).map(h => (
                    <li key={h.o + h.x.id}><strong>{h.o}</strong> · {h.x.quem}, {vm.quando(h.x.em)} → {vm.quando(h.x.devolvidaEm)}{h.x.motivo && <span className="fraco"> · {h.x.motivo}</span>}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="af-rodape">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.novaCaixa(c)}><Icone nome="plus" width={14} height={14} />Outra caixa desta empresa</button>
              <span className="fraco">Atualizada por {c.atualizadaPor || '—'} em {vm.quando(c.atualizadaEm)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Quem leva e para quê (o nome vem preenchido com quem está no nads). */
function FormDaRetirada({ vm, titulo }: { vm: VmDoArquivo; titulo: string }) {
  const r = vm.retirando;
  if (!r) return null;
  return (
    <form className="af-retirada" onSubmit={e => { e.preventDefault(); void vm.confirmarRetirada(); }}>
      <strong>{titulo}</strong>
      <input type="text" value={r.quem} onChange={e => vm.mudarRetirada({ quem: e.target.value })} placeholder="Quem está levando" aria-label="Quem está levando" maxLength={80} autoFocus />
      <input type="text" value={r.motivo} onChange={e => vm.mudarRetirada({ motivo: e.target.value })} placeholder="Para quê (opcional)" aria-label="Para quê" maxLength={120} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!r.quem.trim() || vm.ocupado}>Registrar</button>
      <button type="button" className="btn btn-outline btn-sm" onClick={vm.cancelarRetirada}>Cancelar</button>
    </form>
  );
}

/** A observação do envelope, que se edita no lugar (Enter ou sair do campo salva). */
function ObservacaoDoEnvelope({ vm, e, travado }: { vm: VmDoArquivo; e: af.Envelope; travado: boolean }) {
  const [texto, setTexto] = useState<string | null>(null);
  if (travado) return e.observacao ? <span className="af-env-obs">{e.observacao}</span> : null;
  if (texto == null) return <button type="button" className="af-env-obs link-btn" onClick={() => setTexto(e.observacao)} title="Escrever uma observação">{e.observacao || <span className="fraco">+ observação</span>}</button>;
  const salvar = () => { const t = texto.trim(); setTexto(null); if (t !== e.observacao) void vm.mudarObservacao(e.id, t); };
  return <input className="af-env-obs-campo" type="text" value={texto} autoFocus maxLength={120} aria-label="Observação do envelope" onChange={ev => setTexto(ev.target.value)} onBlur={salvar}
    onKeyDown={ev => { if (ev.key === 'Enter') salvar(); if (ev.key === 'Escape') setTexto(null); }} />;
}

// ---------------------------------------------------------------------------------------------------------------------
// o formulário da caixa (nova ou editando)
// ---------------------------------------------------------------------------------------------------------------------
function JanelaDoFormulario({ vm }: { vm: VmDoArquivo }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharForm);
  const f = vm.form;
  if (!f) return null;
  const editando = !!vm.editando;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharForm(); }}>
      <div ref={janela} className="pessoal-janela usuario-janela af-janela-form" role="dialog" aria-modal="true" aria-label={editando ? 'Editar a caixa' : 'Nova caixa'}>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <div className="usuario-quem"><h2>{editando ? 'Editar a caixa' : 'Nova caixa'}</h2></div>
            <span className="tarefas-barra-espaco" />
            <BotaoFechar onClick={vm.fecharForm} />
          </header>
          <form className="pessoal-rola" onSubmit={e => { e.preventDefault(); void vm.salvarForm(); }}>
            <section className="card pessoal-cartao af-form">
              <div className="field af-form-empresa">
                <label htmlFor="af-emp">Empresa</label>
                {editando ? <strong><span className="af-cod">{f.codigo}</span> {f.nome}</strong> : (
                  <>
                    <input id="af-emp" type="text" value={f.empresaTexto} onChange={e => vm.mudarForm({ empresaTexto: e.target.value })} placeholder="Código ou nome da empresa" autoFocus autoComplete="off" />
                    {vm.empresasAchadas.length > 0 && (
                      <ul className="af-sugestoes" role="listbox">
                        {vm.empresasAchadas.map(e => (
                          <li key={e.codigo}><button type="button" role="option" aria-selected={false} onClick={() => vm.escolherEmpresa(e)}><strong className="af-cod">{e.codigo}</strong> {e.nome}</button></li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="af-form-linha">
                <div className="field">
                  <label htmlFor="af-fdep">Departamento</label>
                  <select id="af-fdep" value={f.departamento} disabled={editando} onChange={e => vm.mudarForm({ departamento: e.target.value as af.Departamento })}>
                    {vm.departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="af-ftipo">Tipo</label>
                  <input id="af-ftipo" type="text" value={f.tipo} onChange={e => vm.mudarForm({ tipo: e.target.value })} placeholder="PJ-F" maxLength={12} />
                </div>
                <div className="field">
                  <label htmlFor="af-fano">Ano</label>
                  <input id="af-fano" type="number" value={f.ano ?? ''} disabled={editando} onChange={e => vm.mudarForm({ ano: e.target.value ? Number(e.target.value) : null })} min={1950} max={2100} />
                </div>
                <div className="field">
                  <label htmlFor="af-fnum">Código da caixa</label>
                  <input id="af-fnum" type="number" value={f.numero ?? ''} disabled={editando} onChange={e => vm.mudarForm({ numero: e.target.value ? Number(e.target.value) : null })} min={1} max={999} />
                </div>
              </div>
              <div className="af-form-linha">
                <div className="field">
                  <label htmlFor="af-fdata">Data do arquivamento</label>
                  <CampoDataComCalendario id="af-fdata" rotulo="Data do arquivamento" valor={f.arquivadaTexto} onMudar={v => vm.mudarForm({ arquivadaTexto: v })} />
                </div>
                <div className="field">
                  <label htmlFor="af-fpra">Prateleira</label>
                  <select id="af-fpra" value={vm.lugarDoForm?.prateleira ?? ''} onChange={e => vm.escolherLugar({ prateleira: Number(e.target.value) })}>
                    {!vm.lugarDoForm && <option value="">—</option>}
                    {vm.lugaresPossiveis.prateleiras.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="af-ffil">Fileira</label>
                  <select id="af-ffil" value={vm.lugarDoForm?.fileira ?? ''} onChange={e => vm.escolherLugar({ fileira: Number(e.target.value) })}>
                    {!vm.lugarDoForm && <option value="">—</option>}
                    {vm.lugaresPossiveis.fileiras.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="af-form-linha">
                <div className="field af-form-local">
                  <label htmlFor="af-flocal">Localização</label>
                  <input id="af-flocal" type="text" value={f.local} onChange={e => vm.mudarForm({ local: e.target.value })} placeholder="Escolha a prateleira e a fileira, ou escreva o lugar" maxLength={80} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="af-fobs">Observações</label>
                <textarea id="af-fobs" rows={2} value={f.observacoes} onChange={e => vm.mudarForm({ observacoes: e.target.value })} maxLength={300} />
              </div>
              {!editando && (
                <label className="af-check">
                  <input type="checkbox" checked={f.comOsMeses} onChange={e => vm.mudarForm({ comOsMeses: e.target.checked })} />
                  Já com os envelopes de janeiro a dezembro de {f.ano ?? 'ano'}
                </label>
              )}
              {vm.problemaDoForm && f.codigo != null && <p className="af-problema">{vm.problemaDoForm}</p>}
            </section>
            <div className="af-form-botoes">
              <button type="button" className="btn btn-outline" onClick={vm.fecharForm}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={!!vm.problemaDoForm || vm.ocupado}>{editando ? 'Salvar' : 'Criar caixa'}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// a impressão das prateleiras (19/11/2026: "tem 6 prateleiras, cada uma tem 6 fileiras")
// ---------------------------------------------------------------------------------------------------------------------
function JanelaDasPrateleiras({ vm }: { vm: VmDoArquivo }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharPrateleiras);
  const p = vm.prateleiras;
  if (!p) return null;
  const contas = vm.contasDasPrateleiras();
  const fileiras = contas.prateleiras * contas.fileiras;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharPrateleiras(); }}>
      <div ref={janela} className="pessoal-janela usuario-janela af-janela-form" role="dialog" aria-modal="true" aria-label="Identificação das prateleiras">
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <div className="usuario-quem"><h2>Identificação das prateleiras</h2><span className="fraco">A placa de cada prateleira e a etiqueta de cada fileira</span></div>
            <span className="tarefas-barra-espaco" />
            <BotaoFechar onClick={vm.fecharPrateleiras} />
          </header>
          <div className="pessoal-rola">
            <section className="card pessoal-cartao af-form">
              <div className="af-form-linha">
                <div className="field">
                  <label htmlFor="af-npra">Prateleiras</label>
                  <input id="af-npra" type="number" min={1} max={30} value={p.prateleiras} onChange={e => vm.mudarPrateleiras({ prateleiras: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="af-nfil">Fileiras em cada uma</label>
                  <input id="af-nfil" type="number" min={1} max={20} value={p.fileiras} onChange={e => vm.mudarPrateleiras({ fileiras: e.target.value })} />
                </div>
              </div>
              <div className="af-imprimir-opcao">
                <div><strong>Placas das prateleiras</strong><div className="fraco">{contas.prateleiras} folhas A4 deitadas, uma por prateleira, com o número grande.</div></div>
                <button type="button" className="btn btn-outline" onClick={() => imprimirPlacasDasPrateleiras(contas.prateleiras, contas.fileiras)}><Icone nome="impressora" width={16} height={16} />Imprimir</button>
              </div>
              <div className="af-imprimir-opcao">
                <div><strong>Etiquetas das fileiras</strong><div className="fraco">{fileiras} etiquetas, oito por folha A4 ({Math.ceil(fileiras / 8)} folhas). O QR code abre no celular as caixas daquela fileira.</div></div>
                <button type="button" className="btn btn-primary" onClick={() => void imprimirEtiquetasDasFileiras(contas.prateleiras, contas.fileiras)}><Icone nome="qrCode" width={16} height={16} />Imprimir</button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
