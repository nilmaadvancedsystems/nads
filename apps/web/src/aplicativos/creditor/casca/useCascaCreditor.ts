// ViewModel da casca do Creditor: as etapas na barra lateral (travadas até serem liberadas), o
// título, "Etapa n de 5", o Cancelar (com confirmação) e o sair para a escolha de empresa.
import { useRetorno } from '@nads/ui';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { caminho } from './caminho';
import { ETAPAS, indiceDaEtapa } from './navegacao';
import { useSessao } from './sessao';

export function useCascaCreditor() {
  const s = useSessao();
  const navegar = useNavigate();
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
    empresa: { codigo: s.empresa.codigo != null ? String(s.empresa.codigo) : s.empresa.nome, nome: s.empresa.nome },
    versao: VERSAO_SISTEMA,
    titulo: atual ? atual.titulo : '',
    etapaDeTotal: 'Etapa ' + (indiceDaEtapa(s.etapa) + 1) + ' de ' + ETAPAS.length,
    secoes: ETAPAS.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, grupo: 1, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    paginas: atual ? [{ id: atual.id, rotulo: atual.rotulo, icone: atual.icone, ativa: true }] : [],
    onSecao: (id: string) => s.irPara(id as typeof s.etapa),
    temDados: !!s.estado.relatorio || !!s.estado.sistema,
    cancelar,
    sair: () => navegar(caminho()),
    voltarAoInicio: () => s.irPara('banco'),
  };
}
