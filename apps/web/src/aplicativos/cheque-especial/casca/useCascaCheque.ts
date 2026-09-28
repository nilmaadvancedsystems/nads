// ViewModel da casca do Cheque especial: seção/página ativas, título e para onde vão
// o início, a empresa e o sair.
import type { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { menuAplicativos, rotaDoAplicativo } from '../../../comum/menuAplicativos';
import { VERSAO_SISTEMA } from '../../../versao';
import { caminho } from './caminho';
import { paginaPorId, SECOES } from './navegacao';


export function useCascaCheque(empresa: empresas.EmpresaDoEscritorio, rota: string, pagina: string) {
  const navegar = useNavigate();
  const secAtual = pagina.split('/')[0];
  const irPara = (id: string) => navegar(caminho(rota + '/' + id));
  return {
    empresa: { codigo: empresa.codigo != null ? String(empresa.codigo) : empresa.nome, nome: empresa.nome },
    versao: VERSAO_SISTEMA,
    titulo: paginaPorId(pagina)?.titulo || '',
    secoes: SECOES.map(s => ({ id: s.id, rotulo: s.rotulo, icone: s.icone, grupo: s.grupo, ativa: s.id === secAtual })),
    paginas: (SECOES.find(s => s.id === secAtual)?.paginas || []).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })),
    onSecao: (id: string) => { const s = SECOES.find(x => x.id === id); if (s) irPara(s.paginas[0].id); },
    onPagina: irPara,
    sair: () => navegar(caminho()),
    aplicativos: () => navegar('/'),
    menuAplicativos: menuAplicativos('cheque-especial'),
    abrirAplicativo: (id: string) => navegar(rotaDoAplicativo(id)),
  };
}
