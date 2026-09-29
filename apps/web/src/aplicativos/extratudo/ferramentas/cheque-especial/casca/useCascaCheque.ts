// ViewModel do Cheque especial dentro da casca do Extratudo: a página dele nas abas de cima e o título.
import type { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { caminho } from './caminho';
import { paginaPorId, SECOES } from './navegacao';

export function useCascaCheque(empresa: empresas.EmpresaDoEscritorio, rota: string, pagina: string) {
  const navegar = useNavigate();
  return {
    ferramenta: 'cheque-especial' as const,
    empresa: { codigo: empresa.codigo, nome: empresa.nome },
    rota,
    titulo: paginaPorId(pagina)?.titulo || '',
    paginas: SECOES.flatMap(s => s.paginas).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })),
    onPagina: (id: string) => navegar(caminho(rota + '/' + id)),
  };
}
