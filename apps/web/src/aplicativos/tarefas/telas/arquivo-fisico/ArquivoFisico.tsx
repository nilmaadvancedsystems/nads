// Arquivo físico (19/11/2026): as caixas do arquivo do escritório e os envelopes dentro delas. Quatro páginas na lateral —
// Caixas, Encontrar, Retirados e Descarte — e a caixa numa janela por cima (também pelo QR da etiqueta: ?caixa=…).
// Desenha o que o useArquivoFisico devolve; a impressão das etiquetas fica em imprimirEtiquetas.ts.
import type { arquivoFisico as af } from '@nads/core';
import { Alerta, BotaoFechar, BotaoIcone, CampoDataComCalendario, Esqueleto, Icone, MenuSuspenso, Vazio, useJanela, type ItemMenu } from '@nads/ui';
import { useRef, useState } from 'react';
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
      <div className="tarefas-barra-topo dp-filtros-linha af-barra">
        <label className="busca-curta dp-busca-larga af-busca">
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
        <div className="af-acoes">
          {!vm.exemplos && <BotaoIcone icone="repeat" titulo="Ler as caixas de novo" onClick={vm.recarregar} />}
          <button type="button" className="btn btn-outline" onClick={vm.abrirPrateleiras} title="As placas das prateleiras e as etiquetas das fileiras, com o QR code" aria-label="Prateleiras">
            <Icone nome="grade" width={16} height={16} /><span className="af-rotulo-btn">Prateleiras</span>
          </button>
          <button type="button" className="btn btn-outline" disabled={!vm.achados.length} onClick={() => void imprimir()} title="As etiquetas das caixas da lista, duas por folha, com o QR code" aria-label="Etiquetas das caixas">
            <Icone nome="qrCode" width={16} height={16} /><span className="af-rotulo-btn">Etiquetas</span>
          </button>
          <button type="button" className="btn btn-primary af-nova" onClick={() => vm.novaCaixa()}><Icone nome="plus" width={16} height={16} />Nova caixa</button>
        </div>
      </div>
      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Caixas</h3>
          <span className="badge badge-neutral">{vm.achados.length === vm.total ? vm.total : vm.achados.length + ' de ' + vm.total}</span>
          {vm.local && <button type="button" className="chip-f on af-lugar" onClick={vm.tirarLocal} title="Ver todas as caixas"><Icone nome="mapaPin" width={14} height={14} />{vm.local}<Icone nome="x" width={14} height={14} /></button>}
        </div>
        {vm.achados.length ? (<>
          {/* no celular, um cartão por caixa (a tabela não cabe) */}
          <ul className="af-cartoes">
            {vm.achados.map(({ caixa: c }) => (
              <li key={c.id}>
                <button type="button" className="af-cartao" onClick={() => vm.abrir(c.id)}>
                  <span className="af-cartao-l1"><Empresa c={c} /></span>
                  <span className="af-cartao-l2"><strong>Caixa {vm.codigo(c.numero)}</strong> · {c.ano} · {c.tipo}<span className="tarefas-barra-espaco" /><Situacao vm={vm} c={c} /></span>
                  <span className="af-cartao-l3"><Icone nome="mapaPin" width={14} height={14} />{c.local || 'Sem local'} · {c.envelopes.length} env.{vm.meses(c) && ' (' + vm.meses(c) + ')'}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="table-wrap af-tabela">
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
        </>) : vm.local ? <Vazio compacto icone="mapaPin" texto={'Nenhuma caixa cadastrada em ' + vm.local + '.'} /> : vm.total ? <Vazio compacto texto="Nenhuma caixa com esse filtro." /> : (
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
      {vm.fora.length ? (<>
        <ul className="af-cartoes">
          {vm.fora.map(x => (
            <li key={x.caixa.id + (x.envelope?.id || '')} className="af-cartao af-cartao-fixo">
              <button type="button" className="af-cartao-abre" onClick={() => vm.abrir(x.caixa.id, x.envelope?.id)}>
                <span className="af-cartao-l1"><strong>{x.envelope ? 'Envelope ' + vm.competencia(x.envelope.competencia) : 'Caixa inteira'}</strong> · <Empresa c={x.caixa} /></span>
                <span className="af-cartao-l3">Caixa {vm.codigo(x.caixa.numero)} · {x.caixa.ano} · {x.caixa.tipo}</span>
                <span className="af-cartao-l4">Com <strong>{x.retirada.quem}</strong> · <span className={x.dias > 7 ? 'af-atrasado' : ''}>{x.dias === 0 ? 'hoje' : x.dias === 1 ? 'há 1 dia' : 'há ' + x.dias + ' dias'}</span>{x.retirada.motivo && <span className="fraco"> · {x.retirada.motivo}</span>}</span>
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(x.caixa.id, x.envelope?.id ?? null)}>Devolvido</button>
            </li>
          ))}
        </ul>
        <div className="table-wrap af-tabela">
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
      </>) : <Vazio compacto icone="check" texto="Nada fora: todas as caixas e envelopes estão no arquivo." />}
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
        {vm.vencidas.length ? (<>
          <ul className="af-cartoes">
            {vm.vencidas.map(c => (
              <li key={c.id} className="af-cartao af-cartao-fixo">
                <button type="button" className="af-cartao-abre" onClick={() => vm.abrir(c.id)}>
                  <span className="af-cartao-l1"><Empresa c={c} /></span>
                  <span className="af-cartao-l2"><strong>Caixa {vm.codigo(c.numero)}</strong> · {c.ano} · {c.tipo}<span className="tarefas-barra-espaco" /><Situacao vm={vm} c={c} /></span>
                  <span className="af-cartao-l3">Pode desde {vm.liberadaEm(c)} · {c.local || 'Sem local'}</span>
                </button>
                {vm.podeDescartar && <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado || vm.situacao(c) !== 'no-lugar'} onClick={() => void vm.descartar(c)}>Descartada</button>}
              </li>
            ))}
          </ul>
          <div className="table-wrap af-tabela">
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
        </>) : <Vazio compacto icone="check" texto="Nenhuma caixa passou do prazo de guarda." />}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// a janela da caixa (19/11/2026: "essa tela ta com muito botão e confusa"): em cima, onde a caixa está; no meio, a grade
// dos 12 meses (o que está na caixa, o que falta e o que saiu, de uma olhada); tocar num mês mostra embaixo só o que dá
// para fazer com ele. As ações da caixa que se usam pouco (imprimir, editar, apagar) ficam no ⋯ do alto.
// ---------------------------------------------------------------------------------------------------------------------
const MESES_POR_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;

function JanelaDaCaixa({ vm, c }: { vm: VmDoArquivo; c: af.Caixa }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const descartada = vm.situacao(c) === 'descartada';
  const foraACaixa = vm.retiradaAberta(c.retiradas);
  const grade = vm.grade;
  const r = vm.retirando;
  const podeApagar = !c.envelopes.length && !foraACaixa;
  const acoes: ItemMenu[] = [
    { rotulo: 'Imprimir a etiqueta da caixa', icone: 'qrCode', onClick: () => void imprimirEtiquetasDasCaixas([c]) },
    { rotulo: 'Imprimir as etiquetas dos envelopes', icone: 'impressora', desabilitado: !c.envelopes.length, onClick: () => void imprimirEtiquetasDosEnvelopes(c, c.envelopes) },
    'separador',
    { rotulo: 'Editar a caixa', icone: 'lapis', desabilitado: descartada, onClick: () => vm.editarCaixa(c) },
    { rotulo: 'Outra caixa desta empresa', icone: 'plus', onClick: () => vm.novaCaixa(c) },
    ...(podeApagar ? ['separador' as const, { rotulo: 'Apagar a caixa vazia', icone: 'lixeira' as const, perigo: true, onClick: () => void vm.apagar(c) }] : []),
  ];
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
            <MenuSuspenso rotulo="" icone="mais" semSeta className="icon-btn" dica="Mais ações da caixa" direita flutuante itens={acoes} />
            <BotaoFechar onClick={vm.fechar} />
          </header>
          <div className="pessoal-rola">
            {/* onde a caixa está, e a retirada da caixa inteira */}
            <section className="card pessoal-cartao af-resumo">
              <div className="af-onde">
                <Icone nome="mapaPin" width={20} height={20} />
                <div>
                  <strong className="af-onde-local">{c.local || 'Sem local'}</strong>
                  <div className="fraco">Arquivada em {vm.dataBr(c.arquivadaEm) || '—'}{c.descartadaEm && ' · descartada em ' + vm.dataBr(c.descartadaEm) + ' por ' + c.descartadaPor}</div>
                </div>
                <span className="tarefas-barra-espaco" />
                {!descartada && !foraACaixa && !(r && r.alvo.envelope == null) && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.comecarRetirada(null)}>Retirar a caixa</button>
                )}
              </div>
              {c.observacoes && <p className="af-obs-caixa">{c.observacoes}</p>}
              {foraACaixa && (
                <div className="af-aviso-fora">
                  <Icone nome="alert" width={18} height={18} />
                  <span>A caixa inteira está com <strong>{foraACaixa.quem}</strong> desde {vm.quando(foraACaixa.em)}{foraACaixa.motivo && ' (' + foraACaixa.motivo + ')'}.</span>
                  <button type="button" className="btn btn-primary btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(c.id, null)}>Devolvida</button>
                </div>
              )}
              {r && r.alvo.envelope == null && <FormDaRetirada vm={vm} titulo="Quem está levando a caixa?" />}
            </section>

            {/* a grade dos meses */}
            {grade && (
              <section className="card pessoal-cartao">
                <div className="af-grade-topo">
                  <h3>Envelopes de {c.ano}</h3>
                  <span className="fraco">{12 - grade.faltam} de 12 meses</span>
                  <span className="tarefas-barra-espaco" />
                  {!descartada && grade.faltam > 0 && <button type="button" className="link-btn" disabled={vm.ocupado} onClick={() => void vm.completarOAno()}>{grade.faltam === 1 ? 'Guardar o que falta' : 'Guardar os ' + grade.faltam + ' que faltam'}</button>}
                </div>
                <div className="af-grade" role="group" aria-label={'Os meses de ' + c.ano}>
                  {grade.meses.map(m => {
                    const e = m.envelope;
                    const fora = e ? vm.retiradaAberta(e.retiradas) : null;
                    const id = e ? e.id : 'mes:' + m.competencia;
                    const escolhido = vm.escolhido === id;
                    return (
                      <button key={m.competencia} type="button" disabled={!e && descartada} aria-pressed={escolhido}
                        className={'af-mes' + (e ? ' tem' : ' falta') + (fora || (e && foraACaixa) ? ' fora' : '') + (escolhido ? ' escolhido' : '')}
                        title={e ? (fora ? 'Com ' + fora.quem : 'Na caixa') + (e.observacao ? ' · ' + e.observacao : '') : 'Não está na caixa'}
                        onClick={() => vm.escolher(id)}>
                        <span className="af-mes-nome">{MESES_DO_ANO[m.mes - 1]}</span>
                        <span className="af-mes-info">{e ? (fora ? primeiroNome(fora.quem) : e.observacao || 'Na caixa') : 'Falta'}</span>
                      </button>
                    );
                  })}
                </div>
                {(grade.outros.length > 0 || !descartada) && (
                  <div className="af-outros">
                    {grade.outros.map(e => {
                      const fora = vm.retiradaAberta(e.retiradas);
                      return (
                        <button key={e.id} type="button" aria-pressed={vm.escolhido === e.id}
                          className={'af-outro' + (fora ? ' fora' : '') + (vm.escolhido === e.id ? ' escolhido' : '')} onClick={() => vm.escolher(e.id)}>
                          <strong>{vm.competencia(e.competencia)}</strong>{e.observacao && ' · ' + e.observacao}
                        </button>
                      );
                    })}
                    {!descartada && (
                      <button type="button" className={'af-outro af-outro-novo' + (vm.escolhido === 'novo' ? ' escolhido' : '')} onClick={() => vm.escolher('novo')}>
                        <Icone nome="plus" width={14} height={14} />Outro envelope
                      </button>
                    )}
                  </div>
                )}
                <PainelDoEnvelope vm={vm} c={c} />
              </section>
            )}

            <p className="af-rodape fraco">Pode descartar a partir de {vm.liberadaEm(c)} · atualizada por {c.atualizadaPor || '—'} em {vm.quando(c.atualizadaEm)}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** O que dá para fazer com o mês ou o envelope tocado na grade. */
function PainelDoEnvelope({ vm, c }: { vm: VmDoArquivo; c: af.Caixa }) {
  const x = vm.escolhido;
  if (!x) return null;
  const descartada = vm.situacao(c) === 'descartada';
  const foraACaixa = vm.retiradaAberta(c.retiradas);
  const r = vm.retirando;
  if (x.startsWith('mes:') || x === 'novo') {
    const novo = x === 'novo';
    const comp = novo ? vm.compNova : x.slice(4);
    const mes = Number(comp.slice(5, 7));
    return (
      <form className="af-painel" onSubmit={e => { e.preventDefault(); void vm.guardar(comp); }}>
        <strong className="af-painel-titulo">{novo ? 'Outro envelope' : MESES_POR_EXTENSO[mes - 1] + ' de ' + c.ano + ' não está na caixa'}</strong>
        <div className="af-painel-campos">
          {novo && (
            <select value={vm.compNova} onChange={e => vm.setCompNova(e.target.value)} aria-label="De quando é o envelope">
              {vm.competenciasDaCaixa.map(cp => <option key={cp} value={cp}>{cp.length === 4 ? 'O ano todo (' + cp + ')' : MESES_POR_EXTENSO[Number(cp.slice(5, 7)) - 1]}</option>)}
            </select>
          )}
          <input type="text" value={vm.obsNova} onChange={e => vm.setObsNova(e.target.value)} placeholder={novo ? 'O que tem nele (DEFIS, notas de entrada…)' : 'Observação (opcional)'} aria-label="Observação do envelope" maxLength={120} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={vm.ocupado}>Guardar o envelope</button>
        </div>
      </form>
    );
  }
  const e = c.envelopes.find(y => y.id === x);
  if (!e) return null;
  const fora = vm.retiradaAberta(e.retiradas);
  const retirandoEste = !!r && r.alvo.envelope === e.id;
  return (
    <div className="af-painel">
      <div className="af-painel-cab">
        <strong className="af-painel-titulo">Envelope {vm.competencia(e.competencia)}</strong>
        <ObservacaoDoEnvelope vm={vm} e={e} travado={descartada} />
      </div>
      <div className={'af-painel-situacao' + (fora || foraACaixa ? ' fora' : '')}>
        {fora ? <>Com <strong>{fora.quem}</strong> desde {vm.quando(fora.em)}{fora.motivo && ' · ' + fora.motivo}</>
          : foraACaixa ? <>Saiu junto com a caixa inteira.</> : <>Na caixa.</>}
      </div>
      {retirandoEste ? <FormDaRetirada vm={vm} titulo="Quem está levando o envelope?" /> : (
        <div className="af-painel-acoes">
          {!descartada && fora && <button type="button" className="btn btn-primary btn-sm" disabled={vm.ocupado} onClick={() => void vm.devolver(c.id, e.id)}>Devolvido</button>}
          {!descartada && !fora && !foraACaixa && <button type="button" className="btn btn-primary btn-sm" onClick={() => vm.comecarRetirada(e.id)}>Retirar</button>}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void imprimirEtiquetasDosEnvelopes(c, [e])}><Icone nome="qrCode" width={14} height={14} />Etiqueta</button>
          <span className="tarefas-barra-espaco" />
          {!descartada && !fora && <button type="button" className="link-btn af-perigo" disabled={vm.ocupado} onClick={() => void vm.removerEnvelope(e)}>Tirar da caixa</button>}
        </div>
      )}
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
