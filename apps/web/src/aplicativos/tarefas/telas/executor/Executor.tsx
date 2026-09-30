// O executor: dentro do cabeçalho padrão (☰, "Tarefas / 292 · EMPRESA / Agosto/2026"), com as etapas em
// checklist na barra lateral (caixinha marcada = feita; clicar numa anterior volta para ela e tira o check). A página é só a ferramenta da etapa, com a
// altura toda; embaixo, a barra com as saídas da etapa (Pedir extrato, Buscar no Drive…), Interromper e
// Próximo.
import { Alerta, Casca, Icone, useCarregando, useFerramentaNaEtapa } from '@nads/ui';
import { useRef } from 'react';
import { Navigate, useParams } from 'react-router';
import { usePonteDaFerramenta } from '../../../../comum/ponte';
import { BASE } from '../../casca/navegacao';
import { useCascaTarefas } from '../../casca/useCascaTarefas';
import { JanelaInterromper } from './partes/JanelaInterromper';
import { Objecoes } from './partes/Objecoes';
import { useExecutor } from './useExecutor';

export function Executor() {
  const { empresa: rota = '', competencia = '' } = useParams();
  const vm = useExecutor(rota, competencia);
  const casca = useCascaTarefas('minhas-empresas', 'empresas');
  useCarregando(vm.carregando || vm.conferindo);
  // a ferramenta da etapa (iframe): recebe os bancos sem movimento e avisa quando a pessoa marca um
  const iframe = useRef<HTMLIFrameElement>(null);
  usePonteDaFerramenta(iframe, vm.semMovimento, vm.marcarSemMovimento);
  // a ferramenta do tamanho do conteúdo dela: a página toda rola junto, numa barra só
  const altura = useFerramentaNaEtapa(iframe, vm.ferramenta?.url);
  if (!vm.empresa) return <Navigate to={BASE} replace />;

  const checklist = vm.etapas.map(e => ({
    id: e.id, rotulo: e.nome, icone: 'check' as const, grupo: 1, ativa: e.atual,
    caixa: e.situacao === 'feita' || e.situacao === 'dispensada' ? 'marcada' as const : e.situacao === 'interrompida' ? 'parada' as const : 'vazia' as const,
  }));

  return (
    <Casca sistema="Tarefas" larga rotuloLateral="Etapas"
      empresa={{ codigo: (vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : '') + vm.empresa.nome, nome: '' }}
      trilha={[{ rotulo: vm.rotuloCompetencia }]}
      versao={casca.versao} secoes={checklist} paginas={[]} titulo=""
      onSecao={vm.voltarPara} onPagina={() => undefined} onInicio={vm.sair} onAplicativos={casca.inicio}
      onEmpresa={vm.abrirEmpresa} aplicativos={casca.aplicacoes} onAplicativo={casca.onAplicacao}>
      {vm.carregando ? <p className="empty">Carregando…</p> : !vm.etapa ? (
        <div className="executor-fim">
          <Icone nome="checkCircle" />
          <h2>Tudo pronto em {vm.rotuloCompetencia}</h2>
          <p className="hint">Todas as etapas desta empresa estão concluídas.</p>
          <button type="button" className="btn btn-primary" onClick={vm.sair}>Voltar às empresas</button>
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
                <h4>Feito no sistema</h4>
                <p>Faça esta etapa no Alterdata e clique em Próximo.</p>
              </div>
            )}
          </div>
          {vm.aviso && <Alerta titulo="Ainda não dá para seguir" texto={vm.aviso} />}
          {/* os botões da etapa soltos por cima da tela, no canto: as saídas (quando a etapa tem), ✕ Interromper e → Próximo */}
          <div className="executor-flutuante">
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
