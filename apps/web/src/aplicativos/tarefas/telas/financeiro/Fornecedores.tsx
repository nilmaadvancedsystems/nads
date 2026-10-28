// Financeiro › Fornecedores (28/10/2026: "o cadastro de fornecedores do Toriba, no nads"): a busca, Ativos ou Todos, e a
// lista (o nome, a razão social, o CNPJ/CPF, a conta contábil padrão e quantas contas a pagar). Clicar na linha abre o
// fornecedor; "Novo fornecedor" abre a janela de cadastrar.
import { Icone, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { documentoFormatado } from './formatosDaNota';
import { JanelaDoFornecedor } from './JanelaDoFornecedor';
import { FILTROS_DE_FORNECEDORES, useFornecedores } from './useFornecedores';

export function Fornecedores() {
  const vm = useFornecedores();
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.aberto && <JanelaDoFornecedor id={vm.aberto.id} fechar={vm.fechar} />}

      <div className="tarefas-barra-topo fin-barra">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" autoFocus placeholder="Buscar fornecedor" aria-label="Buscar fornecedor (nome ou CNPJ/CPF)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <Segmentado valor={vm.filtro} opcoes={FILTROS_DE_FORNECEDORES} onMudar={vm.setFiltro} />
        <span className="fin-acoes">
          {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo fornecedor</button>
        </span>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {!vm.carregando && !vm.linhas.length ? (
        <Vazio icone="predio" titulo={vm.total ? 'Nenhum fornecedor com isso' : 'Nenhum fornecedor ainda'}>
          {vm.total
            ? <button type="button" className="btn btn-outline" onClick={() => { vm.setBusca(''); vm.setFiltro('todos'); }}>Limpar a busca e ver todos</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Cadastrar o primeiro</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista fin-lista">
            <thead><tr><th>Fornecedor</th><th>CNPJ ou CPF</th><th>Conta contábil</th><th className="fin-direita">Contas</th><th>Situação</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(({ fornecedor: f, nome, conta, contas }) => (
                <tr key={f.id} className="linha-abre" tabIndex={0} title="Abrir o fornecedor" onClick={() => vm.abrir({ id: f.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: f.id }); }}>
                  <td>
                    <span className="cad-empresa-nome">{nome}</span>
                    {f.razaoSocial && f.razaoSocial !== nome && <span className="fraco nf-doc">{f.razaoSocial}</span>}
                  </td>
                  <td className="num fraco">{f.documento ? documentoFormatado(f.documento) : '—'}</td>
                  <td className="fraco">{conta ? <span className="fin-corta" title={conta.descricao}>{conta.codigo} · {conta.descricao}</span> : '—'}</td>
                  <td className="num fin-direita">{contas}</td>
                  <td>{f.ativo ? <span className="badge badge-ok">Ativo</span> : <span className="badge badge-neutral">Inativo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
