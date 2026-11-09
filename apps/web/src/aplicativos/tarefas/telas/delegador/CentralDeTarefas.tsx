// A Central de tarefas (28/10/2026: "ele irá estar em perfil e vai abrir uma central de tarefas onde irá ser delegada a
// tarefa para a pessoa selecionada"): a janela flutuante no layout do cadastro (o usuário gosta dele: "seguir o layout do
// cadastro"): no topo o nome e o ×; à esquerda Minhas tarefas, Delegadas por mim e Concluídas, com quantas tem; no meio a
// barra (Nova tarefa, a busca, o status e o Exportar) e a tabela. A tarefa abre numa janela por cima da lista (09/11/2026). No corpo
// da página (createPortal): dentro do cabeçalho ela ficaria presa no tamanho dele.
import { BotaoFechar, Icone, LogoExcel, MenuSuspenso, useCarregando, useJanela, Vazio, type NomeIcone } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { TabelaDeTarefas } from './partes/TabelaDeTarefas';
import { TarefaAberta } from './TarefaAberta';
import { useCentralDeTarefas, type AbaDaCentral } from './useCentralDeTarefas';

// a cor e o ícone de cada número do alto (os do Contas a pagar)
const DO_NUMERO: Record<string, { tom: 'neutro' | 'aviso' | 'info' | 'roxo' | 'laranja' | 'ok'; icone: NomeIcone }> = {
  '': { tom: 'neutro', icone: 'checklist' },
  pendente: { tom: 'aviso', icone: 'caixaEntrada' },
  andamento: { tom: 'info', icone: 'play' },
  pausada: { tom: 'roxo', icone: 'clock' },
  atrasadas: { tom: 'laranja', icone: 'alert' },
  concluida: { tom: 'ok', icone: 'check' },
  cancelada: { tom: 'neutro', icone: 'x' },
};

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

/** A lista, no jeito do Contas a pagar. semTitulo: no módulo Minhas tarefas, o título já vem da casca. */
export function ListaDaCentral({ vm, semTitulo }: { vm: ReturnType<typeof useCentralDeTarefas>; semTitulo?: boolean }) {
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      {!semTitulo && <h2 className="cfg-titulo">{vm.abas.find(a => a.ativa)?.rotulo}</h2>}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuDeFiltro rotulo="Prioridade" valor={vm.prioridade} mudar={vm.setPrioridade} todos="Todas as prioridades" opcoes={vm.opcoesDePrioridade} />
        {vm.pessoas.length > 0 && <MenuDeFiltro rotulo={vm.colunaDaPessoa} valor={vm.quem} mudar={vm.setQuem} todos="Todas as pessoas" opcoes={vm.pessoas} />}
        {vm.algumFiltro && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar filtros</button>}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {/* os números coloridos; clicar num filtra a lista, clicar de novo volta a todas */}
      <div className="stat-grid dp-numeros">
        {vm.numeros.map(n => {
          const ativo = !!n.filtro && vm.filtro === n.filtro;
          return (
            <button key={n.filtro || 'todas'} type="button" className={'stat stat-filtro painel-numero painel-' + DO_NUMERO[n.filtro].tom + (ativo ? ' ativo' : '')}
              aria-pressed={ativo} title={!n.filtro || ativo ? 'Mostrar todas' : 'Mostrar só: ' + n.rotulo.toLowerCase()}
              onClick={() => vm.setFiltro(ativo ? '' : n.filtro)}>
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome={DO_NUMERO[n.filtro].icone} /></span>
              <p className="stat-label">{n.rotulo}</p>
              <p className="stat-value num">{vm.carregando ? '—' : n.quantas}</p>
            </button>
          );
        })}
      </div>

      {/* o topo da tabela: a busca e o Excel só com o ícone */}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar tarefa" aria-label="Buscar nas tarefas (número, título, descrição, cliente)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <MenuSuspenso rotulo={<LogoExcel />} semSeta className="icon-btn" titulo="Exportar a lista" dica="Exportar a lista" direita
          itens={[
            { rotulo: 'Planilha do Excel (.xlsx)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('xlsx') },
            { rotulo: 'Texto separado (.csv)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('csv') },
          ]} />
      </div>
      <section className="card dp-lista dp-lista-fixa">
        {!vm.carregando && !vm.linhas.length ? (
          <Vazio icone="checklist" titulo={vm.vazio}>
            {vm.abaVazia
              ? <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>
              : <button type="button" className="btn btn-outline" onClick={vm.limparFiltros}>Limpar os filtros</button>}
          </Vazio>
        ) : !vm.carregando && <TabelaDeTarefas linhas={vm.linhas} colunaDaPessoa={vm.colunaDaPessoa} colunaExtra={vm.colunaExtra} abrir={vm.abrir} fazerAcao={vm.fazerAcao} />}
      </section>
    </section>
  );
}
