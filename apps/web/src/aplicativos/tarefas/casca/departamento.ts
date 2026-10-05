// De qual departamento é a rotina da tela (Vitor, 05/10/2026: o módulo Fiscal com a rotina do Fiscal, também para quem
// é do Contábil). Dentro do módulo Fiscal (/tarefas/fiscal/…) é o Fiscal; nas telas que ele abre (a página da empresa,
// o executor) vem no endereço (?dep=fiscal); fora disso, o departamento de quem está trabalhando.
import type { usuarios } from '@nads/core';
import { useLocation } from 'react-router';
import { BASE, caminhoDaPagina } from './navegacao';
import { useOperador, type Operador } from './operador';

export function useDepartamentoDaTela() {
  const op = useOperador().operador as Operador;
  const { pathname, search } = useLocation();
  const q = new URLSearchParams(search).get('dep');
  const dep: usuarios.Departamento = pathname.startsWith(BASE + '/fiscal') ? 'fiscal' : q === 'fiscal' || q === 'contabil' ? q : op.departamento;
  const outro = dep !== op.departamento;
  return {
    dep,
    /** o endereço com o ?dep= quando a rotina não é a do departamento da pessoa */
    comDep: (url: string) => (outro ? url + (url.includes('?') ? '&' : '?') + 'dep=' + dep : url),
    /** a lista para onde voltar: o módulo Fiscal, ou Minhas empresas */
    lista: outro && dep === 'fiscal' ? caminhoDaPagina('fiscal', 'empresas') : caminhoDaPagina('minhas-empresas', 'empresas'),
  };
}
