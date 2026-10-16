// ViewModel da página do LCDPR dentro da empresa: a empresa (para a trilha "Minhas empresas / 62 · … / LCDPR"), se ela
// tem o LCDPR (as EMPRESAS_COM_LCDPR) e a página aberta; voltar para a lista ou para a página da empresa.
import { empresas } from '@nads/core';
import { useLocation, useNavigate } from 'react-router';
import { BASE, caminhoDoLcdpr, PAGINAS_DO_LCDPR, temLcdpr } from '../../../casca/navegacao';
import { useDepartamentoDaTela } from '../../../casca/departamento';
import { useRepo, useVersaoDoRepo } from '../../../dados/repo';

export function usePaginaDoLcdpr(rota: string, pagina: string) {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const { search } = useLocation();
  const { lista } = useDepartamentoDaTela();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  const competencia = new URLSearchParams(search).get('competencia');
  const p = PAGINAS_DO_LCDPR.find(x => x.id === pagina);
  return {
    /** null: a empresa não existe ou não tem o LCDPR */
    empresa: empresa && temLcdpr(empresa.codigo) ? (empresa.codigo != null ? empresa.codigo + ' · ' : '') + empresa.nome : null,
    pagina: p?.id || null,
    /** a primeira página (endereço com uma página que não existe) */
    paginaInicial: empresa ? caminhoDoLcdpr(empresas.rotaDaEmpresa(empresa), PAGINAS_DO_LCDPR[0].id) + search : BASE,
    voltarParaALista: () => navegar(lista + (competencia ? '?competencia=' + competencia : '')),
    abrirAEmpresa: () => { if (empresa) navegar(BASE + '/minhas-empresas/empresa/' + empresas.rotaDaEmpresa(empresa) + search); },
  };
}
