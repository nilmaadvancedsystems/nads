// ViewModel do painel do SIEG na etapa do Fiscal (06/10/2026): na Inicial, quantas notas o cliente emitiu e recebeu no
// mês (a contagem da madrugada, ou o "Contar agora") e o "Baixar XMLs do SIEG" (07/10/2026: todos os XMLs do mês na pasta
// do cliente no Drive, para o Alterdata, e o resumo das notas no nads); na Conferência de Saídas, a sequência das saídas
// (os buracos e as canceladas), que o robô baixa quando pedem. O robô desligado (sem as credenciais do SIEG) aparece como
// aviso. Cada pedido abre a janela flutuante do andamento (os passos, a barra e o resultado, ou o erro).
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import type { PedidoSieg } from '../../dados/sieg';
import { useSieg } from '../../dados/repo';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const rodando = (p: PedidoSieg | null) => !!p && (p.status === 'pendente' || p.status === 'processando');

type Janela = 'contagem' | 'xmls';

/** Os passos de cada pedido; o passo da vez sai do status e do andamento que o robô grava. */
function passosDe(tipo: Janela, p: PedidoSieg | null): { passos: string[]; atual: number; pct: number } {
  if (tipo === 'contagem') {
    const passos = ['Pedido enviado ao robô', 'O robô pegou o pedido', 'Contando as notas emitidas no SIEG', 'Contando as notas recebidas no SIEG', 'Pronto'];
    const atual = !p ? 0 : p.status === 'pendente' ? 1 : p.status === 'processando' ? (p.andamento === 'recebidas' ? 3 : 2) : p.status === 'concluido' ? 4 : 0;
    return { passos, atual, pct: [8, 25, 50, 78, 100][atual] };
  }
  const salvando = !!p && /^Salvando/.test(p.andamento);
  const passos = ['Pedido enviado ao robô', 'O robô pegou o pedido', 'Baixando os XMLs do SIEG', 'Salvando na pasta do cliente no Drive', 'Pronto'];
  const atual = !p ? 0 : p.status === 'pendente' ? 1 : p.status === 'processando' ? (salvando ? 3 : 2) : p.status === 'concluido' ? 4 : 0;
  return { passos, atual, pct: [5, 12, 50, 90, 100][atual] };
}

export function useSiegDaEtapa(tipo: 'contagem' | 'saidas', codigo: string, competencia: string) {
  const repo = useSieg();
  const { toast } = useRetorno();
  const robo = repo.robo();
  const cont = repo.contagem(codigo, competencia);
  const sai = repo.saidas(codigo, competencia);
  const notas = repo.notas(codigo, competencia);
  const pedido = repo.pedido(codigo, competencia, 'saidas');
  const pedidoContagem = repo.pedido(codigo, competencia, 'contagem');
  const pedidoXmls = repo.pedido(codigo, competencia, 'xmls');
  const contando = rodando(pedidoContagem);
  const baixandoXmls = rodando(pedidoXmls);
  // a janela do andamento (Vitor, 07/10/2026: "quero uma barra de progresso/tela flutuante para a pessoa ter o feedback"):
  // abre no clique, acompanha o pedido e fica até o ×
  const [janela, setJanela] = useState<Janela | null>(null);
  const conf = sai.dados ? t.sieg.conferirSaidas(sai.dados) : null;
  const linhas = (r: Record<t.sieg.TipoDeNota, number>) => t.sieg.TIPOS_DE_NOTA.filter(x => r[x.id] > 0).map(x => ({ rotulo: x.rotulo, n: r[x.id] }));
  const pedindo = rodando(pedido);

  const pJanela = janela === 'contagem' ? pedidoContagem : janela === 'xmls' ? pedidoXmls : null;
  const andamento = janela ? (() => {
    const { passos, atual, pct } = passosDe(janela, pJanela);
    const pronto = atual === 4;
    return {
      titulo: janela === 'contagem'
        ? (pronto ? 'Contagem pronta' : 'Contando no SIEG')
        : (pronto ? 'XMLs baixados' : 'Baixando os XMLs do SIEG'),
      tituloDoErro: janela === 'contagem' ? 'A contagem não deu certo' : 'Os XMLs não vieram',
      erro: pJanela?.status === 'erro' ? pJanela.erro || 'o robô não conseguiu' : '',
      pronto, pct,
      // o que o robô está fazendo agora (ex.: "Recebidas · NF-e (120 XMLs até agora)")
      detalhe: pJanela?.status === 'processando' && pJanela.andamento && !['emitidas', 'recebidas'].includes(pJanela.andamento) ? pJanela.andamento : '',
      passos: passos.map((texto, i) => ({ texto, feito: i < atual || pronto, atual: i === atual && !pronto })),
      resultado: !pronto ? '' : janela === 'contagem'
        ? (cont.dados ? t.sieg.totalDe(cont.dados.emitidas) + ' emitidas · ' + t.sieg.totalDe(cont.dados.recebidas) + ' recebidas' : '')
        : (pJanela?.resultado ? pJanela.resultado.arquivos + ' XMLs (' + pJanela.resultado.novos + ' novos) · ' + pJanela.resultado.emitidas + ' notas emitidas e '
          + pJanela.resultado.recebidas + ' recebidas · em ' + pJanela.resultado.pasta : ''),
    };
  })() : null;

  async function pedir(qual: Janela) {
    if (!codigo || (qual === 'contagem' ? contando : baixandoXmls)) return;
    setJanela(qual);
    try { await (qual === 'contagem' ? repo.pedirContagem(codigo, competencia) : repo.pedirXmls(codigo, competencia)); }
    catch (err) { setJanela(null); toast('Não consegui pedir ao SIEG: ' + (err instanceof Error ? err.message : String(err))); }
  }

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
    /** o último "Baixar XMLs": quantos, quando e em que pasta */
    xmls: notas.dados ? {
      arquivos: notas.dados.arquivos, quando: quando(notas.dados.em), pasta: notas.dados.pasta,
      emitidas: notas.dados.emitidas.length, recebidas: notas.dados.recebidas.length,
    } : null,
    saidas: conf ? {
      ...conf,
      quando: quando(sai.dados!.em),
      series: conf.series.map(x => ({ ...x, faltandoTexto: t.sieg.emFaixas(x.faltando), canceladasTexto: t.sieg.emFaixas(x.canceladas) })),
    } : null,
    saidasCarregadas: sai.carregadas,
    pedido: pedido ? { ...pedido, pedindo } : null,
    pedindo,
    /** o "Contar agora" e o "Baixar XMLs do SIEG" (o painel atualiza sozinho quando chega) */
    contando,
    baixandoXmls,
    erroDaContagem: pedidoContagem?.status === 'erro' ? pedidoContagem.erro : '',
    andamento,
    fecharAndamento: () => setJanela(null),
    contar: () => pedir('contagem'),
    baixarXmls: () => pedir('xmls'),
    async baixar() {
      if (pedindo) return;
      try { await repo.pedirSaidas(codigo, competencia); toast('Pedido ao SIEG: o robô baixa as saídas do mês (alguns minutos).'); }
      catch (err) { toast('Não consegui pedir ao SIEG: ' + (err instanceof Error ? err.message : String(err))); }
    },
  };
}

export type VmSiegDaEtapa = ReturnType<typeof useSiegDaEtapa>;
