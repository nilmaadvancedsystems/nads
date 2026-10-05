// O executor: dentro do cabeçalho padrão (☰, "Tarefas / 292 · EMPRESA / Agosto/2026"), com as etapas em
// checklist na barra lateral, com o nome de cada grupo em cima (Preparação, Ativo, Passivo, Resultado, Fechamento;
// caixinha marcada = feita; clicar numa anterior volta para ela e tira o check). A página é só a ferramenta da
// etapa, com a altura toda. No canto direito do cabeçalho, como os botões do GitHub (Vitor, 01/10/2026: os botões do pé
// atrapalhavam a ferramenta): os grupos da rotina num menu só (como o "+ ▾"), as saídas da etapa (⚠ ▾), ✕ Interromper,
// ? (o que falta) ou → Próximo, e o perfil.
import { AberturaN, Alerta, Casca, destacarNaTela, Icone, MenuSuspenso, useCarregando, useFerramentaNaEtapa, type ItemMenu, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useBlocker, useParams } from 'react-router';
import { usePonteDaFerramenta } from '../../../../comum/ponte';
import { BASE } from '../../casca/navegacao';
import { useCascaTarefas } from '../../casca/useCascaTarefas';
import { JanelaInterromper } from './partes/JanelaInterromper';
import { useChecklistDaFolha } from './useChecklistDaFolha';
import { useExecutor } from './useExecutor';
import { ListaDoQueFalta, type ItemQueFalta } from './partes/OQueFalta';
import { MenuDaRotina } from './partes/MenuDaRotina';
import { RazaoDaEtapa } from './partes/RazaoDaEtapa';
import { useRazaoDaEtapa } from './useRazaoDaEtapa';

/** O ícone de cada grupo da rotina, no canto do cabeçalho. */

const ICONE_DO_GRUPO: Record<string, NomeIcone> = {
  'Preparação': 'fileUp', Ativo: 'landmark', Passivo: 'relatorio', Resultado: 'barChart', Fechamento: 'checkCircle',
};

