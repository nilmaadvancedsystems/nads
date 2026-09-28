// O Cheque especial dentro do Conciliei: /conciliei/:empresa/cheque-especial/:secao/:pagina.
// Página que não existe volta para a inicial; a empresa já vem resolvida do Conciliei.
import type { empresas } from '@nads/core';
import { Navigate } from 'react-router';
import { caminhoDaFerramenta } from '../../../casca/caminho';
import { Ajuste } from '../telas/ajuste/Ajuste';
import { CascaCheque } from './Casca';
import { PAGINA_INICIAL, paginaPorId } from './navegacao';

export function FerramentaCheque({ empresa, rota, secao, pagina }: { empresa: empresas.EmpresaDoEscritorio; rota: string; secao: string; pagina: string }) {
  const id = secao + '/' + pagina;
  if (!paginaPorId(id)) return <Navigate to={caminhoDaFerramenta(rota, 'cheque-especial', PAGINA_INICIAL)} replace />;
  return (
    <CascaCheque empresa={empresa} rota={rota} pagina={id}>
      <Ajuste empresa={empresa} />
    </CascaCheque>
  );
}
