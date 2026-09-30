// O executor: dentro do cabeçalho padrão (☰, "Tarefas / 292 · EMPRESA / Agosto/2026"), com os grupos da rotina nas
// abas de cima (Preparação, Ativo, Passivo, Resultado, Fechamento, como as abas do GitHub, com quantas etapas estão
// feitas). Na Preparação a ferramenta ocupa a tela toda (a Conferência fiscal é o Concilia aí inteiro); dali em
// diante, as etapas do grupo ficam na caixa à esquerda (como o "Insights" do GitHub), em checklist (caixinha
// marcada = feita; clicar numa anterior volta para ela e tira o check). A página é só a ferramenta da etapa, com a
// altura toda; embaixo, a barra com as saídas da etapa (Pedir extrato, Buscar no Drive…), Interromper e
// Próximo.
import { Alerta, Casca, Icone, useCarregando, useFerramentaNaEtapa, type NomeIcone } from '@nads/ui';
import { useRef } from 'react';
import { Navigate, useParams } from 'react-router';
import { usePonteDaFerramenta } from '../../../../comum/ponte';
import { BASE } from '../../casca/navegacao';
import { useCascaTarefas } from '../../casca/useCascaTarefas';
import { JanelaInterromper } from './partes/JanelaInterromper';
import { Objecoes } from './partes/Objecoes';
import { useExecutor } from './useExecutor';

/** O ícone de cada grupo nas abas de cima. */
const ICONE_DO_GRUPO: Record<string, NomeIcone> = {
  'Preparação': 'fileUp', Ativo: 'landmark', Passivo: 'relatorio', Resultado: 'barChart', Fechamento: 'checkCircle',
};
/** O grupo em que a ferramenta ocupa a tela toda (sem a caixa das etapas). */
const TELA_TODA = 'Preparação';

