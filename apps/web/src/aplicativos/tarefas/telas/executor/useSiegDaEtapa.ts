// ViewModel do painel do SIEG na etapa do Fiscal (06/10/2026): na Inicial, quantas notas o cliente emitiu e recebeu no
// mês (a contagem da madrugada, ou o "Contar agora") e o "Baixar XMLs do SIEG" (07/10/2026: todos os XMLs do mês na pasta
// do cliente no Drive, para o Alterdata, e o resumo das notas no nads); na Conferência de Saídas, a sequência das saídas
// (os buracos e as canceladas), que o robô baixa quando pedem. O robô desligado (sem as credenciais do SIEG) aparece como
// aviso. Cada pedido abre a janela flutuante do andamento (os passos, a barra e o resultado, ou o erro).
import { tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
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
  // a ordem (08/10/2026: "seja entregue para a pessoa o zip dos XML, depois que ele introduza esses XML no sistema (nads),
  // depois que ele salve no drive"): o .zip, as notas no nads, o Drive
  const a = p ? p.andamento : '';
  const passos = ['Pedido enviado ao robô', 'O robô pegou o pedido', 'Baixando os XMLs do SIEG', 'O .zip no seu computador', 'Lendo as notas no nads', 'Salvando na pasta do cliente no Drive', 'Pronto'];
  const fase = /^Salvando/.test(a) ? 5 : /^Lendo/.test(a) ? 4 : /^Entregando/.test(a) ? 3 : 2;
  const atual = !p ? 0 : p.status === 'pendente' ? 1 : p.status === 'processando' ? fase : p.status === 'concluido' ? 6 : 0;
  return { passos, atual, pct: [5, 10, 40, 60, 72, 86, 100][atual] };
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
    const pronto = atual === passos.length - 1;
    return {
      titulo: janela === 'contagem'
        ? (pronto ? 'Contagem pronta' : 'Contando no SIEG')
        : (pronto ? 'XMLs baixados' : 'Baixando os XMLs do SIEG'),
      tituloDoErro: janela === 'contagem' ? 'A contagem não deu certo' : 'Os XMLs não vieram',
      erro: pJanela?.status === 'erro' ? pJanela.erro || 'o robô não conseguiu' : '',
      pronto, pct,
      /** a janela do "Baixar XMLs" (mostra o "Baixar o .zip") */
      xmls: janela === 'xmls',
      // o que o robô está fazendo agora (ex.: "Recebidas · NF-e (120 XMLs até agora)")
      detalhe: pJanela?.status === 'processando' && pJanela.andamento && !['emitidas', 'recebidas'].includes(pJanela.andamento) ? pJanela.andamento : '',
      passos: passos.map((texto, i) => ({ texto, feito: i < atual || pronto, atual: i === atual && !pronto })),
      resultado: !pronto ? '' : janela === 'contagem'
        ? (cont.dados ? t.sieg.totalDe(cont.dados.emitidas) + ' emitidas · ' + t.sieg.totalDe(cont.dados.recebidas) + ' recebidas' : '')
        : (pJanela?.resultado ? pJanela.resultado.arquivos + ' XMLs (' + pJanela.resultado.novos + ' novos) · ' + pJanela.resultado.emitidas + ' notas emitidas e '
          + pJanela.resultado.recebidas + ' recebidas · em ' + pJanela.resultado.pasta + (pJanela.resultado.zip ? ' (com o ' + pJanela.resultado.zip + ')' : '') : ''),
    };
  })() : null;

  // o .zip dos XMLs: assim que o robô entrega, baixa sozinho para quem pediu nesta tela (uma vez por pedido); depois
  // fica o "Baixar o .zip" (o robô guarda por 1 dia)
  const zipBaixado = useRef('');
  const [baixandoZip, setBaixandoZip] = useState(false);
  async function baixarZip() {
    const z = pedidoXmls?.zip;
    if (!z || baixandoZip) return;
    setBaixandoZip(true);
    try { baixarBytes(await repo.baixarZip(z), z.nome, 'application/zip'); }
    catch (err) { toast('Não consegui baixar o .zip: ' + (err instanceof Error ? err.message : String(err))); }
    finally { setBaixandoZip(false); }
  }
  const zipDaVez = janela === 'xmls' && pedidoXmls?.zip && pedidoXmls.id ? pedidoXmls.id : '';
  useEffect(() => {
    if (!zipDaVez || zipBaixado.current === zipDaVez) return;
    zipBaixado.current = zipDaVez;
    void baixarZip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipDaVez]);

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
    /** o .zip do último "Baixar XMLs" (enquanto o robô guarda) */
    zip: pedidoXmls?.zip ? { nome: pedidoXmls.zip.nome, tamanho: (pedidoXmls.zip.bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' } : null,
    baixandoZip,
    baixarZip,
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
