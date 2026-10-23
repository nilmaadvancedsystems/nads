// Admin › Arquivador (Vitor, 22/10/2026: "se possível algo bem visual", "eu preciso de um feedback melhor dele" e "a parte
// do arquivador é toda bagunçada, quero uma só para ele e bem organizada"). Uma área só para o arquivador novo, com as abas
// pelo ciclo de vida do arquivo (como o Dext): Visão geral, Chegando, Para resolver, Arquivados e Erros, com o contador em
// cada uma; à direita, a Comparação com a rotina antiga e a Configuração. No topo, o modo, a passada, o ritmo e os botões
// Arquivar agora / Parar (os mesmos da Tarefas). O normal é tudo ser arquivado sozinho: a tela destaca só as exceções.
// Só peças do catálogo: o topo do arquivador, as abas sublinhadas, o número do painel, a rosca com legenda, o ranking com a
// marca, a lista com o detalhe ao lado, o ícone do arquivo, os dados em linhas, a busca, a seleção, o Alerta e o Vazio.
import { Alerta, Dica, Esqueleto, Icone, RoscaComLegenda, Segmentado, Vazio, useCarregando } from '@nads/ui';
import type { entregas } from '@nads/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArquivarEm } from './partes/ArquivarEm';
import { DetalheDoArquivo } from './partes/DetalheDoArquivo';
import { LinhaDoArquivo, ListaComDetalhe } from './partes/ListaComDetalhe';
import { RankingComMarca } from './partes/RankingComMarca';
import { TopoDoArquivador } from './partes/TopoDoArquivador';
import { VisorDoArquivo } from './partes/VisorDoArquivo';
import { useArquivadorAdmin, type AbaDoArquivador } from './useArquivadorAdmin';
import { useResolver } from './useResolver';
import { useGrupos } from './useGrupos';

type Vm = ReturnType<typeof useArquivadorAdmin>;
const TOM_DO_NUMERO = { ok: 'painel-ok', aviso: 'painel-aviso', erro: 'painel-laranja', neutro: 'painel-neutro' } as const;
const COR_DO_TOM = { ok: 'var(--success)', aviso: 'var(--warn)', erro: 'var(--danger)', neutro: 'var(--ink-muted)' } as const;