export function Executor() {
  // a competência da rota pode ser um período ('2026-06..2026-08'): a Etapa com vários meses
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const vm = useExecutor(rota, periodo);
  const casca = useCascaTarefas('minhas-empresas', 'empresas');
  // o razão da etapa (o Caixa): importado do computador, vale para a empresa, a etapa e o período abertos; a liquidação
  // de cobrança no caixa põe o Creditor nos meses dela
  const razao = useRazaoDaEtapa(rota + '|' + (vm.etapa?.id || '') + '|' + periodo, vm.meses.length ? vm.meses : [vm.competencia], vm.ajustarCreditor);
  // a ferramenta da etapa (iframe): recebe os bancos sem movimento e avisa quando a pessoa marca um
  const iframe = useRef<HTMLIFrameElement>(null);
  // a ferramenta que tem requisitos (a Importação) diz o que falta: o avançar só aparece com tudo pronto
  const [requisitos, setRequisitos] = useState<{ url: string; pronto: boolean; faltam: string[]; alvos?: (string | null)[]; precisaChequeEspecial?: boolean } | null>(null);
  const urlDaFerramenta = vm.ferramenta?.url || '';
  const destacarNaFerramenta = usePonteDaFerramenta(iframe, vm.semMovimentoPorMes, vm.competencia, vm.marcarSemMovimento, vm.trocarCompetencia,
    vm.varios ? { meses: vm.meses, concluido: vm.periodoConcluido } : null, vm.encerrarPeriodo,
    r => setRequisitos({ url: urlDaFerramenta, ...r }));
  // os requisitos valem só para a ferramenta que mandou (trocou de etapa: some)
  // a etapa da folha: o checklist montado pelo balancete (o avançar só com tudo marcado)
  // o checklist da etapa: o da folha (pelo balancete) ou as tarefas fixas da etapa (o Fiscal)
  const fixo = vm.etapa?.checklist ? { etapa: vm.etapa.id, itens: vm.etapa.checklist.map(i => ({ id: i.id, nome: i.texto, contas: i.sub || [], link: i.link, aviso: i.aviso })) } : null;
  const temChecklist = !!(vm.etapa?.checklistDaFolha || vm.etapa?.checklist);
  const folha = useChecklistDaFolha(temChecklist, vm.empresa?.nome || '', vm.meses.length ? vm.meses : [vm.competencia], fixo);
  const faltamFerramenta = requisitos && requisitos.url === urlDaFerramenta && !requisitos.pronto ? requisitos.faltam : null;
  // o Caixa: sem o razão importado não dá para saber se o Creditor entra (Vitor, 05/10/2026)
  const faltaRazao = vm.etapa?.razao && !razao.carregado ? ['Importar o razão do ' + vm.etapa.razao.conta] : null;
  const faltam = temChecklist ? (folha.faltam && folha.faltam.length ? folha.faltam : null) : faltaRazao || faltamFerramenta;
  // o "?": cada item com o lugar dele (o Resolver leva até lá): na folha, o item da lista; na ferramenta, o que ela mandou
  const itensQueFaltam: ItemQueFalta[] = (faltam || []).map((texto, i) => ({
    texto, alvo: temChecklist ? 'folha:' + texto : requisitos?.alvos?.[i] ?? null,
  }));
  const resolver = (alvo: string) => {
    if (alvo.startsWith('folha:')) void destacarNaTela('[data-folha="' + CSS.escape(alvo.slice(6)) + '"]');
    else destacarNaFerramenta(alvo);
  };
  // a ferramenta do tamanho do conteúdo dela: a página toda rola junto, numa barra só
  // um aplicativo inteiro dentro da etapa (a Conferência) manda as abas dele: elas ficam no cabeçalho, por cima do checklist
  const { altura, carregando: ferramentaCarregando, abrindo: ferramentaAbrindo, fundoAberto, abas, abrirAba } = useFerramentaNaEtapa(iframe, vm.ferramenta?.embutir ? vm.ferramenta.url : undefined);
  // uma barra só, no alto da página: a da Tarefas e a da ferramenta juntas
  // a etapa da folha esperando o balancete: a mesma barra do topo
  const folhaCarregando = temChecklist && folha.itens === null;
  useCarregando(vm.carregando || vm.conferindo || ferramentaCarregando || folhaCarregando);
  // os botões da etapa só com a tela pronta (a Tarefas e a ferramenta carregadas); o avançar, se a ferramenta tem
  // requisitos, só depois que ela disser o que falta (antes disso ele apareceria liberado)
  const telaPronta = !vm.carregando && !ferramentaCarregando;
  // uma janela (popup) aberta na ferramenta: o cabeçalho e a lateral embaçam também (o fundo da tela inteira)
  useEffect(() => {
    document.documentElement.classList.toggle('fundo-embacado', fundoAberto);
    return () => document.documentElement.classList.remove('fundo-embacado');
  }, [fundoAberto]);
  // o Cheque especial já aberto sem nenhum dia negativo (a ferramenta conferiu todos os bancos): dispensa e segue
  const dispensou = useRef('');
  const chequeDesnecessario = vm.etapa?.id === 'cheque-especial' && requisitos?.url === urlDaFerramenta && requisitos?.precisaChequeEspecial === false;
  useEffect(() => {
    if (!chequeDesnecessario || dispensou.current === urlDaFerramenta) return;
    dispensou.current = urlDaFerramenta;
    vm.dispensarSemCheque();
  }, [chequeDesnecessario, urlDaFerramenta, vm]);
  const requisitosConhecidos = temChecklist ? folha.faltam !== null : !vm.ferramenta?.requisitos || requisitos?.url === urlDaFerramenta;
  // sair da execução por qualquer lugar do app (o cabeçalho, o menu, o voltar do navegador) com a etapa aberta:
  // é interromper, com a justificativa; trocar de mês ou período dentro do executor não conta
  const saida = useBlocker(({ currentLocation, nextLocation }) =>
    !!vm.etapa && !vm.interrompendo && currentLocation.pathname !== nextLocation.pathname && !nextLocation.pathname.startsWith(BASE + '/executar/'));
  if (!vm.empresa) return <Navigate to={BASE} replace />;
  // o mês faz parte de um período prometido (vários meses): abre o período
  if (vm.irParaPeriodo) return <Navigate to={vm.irParaPeriodo} replace />;

  // o checklist da esquerda: só as etapas do grupo da vez (os outros grupos ficam nos botões do canto); tudo pronto, todas
  // sem dia negativo (a Importação disse), o Cheque especial nem aparece; ao seguir, ele fica dispensado (Vitor, 02/10/2026)
  const semCheque = vm.etapa?.id === 'extratos' && requisitos?.url === urlDaFerramenta && requisitos?.precisaChequeEspecial === false;
  const checklist = vm.etapas.filter(e => !e.oculta && !(semCheque && e.id === 'cheque-especial')).filter(e => !vm.etapa || e.secao === vm.etapa.secao).map(e => ({
    // em lote é tudo de uma vez (Vitor, 02/10/2026: "não fica 8/9, são os 9"): só o nome da etapa, sem a contagem de meses
    id: e.id, rotulo: e.nome, icone: 'check' as const, grupo: e.grupo, titulo: e.secao, ativa: e.atual,
    caixa: e.situacao === 'feita' ? 'marcada' as const : e.situacao === 'interrompida' ? 'parada' as const : 'vazia' as const,
    // as da frente que ainda não foram feitas: mais apagadas
    apagada: !!vm.etapa && e.n > (vm.etapas.find(x => x.atual)?.n ?? 0) && e.situacao !== 'feita',
  }));

  // os grupos da rotina num menu só (como o "+ ▾" do GitHub): o ícone do grupo da vez e, aberto, todos (os da frente travados)
  const grupoDaVez = vm.grupos.find(g => g.atual);
  const itensDosGrupos: ItemMenu[] = [];
  vm.grupos.forEach((g, i) => {
    // separa a Preparação e o Fechamento do meio (Ativo, Passivo, Resultado)
    if (i > 0 && (i === 1 || i === vm.grupos.length - 1)) itensDosGrupos.push('separador');
    itensDosGrupos.push({ rotulo: g.nome, icone: ICONE_DO_GRUPO[g.nome] || 'list', marcado: g.atual, desabilitado: g.travado, onClick: () => vm.abrirGrupo(g.nome) });
  });
  // o Em lote voltou para a tela da Importação (Vitor, 05/10/2026): o menu é só o dos grupos
  const emLote = null;
  const botoesDaEtapa = vm.etapa && telaPronta && !vm.interrompendo && saida.state !== 'blocked';

  const topo = (
    <>
      <nav className="gh-topo-acoes" aria-label="Etapa">
        {vm.grupos.length > 0 && (
          <MenuSuspenso rotulo="" icone={grupoDaVez ? ICONE_DO_GRUPO[grupoDaVez.nome] || 'list' : 'checkCircle'} className="gh-topo-btn gh-topo-menu"
            dica={grupoDaVez ? grupoDaVez.nome + ' · ' + grupoDaVez.feitas + '/' + grupoDaVez.total : 'Grupos da rotina'} direita largura={300} conteudo={fechar => <MenuDaRotina grupos={itensDosGrupos} emLote={emLote} fechar={fechar} />} />
        )}
        {botoesDaEtapa && faltam && (
          // o sino com o número de pendências: abre a lista suspensa (como o Code ▾ do GitHub), cada uma com o Resolver
          <MenuSuspenso rotulo={<span className="falta-qtd">{itensQueFaltam.length}</span>} icone="sino" className="gh-topo-btn gh-topo-menu falta-btn"
            dica={'Para seguir, falta: ' + itensQueFaltam.length} titulo="Para seguir, falta" direita largura={380}
            conteudo={fechar => <ListaDoQueFalta itens={itensQueFaltam} onResolver={resolver} fechar={fechar} />} />
        )}
        {botoesDaEtapa && !faltam && requisitosConhecidos && (
          <button type="button" className="gh-topo-btn gh-topo-proximo" disabled={vm.conferindo} onClick={() => { void vm.proximo(semCheque); }}
            title={vm.conferindo ? 'Conferindo…' : 'Próximo (confere e segue para a próxima etapa)'} aria-label="Próximo">
            {vm.conferindo ? <span className="btn-spinner" /> : <Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} />}
          </button>
        )}
      </nav>
      <span className="gh-topo-sep" aria-hidden="true" />
      <MenuSuspenso rotulo={casca.perfil.foto ? <img className="gh-avatar-foto" src={casca.perfil.foto} alt="" /> : casca.perfil.iniciais} className="gh-avatar" dica={casca.perfil.nome} titulo={casca.perfil.nome} direita
        // o mesmo menu do avatar das outras telas (a Minha página) e, aqui, o Voltar às empresas; sair da etapa por
        // qualquer um deles é interromper (com a justificativa), como o resto do executor
        itens={[
          { rotulo: 'Voltar às empresas', icone: 'home', onClick: vm.sair },
          'separador',
          { rotulo: 'Minha conta', icone: 'usuario', onClick: () => casca.abrirPessoal('conta') },
          'separador',
          { rotulo: casca.perfil.sair, icone: 'logOut', onClick: casca.trocarPessoa },
        ]} />
      {/* interromper: o último, em vermelho (Vitor, 02/10/2026) */}
      {botoesDaEtapa && (
        <button type="button" className="gh-topo-btn gh-topo-fechar" onClick={vm.abrirInterromper} title="Interromper a etapa" aria-label="Interromper">
          <Icone nome="x" />
        </button>
      )}
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
          <div className="executor-ferramenta">
            {/* a ferramenta carregando: o N no meio, sobre um vidro embaçado (em vez da área vazia) */}
            {vm.ferramenta?.embutir && ferramentaAbrindo && <AberturaN vidro />}
            {vm.ferramenta?.embutir ? (
              <iframe ref={iframe} key={vm.ferramenta.url} src={vm.ferramenta.url} title={vm.ferramenta.nome} style={altura ? { height: altura } : undefined} />
            ) : vm.ferramenta ? (
              <div className="gh-blank">
                <Icone nome="link" />
                <h4>{vm.ferramenta.nome}</h4>
                <p>Esta etapa abre em outra aba.</p>
                <a className="btn btn-primary" href={vm.ferramenta.url} target="_blank" rel="noreferrer">Abrir {vm.ferramenta.nome}</a>
              </div>
            ) : temChecklist && !folha.itens ? (
              // o balancete ainda carregando: o N sobre o vidro (nada de texto no lugar)
              <AberturaN vidro />
            ) : temChecklist && folha.itens ? (
              // o checklist da etapa: a Contabilização da Folha (pelo balancete) ou as tarefas da etapa (o Fiscal), marcando em ordem
              <div className="card folha-check">
                <div className="folha-check-topo">
                  <h3>{vm.etapa.checklistDaFolha ? 'Contabilização da Folha' : vm.etapa.nome}</h3>
                  {folha.itens.length > 0 && <span className="folha-check-qtd">{folha.itens.filter(i => i.marcado).length}/{folha.itens.length}</span>}
                </div>
                {folha.itens.length ? (
                  <ul className="folha-check-lista">
                    {folha.itens.map(i => (
                      <li key={i.id} data-folha={i.nome} className={(i.marcado ? 'feito' : '') + (i.liberado ? '' : ' travado')}>
                        <label>
                          <input type="checkbox" checked={i.marcado} disabled={!i.liberado} onChange={() => folha.alternar(i.id)}
                            title={i.liberado ? undefined : i.marcado ? 'Desmarque antes os de baixo' : 'Conclua o item de cima primeiro'} />
                          <span className="folha-check-texto">
                            <b>{i.nome}</b>
                            {i.contas.length > 0 && <span className="hint">{i.contas.join(' · ')}</span>}
                            {i.aviso && <span className="folha-check-aviso"><Icone nome="alert" />{i.aviso}</span>}
                          </span>
                        </label>
                        {i.link && <a className="btn folha-check-link" href={i.link.url} target="_blank" rel="noreferrer"><Icone nome="link" />{i.link.rotulo}</a>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Pelo balancete importado, a empresa não tem folha (nenhuma conta da folha no Passivo: salários, pró-labore, férias, rescisão, FGTS, INSS).</p>
                )}
              </div>
            ) : vm.etapa.razao ? (
              <RazaoDaEtapa conta={vm.etapa.razao.conta} razao={razao} conferir={vm.etapa.conferir} />
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
