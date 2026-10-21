// ViewModel da casca do site do admin: as páginas na barra lateral (e na gaveta ☰, que no celular é o caminho entre elas),
// o título, a versão e quem está (o avatar, com "Sair da conta").
import { usuarios } from '@nads/core';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { useOperador, type Operador } from '../../tarefas/casca/operador';
import { BASE, PAGINAS_DO_ADMIN, caminhoDoAdmin, paginaDoAdmin, type IdPaginaAdmin } from './navegacao';

export function useCascaAdmin(pagina: IdPaginaAdmin) {
  const navegar = useNavigate();
  const { escolher, comLogin } = useOperador();
  const op = useOperador().operador as Operador;
  return {
    versao: VERSAO_SISTEMA,
    titulo: paginaDoAdmin(pagina)?.titulo || 'Admin',
    secoes: PAGINAS_DO_ADMIN.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, grupo: 1, ativa: p.id === pagina })),
    paginasNaGaveta: PAGINAS_DO_ADMIN.map(p => ({ id: p.id, nome: p.rotulo, icone: p.icone, ativo: p.id === pagina })),
    onSecao: (id: string) => navegar(caminhoDoAdmin(id as IdPaginaAdmin)),
    inicio: () => navegar(BASE),
    perfil: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
    sair: () => escolher(null),
  };
}
