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
  const dep: usuarios.Departamento = pathname.startsWith(BASE + '/fiscal') ? 'fiscal' : pathname.startsWith(BASE + '/dp') ? 'dp'
    : q === 'fiscal' || q === 'contabil' || q === 'dp' ? q : op.departamento;
  const outro = dep !== op.departamento;
  return {
    dep,
    /** o endereço com o ?dep= quando a rotina não é a do departamento da pessoa */
    comDep: (url: string) => (outro ? url + (url.includes('?') ? '&' : '?') + 'dep=' + dep : url),
    /** a lista para onde voltar: o DP, ou Minhas empresas (no Fiscal de quem é de outro setor, com ?dep=fiscal; as
     * Empresas do módulo Fiscal saíram em 27/10/2026). Já vem com o "?": acrescente os outros com "&". */
    lista: outro && dep === 'dp' ? caminhoDaPagina('dp', 'obrigacoes') + '?' : caminhoDaPagina('minhas-empresas', 'empresas') + (outro ? '?dep=' + dep + '&' : '?'),
  };
}
