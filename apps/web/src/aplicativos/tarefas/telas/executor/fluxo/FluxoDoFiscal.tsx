// O fluxo operacional do Fiscal (23/10/2026: o documento "FLUXO OPERACIONAL DO DEPARTAMENTO FISCAL", "pode substituir
// o atual"), no lugar do executor de checklists para o Simples, o Presumido e o Real. Na barra lateral, as etapas do fluxo
// na ordem (a marcada já acabou; o cadeado, esperando as de antes). Na página, a etapa escolhida: o andamento, o
// responsável de todos e os subprocessos, cada um com o responsável, o status (os seis do documento; a própria pessoa
// passa por todos) e, quando o nads tem a ferramenta, o painel dela (o mesmo do executor antigo). A etapa travada mostra
// os subprocessos, mas só libera o status quando as de antes acabarem. Menos cliques (23/10/2026: "tenho que ficar
// clicando um monte de botão"): a caixinha conclui com um clique, o "Concluir a etapa" fecha o que falta, o responsável
// vem do Cadastro (uma vez, no topo) e os outros status ficam no menu ⋯ da linha. Só as peças do catálogo (Casca, MenuSuspenso,
// selo, Alerta, a barra de progresso, a faixa que abre).
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
  const secoes = vm.etapas.map(e => ({
    id: String(e.n), rotulo: e.n + '. ' + e.nome, icone: (e.concluida ? 'checkCircle' : e.liberada ? 'list' : 'lock') as 'checkCircle' | 'list' | 'lock', grupo: 0,
    ativa: e.n === vm.etapa?.n, caixa: (e.concluida ? 'marcada' : 'vazia') as 'marcada' | 'vazia', titulo: e.periodicidade !== 'mensal' ? PERIODICIDADE[e.periodicidade] : undefined,
  }));
  return (
    <Casca sistema="Tarefas" temaNaGaveta={false} larga rotuloLateral="Etapas do fluxo"
      empresa={vm.empresa ? { codigo: (vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : '') + vm.empresa.nome, nome: '' } : null}
      versao={casca.versao} secoes={secoes} paginas={[]} titulo=""
      onSecao={id => vm.escolherEtapa(Number(id))} onPagina={() => undefined} onInicio={vm.sair} onAplicativos={casca.inicio}
      onEmpresa={vm.abrirEmpresa} aplicativos={casca.aplicacoes} onAplicativo={casca.onAplicacao}>
      {vm.carregando ? null : !vm.empresa ? <p className="fraco">Empresa não encontrada.</p> : !vm.fluxo || !vm.etapa ? (
        <p className="fraco">O regime desta empresa ainda não tem o fluxo novo.</p>
      ) : <Etapa vm={vm} />}
      {vm.painel.importando && vm.empresa && <JanelaDeImportacao vm={vm.painel} empresa={vm.empresa.nome} codigo={String(vm.empresa.codigo ?? '')} competencia={vm.competencia} />}
    </Casca>
  );
}

