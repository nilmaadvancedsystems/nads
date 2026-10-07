// A etapa Clientes da Tarefa (Vitor, 06/10/2026), com as peças do catálogo: as etapas no Segmentado com o Próximo à
// direita; os arquivos na linha da Importação (o ícone de importar; importado, o check que vira × e tira); o saldo credor
// e os clientes em tabela; o selo de cada cliente troca entre o saldo e Conferido (os dois em laranja; o Ok é do sistema), e o
// conferido abre a observação; o envio com a planilha, o e-mail e o WhatsApp. Só o balancete dinâmico (Vitor, 06/10/2026).
import { Alerta, Icone, LogoGmail, LogoWhatsApp, MenuSuspenso, Segmentado } from '@nads/ui';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { useClientes, type FiltroClientes, type TelaClientes } from './useClientes';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';

type VM = ReturnType<typeof useClientes>;

export function Clientes() {
  const vm = useClientes();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Clientes</h2></div></header>
      <div className="tarefas-barra-topo">
        <Segmentado<TelaClientes> valor={vm.tela} onMudar={vm.irPara} opcoes={vm.telas} />
        <span className="tarefas-barra-espaco" />
        {vm.temProxima && <button type="button" className="btn btn-primary" disabled={!vm.podeSeguir} onClick={vm.proximo}>Próximo</button>}
        {/* no Envio, as saídas na linha das etapas (Vitor, 06/10/2026) */}
        {vm.tela === 'envio' && vm.conferidos.length > 0 && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={vm.baixarPlanilha}><Icone nome="download" />Baixar planilha</button>
            <a className="btn" href={vm.email} target="_blank" rel="noreferrer"><LogoGmail />E-mail</a>
            <a className="btn" href={vm.whatsapp} target="_blank" rel="noreferrer"><LogoWhatsApp />WhatsApp</a>
          </div>
        )}
      </div>
      {vm.tela === 'arquivos' && <Arquivos vm={vm} />}
      {vm.tela === 'credor' && <Credor vm={vm} />}
      {vm.tela === 'clientes' && <ListaDeClientes vm={vm} />}
      {vm.tela === 'envio' && <Envio vm={vm} />}
    </section>
  );
}

