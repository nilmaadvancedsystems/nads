// ViewModel do "Arquivar agora" no Drive (o mesmo botão das Pendências do Entregas): se o PC do arquivador está ligado
// (o ponto em robo/arquivador, até 3 minutos), o pedido aberto (ou o último, se foi nas últimas 24 h) com a % e os
// últimos passos, pedir (com confirmação) e cancelar enquanto não começou. Some para quem não pode (só admin e contábil).
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useArquivador } from '../../dados/repo';
import type { PedidoDeArquivo } from '../../dados/arquivador';

const ABERTOS = ['pendente', 'aguardando', 'processando'];
const TITULOS: Record<string, string> = {
  pendente: 'Arquivamento pedido',
  aguardando: 'Esperando para começar',
  processando: 'Organizando a pasta Claudio Secretario',
  concluido: 'Arquivamento concluído',
  erro: 'O arquivamento deu erro',
  cancelado: 'Pedido cancelado',
};

const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function useArquivadorDoDrive() {
  const repo = useArquivador();
  const { toast, modal } = useRetorno();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 15 * 1000); return () => clearInterval(r); }, []);
  const [pedindo, setPedindo] = useState(false);

  const e = repo.estado();
  const pedidos = repo.pedidos();
  const ligado = !!e.em && agora - Date.parse(e.em) < 3 * 60 * 1000;
  const aberto = pedidos.find(p => ABERTOS.includes(p.status)) || null;
  const ultimo = aberto || pedidos[0] || null;
  const fimDe = (p: PedidoDeArquivo) => Date.parse(p.concluidoEm || p.erroEm || p.canceladoEm || p.criadoEm) || 0;
  const pedido = ultimo && (aberto || agora - fimDe(ultimo) < 24 * 3600 * 1000) ? ultimo : null;
  const pct = aberto?.status === 'processando' && aberto.progresso ? Math.min(99, Math.round((aberto.progresso.feitas + 0.5) / aberto.progresso.total * 100)) : null;

  function detalhe(p: PedidoDeArquivo): string {
    if (p.status === 'pendente') return 'Pedido por ' + (p.criadoPor || 'alguém') + ' · ' + (ligado ? 'o arquivador vai começar em instantes.' : 'o PC do arquivador está desligado: começa quando ele ligar.');
    if (p.status === 'aguardando') return (p.aguardandoMotivo || 'Esperando outra execução terminar') + '.';
    if (p.status === 'processando') {
      const min = Math.max(0, Math.round((agora - Date.parse(p.processandoEm)) / 60000));
      return 'Começou ' + hora(p.processandoEm) + ' · há ' + (min < 1 ? 'menos de 1 min' : min + ' min') + '. Costuma levar de 10 a 30 minutos.';
    }
    if (p.status === 'concluido') return 'Terminou ' + hora(p.concluidoEm) + (p.passos ? ' · ' + p.passos + ' passos' : '') + '.';
    if (p.status === 'erro') return p.erro || 'Sem detalhe do erro.';
    if (p.status === 'cancelado') return 'Cancelado ' + hora(p.canceladoEm) + '.';
    return '';
  }

  return {
    exemplos: repo.exemplos,
    visivel: !e.semPermissao,
    ligado,
    pc: ligado
      ? 'PC do arquivador ligado' + (e.situacao === 'rodando' ? ' · organizando agora' : e.situacao === 'aguardando' ? ' · esperando para começar' : '')
      : 'PC do arquivador desligado' + (e.em && Date.parse(e.em) > 0 ? ' desde ' + hora(e.desligadoEm || e.em) : '') + ': o pedido sai quando ele ligar',
    rotulo: aberto ? (aberto.status === 'processando' ? 'Organizando' + (pct != null ? ' ' + pct + '%' : '…') : 'Arquivamento pedido') : 'Arquivar agora',
    ocupado: !!aberto,
    pedido: pedido ? {
      id: pedido.id, status: pedido.status, titulo: TITULOS[pedido.status] || pedido.status, detalhe: detalhe(pedido),
      pct, etapa: aberto?.progresso ? 'Etapa ' + Math.min(aberto.progresso.feitas + 1, aberto.progresso.total) + ' de ' + aberto.progresso.total + (aberto.progresso.atual ? ': ' + aberto.progresso.atual : '') : '',
      passos: pedido.andamento.slice(-4).map(l => ({ ...l, hora: l.em ? new Date(l.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '' })),
      podeCancelar: pedido.status === 'pendente' || pedido.status === 'aguardando',
    } : null,
    pedindo,
    async pedir() {
      if (aberto || pedindo) return;
      const ok = await modal<boolean>({ icone: 'arquivo', titulo: 'Organizar agora a pasta Claudio Secretario?', texto: 'Os arquivos vão para as pastas dos clientes no Drive, do mesmo jeito que a organização das 9h.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Organizar agora', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      setPedindo(true);
      try {
        await repo.pedir();
        toast(ligado ? 'Arquivamento pedido. O PC do arquivador vai começar.' : 'Arquivamento pedido. O PC do arquivador está desligado: começa quando ele ligar.');
      } catch (err) {
        toast('Não consegui pedir o arquivamento: ' + (err instanceof Error ? err.message : String(err)));
      } finally { setPedindo(false); }
    },
    cancelar(id: string) {
      void repo.cancelar(id).then(() => toast('Pedido cancelado.'), (err: Error) => toast('Não consegui cancelar: ' + err.message));
    },
  };
}
