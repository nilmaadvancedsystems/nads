// DP › FGTS Digital (07/10/2026): o robô emite a guia mensal de cada cliente no portal do FGTS Digital, com o
// certificado do escritório (procuração no SPE). Como as Obrigações (Vitor, 08/10/2026: "igual às Obrigações", "ações
// mais limpas", "marcar várias e emitir", "acompanhar o robô"): os filtros numa linha; o painel do robô (o que ele faz
// agora, a verificação do gov.br e a fila); a tabela com a caixinha para o lote, a situação como selo e, na linha, só
// Emitir (ou o PDF) e o ⋯ (Ensaio, Emitir de novo, Passos do robô). Clicar na situação abre os passos do robô.
import { BotaoAcao, Esqueleto, Icone, MenuSuspenso, SeletorMes, useCarregando } from '@nads/ui';
import { useEffect, useState } from 'react';
import { JanelaLateral } from '../janela/JanelaLateral';
import { useFgtsDoDp, type FiltroFgts, type SituacaoFgts } from './useFgtsDoDp';

const cnpjFormatado = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const data = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// os selos como a Situação das Obrigações: verde feito, laranja andando, vermelho parado, cinza o resto
const SELO: Record<SituacaoFgts, { classe: string; rotulo: string }> = {
  'sem-cnpj': { classe: 'badge badge-neutral', rotulo: 'Sem CNPJ' },
  nada: { classe: 'badge badge-neutral', rotulo: 'Não pedida' },
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila' },
  trabalhando: { classe: 'badge badge-warn', rotulo: 'Com o robô' },
  verificacao: { classe: 'badge badge-warn', rotulo: 'Verificação' },
  emitida: { classe: 'badge badge-ok', rotulo: 'Emitida' },
  'ensaio-ok': { classe: 'badge badge-neutral', rotulo: 'Ensaio ok' },
  erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
  captcha: { classe: 'badge badge-parada', rotulo: 'Fazer à mão' },
};
const SITUACOES: { valor: FiltroFgts; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas' }, { valor: 'faltam', rotulo: 'Faltam' }, { valor: 'emitidas', rotulo: 'Emitidas' }, { valor: 'problemas', rotulo: 'Com problema' },
];

type Tela = { n: string; nome: string; imagem: string };

/**
 * A tela do navegador do robô, ao vivo, enquanto o gov.br pede a verificação (08/10/2026): clicar na imagem é clicar
 * lá (o robô repete o clique). Some sozinha quando o robô passa do gov.br.
 */
function TelaAoVivo({ id, vm }: { id: string; vm: ReturnType<typeof useFgtsDoDp> }) {
  const [tela, setTela] = useState<{ imagem: string; largura: number; altura: number } | null | undefined>(undefined);
  const [marca, setMarca] = useState<{ x: number; y: number } | null>(null);
  const { aoVivo } = vm;
  useEffect(() => aoVivo(id, setTela), [id, aoVivo]);
  if (tela === undefined) return <Esqueleto linhas={4} />;
  if (!tela) return <p className="fraco">Esperando a tela do robô…</p>;
  const clique = (e: React.MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    vm.clicarNaTela(id, (e.clientX - r.left) * tela.largura / r.width, (e.clientY - r.top) * tela.altura / r.height);
    setMarca({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 });
  };
  return (
    <div className="fgts-ao-vivo">
      <img src={'data:image/jpeg;base64,' + tela.imagem} alt="A tela do navegador do robô" onClick={clique} />
      {marca && <span className="fgts-ao-vivo-marca" style={{ left: marca.x + '%', top: marca.y + '%' }} aria-hidden="true" />}
    </div>
  );
}

