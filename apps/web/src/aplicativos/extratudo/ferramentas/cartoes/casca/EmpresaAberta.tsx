// Rota da empresa aberta no Cartões: /extratudo/:empresa/cartoes/:secao/:pagina. Resolve a empresa (código do ERP ou
// nome), acerta a URL (mantendo o período da Tarefa) e monta a casca com a tela.
import { empresas } from '@nads/core';
import { Navigate, useLocation, useParams } from 'react-router';
import { TopoProvider } from '../../../../../comum/topo';
import { useEmpresaDoExtratudo } from '../../../empresas';
import { Compras } from '../telas/compras/Compras';
import { caminho } from './caminho';
import { CascaCartoes } from './CascaCartoes';
import { PAGINA_INICIAL, paginaPorId } from './navegacao';

export function EmpresaAberta() {
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const { search } = useLocation();
  const empresa = useEmpresaDoExtratudo(param);
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  const id = secao + '/' + pagina;
  if (!paginaPorId(id) || param !== rota) return <Navigate to={caminho(rota + '/' + (paginaPorId(id) ? id : PAGINA_INICIAL)) + search} replace />;
  return (
    // key = empresa: trocar de empresa começa do zero (a fatura fica só na tela)
    <TopoProvider key={rota}>
      <CascaCartoes empresa={empresa} rota={rota} pagina={id}>
        <Compras empresa={empresa} />
      </CascaCartoes>
    </TopoProvider>
  );
}