/** Arquivar agora e Parar: o mesmo view-model do botão do Drive na Tarefas. */
function Botoes({ vm }: { vm: Vm }) {
  const b = vm.botao;
  if (!b.visivel) return null;
  return (
    <>
      {b.pedido?.podeCancelar && <button type="button" className="btn btn-outline" onClick={() => b.cancelar(b.pedido!.id)}>Cancelar o pedido</button>}
      {b.podeParar && (
        <button type="button" className="btn btn-danger" disabled={b.parando} onClick={() => void b.parar()}>
          {b.parando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="x" width={16} height={16} />}{b.parando ? 'Parando…' : 'Parar'}
        </button>
      )}
      {b.podePedir && (
        <button type="button" className="btn btn-primary" disabled={b.pedindo} onClick={() => void b.pedir()} title={b.notaAoPedir}>
          {b.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" width={16} height={16} />}Arquivar agora
        </button>
      )}
    </>
  );
}

function Abas({ vm }: { vm: Vm }) {
  // no celular a barra rola de lado: a aba aberta fica à vista (sem animação)
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.querySelector('.menu-item.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [vm.aba]);
  const item = (a: Vm['abas'][number]) => (
    <button key={a.id} type="button" className={'menu-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
      <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
      {a.contador && <span className={'menu-contador' + (a.aviso ? ' arq-contador-aviso' : '')}>{a.contador}</span>}
    </button>
  );
  return (
    <nav ref={ref} className="menu arq-abas" aria-label="Abas do arquivador">
      {vm.abas.filter(a => !a.direita).map(item)}
      <span className="arq-abas-espaco" aria-hidden="true" />
      {vm.abas.filter(a => a.direita).map(item)}
    </nav>
  );
}

function VisaoGeral({ vm }: { vm: Vm }) {
  const ex = vm.excecoes;
  return (
    <>
      {vm.resumo && (
        <div className="card arq-resumo">
          <span className="arq-resumo-icone" aria-hidden="true"><Icone nome="mensagem" width={18} height={18} /></span>
          <p>{vm.resumo}</p>
        </div>
      )}

      {ex.resolver || ex.erros ? (
        <div className="arq-excecoes">
          <span className="fraco">Precisa de você:</span>
          {ex.resolver > 0 && <button type="button" className="btn btn-outline" onClick={() => vm.irPara('resolver')}><Icone nome="alert" width={16} height={16} />{ex.resolver === 1 ? '1 para resolver' : ex.resolver + ' para resolver'}<Icone nome="chevronRight" width={16} height={16} /></button>}
          {ex.erros > 0 && <button type="button" className="btn btn-outline" onClick={() => vm.irPara('erros')}><Icone nome="x" width={16} height={16} />{ex.erros === 1 ? '1 erro' : ex.erros + ' erros'}<Icone nome="chevronRight" width={16} height={16} /></button>}
        </div>
      ) : <Alerta naLinha tom="ok" titulo="Tudo arquivado sozinho" texto="Nenhum arquivo esperando por você." />}

      {vm.alertas.map(a => (
        <Alerta key={a.tipo + a.titulo} naLinha titulo={a.titulo} texto={<>{a.texto}{a.oQueFazer && <><br /><b>O que fazer:</b> {a.oQueFazer}</>}</>} />
      ))}

      <div className="admin-colunas">
        <div className="card">
          <div className="card-head">
            <h3>Caixa de entrada
              <Dica texto="Quantos arquivos estão na pasta Claudio Secretario agora (chegando, na fila, sendo lidos e os não identificados que ficaram) e quantos o robô arquivou no mês. Clicar abre a aba." />
            </h3>
          </div>
          {vm.caixa && (
            <>
              <RoscaComLegenda fatias={vm.caixa.fatias} total={vm.caixa.total} subtitulo="na pasta" ativa={null}
                onEscolher={id => vm.irPara(id === 'pasta' ? 'chegando' : 'arquivados')} />
              {vm.caixa.detalhe && <p className="hint">{vm.caixa.detalhe}</p>}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{vm.periodo === 'hoje' ? 'Hoje' : 'No mês'}</h3>
            <span className="card-head-ctl"><Segmentado valor={vm.periodo} opcoes={[{ valor: 'hoje', rotulo: 'Hoje' }, { valor: 'mes', rotulo: 'Mês' }]} onMudar={vm.setPeriodo} /></span>
          </div>
          <div className="stat-grid dp-numeros arq-numeros">
            {vm.numeros.map(n => (
              <button key={n.id} type="button" className={'stat painel-numero admin-numero ' + TOM_DO_NUMERO[n.tom]} onClick={() => vm.irPara(n.aba)}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} width={16} height={16} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value num">{n.valor}</p>
              </button>
            ))}
          </div>
          {vm.pastasNovas.length > 0 && <p className="hint">Pastas novas: {vm.pastasNovas.join(', ')}.</p>}
        </div>
      </div>

      <div className="admin-colunas">
        <div className="card">
          <div className="card-head">
            <h3>Por tipo <span className="fraco">({vm.periodo === 'hoje' ? 'hoje' : 'no mês'})</span>
              <Dica texto="Quantos arquivos de cada tipo o robô arquivou. Passe o mouse na barra para ver os tipos das regras que estão juntos nela." />
            </h3>
          </div>
          <RankingComMarca barras={vm.barrasTipo} vazio={<Vazio compacto icone="barChart" texto="Nada arquivado ainda." />} />
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Por cliente <span className="fraco">(os 10 que mais receberam{vm.totalDeClientes > 10 ? ', de ' + vm.totalDeClientes : ''})</span></h3>
          </div>
          <RankingComMarca barras={vm.barrasCliente} tom="marca" vazio={<Vazio compacto icone="predio" texto="Nenhum cliente recebeu arquivo ainda." />} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Ao vivo
            <Dica texto="Os últimos arquivos que o robô decidiu. Clique para ver o porquê." />
          </h3>
          <span className="card-head-ctl"><button type="button" className="btn btn-ghost" onClick={() => vm.irPara('arquivados')}>Todos os arquivados<Icone nome="chevronRight" width={16} height={16} /></button></span>
        </div>
        {vm.aoVivo.length ? (
          <ul className="arq-linhas">{vm.aoVivo.map(l => <LinhaDoArquivo key={l.id} l={l} onAbrir={id => vm.irPara('arquivados', id)} />)}</ul>
        ) : <Vazio compacto icone="arquivo" texto="Nenhum arquivo decidido ainda." />}
      </div>
    </>
  );
}

function Chegando({ vm }: { vm: Vm }) {
  const p = vm.pasta;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Chegando
          <Dica texto="Os arquivos da pasta Claudio Secretario que o robô ainda não decidiu: os que ainda estão chegando (o robô espera o arquivo parar de mudar), os prontos na fila e os que está lendo agora. Mostra os 40 primeiros." />
        </h3>
        {p && <span className="card-head-ctl fraco num">{p.naPasta.toLocaleString('pt-BR')} na pasta · {p.sendoLidos} sendo lidos · {p.chegando} chegando · {p.naFila.toLocaleString('pt-BR')} na fila</span>}
      </div>
      <ListaComDetalhe rotulo="Arquivos chegando" linhas={vm.chegando} aberto={vm.chegandoAberto ? vm.itemAberto : ''}
        onAbrir={id => vm.abrir(id)} onFechar={() => vm.abrir(null)}
        detalhe={vm.chegandoAberto ? <DetalheDoArquivo d={vm.chegandoAberto} /> : null}
        vazio={<Vazio compacto icone="caixaEntrada" titulo="A pasta está em dia" texto="Cada arquivo novo é arquivado assim que termina de chegar." />}
        pe={p && p.naFila + p.chegando + p.sendoLidos > vm.chegando.length ? <p className="hint">E mais {(p.naFila + p.chegando + p.sendoLidos - vm.chegando.length).toLocaleString('pt-BR')} na fila.</p> : null} />
    </div>
  );
}

function Lista({ vm, titulo, dica, vazio }: { vm: Vm; titulo: string; dica: string; vazio: { icone: 'checkCircle' | 'arquivo'; titulo: string; texto: string } }) {
  return (
    <div className="card">
      <div className="card-head"><h3>{titulo}<Dica texto={dica} /></h3></div>
      <ListaComDetalhe rotulo={titulo} linhas={vm.linhas} aberto={vm.aberto?.id ?? ''} onAbrir={id => vm.abrir(id)} onFechar={() => vm.abrir(null)}
        detalhe={vm.aberto ? <DetalheDoArquivo d={vm.aberto} /> : null} vazio={<Vazio compacto icone={vazio.icone} titulo={vazio.titulo} texto={vazio.texto} />} />
    </div>
  );
}

/**
 * Para resolver (23/10/2026: "coloca um botão para abrir o arquivo direto daqui e selecionar para onde vai também"): a
 * lista com a caixa para marcar, a barra do lote (Arquivar em…, Descartar), e no detalhe Abrir o arquivo, Arquivar em… e
 * Descartar; o visor por cima. Tudo pedido ao robô do PC.
 */
function Resolver({ vm }: { vm: Vm }) {
  // um a um (a lista de sempre) ou em grupos (pela causa e pela pasta de origem; 23/10/2026, a migração)
  const [modo, setModo] = useState<'um' | 'grupos'>('um');
  const grupos = vm.grupos;
  const escolha = grupos.length > 0 && (
    <span className="card-head-ctl"><Segmentado valor={modo} opcoes={[{ valor: 'um', rotulo: 'Um a um' }, { valor: 'grupos', rotulo: 'Em grupos · ' + grupos.length.toLocaleString('pt-BR') }]} onMudar={setModo} /></span>
  );
  if (modo === 'grupos' && grupos.length) return <ResolverEmGrupos grupos={grupos} escolha={escolha} />;
  return <ResolverUmAUm vm={vm} escolha={escolha} />;
}

/** Para resolver em grupos: a lista dos grupos (os maiores primeiro), o detalhe com os exemplos e o Arquivar o grupo em…. */
function ResolverEmGrupos({ grupos, escolha }: { grupos: readonly entregas.GrupoParaResolver[]; escolha: ReactNode }) {
  const g = useGrupos(grupos);
  const linhas = g.grupos.map(x => ({
    id: x.id, nome: x.n.toLocaleString('pt-BR') + (x.n === 1 ? ' arquivo · ' : ' arquivos · ') + x.motivoTexto, formato: 'ZIP' as const, apoio: x.pasta,
    selo: { rotulo: x.sugestao?.codigo != null ? 'Cliente ' + x.sugestao.codigo : 'Sem sugestão', tom: (x.sugestao?.codigo != null ? 'ok' : 'neutro') as 'ok' | 'neutro' },
    confianca: '', tomConfianca: 'neutro' as const, hora: '', andamento: g.andamento(x.id),
  }));
  const a = g.aberto;
  const detalhe = a ? (
    <div className="arq-detalhe">
      <h4>{a.n.toLocaleString('pt-BR')} {a.n === 1 ? 'arquivo' : 'arquivos'} · {a.motivoTexto}</h4>
      <p className="fraco arq-grupo-pasta">{a.pasta}</p>
      <ul className="arq-grupo-exemplos">{a.exemplos.map(x => <li key={x.rel}><Icone nome="arquivo" width={14} height={14} /> {x.nome}</li>)}</ul>
      {a.sugestao && <p className="hint">Sugestão: {a.sugestao.codigo != null ? 'cliente ' + a.sugestao.codigo + ' (pela pasta de origem)' : ''}{a.sugestao.codigo != null && a.sugestao.tipoDoc ? ' · ' : ''}{a.sugestao.tipoDoc ? 'tipo ' + a.sugestao.tipoDoc + ' (pelo mapa da migração)' : ''}</p>}
      {g.formulario && <ArquivarEm f={g.formulario} />}
    </div>
  ) : null;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Para resolver em grupos<Dica texto="Os não identificados da mesma causa e da mesma pasta de origem juntos, os maiores primeiro. Escolha o cliente e o tipo para o grupo inteiro: a competência sai do nome ou das pastas de cada arquivo, o robô mostra 3 exemplos antes e, com Lembrar, os próximos da mesma pasta vão sozinhos." /></h3>
        {escolha}
      </div>
      <ListaComDetalhe rotulo="Grupos para resolver" linhas={linhas} aberto={a?.id ?? ''} onAbrir={id => g.abrir(id)} onFechar={g.fechar} detalhe={detalhe}
        vazio={<Vazio compacto icone="checkCircle" titulo="Nenhum grupo para resolver" texto="O robô arquivou tudo sozinho." />} />
    </div>
  );
}

function ResolverUmAUm({ vm, escolha }: { vm: Vm; escolha: ReactNode }) {
  const r = useResolver(vm.pendentes);
  const linhas = vm.linhas.filter(l => !r.feitos.has(l.id)).map(l => ({ ...l, andamento: r.andamento(l.id) }));
  const x = vm.itemBruto && !r.feitos.has(vm.itemBruto.id) && vm.pendentes.some(p => p.id === vm.itemBruto!.id) ? vm.itemBruto : null;
  const marcados = [...r.marcados].filter(id => linhas.some(l => l.id === id));
  const f = r.formulario;
  const formDoLote = f && f.lote > 1 ? <div className="arq-detalhe"><ArquivarEm f={f} /></div> : null;
  const formDoItem = f && f.lote === 1 && x && f.alvo[0] === x.id ? <ArquivarEm f={f} /> : null;
  const ocupado = x ? !!r.andamento(x.id) : false;
  const detalhe = formDoLote || (x && vm.aberto ? (
    <DetalheDoArquivo d={vm.aberto} formulario={formDoItem}
      acoes={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => void r.abrir(x)}><Icone nome="olho" width={16} height={16} />Abrir o arquivo</button>
          <button type="button" className="btn btn-primary" disabled={!!formDoItem || ocupado} onClick={() => r.abrirFormulario([x.id])}><Icone nome="pasta" width={16} height={16} />Arquivar em…</button>
          <button type="button" className="btn btn-ghost arq-descartar" disabled={ocupado} onClick={() => void r.descartar([x.id])}><Icone nome="lixeira" width={16} height={16} />Descartar</button>
        </>
      )} />
  ) : null);
  const topo = linhas.length > 0 && (
    <div className={'arq-lote' + (marcados.length ? ' ativo' : '')}>
      {marcados.length ? (
        <>
          <b>{marcados.length === 1 ? '1 marcado' : marcados.length + ' marcados'}</b>
          <span className="arq-lote-espaco" />
          <button type="button" className="btn btn-primary" onClick={() => { vm.abrir(null); r.abrirFormulario(marcados); }}><Icone nome="pasta" width={16} height={16} />Arquivar em…</button>
          <button type="button" className="btn btn-outline" onClick={() => void r.descartar(marcados)}><Icone nome="lixeira" width={16} height={16} />Descartar</button>
          <button type="button" className="btn btn-ghost" onClick={r.desmarcar}>Desmarcar</button>
        </>
      ) : <button type="button" className="btn btn-ghost" onClick={() => r.marcarTodos(linhas.map(l => l.id))}><Icone nome="checklist" width={16} height={16} />Marcar todos</button>}
    </div>
  );
  return (
    <div className="card">
      <div className="card-head">
        <h3>Para resolver<Dica texto="Os arquivos que o robô não arquivou sozinho, os mais novos primeiro, com o motivo e o que fazer. Abra o arquivo, escolha o cliente, o tipo e a competência (o robô mostra o destino antes de arquivar) ou descarte; marque vários para fazer em lote. Tudo vai como pedido ao robô do PC." /></h3>
        {vm.pendentes.length > linhas.length && <span className="card-head-ctl fraco">{vm.pendentes.length - linhas.length} resolvido(s) agora</span>}
        {escolha}
      </div>
      <ListaComDetalhe rotulo="Para resolver" linhas={linhas} aberto={x?.id ?? ''} onAbrir={id => vm.abrir(id)}
        onFechar={() => { if (f) f.fechar(); vm.abrir(null); }} detalhe={detalhe} topo={topo} marcar={{ marcados: r.marcados, alternar: r.alternar }}
        vazio={<Vazio compacto icone="checkCircle" titulo="Nada para resolver" texto="O robô arquivou tudo sozinho." />} />
      {r.visor && <VisorDoArquivo v={r.visor} onFechar={r.fecharVisor} />}
    </div>
  );
}

