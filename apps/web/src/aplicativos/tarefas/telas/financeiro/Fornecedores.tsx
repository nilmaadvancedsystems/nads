// Financeiro › Contas a pagar › Fornecedores (28/10/2026: "o cadastro de fornecedores do Toriba, no nads"), numa janela
// aberta pelo botão das Contas a pagar (30/10/2026: "joga essa tela de fornecedores para um botão dentro de contas a
// pagar"): em cima, a Situação num menu (Ativos, Inativos, Todos), a busca e o Novo fornecedor; embaixo, a lista (o nome,
// a razão social, o CNPJ/CPF, a conta contábil padrão e quantas contas a pagar). Clicar na linha abre o fornecedor, numa
// janela por cima desta.
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { MenuDeFiltro } from '../dp/MenuDeFiltro';
import { JanelaDeMinhasEmpresas } from '../empresas/partes/JanelaDeMinhasEmpresas';
import { documentoFormatado } from './formatosDaNota';
import { JanelaDoFornecedor } from './JanelaDoFornecedor';
import { FILTROS_DE_FORNECEDORES, useFornecedores, type FiltroDeFornecedores } from './useFornecedores';

export function JanelaDosFornecedores({ fechar }: { fechar: () => void }) {
  const vm = useFornecedores();
  useCarregando(vm.carregando);
  return (
    <>
      <JanelaDeMinhasEmpresas titulo="Fornecedores" icone="predio" tabela fechar={fechar}>
        <div className="tarefas-barra-topo dp-filtros-linha fornecedores-barra">
          <MenuDeFiltro rotulo="Situação" valor={vm.filtro} mudar={v => vm.setFiltro(v as FiltroDeFornecedores)} opcoes={FILTROS_DE_FORNECEDORES} />
          <span className="tarefas-barra-espaco" />
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" autoFocus placeholder="Buscar fornecedor" aria-label="Buscar fornecedor (nome ou CNPJ/CPF)" value={vm.busca}
              onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && vm.busca) { e.preventDefault(); vm.setBusca(''); } }} />
          </label>
          {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo fornecedor</button>
        </div>
        {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
        {!vm.carregando && !vm.linhas.length ? (
          <Vazio icone="predio" titulo={vm.total ? 'Nenhum fornecedor com isso' : 'Nenhum fornecedor ainda'}>
            {vm.total
              ? <button type="button" className="btn btn-outline" onClick={() => { vm.setBusca(''); vm.setFiltro(''); }}>Limpar a busca e ver todos</button>
              : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Cadastrar o primeiro</button>}
          </Vazio>
        ) : (
          <table className="dp-tabela">
            <thead><tr><th>Fornecedor</th><th>CNPJ ou CPF</th><th>Conta contábil</th><th className="num">Contas</th><th>Situação</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(({ fornecedor: f, nome, conta, contas }) => (
                <tr key={f.id} className="linha-abre" tabIndex={0} title="Abrir o fornecedor" onClick={() => vm.abrir({ id: f.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: f.id }); }}>
                  <td className="dp-cliente">
                    <span className="dp-cliente-nome">{nome}</span>
                    {f.razaoSocial && f.razaoSocial !== nome && <span className="dp-cliente-info">{f.razaoSocial}</span>}
                  </td>
                  <td className="num fraco">{f.documento ? documentoFormatado(f.documento) : '—'}</td>
                  <td className="fraco">{conta ? <span className="fin-corta" title={conta.descricao}>{conta.codigo} · {conta.descricao}</span> : '—'}</td>
                  <td className="num">{contas}</td>
                  <td>{f.ativo ? <span className="badge badge-ok">Ativo</span> : <span className="badge badge-neutral">Inativo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </JanelaDeMinhasEmpresas>
      {/* fora da janela da lista, para ficar por cima dela */}
      {vm.aberto && <JanelaDoFornecedor id={vm.aberto.id} fechar={vm.fechar} />}
    </>
  );
}