function Arquivos({ vm }: { vm: VM }) {
  // a primeira coluna (os clientes) encolhe um pouco quando há mais meses, para os 12 caberem (Vitor, 07/10/2026)
  const grade = useColunaAjustavel('clientes-credores', Math.max(18, 30 - vm.mesesDosCredores.length) + '%', vm.mesesDosCredores.length);
  return (
    <div className="imp-lista">
      <LinhaDoArquivo titulo="Balancete dinâmico" dica={'O balancete dinâmico atualizado, com ' + vm.mes} feito={vm.dinamico} onArquivo={vm.importar} onTirar={vm.tirar} teste={vm.teste}>
        {/* importado: os credores em algum mês, na grade dos meses do Caixa (Vitor, 07/10/2026); o mês credor em vermelho */}
        {vm.dinamico && vm.credoresNoPeriodo.length > 0 && (
          <div className="imp-periodo-linha">
            <table className="imp-meses" style={grade.tabela}>
              <colgroup><col style={{ width: grade.largura }} /></colgroup>
              <thead>
                <tr>
                  <th scope="col">Credores em algum mês ({vm.credoresNoPeriodo.length}){grade.alca}</th>
                  {vm.mesesDosCredores.map(m => <th key={m} scope="col">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {vm.credoresNoPeriodo.map(c => (
                  <tr key={c.codigo}>
                    <th scope="row" style={{ textAlign: 'left' }} title={c.codigo + ' — ' + c.nome}><b>{c.codigo}</b> — {c.nome}</th>
                    {c.saldos.map(x => <td key={x.mes} className={'num' + (x.credor ? ' ext-neg' : '')} title={x.credor ? 'Credor neste mês' : undefined}>{x.valor === '—' ? x.valor : <ValorNaGrade texto={x.valor} />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LinhaDoArquivo>
    </div>
  );
}

function LinhaDoArquivo({ titulo, dica, feito, onArquivo, onTirar, teste, children }: {
  titulo: string; dica: string; feito: { nome: string; resumo: string } | null; onArquivo: (f: File | undefined) => void; onTirar: () => void; teste: ItemDeTeste[];
  children?: ReactNode;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <div className={'imp-bloco' + (feito ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <span className="imp-ico imp-logo"><Icone nome="fileText" /></span>
        <div className="imp-txt"><span><b>{titulo}</b><span className="imp-conta">{feito ? feito.nome : dica}</span></span></div>
        <div className="imp-resumo">{feito && <div><span>{feito.resumo}</span></div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo">
            {feito ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onTirar} title={'Importado: ' + feito.nome + '. Clique para tirar.'} aria-label={'Tirar o ' + titulo.toLowerCase()}>
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : (
              <>
                <BotaoDeTeste itens={teste} />
                <button type="button" className="icon-btn icon-btn-sm imp-btn" title={'Importar o ' + titulo.toLowerCase()} aria-label={'Importar o ' + titulo.toLowerCase()} onClick={() => arquivo.current?.click()}>
                  <Icone nome="upload" />
                </button>
                <input ref={arquivo} type="file" accept=".xls,.xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
                  onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; onArquivo(f); }} />
              </>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Credor({ vm }: { vm: VM }) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* o Reimportar no próprio aviso (Vitor, 06/10/2026): o dinâmico novo substitui o anterior */}
      <div className="alerta-linha">
        <Alerta titulo={vm.credores.length + (vm.credores.length === 1 ? ' cliente com saldo credor' : ' clientes com saldo credor')}
          texto="Corrija estes no Alterdata primeiro e reimporte o balancete dinâmico.">
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => arquivo.current?.click()}><Icone nome="upload" />Reimportar</button>
            <input ref={arquivo} type="file" accept=".xls,.xlsx,.csv" className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importar(f); }} />
          </div>
        </Alerta>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Cliente</th><th className="num">Saldo</th></tr></thead>
          <tbody>
            {vm.credores.map(k => (
              <tr key={k.codigo}><td>{k.codigo}</td><td className="wrap">{k.nome}</td><td className="num ext-neg">{k.saldo}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const ROTULO_FILTRO: Record<FiltroClientes, string> = { todos: 'Todos', pendente: 'Pendentes', ok: 'Ok', conferido: 'Conferidos' };

function ListaDeClientes({ vm }: { vm: VM }) {
  // um campo de arquivo só para a lista: guarda de qual conta é o razão
  const arquivo = useRef<HTMLInputElement>(null);
  const conta = useRef('');
  // a mini tabela do razão de cada cliente: aberta; a seta do lado da conta esconde
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (codigo: string) => setFechadas(f => { const n = new Set(f); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; });
  return (
    <>
      <input ref={arquivo} type="file" accept=".xls,.xlsx,.ods" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importarRazao(conta.current, f); }} />
      <div className="tarefas-barra-topo">
        <MenuSuspenso rotulo={ROTULO_FILTRO[vm.filtro]} className="btn btn-outline" dica="Filtrar os clientes"
          itens={(Object.keys(ROTULO_FILTRO) as FiltroClientes[]).map(f => ({
            rotulo: ROTULO_FILTRO[f] + ' (' + vm.contagem[f] + ')', marcado: vm.filtro === f, desabilitado: f !== 'todos' && !vm.contagem[f], onClick: () => vm.setFiltro(f),
          }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Cliente</th><th>Situação</th><th className="num">Razão</th></tr></thead>
          <tbody>
            {vm.linhas.map(l => (
              <Fragment key={l.codigo}>
              <tr>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {/* a seta do razão (Vitor, 07/10/2026): mostra ou esconde a relação embaixo */}
                  {l.razao && l.razao.itens.length > 0 && (
                    <button type="button" className={'imp-seta' + (fechadas.has(l.codigo) ? '' : ' aberta')} aria-expanded={!fechadas.has(l.codigo)}
                      title={fechadas.has(l.codigo) ? 'Ver a relação do razão' : 'Esconder a relação do razão'} aria-label={'A relação do razão de ' + l.nome} onClick={() => alternar(l.codigo)}>
                      <Icone nome="caretDown" />
                    </button>
                  )}
                  {l.codigo}
                </td>
                <td className="wrap">
                  {l.nome}{l.doMesAnterior && <> <span className="badge badge-neutral" title="Conferido no mês anterior: revise">do mês anterior</span></>}
                  {/* o razão que não bate com o balancete (as notas ficam na relação embaixo; Vitor, 07/10/2026) */}
                  {l.razao?.naoBate && <span className="hint ext-neg" style={{ display: 'block', marginTop: 2 }}>O razão fecha em {l.razao.naoBate}: confira se é desta conta</span>}
                  {/* o conferido abre a observação (vai para o cliente) */}
                  {l.situacao === 'conferido' && <Observacao nome={l.nome} obs={l.obs} objecoes={vm.objecoes} desabilitado={!vm.carregado} onMudar={t => vm.observar(l.codigo, t)} />}
                </td>
                <td>
                  {/* os selos do catálogo: o saldo (Diferença, SE-03) ↔ Conferido (SE-02); o Ok (SE-01) é do sistema e não é botão (Vitor, 06/10/2026) */}
                  {l.situacao === 'ok' ? <span className="badge badge-ok">Ok</span> : (
                    <button type="button" className={'badge ' + (l.situacao === 'pendente' ? 'badge-bad' : 'badge-conferido')} disabled={!vm.carregado} onClick={() => vm.clicar(l.codigo)} style={{ cursor: 'pointer' }}
                      title={l.situacao === 'pendente' ? 'Saldo em aberto. Clique: Conferido (vai para o cliente)' : 'Conferido (vai para o cliente). Clique: volta para o saldo'}>
                      {l.situacao === 'pendente' ? l.valor : 'Conferido'}
                    </button>
                  )}
                </td>
                {/* o razão da conta, no fim da linha (Vitor, 06/10/2026): importar; importado, o check que vira × e tira; Ok não tem */}
                <td className="num">
                  {l.situacao === 'ok' ? null : l.razao ? (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={!vm.carregado} onClick={() => vm.tirarRazao(l.codigo)}
                      title={'Razão importado: ' + l.razao.arquivo + '. Clique para tirar.'} aria-label={'Tirar o razão de ' + l.nome}>
                      <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                    </button>
                  ) : (
                    <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={!vm.carregado}
                      onClick={() => { conta.current = l.codigo; arquivo.current?.click(); }}
                      title={'Importar o razão da conta ' + l.codigo + ' (as notas em aberto vão para a relação do cliente)'} aria-label={'Importar o razão de ' + l.nome}>
                      <Icone nome="upload" />
                    </button>
                  )}
                </td>
              </tr>
              {l.razao && l.razao.itens.length > 0 && !fechadas.has(l.codigo) && (
                <tr>
                  <td />
                  <td colSpan={3}>
                    <div className="table-wrap">
                      <table className="table-compact">
                        <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th><th>Status</th></tr></thead>
                        <tbody>
                          {l.razao.itens.map((i, k) => (
                            <tr key={k}><td style={{ whiteSpace: 'nowrap' }}>{i.data}</td><td className="wrap">{i.descricao}</td><td className={'num' + (i.abate ? ' ext-neg' : '')}>{i.valor}</td>
                              <td><span className={'badge ' + (i.status === 'aberto' ? 'badge-warn' : 'badge-neutral')}>{i.rotulo}</span></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * A observação do conferido (Vitor, 07/10/2026): o menu com as perguntas mais comuns e o lápis para escrever; o lápis
 * troca o menu pelo campo, com o check para guardar. Guardada, fica embaixo do nome com o check da importação (passou o
 * mouse, vira o × e apaga).
 */
function Observacao({ nome, obs, objecoes, desabilitado, onMudar }: {
  nome: string; obs: string; objecoes: readonly string[]; desabilitado: boolean; onMudar: (texto: string) => void;
}) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState('');
  const guardar = () => { if (texto.trim()) onMudar(texto); setEscrevendo(false); };
  if (obs) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {/* a mensagem para o cliente no balão (Vitor, 07/10/2026: "um feedback visual de que é uma mensagem") */}
        <span className="msg-balao" title="Mensagem para o cliente"><Icone nome="mensagem" />{obs}</span>
        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={desabilitado} onClick={() => onMudar('')}
          title="Observação guardada. Clique para apagar." aria-label={'Apagar a observação de ' + nome}>
          <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
        </button>
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
      {escrevendo ? (
        <>
          <input type="text" autoFocus aria-label={'Observação de ' + nome} placeholder="Observação para o cliente" value={texto}
            style={{ flex: 1, minWidth: 0 }} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEscrevendo(false); }} />
          <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={desabilitado || !texto.trim()} onClick={guardar}
            title="Guardar a observação" aria-label={'Guardar a observação de ' + nome}><Icone nome="check" /></button>
        </>
      ) : (
        <>
          <MenuSuspenso rotulo="Pergunta para o cliente" className="btn btn-outline" dica="Escolher uma pergunta pronta" largura={420}
            itens={objecoes.map(o => ({ rotulo: o, desabilitado, onClick: () => onMudar(o) }))} />
          <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={desabilitado} onClick={() => { setTexto(''); setEscrevendo(true); }}
            title="Escrever a observação" aria-label={'Escrever a observação de ' + nome}><Icone nome="lapis" /></button>
        </>
      )}
    </span>
  );
}

function Envio({ vm }: { vm: VM }) {
  if (!vm.conferidos.length) return <p className="hint">Nenhum cliente conferido: em Clientes, marque como Conferido o que vai para o cliente responder.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Conta</th><th>Cliente</th><th className="num">Saldo</th><th>Notas em aberto</th><th>Observação</th></tr></thead>
          <tbody>
            {vm.conferidos.map(l => (
              <tr key={l.codigo}><td>{l.codigo}</td><td className="wrap">{l.nome}</td><td className="num">{l.valor}</td><td className="wrap">{l.notas || '—'}</td><td className="wrap">{l.obs || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Mensagem para o cliente</h3></div>
        <div className="field">
          <label htmlFor="fMensagemClientes">Modelo ({'{empresa}'}, {'{mes}'} e {'{lista}'} viram os dados)</label>
          <textarea id="fMensagemClientes" rows={5} value={vm.mensagem} onChange={e => vm.mudarMensagem(e.target.value)} style={{ width: '100%' }} />
        </div>
        <p className="hint" style={{ whiteSpace: 'pre-wrap' }}>{vm.texto}</p>
      </div>
    </>
  );
}
