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
  processando: 'Organizando',
  concluido: 'Arquivamento concluído',
  erro: 'O arquivamento deu erro',
  cancelado: 'Pedido cancelado',
};

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

  /** "1 h 16 min", "12 min", "menos de 1 min" */
  function duracao(de: string, ate: number): string {
    const min = Math.max(0, Math.round((ate - Date.parse(de)) / 60000));
    if (!de || isNaN(min)) return '';
    if (min < 1) return 'menos de 1 min';
    return min < 60 ? min + ' min' : Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
  }
  /** "hoje às 09:23", "ontem às 18:02" ou "03/10 às 09:10" */
  function quando(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dias = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
    return (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) + ' às ' + h;
  }
  function detalhe(p: PedidoDeArquivo): string {
    if (p.status === 'pendente') return ligado ? 'Pedido por ' + (p.criadoPor || 'alguém') + '. Começa em instantes.' : 'Pedido por ' + (p.criadoPor || 'alguém') + '. Começa quando o PC do arquivador ligar.';
    if (p.status === 'aguardando') return 'Esperando outra organização terminar para não mexer nos mesmos arquivos.';
    if (p.status === 'processando') {
      const ultimo = p.andamento[p.andamento.length - 1]?.em;
      return 'Começou ' + quando(p.processandoEm) + ' (há ' + duracao(p.processandoEm, agora) + ')' + (ultimo ? ' · último sinal há ' + duracao(ultimo, agora) : '') + '. Costuma levar de 10 a 30 minutos.';
    }
    if (p.status === 'concluido') return 'Terminou ' + quando(p.concluidoEm) + (p.processandoEm ? ' · levou ' + duracao(p.processandoEm, Date.parse(p.concluidoEm)) : '') + '.';
    if (p.status === 'erro') {
      const msg = (p.erro || '').split('\n')[0].slice(0, 160);
      return 'Parou ' + quando(p.erroEm) + (msg ? ': ' + msg : '') + '. Tente de novo; se repetir, avise o administrador.';
    }
    if (p.status === 'cancelado') return 'Cancelado ' + quando(p.canceladoEm) + '.';
    return '';
  }
  const resultado = pedido?.status === 'concluido' ? repo.resultado(pedido.execucao) : null;

  return {
    exemplos: repo.exemplos,
    visivel: !e.semPermissao,
    ligado,
    pc: ligado
      ? 'PC do arquivador ligado' + (e.situacao === 'rodando' ? ' · organizando agora' : e.situacao === 'aguardando' ? ' · esperando para começar' : '')
      : 'PC do arquivador desligado' + (e.em && Date.parse(e.em) > 0 ? ' desde ' + quando(e.desligadoEm || e.em) : ''),
    rotulo: aberto ? (aberto.status === 'processando' ? 'Organizando' + (pct != null ? ' ' + pct + '%' : '…') : 'Arquivamento pedido') : 'Arquivar agora',
    ocupado: !!aberto,
    pedido: pedido ? {
      id: pedido.id, status: pedido.status, titulo: TITULOS[pedido.status] || pedido.status, detalhe: detalhe(pedido),
      pct, etapa: aberto?.progresso ? 'Etapa ' + Math.min(aberto.progresso.feitas + 1, aberto.progresso.total) + ' de ' + aberto.progresso.total + (aberto.progresso.atual ? ': ' + aberto.progresso.atual : '') : '',
      // o resumo da execução (concluído): os números e os clientes que mais receberam
      resultado: resultado ? {
        numeros: [
          { valor: resultado.arquivados, rotulo: resultado.arquivados === 1 ? 'arquivo arquivado' : 'arquivos arquivados', aviso: false },
          { valor: resultado.clientes.length, rotulo: resultado.clientes.length === 1 ? 'cliente' : 'clientes', aviso: false },
          { valor: resultado.naoIdentificados, rotulo: 'sem cliente', aviso: resultado.naoIdentificados > 0 },
        ],
        vazio: resultado.arquivados === 0,
        clientes: resultado.clientes.slice(0, 4).map(c => ({ chave: c.codigo, rotulo: c.codigo + ' · ' + c.nome, n: c.n })),
        maisClientes: Math.max(0, resultado.clientes.length - 4),
      } : null,
      semResultado: pedido.status === 'concluido' && !pedido.execucao,
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
