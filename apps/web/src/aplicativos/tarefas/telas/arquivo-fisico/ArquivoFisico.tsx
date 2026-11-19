// Arquivo físico (19/11/2026): as caixas do arquivo do escritório e os envelopes dentro delas. Quatro páginas na lateral —
// Caixas, Encontrar, Retirados e Descarte — e a caixa numa janela por cima (também pelo QR da etiqueta: ?caixa=…).
// Desenha o que o useArquivoFisico devolve; a impressão das etiquetas fica em imprimirEtiquetas.ts.
import type { arquivoFisico as af } from '@nads/core';
import { Alerta, BotaoFechar, BotaoIcone, CampoDataComCalendario, CampoEscolha, Esqueleto, Icone, MenuSuspenso, Vazio, useJanela, type ItemMenu } from '@nads/ui';
import { useRef, useState } from 'react';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { imprimirEtiquetasDasCaixas, imprimirEtiquetasDasFileiras, imprimirEtiquetasDosEnvelopes, imprimirPlacasDasPrateleiras } from './imprimirEtiquetas';
import { MESES_DO_ANO, useArquivoFisico, type PaginaDoArquivo, type VmDoArquivo } from './useArquivoFisico';
import './arquivoFisico.css';

const TOM: Record<af.SituacaoDaCaixa, string> = { 'no-lugar': 'badge-ok', 'envelope-fora': 'badge-warn', retirada: 'badge-bad', devolvida: 'badge-info', descartada: 'badge-neutral' };

