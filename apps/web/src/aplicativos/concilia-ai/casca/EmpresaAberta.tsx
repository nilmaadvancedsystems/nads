// Rota da empresa aberta: /:empresa/:secao/:pagina — resolve a empresa pelo código (ou slug),
// monta a sessão e a casca, e escolhe a tela: uma página da Conferência ou uma ferramenta
// (/:empresa/conciliadorzinho/:etapa, /:empresa/cheque-especial/:pagina, /:empresa/creditor/:etapa).
import { Navigate, useParams } from 'react-router';
import { conferencia as c } from '@nads/core';
import { useRepo, useVersaoDoRepo } from '../dados/repo';
import { FerramentaCheque } from '../ferramentas/cheque-especial/casca/Ferramenta';
import { FerramentaConciliador } from '../ferramentas/conciliadorzinho/casca/Ferramenta';
import { FerramentaCreditor } from '../ferramentas/creditor/casca/Ferramenta';
import { Auditoria } from '../telas/auditoria/Auditoria';
import { Configuracoes } from '../telas/cadastro/Configuracoes';
import { CascaConciliaAi } from './CascaConciliaAi';
import { Checklist } from '../telas/checklist/Checklist';
import { Consulta } from '../telas/consulta/Consulta';
import { Importacao } from '../telas/importacao/Importacao';
import { LancamentosAutomaticos } from '../telas/lancamentos/LancamentosAutomaticos';
import { ferramentaPorId, paginaPorId } from './navegacao';
import { Relatorio } from '../telas/relatorio/Relatorio';
import { SessaoProvider } from './sessao';
import { TopoProvider } from '../../../comum/topo';
import { VerificarConta } from '../telas/verificar/VerificarConta';
import { caminho } from './caminho';

function Tela({ pagina }: { pagina: string }) {
  if (pagina.startsWith('importacao/')) return <Importacao key={pagina} tipo={pagina.split('/')[1] as c.PaginaImportacao} />;
  switch (pagina) {
    case 'cadastro/configuracoes': return <Configuracoes />;
    case 'cadastro/lancamentos-automaticos': return <LancamentosAutomaticos />;
    case 'movimento/relatorio': return <Relatorio />;
    case 'movimento/checklist': return <Checklist />;
    case 'movimento/consulta': return <Consulta />;
    case 'movimento/verificar': return <VerificarConta />;
    case 'auditoria/historico': return <Auditoria />;
    default: return null;
  }
}

export function EmpresaAberta() {
  // :empresa = o código do ERP (ex.: /292/movimento/relatorio); empresa sem código, o slug do nome
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const repo = useRepo();
  useVersaoDoRepo();
  if (!repo.pronto()) return <div id="login"><p className="hint">Carregando…</p></div>;
  const achada = repo.empresaPelaRota(param);
  if (!achada) return <Navigate to={caminho()} replace />;
  const { nome, rota } = achada;
  const ferramenta = ferramentaPorId(secao);
  const id = secao + '/' + pagina;
  if (!ferramenta && !paginaPorId(id)) {
    const e = repo.obter(nome) || c.empresaNova(nome);
    const t = c.telaInicialEmpresa(e);
    return <Navigate to={caminho(rota + '/' + t.secao + '/' + t.pagina)} replace />;
  }
  // link antigo pelo nome (/fito-industria…/…) vira o do código (/292/…)
  if (param !== rota) return <Navigate to={caminho(rota + '/' + id)} replace />;
  const empresa = { nome, codigo: achada.codigo };
  return (
    // key = empresa: trocar de empresa zera a sessão (como o entrar() do original)
    <SessaoProvider key={nome} nome={nome} rota={rota} codigo={achada.codigo} pagina={id}>
      <TopoProvider>
        {ferramenta?.id === 'conciliadorzinho' ? <FerramentaConciliador empresa={empresa} rota={rota} pagina={pagina} />
          : ferramenta?.id === 'cheque-especial' ? <FerramentaCheque empresa={empresa} rota={rota} pagina={pagina} />
            : ferramenta?.id === 'creditor' ? <FerramentaCreditor empresa={empresa} rota={rota} pagina={pagina} />
            : <CascaConciliaAi><Tela pagina={id} /></CascaConciliaAi>}
      </TopoProvider>
    </SessaoProvider>
  );
}
