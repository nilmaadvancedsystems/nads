// A etapa Clientes da Tarefa (Vitor, 06/10/2026), com as peças do catálogo: as etapas no Segmentado com o Próximo à
// direita; os arquivos na linha da Importação (o ícone de importar; importado, o check que vira × e tira); o saldo credor
// e os clientes em tabela; o selo de cada cliente troca entre o saldo e Conferido (os dois em laranja; o Ok é do sistema), e o
// conferido abre a observação; o envio com a planilha, o e-mail e o WhatsApp. Só o balancete dinâmico (Vitor, 06/10/2026).
import { Alerta, Icone, LogoGmail, LogoWhatsApp, MenuSuspenso, Segmentado } from '@nads/ui';
import { useRef } from 'react';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../../comum/BotaoDeTeste';
import { useClientes, type FiltroClientes, type TelaClientes } from './useClientes';

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
  return (
    <div className="imp-lista">
      <LinhaDoArquivo titulo="Balancete dinâmico" dica={'O balancete dinâmico atualizado, com ' + vm.mes} feito={vm.dinamico} onArquivo={vm.importar} onTirar={vm.tirar} teste={vm.teste} />
    </div>
  );
}

function LinhaDoArquivo({ titulo, dica, feito, onArquivo, onTirar, teste }: {
  titulo: string; dica: string; feito: { nome: string; resumo: string } | null; onArquivo: (f: File | undefined) => void; onTirar: () => void; teste: ItemDeTeste[];
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
              <tr key={l.codigo}>
                <td>{l.codigo}</td>
                <td className="wrap">
                  {l.nome}{l.doMesAnterior && <> <span className="badge badge-neutral" title="Conferido no mês anterior: revise">do mês anterior</span></>}
                  {/* o que o razão achou: as notas em aberto (vão para o cliente), as devoluções e a duplicidade */}
                  {l.razao && (
                    <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                      {l.razao.notas ? 'Em aberto: ' + l.razao.notas : 'Nenhuma nota em aberto'}
                      {l.razao.devolucoes && ' · Devoluções ' + l.razao.devolucoes}
                      {l.razao.duplicadas && <> · <span className="ext-neg">Recebida em duplicidade: {l.razao.duplicadas}</span></>}
                      {l.razao.naoBate && <> · <span className="ext-neg">O razão fecha em {l.razao.naoBate}</span></>}
                    </span>
                  )}
                  {/* o conferido abre a observação (vai para o cliente) */}
                  {l.situacao === 'conferido' && (
                    <input key={l.obs} type="text" aria-label={'Observação de ' + l.nome} placeholder="Observação para o cliente" defaultValue={l.obs}
                      style={{ display: 'block', width: '100%', marginTop: 6 }}
                      onBlur={e => { if (e.target.value.trim() !== l.obs) vm.observar(l.codigo, e.target.value); }}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                  )}
                </td>
                <td>
                  {/* Saldo ↔ Conferido, os dois em laranja; o Ok é do sistema (a conta zerada) e não é botão (Vitor, 06/10/2026) */}
                  {l.situacao === 'ok' ? <span className="badge badge-ok">Ok</span> : (
                    <button type="button" className="badge badge-warn" disabled={!vm.carregado} onClick={() => vm.clicar(l.codigo)} style={{ cursor: 'pointer' }}
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
            ))}
            {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nenhum cliente neste filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
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
