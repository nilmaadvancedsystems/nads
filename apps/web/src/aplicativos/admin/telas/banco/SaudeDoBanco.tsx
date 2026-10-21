// Admin › Saúde do banco: o placar e as linhas da saúde (a cota de hoje, o resumo do dia, o armazenamento, as filas, os
// órfãos, o crescimento, os sinais dos robôs e os pedidos com erro); depois, os detalhes de cada um: a última gravação de
// cada robô, as filas com pedido, as coleções (o tamanho e o quanto cresceram em 7 dias), os documentos órfãos e os pedidos
// que deram erro. Só peças do catálogo: a lista da saúde, a tabela compacta, o selo suave, o Alerta e o Vazio.
import { Alerta, Dica, Esqueleto, Icone, Vazio, useCarregando } from '@nads/ui';
import { Link } from 'react-router';
import { ListaDaSaude } from '../../../tarefas/telas/cadastro/configuracoes/ListaDaSaude';
import { TOM_DO_SELO } from '../partes/tons';
import { useSaudeDoBanco } from './useSaudeDoBanco';

const ROTULO_DO_TOM = { ok: 'No prazo', aviso: 'Atrasado', erro: 'Parado', neutro: 'Sem sinal' } as const;

export function SaudeDoBanco() {
  const vm = useSaudeDoBanco();
  useCarregando(vm.carregando);
  if (vm.semPermissao) return <Vazio icone="lock" titulo="Sem acesso à saúde do banco" texto="Só o administrador vê o resumo do banco." />;
  return (
    <section className="admin-banco">
      {vm.exemplos && <p className="hint">Dados de exemplo: nada aqui vem do banco.</p>}

      <div className="card">
        <div className="card-head">
          <h3>Saúde do banco
            <Dica texto="O consumo de hoje (medido pelo Google a cada 15 min), o resumo que o robô da nuvem faz uma vez por dia (o tamanho das coleções, os órfãos, o armazenamento) e os sinais dos robôs. Atualiza sozinho." />
          </h3>
          <span className="card-head-ctl fraco">{vm.resumo ? 'Resumo do dia: ' + vm.resumo.quando : 'Sem o resumo do dia ainda'}</span>
        </div>
        {vm.carregando ? <Esqueleto linhas={6} /> : (
          <>
            <div className={'cad-placar' + (vm.problemas ? ' atencao' : '')}>
              <span className="saude-ponto" aria-hidden="true" />
              <b>{vm.problemas ? (vm.problemas === 1 ? '1 item precisa de atenção' : vm.problemas + ' itens precisam de atenção') : 'Tudo funcionando'}</b>
            </div>
            <ListaDaSaude itens={vm.itens} />
          </>
        )}
      </div>

      {!vm.carregando && !vm.resumo && (
        <Alerta naLinha titulo="O robô ainda não publicou o resumo do dia"
          texto="O tamanho das coleções, os órfãos, o uso dos últimos 30 dias e o armazenamento aparecem aqui depois que o robô da nuvem for atualizado (ele faz o resumo uma vez por dia, em robo/saudeBanco)." />
      )}

      <div className="admin-colunas">
        <div className="card">
          <div className="card-head">
            <h3>Última gravação de cada robô
              <Dica texto="Quando cada robô (e cada medição) gravou no banco pela última vez. Passou do prazo: atenção; passou de 3 vezes o prazo: parado." />
            </h3>
          </div>
          {vm.carregando ? <Esqueleto linhas={5} /> : (
            <div className="table-wrap"><table className="table-compact">
              <thead><tr><th>O quê</th><th>Última</th><th>Situação</th></tr></thead>
              <tbody>
                {vm.sinais.map(s => (
                  <tr key={s.id}>
                    <td><b>{s.rotulo}</b></td>
                    <td>{s.ha || <span className="fraco">nunca</span>}</td>
                    <td><span className={'badge badge-suave ' + TOM_DO_SELO[s.tom]}>{ROTULO_DO_TOM[s.tom]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Filas com pedido</h3>
            <span className="card-head-ctl"><Link className="btn btn-ghost" to={vm.caminhoDoRobo}>Painel do robô<Icone nome="chevronRight" width={16} height={16} /></Link></span>
          </div>
          {vm.carregando ? <Esqueleto linhas={4} /> : vm.filas.length ? (
            <div className="table-wrap"><table className="table-compact">
              <thead><tr><th>Fila</th><th className="num">Esperando</th><th className="num">Em andamento</th><th>Mais antigo</th></tr></thead>
              <tbody>
                {vm.filas.map(f => (
                  <tr key={f.robo + f.id}>
                    <td><b>{f.nome}</b><span className="fraco"> · {f.robo === 'pc' ? 'PC' : 'Nuvem'}</span></td>
                    <td className="num">{f.esperando ? f.esperando.toLocaleString('pt-BR') : '—'}</td>
                    <td className="num">{f.andamento ? f.andamento.toLocaleString('pt-BR') : '—'}</td>
                    <td>{f.espera ? <span className={'badge badge-suave ' + TOM_DO_SELO[f.tom === 'erro' ? 'erro' : f.tom === 'aviso' ? 'aviso' : 'neutro']}>{f.espera}</span> : <span className="fraco">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <Alerta naLinha tom="ok" titulo="Todas as filas vazias" />}
          {vm.filasVazias > 0 && vm.filas.length > 0 && <p className="hint">E {vm.filasVazias} {vm.filasVazias === 1 ? 'fila vazia' : 'filas vazias'}.</p>}
        </div>
      </div>

      {vm.resumo && (
        <>
          <div className="card">
            <div className="card-head">
              <h3>Coleções
                <Dica texto="Quantos documentos cada coleção tem hoje e há 7 dias. Cresce demais: mais 1.000 documentos e +50% em 7 dias, ou mais de 50 mil documentos. O robô conta uma vez por dia (1 leitura a cada 1.000 documentos)." />
              </h3>
              <span className="card-head-ctl fraco">{vm.totalDeColecoes} coleções · o resumo gastou {vm.resumo.leituras} leituras em {vm.resumo.segundos} s</span>
            </div>
            <div className="table-wrap"><table className="table-compact">
              <thead><tr><th>Coleção</th><th className="num">Documentos</th><th className="num">Há 7 dias</th><th className="num">Em 7 dias</th><th /></tr></thead>
              <tbody>
                {vm.colecoes.map(c => (
                  <tr key={c.nome}>
                    <td><b>{c.nome}</b></td>
                    <td className="num">{c.totalTexto}</td>
                    <td className="num">{c.ha7diasTexto}</td>
                    <td className="num">{c.cresceuTexto}</td>
                    <td>{c.tom === 'aviso' && <span className="badge badge-suave badge-warn">Cresce demais</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {vm.totalDeColecoes > 10 && (
              <div className="robo-mais"><button type="button" className="btn btn-ghost" onClick={vm.alternarTodas}>{vm.todas ? 'Só as 10 primeiras' : 'Ver todas (' + vm.totalDeColecoes + ')'}</button></div>
            )}
          </div>

          <div className="admin-colunas">
            <div className="card">
              <div className="card-head">
                <h3>Documentos órfãos
                  <Dica texto="Subcoleções que ficaram sem o documento de cima (as partes de um arquivo cujo pedido já saiu, o espelho da Área do Cliente de um link apagado). Ocupam espaço e ninguém lê. O robô confere uma vez por dia." />
                </h3>
              </div>
              {!vm.orfaos.length ? <Vazio compacto icone="search" texto="O resumo do dia não trouxe a conferência dos órfãos." /> : (
                <div className="table-wrap"><table className="table-compact">
                  <thead><tr><th>Onde</th><th className="num">Órfãos</th></tr></thead>
                  <tbody>
                    {vm.orfaos.map(o => (
                      <tr key={o.colecao}>
                        <td><b>{o.rotulo}</b><span className="fraco"> · {o.colecao}{o.exemplos.length ? ' · ' + o.exemplos.join(', ') + '…' : ''}{o.erro ? ' · ' + o.erro : ''}</span></td>
                        <td className="num">{o.erro ? <span className="fraco">—</span> : o.quantos ? <span className="badge badge-suave badge-warn">{o.quantos}</span> : '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Pedidos com erro (7 dias)
                  <Dica texto="Os pedidos ao robô da nuvem que deram erro (cobrança, salvar no Drive, leitura do Gmail)." />
                </h3>
              </div>
              {vm.pedidosComErro.length ? (
                <ul className="ent-linhas robo-linhas">
                  {vm.pedidosComErro.map((p, i) => (
                    <li key={i}>
                      <div className="robo-linha-texto"><b>{p.nome}{p.cliente ? ' de ' + p.cliente : ''}</b><span className="fraco">{p.erro}</span></div>
                      <span className="fraco robo-quando">{p.quando}</span>
                    </li>
                  ))}
                </ul>
              ) : <Alerta naLinha tom="ok" titulo="Nenhum pedido com erro" />}
            </div>
          </div>

          {vm.resumo.erros.length > 0 && (
            <Alerta naLinha titulo="O que o robô não conseguiu medir hoje" texto={<>{vm.resumo.erros.join(' · ')} — os números que faltam ficam em branco (nada é estimado). <Link to={vm.caminhoDaCota}>Ver a cota e os custos</Link></>} />
          )}
        </>
      )}
    </section>
  );
}
