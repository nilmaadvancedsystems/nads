// ViewModel do Creditor dentro da casca do Extratudo: as etapas nas abas de cima (travadas até serem
// liberadas), o título e, na linha das etapas, o Cancelar (com confirmação) e o Próximo.
import { useRetorno } from '@nads/ui';
import { useSessao } from './sessao';

export function useCascaCreditor() {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const atual = s.etapas.find(x => x.id === s.etapa);

  async function cancelar() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Cancelar a conciliação?', texto: 'O relatório lido e as decisões serão descartados.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Cancelar tudo', valor: true, variante: 'btn-primary' }],
    });
    if (ok) { s.recomecar(); toast('Processo cancelado.'); }
  }

  return {
    ferramenta: 'creditor' as const,
    empresa: s.empresa,
    rota: s.rota,
    // o título e as etapas desde a primeira (Vitor, 05/10/2026)
    titulo: atual ? atual.titulo : '',
    paginas: s.etapas.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    onPagina: (id: string) => s.irPara(id as typeof s.etapa),
    temDados: !!s.estado.relatorio,
    cancelar,
    /** o Próximo: some na última etapa; travado com pendência (sem o relatório, com conta para decidir) */
    temProxima: s.temProxima, podeSeguir: s.podeSeguir, proximo: s.proxima,
  };
}
