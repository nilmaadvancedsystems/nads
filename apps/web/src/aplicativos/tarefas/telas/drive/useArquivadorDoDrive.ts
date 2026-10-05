// ViewModel do "Arquivar agora" no Drive (o mesmo botão das Pendências do Entregas): se o PC do arquivador está ligado
// (o ponto em robo/arquivador, até 3 minutos), o pedido aberto (ou o último, se foi nas últimas 24 h) com a %, a
// organização rodando por fora do botão (a das 9h: a fase em que está; Vitor, 05/10/2026: "quero que mostre que está
// rodando"), as rodadas de hoje somadas, pedir (com confirmação) e cancelar enquanto não começou. Some para quem não pode
// (só admin e contábil).
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useArquivador } from '../../dados/repo';
import type { PedidoDeArquivo } from '../../dados/arquivador';

const ABERTOS = ['pendente', 'aguardando', 'processando'];
/** As fases da rotina (01-ORQUESTRADOR), em português de quem usa. */
const FASES: readonly (readonly [string, string])[] = [
  ['0', 'Abrindo'], ['1', 'Vendo o que chegou'], ['1b', 'Abrindo os compactados (.zip, .rar)'], ['2', 'Separando os PDFs'],
  ['3-4', 'Descobrindo o cliente de cada arquivo'], ['4b', 'Separando as exceções'], ['5', 'Conferindo'], ['6', 'Conferindo a integridade'],
  ['7', 'Registrando e guardando'], ['8', 'Fechando'],
];
const hojeNoId = () => { const d = new Date(); return 'EXEC-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-'; };
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
  const [execucaoAberta, setExecucaoAberta] = useState<string | null>(null);

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

  // a organização rodando por fora do botão (a das 9h): com o PC ligado e sem pedido aberto
  const r = e.rotina;
  const rodandoPorFora = ligado && !!r?.ativa && !r.deUmPedido && !aberto;
  const iFase = r?.fase ? FASES.findIndex(f => f[0] === r.fase) : -1;
  const pctRotina = rodandoPorFora && iFase >= 0 ? Math.min(99, Math.round((iFase + 0.5) / FASES.length * 100)) : null;
  const conversa = repo.conversa();
  const hora = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  /** EXEC-20261005-132848 → o dia e a hora em que a execução começou */
  const doId = (id: string) => {
    const m = /^EXEC-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(id);
    return m ? { dia: id.startsWith(hojeNoId()) ? 'Hoje' : m[3] + '/' + m[2], hora: m[4] + ':' + m[5] } : { dia: '', hora: '' };
  };
  // as rodadas de hoje (cada execução publicada é uma rodada)
  const deHoje = repo.execucoesRecentes().filter(x => x.id.startsWith(hojeNoId()));
  const hoje = deHoje.length ? {
    rodadas: deHoje.length,
    numeros: [
      { valor: deHoje.reduce((s, x) => s + x.arquivados, 0), rotulo: 'arquivados hoje', aviso: false },
      { valor: new Set(deHoje.flatMap(x => x.codigos)).size, rotulo: 'clientes', aviso: false },
      { valor: deHoje.reduce((s, x) => s + x.naoIdentificados, 0), rotulo: 'sem cliente', aviso: deHoje.some(x => x.naoIdentificados > 0) },
    ],
  } : null;

  return {
    exemplos: repo.exemplos,
    visivel: !e.semPermissao,
    ligado,
    pc: ligado
      ? 'PC do arquivador ligado' + (e.situacao === 'rodando' ? ' · organizando agora' : e.situacao === 'aguardando' ? ' · esperando para começar' : '')
      : 'PC do arquivador desligado' + (e.em && Date.parse(e.em) > 0 ? ' desde ' + quando(e.desligadoEm || e.em) : ''),
    rotulo: aberto ? (aberto.status === 'processando' ? 'Organizando' + (pct != null ? ' ' + pct + '%' : '…') : 'Arquivamento pedido')
      : rodandoPorFora ? 'Organizando' + (pctRotina != null ? ' ' + pctRotina + '%' : '…') : 'Arquivar agora',
    ocupado: !!aberto || rodandoPorFora,
    podePedir: !aberto,
    rotina: rodandoPorFora && r ? {
      titulo: 'Organização em andamento',
      detalhe: (r.inicio ? 'Começou ' + quando(r.inicio) + ' (há ' + duracao(r.inicio, agora) + ')' : 'Rodando agora') + (r.ultimoSinalEm ? ' · último sinal há ' + duracao(r.ultimoSinalEm, agora) : '') + '.',
      etapa: iFase >= 0 ? 'Fase ' + (iFase + 1) + ' de ' + FASES.length + ': ' + FASES[iFase][1] : '',
      pct: pctRotina,
    } : null,
    hoje,
    // as 10 fases da rotina: as feitas, a de agora e as que faltam (como a lista de passos do Claude)
    fases: rodandoPorFora && iFase >= 0 ? FASES.map((f, i) => ({ nome: f[1], estado: i < iFase ? 'feita' : i === iFase ? 'atual' : 'falta' })) : [],
    // a conversa do Claude que roda a rotina e o relatório do dia (o arquivador do PC publica)
    conversa: {
      mensagens: conversa.mensagens.map((m, i) => ({ ...m, chave: i + ':' + m.em, hora: hora(m.em) })),
      atualizada: conversa.atualizadaEm ? quando(conversa.atualizadaEm) : '',
    },
    relatorioDoDia: conversa.relatorio ? { arquivo: conversa.relatorio.arquivo, quando: quando(conversa.relatorio.em), texto: conversa.relatorio.texto } : null,
    rodadasHoje: deHoje.map(x => ({ id: x.id, hora: doId(x.id).hora, arquivados: x.arquivados, clientes: x.codigos.length, semCliente: x.naoIdentificados })),
    // as últimas execuções, por dia; a aberta mostra os clientes, o relatório e a mensagem final
    execucoes: repo.execucoesRecentes().map(x => ({ id: x.id, ...doId(x.id), arquivados: x.arquivados, clientes: x.codigos.length, semCliente: x.naoIdentificados })),
    execucaoAberta,
    // o pedido do botão só vai para o Agora aberto ou com erro (os concluídos ficam em Execuções)
    pedidoNoAgora: !!pedido && (ABERTOS.includes(pedido.status) || pedido.status === 'erro'),
    // a última rodada publicada (o que o Agora mostra quando nada roda): os números e os clientes que mais receberam
    ultimaRodada: (() => {
      const x = repo.execucoesRecentes()[0];
      if (!x) return null;
      const d = doId(x.id);
      const res = repo.resultado(x.id);
      const clientes = (res?.clientes || []).slice(0, 6);
      const maior = Math.max(1, ...clientes.map(c => c.n));
      return {
        quando: (d.dia === 'Hoje' ? 'hoje' : d.dia) + ' às ' + d.hora,
        numeros: [
          { valor: x.arquivados, rotulo: x.arquivados === 1 ? 'arquivo arquivado' : 'arquivos arquivados', aviso: false },
          { valor: x.codigos.length, rotulo: x.codigos.length === 1 ? 'cliente' : 'clientes', aviso: false },
          { valor: x.naoIdentificados, rotulo: 'sem cliente', aviso: x.naoIdentificados > 0 },
        ],
        clientes: clientes.map(c => ({ chave: c.codigo, codigo: c.codigo, nome: c.nome, n: c.n, pct: Math.round(c.n / maior * 100) })),
        maisClientes: Math.max(0, (res?.clientes.length || 0) - clientes.length),
      };
    })(),
    abrirExecucao: (id: string) => setExecucaoAberta(a => (a === id ? null : id)),
    verExecucao: (id: string) => setExecucaoAberta(id),
    detalheAberto: execucaoAberta ? {
      ...repo.detalhe(execucaoAberta),
      clientes: (repo.resultado(execucaoAberta)?.clientes || []).map(c => ({ chave: c.codigo, rotulo: c.codigo + ' · ' + c.nome, n: c.n })),
    } : null,
    notaAoPedir: rodandoPorFora ? 'Se pedir agora, começa quando a organização em andamento terminar.' : 'Organiza a pasta Claudio Secretario agora, como a das 9h.',
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
