// DP › Envios (27/10/2026: "uma aba de envios, onde vai ser enviado para o gmail do cliente arquivos que já foram
// arquivados nas pastas dos clientes… com um clique de botão num formato padrão via VM do google"). Como o FGTS Digital:
// os filtros numa linha; a tabela com os documentos do mês que estão na pasta, os e-mails do cadastro e o envio como selo;
// na linha, Enviar (ou Enviar de novo); clicar nos arquivos abre a janela do cliente para desmarcar algum antes de enviar.
// Em cima, Enviar todos os prontos (com a confirmação: são e-mails para muitos clientes de uma vez).
import { BotaoAcao, Esqueleto, Icone, MenuSuspenso, SeletorMes, useCarregando, useEntradaAnimada } from '@nads/ui';
import { JanelaLateral } from '../janela/JanelaLateral';
import { MenuDeFiltro } from './MenuDeFiltro';
import { useEnviosDoDp, type FiltroDoEnvio, type SituacaoDoEnvio } from './useEnviosDoDp';

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

// os selos como a Situação das Obrigações: verde feito, laranja andando, vermelho parado, cinza o resto
const SELO: Record<SituacaoDoEnvio, { classe: string; rotulo: string }> = {
  'sem-arquivos': { classe: 'badge badge-neutral', rotulo: 'Sem arquivos' },
  'sem-email': { classe: 'badge badge-parada', rotulo: 'Sem e-mail' },
  pronto: { classe: 'badge badge-neutral', rotulo: 'Pronto' },
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila' },
  enviando: { classe: 'badge badge-warn', rotulo: 'Enviando' },
  enviado: { classe: 'badge badge-ok', rotulo: 'Enviado' },
  erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
};
const SITUACOES: { valor: FiltroDoEnvio; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'prontos', rotulo: 'Prontos' }, { valor: 'enviados', rotulo: 'Enviados' },
  { valor: 'problemas', rotulo: 'Com problema' }, { valor: 'sem-arquivos', rotulo: 'Sem arquivos' },
];

