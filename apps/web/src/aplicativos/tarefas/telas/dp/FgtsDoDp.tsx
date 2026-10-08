// DP › FGTS Digital (07/10/2026): o robô da nuvem emite a guia mensal de cada cliente no portal do FGTS Digital, com o
// certificado do escritório (procuração no SPE). Em cima, o robô (ligado com o certificado, ou por que está desligado);
// a competência, os filtros e "Emitir as que faltam"; na lista, cada cliente com folha no mês: a situação da guia,
// Emitir / Ensaio e, pronta, Baixar o PDF. Clicar na situação abre os passos do robô (as telas por onde passou).
import { BotaoAcao, BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando } from '@nads/ui';
import { useEffect, useState } from 'react';
import { JanelaLateral } from '../janela/JanelaLateral';
import { useFgtsDoDp, type FiltroFgts, type SituacaoFgts } from './useFgtsDoDp';

const cnpjFormatado = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const data = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

const SELO: Record<SituacaoFgts, { classe: string; rotulo: string }> = {
  'sem-cnpj': { classe: 'pill-vazio', rotulo: 'sem CNPJ no cadastro' },
  nada: { classe: 'pill-vazio', rotulo: 'não pedida' },
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila do robô' },
  trabalhando: { classe: 'badge badge-warn', rotulo: 'O robô está no portal…' },
  verificacao: { classe: 'badge badge-warn', rotulo: 'Clique na verificação' },
  emitida: { classe: 'badge badge-ok', rotulo: 'Guia emitida' },
  'ensaio-ok': { classe: 'badge badge-neutral', rotulo: 'Ensaio: entrou' },
  erro: { classe: 'badge badge-danger', rotulo: 'Não deu' },
  captcha: { classe: 'badge badge-warn', rotulo: 'Fazer à mão' },
};

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
  const filtros: { valor: FiltroFgts; rotulo: string }[] = [
    { valor: 'todos', rotulo: 'Todas · ' + c.todos },
    { valor: 'faltam', rotulo: 'Faltam · ' + c.faltam },
    { valor: 'emitidas', rotulo: 'Emitidas · ' + c.emitidas },
    { valor: 'problemas', rotulo: 'Com problema · ' + c.problemas },
  ];
  const mes = vm.competencias.find(x => x.valor === vm.competencia)?.rotulo || vm.competencia.split('-').reverse().join('/');
  const aberto = vm.aberto;
  const pedidoAberto = aberto?.pedido;
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
      </div>

      <section className="card fgts-resumo">
        <div className="fgts-resumo-topo">
          <div className="fgts-resumo-titulo">
            <h3>Guias de {mes}</h3>
            <span className="hint"><b className="num">{c.emitidas}</b> de <b className="num">{c.todos}</b> emitidas{c.andando ? ' · ' + c.andando + ' com o robô agora' : ''}</span>
          </div>
          {r.carregado && r.ligado && r.certificado && (
            <span className="fgts-robo-linha" title={'Certificado de ' + r.certificado.titular}>
              <span className="bolinha-sit concluida" aria-hidden="true" />Robô ligado · certificado até {data(r.certificado.validade)}
            </span>
          )}
          <BotaoAcao carregando={vm.pedindo} textoCarregando="Pedindo…" disabled={!r.ligado || !vm.faltam} onClick={() => void vm.emitirTodas()}>
            <Icone nome="fileDown" />Emitir as que faltam{vm.faltam ? ' · ' + vm.faltam : ''}
          </BotaoAcao>
        </div>
        <span className="tarefas-barra fgts-barra" role="progressbar" aria-valuemin={0} aria-valuemax={c.todos} aria-valuenow={c.emitidas} aria-label="Guias emitidas">
          <span style={{ width: (c.todos ? (c.emitidas / c.todos) * 100 : 0) + '%' }} />
        </span>
      </section>

      {vm.verificando.map(l => l.pedido && (
        <div key={l.pedido.id} className="card fgts-verificacao">
          <Icone nome="alert" />
          <span><b>{l.nome}</b>: o gov.br pediu a verificação "não sou um robô".</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" onClick={() => vm.abrir(l.pedido!.id)}>Fazer a verificação</button>
        </div>
      ))}
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.filtro} opcoes={filtros} onMudar={vm.setFiltro} />
      </div>
      {vm.carregando ? <Esqueleto linhas={8} /> : vm.linhas.length ? (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Cód.</th><th>Empresa</th><th>CNPJ</th><th>Responsável</th><th>Guia</th><th /></tr></thead>
            <tbody>
              {vm.linhas.map(l => {
                const selo = SELO[l.situacao];
                const p = l.pedido;
                return (
                  <tr key={l.codigo}>
                    <td><span className="emp-cod">{l.codigo}</span></td>
                    <td className="fgts-nome">{l.nome}</td>
                    <td className="num fraco fgts-cnpj">{l.cnpj ? cnpjFormatado(l.cnpj) : ''}</td>
                    <td className="fraco">{l.responsavel}</td>
                    <td>
                      {p ? (
                        <button type="button" className="fgts-situacao" title={p.erro || p.resultado || ''} onClick={() => vm.abrir(p.id)}>
                          <span className={selo.classe}>{selo.rotulo}</span>
                          <span className="fraco">{hora(p.fimEm || p.criadoEm)}</span>
                        </button>
                      ) : <span className={selo.classe}>{selo.rotulo}</span>}
                    </td>
                    <td className="fgts-acoes">
                      {p && l.situacao === 'emitida' && <button type="button" className="btn btn-outline" onClick={() => void vm.baixar(p)}><Icone nome="download" />PDF</button>}
                      {l.cnpj && !['fila', 'trabalhando'].includes(l.situacao) && (
                        <>
                          {l.situacao === 'emitida'
                            ? <BotaoIcone icone="repeat" titulo="Emitir de novo" pequeno disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'emitir')} />
                            : <>
                              <button type="button" className="btn btn-ghost" disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'ensaio')}>Ensaio</button>
                              <button type="button" className="btn btn-outline" disabled={!r.ligado} onClick={() => void vm.pedir(l.codigo, 'emitir')}>Emitir</button>
                            </>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="card gh-blank"><Icone nome="search" /><h4>Nenhuma empresa aqui</h4><p>Nenhum cliente do DP com folha neste filtro.</p></div>}

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
