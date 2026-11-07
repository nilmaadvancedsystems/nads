// A tela inicial da Central dos robôs (v3, um quadro de operação no N1 da Nilma): os robôs agrupados pela máquina onde
// rodam (a linha da máquina com o host e CPU/memória/disco) e, ao lado, o que precisa de alguém, os erros de hoje (com a
// hora) e as filas. Navegação: barra embaixo no celular, trilho à esquerda no PC. Clicar num robô abre a ficha dele.
// O endereço guarda o que está aberto:
//   /robos                       a tela inicial
//   /robos/robo/<id>/<aba>       a janela de um robô (aba: geral, registros, acoes, config)
//   /robos/maquinas | /robos/registros | /robos/configuracoes
import { robos as r } from '@nads/core';
import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Confirmacao } from '../partes/Janela';
import { ABAS, AppIcone, Estado, JanelaDoRobo, type AbaDoRobo } from '../telas/JanelaDoRobo';
import { PainelConfiguracoes, PainelMaquinas, PainelRegistros } from '../telas/Paineis';
import { useAcoes, useBusca, useCentral } from './useCentral';

const NAV = [
  { id: '', nome: 'Robôs', icone: 'home' },
  { id: 'maquinas', nome: 'Máquinas', icone: 'servidor' },
  { id: 'registros', nome: 'Registros', icone: 'terminal' },
  { id: 'configuracoes', nome: 'Ajustes', icone: 'settings' },
] as const;

const horaDe = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

function Sinal({ rotulo, valor }: { rotulo: string; valor: number | null | undefined }) {
  const p = r.porcento(valor ?? null);
  return <span>{rotulo} <b className={'num' + (p != null && p >= 85 ? ' alto' : '')}>{p == null ? '—' : p + '%'}</b></span>;
}

