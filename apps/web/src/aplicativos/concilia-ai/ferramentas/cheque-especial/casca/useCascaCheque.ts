// ViewModel da casca do Cheque especial: as páginas (abas do cabeçalho), a ativa e o título.
// A barra lateral, a empresa e o sair são do Concilia aí (useCascaConciliaAi).
import { useNavigate } from 'react-router';
import { caminhoDaPagina, paginaPorId, PAGINAS } from './navegacao';

export function useCascaCheque(rota: string, pagina: string) {
  const navegar = useNavigate();
  return {
    titulo: paginaPorId(pagina)?.titulo || '',
    paginas: PAGINAS.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })),
    onPagina: (id: string) => navegar(caminhoDaPagina(rota, id)),
  };
}