/** Baixa um arquivo de texto (o CSV do período). */
function baixar({ nome, conteudo }: { nome: string; conteudo: string }) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Arquivados (23/10/2026: "um acompanhamento de todo período" e "na parte de arquivados tem arquivos escritos como não
 * identificados"): o período (hoje, 7 dias, 30 dias, o mês, um intervalo ou desde o começo), os totais dele, e a lista
 * pela SITUAÇÃO — o padrão só com o que foi arquivado (pelo robô ou à mão); os duplicados, os não identificados (os
 * pendentes levam ao Para resolver; os resolvidos dizem para onde foram) e os descartados no filtro.
 */
function Arquivados({ vm }: { vm: Vm }) {
  const f = vm.filtro;
  const h = vm.historico;
  const pd = vm.periodoDoHistorico;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Arquivados<Dica texto="O que o robô arquivou no período (e o que foi arquivado à mão no site). Os duplicados, os não identificados e os descartados ficam no filtro de situação. Clique num arquivo para ver o porquê." /></h3>
        <span className="card-head-ctl fraco num">{pd.texto}</span>
      </div>
      <div className="arq-filtros">
        <Segmentado valor={pd.tipo} opcoes={pd.opcoes} onMudar={pd.setTipo} />
        {pd.tipo === 'intervalo' && (
          <>
            <input type="date" className="select-compact" aria-label="De" min={pd.minimo} max={pd.maximo} value={pd.livre.de} onChange={e => pd.setDe(e.target.value)} />
            <input type="date" className="select-compact" aria-label="Até" min={pd.minimo} max={pd.maximo} value={pd.livre.ate} onChange={e => pd.setAte(e.target.value)} />
          </>
        )}
      </div>
      {vm.totais.length > 0 && (
        <div className="stat-grid dp-numeros admin-numeros arq-totais">
          {vm.totais.map(n => (
            <button key={n.id} type="button" className={'stat painel-numero admin-numero ' + TOM_DO_NUMERO[n.tom]} onClick={() => f.setSituacao(n.situacao)} aria-pressed={f.situacao === n.situacao}>
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} width={16} height={16} /></span>
              <p className="stat-label">{n.rotulo}</p>
              <p className="stat-value num">{n.valor}</p>
            </button>
          ))}
        </div>
      )}
      {vm.totaisDosDias && <p className="hint">Os totais contam só os dias já baixados (o resumo do mês ainda não chegou do robô).</p>}
      <div className="arq-filtros">
        <label className="busca-curta larga"><Icone nome="search" width={16} height={16} /><input type="text" placeholder="Buscar pelo nome, cliente ou pasta" aria-label="Buscar nos arquivados" value={f.busca} onChange={e => f.setBusca(e.target.value)} /></label>
        <select className="select-compact" aria-label="Situação" value={f.situacao} onChange={e => f.setSituacao(e.target.value as typeof f.situacao)}>
          {f.opcoesSituacao.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select className="select-compact" aria-label="Cliente" value={f.cliente} onChange={e => f.setCliente(e.target.value)}>
          <option value="">Todos os clientes</option>
          {f.opcoesCliente.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select className="select-compact" aria-label="Tipo" value={f.tipo} onChange={e => f.setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {f.opcoesTipo.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        {f.ativo && <button type="button" className="btn btn-ghost" onClick={f.limpar}>Limpar</button>}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" onClick={() => baixar(vm.csvDoPeriodo())} disabled={!vm.linhas.length}><Icone nome="download" width={16} height={16} />Exportar CSV</button>
      </div>
      {h && !h.carregado ? <Esqueleto linhas={6} /> : h?.erro ? <Alerta naLinha titulo="Não deu para ler o histórico" texto={h.erro} /> : (
        <ListaComDetalhe rotulo="Arquivados" linhas={vm.linhas} aberto={vm.aberto?.id ?? ''} onAbrir={id => vm.abrir(id)} onFechar={() => vm.abrir(null)}
          detalhe={vm.aberto ? (
            <>
              {vm.resolverAberto && (
                <div className="arq-detalhe-acoes"><button type="button" className="btn btn-primary" onClick={vm.resolverAberto}><Icone nome="alert" width={16} height={16} />Resolver em Para resolver</button></div>
              )}
              <DetalheDoArquivo d={vm.aberto} />
            </>
          ) : null}
          vazio={<Vazio compacto icone="arquivo" titulo={f.ativo ? 'Nada com esses filtros' : 'Nada arquivado no período'} texto={f.ativo ? 'Tente outra busca ou limpe os filtros.' : 'O robô não arquivou nenhum arquivo nestes dias.'} />}
          pe={(
            <div className="arq-pe">
              <p className="hint num">{vm.linhas.length.toLocaleString('pt-BR')} de {vm.totalDaLista.toLocaleString('pt-BR')} decididos {pd.diasLidos === 1 ? 'no dia' : 'nos ' + pd.diasLidos + ' dias'} mais novos{vm.maisQueOMaximo ? ' (mostra os 300 mais novos: use a busca)' : ''}</p>
              {pd.faltamDias > 0 && <button type="button" className="btn btn-outline" onClick={pd.carregarMais}>Mais {Math.min(7, pd.faltamDias)} {Math.min(7, pd.faltamDias) === 1 ? 'dia' : 'dias'} ({pd.faltamDias.toLocaleString('pt-BR')} no período)</button>}
            </div>
          )} />
      )}
    </div>
  );
}

function Comparacao({ vm }: { vm: Vm }) {
  const c = vm.comparacao;
  if (!c) return <Vazio icone="scale" titulo="Sem comparação ainda" texto="O lado a lado com a rotina antiga sai uma vez por dia, depois que a rotina das 9h termina. Some quando a rotina antiga for desligada." />;
  return (
    <>
      <div className="card">
        <div className="card-head">
          <h3>Lado a lado de {c.dia}
            <Dica texto="Para os arquivos que a rotina antiga (o /organizar do Claude) arquivou no dia, o que o arquivador novo decidiu para o mesmo conteúdo." />
          </h3>
          <span className="card-head-ctl fraco num">a rotina antiga arquivou {c.total.toLocaleString('pt-BR')}</span>
        </div>
        <div className="rank">
          {c.barras.map(b => (
            <div key={b.chave} className="rank-item">
              <span className="rank-nome">{b.rotulo}</span>
              <span className="rank-val num">{b.n.toLocaleString('pt-BR')} <span className="fraco">({b.pct}%)</span></span>
              <span className="rank-barra"><span style={{ width: Math.max(b.n ? 2 : 0, b.pct) + '%', background: COR_DO_TOM[b.tom] }} /></span>
            </div>
          ))}
        </div>
      </div>
      {c.exemplos.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Onde os dois discordaram</h3></div>
          <div className="table-wrap"><table className="table-compact arq-tabela">
            <thead><tr><th>Arquivo</th><th>Rotina antiga</th><th>Arquivador novo</th></tr></thead>
            <tbody>
              {c.exemplos.map(e => (
                <tr key={e.chave}>
                  <td><b>{e.nome}</b><br /><span className="badge badge-suave badge-warn">{e.tipo}</span></td>
                  <td className="arq-caminho">{e.antigo}</td>
                  <td className="arq-caminho">{e.novo}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

function Configuracao({ vm }: { vm: Vm }) {
  return (
    <>
      <div className="card">
        <div className="card-head"><h3>Configuração em vigor<Dica texto="O que o robô do PC está usando agora (o config.json do PC, que manda, ou o robo/arquivadorNovo.config do banco)." /></h3></div>
        {vm.configuracao.length ? (
          <dl className="ent-dados arq-config">{vm.configuracao.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.valor}</dd></div>)}</dl>
        ) : <Vazio compacto icone="settings" texto="O robô do PC ainda não publicou a configuração." />}
      </div>
      <Alerta naLinha titulo="Só leitura, por enquanto"
        texto="Para mudar daqui faltam três coisas: (1) uma regra no banco que deixe só o admin gravar o campo config de robo/arquivadorNovo, com os valores conferidos (o modo, a lista de tipos e os sins e nãos); (2) o robô parar de deixar o config.json do PC mandar sobre o do banco (hoje o do PC vence); (3) um registro de quem mudou e quando. Até lá, a mudança é no config.json do PC." />
    </>
  );
}

export function Arquivador() {
  const vm = useArquivadorAdmin();
  useCarregando(vm.carregando);
  if (vm.semPermissao) return <Vazio icone="lock" titulo="Sem acesso ao arquivador" texto="Só o administrador vê o acompanhamento do arquivador." />;
  const p = vm.botao.pedido;
  const conteudo: Record<AbaDoArquivador, () => ReactNode> = {
    geral: () => <VisaoGeral vm={vm} />,
    chegando: () => <Chegando vm={vm} />,
    resolver: () => <Resolver vm={vm} />,
    arquivados: () => <Arquivados vm={vm} />,
    erros: () => <Lista vm={vm} titulo="Erros" dica="Quando e por que algo não funcionou: arquivo travado, sem permissão, Drive fora, PDF corrompido, OCR demorado. Cada um com o que fazer. Os 30 mais recentes."
      vazio={{ icone: 'checkCircle', titulo: 'Nenhum erro', texto: 'Tudo funcionando.' }} />,
    comparacao: () => <Comparacao vm={vm} />,
    config: () => <Configuracao vm={vm} />,
  };
  return (
    <section className="admin-arquivador">
      {vm.exemplos && <p className="hint">Dados de exemplo: nada aqui vem do banco.</p>}
      {vm.carregando ? <div className="card"><Esqueleto linhas={4} /></div> : (
        <TopoDoArquivador t={vm} acoes={<Botoes vm={vm} />} />
      )}
      {p && vm.botao.pedidoNoAgora && <p className="hint arq-pedido"><b>Arquivar agora:</b> {p.titulo}. {p.detalhe}</p>}
      {vm.semPainel && (
        <Alerta naLinha titulo="O robô do PC ainda não publica o acompanhamento"
          texto="A página se enche sozinha depois que o robô do PC for atualizado (ele publica em robo/arquivadorNovo a cada mudança, no máximo uma vez a cada 45 segundos)." />
      )}
      <Abas vm={vm} />
      <div className="arq-aba">{vm.carregando ? <div className="card"><Esqueleto linhas={6} /></div> : conteudo[vm.aba]()}</div>
    </section>
  );
}
