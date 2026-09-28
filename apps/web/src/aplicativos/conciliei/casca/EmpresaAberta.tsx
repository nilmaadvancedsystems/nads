// Rota da empresa aberta no Conciliei: /conciliei/:empresa/:ferramenta/:secao/:pagina.
// Resolve a empresa (código do ERP ou nome), acerta a URL e abre a ferramenta pedida
// (sem ferramenta, ou com uma que não existe: a primeira da caixa).
import { empresas } from '@nads/core';
import { Navigate, useParams } from 'react-router';
import { empresaDaRota } from '../../../comum/empresaDaRota';
import { TopoProvider } from '../../../comum/topo';
import { FerramentaCheque } from '../ferramentas/cheque-especial/casca/Ferramenta';
import { FerramentaConciliador } from '../ferramentas/conciliadorzinho/casca/Ferramenta';
import { caminho, caminhoDaFerramenta } from './caminho';
import { FERRAMENTAS, ferramentaPorId } from './ferramentas';

export function EmpresaAberta() {
  const { empresa: param = '', ferramenta: idFerramenta = '', secao = '', pagina = '' } = useParams();
  const empresa = empresaDaRota(param);
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  const f = ferramentaPorId(idFerramenta);
  if (!f) return <Navigate to={caminhoDaFerramenta(rota, FERRAMENTAS[0].id, FERRAMENTAS[0].inicial)} replace />;
  if (param !== rota) return <Navigate to={caminhoDaFerramenta(rota, f.id, secao && pagina ? secao + '/' + pagina : f.inicial)} replace />;
  return (
    // key = empresa + ferramenta: trocar de empresa ou de ferramenta começa do zero (nada é guardado)
    <TopoProvider key={rota + '/' + f.id}>
      {f.id === 'cheque-especial'
        ? <FerramentaCheque empresa={empresa} rota={rota} secao={secao} pagina={pagina} />
        : <FerramentaConciliador empresa={empresa} rota={rota} secao={secao} pagina={pagina} />}
    </TopoProvider>
  );
}
