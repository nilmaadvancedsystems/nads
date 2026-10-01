// O executor: dentro do cabeçalho padrão (☰, "Tarefas / 292 · EMPRESA / Agosto/2026"), com as etapas em
// checklist na barra lateral, com o nome de cada grupo em cima (Preparação, Ativo, Passivo, Resultado, Fechamento;
// caixinha marcada = feita; clicar numa anterior volta para ela e tira o check). A página é só a ferramenta da
// etapa, com a altura toda; embaixo, a barra com as saídas da etapa (Pedir extrato, Buscar no Drive…), Interromper e
// Próximo. No canto direito do cabeçalho, como os botões do GitHub: os grupos da rotina (o da vez com o ícone normal,
// os outros apagados; clicar num de trás volta para ele) e o perfil.
import { Alerta, Casca, Icone, MenuSuspenso, useCarregando, useFerramentaNaEtapa, type NomeIcone } from '@nads/ui';
import { useRef, useState } from 'react';
import { Navigate, useBlocker, useParams } from 'react-router';
import { usePonteDaFerramenta } from '../../../../comum/ponte';
import { BASE } from '../../casca/navegacao';
import { useCascaTarefas } from '../../casca/useCascaTarefas';
import { JanelaInterromper } from './partes/JanelaInterromper';
import { Objecoes } from './partes/Objecoes';
import { useExecutor } from './useExecutor';

/** O ícone de cada grupo da rotina, no canto do cabeçalho. */
const ICONE_DO_GRUPO: Record<string, NomeIcone> = {
  'Preparação': 'fileUp', Ativo: 'landmark', Passivo: 'relatorio', Resultado: 'barChart', Fechamento: 'checkCircle',
};

