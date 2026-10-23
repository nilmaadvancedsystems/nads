// Cadastro › Painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo, arquivando e
// afins"). Só o admin e o diretor. De cima para baixo: os dois robôs (ligado ou não, onde roda, a versão e o que está
// fazendo agora), os erros das últimas 24 h em destaque, as filas de pedidos, o que foi arquivado hoje e no mês (com o
// caminho para Admin › Arquivador) e a atividade dos últimos 7 dias, com o filtro por tipo e por erro.
import { Alerta, Dica, Esqueleto, Icone, Vazio, useCarregando } from '@nads/ui';
import { Link } from 'react-router';
import { CartaoDoRobo } from './partes/CartaoDoRobo';
import { LinhaDoTempoDoRobo } from './partes/LinhaDoTempoDoRobo';
import { usePainelDoRobo } from './usePainelDoRobo';
import { entregas } from '@nads/core';

const SELO_DA_FILA: Record<entregas.TomDoPainel, string> = { ok: 'badge-neutral', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };
const num = (n: number) => n.toLocaleString('pt-BR');

/** Cadastro › Painel do robô. */
export function PainelDoRobo() {
  const vm = usePainelDoRobo();
  useCarregando(vm.carregando);
  if (vm.semPermissao) {
    return <Vazio icone="lock" titulo="Sem acesso ao painel do robô" texto="Só o administrador e o diretor veem o que o robô está fazendo." />;
  }
  const a = vm.arquivados;
  return (
    <section className="robo-painel">
      <div className="robo-grade">
        {vm.carregando ? <><div className="card"><Esqueleto linhas={5} /></div><div className="card"><Esqueleto linhas={5} /></div></>
          : vm.robos.map(r => <CartaoDoRobo key={r.robo} s={r} />)}
      </div>

      {/* os erros em destaque */}
      {!vm.carregando && (vm.erros.length > 0 ? (
        <div className="card robo-erros">
          <div className="card-head">
            <h3>Erros nas últimas 24 horas</h3>
            <span className="card-head-ctl">
              <span className="badge badge-suave badge-bad">{vm.errosNas24h} {vm.errosNas24h === 1 ? 'erro' : 'erros'}</span>
              {vm.errosNas24h > vm.erros.length && <button type="button" className="btn btn-ghost" onClick={vm.verOsErros}>Ver todos</button>}
            </span>
          </div>
          <LinhaDoTempoDoRobo itens={vm.erros} agora={vm.agora} />
        </div>
      ) : <Alerta naLinha tom="ok" titulo="Nenhum erro nas últimas 24 horas" texto="Quando o robô der erro em alguma coisa, ele aparece aqui em destaque." />)}

      {/* as filas */}
      <div className="card">
        <div className="card-head">
          <h3>Filas de pedidos
            <Dica texto="O que está esperando cada robô e o que ele está fazendo agora. Esperando há mais de 1 hora fica em amarelo; esperando com o robô dela desligado, em vermelho (ninguém vai atender)." />
          </h3>
          <span className="card-head-ctl">{num(vm.esperando)} esperando · {num(vm.andamento)} em andamento</span>
        </div>
        {vm.carregando ? <Esqueleto linhas={4} /> : !vm.filas.length ? (
          <Vazio compacto icone="list" texto="Os robôs ainda não publicaram as filas (aparecem no primeiro minuto depois de ligados com o código novo)." />
        ) : (
          <div className="table-wrap robo-filas"><table className="table-compact">
            <thead><tr><th>Fila</th><th>Robô</th><th className="num">Esperando</th><th className="num">Em andamento</th><th>Mais antigo</th></tr></thead>
            <tbody>
              {vm.filas.map(f => (
                <tr key={f.robo + f.id} className={f.esperando + f.andamento ? undefined : 'robo-fila-vazia'}>
                  <td><b>{f.nome}</b>{f.erro && <span className="fraco"> · não consegui contar: {f.erro}</span>}</td>
                  <td>{f.robo === 'pc' ? 'PC' : 'Nuvem'}</td>
                  <td className="num">{f.esperando ? num(f.esperando) : '—'}</td>
                  <td className="num">{f.andamento ? num(f.andamento) : '—'}</td>
                  <td>{f.espera ? <span className={'badge badge-suave ' + SELO_DA_FILA[f.tom]}>{f.espera}</span> : <span className="fraco">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* o que foi arquivado */}
      <div className="card">
        <div className="card-head">
          <h3>Arquivados{vm.mesDosArquivados ? ' em ' + vm.mesDosArquivados : ''}</h3>
          {vm.podeAbrirArquivo && (
            <Link className="btn btn-outline" to={vm.caminhoDoArquivo}><Icone nome="arquivo" width={16} height={16} />Abrir o Arquivador</Link>
          )}
        </div>
        {vm.carregando ? <Esqueleto linhas={2} numeros={4} /> : !a ? (
          <Vazio compacto icone="arquivo" texto="O robô do PC ainda não publicou o que foi arquivado (sai junto com o painel, depois que ele for atualizado)." />
        ) : (
          <>
            <div className="stat-grid dp-numeros robo-numeros">
              <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="checkCircle" width={16} height={16} /></span><p className="stat-label">Arquivados hoje</p><p className="stat-value num">{num(a.hoje)}</p></div>
              <div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arquivo" width={16} height={16} /></span><p className="stat-label">Arquivados no mês</p><p className="stat-value num">{num(a.noMes)}</p></div>
              <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="clock" width={16} height={16} /></span><p className="stat-label">Organizações no mês</p><p className="stat-value num">{num(a.execucoesNoMes)}</p></div>
              {vm.paraResolver && (
                <div className={'stat painel-numero ' + (vm.paraResolver.n ? 'painel-aviso' : 'painel-ok')}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={vm.paraResolver.n ? 'alert' : 'checkCircle'} width={16} height={16} /></span><p className="stat-label">Para resolver agora</p><p className="stat-value num">{vm.paraResolver.texto}</p></div>
              )}
              <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arquivo" width={16} height={16} /></span><p className="stat-label">Não identificados no mês (histórico)</p><p className="stat-value num">{num(a.naoIdentificadosNoMes)}</p></div>
            </div>
            {a.execucoes.length ? (
              <div className="table-wrap robo-execucoes"><table className="table-compact">
                <thead><tr><th>Quando</th><th className="num">Arquivados</th><th className="num">Clientes</th><th className="num">Não identificados</th><th>Execução</th></tr></thead>
                <tbody>
                  {a.execucoes.map(x => (
                    <tr key={x.id}>
                      <td>{entregas.quandoNoPainel(x.em, vm.agora)}</td>
                      <td className="num">{num(x.arquivados)}</td>
                      <td className="num">{num(x.clientes)}</td>
                      <td className="num">{x.naoIdentificados ? num(x.naoIdentificados) : '—'}</td>
                      <td className="fraco">{x.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p className="hint">Nenhuma organização neste mês ainda.</p>}
          </>
        )}
      </div>

      {/* a atividade */}
      <div className="card">
        <div className="card-head">
          <h3>Atividade recente
            <Dica texto="Cada coisa que os robôs fizeram nos últimos 7 dias: o que arquivaram, as guias emitidas, os XMLs baixados, os e-mails lidos e os erros. O robô apaga sozinho o que passa de 7 dias." />
          </h3>
          <span className="card-head-ctl">{num(vm.totalDeAtividades)} {vm.totalDeAtividades === 1 ? 'linha' : 'linhas'}</span>
        </div>
        <div className="chip-row robo-filtro">
          <span className="chip-lbl">Tipo</span>
          <button type="button" className={'chip-f' + (vm.tipo === 'todos' ? ' on' : '')} onClick={() => vm.escolherTipo('todos')}>Todos</button>
          {vm.tipos.map(t => (
            <button key={t.id} type="button" className={'chip-f' + (vm.tipo === t.id ? ' on' : '')} onClick={() => vm.escolherTipo(t.id)}>{t.rotulo}</button>
          ))}
          <span className="chip-lbl robo-filtro-erros">Mostrar</span>
          <button type="button" className={'chip-f' + (vm.soErros ? ' on' : '')} aria-pressed={vm.soErros} onClick={vm.alternarSoErros}>Só os erros</button>
        </div>
        {vm.carregando ? <Esqueleto linhas={6} /> : vm.atividades.length ? (
          <>
            <LinhaDoTempoDoRobo itens={vm.atividades} agora={vm.agora} />
            {vm.temMais && <div className="robo-mais"><button type="button" className="btn btn-ghost" onClick={vm.mostrarMais}>Mostrar mais</button></div>}
          </>
        ) : (
          <Vazio compacto icone="clock" texto={vm.soErros || vm.tipo !== 'todos' ? 'Nada com esse filtro nos últimos 7 dias.' : 'Nenhuma atividade registrada ainda. Ela aparece aqui assim que o robô for atualizado com o painel.'} />
        )}
      </div>
    </section>
  );
}
