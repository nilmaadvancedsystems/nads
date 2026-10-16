// ViewModel de Entregas › Painel (16/10/2026, a entrega de documentos trazida do Entregas): a competência (o mês corrente
// e os anteriores, como no Painel de lá), a busca e a situação; os números do mês (quantos dos clientes do Entregas já
// receberam, na rota, não entregues, sem entrega) e a lista dos clientes com a situação de cada um (a da entrega mais nova
// do mês). Clicar no cliente abre as entregas dele; Nova entrega abre a janela de pôr na rota.
import { entregas, formatos, tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';

export interface LinhaDoPainelNaTela {
  l: entregas.LinhaDoPainel;
  codigo: string;
  nome: string;
  situacao: { rotulo: string; tom: string };
  detalhe: string;
  documentos: string;
}

const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

export function usePainelDeEntregas() {
  const repo = useEntregasDeDocumentos();
  const competencias = useMemo(() => [mesAtual(), ...t.competenciasRecentes(new Date(), 12)], []);
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<entregas.FiltroDoPainel>('com_entrega');
  const [aberta, setAberta] = useState<entregas.LinhaDoPainel | null>(null);
  const [nova, setNova] = useState(false);
  const clientes = repo.clientes();
  const naRota = repo.naRota();
  const doMes = repo.doMes(competencia);

  const linhas = entregas.linhasDoPainel({ clientes: clientes.lista, pendentes: naRota.lista, doMes: doMes.lista, busca, filtro });
  const numeros = entregas.numerosDoMes(entregas.clientesDeEntrega(clientes.lista, naRota.lista), doMes.lista);
  const rotulo = (c: string) => t.rotuloCompetencia(c);

  const naTela: LinhaDoPainelNaTela[] = linhas.map(l => {
    const ultima = l.entregas[0];
    const s = entregas.rotuloDaSituacao(l.situacao, ultima);
    const detalhe = !ultima ? 'Sem entrega registrada nesta competência'
      : formatos.dataHora(entregas.quandoFoi(ultima))
        + (l.situacao === 'rota' ? (ultima.status === 'link' ? ' · no link, aguardando o cliente' : ' · aguardando assinatura') : '')
        + (l.situacao === 'falha' ? ' · ' + (ultima.motivoFalha || 'não entregue') : '')
        + (l.situacao === 'entregue' && ultima.recebedor ? ' · recebido por ' + ultima.recebedor : '')
        + (l.entregas.length > 1 ? ' · ' + l.entregas.length + ' registros no mês' : '');
    return {
      l, codigo: l.cliente?.codigoOrigem || '', nome: l.cliente ? l.cliente.nome : l.nome,
      situacao: s, detalhe,
      documentos: [...new Set(l.entregas.flatMap(e => e.itens.map(i => i.tipo)))].join(', '),
    };
  });

  return {
    carregando: !clientes.carregada || !doMes.carregada,
    erro: doMes.erro || clientes.erro,
    exemplos: repo.exemplos,
    competencias: competencias.map(c => ({ valor: c, rotulo: rotulo(c) })),
    competencia, setCompetencia, rotuloCompetencia: rotulo(competencia),
    busca, setBusca,
    filtros: entregas.FILTROS_DO_PAINEL,
    filtro, setFiltro, rotuloDoFiltro: entregas.FILTROS_DO_PAINEL.find(f => f.valor === filtro)?.rotulo || '',
    numeros: [
      { rotulo: 'Já receberam', valor: numeros.entregue + ' de ' + numeros.total, tom: 'ok', icone: 'checkCircle' as const, dica: numeros.porcento + '% dos clientes do Entregas' },
      { rotulo: 'Na rota', valor: String(numeros.rota), tom: 'aviso', icone: 'caminhao' as const, dica: 'aguardando a assinatura' },
      { rotulo: 'Não entregues', valor: String(numeros.falha), tom: 'marca', icone: 'alert' as const, dica: 'a última tentativa não deu certo' },
      { rotulo: 'Sem entrega', valor: String(numeros.sem_entrega), tom: 'neutro', icone: 'clock' as const, dica: 'nada registrado no mês' },
    ],
    linhas: naTela,
    aberta, setAberta,
    nova, setNova,
  };
}
