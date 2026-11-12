// A Central de tarefas (28/10/2026: "ele irá estar em perfil e vai abrir uma central de tarefas onde irá ser delegada a
// tarefa para a pessoa selecionada"): a janela flutuante no layout do cadastro (o usuário gosta dele: "seguir o layout do
// cadastro"): no topo o nome e o ×; à esquerda Minhas tarefas, Delegadas por mim e Concluídas, com quantas tem; no meio a
// barra (Nova tarefa, a busca, o status e o Exportar) e a tabela. A tarefa abre numa janela por cima da lista (09/11/2026). No corpo
// da página (createPortal): dentro do cabeçalho ela ficaria presa no tamanho dele.
import { BotaoFechar, Icone, LogoExcel, MenuSuspenso, useCarregando, useJanela, Vazio } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { DA_SITUACAO, ListaDeTarefas } from './partes/ListaDeTarefas';
import { TarefaAberta } from './TarefaAberta';
import { useCentralDeTarefas, type AbaDaCentral } from './useCentralDeTarefas';

const ICONE_DA_ABA = { minhas: 'caixaEntrada', delegadas: 'aviao', concluidas: 'checkCircle' } as const;

export function CentralDeTarefas({ aba, fechar }: { aba: AbaDaCentral; fechar: () => void }) {
  const vm = useCentralDeTarefas(aba);
  // a tarefa aberta pergunta antes de ser largada (se mudou algo); sem tarefa aberta, segue direto
  const saida = useRef<((depois: () => void) => void) | null>(null);
  const sair = (depois: () => void) => (saida.current ? saida.current(depois) : depois());

  // a página de trás não rola com a janela aberta
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);
  // o Esc: com a tarefa aberta, volta para a lista; na lista, fecha a Central
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, () => (vm.aberta ? sair(vm.voltar) : fechar()));

  return createPortal(
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) sair(fechar); }}>
      <div ref={janela} className="cad-janela tdl-central" role="dialog" aria-modal="true" aria-label="Central de tarefas">
        <header className="cad-janela-topo">
          <span className="cad-janela-empresa">
            <Icone nome="checklist" width={18} height={18} />
            <span className="cad-janela-nome">Central de tarefas</span>
          </span>
          <BotaoFechar onClick={() => sair(fechar)} />
        </header>
        <div className="cad-janela-corpo">
          <nav className="cad-janela-abas" aria-label="Tarefas">
            {vm.abas.map(a => (
              <button key={a.id} type="button" className={'cad-janela-aba' + (a.ativa ? ' ativa' : '')} aria-current={a.ativa ? 'page' : undefined}
                onClick={() => sair(() => vm.mudarAba(a.id))}>
                <Icone nome={ICONE_DA_ABA[a.id]} width={16} height={16} />{a.rotulo}
                {a.qtd > 0 && <span className="tdl-aba-qtd" aria-label={a.qtd + (a.qtd === 1 ? ' tarefa' : ' tarefas')}>{a.qtd}</span>}
              </button>
            ))}
          </nav>
          <div className="cad-janela-conteudo tdl-conteudo">
            <ListaDaCentral vm={vm} />
            {vm.aberta && <TarefaAberta key={vm.aberta} alvo={vm.aberta} voltar={vm.voltar} criada={vm.criada} saida={saida} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A lista (09/11/2026: "dá uma repaginada total"): a barra com a busca, os filtros e o Nova tarefa; no cartão, as situações que filtram ao clicar e a lista agrupada pelo prazo. semTitulo: no Início, as abas já dizem qual é. */
export function ListaDaCentral({ vm, semTitulo }: { vm: ReturnType<typeof useCentralDeTarefas>; semTitulo?: boolean }) {
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      {!semTitulo && <h2 className="cfg-titulo">{vm.abas.find(a => a.ativa)?.rotulo}</h2>}
      <div className="tarefas-barra-topo tdl-barra">
        {!vm.abaVazia && (
          <>
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" placeholder="Buscar por número, título ou cliente" aria-label="Buscar nas tarefas (número, título, descrição, cliente)" value={vm.busca}
                onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
            </label>
            <MenuDeFiltro rotulo="Prioridade" valor={vm.prioridade} mudar={vm.setPrioridade} todos="Todas as prioridades" opcoes={vm.opcoesDePrioridade} />
            {vm.pessoas.length > 0 && <MenuDeFiltro rotulo={vm.colunaDaPessoa} valor={vm.quem} mudar={vm.setQuem} todos="Todas as pessoas" opcoes={vm.pessoas} />}
            {vm.algumFiltro && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar</button>}
          </>
        )}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {!vm.abaVazia && (
          <MenuSuspenso rotulo={<LogoExcel />} semSeta className="icon-btn" titulo="Exportar a lista" dica="Exportar a lista" direita
            itens={[
              { rotulo: 'Planilha do Excel (.xlsx)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('xlsx') },
              { rotulo: 'Texto separado (.csv)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('csv') },
            ]} />
        )}
        {/* pedir documentos a alguém do escritório (12/11/2026): a nova já como pedido; quem recebe anexa e confirma */}
        <button type="button" className="btn btn-outline" onClick={vm.pedirDocumentos} title="Delegar a alguém do escritório um pedido de documentos"><Icone nome="clipe" />Pedir documentos</button>
        <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {!vm.carregando && (
        <section className="card tdl-caixa">
          {/* as situações: clicar filtra a lista, clicar de novo volta a todas */}
          {!vm.abaVazia && (
            <div className="tdl-situacoes" role="group" aria-label="Filtrar pela situação">
              {vm.numeros.map(n => {
                const ativo = vm.filtro === n.filtro;
                const s = DA_SITUACAO[n.filtro];
                return (
                  <button key={n.filtro || 'todas'} type="button" className={'tdl-situacao painel-' + s.tom + (ativo ? ' ativo' : '') + (n.filtro === 'atrasadas' && n.quantas > 0 ? ' alerta' : '')}
                    aria-pressed={ativo} title={!n.filtro || ativo ? 'Mostrar todas' : 'Mostrar só: ' + n.rotulo.toLowerCase()}
                    onClick={() => vm.setFiltro(ativo ? '' : n.filtro)}>
                    <Icone nome={s.icone} width={16} height={16} />{n.rotulo}<span className="num tdl-situacao-qtd">{n.quantas}</span>
                  </button>
                );
              })}
            </div>
          )}
          {vm.temLinhas
            ? <ListaDeTarefas grupos={vm.grupos} colunaDaPessoa={vm.colunaDaPessoa} comAcoes={vm.comAcoes} abrir={vm.abrir} fazerAcao={vm.fazerAcao} />
            : (
              <Vazio icone={vm.abaVazia ? 'checkCircle' : 'search'} titulo={vm.vazio.titulo} texto={vm.vazio.texto}>
                {!vm.abaVazia && <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar os filtros</button>}
              </Vazio>
            )}
        </section>
      )}
    </section>
  );
}
