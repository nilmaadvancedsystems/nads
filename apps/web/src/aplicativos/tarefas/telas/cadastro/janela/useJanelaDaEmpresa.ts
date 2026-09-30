// ViewModel da janela de uma empresa no Cadastro: a empresa, as abas (contas bancárias, plano de contas,
// contas padrão, histórico), trocar de aba e fechar (volta para a lista, que ficou atrás da janela).
import type { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { empresaDaRota } from '../../../../../comum/empresaDaRota';
import { ABAS_DO_CADASTRO, caminhoDoCadastro } from '../../../casca/navegacao';

export function useJanelaDaEmpresa(rota: string, aba: string) {
  const navegar = useNavigate();
  // o CadastroAberto só abre a janela quando a empresa está na lista
  const empresa = empresaDaRota(rota) as empresas.EmpresaDoEscritorio;
  return {
    empresa,
    abas: ABAS_DO_CADASTRO.map(a => ({ ...a, ativa: a.id === aba })),
    aba,
    irPara: (id: string) => navegar(caminhoDoCadastro(rota, id), { replace: true }),
    fechar: () => navegar(caminhoDoCadastro(null)),
  };
}
