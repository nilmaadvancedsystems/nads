// Admin › Visão geral: o resumo do que precisa de atenção. Em cima, os números (clicar abre a página); embaixo, os dois
// robôs (o mesmo cartão do Painel do robô), os erros das últimas 24 h, as filas atrasadas, os feedbacks novos de prioridade
// alta e a saúde do banco (só os itens que precisam de atenção). Só peças do catálogo: o número do painel (painel-numero),
// o cartão do robô, a linha do tempo do robô, a tabela compacta, as linhas da saúde, o Alerta e o Vazio.
import { Alerta, Esqueleto, Icone, Vazio, useCarregando } from '@nads/ui';
import { Link } from 'react-router';
import { CartaoDoRobo } from '../../../tarefas/telas/cadastro/painel-robo/partes/CartaoDoRobo';
import { LinhaDoTempoDoRobo } from '../../../tarefas/telas/cadastro/painel-robo/partes/LinhaDoTempoDoRobo';
import { ListaDaSaude } from '../../../tarefas/telas/cadastro/configuracoes/ListaDaSaude';
import { TOM_DO_NUMERO } from '../partes/tons';
import { useVisaoGeral } from './useVisaoGeral';

/** O link "Abrir …" no canto do cartão. */
function Abrir({ para, rotulo }: { para: string; rotulo: string }) {
  return <Link className="btn btn-ghost" to={para}>{rotulo}<Icone nome="chevronRight" width={16} height={16} /></Link>;
}

export function VisaoGeral() {
  const vm = useVisaoGeral();
  useCarregando(vm.carregando);
  return (
    <section className="admin-visao">
      {vm.exemplos && <p className="hint">Dados de exemplo: nada aqui vem do banco.</p>}

      <div className="stat-grid dp-numeros admin-numeros">
        {vm.numeros.map(n => (
          <Link key={n.id} to={vm.caminho(n.pagina)} className={'stat painel-numero admin-numero ' + TOM_DO_NUMERO[n.tom]}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} width={16} height={16} /></span>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{vm.carregando && n.id !== 'feedbacks' && n.id !== 'banco' ? '—' : n.valor}</p>
          </Link>
        ))}
      </div>

      <div className="robo-grade">
        {vm.carregando ? <><div className="card"><Esqueleto linhas={5} /></div><div className="card"><Esqueleto linhas={5} /></div></>
          : vm.robos.map(r => <CartaoDoRobo key={r.robo} s={r} />)}
      </div>

      <div className="admin-colunas">
        <div className="card">
          <div className="card-head">
            <h3>Erros nas últimas 24 horas</h3>
            <span className="card-head-ctl"><Abrir para={vm.caminho('robo')} rotulo="Painel do robô" /></span>
          </div>
          {vm.carregando ? <Esqueleto linhas={3} /> : vm.erros.length ? (
            <>
              <LinhaDoTempoDoRobo itens={vm.erros} agora={vm.agora} />
              {vm.errosNas24h > vm.erros.length && <p className="hint">E mais {vm.errosNas24h - vm.erros.length} no Painel do robô.</p>}
            </>
          ) : <Alerta naLinha tom="ok" titulo="Nenhum erro nas últimas 24 horas" />}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Filas atrasadas</h3>
            <span className="card-head-ctl"><Abrir para={vm.caminho('robo')} rotulo="Filas" /></span>
          </div>
          {vm.carregando ? <Esqueleto linhas={3} /> : vm.atrasadas.length ? (
            <div className="table-wrap"><table className="table-compact">
              <thead><tr><th>Fila</th><th>Robô</th><th className="num">Esperando</th><th>Mais antigo</th></tr></thead>
              <tbody>
                {vm.atrasadas.map(f => (
                  <tr key={f.robo + f.id}>
                    <td><b>{f.nome}</b></td>
                    <td>{f.robo === 'pc' ? 'PC' : 'Nuvem'}</td>
                    <td className="num">{f.esperando.toLocaleString('pt-BR')}</td>
                    <td><span className={'badge badge-suave ' + (f.tom === 'erro' ? 'badge-bad' : 'badge-warn')}>{f.espera || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <Alerta naLinha tom="ok" titulo="Nenhuma fila atrasada" texto="Fila atrasada: pedido esperando há mais de 1 hora, ou esperando com o robô dela desligado." />}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Feedbacks novos de prioridade alta</h3>
            <span className="card-head-ctl"><Abrir para={vm.caminho('feedbacks')} rotulo={'Feedbacks (' + vm.feedbacksNovos + ' novos)'} /></span>
          </div>
          {vm.carregandoFeedbacks ? <Esqueleto linhas={3} /> : vm.feedbacksAltos.length ? (
            <ul className="ent-linhas robo-linhas">
              {vm.feedbacksAltos.map(f => (
                <li key={f.id}>
                  <div className="robo-linha-texto">
                    <b>{f.nome}</b>
                    <span className="fraco">{f.texto}</span>
                  </div>
                  <span className="badge badge-suave badge-bad">Alta</span>
                  <span className="fraco robo-quando">{f.quando}</span>
                </li>
              ))}
            </ul>
          ) : <Vazio compacto icone="mensagem" texto="Nenhum feedback novo de prioridade alta." />}
          {vm.feedbacksAltosTotal > vm.feedbacksAltos.length && <p className="hint">E mais {vm.feedbacksAltosTotal - vm.feedbacksAltos.length} nos Feedbacks.</p>}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Saúde do banco</h3>
            <span className="card-head-ctl"><Abrir para={vm.caminho('banco')} rotulo="Saúde do banco" /></span>
          </div>
          {vm.carregandoBanco ? <Esqueleto linhas={3} /> : vm.saudeDoBanco.length ? (
            <ListaDaSaude itens={vm.saudeDoBanco} />
          ) : <Alerta naLinha tom="ok" titulo="Tudo certo com o banco" texto={vm.saudeDoBancoTotal + ' itens conferidos.'} />}
        </div>
      </div>
    </section>
  );
}
