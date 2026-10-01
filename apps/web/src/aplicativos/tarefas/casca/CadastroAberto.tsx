// Rotas do Cadastro: a lista de empresas (/tarefas/cadastro/empresas) e, por cima dela, a janela de uma empresa
// (/tarefas/cadastro/empresas/:empresa/:aba). As duas usam este mesmo componente, então a lista (com a busca)
// continua montada atrás da janela. Empresa que não está na lista volta para a lista; aba que não existe vai
// para as contas bancárias. Os links antigos (/tarefas/cadastro/:empresa/:aba) levam para os novos.
import { useSemAnimacao } from '@nads/ui';
import { Navigate, useParams } from 'react-router';
import { empresaDaRota } from '../../../comum/empresaDaRota';
import { TopoProvider } from '../../../comum/topo';
import { EscolherEmpresaCadastro } from '../telas/cadastro/escolher/EscolherEmpresaCadastro';
import { JanelaDaEmpresa } from '../telas/cadastro/janela/JanelaDaEmpresa';
import { CascaTarefas } from './CascaTarefas';
import { ABAS_DO_CADASTRO, caminhoDoCadastro } from './navegacao';

export function CadastroAberto() {
  // o Cadastro não tem animação nenhuma (a lista, a janela da empresa, as abas, os botões)
  useSemAnimacao();
  const { empresa = '', aba = '' } = useParams();
  const existe = !empresa || !!empresaDaRota(empresa);
  const abaExiste = !empresa || ABAS_DO_CADASTRO.some(a => a.id === aba);
  if (!existe) return <Navigate to={caminhoDoCadastro(null)} replace />;
  if (!abaExiste) return <Navigate to={caminhoDoCadastro(empresa)} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app="cadastro" pagina="empresas">
        <EscolherEmpresaCadastro />
        {empresa && <JanelaDaEmpresa key={empresa} rota={empresa} aba={aba} />}
      </CascaTarefas>
    </TopoProvider>
  );
}

/** Link antigo (/tarefas/cadastro/292/bancos): leva para a janela da empresa no endereço novo. */
export function CadastroAntigo() {
  const { empresa = '', aba = '' } = useParams();
  return <Navigate to={caminhoDoCadastro(empresa, ABAS_DO_CADASTRO.some(a => a.id === aba) ? aba : 'bancos')} replace />;
}