function Etapa({ vm }: { vm: VmFluxoDoFiscal }) {
  const e = vm.etapa!;
  const pct = e.subprocessos.length ? Math.round((e.encerrados / e.subprocessos.length) * 100) : 100;
  const codigo = String(vm.empresa?.codigo ?? '');
  const faltam = e.subprocessos.length - e.encerrados;
  return (
    <section className="fluxo">
      <header className="fluxo-topo">
        <div>
          <p className="fraco fluxo-caminho">{vm.fluxo!.nome} · {vm.rotuloCompetencia} · {vm.resumo.encerrados} de {vm.resumo.total} subprocessos do mês</p>
          <h2>{e.n}. {e.nome} {e.periodicidade !== 'mensal' && <span className="badge badge-neutral">{PERIODICIDADE[e.periodicidade]}</span>}</h2>
          {/* o responsável uma vez só, para a etapa toda (23/10/2026: "tenho que ficar colocando responsável em todos?") */}
          <p className="fluxo-resp-etapa">
            <Icone nome="usuario" width={14} height={14} />Responsável: <b>{vm.responsavelDaEtapaAtual}</b>
            {vm.pessoas.length > 0 && (
              <MenuSuspenso rotulo="trocar" className="btn btn-ghost btn-sm" titulo="Trocar o responsável de toda a etapa" semSeta
                itens={vm.pessoas.map(p => ({ rotulo: p + (p === vm.responsavelDaEmpresa ? ' (da empresa)' : ''), marcado: p === vm.responsavelDaEtapaAtual, onClick: () => vm.trocarResponsavelDaEtapa(p) }))} />
            )}
          </p>
        </div>
        <div className="fluxo-topo-direita">
          <span className="card-head-ctl"><span className="tarefas-barra"><span style={{ width: pct + '%' }} /></span><span className="pt-contagem"><b>{e.encerrados}</b> de {e.subprocessos.length}</span></span>
          {vm.testes.length > 0 && (
            <MenuSuspenso rotulo="Dados de teste" icone="zap" titulo="As notas de teste do mês (modo desenvolvedor ou empresa de teste)" direita
              itens={vm.testes.map(o => ({ rotulo: o.rotulo, onClick: () => vm.usarTeste(o.id) }))} />
          )}
          {e.liberada && faltam > 0 && (
            <button type="button" className="btn btn-primary" onClick={vm.concluirEtapa} title={'Marca como Concluído os ' + faltam + ' que faltam nesta etapa'}>
              <Icone nome="check" width={16} height={16} />Concluir a etapa
            </button>
          )}
        </div>
      </header>
      {!e.liberada && <Alerta naLinha titulo="Esperando a etapa anterior" texto={'Esta etapa libera quando “' + e.esperando + '” terminar.'} />}
      <div className="fluxo-lista">
        {e.subprocessos.map(s => {
          const temAbrir = !!(s.painel || s.importar?.length || s.xmls || s.importacao || s.link);
          const aberto = vm.aberto === s.id;
          const outro = vm.outroResponsavel(s);
          const mostrarStatus = s.status !== 'pendente' && s.status !== 'concluido';
          return (
            <div key={s.id} className={'fluxo-sub' + (s.encerrado ? ' encerrado' : '') + (aberto ? ' aberto' : '')}>
              <div className="fluxo-sub-linha">
                {/* um clique conclui; de novo, volta para Pendente */}
                <button type="button" className="fluxo-caixa" disabled={!e.liberada} onClick={() => vm.alternar(s.id, s.encerrado)} aria-pressed={s.encerrado}
                  title={!e.liberada ? 'Libera quando a etapa anterior terminar' : s.encerrado ? 'Voltar para Pendente' : 'Concluir'}>
                  <span className={'subnav-caixa ' + (s.encerrado ? 'marcada' : 'vazia')}>{s.encerrado && <Icone nome="check" width={12} height={12} />}</span>
                </button>
                <button type="button" className="fluxo-sub-nome" disabled={!temAbrir} onClick={() => vm.abrir(s.id)} aria-expanded={temAbrir ? aberto : undefined}
                  title={temAbrir ? (aberto ? 'Fechar' : 'Abrir o que o nads tem para este subprocesso') : undefined}>
                  <span>
                    <b>{s.nome}</b>
                    {s.status !== 'pendente' && s.por && <span className="fraco fluxo-sub-quem">{s.por + ' · ' + quando(s.em)}{s.observacao && s.observacao !== 'nao-se-aplica' ? ' · ' + s.observacao : ''}</span>}
                  </span>
                  {temAbrir && <Icone nome={aberto ? 'caretDown' : 'chevronRight'} width={14} height={14} />}
                </button>
                {outro && <span className="fluxo-sub-resp fraco"><Icone nome="usuario" width={12} height={12} />{outro}</span>}
                {mostrarStatus && <span className={'badge ' + SELO[s.status]}>{ROTULO[s.status]}</span>}
                {e.liberada && (
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
        })}
      </div>
    </section>
  );
}
