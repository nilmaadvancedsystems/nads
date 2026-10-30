// "Só as minhas empresas" no Concilia aí, no Conciliadorzinho e no Extratudo (29/10/2026: "se eu não sou encarregado dela
// não tem porque eu ter acesso a ela"): a mesma regra das telas da Tarefas (useEmpresasPermitidas), com o operador da conta
// que passou pela trava de acesso. O admin e o diretor, todas; o Fiscal e o Contábil, só as que são o responsável do setor
// no Cadastro; o DP, todas. Nos exemplos não há conta: todas, como antes.
import { useSessao } from '../dados/sessao';
import { useEmpresasPermitidasDoOperador } from '../telas/empresas/andamento';
import { operadorDaConta } from './operador';

export function useEmpresasDaConta() {
  const u = useSessao()?.usuario ?? null;
  return useEmpresasPermitidasDoOperador(u ? operadorDaConta(u) : null);
}
