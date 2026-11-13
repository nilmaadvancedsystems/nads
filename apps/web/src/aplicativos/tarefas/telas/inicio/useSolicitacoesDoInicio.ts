// ViewModel das solicitações de reunião nas Notificações do Início novo (Vitor, 13/11/2026). O papel vem do nível: o Sênior
// pede (vê as suas, com a situação), o Diretor e o Dono aprovam ou recusam com a observação (a aprovada vira a reunião nas
// Notificações) e marcam a reunião direto; os outros não têm nada disso. No modo desenvolvedor, o ⚡ simula o nível.
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useAvisos, useSolicitacoes } from '../../dados/repo';
import type { PedidoDeReuniao } from '../../dados/solicitacoes';
import { useOperador, type Operador } from '../../casca/operador';
import { useSaudacaoSimulada } from './saudacaoSimulada';

const s = tarefas.solicitacoes;
const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function useSolicitacoesDoInicio() {
  const op = useOperador().operador as Operador;
  const { toast, aviso } = useRetorno();
  const [dev] = useModoDesenvolvedor();
  const simulada = useSaudacaoSimulada();
  const nivel = dev && simulada.nivel ? simulada.nivel : op.nivel;
  const papel = s.papelNasSolicitacoes(nivel);
  const repo = useSolicitacoes();
  const avisos = useAvisos();
  const { carregadas, solicitacoes } = papel === 'nenhum' ? { carregadas: true, solicitacoes: [] } : repo.lista(papel === 'aprova');
  const erro = (titulo: string) => (e: unknown) => aviso({ tom: 'erro', titulo, texto: e instanceof Error ? e.message : String(e) });
  return {
    papel,
    /** o nível que está valendo (o simulado, no modo desenvolvedor) */
    nivel,
    carregadas,
    lista: solicitacoes.map(x => ({ ...x, quandoTexto: quando(x.quando), pedidaEm: quando(x.em), rotulo: s.ROTULO_DA_SITUACAO[x.situacao], decisao: x.decididoPor ? x.decididoPor + ' · ' + quando(x.decididoEm || '') : '' })),
    pendentes: solicitacoes.filter(x => x.situacao === 'pendente').length,
    maiorObservacao: s.MAIOR_OBSERVACAO,
    problemaDoPedido: (p: PedidoDeReuniao) => s.problemaDaSolicitacao(p),
    async solicitar(p: PedidoDeReuniao): Promise<boolean> {
      try { await repo.solicitar(p); toast('Reunião pedida: o Diretor vai aprovar ou não.'); return true; } catch (e) { erro('Não foi pedida')(e); return false; }
    },
    async decidir(id: string, aprovar: boolean, observacao: string) {
      try {
        const decidida = await repo.decidir(id, aprovar, observacao);
        // a aprovada vira a reunião das Notificações, em nome de quem pediu
        if (aprovar) await avisos.publicar(decidida.texto, decidida.por, s.comunicadoDaReuniao(decidida));
        toast(aprovar ? 'Reunião aprovada e publicada nas Notificações.' : 'Solicitação recusada.');
      } catch (e) { erro('Não deu para decidir')(e); }
    },
  };
}
