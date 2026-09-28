// O Cheque especial dentro do Concilia aí: /:empresa/cheque-especial/:pagina.
// Página que não existe volta para a inicial; a empresa já vem resolvida (EmpresaAberta).
import { Navigate } from 'react-router';
import { Ajuste } from '../telas/ajuste/Ajuste';
import { CascaCheque } from './Casca';
import { caminhoDaPagina, PAGINA_INICIAL, paginaPorId } from './navegacao';

export function FerramentaCheque({ empresa, rota, pagina }: { empresa: { nome: string; codigo: number | null }; rota: string; pagina: string }) {
  if (!paginaPorId(pagina)) return <Navigate to={caminhoDaPagina(rota, PAGINA_INICIAL)} replace />;
  return (
    <CascaCheque rota={rota} pagina={pagina}>
      <Ajuste empresa={empresa} />
    </CascaCheque>
  );
}
