// Rota da empresa aberta no Cheque especial: /cheque-especial/:empresa/:secao/:pagina.
// Resolve a empresa (código do ERP ou nome), acerta a URL e monta a casca com a tela.
import { empresas } from '@nads/core';
import { Navigate, useParams } from 'react-router';
import { empresaDaRota } from '../../../comum/empresaDaRota';
import { TopoProvider } from '../../../comum/topo';
import { Ajuste } from '../telas/ajuste/Ajuste';
import { caminho } from './caminho';
import { CascaCheque } from './CascaCheque';
import { PAGINA_INICIAL, paginaPorId } from './navegacao';

export function EmpresaAberta() {
  const { empresa: param = '', secao = '', pagina = '' } = useParams();
  const empresa = empresaDaRota(param);
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  const id = secao + '/' + pagina;
  if (!paginaPorId(id) || param !== rota) return <Navigate to={caminho(rota + '/' + (paginaPorId(id) ? id : PAGINA_INICIAL))} replace />;
  return (
    // key = empresa: trocar de empresa começa do zero (nada é guardado)
    <TopoProvider key={rota}>
      <CascaCheque empresa={empresa} rota={rota} pagina={id}>
        <Ajuste empresa={empresa} />
      </CascaCheque>
    </TopoProvider>
  );
}
