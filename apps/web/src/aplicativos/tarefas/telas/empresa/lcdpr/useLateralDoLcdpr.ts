// A barra lateral da empresa com o LCDPR (16/10/2026: "coloque o lcdpr como parte da empresa 62 de carlos lucas
// apenas"): só nas EMPRESAS_COM_LCDPR, embaixo das páginas de Minhas empresas, a Rotina (a página da empresa) e as telas
// do LCDPR (no PC, sem abas no alto: cada tela da página antiga vira uma página da lateral). Troca de página mantendo a
// competência e o departamento do endereço.
import { empresas } from '@nads/core';
import type { SecaoCasca } from '@nads/ui';
import { useLocation, useNavigate } from 'react-router';
import type { LateralDaEmpresa } from '../../../casca/CascaTarefas';
import { BASE, caminhoDoLcdpr, PAGINAS_DO_LCDPR, temLcdpr } from '../../../casca/navegacao';
import { useRepo, useVersaoDoRepo } from '../../../dados/repo';

const ROTINA = 'empresa-rotina';
const PREFIXO = 'lcdpr-';

/** null: a empresa não tem o LCDPR (a lateral fica a de sempre). pagina: a do LCDPR aberta (null = a Rotina). */
export function useLateralDoLcdpr(rota: string, pagina: string | null): LateralDaEmpresa | null {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const { search } = useLocation();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  if (!empresa || !temLcdpr(empresa.codigo)) return null;
  const r = empresas.rotaDaEmpresa(empresa);
  const secoes: SecaoCasca[] = [
    { id: ROTINA, rotulo: 'Rotina', icone: 'checklist', grupo: 2, titulo: 'Empresa ' + empresa.codigo, ativa: pagina === null },
    ...PAGINAS_DO_LCDPR.map(p => ({ id: PREFIXO + p.id, rotulo: p.rotulo, icone: p.icone, grupo: 3, titulo: 'LCDPR', ativa: p.id === pagina })),
  ];
  return {
    secoes,
    titulo: pagina ? PAGINAS_DO_LCDPR.find(p => p.id === pagina)?.titulo : undefined,
    onSecao: id => navegar((id === ROTINA ? BASE + '/minhas-empresas/empresa/' + r : caminhoDoLcdpr(r, id.slice(PREFIXO.length))) + search),
  };
}
