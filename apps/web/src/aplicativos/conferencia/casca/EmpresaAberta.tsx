// Rota da empresa aberta: /:empresa/:secao/:pagina — resolve a empresa pelo slug,
// monta a sessão e a casca, e escolhe a tela.
import { Navigate, useParams } from 'react-router';
import { conferencia as c } from '@nads/core';
import { useRepo, useVersaoDoRepo } from '../dados/repo';
import { Auditoria } from '../telas/auditoria/Auditoria';
import { Configuracoes } from '../telas/cadastro/Configuracoes';
import { CascaConferencia } from './CascaConferencia';
import { Checklist } from '../telas/checklist/Checklist';
import { Consulta } from '../telas/consulta/Consulta';
import { Importacao } from '../telas/importacao/Importacao';
import { LancamentosAutomaticos } from '../telas/lancamentos/LancamentosAutomaticos';
import { paginaPorId } from './navegacao';
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
  // /conferencia/:empresa = o código do ERP (ex.: /conferencia/292/movimento/relatorio); empresa sem código, o slug do nome
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const repo = useRepo();
  useVersaoDoRepo();
  if (!repo.pronto()) return <div id="login"><p className="hint">Carregando…</p></div>;
  const achada = repo.empresaPelaRota(param);
  if (!achada) return <Navigate to={caminho()} replace />;
  const { nome, rota } = achada;
  const id = secao + '/' + pagina;
  if (!paginaPorId(id)) {
    const e = repo.obter(nome) || c.empresaNova(nome);
    const t = c.telaInicialEmpresa(e);
    return <Navigate to={caminho(rota + '/' + t.secao + '/' + t.pagina)} replace />;
  }
  // link antigo pelo nome (/conferencia/fito-industria…/…) vira o do código (/conferencia/292/…)
  if (param !== rota) return <Navigate to={caminho(rota + '/' + id)} replace />;
  return (
    // key = empresa: trocar de empresa zera a sessão (como o entrar() do original)
    <SessaoProvider key={nome} nome={nome} rota={rota} codigo={achada.codigo} pagina={id}>
      <TopoProvider>
        <CascaConferencia>
          <Tela pagina={id} />
        </CascaConferencia>
      </TopoProvider>
    </SessaoProvider>
  );
}
