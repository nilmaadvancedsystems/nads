// Delegadas por mim reestruturada (a novidade 'delegadas-por-pessoa'; 23/11/2026: "Dá uma reestruturada nesse painel de delegadas
// por mim, quero tambem uma opção de ver dados de tarefas delegadas por usuario"). Em cima, Lista / Por pessoa (o Segmentado).
// A Lista: uma tabela só, com os grupos do prazo nas linhas de grupo (o cabeçalho não se repete), o nome da tarefa e do cliente
// quebrando em vez de cortar, a pessoa numa linha só e o sino na coluna dele, no fim. O Por pessoa: os números de cima e uma linha
// por pessoa; clicar na pessoa volta para a Lista só com as tarefas dela.
import { BotaoIcone, Icone, LogoExcel, MenuSuspenso, Segmentado, Vazio } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { SeloDaPrioridade, SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import type { useCentralDeTarefas } from '../../delegador/useCentralDeTarefas';
import { useDelegadasPorPessoa } from '../../delegador/useDelegadasPorPessoa';
import type { PessoaComFoto } from '../useInicioNovo';
import { Foto } from './PainelDoInicio';

const TOM: Record<string, 'warn' | 'info' | 'neutral' | 'ok'> = { pendente: 'warn', andamento: 'info', pausada: 'neutral', concluida: 'ok', cancelada: 'neutral' };
type Modo = 'lista' | 'pessoas';
type Linha = ReturnType<typeof useCentralDeTarefas>['grupos'][number]['linhas'][number];

/**
 * A tarefa na coluna Tarefa (23/11/2026: "Deixa mais bonitinho essa apresentacao, de empresa, periodo e tarefa"): a que veio de uma
 * etapa mostra só o nome da etapa, com o período embaixo, menor e cinza (o título e a linha de baixo do cartão Delegadas do Início).
 */
export function TituloDaLinha({ l, abrir }: { l: Linha; abrir: (id: string) => void }) {
  return <>
    <button type="button" className="ini-abrir" title={l.titulo} onClick={e => { e.stopPropagation(); abrir(l.id); }}>{l.partes.titulo}</button>
    {l.partes.periodo && <><br /><span className="hint">{l.partes.periodo}</span></>}
  </>;
}

/** O cliente: o código em destaque e o nome ao lado (com mais clientes, o +N). */
export function ClienteDaLinha({ l }: { l: Linha }) {
  if (!l.cliente) return <>—</>;
  return <>
    {l.clienteCodigo != null ? <><span className="ini-empresa">{l.clienteCodigo}</span> {l.clienteNome}</> : <span className="ini-empresa">{l.clienteNome}</span>}
    {(l.maisClientes ?? 0) > 0 && <span className="fraco"> +{l.maisClientes}</span>}
  </>;
}

export function DelegadasPorMim({ vm, abrir, comFoto, cobrarLigado, discreta, lugarDosFiltros, lugarDoFim }: {
  vm: ReturnType<typeof useCentralDeTarefas>;
  abrir: (id: string) => void; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto;
  cobrarLigado: boolean; discreta: boolean;
  lugarDosFiltros?: HTMLElement | null; lugarDoFim?: HTMLElement | null;
}) {
  const [modo, setModo] = useState<Modo>('lista');
  const filtros = (
    <>
      <Segmentado<Modo> valor={modo} onMudar={setModo} opcoes={[{ valor: 'lista', rotulo: 'Lista' }, { valor: 'pessoas', rotulo: 'Por pessoa' }]} />
      {modo === 'lista' && !vm.abaVazia && <>
        <MenuDeFiltro rotulo="Prioridade" valor={vm.prioridade} mudar={vm.setPrioridade} todos="Todas as prioridades" opcoes={vm.opcoesDePrioridade} />
        {vm.pessoas.length > 0 && <MenuDeFiltro rotulo={vm.colunaDaPessoa} valor={vm.quem} mudar={vm.setQuem} todos="Todas as pessoas" opcoes={vm.pessoas} />}
        {vm.algumFiltro && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar</button>}
      </>}
    </>
  );
  const planilha = modo === 'lista' && !vm.abaVazia && (
    <MenuSuspenso rotulo={<LogoExcel />} semSeta className="icon-btn" titulo="Exportar a lista" dica="Exportar a lista" direita
      itens={[
        { rotulo: 'Planilha do Excel (.xlsx)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('xlsx') },
        { rotulo: 'Texto separado (.csv)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('csv') },
      ]} />
  );
  return (
    <section className="ini-lista">
      {lugarDosFiltros && lugarDoFim ? <>{createPortal(filtros, lugarDosFiltros)}{createPortal(planilha, lugarDoFim)}</> : (
        <div className="tarefas-barra-topo">{filtros}<span className="tarefas-barra-espaco" />{planilha}</div>
      )}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {modo === 'lista'
        ? <Lista vm={vm} abrir={abrir} comFoto={comFoto} cobrarLigado={cobrarLigado} discreta={discreta} />
        : <PorPessoa abrir={abrir} comFoto={comFoto} verDaPessoa={nome => { vm.limparFiltros(); vm.setQuem(nome); setModo('lista'); }} />}
    </section>
  );
}

function Lista({ vm, abrir, comFoto, cobrarLigado, discreta }: {
  vm: ReturnType<typeof useCentralDeTarefas>; abrir: (id: string) => void; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto;
  cobrarLigado: boolean; discreta: boolean;
}) {
  if (!vm.carregando && !vm.temLinhas) return (
    <section className="card">
      <Vazio icone={vm.abaVazia ? 'checkCircle' : 'search'} titulo={vm.vazio.titulo} texto={vm.vazio.texto}>
        {!vm.abaVazia && <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar os filtros</button>}
      </Vazio>
    </section>
  );
  return (
    <section className="card ini-grupo">
      <div className="table-wrap">
        <table className="table-compact fc-tabela ini-delegadas">
          <thead>
            <tr><th>Tarefa</th><th>Prazo</th><th>Situação</th><th>Prioridade</th><th>Cliente</th><th>Responsável</th><th aria-label="Cobrança" /></tr>
          </thead>
          <tbody>
            {vm.grupos.map(g => [
              // o grupo do prazo na linha de grupo (o mesmo da Calculadora do Simples), com quantas tem
              <tr key={'g-' + g.id} className="fc-grupo"><th colSpan={7} scope="colgroup">{g.rotulo || 'Tarefas'}<span> · {g.linhas.length}</span></th></tr>,
              ...g.linhas.map(l => (
                <tr key={l.id} className="ini-tr" onClick={() => abrir(l.id)} title="Abrir a tarefa">
                  <td><TituloDaLinha l={l} abrir={abrir} /></td>
                  <td className={'ini-delegadas-curta' + (l.atrasada ? ' tdl-atrasada' : '')}>{l.prazoCurto || '—'}</td>
                  <td className="ini-delegadas-curta"><SeloDoStatus rotulo={l.status.rotulo} tom={TOM[l.status.valor] || 'neutral'} /></td>
                  <td className="ini-delegadas-curta"><SeloDaPrioridade valor={l.prioridade.valor} rotulo={l.prioridade.rotulo} /></td>
                  <td title={l.clientes}><ClienteDaLinha l={l} /></td>
                  <td className="ini-delegadas-curta"><span className="ini-pessoa"><Foto p={comFoto(l.responsavel)} />{l.responsavel.nome}</span></td>
                  <td className="ini-delegadas-sino" onClick={e => e.stopPropagation()}>
                    {cobrarLigado && l.cobranca === 'cobrada' && <span className="ini-sino" title={l.dicaDaCobranca}><Icone nome="sino" />{!discreta && 'Cobrada'}</span>}
                    {cobrarLigado && l.cobranca === 'esperando' && <span className="ini-sino" title="Você cobrou uma atualização: esperando a resposta"><Icone nome="sino" /></span>}
                    {cobrarLigado && l.cobranca === 'cobrar' && <BotaoIcone pequeno className="ini-sino-cobrar" icone="sino" titulo={'Cobrar uma atualização de ' + l.responsavel.nome} onClick={() => { void vm.cobrar(l.id); }} />}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Um número de cima (a peça stat). */
function Numero({ rotulo, valor, dica }: { rotulo: string; valor: ReactNode; dica?: string }) {
  return <div className="stat" title={dica}><p className="stat-label">{rotulo}</p><p className="stat-value">{valor}</p></div>;
}

function PorPessoa({ abrir, comFoto, verDaPessoa }: { abrir: (id: string) => void; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto; verDaPessoa: (nome: string) => void }) {
  const vm = useDelegadasPorPessoa();
  if (!vm.carregando && !vm.pessoas.length) return (
    <section className="card"><Vazio icone="equipe" titulo="Nada delegado ainda" texto="Quando você passar tarefas para outras pessoas, os números de cada uma aparecem aqui." /></section>
  );
  const r = vm.resumo;
  return (
    <>
      <div className="stat-grid">
        <Numero rotulo="Em aberto agora" valor={r.abertas} />
        <Numero rotulo="Atrasadas agora" valor={r.atrasadas} />
        <Numero rotulo={'Concluídas · ' + vm.rotuloDoPeriodo.toLowerCase()} valor={r.concluidas} />
        <Numero rotulo="Concluídas no prazo" valor={r.noPrazo} dica="Das concluídas no período que tinham prazo" />
      </div>
      <section className="card ini-grupo">
        <div className="card-head">
          <h3>Por pessoa</h3>
          <span className="card-head-ctl">
            <MenuSuspenso icone="calendar" className="btn btn-outline" rotulo={vm.rotuloDoPeriodo} titulo="Período" direita
              itens={vm.periodos.map(p => ({ rotulo: p.rotulo, marcado: p.valor === vm.periodo, onClick: () => vm.setPeriodo(p.valor) }))} />
          </span>
        </div>
        <p className="hint ini-delegadas-dica">Em aberto e atrasadas são de agora; o resto é do período. Os tempos são médias e contam só o expediente.</p>
        <div className="table-wrap">
          <table className="table-compact ini-delegadas">
            <thead>
              {/* os três tempos sob um título só (o cabeçalho de grupo do 13º do DP) */}
              <tr className="dp-cabeca-grupo"><th colSpan={5} /><th colSpan={3} className="dp-ob-grupo">Tempo médio até</th><th colSpan={3} /></tr>
              <tr>
                <th>Pessoa</th><th className="num">Em aberto</th><th className="num">Atrasadas</th><th className="num">Concluídas</th><th className="num">No prazo</th>
                <th className="num" title="Da criação até abrir a tarefa">Ver</th><th className="num" title="Da criação até começar">Iniciar</th>
                <th className="num" title="Da criação até concluir">Concluir</th><th className="num" title="O cronômetro: o tempo em andamento">Trabalhado</th>
                <th className="num">Cobranças</th><th title="A tarefa em aberto parada há mais tempo (pendente ou pausada)">Parada</th>
              </tr>
            </thead>
            <tbody>
              {vm.pessoas.map(p => (
                <tr key={p.pessoa.uid} className="ini-tr" onClick={() => verDaPessoa(p.pessoa.nome)} title={'Ver as tarefas de ' + p.pessoa.nome}>
                  <td className="ini-delegadas-curta"><span className="ini-pessoa"><Foto p={comFoto(p.pessoa)} />{p.pessoa.nome}</span></td>
                  <td className="num" title={p.emAndamento + ' em andamento'}>{p.abertas}</td>
                  <td className={'num' + (p.atrasadas ? ' tdl-atrasada' : '')}>{p.atrasadas}</td>
                  <td className="num">{p.concluidas}</td>
                  <td className={'num' + (p.foraDoPrazo ? ' tdl-atrasada' : '')}>{p.noPrazoTexto}</td>
                  <td className="num">{p.ateVerTexto}</td>
                  <td className="num">{p.ateIniciarTexto}</td>
                  <td className="num">{p.ateConcluirTexto}</td>
                  <td className="num">{p.trabalhadoTexto}</td>
                  <td className="num" title={p.cobrancasDica}>{p.cobrancas}{p.adiamentos > 0 && <span className="fraco"> · +{p.minutosPedidos} min</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {p.parada
                      ? <><button type="button" className="ini-abrir" onClick={() => abrir(p.parada!.id)}>{p.parada.titulo}</button><span className="hint"> · {p.parada.ha}</span></>
                      : <span className="fraco">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
