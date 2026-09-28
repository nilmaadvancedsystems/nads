// ViewModel da casca do Cheque especial: as páginas (abas do cabeçalho), a ativa e o título.
// A caixa de ferramentas, a empresa e o sair são do Conciliei (useCascaConciliei).
import { useNavigate } from 'react-router';
import { caminhoDaFerramenta } from '../../../casca/caminho';
import { paginaPorId, SECOES } from './navegacao';

export function useCascaCheque(rota: string, pagina: string) {
  const navegar = useNavigate();
  return {
    titulo: paginaPorId(pagina)?.titulo || '',
    paginas: SECOES.flatMap(s => s.paginas).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })),
    onPagina: (id: string) => navegar(caminhoDaFerramenta(rota, 'cheque-especial', id)),
  };
}
