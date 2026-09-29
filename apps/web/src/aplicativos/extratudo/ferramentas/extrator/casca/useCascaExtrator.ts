// ViewModel do Extrator dentro da casca do Extratudo: as páginas do Extrator nas abas de cima
// (a Conferência trava até ter extrato e sistema) e o título.
import { paginaPorId, SECOES } from './navegacao';
import { useSessao } from './sessao';

export function useCascaExtrator() {
  const s = useSessao();
  const pag = paginaPorId(s.pagina);
  const trava = (id: string) => id.startsWith('conferencia/') && !!s.falta;

  return {
    ferramenta: 'extrator' as const,
    empresa: { codigo: s.codigo, nome: s.nome },
    rota: s.rota,
    titulo: pag?.titulo || '',
    paginas: SECOES.flatMap(sec => sec.paginas).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === s.pagina, travada: trava(p.id) })),
    /** Conferência sem extrato ou sistema avisa o que falta importar. */
    onPagina: (id: string) => {
      if (trava(id) && s.falta) { s.avisoImportar(s.falta); return; }
      s.irPara(id);
    },
  };
}