export function Executor() {
  // a competência da rota pode ser um período ('2026-06..2026-08'): a Etapa com vários meses
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const vm = useExecutor(rota, periodo);
  const casca = useCascaTarefas('minhas-empresas', 'empresas');
  // a ferramenta da etapa (iframe): recebe os bancos sem movimento e avisa quando a pessoa marca um
  const iframe = useRef<HTMLIFrameElement>(null);
  usePonteDaFerramenta(iframe, vm.semMovimentoPorMes, vm.competencia, vm.marcarSemMovimento, vm.trocarCompetencia,
    vm.varios ? { meses: vm.meses, concluido: vm.periodoConcluido } : null, vm.encerrarPeriodo);
  // a ferramenta do tamanho do conteúdo dela: a página toda rola junto, numa barra só
  const { altura, carregando: ferramentaCarregando, janelaAberta } = useFerramentaNaEtapa(iframe, vm.ferramenta?.embutir ? vm.ferramenta.url : undefined);
  // uma barra só, no alto da página: a da Tarefas e a da ferramenta juntas
  useCarregando(vm.carregando || vm.conferindo || ferramentaCarregando);
  if (!vm.empresa) return <Navigate to={BASE} replace />;
  // o mês faz parte de um período prometido (vários meses): abre o período
  if (vm.irParaPeriodo) return <Navigate to={vm.irParaPeriodo} replace />;

  // os grupos da rotina (abas de cima): o da vez marcado; os de trás abrem (voltam para a primeira etapa deles); os da frente travam
  const grupos = [...new Set(vm.etapas.map(e => e.secao || ''))];
  const grupoDaVez = vm.etapa?.secao || '';
  const iDaVez = grupos.indexOf(grupoDaVez);
  const abas = vm.etapa ? grupos.map((g, i) => {
    const es = vm.etapas.filter(e => (e.secao || '') === g);
    return {
      id: g, rotulo: g, icone: ICONE_DO_GRUPO[g] || ('list' as NomeIcone), ativa: g === grupoDaVez, travada: i > iDaVez,
      contador: es.filter(e => e.situacao === 'feita').length + '/' + es.length,
    };
  }) : [];
  const abrirGrupo = (g: string) => {
    const i = grupos.indexOf(g);
    if (i < 0 || i >= iDaVez) return;
    const primeira = vm.etapas.find(e => (e.secao || '') === g);
    if (primeira) vm.voltarPara(primeira.id);
  };

  // a caixa da esquerda: só as etapas do grupo da vez
  const checklist = vm.etapas.filter(e => (e.secao || '') === grupoDaVez).map(e => ({
    // no período, quantos meses a etapa já tem feitos ("Importação · 1/3")
    id: e.id, rotulo: e.nome + (vm.varios && e.feitos > 0 && e.feitos < vm.meses.length ? ' · ' + e.feitos + '/' + vm.meses.length : ''), icone: 'check' as const, grupo: e.grupo, ativa: e.atual,
    caixa: e.situacao === 'feita' ? 'marcada' as const : e.situacao === 'interrompida' ? 'parada' as const : 'vazia' as const,
  }));

  return (
    <Casca sistema="Tarefas" larga rotuloLateral="Etapas" lateral={!vm.etapa || grupoDaVez === TELA_TODA ? 'nenhuma' : 'caixa'}
      empresa={{ codigo: (vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : '') + vm.empresa.nome, nome: '' }}

      versao={casca.versao} secoes={checklist} paginas={abas} titulo=""
      onSecao={vm.voltarPara} onPagina={abrirGrupo} onInicio={vm.sair} onAplicativos={casca.inicio}
      onEmpresa={vm.abrirEmpresa} aplicativos={casca.aplicacoes} onAplicativo={casca.onAplicacao}>
      {vm.carregando ? null : !vm.etapa ? (
        <div className="executor-fim">
          <Icone nome="checkCircle" />
          <h2>Tudo pronto em {vm.rotuloCompetencia}</h2>
          <p className="hint">Todas as etapas desta empresa estão concluídas{vm.varios ? ' nos ' + vm.meses.length + ' meses' : ''}.</p>
          <div className="executor-fim-botoes">
            {vm.varios && <button type="button" className="btn btn-outline" onClick={vm.encerrarPeriodo}>Cancelar função</button>}
            <button type="button" className="btn btn-primary" onClick={vm.sair}>Voltar às empresas</button>
          </div>
        </div>
      ) : (
        <div className="executor-area">
          {vm.interrompidaAntes && (
            <p className="hint">Parada antes por {vm.interrompidaAntes.por}: {vm.etapa.objecoes.find(o => o.id === vm.interrompidaAntes?.objecao)?.texto || vm.interrompidaAntes.observacao || 'outro motivo'}.</p>
          )}
          <div className="executor-ferramenta">
            {vm.ferramenta?.embutir ? (
              <iframe ref={iframe} key={vm.ferramenta.url} src={vm.ferramenta.url} title={vm.ferramenta.nome} style={altura ? { height: altura } : undefined} />
            ) : vm.ferramenta ? (
              <div className="gh-blank">
                <Icone nome="link" />
                <h4>{vm.ferramenta.nome}</h4>
                <p>Esta etapa abre em outra aba.</p>
                <a className="btn btn-primary" href={vm.ferramenta.url} target="_blank" rel="noreferrer">Abrir {vm.ferramenta.nome}</a>
              </div>
            ) : (
              <div className="gh-blank">
                <Icone nome="checklist" />
                <h4>{vm.etapa.conferir ? 'O que conferir' : 'Feito no sistema'}</h4>
                {vm.etapa.conferir ? (
                  <ul className="executor-conferir">{vm.etapa.conferir.map(c => <li key={c}>{c}</li>)}</ul>
                ) : <p>Faça esta etapa no Alterdata e clique em Próximo.</p>}
              </div>
            )}
          </div>
          {vm.aviso && <Alerta titulo="Ainda não dá para seguir" texto={vm.aviso} />}
          {/* os botões da etapa soltos por cima da tela, no canto: as saídas (quando a etapa tem), ✕ Interromper e → Próximo */}
          {/* só na primeira camada: com janela ou menu aberto (aqui ou na ferramenta), os botões saem da frente */}
          <div className="executor-flutuante" hidden={janelaAberta || vm.interrompendo}>
            <Objecoes etapa={vm.etapa} onResolver={vm.resolver} />
            <button type="button" className="executor-botao" onClick={vm.abrirInterromper} title="Interromper a etapa" aria-label="Interromper">
              <Icone nome="x" />
            </button>
            <button type="button" className="executor-botao proximo" disabled={vm.conferindo} onClick={() => { void vm.proximo(); }}
              title={vm.conferindo ? 'Conferindo…' : 'Próximo (confere e segue para a próxima etapa)'} aria-label="Próximo">
              {vm.conferindo ? <span className="btn-spinner" /> : <Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} />}
            </button>
          </div>
          {vm.interrompendo && <JanelaInterromper etapa={vm.etapa} onInterromper={vm.interromper} onCancelar={vm.fecharInterromper} />}
        </div>
      )}
    </Casca>
  );
}
