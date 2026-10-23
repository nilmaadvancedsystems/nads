// O fluxo operacional do Fiscal (23/10/2026: o documento "FLUXO OPERACIONAL DO DEPARTAMENTO FISCAL", "pode substituir
// o atual"), no lugar do executor de checklists para o Simples, o Presumido e o Real. Em três níveis, para não ter
// informação demais de uma vez (23/10/2026: "todos os menus têm muita informação"): na lateral, poucas fases (Abertura,
// Documentos, Apuração, Obrigações e guias, Fechamento); na página, as etapas do documento daquela fase em cartões
// fechados (só a da vez aberta; a concluída com o ✓, a travada com o cadeado); dentro da etapa, os subprocessos em
// grupos pequenos (até 4) com o nome curto. Cada linha tem só a caixinha (um clique conclui), o nome (abre o painel do
// nads, quando tem) e o ⋯ (os outros status e outro responsável); quem marcou e quando ficam na dica. O responsável vem
// do Fiscal da empresa no Cadastro, uma vez no topo. Só as peças do catálogo (Casca, MenuSuspenso, selo, Alerta, a barra
// de progresso, a faixa que abre).
import { tarefas as t } from '@nads/core';
import { Alerta, Casca, Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { useParams } from 'react-router';
import { useCascaTarefas } from '../../../casca/useCascaTarefas';
import { JanelaDeImportacao, useNumerosDoPainel } from '../partes/ChecklistDisfarcado';
import { PainelDaTarefa } from '../partes/PainelDaTarefa';
import { XmlsDoCliente } from '../partes/XmlsDoCliente';
import { ROTULO_DO_RELATORIO } from '../usePainelDoFiscal';
import { useFluxoDoFiscal, type VmFluxoDoFiscal } from './useFluxoDoFiscal';

const SELO: Record<t.StatusDoSubprocesso, string> = {
  pendente: 'badge-neutral', execucao: 'badge-warn', conferencia: 'badge-warn', aprovado: 'badge-ok', concluido: 'badge-ok', 'nao-aplicavel': 'badge-neutral',
};
const ROTULO = Object.fromEntries(t.STATUS_DO_SUBPROCESSO.map(s => [s.valor, s.rotulo])) as Record<t.StatusDoSubprocesso, string>;
const PERIODICIDADE: Record<t.Periodicidade, string> = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' };
const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function FluxoDoFiscal() {
  const { empresa: rota = '', competencia = '' } = useParams();
  const vm = useFluxoDoFiscal(rota, competencia);
  const casca = useCascaTarefas('fiscal', 'empresas');
  useCarregando(vm.carregando);
  useNumerosDoPainel(vm.painel, competencia, vm.valores, vm.informar);
  const secoes = vm.fases.map((f, i) => ({
    id: String(i), rotulo: f.nome, icone: (f.concluida ? 'checkCircle' : f.liberada ? 'list' : 'lock') as 'checkCircle' | 'list' | 'lock', grupo: 0,
    ativa: f.ativa, caixa: (f.concluida ? 'marcada' : 'vazia') as 'marcada' | 'vazia',
  }));
  return (
    <Casca sistema="Tarefas" temaNaGaveta={false} larga rotuloLateral="Fases do fluxo"
      empresa={vm.empresa ? { codigo: (vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : '') + vm.empresa.nome, nome: '' } : null}
      versao={casca.versao} secoes={secoes} paginas={[]} titulo=""
      onSecao={id => vm.escolherFase(Number(id))} onPagina={() => undefined} onInicio={vm.sair} onAplicativos={casca.inicio}
      onEmpresa={vm.abrirEmpresa} aplicativos={casca.aplicacoes} onAplicativo={casca.onAplicacao}>
      {vm.carregando ? null : !vm.empresa ? <p className="fraco">Empresa não encontrada.</p> : !vm.fluxo || !vm.fase ? (
        <p className="fraco">O regime desta empresa ainda não tem o fluxo novo.</p>
      ) : <Fase vm={vm} />}
      {vm.painel.importando && vm.empresa && <JanelaDeImportacao vm={vm.painel} empresa={vm.empresa.nome} codigo={String(vm.empresa.codigo ?? '')} competencia={vm.competencia} />}
    </Casca>
  );
}

function Fase({ vm }: { vm: VmFluxoDoFiscal }) {
  const f = vm.fase!;
  const pct = f.total ? Math.round((f.encerrados / f.total) * 100) : 100;
  return (
    <section className="fluxo">
      <header className="fluxo-topo">
        <div>
          <p className="fraco fluxo-caminho">{vm.fluxo!.nome} · {vm.rotuloCompetencia} · {vm.resumo.encerrados} de {vm.resumo.total} no mês</p>
          <h2>{f.nome}</h2>
          <p className="fluxo-resp-etapa">
            <Icone nome="usuario" width={14} height={14} />Responsável: <b>{vm.responsavelDaEtapaAtual}</b>
            {vm.pessoas.length > 0 && (
              <MenuSuspenso rotulo="trocar" className="btn btn-ghost btn-sm" titulo="Trocar o responsável de toda a fase" semSeta
                itens={vm.pessoas.map(p => ({ rotulo: p + (p === vm.responsavelDaEmpresa ? ' (da empresa)' : ''), marcado: p === vm.responsavelDaEtapaAtual, onClick: () => vm.trocarResponsavelDaEtapa(p) }))} />
            )}
          </p>
        </div>
        <div className="fluxo-topo-direita">
          <span className="card-head-ctl"><span className="tarefas-barra"><span style={{ width: pct + '%' }} /></span><span className="pt-contagem"><b>{f.encerrados}</b> de {f.total}</span></span>
          {vm.testes.length > 0 && (
            <MenuSuspenso rotulo="Dados de teste" icone="zap" titulo="As notas de teste do mês (modo desenvolvedor ou empresa de teste)" direita
              itens={vm.testes.map(o => ({ rotulo: o.rotulo, onClick: () => vm.usarTeste(o.id) }))} />
          )}
        </div>
      </header>
      <div className="fluxo-etapas">
        {f.etapas.map(e => <CartaoDaEtapa key={e.n} vm={vm} e={e} aberta={vm.etapa?.n === e.n} />)}
      </div>
    </section>
  );
}

function CartaoDaEtapa({ vm, e, aberta }: { vm: VmFluxoDoFiscal; e: t.EtapaNoMes; aberta: boolean }) {
  const faltam = e.subprocessos.length - e.encerrados;
  return (
    <div className={'fluxo-etapa' + (aberta ? ' aberta' : '') + (e.concluida ? ' concluida' : '') + (!e.liberada ? ' travada' : '')}>
      <button type="button" className="fluxo-etapa-topo" onClick={() => vm.abrirEtapa(e.n)} aria-expanded={aberta}>
        <span className={'fluxo-etapa-icone' + (e.concluida ? ' ok' : '')}>
          <Icone nome={e.concluida ? 'checkCircle' : !e.liberada ? 'lock' : aberta ? 'caretDown' : 'chevronRight'} width={16} height={16} />
        </span>
        <b>{e.nome}</b>
        {e.periodicidade !== 'mensal' && <span className="badge badge-neutral">{PERIODICIDADE[e.periodicidade]}</span>}
        <span className="fluxo-etapa-conta fraco">{e.concluida ? 'concluída' : !e.liberada ? 'espera a anterior' : e.encerrados + ' de ' + e.subprocessos.length}</span>
      </button>
      {aberta && (
        <div className="fluxo-etapa-corpo">
          {!e.liberada && <Alerta naLinha titulo="Esperando a etapa anterior" texto={'Libera quando “' + e.esperando + '” terminar.'} />}
          {vm.gruposDe(e).map(g => (
            <div key={g.nome} className="fluxo-grupo">
              {g.nome && <p className="fluxo-grupo-nome">{g.nome}</p>}
              <div className="fluxo-lista">
                {g.subprocessos.map(s => <LinhaDoSubprocesso key={s.id} vm={vm} s={s} liberada={e.liberada} />)}
              </div>
            </div>
          ))}
          {e.liberada && faltam > 0 && (
            <button type="button" className="btn btn-primary fluxo-concluir" onClick={() => vm.concluirEtapa(e.n)} title={'Marca como Concluído os ' + faltam + ' que faltam'}>
              <Icone nome="check" width={16} height={16} />Concluir a etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaDoSubprocesso({ vm, s, liberada }: { vm: VmFluxoDoFiscal; s: t.SubprocessoNoMes; liberada: boolean }) {
  const temAbrir = !!(s.painel || s.importar?.length || s.xmls || s.importacao || s.link);
  const aberto = vm.aberto === s.id;
  const outro = vm.outroResponsavel(s);
  const mostrarStatus = s.status !== 'pendente' && s.status !== 'concluido';
  const codigo = String(vm.empresa?.codigo ?? '');
  // o nome inteiro, quem marcou e quando ficam na dica
  const dica = [s.nome, s.status !== 'pendente' && s.por ? ROTULO[s.status] + ' por ' + s.por + ' em ' + quando(s.em) : '',
    s.observacao && s.observacao !== 'nao-se-aplica' ? s.observacao : ''].filter(Boolean).join(' · ');
  return (
    <div className={'fluxo-sub' + (s.encerrado ? ' encerrado' : '') + (aberto ? ' aberto' : '')}>
      <div className="fluxo-sub-linha">
        <button type="button" className="fluxo-caixa" disabled={!liberada} onClick={() => vm.alternar(s.id, s.encerrado)} aria-pressed={s.encerrado}
          title={!liberada ? 'Libera quando a etapa anterior terminar' : s.encerrado ? 'Voltar para Pendente' : 'Concluir'}>
          <span className={'subnav-caixa ' + (s.encerrado ? 'marcada' : 'vazia')}>{s.encerrado && <Icone nome="check" width={12} height={12} />}</span>
        </button>
        <button type="button" className="fluxo-sub-nome" disabled={!temAbrir} onClick={() => vm.abrir(s.id)} aria-expanded={temAbrir ? aberto : undefined} title={dica}>
          <span><b>{t.nomeCurto(s.nome)}</b></span>
          {temAbrir && <Icone nome={aberto ? 'caretDown' : 'chevronRight'} width={14} height={14} />}
        </button>
        {outro && <span className="fluxo-sub-resp fraco"><Icone nome="usuario" width={12} height={12} />{outro}</span>}
        {mostrarStatus && <span className={'badge ' + SELO[s.status]}>{ROTULO[s.status]}</span>}
        {liberada && (
          <MenuSuspenso rotulo="" icone="mais" className="btn btn-ghost btn-sm fluxo-mais" titulo="Outro status ou outro responsável" direita semSeta
            itens={[
              ...t.STATUS_DO_SUBPROCESSO.map(x => ({ rotulo: x.rotulo, marcado: x.valor === s.status, onClick: () => vm.mudarStatus(s.id, x.valor) })),
              ...vm.pessoas.filter(p => p !== (s.responsavel || vm.responsavelPadrao)).map(p => ({ rotulo: 'Responsável: ' + p, onClick: () => vm.mudarResponsavel(s.id, p) })),
            ]} />
        )}
      </div>
      {aberto && (
        <div className="fluxo-sub-corpo">
          <div className="fluxo-sub-acoes">
            {s.importar && s.importar.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.painel.importar(s.importar!)} title="Vai para a Conferência da empresa (a mesma do Contábil)">
                <Icone nome="upload" width={14} height={14} />Importar {s.importar.map(r => ROTULO_DO_RELATORIO[r]).join(', ')}
              </button>
            )}
            {/* a importação aqui mesmo, na janela (23/10/2026: "abre outra aba ao invés de abrir para importar aqui") */}
            {s.importacao && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => vm.painel.importar(['entradas', 'saidas', 'tomados', 'prestados'])} title="Os relatórios de notas do Alterdata (com a conta contábil) e os XMLs do cliente: vão para a Conferência da empresa">
                <Icone nome="upload" width={14} height={14} />Importar do Alterdata
              </button>
            )}
            {s.link && <a className="btn btn-outline btn-sm" href={s.link.url} target={s.link.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer"><Icone nome="link" width={14} height={14} />{s.link.rotulo}</a>}
          </div>
          {s.xmls && codigo && <XmlsDoCliente codigo={codigo} competencia={vm.competencia} saidas />}
          {s.painel && s.painel !== 'xml-saidas' && (
            <PainelDaTarefa painel={s.painel} vm={vm.painel} codigo={codigo} competencia={vm.competencia} importar={vm.painel.importar}
              valores={vm.valores} informar={vm.informar} relatorio={vm.relatorio} />
          )}
        </div>
      )}
    </div>
  );
}
