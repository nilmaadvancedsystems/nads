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
  // a fase que o robô grava (08/10/2026); sem ela (o robô antigo), pelo texto do andamento
  const PELA_FASE = { baixando: 2, entregando: 3, nads: 4, drive: 5, pronto: 6 } as const;
  const fase = p?.fase ? PELA_FASE[p.fase] : /^Salvando/.test(a) ? 5 : /^Lendo/.test(a) ? 4 : /^Entregando/.test(a) ? 3 : 2;
  const atual = !p ? 0 : p.status === 'pendente' ? 1 : p.status === 'processando' ? fase : p.status === 'concluido' ? 6 : 0;
  // a porcentagem de verdade quando o robô manda (o download pesado pela contagem, o Drive arquivo por arquivo)
  const pct = atual === 6 ? 100 : p?.status === 'processando' && typeof p.pct === 'number' ? Math.max(2, Math.min(99, p.pct)) : [0, 1, 40, 72, 82, 90, 100][atual];
  return { passos, atual, pct };
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
  // o relógio da janela (o tempo passado e o que falta), de segundo em segundo enquanto o robô trabalha
  const [agora, setAgora] = useState(() => Date.now());
  const conf = sai.dados ? t.sieg.conferirSaidas(sai.dados) : null;
  const linhas = (r: Record<t.sieg.TipoDeNota, number>) => t.sieg.TIPOS_DE_NOTA.filter(x => r[x.id] > 0).map(x => ({ rotulo: x.rotulo, n: r[x.id] }));
  const pedindo = rodando(pedido);

  const pJanela = janela === 'contagem' ? pedidoContagem : janela === 'xmls' ? pedidoXmls : null;
  const trabalhando = rodando(pJanela);
  useEffect(() => {
    if (!trabalhando) return;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [trabalhando]);
  const andamento = janela ? (() => {
    const { passos, atual, pct } = passosDe(janela, pJanela);
    const driveAndando = janela === 'xmls' && pJanela?.status === 'concluido' && pJanela.drive && !pJanela.drive.pronto ? pJanela.drive : null;
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
      // pronto para a pessoa e o Drive ainda gravando por trás (09/10/2026): o passo do Drive segue andando
      detalhe: driveAndando ? 'Salvando no Drive por trás (' + driveAndando.feitos + ' de ' + driveAndando.total + '): pode seguir'
        : pJanela?.drive?.erro ? 'O Drive parou (' + pJanela.drive.erro + '): o próximo pedido salva o que faltou'
          : pJanela?.status === 'processando' && pJanela.andamento && !['emitidas', 'recebidas'].includes(pJanela.andamento) ? pJanela.andamento : '',
      passos: passos.map((texto, i) => (driveAndando && texto === 'Salvando na pasta do cliente no Drive'
        ? { texto: texto + ' (por trás)', feito: false, atual: true }
        : { texto, feito: i < atual || pronto, atual: i === atual && !pronto })),
      /** o tempo: quanto já foi e, com a barra andando, quanto falta (pela velocidade até aqui) */
      tempo: (() => {
        const ini = pJanela?.em ? Date.parse(pJanela.em) : NaN;
        if (!pJanela || Number.isNaN(ini) || pronto) return '';
        const foi = Math.max(0, Math.round((agora - ini) / 1000));
        const falta = pct >= 8 && pct < 100 ? Math.round((foi * (100 - pct)) / pct) : null;
        const mmss = (s: number) => (s >= 60 ? Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s');
        return mmss(foi) + (falta != null ? ' · falta uns ' + mmss(Math.max(1, falta)) : '');
      })(),
      /** os números do "Baixar XMLs": quantos XMLs, quantos vieram do Drive e quantos foram gravados agora */
      numeros: janela === 'xmls' && pJanela?.numeros && pJanela.numeros.xmls ? { ...pJanela.numeros, novos: pJanela.drive ? pJanela.drive.feitos : pJanela.numeros.novos } : null,
      resultado: !pronto ? '' : janela === 'contagem'
        ? (cont.dados ? t.sieg.totalDe(cont.dados.emitidas) + ' emitidas · ' + t.sieg.totalDe(cont.dados.recebidas) + ' recebidas' : '')
        // os números ficam nos painéis; aqui, as notas e onde estão
        : (pJanela?.resultado ? pJanela.resultado.emitidas + ' notas emitidas e ' + pJanela.resultado.recebidas + ' recebidas · na pasta ' + pJanela.resultado.pasta
          + (pJanela.numeros ? '' : ' (' + pJanela.resultado.arquivos + ' XMLs, ' + pJanela.resultado.novos + ' novos)') : ''),
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
