// ViewModel do "Gerar no Alterdata" da Importação do balancete (Vitor, 14/10/2026): pede o balancete ao robô do PC do
// escritório, mostra o andamento ao vivo (os passos do robô) e, com o pedido pronto, entrega as linhas do Excel dele
// para o MESMO fluxo do arquivo escolhido à mão (useImportacao.importarBalancete, com a verificação de "outra empresa").
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import type { PedidoAlterdata } from '../../dados/alterdata';
import { useAlterdata } from '../../dados/repo';
import { useSessao } from '../../casca/sessao';

interface Opcoes {
  /** só o balancete tem o "Gerar no Alterdata" */
  ativo: boolean;
  /** a competência da etapa da Tarefas (aaaa-mm), quando a Importação abre dentro dela */
  competenciaDaEtapa?: string;
  /** o arquivo do robô, já em linhas: segue o caminho do arquivo escolhido (importarBalancete) */
  aoChegar: (rows: c.Linhas) => Promise<void>;
  /** não deu para pegar ou ler o arquivo do robô */
  aoFalhar: (motivo: string) => void;
}

export function useGerarNoAlterdata({ ativo, competenciaDaEtapa, aoChegar, aoFalhar }: Opcoes) {
  const s = useSessao();
  const { toast } = useRetorno();
  const repo = useAlterdata();
  const robo = repo.robo();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoAlterdata | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const tratados = useRef(new Set<string>());
  const ultimos = useRef({ aoChegar, aoFalhar });
  useEffect(() => { ultimos.current = { aoChegar, aoFalhar }; });

  // a competência: a da etapa, ou o último mês do filtro da Conferência, ou o mês anterior ao de hoje (e a pessoa troca)
  const padrao = c.competenciaDoBalancete(competenciaDaEtapa ? [competenciaDaEtapa] : s.filtro.meses, new Date());
  const competencia = escolhida ?? padrao;

  // o pedido, ao vivo
  useEffect(() => {
    if (!pedidoId) return;
    return repo.ouvir(pedidoId, setPedido);
  }, [repo, pedidoId]);
  const doPedido = pedidoId && pedido?.id === pedidoId ? pedido : null;

  // pronto: pega o arquivo do robô e segue o mesmo caminho do arquivo escolhido (uma vez por pedido)
  useEffect(() => {
    if (!doPedido || doPedido.status !== 'pronto' || tratados.current.has(doPedido.id)) return;
    tratados.current.add(doPedido.id);
    const id = doPedido.id;
    void (async () => {
      try {
        const a = await repo.arquivo(id);
        if (!a || !a.base64) throw new Error('O robô disse que terminou, mas o arquivo não está no pedido. Peça de novo.');
        await ultimos.current.aoChegar(c.lerPlanilha(c.base64ParaBuffer(a.base64)));
      } catch (err) {
        ultimos.current.aoFalhar(err instanceof Error ? err.message : String(err));
      } finally {
        setPedidoId(atual => (atual === id ? null : atual));
      }
    })();
  }, [repo, doPedido]);

  const emAndamento = !!doPedido && (doPedido.status === 'pendente' || doPedido.status === 'trabalhando');

  // por que o botão está desabilitado (null = pode pedir)
  const motivo = s.codigo == null ? 'Esta empresa não tem o código do escritório (o do Alterdata): não dá para pedir o balancete.'
    : !robo.carregado ? 'Vendo se o robô do Alterdata está ligado…'
      : !robo.ligado ? 'O robô do Alterdata está desligado.'
        : null;

  async function gerar() {
    if (s.codigo == null || pedindo || emAndamento) return;
    setPedindo(true);
    try {
      setPedidoId(await repo.pedir({ codigo: s.codigo, empresa: s.nome, competencia }));
    } catch (err) {
      toast('Não deu para pedir ao Alterdata: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPedindo(false);
    }
  }

  async function cancelar() {
    if (!doPedido) return;
    try { await repo.cancelar(doPedido.id); toast('Pedido cancelado.'); } catch (err) { toast('Não deu para cancelar: ' + (err instanceof Error ? err.message : String(err))); }
  }

  return {
    /** o botão só aparece para o contábil e o admin */
    visivel: ativo && repo.podePedir(),
    motivo,
    competencia,
    trocarCompetencia: setEscolhida,
    gerar,
    cancelar,
    pedido: doPedido,
    /** na fila ou com o robô, ou criando o pedido */
    ocupado: pedindo || emAndamento,
    fecharPedido: () => setPedidoId(null),
  };
}
