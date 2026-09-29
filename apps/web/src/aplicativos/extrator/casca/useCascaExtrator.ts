// ViewModel da casca da empresa aberta no Extrator: seções e páginas (a Conferência trava até ter
// extrato e sistema), título, sair, trocar de aplicativo e voltar ao início da empresa.
import { useNavigate } from 'react-router';
import { menuAplicativos, rotaDoAplicativo } from '../../../comum/menuAplicativos';
import { VERSAO_SISTEMA } from '../../../versao';
import { caminho } from './caminho';
import { PAGINA_INICIAL, paginaPorId, SECOES, secaoDaPagina } from './navegacao';
import { useSessao } from './sessao';

export function useCascaExtrator() {
  const s = useSessao();
  const navegar = useNavigate();
  const pag = paginaPorId(s.pagina);
  const secAtual = secaoDaPagina(s.pagina);

  const secoes = SECOES.map(sec => ({
    id: sec.id, rotulo: sec.rotulo, icone: sec.icone, grupo: sec.grupo,
    ativa: sec.id === secAtual?.id, travada: sec.id === 'conferencia' && !!s.falta,
  }));
  const paginas = (secAtual?.paginas || []).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === s.pagina }));

  /** Menu lateral: abre a primeira página da seção. Conferência sem extrato ou sistema avisa o que falta. */
  function onSecao(id: string) {
    if (id === 'conferencia' && s.falta) { s.avisoImportar(s.falta); return; }
    const primeira = SECOES.find(x => x.id === id)?.paginas[0].id;
    if (primeira) s.irPara(primeira);
  }

  return {
    empresa: { codigo: s.codigo != null ? String(s.codigo) : s.nome, nome: s.nome },
    titulo: pag?.titulo || '',
    versao: VERSAO_SISTEMA,
    secoes, paginas,
    onSecao,
    onPagina: (id: string) => s.irPara(id),
    sair: () => navegar(caminho()),
    aplicativos: () => navegar('/'),
    menuAplicativos: menuAplicativos('extrator'),
    abrirAplicativo: (id: string) => navegar(rotaDoAplicativo(id)),
    voltarAoInicio: () => s.irPara(s.falta ? PAGINA_INICIAL : 'conferencia/resultado'),
  };
}
