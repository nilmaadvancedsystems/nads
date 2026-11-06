// ViewModel do Conciliadorzinho dentro da etapa Vendas no cartão (Vitor, 06/11/2026: saiu do site dele): as etapas do passo
// a passo nas abas do cabeçalho da Tarefa (travadas até serem alcançadas), o título e o Cancelar (com confirmação).
// Origem: conciliadorZINHO.html renderStepper/stepperList (~L1043-1081), cancelBtn (~L2256).
import { useRetorno } from '@nads/ui';
import { useSessao } from './sessao';

export function useCascaConciliador() {
  const s = useSessao();
  const { modal, toast } = useRetorno();
  const atual = s.lista.find(x => x.id === s.etapa);
  const n = s.lista.findIndex(x => x.id === s.etapa) + 1;

  async function cancelar() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Cancelar conciliação?', texto: 'Os arquivos enviados e as contas informadas serão descartados.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Cancelar tudo', valor: true, variante: 'btn-primary' }],
    });
    if (ok) { s.recomecar(); toast('Processo cancelado.'); }
  }

  return {
    titulo: atual ? atual.titulo : '',
    etapaDeTotal: 'Etapa ' + n + ' de ' + s.lista.length,
    abas: s.lista.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    onAba: (id: string) => s.irPara(id as typeof s.etapa),
    temArquivos: s.estado.bandeiras.length > 0,
    cancelar,
  };
}
