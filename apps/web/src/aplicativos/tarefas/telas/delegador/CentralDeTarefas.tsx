// A Central de tarefas (28/10/2026: "ele irá estar em perfil e vai abrir uma central de tarefas onde irá ser delegada a
// tarefa para a pessoa selecionada"): a janela flutuante no layout do cadastro (o usuário gosta dele: "seguir o layout do
// cadastro"): no topo o nome e o ×; à esquerda Minhas tarefas, Delegadas por mim e Concluídas, com quantas tem; no meio a
// barra (Nova tarefa, a busca, o status e o Exportar) e a tabela. A tarefa abre no lugar da lista, com "‹ Voltar". No corpo
// da página (createPortal): dentro do cabeçalho ela ficaria presa no tamanho dele.
import { BotaoFechar, Esqueleto, Icone, MenuSuspenso, Vazio, Alerta, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TabelaDeTarefas } from './partes/TabelaDeTarefas';
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
            {vm.aberta ? <TarefaAberta key={vm.aberta} alvo={vm.aberta} voltar={vm.voltar} criada={vm.criada} saida={saida} /> : <ListaDaCentral vm={vm} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ListaDaCentral({ vm }: { vm: ReturnType<typeof useCentralDeTarefas> }) {
  return (
    <>
      <h2 className="cfg-titulo">{vm.abas.find(a => a.ativa)?.rotulo}</h2>
      <div className="tarefas-barra-topo tdl-barra">
        <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" width={16} height={16} />Nova tarefa</button>
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="O que você procura?" aria-label="Buscar nas tarefas" />
        </label>
        <MenuSuspenso rotulo={vm.rotuloDoStatus} icone="filtro" titulo="Filtrar pelo status"
          itens={vm.opcoesDeStatus.map(o => ({ rotulo: o.rotulo, marcado: o.valor === vm.status, onClick: () => vm.setStatus(o.valor) }))} />
        <span className="tarefas-barra-espaco" />
        <MenuSuspenso rotulo="Exportar" icone="download" titulo="Exportar a lista" direita
          itens={[
            { rotulo: 'Planilha do Excel (.xlsx)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('xlsx') },
            { rotulo: 'Texto separado (.csv)', icone: 'relatorio', desabilitado: !vm.podeExportar, onClick: () => vm.exportar('csv') },
          ]} />
      </div>
      {vm.erro && <Alerta naLinha titulo={vm.erro} />}
      {vm.carregando ? <Esqueleto linhas={6} />
        : !vm.linhas.length ? <Vazio icone="checklist" titulo={vm.vazio} />
          : <TabelaDeTarefas linhas={vm.linhas} colunaDaPessoa={vm.colunaDaPessoa} abrir={vm.abrir} />}
    </>
  );
}