function Telas({ id, telas }: { id: string; telas: (id: string) => Promise<Tela[]> }) {
  const [fotos, setFotos] = useState<{ id: string; lista: Tela[] } | null>(null);
  useEffect(() => { let vale = true; void telas(id).then(lista => { if (vale) setFotos({ id, lista }); }); return () => { vale = false; }; }, [id, telas]);
  if (!fotos || fotos.id !== id) return <Esqueleto linhas={3} />;
  if (!fotos.lista.length) return null;
  return (
    <div className="fgts-telas">
      {fotos.lista.map(f => (
        <figure key={f.n} className="fgts-tela">
          <img src={'data:image/jpeg;base64,' + f.imagem} alt={'Tela ' + f.n + ': ' + f.nome} loading="lazy" />
          <figcaption><span className="num fraco">{Number(f.n)}</span> {f.nome}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FgtsDoDp() {
  const vm = useFgtsDoDp();
  useCarregando(vm.carregando);
  const r = vm.robo;
  const c = vm.contagem;
  const mes = vm.competencias.find(x => x.valor === vm.competencia)?.rotulo || vm.competencia.split('-').reverse().join('/');
  const aberto = vm.aberto;
  const pedidoAberto = aberto?.pedido;
  const agora = vm.roboAgora;
  const qtdSituacao: Record<FiltroFgts, number> = { todos: c.todos, faltam: c.faltam, emitidas: c.emitidas, problemas: c.problemas };
  return (
    <section className="dp-painel">
      {r.carregado && !r.ligado && (
        <div className="alert fgts-robo"><Icone nome="alert" /><div><p className="alert-title">Robô do FGTS desligado</p><p className="alert-text">{r.motivo || 'Sem o certificado do escritório na máquina do robô.'}</p></div></div>
      )}
      <div className="tarefas-filtros dp-filtros">
        <div className="field dp-filtro">
          <span className="hint">Competência</span>
          <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        </div>
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome, código ou CNPJ" aria-label="Buscar cliente" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Responsável</span>
          <select className="select-compact" value={vm.responsavel} onChange={e => vm.setResponsavel(e.target.value)}>
            <option value="">Todos</option>
            {vm.responsaveis.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="field dp-filtro">
          <span className="hint">Situação</span>
          <select className="select-compact" value={vm.filtro} onChange={e => vm.setFiltro(e.target.value as FiltroFgts)}>
            {SITUACOES.map(o => <option key={o.valor} value={o.valor}>{o.rotulo} ({qtdSituacao[o.valor]})</option>)}
          </select>
        </label>
      </div>

      {/* o robô agora: ligado, com quem está, o último passo, a verificação e a fila */}
      <section className="card fgts-robo-painel">
        <div className="fgts-robo-cabeca">
          <h3 className="dp-titulo">Robô</h3>
          {r.carregado && (r.ligado
            ? <span className="fgts-robo-linha"><span className="bolinha-sit concluida" aria-hidden="true" />Ligado{r.certificado ? ' · certificado até ' + data(r.certificado.validade) : ''}</span>
            : <span className="fgts-robo-linha"><span className="bolinha-sit parada" aria-hidden="true" />Desligado</span>)}
          <span className="tarefas-barra-espaco" />
          <span className="hint"><b className="num">{c.emitidas}</b> de <b className="num">{c.todos}</b> emitidas em {mes}{vm.totalEmitido ? <> · <b className="num">R$ {vm.totalEmitido}</b></> : null}</span>
        </div>
        <span className="tarefas-barra fgts-barra" role="progressbar" aria-valuemin={0} aria-valuemax={c.todos} aria-valuenow={c.emitidas} aria-label="Guias emitidas">
          <span style={{ width: (c.todos ? (c.emitidas / c.todos) * 100 : 0) + '%' }} />
        </span>
        <div className="fgts-robo-agora">
          <span className="hint fgts-robo-rotulo">Agora</span>
          {agora ? (
            <>
              <span className="num fraco">{agora.codigo}</span>
              <b>{agora.nome}</b>
              <span className={SELO[agora.situacao].classe}>{SELO[agora.situacao].rotulo}</span>
              <span className="fraco">{agora.passo} · {hora(agora.quando)}</span>
              <span className="tarefas-barra-espaco" />
              {agora.situacao === 'verificacao'
                ? <button type="button" className="btn btn-primary" onClick={() => vm.abrir(agora.pedidoId)}>Fazer a verificação</button>
                : <button type="button" className="btn btn-outline" onClick={() => vm.abrir(agora.pedidoId)}>Ver passos</button>}
            </>
          ) : <span className="fraco">parado</span>}
        </div>
        {vm.fila.length > 0 && (
          <div className="fgts-robo-agora">
            <span className="hint fgts-robo-rotulo">Na fila · {vm.fila.length}</span>
            <span className="fgts-fila">
              {vm.fila.slice(0, 6).map(f => <span key={f.codigo} className="badge badge-neutral" title={f.nome}>{f.codigo}</span>)}
              {vm.fila.length > 6 && <span className="hint">+{vm.fila.length - 6}</span>}
            </span>
          </div>
        )}
      </section>

      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Guias de {mes}</h3>
          <span className="badge badge-neutral">{vm.linhas.length}</span>
          {c.faltam > 0 ? <span className="hint">{c.faltam} {c.faltam === 1 ? 'falta' : 'faltam'}</span> : <span className="hint">todas emitidas</span>}
          <span className="tarefas-barra-espaco" />
          {/* baixar em lote (Vitor, 09/10/2026): as marcadas emitidas, ou todas as emitidas da tela, num .zip */}
          <BotaoAcao className="btn btn-outline" carregando={vm.baixando} textoCarregando="Juntando…" disabled={!vm.paraBaixar} onClick={() => void vm.baixarLote()}>
            <Icone nome="download" />{vm.marcadas > 0 ? 'Baixar marcadas' : 'Baixar emitidas'}{vm.paraBaixar ? ' · ' + vm.paraBaixar : ''}
          </BotaoAcao>
          {vm.marcadas > 0 ? (
            <BotaoAcao carregando={vm.pedindo} textoCarregando="Pedindo…" disabled={!r.ligado || !vm.marcadasParaEmitir} onClick={() => void vm.emitirMarcadas()}>
              <Icone nome="fileDown" />Emitir marcadas{vm.marcadasParaEmitir ? ' · ' + vm.marcadasParaEmitir : ''}
            </BotaoAcao>
          ) : (
            <BotaoAcao carregando={vm.pedindo} textoCarregando="Pedindo…" disabled={!r.ligado || !vm.faltam} onClick={() => void vm.emitirTodas()}>
              <Icone nome="fileDown" />Emitir as que faltam{vm.faltam ? ' · ' + vm.faltam : ''}
            </BotaoAcao>
          )}
        </div>
        {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
          <div className="table-wrap">
            <table className="dp-tabela fgts-tabela">
              <thead>
                <tr>
                  <th className="fgts-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} aria-label="Marcar todas" title="Marcar todas da tela" /></th>
                  <th>Cód.</th><th>Cliente</th><th>CNPJ</th><th>Responsável</th><th>Guia</th><th>Nº da guia</th><th className="num">Valor</th><th>Vence</th><th />
                </tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => {
                  const selo = SELO[l.situacao];
                  const p = l.pedido;
                  const itens = [
                    ...(l.cnpj && l.podeMarcar ? [{ rotulo: 'Ensaio (só entrar)', icone: 'play' as const, desabilitado: !r.ligado, onClick: () => void vm.pedir(l.codigo, 'ensaio') }] : []),
                    ...(l.situacao === 'emitida' ? [{ rotulo: 'Emitir de novo', icone: 'repeat' as const, desabilitado: !r.ligado, onClick: () => void vm.pedir(l.codigo, 'emitir') }] : []),
                    ...(p ? [{ rotulo: 'Passos do robô', icone: 'list' as const, onClick: () => vm.abrir(p.id) }] : []),
                  ];
                  return (
                    <tr key={l.codigo} className={'dp-linha' + (l.situacao === 'emitida' ? ' feita' : '')}>
                      <td className="fgts-marca">
                        <input type="checkbox" checked={vm.marcada(l.codigo)} disabled={!l.podeMarcar} onChange={() => vm.alternarMarca(l.codigo)} aria-label={'Marcar ' + l.nome} />
                      </td>
                      <td className="num fraco">{l.codigo}</td>
                      <td className="dp-cliente"><span className="dp-cliente-nome" title={l.nome}>{l.nome}</span></td>
                      <td className="num fraco fgts-cnpj">{l.cnpj ? cnpjFormatado(l.cnpj) : '—'}</td>
                      <td>{l.responsavel || <span className="fraco">—</span>}</td>
                      <td>
                        {p ? (
                          <button type="button" className="fgts-situacao" title={p.erro || p.resultado || 'Passos do robô'} onClick={() => vm.abrir(p.id)}>
                            <span className={selo.classe}>{selo.rotulo}</span>
                            <span className="fraco">{hora(p.fimEm || p.criadoEm)}</span>
                          </button>
                        ) : <span className={selo.classe}>{selo.rotulo}</span>}
                      </td>
                      <td className="num fraco fgts-numero">{l.situacao === 'emitida' && p?.numeroGuia ? p.numeroGuia : '—'}</td>
                      <td className="num">{l.situacao === 'emitida' && p?.valor ? 'R$ ' + p.valor : <span className="fraco">—</span>}</td>
                      <td className="fraco">{l.situacao === 'emitida' && p?.vencimento ? p.vencimento : '—'}</td>
                      <td className="fgts-acoes">
                        <div className="fgts-acoes-linha">
                        {p && l.situacao === 'emitida'
                          ? <button type="button" className="btn btn-outline" onClick={() => void vm.baixar(p)}><Icone nome="download" />PDF</button>
                          : l.podeMarcar && <button type="button" className="btn btn-outline" disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'emitir')}>Emitir</button>}
                        {itens.length > 0 && <MenuSuspenso rotulo="" icone="mais" className="btn btn-ghost fgts-mais" dica="Mais" titulo={'Mais de ' + l.nome} direita itens={itens} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {aberto && pedidoAberto && (
        <JanelaLateral rotulo={aberto.nome} topicos={[{ id: 'passos', rotulo: 'Passos do robô', icone: 'list' }]} topico="passos" mudar={() => undefined} fechar={vm.fechar} classe="fgts-janela" resumo={(
          <div className="usuario-quem"><span className="emp-cod">{aberto.codigo}</span><b>{aberto.nome}</b></div>
        )}>
          {aberto.situacao === 'verificacao' && <TelaAoVivo id={pedidoAberto.id} vm={vm} />}
          <div className="card">
            <h3>{pedidoAberto.modo === 'emitir' ? 'Emitir a guia' : 'Ensaio'} · {pedidoAberto.competencia.split('-').reverse().join('/')}</h3>
            <div className="fgts-pedido">
              <span className={SELO[aberto.situacao].classe}>{SELO[aberto.situacao].rotulo}</span>
              <span className="fraco">pedido por {pedidoAberto.criadoPor} · {hora(pedidoAberto.criadoEm)}</span>
              {aberto.situacao === 'emitida' && <button type="button" className="btn btn-outline fgts-pedido-pdf" onClick={() => void vm.baixar(pedidoAberto)}><Icone nome="download" />PDF da guia</button>}
              {(pedidoAberto.erro || pedidoAberto.resultado) && <p className={pedidoAberto.erro ? 'fgts-pedido-erro' : ''}>{pedidoAberto.erro || pedidoAberto.resultado}</p>}
            </div>
            <ol className="fgts-passos">
              {pedidoAberto.passos.map(p => (
                <li key={p.n}><span className="fgts-passo-marca" aria-hidden="true">{p.n}</span><div><b>{p.nome}</b> <span className="fraco">{hora(p.quando)}</span><div className="fraco fgts-url">{p.url}</div></div></li>
              ))}
            </ol>
          </div>
          <Telas id={pedidoAberto.id} telas={vm.telas} />
        </JanelaLateral>
      )}
    </section>
  );
}
