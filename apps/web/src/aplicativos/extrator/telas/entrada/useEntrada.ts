// ViewModel da entrada do Extrator: a escolha de empresa comum do nads. Entra na Conferência
// quando a empresa já tem extrato e sistema; senão, na Importação.
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { caminho } from '../../casca/caminho';
import { PAGINA_INICIAL } from '../../casca/navegacao';
import { useRepo, useVersaoDoRepo } from '../../dados/repo';

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