export function EnviosDoDp() {
  const vm = useEnviosDoDp();
  useCarregando(vm.carregando);
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.carregando, vm.competencia, vm.filtro], 'lista');
  const c = vm.contagem;
  const mes = vm.competencias.find(x => x.valor === vm.competencia)?.rotulo || vm.competencia.split('-').reverse().join('/');
  const aberto = vm.aberto;
  const podeEnviar = (s: SituacaoDoEnvio) => s === 'pronto' || s === 'enviado' || s === 'erro';
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou e-mail)"
            onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuDeFiltro rotulo="Responsável" valor={vm.responsavel} mudar={vm.setResponsavel} opcoes={vm.responsaveis} />
        <MenuSuspenso rotulo={'Situação: ' + (SITUACOES.find(o => o.valor === vm.filtro)?.rotulo ?? '') + ' (' + c[vm.filtro] + ')'} titulo="Situação" dica="Situação"
          className={'btn btn-outline' + (vm.filtro !== 'todos' ? ' ativo' : '')}
          itens={SITUACOES.map(o => ({ rotulo: o.rotulo + ' (' + c[o.valor] + ')', marcado: o.valor === vm.filtro, onClick: () => vm.setFiltro(o.valor) }))} />
      </div>

      <section className="card dp-lista">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">Envios de {mes}</h3>
          <span className="badge badge-neutral">{vm.linhas.length}</span>
          <span className="hint">{c.enviados} {c.enviados === 1 ? 'enviado' : 'enviados'} · {c.prontos} {c.prontos === 1 ? 'pronto' : 'prontos'}</span>
          <span className="tarefas-barra-espaco" />
          <BotaoAcao carregando={vm.enviandoTodos} textoCarregando="Pedindo…" disabled={!vm.prontos} onClick={() => void vm.enviarTodos()}>
            <Icone nome="aviao" />Enviar todos os prontos{vm.prontos ? ' · ' + vm.prontos : ''}
          </BotaoAcao>
        </div>
        {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
          <div className="table-wrap" ref={tabela}>
            <table className="dp-tabela fgts-tabela">
              <thead>
                <tr><th>Cód.</th><th>Cliente</th><th>Responsável</th><th>Arquivos do mês</th><th>E-mail</th><th>Envio</th><th /></tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => {
                  const selo = SELO[l.situacao];
                  const e = l.envio;
                  return (
                    <tr key={l.codigo} className={'dp-linha' + (l.situacao === 'enviado' ? ' feita' : '')}>
                      <td className="num fraco">{l.codigo}</td>
                      <td className="dp-cliente"><span className="dp-cliente-nome" title={l.nome}>{l.nome}</span></td>
                      <td>{l.responsavel || <span className="fraco">—</span>}</td>
                      <td>
                        {l.arquivos.length ? (
                          <button type="button" className="fgts-situacao dp-envio-qtd" title={l.arquivos.map(a => a.nome).join('\n')} onClick={() => vm.abrir(l.codigo)}>
                            <Icone nome="clipe" />
                            <span>{l.escolhidos.length < l.arquivos.length ? l.escolhidos.length + ' de ' + l.arquivos.length : l.arquivos.length} {l.arquivos.length === 1 ? 'arquivo' : 'arquivos'}</span>
                          </button>
                        ) : <span className="fraco">—</span>}
                      </td>
                      <td className="fraco">{l.emails.length ? <span title={l.emails.join('\n')}>{l.emails[0]}{l.emails.length > 1 ? ' +' + (l.emails.length - 1) : ''}</span> : '—'}</td>
                      <td>
                        {e ? (
                          <button type="button" className="fgts-situacao" title={e.erro || (e.para.length ? 'para ' + e.para.join(', ') : '')} onClick={() => vm.abrir(l.codigo)}>
                            <span className={selo.classe}>{selo.rotulo}</span>
                            <span className="fraco">{hora(e.enviadoEm || e.criadoEm)}</span>
                          </button>
                        ) : <span className={selo.classe}>{selo.rotulo}</span>}
                      </td>
                      <td className="fgts-acoes">
                        <div className="fgts-acoes-linha">
                          {podeEnviar(l.situacao) && (
                            <BotaoAcao className="btn btn-outline" disabled={!l.escolhidos.length} carregando={vm.fazendo('enviar:' + l.codigo)} textoCarregando="Pedindo…" onClick={() => void vm.enviar(l.codigo)}>
                              <Icone nome="aviao" />{l.situacao === 'enviado' ? 'Enviar de novo' : 'Enviar'}
                            </BotaoAcao>
                          )}
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

      {aberto && (
        <JanelaLateral rotulo={aberto.nome} topicos={[{ id: 'arquivos', rotulo: 'Arquivos do mês', icone: 'clipe' }]} topico="arquivos" mudar={() => undefined} fechar={vm.fechar} classe="fgts-janela" resumo={(
          <div className="usuario-quem"><span className="emp-cod">{aberto.codigo}</span><b>{aberto.nome}</b></div>
        )}>
          <div className="card">
            <h3>Documentos do DP · {mes}</h3>
            {aberto.arquivos.length ? (
              <ul className="dp-envio-arquivos">
                {aberto.arquivos.map(a => (
                  <li key={a.id}>
                    <label>
                      <input type="checkbox" checked={vm.marcado(aberto.codigo, a.id)} onChange={() => vm.alternarArquivo(aberto.codigo, a.id)} />
                      <span><b>{a.nome}</b><span className="fraco dp-envio-pasta">{a.pasta}{a.tamanho ? ' · ' + tamanho(a.tamanho) : ''}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : <p className="hint">Nenhum documento do DP de {mes} na pasta do cliente.</p>}
            <p className="fraco">Para: {aberto.emails.length ? aberto.emails.join(', ') : 'sem e-mail no cadastro'}</p>
            {podeEnviar(aberto.situacao) && (
              <BotaoAcao className="btn btn-primary" disabled={!aberto.escolhidos.length} carregando={vm.fazendo('enviar:' + aberto.codigo)} textoCarregando="Pedindo…" onClick={() => void vm.enviar(aberto.codigo)}>
                <Icone nome="aviao" />{(aberto.situacao === 'enviado' ? 'Enviar de novo · ' : 'Enviar · ') + aberto.escolhidos.length + (aberto.escolhidos.length === 1 ? ' arquivo' : ' arquivos')}
              </BotaoAcao>
            )}
          </div>
          {aberto.envio && (
            <div className="card">
              <h3>Último envio</h3>
              <div className="fgts-pedido">
                <span className={SELO[aberto.situacao].classe}>{SELO[aberto.situacao].rotulo}</span>
                <span className="fraco">pedido por {aberto.envio.criadoPor} · {hora(aberto.envio.criadoEm)}</span>
                {aberto.envio.erro && <p className="fgts-pedido-erro">{aberto.envio.erro}</p>}
                {aberto.envio.status === 'enviado' && <p>Enviado em {hora(aberto.envio.enviadoEm)} para {aberto.envio.para.join(', ')}: {aberto.envio.enviados.join(', ')}</p>}
              </div>
            </div>
          )}
        </JanelaLateral>
      )}
    </section>
  );
}
