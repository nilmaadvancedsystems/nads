// DP › Envios (27/10/2026: "uma aba de envios, onde vai ser enviado para o gmail do cliente arquivos que já foram
// arquivados nas pastas dos clientes… com um clique de botão num formato padrão via VM do google"). Como o FGTS Digital:
// os filtros numa linha; a tabela com os documentos do mês que estão na pasta, os e-mails do cadastro e o envio como selo;
// na linha, Enviar (ou Enviar de novo); clicar no cliente ou nos arquivos abre a janela dele, com os arquivos do mês (desmarcar
// algum, ou "Enviar só este") e o que já foi enviado, de todos os meses (28/10/2026).
// Em cima, Enviar todos os prontos (com a confirmação: são e-mails para muitos clientes de uma vez).
// 28/10/2026 ("com seleção de quais vou enviar, no estilo do fgts"): o painel do robô do FGTS (o progresso do mês, Agora e
// Na fila), a caixinha de cada cliente com Enviar marcadas, e o Modelo do e-mail (como o E-mail ao cliente da NFS-e).
import { BotaoAcao, ConfigLinha, ConfigSecao, Esqueleto, Icone, MenuSuspenso, NumeroQueConta, SeletorMes, useCarregando, useEntradaAnimada } from '@nads/ui';
import { useState } from 'react';
import { JanelaLateral } from '../janela/JanelaLateral';
import { JanelaDoLote } from './JanelaDoLote';
import { MenuDeFiltro } from './MenuDeFiltro';
import { situacaoDoEnvio, useEnviosDoDp, type FiltroDoEnvio, type SituacaoDoEnvio } from './useEnviosDoDp';

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
  // o aviso do campo de e-mail da janela ("E-mail inválido.")
  const [erroDoEmail, setErroDoEmail] = useState('');
  const [loteAberto, setLoteAberto] = useState(false);
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

      {/* o robô agora, como o do FGTS: o progresso do mês, com quem está e a fila */}
      <section className="card fgts-robo-painel">
        <div className="fgts-robo-cabeca">
          <h3 className="dp-titulo">Robô</h3>
          <span className="tarefas-barra-espaco" />
          <span className="hint"><b className="num"><NumeroQueConta texto={String(vm.progresso.enviados)} /></b> de <b className="num">{vm.progresso.total}</b> com arquivos enviados em {mes}</span>
        </div>
        <span className="tarefas-barra fgts-barra" role="progressbar" aria-valuemin={0} aria-valuemax={vm.progresso.total} aria-valuenow={vm.progresso.enviados} aria-label="Clientes com os documentos enviados">
          <span style={{ width: (vm.progresso.total ? Math.min(100, (vm.progresso.enviados / vm.progresso.total) * 100) : 0) + '%' }} />
        </span>
        <div className="fgts-robo-agora">
          <span className="hint fgts-robo-rotulo">Agora</span>
          {vm.roboAgora ? (
            <>
              <span className="num fraco">{vm.roboAgora.codigo}</span>
              <b>{vm.roboAgora.nome}</b>
              <span className={SELO.enviando.classe}>{SELO.enviando.rotulo}</span>
              <span className="fraco">{hora(vm.roboAgora.desde)}</span>
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
          <h3 className="dp-titulo">Envios de {mes}</h3>
          <span className="badge badge-neutral">{vm.linhas.length}</span>
          <span className="hint">{c.enviados} {c.enviados === 1 ? 'enviado' : 'enviados'} · {c.prontos} {c.prontos === 1 ? 'pronto' : 'prontos'}</span>
          <span className="tarefas-barra-espaco" />
          {/* o lote (28/10/2026: "subo um lote de arquivos, esses arquivos são lidos e organizados para dispará-los em lote") */}
          <button type="button" className="btn btn-outline" onClick={() => setLoteAberto(true)}><Icone nome="upload" />Subir lote</button>
          <button type="button" className="btn btn-outline" onClick={() => vm.setEditandoModelo(true)}><Icone nome="envelope" />Modelo do e-mail</button>
          {vm.marcadas > 0 ? (
            <BotaoAcao carregando={vm.enviandoTodos} textoCarregando="Pedindo…" onClick={() => void vm.enviarMarcadas()}>
              <Icone nome="aviao" />Enviar marcadas · {vm.marcadas}
            </BotaoAcao>
          ) : (
            <BotaoAcao carregando={vm.enviandoTodos} textoCarregando="Pedindo…" disabled={!vm.prontos} onClick={() => void vm.enviarTodos()}>
              <Icone nome="aviao" />Enviar todos os prontos{vm.prontos ? ' · ' + vm.prontos : ''}
            </BotaoAcao>
          )}
        </div>
        {vm.carregando ? <Esqueleto linhas={8} /> : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
          <div className="table-wrap" ref={tabela}>
            <table className="dp-tabela fgts-tabela">
              <thead>
                <tr><th className="fgts-marca"><input type="checkbox" checked={vm.todasMarcadas} onChange={e => vm.marcarTodas(e.target.checked)} aria-label="Marcar todas" title="Marcar todas da tela" /></th><th>Cód.</th><th>Cliente</th><th>Responsável</th><th>Arquivos do mês</th><th>E-mail</th><th>Envio</th><th /></tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => {
                  const selo = SELO[l.situacao];
                  const e = l.envio;
                  return (
                    <tr key={l.codigo} className={'dp-linha' + (l.situacao === 'enviado' ? ' feita' : '')}>
                      <td className="fgts-marca">
                        <input type="checkbox" checked={vm.marcada(l.codigo)} disabled={!l.podeMarcar} onChange={() => vm.alternarMarca(l.codigo)} aria-label={'Marcar ' + l.nome} />
                      </td>
                      <td className="num fraco">{l.codigo}</td>
                      <td className="dp-cliente">
                        <button type="button" className="fgts-situacao dp-envio-cliente" title={'Arquivos e envios de ' + l.nome} onClick={() => vm.abrir(l.codigo, l.arquivos.length ? 'arquivos' : 'enviados')}>
                          <span className="dp-cliente-nome">{l.nome}</span>
                        </button>
                      </td>
                      <td>{l.responsavel || <span className="fraco">—</span>}</td>
                      <td>
                        {l.arquivos.length ? (
                          <button type="button" className="fgts-situacao dp-envio-qtd" title={l.arquivos.map(a => a.nome).join('\n')} onClick={() => vm.abrir(l.codigo)}>
                            <Icone nome="clipe" />
                            <span>{l.escolhidos.length < l.arquivos.length ? l.escolhidos.length + ' de ' + l.arquivos.length : l.arquivos.length} {l.arquivos.length === 1 ? 'arquivo' : 'arquivos'}</span>
                          </button>
                        ) : <span className="fraco">—</span>}
                      </td>
                      <td className="fraco">
                        {/* mudar o e-mail daqui (28/10/2026: "mudar o gmail do cliente direto do envios") */}
                        <button type="button" className="fgts-situacao dp-envio-email" title={(l.emails.join('\n') || 'Sem e-mail') + ' · mudar o e-mail'} onClick={() => vm.abrir(l.codigo, 'email')}>
                          {l.emails.length ? <span>{l.emails[0]}{l.emails.length > 1 ? ' +' + (l.emails.length - 1) : ''}</span> : <span className="badge badge-parada">Pôr e-mail</span>}
                          <Icone nome="lapis" />
                        </button>
                      </td>
                      <td>
                        {e ? (
                          <button type="button" className="fgts-situacao" title={(e.erro || (e.para.length ? 'para ' + e.para.join(', ') : ''))
                            // só parte dos arquivos do mês foi (30/10/2026): ainda não é Enviado
                            + (l.jaEnviados.enviados && !l.jaEnviados.completo ? ' · ' + l.jaEnviados.enviados + ' de ' + l.jaEnviados.total + ' arquivos já enviados' : '')
                            + ' · ver o que já foi enviado'} onClick={() => vm.abrir(l.codigo, 'enviados')}>
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
        <JanelaLateral rotulo={aberto.nome} topico={vm.aba} mudar={vm.setAba} fechar={vm.fechar} classe="fgts-janela"
          topicos={[
            { id: 'arquivos', rotulo: 'Arquivos do mês', icone: 'clipe', contador: aberto.arquivos.length },
            { id: 'enviados', rotulo: 'Enviados', icone: 'aviao', contador: vm.historico?.length ?? 0 },
            { id: 'email', rotulo: 'E-mail', icone: 'envelope', alerta: !aberto.emails.length },
          ]}
          resumo={<div className="usuario-quem"><span className="emp-cod">{aberto.codigo}</span><b>{aberto.nome}</b></div>}>
          {vm.aba === 'arquivos' ? (
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
                      {/* um documento só (28/10/2026: "a opção de enviar um único documento") */}
                      <BotaoAcao className="btn btn-ghost dp-envio-um" disabled={!vm.podeEnviar(aberto.codigo)} carregando={vm.fazendo('enviar:' + aberto.codigo + ':' + a.id)} textoCarregando="Pedindo…"
                        onClick={() => void vm.enviarArquivo(aberto.codigo, a.id)}><Icone nome="aviao" />Enviar só este</BotaoAcao>
                    </li>
                  ))}
                </ul>
              ) : <p className="hint">Nenhum documento do DP de {mes} na pasta do cliente.</p>}
              <p className="fraco">Para: {aberto.emails.length ? aberto.emails.join(', ') : 'sem e-mail no cadastro'} · <button type="button" className="link-btn" onClick={() => vm.setAba('email')}>mudar</button></p>
              {aberto.arquivos.length > 0 && (
                <BotaoAcao className="btn btn-primary" disabled={!aberto.escolhidos.length || !vm.podeEnviar(aberto.codigo)} carregando={vm.fazendo('enviar:' + aberto.codigo)} textoCarregando="Pedindo…" onClick={() => void vm.enviar(aberto.codigo)}>
                  <Icone nome="aviao" />{'Enviar os marcados · ' + aberto.escolhidos.length + (aberto.escolhidos.length === 1 ? ' arquivo' : ' arquivos')}
                </BotaoAcao>
              )}
            </div>
          ) : vm.aba === 'email' ? (
            <ConfigSecao titulo="E-mail do cliente">
              <ConfigLinha titulo="E-mail do cadastro" descricao="O mesmo de Cadastro › Dados da empresa: é para onde os envios vão. Vazio tira." aviso={erroDoEmail || undefined}>
                <input key={'email|' + aberto.codigo + '|' + aberto.emailDoCadastro} type="email" className="nf-entrada largo" aria-label={'E-mail de ' + aberto.nome}
                  defaultValue={aberto.emailDoCadastro} placeholder="nome@empresa.com.br" autoFocus
                  onBlur={e => setErroDoEmail(vm.definirEmail(aberto.codigo, e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </ConfigLinha>
              {aberto.emailsDoEntregas.length > 0 && (
                <ConfigLinha titulo="No cadastro do Entregas" descricao={aberto.emailDoCadastro ? 'Não são usados: vale o e-mail do cadastro acima.' : 'Usados enquanto o cadastro acima estiver sem e-mail.'}>
                  <span className="cfg-valor">{aberto.emailsDoEntregas.join(', ')}</span>
                </ConfigLinha>
              )}
            </ConfigSecao>
          ) : (
            <div className="card">
              <h3>O que já foi enviado</h3>
              {vm.historico == null ? <Esqueleto linhas={3} /> : !vm.historico.length ? <p className="hint">Nada enviado para este cliente ainda.</p> : (
                <ul className="dp-envio-historico">
                  {vm.historico.map(e => {
                    const sit = SELO[situacaoDoEnvio(e, 1, 1)];
                    return (
                      <li key={e.id}>
                        <div className="dp-envio-historico-topo">
                          <span className={sit.classe}>{sit.rotulo}</span>
                          <b>{e.competencia.split('-').reverse().join('/')}</b>
                          <span className="fraco">{hora(e.enviadoEm || e.criadoEm)} · pedido por {e.criadoPor || '—'}</span>
                        </div>
                        {e.erro && <p className="fgts-pedido-erro">{e.erro}</p>}
                        {e.status === 'enviado' && (
                          <>
                            <p className="fraco">Para {e.para.join(', ')}</p>
                            <ul className="dp-envio-historico-arquivos">{e.enviados.map(n => <li key={n}><Icone nome="clipe" />{n}</li>)}</ul>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </JanelaLateral>
      )}
      {loteAberto && <JanelaDoLote fechar={() => setLoteAberto(false)} />}

      {vm.editandoModelo && (
        <JanelaLateral rotulo="Modelo do e-mail" topicos={[{ id: 'modelo', rotulo: 'E-mail ao cliente', icone: 'envelope' }]} topico="modelo" mudar={() => undefined}
          fechar={() => vm.setEditandoModelo(false)} classe="fgts-janela" resumo={<div className="usuario-quem"><b>DP › Envios</b></div>}>
          <ConfigSecao titulo="E-mail ao cliente">
            <ConfigLinha titulo="Assunto" descricao="Pode usar {cliente}, {competencia} e {mes}. Vazio volta ao padrão.">
              <input key={'assunto|' + vm.modelo.assunto} type="text" className="nf-entrada largo" aria-label="Assunto do e-mail" maxLength={200}
                defaultValue={vm.modelo.assunto} placeholder={vm.modelo.padrao.assunto}
                onBlur={e => { if (e.target.value.trim() !== vm.modelo.assunto) void vm.gravarModelo({ assunto: e.target.value, texto: vm.modelo.texto }); }} />
            </ConfigLinha>
            <ConfigLinha titulo="Texto" descricao="O mesmo vale aqui: {cliente}, {competencia} e {mes}. A lista dos arquivos vai depois, no cartão dos anexos. Vazio volta ao padrão.">
              <textarea key={'texto|' + vm.modelo.texto} className="nf-entrada nf-texto largo" rows={8} aria-label="Texto do e-mail" maxLength={5000}
                defaultValue={vm.modelo.texto} placeholder={vm.modelo.padrao.texto}
                onBlur={e => { if (e.target.value.trim() !== vm.modelo.texto) void vm.gravarModelo({ assunto: vm.modelo.assunto, texto: e.target.value }); }} />
            </ConfigLinha>
          </ConfigSecao>
          <div className="card">
            <h3>Prévia</h3>
            <div className="dp-envio-previa">
              <b>{vm.previa.assunto}</b>
              <p>{vm.previa.texto}</p>
            </div>
          </div>
        </JanelaLateral>
      )}
    </section>
  );
}