export function Central() {
  const central = useCentral();
  const acoes = useAcoes(central);
  const busca = useBusca(central.situacoes);
  const ir = useNavigate();
  const atencaoRef = useRef<HTMLElement>(null);
  const { '*': resto = '' } = useParams();
  const partes = resto.split('/').filter(Boolean);
  const secao = partes[0] || '';
  const roboAberto = secao === 'robo' ? central.situacoes.find(s => s.robo.id === partes[1]) || null : null;
  const aba: AbaDoRobo = ABAS.some(a => a.id === partes[2]) ? (partes[2] as AbaDoRobo) : 'geral';
  const voltar = () => { acoes.cancelar(); ir('/robos'); };
  const abrir = (id: string, a: AbaDoRobo = 'geral') => ir('/robos/robo/' + id + '/' + a);

  const atencao = central.situacoes.filter(s => s.tom === 'erro' || s.tom === 'aviso');
  const visiveis = new Set(busca.visiveis.map(s => s.robo.id));
  const campoDeBusca = (classe: string) => (
    <label className={'cr-busca ' + classe}>
      <IconeDoRobo nome="search" tamanho={16} />
      <input type="search" placeholder="Buscar robô" value={busca.termo} onChange={e => busca.setTermo(e.target.value)} aria-label="Buscar robô" />
    </label>
  );

  return (
    <div className="cr">
      <div className="cr-rolagem">
        <main className="cr-inicio">
          <header className="cr-topo">
            <div className="cr-topo-nome">
              <h1>Central dos robôs</h1>
              <div className="cr-topo-sub">
              {central.semPermissao ? <span className="cr-resumo">O banco não deixou ler: só o administrador vê os robôs.</span>
                : !central.carregado ? <span className="cr-resumo">Chamando os robôs…</span>
                : atencao.length ? (
                  <button type="button" className="cr-resumo atencao" onClick={() => atencaoRef.current?.scrollIntoView({ block: 'start' })}>
                    {atencao.length === 1 ? '1 robô pede atenção' : atencao.length + ' robôs pedem atenção'}
                  </button>
                ) : <span className="cr-resumo">Todos os {central.situacoes.length} robôs em dia.</span>}
              {central.exemplos && <span className="cr-exemplo">dados de exemplo</span>}
              </div>
            </div>
            <div className="cr-topo-direita">
              {campoDeBusca('cr-so-pc')}
              <div className="cr-topo-hora">
                <time className="num">{central.hora}</time>
                <span>{central.data}</span>
              </div>
            </div>
          </header>
          {campoDeBusca('cr-so-celular')}

          <div className="cr-colunas">
            <div className="cr-principal">
              {central.maquinas.map(m => {
                const robos = central.situacoes.filter(s => s.robo.maquina === m.maquina.id && visiveis.has(s.robo.id));
                if (!robos.length && busca.termo) return null;
                return (
                  <section key={m.maquina.id} className="cr-maquina" aria-label={m.maquina.nome}>
                    <button type="button" className="cr-maquina-linha" onClick={() => ir('/robos/maquinas')}>
                      <span className="cr-maquina-nome"><h2>{m.maquina.nome}</h2><Estado tom={m.tom}>{m.rotulo.toLowerCase()}</Estado></span>
                      <span className="cr-maquina-host num">{m.host}</span>
                      <span className="cr-sinais">
                        {m.sinais ? <><Sinal rotulo="CPU" valor={m.sinais.cpu} /><Sinal rotulo="Mem" valor={m.sinais.memoria} /><Sinal rotulo="Disco" valor={m.sinais.disco} /></> : <span>sinal {m.sinal}</span>}
                      </span>
                    </button>
                    <div className="cr-grade">
                      {robos.map(s => {
                        const naFila = s.fila ? s.fila.esperando + s.fila.andamento : 0;
                        return (
                          <button key={s.robo.id} type="button" className="cr-app" onClick={() => abrir(s.robo.id)} aria-label={s.robo.nome + ': ' + (s.pausa ? 'Pausado' : s.rotulo)}>
                            <AppIcone robo={s.robo}>{s.pausa && <span className="cr-app-pausa"><IconeDoRobo nome="pausa" tamanho={10} /></span>}</AppIcone>
                            <span className="cr-app-nome">{s.robo.nome}</span>
                            {s.tom === 'erro' || s.tom === 'aviso' ? <Estado tom={s.tom}>{(s.pausa ? 'pausado' : s.rotulo).toLowerCase()}</Estado>
                              : <span className="cr-estado">{s.pausa ? 'pausado' : naFila ? <><span className="num">{naFila}</span> na fila</> : s.rotulo.toLowerCase()}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {!busca.visiveis.length && <p className="cr-vazio" style={{ marginTop: 16 }}>Nenhum robô com “{busca.termo}”.</p>}
            </div>

            <aside className="cr-lado" aria-label="O que pede atenção">
              <section className="cr-bloco" ref={atencaoRef}>
                <div className="cr-bloco-topo"><h2>Precisa de alguém</h2></div>
                {atencao.length ? (
                  <ul className="cr-ocorrencias">
                    {atencao.map(s => (
                      <li key={s.robo.id}>
                        <button type="button" className="cr-ocorrencia" onClick={() => abrir(s.robo.id)}>
                          <AppIcone robo={s.robo} tamanho={32} />
                          <span className="cr-ocorrencia-corpo">
                            <span className="cr-ocorrencia-quem"><span>{s.robo.nome}</span><Estado tom={s.tom}>{(s.pausa ? 'pausado' : s.rotulo).toLowerCase()}</Estado></span>
                            <span className="cr-ocorrencia-texto">{s.motivo || (s.ultimoErro ? s.ultimoErro.texto : 'Sem sinal recente.')}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="cr-calmo">Nenhum robô parado ou atrasado.</p>}
              </section>

              <section className="cr-bloco">
                <div className="cr-bloco-topo"><h2>Erros de hoje</h2>{central.erros.length > 0 && <button type="button" onClick={() => ir('/robos/registros')}>Ver todos</button>}</div>
                {central.erros.length ? (
                  <ul className="cr-ocorrencias">
                    {central.erros.slice(0, 5).map(e => {
                      const robo = r.roboDaAtividade(e);
                      return (
                        <li key={e.id}>
                          <button type="button" className="cr-ocorrencia" onClick={() => (robo ? abrir(robo.id, 'registros') : ir('/robos/registros'))}>
                            <time className="num">{horaDe(e.em)}</time>
                            <span className="cr-ocorrencia-corpo">
                              <span className="cr-ocorrencia-quem"><span>{robo?.nome || e.tipo}</span></span>
                              <span className="cr-ocorrencia-texto">{e.texto}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="cr-calmo">Nenhum erro hoje.</p>}
              </section>

              <section className="cr-bloco">
                <div className="cr-bloco-topo"><h2>Filas</h2></div>
                {central.filas.linhas.length ? (
                  <table className="cr-tabela">
                    <thead><tr><th scope="col">Robô</th><th scope="col">esperando</th><th scope="col">fazendo</th></tr></thead>
                    <tbody>
                      {central.filas.linhas.map(l => (
                        <tr key={l.robo.id} className="clicavel" onClick={() => abrir(l.robo.id)}>
                          <td>{l.robo.nome}</td>
                          <td className={'num' + (l.esperando ? '' : ' zero')}>{l.esperando}</td>
                          <td className={'num' + (l.andamento ? '' : ' zero')}>{l.andamento}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td>Total</td><td className="num">{central.filas.esperando}</td><td className="num">{central.filas.linhas.reduce((t, l) => t + l.andamento, 0)}</td></tr></tfoot>
                  </table>
                ) : <p className="cr-calmo">Nenhum pedido esperando.</p>}
              </section>
            </aside>
          </div>
        </main>
      </div>

      <nav className="cr-nav" aria-label="Navegação">
        {NAV.map(d => {
          const ativo = d.id === '' ? !secao || secao === 'robo' : secao === d.id;
          return (
            <button key={d.id} type="button" className={'cr-nav-item' + (ativo ? ' ativo' : '')} aria-current={ativo ? 'page' : undefined}
              onClick={() => ir(d.id ? '/robos/' + d.id : '/robos')}>
              <IconeDoRobo nome={d.icone} tamanho={20} />
              <span>{d.nome}</span>
            </button>
          );
        })}
      </nav>

      {roboAberto && (
        <JanelaDoRobo key={roboAberto.robo.id} central={central} s={roboAberto} aba={aba} acoes={acoes} aoFechar={voltar}
          irPara={a => ir('/robos/robo/' + roboAberto.robo.id + '/' + a, { replace: true })} />
      )}
      {secao === 'maquinas' && <PainelMaquinas central={central} acoes={acoes} aoFechar={voltar} />}
      {secao === 'registros' && <PainelRegistros central={central} aoFechar={voltar} />}
      {secao === 'configuracoes' && <PainelConfiguracoes central={central} aoFechar={voltar} />}

      {acoes.pendente && (
        <Confirmacao
          titulo={acoes.pendente.acao.nome + '?'}
          texto={<>
            <dl className="cr-dl">
              {acoes.pendente.robo && acoes.pendente.acao.alvo === 'robo' && <><dt>Robô</dt><dd>{acoes.pendente.robo.nome}{acoes.pendente.tarefa ? ', ' + acoes.pendente.tarefa.nome.toLowerCase() : ''}</dd></>}
              <dt>Máquina</dt><dd>{acoes.pendente.maquina.nome} (<span className="num">{acoes.pendente.maquina.host}</span>)</dd>
            </dl>
            <p>{acoes.pendente.acao.descricao}</p>
            <p className="cr-fraco">O robô responde em até 1 minuto, nos pedidos recentes.</p>
          </>}
          rotuloSim={acoes.pendente.acao.nome} perigo enviando={acoes.enviando} erro={acoes.erro}
          aoConfirmar={acoes.confirmar} aoCancelar={acoes.cancelar} />
      )}
      {acoes.enviado && !acoes.pendente && <Enviado key={acoes.enviado} central={central} id={acoes.enviado} />}
    </div>
  );
}

/** O aviso pequeno no rodapé: o pedido foi e o que o robô respondeu (some sozinho depois que termina). */
function Enviado({ central, id }: { central: ReturnType<typeof useCentral>; id: string }) {
  const c = central.comandos.find(x => x.id === id);
  if (!c || c.status === 'feito' && central.agora - Date.parse(c.respondidoEm || c.em) > 20000) return null;
  return (
    <div className="cr-recado" role="status">
      <b>{r.textoDoComando(c)}</b>
      <Estado tom={r.TOM_DO_STATUS[c.status]} forte>{r.ROTULO_DO_STATUS[c.status]}</Estado>
      {c.mensagem && <span className="cr-linha-meta">{c.mensagem}</span>}
    </div>
  );
}
