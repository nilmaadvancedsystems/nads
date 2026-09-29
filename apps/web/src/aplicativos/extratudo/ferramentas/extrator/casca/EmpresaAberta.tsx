// Rota da empresa aberta no Extrator: /extrator/:empresa/:secao/:pagina. Resolve a empresa (código
// do ERP ou nome), monta a sessão e a casca e escolhe a tela. Sem página (ou página que não existe),
// abre a Conferência quando já dá para conferir, senão a Importação.
import { empresas } from '@nads/core';
import { useCarregando } from '@nads/ui';
import { Navigate, useParams } from 'react-router';
import { TopoProvider } from '../../../../../comum/topo';
import { useRepo, useVersaoDoRepo } from '../dados/repo';
import { Auditoria } from '../telas/auditoria/Auditoria';
import { Conferencia } from '../telas/conferencia/Conferencia';
import { Importacao } from '../telas/importacao/Importacao';
import { Lancamentos } from '../telas/lancamentos/Lancamentos';
import { TarefaExtratos } from '../telas/tarefa/TarefaExtratos';
import { caminho } from './caminho';
import { CascaExtrator } from './CascaExtrator';
import { PAGINA_INICIAL, paginaPorId } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  switch (s.pagina) {
    case 'importacao/arquivos': return <Importacao />;
    case 'importacao/lancamentos': return <Lancamentos />;
    case 'conferencia/resultado': return s.falta ? <Navigate to={caminho(s.rota + '/' + PAGINA_INICIAL)} replace /> : <Conferencia />;
    case 'auditoria/historico': return <Auditoria />;
    case 'tarefa/extratos': return <TarefaExtratos />;
    default: return null;
  }
}

export function EmpresaAberta() {
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const repo = useRepo();
  useVersaoDoRepo();
  const achada = empresas.empresaPelaRota(repo.listarEmpresas(), param);
  useCarregando(!!achada && !repo.carregada(achada.nome));
  if (!achada) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(achada);
  // no banco: espera a empresa chegar (antes disso não dá para saber onde abrir, nem gravar)
  if (!repo.carregada(achada.nome)) return <div id="login"><p className="hint">Carregando…</p></div>;
  const id = secao + '/' + pagina;
  if (!paginaPorId(id) || param !== rota) {
    const guardada = repo.obter(achada.nome);
    const pronta = !!guardada && guardada.arquivos.some(a => a.lado === 'banco') && guardada.arquivos.some(a => a.lado === 'sistema');
    return <Navigate to={caminho(rota + '/' + (paginaPorId(id) ? id : pronta ? 'conferencia/resultado' : PAGINA_INICIAL))} replace />;
  }
  return (
    // key = empresa: trocar de empresa zera a sessão
    <SessaoProvider key={achada.nome} nome={achada.nome} rota={rota} codigo={achada.codigo} pagina={id}>
      <TopoProvider>
        <CascaExtrator>
          <Tela />
        </CascaExtrator>
      </TopoProvider>
    </SessaoProvider>
  );
}
