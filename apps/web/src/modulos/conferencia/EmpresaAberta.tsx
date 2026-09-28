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
  const { empresa: slug = '', secao = '', pagina = '' } = useParams();
  const repo = useRepo();
  useVersaoDoRepo();
  const nome = repo.nomePorSlug(slug);
  if (!nome) return <Navigate to="/" replace />;
  const id = secao + '/' + pagina;
  if (!paginaPorId(id)) {
    const e = repo.obter(nome) || c.empresaNova(nome);
    const t = c.telaInicialEmpresa(e);
    return <Navigate to={'/' + slug + '/' + t.secao + '/' + t.pagina} replace />;
  }
  return (
    // key = empresa: trocar de empresa zera a sessão (como o entrar() do original)
    <SessaoProvider key={nome} nome={nome} slug={slug} pagina={id}>
      <TopoProvider>
        <CascaConferencia>
          <Tela pagina={id} />
        </CascaConferencia>
      </TopoProvider>
    </SessaoProvider>
  );
}
