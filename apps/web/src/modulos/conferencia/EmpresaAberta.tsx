// Rota da empresa aberta: /:empresa/:secao/:pagina — resolve a empresa pelo slug,
// monta a sessão e a casca, e escolhe a tela.
import { Navigate, useParams } from 'react-router';
import { conferencia as c } from '@nads/core';
import { useRepo, useVersaoDoRepo } from '../../dados/repo';
import { Auditoria } from './auditoria/Auditoria';
import { Configuracoes } from './cadastro/Configuracoes';
import { CascaConferencia } from './CascaConferencia';
import { Checklist } from './checklist/Checklist';
import { Consulta } from './consulta/Consulta';
import { Importacao } from './importacao/Importacao';
import { LancamentosAutomaticos } from './lancamentos/LancamentosAutomaticos';
import { paginaPorId } from './navegacao';
import { Relatorio } from './relatorio/Relatorio';
import { SessaoProvider } from './sessao';
import { TopoProvider } from './topo';
import { VerificarConta } from './verificar/VerificarConta';

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
  // /:empresa = o código do ERP (ex.: /292/movimento/relatorio); empresa sem código, o slug do nome
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const repo = useRepo();
  useVersaoDoRepo();
  if (!repo.pronto()) return <div id="login"><p className="hint">Carregando…</p></div>;
  const achada = repo.empresaPelaRota(param);
  if (!achada) return <Navigate to="/" replace />;
  const { nome, rota } = achada;
  const id = secao + '/' + pagina;
  if (!paginaPorId(id)) {
    const e = repo.obter(nome) || c.empresaNova(nome);
    const t = c.telaInicialEmpresa(e);
    return <Navigate to={'/' + rota + '/' + t.secao + '/' + t.pagina} replace />;
  }
  // link antigo pelo nome (/fito-industria…/…) vira o do código (/292/…)
  if (param !== rota) return <Navigate to={'/' + rota + '/' + id} replace />;
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