export function Executor() {
  // a competência da rota pode ser um período ('2026-06..2026-08'): a Etapa com vários meses
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const vm = useExecutor(rota, periodo);
  const casca = useCascaTarefas('minhas-empresas', 'empresas');
  // a ferramenta da etapa (iframe): recebe os bancos sem movimento e avisa quando a pessoa marca um
  const iframe = useRef<HTMLIFrameElement>(null);
  // a ferramenta que tem requisitos (a Importação) diz o que falta: o avançar só aparece com tudo pronto
  const [requisitos, setRequisitos] = useState<{ url: string; pronto: boolean; faltam: string[] } | null>(null);
  const urlDaFerramenta = vm.ferramenta?.url || '';
  usePonteDaFerramenta(iframe, vm.semMovimentoPorMes, vm.competencia, vm.marcarSemMovimento, vm.trocarCompetencia,
    vm.varios ? { meses: vm.meses, concluido: vm.periodoConcluido } : null, vm.encerrarPeriodo,
    r => setRequisitos({ url: urlDaFerramenta, ...r }));
  // os requisitos valem só para a ferramenta que mandou (trocou de etapa: some)
  const faltam = requisitos && requisitos.url === urlDaFerramenta && !requisitos.pronto ? requisitos.faltam : null;
  // no lugar do avançar, o "?": abre o que falta para seguir
  const [verFaltam, setVerFaltam] = useState(false);
  // a ferramenta do tamanho do conteúdo dela: a página toda rola junto, numa barra só
  // um aplicativo inteiro dentro da etapa (a Conferência) manda as abas dele: elas ficam no cabeçalho, por cima do checklist
  const { altura, carregando: ferramentaCarregando, janelaAberta, abas, abrirAba } = useFerramentaNaEtapa(iframe, vm.ferramenta?.embutir ? vm.ferramenta.url : undefined);
  // uma barra só, no alto da página: a da Tarefas e a da ferramenta juntas
  useCarregando(vm.carregando || vm.conferindo || ferramentaCarregando);
  // os botões da etapa só com a tela pronta (a Tarefas e a ferramenta carregadas); o avançar, se a ferramenta tem
  // requisitos, só depois que ela disser o que falta (antes disso ele apareceria liberado)
  const telaPronta = !vm.carregando && !ferramentaCarregando;
  const requisitosConhecidos = !vm.ferramenta?.requisitos || requisitos?.url === urlDaFerramenta;
  // sair da execução por qualquer lugar do app (o cabeçalho, o menu, o voltar do navegador) com a etapa aberta:
  // é interromper, com a justificativa; trocar de mês ou período dentro do executor não conta
  const saida = useBlocker(({ currentLocation, nextLocation }) =>
    !!vm.etapa && !vm.interrompendo && currentLocation.pathname !== nextLocation.pathname && !nextLocation.pathname.startsWith(BASE + '/executar/'));
  if (!vm.empresa) return <Navigate to={BASE} replace />;
  // o mês faz parte de um período prometido (vários meses): abre o período
  if (vm.irParaPeriodo) return <Navigate to={vm.irParaPeriodo} replace />;

  // o checklist da esquerda: só as etapas do grupo da vez (os outros grupos ficam nos botões do canto); tudo pronto, todas
  const checklist = vm.etapas.filter(e => !vm.etapa || e.secao === vm.etapa.secao).map(e => ({
    // no período, quantos meses a etapa já tem feitos ("Importação · 1/3")
    id: e.id, rotulo: e.nome + (vm.varios && e.feitos > 0 && e.feitos < vm.meses.length ? ' · ' + e.feitos + '/' + vm.meses.length : ''), icone: 'check' as const, grupo: e.grupo, titulo: e.secao, ativa: e.atual,
    caixa: e.situacao === 'feita' ? 'marcada' as const : e.situacao === 'interrompida' ? 'parada' as const : 'vazia' as const,
    // as da frente que ainda não foram feitas: mais apagadas
    apagada: !!vm.etapa && e.n > (vm.etapas.find(x => x.atual)?.n ?? 0) && e.situacao !== 'feita',
  }));

  const topo = (
    <>
      <nav className="gh-topo-grupos" aria-label="Grupos da rotina">
        {vm.grupos.map(g => (
          <button key={g.nome} type="button" className={'gh-topo-btn' + (g.atual ? ' ativo' : '')}
            disabled={g.travado} onClick={() => vm.abrirGrupo(g.nome)} title={g.nome + ' · ' + g.feitas + '/' + g.total} aria-label={g.nome + ': ' + g.feitas + ' de ' + g.total}
            aria-current={g.atual ? 'step' : undefined}>
            <Icone nome={ICONE_DO_GRUPO[g.nome] || 'list'} />
          </button>
        ))}
      </nav>
      <span className="gh-topo-sep" aria-hidden="true" />
      <MenuSuspenso rotulo={casca.perfil.iniciais} className="gh-avatar" dica={casca.perfil.nome} titulo={casca.perfil.nome} direita
        itens={[{ rotulo: 'Voltar às empresas', icone: 'home', onClick: vm.sair }, { rotulo: casca.perfil.sair, icone: 'logOut', onClick: casca.trocarPessoa }]} />
    </>
  );

  return (
    <Casca sistema="Tarefas" larga rotuloLateral="Etapas" topoDireita={topo}
      empresa={{ codigo: (vm.empresa.codigo != null ? vm.empresa.codigo + ' · ' : '') + vm.empresa.nome, nome: '' }}

      versao={casca.versao} secoes={checklist} paginas={abas} titulo=""
      onSecao={vm.voltarPara} onPagina={abrirAba} onInicio={vm.sair} onAplicativos={casca.inicio}
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
          <div className="executor-flutuante" hidden={!telaPronta || janelaAberta || vm.interrompendo || saida.state === 'blocked'}>
            <Objecoes etapa={vm.etapa} onResolver={vm.resolver} />
            <button type="button" className="executor-botao" onClick={vm.abrirInterromper} title="Interromper a etapa" aria-label="Interromper">
              <Icone nome="x" />
            </button>
            {faltam && (
              <span className="executor-ajuda">
                {verFaltam && (
                  <div className="executor-faltam" role="dialog" aria-label="O que falta para seguir">
                    <b>Para seguir, falta:</b>
                    <ul>{faltam.map(t => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
                <button type="button" className={'executor-botao' + (verFaltam ? ' ativo' : '')} aria-expanded={verFaltam} onClick={() => setVerFaltam(v => !v)}
                  title="O que falta para seguir" aria-label="O que falta para seguir">
                  <Icone nome="ajuda" />
                </button>
              </span>
            )}
            {!faltam && requisitosConhecidos && (
              <button type="button" className="executor-botao proximo" disabled={vm.conferindo} onClick={() => { void vm.proximo(); }}
                title={vm.conferindo ? 'Conferindo…' : 'Próximo (confere e segue para a próxima etapa)'} aria-label="Próximo">
                {vm.conferindo ? <span className="btn-spinner" /> : <Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} />}
              </button>
            )}
          </div>
          {vm.interrompendo && <JanelaInterromper etapa={vm.etapa} onInterromper={vm.interromper} onCancelar={vm.fecharInterromper} />}
          {/* saiu por outro lugar: a mesma janela; interrompeu, segue para onde clicou; cancelou, fica */}
          {saida.state === 'blocked' && !vm.interrompendo && (
            <JanelaInterromper etapa={vm.etapa} onInterromper={(o, obs) => vm.interromper(o, obs, () => saida.proceed())} onCancelar={() => saida.reset()} />
          )}
        </div>
      )}
    </Casca>
  );
}
