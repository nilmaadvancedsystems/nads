// ViewModel do Creditor dentro da casca do Extratudo: as etapas nas abas de cima (travadas até serem
// liberadas), o título e, na linha das etapas, o Cancelar (com confirmação) e o Próximo.
import { useRetorno } from '@nads/ui';
import { useRequisitosParaATarefa } from '../../../../../comum/ponte';
import { useSessao } from './sessao';

export function useCascaCreditor() {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const atual = s.etapas.find(x => x.id === s.etapa);
  // dentro da Tarefa: o que ainda falta no Creditor (sem isso, a setinha da Tarefa ficava liberada; Vitor, 05/10/2026)
  const faltam = !s.d.conferido ? ['Importar o relatório de liquidação']
    : s.d.pendentes.length ? ['Decidir a conta de ' + s.d.pendentes.length + (s.d.pendentes.length === 1 ? ' título' : ' títulos')]
      : !s.estado.baixado ? ['Baixar o .xls dos lançamentos']
        : !s.estado.bancoConferido ? ['Reimportar o razão do banco e conferir o saldo'] : [];
  useRequisitosParaATarefa({ pronto: !faltam.length, faltam });

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
