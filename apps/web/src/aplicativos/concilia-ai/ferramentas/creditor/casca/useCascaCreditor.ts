// ViewModel da casca do Creditor: as etapas nas abas do cabeçalho (travadas até serem liberadas),
// o título, "Etapa n de 5" e o Cancelar (com confirmação).
// A barra lateral, a empresa e o sair são do Concilia aí (useCascaConciliaAi).
import { useRetorno } from '@nads/ui';
import { ETAPAS, indiceDaEtapa } from './navegacao';
import { useSessao } from './sessao';

export function useCascaCreditor() {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const atual = ETAPAS.find(x => x.id === s.etapa);

  async function cancelar() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Cancelar a conciliação?', texto: 'O relatório lido, as correções, o arquivo do sistema e as decisões serão descartados.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Cancelar tudo', valor: true, variante: 'btn-primary' }],
    });
    if (ok) { s.recomecar(); toast('Processo cancelado.'); }
  }

  return {
    titulo: atual ? atual.titulo : '',
    etapaDeTotal: 'Etapa ' + (indiceDaEtapa(s.etapa) + 1) + ' de ' + ETAPAS.length,
    paginas: ETAPAS.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    onPagina: (id: string) => s.irPara(id as typeof s.etapa),
    temDados: !!s.estado.relatorio || !!s.estado.sistema,
    cancelar,
    voltarAoInicio: () => s.irPara('banco'),
  };
}
