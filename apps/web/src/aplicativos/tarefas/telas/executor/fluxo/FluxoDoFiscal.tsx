// O fluxo operacional do Fiscal (23/10/2026: o documento "FLUXO OPERACIONAL DO DEPARTAMENTO FISCAL", "pode substituir
// o atual"), no lugar do executor de checklists para o Simples, o Presumido e o Real. Na barra lateral, as etapas do fluxo
// na ordem (a marcada já acabou; o cadeado, esperando as de antes). Na página, a etapa escolhida: o andamento, o
// responsável de todos e os subprocessos, cada um com o responsável, o status (os seis do documento; a própria pessoa
// passa por todos) e, quando o nads tem a ferramenta, o painel dela (o mesmo do executor antigo). A etapa travada mostra
// os subprocessos, mas só libera o status quando as de antes acabarem. Só as peças do catálogo (Casca, MenuSuspenso,
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
  return (
    <section className="fluxo">
      <header className="fluxo-topo">
        <div>
          <p className="fraco fluxo-caminho">{vm.fluxo!.nome} · {vm.rotuloCompetencia} · {vm.resumo.encerrados} de {vm.resumo.total} subprocessos do mês</p>
          <h2>{e.n}. {e.nome} {e.periodicidade !== 'mensal' && <span className="badge badge-neutral">{PERIODICIDADE[e.periodicidade]}</span>}</h2>
        </div>
        <div className="fluxo-topo-direita">
          <span className="card-head-ctl"><span className="tarefas-barra"><span style={{ width: pct + '%' }} /></span><span className="pt-contagem"><b>{e.encerrados}</b> de {e.subprocessos.length}</span></span>
          {e.liberada && vm.pessoas.length > 0 && (
            <MenuSuspenso rotulo="Responsável de todos" icone="usuario" titulo="Dar um responsável aos subprocessos desta etapa que ainda não têm" direita
              itens={vm.pessoas.map(p => ({ rotulo: p + (p === vm.responsavelDaEmpresa ? ' (da empresa)' : ''), onClick: () => vm.responsavelDaEtapa(p) }))} />
          )}
        </div>
      </header>
      {!e.liberada && <Alerta naLinha titulo="Esperando a etapa anterior" texto={'Esta etapa libera quando “' + e.esperando + '” terminar (todos os subprocessos concluídos, aprovados ou não aplicáveis).'} />}
      {e.independentes && e.liberada && <p className="fraco fluxo-dica">Os subprocessos desta etapa são independentes: dá para trabalhar em qualquer ordem.</p>}
      <div className="fluxo-lista">
        {e.subprocessos.map(s => {
          const temAbrir = !!(s.painel || s.importar?.length || s.xmls || s.importacao || s.link);
          const aberto = vm.aberto === s.id;
          return (
            <div key={s.id} className={'fluxo-sub' + (s.encerrado ? ' encerrado' : '') + (aberto ? ' aberto' : '')}>
              <div className="fluxo-sub-linha">
                <button type="button" className="fluxo-sub-nome" disabled={!temAbrir} onClick={() => vm.abrir(s.id)} aria-expanded={temAbrir ? aberto : undefined}
                  title={temAbrir ? (aberto ? 'Fechar' : 'Abrir o que o nads tem para este subprocesso') : undefined}>
                  {temAbrir ? <Icone nome={aberto ? 'caretDown' : 'chevronRight'} width={14} height={14} /> : <span className="fluxo-sub-vazio" />}
                  <span>
                    <b>{s.nome}</b>
                    {(s.por || s.observacao) && <span className="fraco fluxo-sub-quem">{[s.por && s.em ? s.por + ' · ' + quando(s.em) : '', s.observacao].filter(Boolean).join(' · ')}</span>}
                  </span>
                </button>
                <MenuSuspenso rotulo={s.responsavel || <span className="fraco">Sem responsável</span>} icone="usuario" className="btn btn-ghost btn-sm fluxo-resp" titulo="O responsável por este subprocesso" direita
                  itens={[...vm.pessoas.map(p => ({ rotulo: p + (p === vm.responsavelDaEmpresa ? ' (da empresa)' : ''), marcado: p === s.responsavel, onClick: () => vm.mudarResponsavel(s.id, p) })),
                    ...(s.responsavel ? [{ rotulo: 'Tirar o responsável', onClick: () => vm.mudarResponsavel(s.id, '') }] : [])]} />
                {e.liberada ? (
                  <MenuSuspenso rotulo={<span className={'badge ' + SELO[s.status]}>{ROTULO[s.status]}</span>} className="btn btn-ghost btn-sm fluxo-status" titulo="Mudar o status" direita
                    itens={t.STATUS_DO_SUBPROCESSO.map(x => ({ rotulo: x.rotulo, marcado: x.valor === s.status, onClick: () => vm.mudarStatus(s.id, x.valor) }))} />
                ) : (
                  <span className={'badge ' + SELO[s.status] + ' fluxo-status-travado'} title="Libera quando a etapa anterior terminar"><Icone nome="lock" width={12} height={12} /> {ROTULO[s.status]}</span>
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
                    {s.importacao && vm.empresa && (
                      <a className="btn btn-outline btn-sm" href={'/extratudo/' + vm.empresa.rota + '/extrator/tarefa/extratos?etapa=fiscal'} target="_blank" rel="noreferrer">
                        <Icone nome="fileUp" width={14} height={14} />Abrir a Importação do Alterdata
                      </a>
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