export function ArquivoFisico({ pagina }: { pagina: string }) {
  const p: PaginaDoArquivo = pagina === 'arquivar' || pagina === 'encontrar' || pagina === 'retirados' || pagina === 'devolucao' ? pagina : 'caixas';
  const vm = useArquivoFisico(p);
  return (
    <section className="dp-painel af">
      {vm.exemplos && <Alerta naLinha titulo="Dados de exemplo" texto="Nada aqui é do arquivo de verdade." />}
      {vm.erro && <Alerta naLinha titulo="Não deu para ler as caixas" texto={vm.erro} />}
      {!vm.carregada ? <Esqueleto linhas={6} /> : p === 'arquivar' ? <AArquivar vm={vm} /> : p === 'encontrar' ? <Encontrar vm={vm} /> : p === 'retirados' ? <Retirados vm={vm} /> : p === 'devolucao' ? <Devolucao vm={vm} /> : <Caixas vm={vm} />}
      {vm.aberta && <JanelaDaCaixa vm={vm} c={vm.aberta} />}
      {vm.abertaSumiu && <Alerta naLinha titulo="A caixa da etiqueta não está na lista" texto="Ela pode ter sido apagada." onFechar={vm.fechar} />}
      {vm.form && <JanelaDoFormulario vm={vm} />}
      {vm.prateleiras && <JanelaDasPrateleiras vm={vm} />}
      {(vm.lido || vm.lidoInvalido) && <JanelaDoEnvelopeLido vm={vm} />}
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
          opcoes={[{ valor: 'no-lugar', rotulo: 'No lugar' }, { valor: 'envelope-fora', rotulo: 'Envelope fora' }, { valor: 'retirada', rotulo: 'Retirada' }, { valor: 'devolvida', rotulo: 'Com o cliente' }, { valor: 'todas', rotulo: 'Todas' }]} />
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
// A arquivar (19/11/2026: "o responsável imprime, coloca o envelope, e outra pessoa arquiva"): os envelopes impressos que
// ainda não foram guardados; tocar abre o envelope como se o QR tivesse sido lido (e lá se confirma o arquivamento)
// ---------------------------------------------------------------------------------------------------------------------
function AArquivar({ vm }: { vm: VmDoArquivo }) {
  const dias = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return (
    <section className="card dp-lista">
      <div className="dp-lista-topo">
        <h3 className="dp-titulo">Aguardando arquivamento</h3>
        <span className="badge badge-neutral">{vm.aguardando.length}</span>
      </div>
      {vm.erroDosImpressos && <Alerta naLinha titulo="Não deu para ler os envelopes impressos" texto={vm.erroDosImpressos} />}
      {!vm.impressosCarregados ? <Esqueleto linhas={3} /> : vm.aguardando.length ? (
        <ul className="af-cartoes af-fila">
          {vm.aguardando.map(x => {
            const d = dias(x.impressoEm);
            return (
              <li key={x.id} className="af-cartao af-cartao-fixo">
                <button type="button" className="af-cartao-abre" onClick={() => vm.arquivar(x)}>
                  <span className="af-cartao-l1"><strong>Envelope {vm.competencia(x.competencia)}</strong> · <strong className="af-cod">{x.codigo}</strong> {x.nome}</span>
                  <span className="af-cartao-l4">Impresso por <strong>{x.impressoPor || '—'}</strong> {d === 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'} · {x.departamento}</span>
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => vm.arquivar(x)}>Arquivar</button>
              </li>
            );
          })}
        </ul>
      ) : <Vazio compacto icone="check" texto="Nenhum envelope esperando: tudo o que foi impresso já está no arquivo." />}
    </section>
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
            <label>Departamento</label>
            <CampoEscolha rotulo="Departamento" valor={p.departamento || 'todos'} onMudar={v => vm.mudarProcura({ departamento: v === 'todos' ? '' : v as af.Departamento })}
              opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...vm.departamentos]} />
          </div>
          <div className="field">
            <label>Ano</label>
            <CampoEscolha rotulo="Ano" valor={p.ano == null ? 'todos' : String(p.ano)} onMudar={v => vm.mudarProcura({ ano: v === 'todos' ? null : Number(v) })}
              opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...vm.anos.map(String)]} />
          </div>
          <div className="field">
            <label>Mês</label>
            <CampoEscolha rotulo="Mês" valor={p.mes == null ? 'qualquer' : String(p.mes)} onMudar={v => vm.mudarProcura({ mes: v === 'qualquer' ? null : Number(v) })}
              opcoes={[{ valor: 'qualquer', rotulo: 'Qualquer' }, ...MESES_POR_EXTENSO.map((m, i) => ({ valor: String(i + 1), rotulo: m }))]} />
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
// Devolução (19/11/2026: "as caixas ficam no escritório 2 anos"; depois "volta para o cliente", contando do fim do ano da
// caixa): as que já podem voltar, e o registro da entrega com quem recebeu
// ---------------------------------------------------------------------------------------------------------------------
function Devolucao({ vm }: { vm: VmDoArquivo }) {
  const d = vm.devolvendo;
  const FormDaEntrega = ({ c }: { c: af.Caixa }) => (d && d.caixa === c.id ? (
    <form className="af-retirada af-entrega" onSubmit={e => { e.preventDefault(); void vm.confirmarDevolucao(); }}>
      <input type="text" value={d.para} onChange={e => vm.mudarDevolucao(e.target.value)} placeholder="Quem recebeu no cliente" aria-label="Quem recebeu no cliente" maxLength={80} autoFocus />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!d.para.trim() || vm.ocupado}>Entregue</button>
      <button type="button" className="btn btn-outline btn-sm" onClick={vm.cancelarDevolucao}>Cancelar</button>
    </form>
  ) : null);
  return (
    <>
      <section className="card af-prazos">
        <h3 className="dp-titulo">Volta para o cliente</h3>
        <p className="fraco">A caixa fica {vm.anosNoEscritorio} anos no escritório, contados do fim do ano dela: a de 2026 fica até 31/12/2028 e volta para o cliente a partir de 01/01/2029.</p>
      </section>
      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Já podem voltar</h3>
          <span className="badge badge-neutral">{vm.vencidas.length}</span>
        </div>
        {vm.vencidas.length ? (
          <ul className="af-cartoes af-fila">
            {vm.vencidas.map(c => (
              <li key={c.id} className="af-cartao af-cartao-fixo af-cartao-entrega">
                <button type="button" className="af-cartao-abre" onClick={() => vm.abrir(c.id)}>
                  <span className="af-cartao-l1"><Empresa c={c} /></span>
                  <span className="af-cartao-l2"><strong>Caixa {vm.codigo(c.numero)}</strong> · {c.ano} · {c.tipo}<span className="tarefas-barra-espaco" /><Situacao vm={vm} c={c} /></span>
                  <span className="af-cartao-l3">Pode voltar desde {vm.liberadaEm(c)} · {c.local || 'Sem local'}</span>
                </button>
                {!(d && d.caixa === c.id) && <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado || vm.situacao(c) !== 'no-lugar'} title={vm.situacao(c) !== 'no-lugar' ? 'Há coisa retirada desta caixa' : undefined} onClick={() => vm.comecarDevolucao(c)}>Entregar ao cliente</button>}
                <FormDaEntrega c={c} />
              </li>
            ))}
          </ul>
        ) : <Vazio compacto icone="check" texto="Nenhuma caixa completou os 2 anos no escritório." />}
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
  // a caixa que voltou para o cliente (ou foi descartada) não mexe mais: só se vê
  const descartada = vm.situacao(c) === 'descartada' || vm.situacao(c) === 'devolvida';
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
                  <div className="fraco">Arquivada em {vm.dataBr(c.arquivadaEm) || '—'}{c.devolvidaEm && ' · voltou para o cliente em ' + vm.dataBr(c.devolvidaEm) + ' (recebeu: ' + c.devolvidaPara + '; entregou: ' + c.devolvidaPor + ')'}{c.descartadaEm && ' · descartada em ' + vm.dataBr(c.descartadaEm) + ' por ' + c.descartadaPor}</div>
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
                    // impresso e esperando quem arquive (o responsável já pôs o papel no envelope)
                    const impresso = !e ? vm.impressoDoMes(c, m.competencia) : null;
                    return (
                      <button key={m.competencia} type="button" disabled={!e && descartada} aria-pressed={escolhido}
                        className={'af-mes' + (e ? ' tem' : impresso ? ' impresso' : ' falta') + (fora || (e && foraACaixa) ? ' fora' : '') + (escolhido ? ' escolhido' : '')}
                        title={e ? (fora ? 'Com ' + fora.quem : 'Na caixa') + (e.observacao ? ' · ' + e.observacao : '') : impresso ? 'Impresso por ' + impresso.impressoPor + ': falta arquivar' : 'Não está na caixa'}
                        onClick={() => vm.escolher(id)}>
                        <span className="af-mes-nome">{MESES_DO_ANO[m.mes - 1]}</span>
                        <span className="af-mes-info">{e ? (fora ? primeiroNome(fora.quem) : e.observacao || 'Na caixa') : impresso ? 'Impresso' : 'Falta'}</span>
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

            <p className="af-rodape fraco">{c.devolvidaEm ? 'Com o cliente desde ' + vm.dataBr(c.devolvidaEm) : 'Volta para o cliente a partir de ' + vm.liberadaEm(c)} · atualizada por {c.atualizadaPor || '—'} em {vm.quando(c.atualizadaEm)}</p>
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
  const descartada = vm.situacao(c) === 'descartada' || vm.situacao(c) === 'devolvida';
  const foraACaixa = vm.retiradaAberta(c.retiradas);
  const r = vm.retirando;
  if (x.startsWith('mes:') || x === 'novo') {
    const novo = x === 'novo';
    const comp = novo ? vm.compNova : x.slice(4);
    const mes = Number(comp.slice(5, 7));
    const impresso = !novo ? vm.impressoDoMes(c, comp) : null;
    return (
      <form className="af-painel" onSubmit={e => { e.preventDefault(); void vm.guardar(comp); }}>
        <strong className="af-painel-titulo">{novo ? 'Outro envelope' : MESES_POR_EXTENSO[mes - 1] + ' de ' + c.ano + (impresso ? ': impresso, falta arquivar' : ' não está na caixa')}</strong>
        {impresso && <div className="af-painel-situacao">Impresso por <strong>{impresso.impressoPor || '—'}</strong> em {vm.quando(impresso.impressoEm)}. Guardar confirma o arquivamento.</div>}
        <div className="af-painel-campos">
          {novo && (
            <CampoEscolha rotulo="De quando é o envelope" valor={vm.compNova} onMudar={vm.setCompNova}
              opcoes={vm.competenciasDaCaixa.map(cp => ({ valor: cp, rotulo: cp.length === 4 ? 'O ano todo (' + cp + ')' : MESES_POR_EXTENSO[Number(cp.slice(5, 7)) - 1] }))} />
          )}
          <input type="text" value={vm.obsNova} onChange={e => vm.setObsNova(e.target.value)} placeholder={novo ? 'O que tem nele (DEFIS, notas de entrada…)' : 'Observação (opcional)'} aria-label="Observação do envelope" maxLength={120} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={vm.ocupado}>{impresso ? 'Confirmar o arquivamento' : 'Guardar o envelope'}</button>
          {!novo && !impresso && (
            <button type="button" className="btn btn-outline btn-sm" disabled={vm.ocupado} title="Imprime a etiqueta e deixa o envelope esperando quem arquive"
              onClick={() => { void vm.registrarImpressao(c, comp); void imprimirEtiquetasDosEnvelopes(c, [{ id: '', competencia: comp, departamento: c.departamento, observacao: '', retiradas: [], arquivadoEm: '', arquivadoPor: '' }]); }}>
              <Icone nome="qrCode" width={14} height={14} />Imprimir a etiqueta
            </button>
          )}
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
function FormDaRetirada({ vm, titulo, aoConfirmar }: { vm: VmDoArquivo; titulo: string; /** o envelope lido pelo QR registra pelo dele */ aoConfirmar?: () => Promise<void> }) {
  const r = vm.retirando;
  if (!r) return null;
  return (
    <form className="af-retirada" onSubmit={e => { e.preventDefault(); void (aoConfirmar || vm.confirmarRetirada)(); }}>
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
                  <label>Departamento</label>
                  {editando ? <strong className="af-campo-fixo">{f.departamento}</strong>
                    : <CampoEscolha rotulo="Departamento" valor={f.departamento} onMudar={v => vm.mudarForm({ departamento: v as af.Departamento })} opcoes={vm.departamentos} />}
                </div>
                <div className="field">
                  <label htmlFor="af-ftipo">Tipo</label>
                  <input id="af-ftipo" type="text" value={f.tipo} onChange={e => vm.mudarForm({ tipo: e.target.value })} placeholder="PJ-F" maxLength={12} />
                </div>
                <div className="field">
                  <label htmlFor="af-fano">Ano</label>
                  <input id="af-fano" type="text" inputMode="numeric" value={f.ano ?? ''} disabled={editando} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); vm.mudarForm({ ano: d ? Number(d) : null }); }} placeholder="2026" />
                </div>
                <div className="field">
                  <label htmlFor="af-fnum">Código da caixa</label>
                  <input id="af-fnum" type="text" inputMode="numeric" value={f.numero ?? ''} disabled={editando} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 3); vm.mudarForm({ numero: d ? Number(d) : null }); }} placeholder="001" />
                </div>
              </div>
              <div className="af-form-linha">
                <div className="field">
                  <label htmlFor="af-fdata">Data do arquivamento</label>
                  <CampoDataComCalendario id="af-fdata" rotulo="Data do arquivamento" valor={f.arquivadaTexto} onMudar={v => vm.mudarForm({ arquivadaTexto: v })} />
                </div>
                <div className="field">
                  <label>Prateleira</label>
                  <CampoEscolha rotulo="Prateleira" vazio="Escolha" valor={vm.lugarDoForm ? String(vm.lugarDoForm.prateleira) : ''} onMudar={v => vm.escolherLugar({ prateleira: Number(v) })}
                    opcoes={vm.lugaresPossiveis.prateleiras.map(n => ({ valor: String(n), rotulo: 'Prateleira ' + n }))} />
                </div>
                <div className="field">
                  <label>Fileira</label>
                  <CampoEscolha rotulo="Fileira" vazio="Escolha" valor={vm.lugarDoForm ? String(vm.lugarDoForm.fileira) : ''} onMudar={v => vm.escolherLugar({ fileira: Number(v) })}
                    opcoes={vm.lugaresPossiveis.fileiras.map(n => ({ valor: String(n), rotulo: 'Fileira ' + n }))} />
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
                  <input id="af-npra" type="text" inputMode="numeric" value={p.prateleiras} onChange={e => vm.mudarPrateleiras({ prateleiras: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                </div>
                <div className="field">
                  <label htmlFor="af-nfil">Fileiras em cada uma</label>
                  <input id="af-nfil" type="text" inputMode="numeric" value={p.fileiras} onChange={e => vm.mudarPrateleiras({ fileiras: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
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

// ---------------------------------------------------------------------------------------------------------------------
// o envelope lido pelo QR (19/11/2026: "ao eu escanear o qr code do envelope cai literalmente na mesma coisa de escanear a
// caixa"; "ao ler o qr code de um envelope não cadastrado ele deve ser cadastrado no arquivo"): onde ele está, com retirar
// e devolver; ou, se ainda não está no arquivo, guardar com um toque (na caixa da empresa, do ano e do departamento dele,
// ou numa caixa nova)
// ---------------------------------------------------------------------------------------------------------------------
function JanelaDoEnvelopeLido({ vm }: { vm: VmDoArquivo }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharLido);
  const l = vm.lido;
  const r = vm.retirando;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharLido(); }}>
      <div ref={janela} className="pessoal-janela usuario-janela af-janela af-janela-lido" role="dialog" aria-modal="true" aria-label="Envelope lido">
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <div className="usuario-quem">
              {l ? <>
                <h2>Envelope {vm.competencia(l.ref.competencia)}</h2>
                <span className="fraco"><strong className="af-cod">{l.ref.codigo}</strong> {l.empresa} · {l.ref.departamento}</span>
              </> : <h2>QR não reconhecido</h2>}
            </div>
            <span className="tarefas-barra-espaco" />
            <BotaoFechar onClick={vm.fecharLido} />
          </header>
          <div className="pessoal-rola">
            {!l ? <Vazio compacto icone="alert" texto="Esse QR não é de um envelope do arquivo." /> : l.achado.situacao === 'guardado' ? (() => {
              const { caixa: c, envelope: e } = l.achado;
              const fora = vm.retiradaAberta(e.retiradas);
              const foraACaixa = vm.retiradaAberta(c.retiradas);
              return (
                <section className="card pessoal-cartao af-lido">
                  <div className="af-lido-onde">
                    <Icone nome="mapaPin" width={22} height={22} />
                    <div>
                      <div className="af-rot">Está na</div>
                      <strong className="af-lido-caixa">Caixa {vm.codigo(c.numero)} · {c.ano}</strong>
                      <div className="af-onde-local">{c.local || 'Sem local'}</div>
                    </div>
                  </div>
                  {e.arquivadoPor && <div className="af-painel-situacao">Arquivado por <strong>{e.arquivadoPor}</strong> em {vm.quando(e.arquivadoEm)}.</div>}
                  <div className={'af-painel-situacao' + (fora || foraACaixa ? ' fora' : '')}>
                    {fora ? <>Fora: com <strong>{fora.quem}</strong> desde {vm.quando(fora.em)}{fora.motivo && ' · ' + fora.motivo}</>
                      : foraACaixa ? <>Saiu junto com a caixa inteira, com <strong>{foraACaixa.quem}</strong>.</> : <>No lugar, dentro da caixa.</>}
                  </div>
                  {r && r.alvo.envelope === e.id ? <FormDaRetirada vm={vm} titulo="Quem está levando o envelope?" aoConfirmar={vm.confirmarRetiradaDoLido} /> : (
                    <div className="af-painel-acoes">
                      {fora && <button type="button" className="btn btn-primary" disabled={vm.ocupado} onClick={() => void vm.devolver(c.id, e.id)}>Devolvido</button>}
                      {!fora && !foraACaixa && !c.descartadaEm && !c.devolvidaEm && <button type="button" className="btn btn-primary" onClick={() => vm.comecarRetirada(e.id)}>Retirar</button>}
                      <button type="button" className="btn btn-outline" onClick={() => vm.abrirCaixaDoLido(c.id, e.id)}>Abrir a caixa</button>
                    </div>
                  )}
                </section>
              );
            })() : (
              <section className="card pessoal-cartao af-lido">
                <div className="af-lido-novo"><Icone nome="arquivo" width={22} height={22} /><strong>Este envelope ainda não está no arquivo.</strong></div>
                {vm.impressoLido && <div className="af-painel-situacao">Impresso por <strong>{vm.impressoLido.impressoPor || '—'}</strong> em {vm.quando(vm.impressoLido.impressoEm)}. Guardar confirma o arquivamento.</div>}
                {l.achado.caixas.length ? (
                  <>
                    <p className="fraco">Guarde na caixa de {l.ref.competencia.slice(0, 4)} desta empresa:</p>
                    <div className="af-lido-caixas">
                      {l.achado.caixas.map((c, i) => (
                        <button key={c.id} type="button" className={'btn ' + (i === 0 ? 'btn-primary' : 'btn-outline')} disabled={vm.ocupado} onClick={() => void vm.guardarLido(c.id)}>
                          Guardar na Caixa {vm.codigo(c.numero)}{c.local && ' · ' + c.local}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <form className="af-lido-criar" onSubmit={ev => { ev.preventDefault(); void vm.criarCaixaDoLido(); }}>
                    <p className="fraco">Ainda não há caixa de {l.ref.competencia.slice(0, 4)} do {l.ref.departamento} desta empresa. Crie a Caixa {vm.codigo(l.numeroNovo)} já com este envelope:</p>
                    <div className="af-painel-campos">
                      <CampoEscolha rotulo="Prateleira" vazio="Prateleira…" valor={vm.lugarNovo.prateleira} onMudar={v => vm.mudarLugarNovo({ prateleira: v })}
                        opcoes={vm.lugaresPossiveis.prateleiras.map(n => ({ valor: String(n), rotulo: 'Prateleira ' + n }))} />
                      <CampoEscolha rotulo="Fileira" vazio="Fileira…" valor={vm.lugarNovo.fileira} onMudar={v => vm.mudarLugarNovo({ fileira: v })}
                        opcoes={vm.lugaresPossiveis.fileiras.map(n => ({ valor: String(n), rotulo: 'Fileira ' + n }))} />
                      <button type="submit" className="btn btn-primary" disabled={vm.ocupado}>Criar a caixa e guardar</button>
                    </div>
                  </form>
                )}
              </section>
            )}
            {l && <p className="af-rodape fraco">Código do envelope: {l.codigo}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
