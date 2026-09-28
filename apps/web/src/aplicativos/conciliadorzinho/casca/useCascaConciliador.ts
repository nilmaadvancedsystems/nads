// ViewModel da casca do Conciliadorzinho: as etapas na barra lateral (travadas até serem
// alcançadas), o título, o Cancelar (com confirmação) e o Novo processo.
// Origem: conciliadorZINHO.html renderStepper/stepperList (~L1043-1081), cancelBtn (~L2256).
import { useRetorno } from '@nads/ui';
import { useNavigate } from 'react-router';
import { caminho } from './caminho';
import { idDaPagina } from './navegacao';
import { useSessao } from './sessao';

export const VERSAO = 'nads 0.2 · Conciliadorzinho';

export function useCascaConciliador() {
  const s = useSessao();
  const navegar = useNavigate();
  const { modal, toast } = useRetorno();
  const atual = s.lista.find(x => x.id === s.etapa);
  const n = s.lista.findIndex(x => x.id === s.etapa) + 1;

  async function cancelar() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Cancelar conciliação?', texto: 'Os arquivos enviados e as contas informadas serão descartados.',
      botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Cancelar tudo', valor: true, variante: 'btn-primary' }],
    });
    if (ok) { s.recomecar(); toast('Processo cancelado.'); }
  }

  return {
    empresa: { codigo: s.empresa.codigo != null ? String(s.empresa.codigo) : s.empresa.nome, nome: s.empresa.nome },
    versao: VERSAO,
    titulo: atual ? atual.titulo : '',
    etapaDeTotal: 'Etapa ' + n + ' de ' + s.lista.length,
    secoes: s.lista.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, grupo: x.grupo, ativa: x.id === s.etapa, travada: !s.podeAbrir(x.id) })),
    paginas: atual ? [{ id: atual.id, rotulo: atual.rotulo, icone: atual.icone, ativa: true }] : [],
    onSecao: (id: string) => s.irPara(id as typeof s.etapa),
    temArquivos: s.estado.bandeiras.length > 0,
    cancelar,
    sair: () => navegar(caminho()),
    aplicativos: () => navegar('/'),
    voltarAoInicio: () => s.irPara('bandeiras'),
    idPagina: idDaPagina(s.etapa),
  };
}
