// ViewModel do Cartões dentro da casca do Extratudo: a página dele nas abas de cima e o título (o período da Tarefa
// continua no endereço).
import type { empresas } from '@nads/core';
import { useLocation, useNavigate } from 'react-router';
import { caminho } from './caminho';
import { paginaPorId, PAGINAS } from './navegacao';

export function useCascaCartoes(empresa: empresas.EmpresaDoEscritorio, rota: string, pagina: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  return {
    ferramenta: 'cartoes' as const,
    empresa: { codigo: empresa.codigo, nome: empresa.nome },
    rota,
    titulo: paginaPorId(pagina)?.titulo || '',
    paginas: PAGINAS.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })),
    onPagina: (id: string) => navegar(caminho(rota + '/' + id) + search),
  };
}
