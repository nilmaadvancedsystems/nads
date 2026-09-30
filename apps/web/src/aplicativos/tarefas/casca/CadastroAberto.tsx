// Rota de uma página do Cadastro com a empresa aberta: /tarefas/cadastro/:empresa/:pagina.
// Empresa que não está na lista volta para a escolha; página que não existe vai para as contas bancárias.
// Trocar de empresa remonta a página (nada da empresa anterior fica na tela).
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { empresaDaRota } from '../../../comum/empresaDaRota';
import { TopoProvider } from '../../../comum/topo';
import { ContasBancarias } from '../telas/cadastro/bancos/ContasBancarias';
import { ContasPadrao } from '../telas/cadastro/contas-padrao/ContasPadrao';
import { HistoricoCadastro } from '../telas/cadastro/historico/HistoricoCadastro';
import { lembrarEmpresa } from '../telas/cadastro/partes/useEscolherNoCadastro';
import { PlanoDeContas } from '../telas/cadastro/plano/PlanoDeContas';
import { CascaTarefas } from './CascaTarefas';
import { aplicacao, caminhoDoCadastro } from './navegacao';

function Tela({ rota, pagina }: { rota: string; pagina: string }) {
  switch (pagina) {
    case 'plano': return <PlanoDeContas rota={rota} />;
    case 'contas-padrao': return <ContasPadrao rota={rota} />;
    case 'historico': return <HistoricoCadastro rota={rota} />;
    default: return <ContasBancarias rota={rota} />;
  }
}

export function CadastroAberto() {
  const { empresa = '', pagina = '' } = useParams();
  const existe = !!empresaDaRota(empresa);
  const paginaExiste = !!aplicacao('cadastro')?.paginas.some(p => p.id === pagina);
  useEffect(() => { if (existe) lembrarEmpresa(empresa); }, [existe, empresa]);
  if (!existe) return <Navigate to={caminhoDoCadastro(null, paginaExiste ? pagina : 'bancos')} replace />;
  if (!paginaExiste) return <Navigate to={caminhoDoCadastro(empresa, 'bancos')} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app="cadastro" pagina={pagina} rotaEmpresa={empresa}>
        <Tela key={empresa} rota={empresa} pagina={pagina} />
      </CascaTarefas>
    </TopoProvider>
  );
}
