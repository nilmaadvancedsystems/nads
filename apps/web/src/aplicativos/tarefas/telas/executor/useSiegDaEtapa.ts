// ViewModel do painel do SIEG na etapa do Fiscal (06/10/2026): na Inicial, quantas notas o cliente emitiu e recebeu no
// mês (a contagem da madrugada); na Conferência de Saídas, a sequência das saídas (os buracos e as canceladas), que o robô
// baixa quando pedem. O robô desligado (sem as credenciais do SIEG) aparece como aviso.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useSieg } from '../../dados/repo';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function useSiegDaEtapa(tipo: 'contagem' | 'saidas', codigo: string, competencia: string) {
  const repo = useSieg();
  const { toast } = useRetorno();
  const robo = repo.robo();
  const cont = repo.contagem(codigo, competencia);
  const sai = repo.saidas(codigo, competencia);
  const pedido = repo.pedido(codigo, competencia, 'saidas');
  const pedidoContagem = repo.pedido(codigo, competencia, 'contagem');
  const contando = !!pedidoContagem && (pedidoContagem.status === 'pendente' || pedidoContagem.status === 'processando');
  const conf = sai.dados ? t.sieg.conferirSaidas(sai.dados) : null;
  const linhas = (r: Record<t.sieg.TipoDeNota, number>) => t.sieg.TIPOS_DE_NOTA.filter(x => r[x.id] > 0).map(x => ({ rotulo: x.rotulo, n: r[x.id] }));
  const pedindo = !!pedido && (pedido.status === 'pendente' || pedido.status === 'processando');
  return {
    tipo,
    exemplos: repo.exemplos,
    desligado: robo.carregado && !robo.ligado ? (robo.motivo === 'sem acesso' ? 'Sem acesso aos dados do SIEG.' : 'O robô do SIEG ainda não está ligado (' + (robo.motivo || 'sem credenciais') + ').') : '',
    contagem: cont.dados ? {
      emitidas: t.sieg.totalDe(cont.dados.emitidas), recebidas: t.sieg.totalDe(cont.dados.recebidas),
      linhasEmitidas: linhas(cont.dados.emitidas), linhasRecebidas: linhas(cont.dados.recebidas),
      quando: quando(cont.dados.em),
    } : null,
    contagemCarregada: cont.carregada,
    saidas: conf ? {
      ...conf,
      quando: quando(sai.dados!.em),
      series: conf.series.map(x => ({ ...x, faltandoTexto: t.sieg.emFaixas(x.faltando), canceladasTexto: t.sieg.emFaixas(x.canceladas) })),
    } : null,
    saidasCarregadas: sai.carregadas,
    pedido: pedido ? { ...pedido, pedindo } : null,
    pedindo,
    /** o "Contar agora": o robô conta as notas desta empresa no mês (o painel atualiza sozinho quando chega) */
    contando,
    erroDaContagem: pedidoContagem?.status === 'erro' ? pedidoContagem.erro : '',
    async contar() {
      if (contando || !codigo) return;
      try { await repo.pedirContagem(codigo, competencia); toast('Pedido ao SIEG: o robô conta as notas deste mês (alguns segundos).'); }
      catch (err) { toast('Não consegui pedir ao SIEG: ' + (err instanceof Error ? err.message : String(err))); }
    },
    async baixar() {
      if (pedindo) return;
      try { await repo.pedirSaidas(codigo, competencia); toast('Pedido ao SIEG: o robô baixa as saídas do mês (alguns minutos).'); }
      catch (err) { toast('Não consegui pedir ao SIEG: ' + (err instanceof Error ? err.message : String(err))); }
    },
  };
}

export type VmSiegDaEtapa = ReturnType<typeof useSiegDaEtapa>;
