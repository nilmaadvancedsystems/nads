// ViewModel do Creditor dentro da casca do Extratudo: as etapas nas abas de cima (travadas até serem
// liberadas), o título, "Etapa n de 5" e o Cancelar (com confirmação).
import { useRetorno } from '@nads/ui';
import { useSessao } from './sessao';

/** as etapas no visual da Importação: sem o título e sem o "Etapa n de 5" em cima (Vitor, 05/10/2026) */
const NO_VISUAL_DA_IMPORTACAO: string[] = ['competencia', 'banco'];

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
    // a Competência (a primeira) no visual da Importação: sem o título e sem o "Etapa 1 de 5" (Vitor, 05/10/2026)
    titulo: atual && !NO_VISUAL_DA_IMPORTACAO.includes(atual.id) ? atual.titulo : '',
    primeira: NO_VISUAL_DA_IMPORTACAO.includes(s.etapa),
    paginas: s.etapas.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    onPagina: (id: string) => s.irPara(id as typeof s.etapa),
    temDados: !!s.estado.relatorio,
    cancelar,
  };
}
