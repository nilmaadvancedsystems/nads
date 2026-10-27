// Financeiro › Plano de contas (19/10/2026: "o Plano de Contas do Toriba, no nads"): a árvore das contas (classificação,
// descrição, tipo, se está ativa), recuada pelo nível. Clicar numa conta abre para alterar; "Nova conta" abre a janela de criar.
// "Exportar Excel" baixa as contas da tela (Savio, 23/10/2026).
import { baixarBytes, Icone, useCarregando, Vazio } from '@nads/ui';
import { JanelaDaConta } from './JanelaDaConta';
import { LinhaDoPlano } from './partes/LinhaDoPlano';
import { usePlanoDeContas } from './usePlanoDeContas';

export function PlanoDeContas() {
  const vm = usePlanoDeContas();
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.aberta && <JanelaDaConta id={vm.aberta.id} pai={vm.aberta.pai} fechar={vm.fechar} />}
      <div className="tarefas-barra-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar conta" aria-label="Buscar conta (classificação ou descrição)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-outline" disabled={!vm.linhas.length}
          onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
          <Icone nome="download" width={16} height={16} />Exportar Excel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Nova conta</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.carregando && !vm.linhas.length ? (
        <Vazio icone="list" titulo={vm.total ? 'Nenhuma conta com isso' : 'O plano de contas está vazio'}>
          {vm.total
            ? <button type="button" className="btn btn-outline" onClick={() => vm.setBusca('')}>Limpar a busca</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Criar a primeira conta</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <ul className="fin-arvore">
            {!vm.carregando && vm.linhas.map(({ conta, fundo }) => <LinhaDoPlano key={conta.id} conta={conta} fundo={fundo} aoAbrir={() => vm.abrir({ id: conta.id })} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
