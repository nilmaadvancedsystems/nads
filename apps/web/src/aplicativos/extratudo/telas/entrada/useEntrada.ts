// ViewModel da entrada do Extratudo: a escolha de empresa comum do nads. Entra no Extrator: na
// Conferência quando a empresa já tem extrato e sistema; senão, na Importação.
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { caminho } from '../../ferramentas/extrator/casca/caminho';
import { PAGINA_INICIAL } from '../../ferramentas/extrator/casca/navegacao';
import { useRepo, useVersaoDoRepo } from '../../ferramentas/extrator/dados/repo';

export function useEntrada() {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const { toast } = useRetorno();

  function entrar(x: empresas.EmpresaDoEscritorio) {
    const e = repo.obter(x.nome);
    const pronta = !!e && e.arquivos.some(a => a.lado === 'banco') && e.arquivos.some(a => a.lado === 'sistema');
    navegar(caminho(empresas.rotaDaEmpresa(x) + '/' + (pronta ? 'conferencia/resultado' : PAGINA_INICIAL)));
  }

  const busca = useEscolherEmpresa(repo.listarEmpresas(), entrar);

  return {
    ...busca,
    exemplos: repo.exemplos,
    restaurarExemplos: () => { repo.restaurarExemplos(); toast('Exemplos restaurados.'); },
  };
}
