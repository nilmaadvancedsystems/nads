// ViewModel de LCDPR › Lançamentos (o "Importar e conferir" do lcdpr.html): ler os relatórios do SIEG (vários de uma
// vez; cada arquivo lido fica na lista com o Desfazer), o quanto já está classificado, a busca e o "só REVISAR" (os
// grupos de mesmo NCM e fornecedor saíram em 11/11/2026: "pra que isso?"), a categoria de cada linha e da seleção (com o Desfazer), a
// regra de NCM sugerida depois de classificar à mão e baixar a planilha .xls.
// Desde 11/11/2026 ("precisa que tenha um controle mes a mes de cada um das coisas importadas pois preciso poder alterar a
// conta que vai lancar optando pelos bancos de carlos lucas e caixa"; "também quero que puxe do sieg"): tudo é do MÊS
// aberto e fica guardado; o mesmo documento importado de novo não duplica; cada linha (e a seleção) escolhe a conta de
// pagamento (a Conta Credora: o Caixa ou um banco), lembrada para o fornecedor; e o "Puxar do SIEG" traz as notas e os
// CT-e do mês do resumo que o robô baixa no "Baixar XMLs do SIEG" (pedindo o download quando ainda não há, ou é antigo).
// Vários meses ao mesmo tempo ("quero poder mexer em mais de um mes ao mesmo tempo"): a lista junta os meses abertos; o
// que entra vai para o mês da data; o "Puxar do SIEG" puxa cada mês; a planilha sai com todos.
import { formatos, lcdpr, type tarefas } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { PedidoSieg } from '../../../dados/sieg';
import { useSieg } from '../../../dados/repo';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';
import { contasLembradas, lembrarContasDe, lerSessao, mesDoLancamento, mudarCadaMes, mudarMes, mudarTela, trocarLancamentos, useSessaoDoLcdpr } from './useSessaoDoLcdpr';

/** O que dá para desfazer agora (o aviso no topo com o Desfazer). */
export interface Desfazivel { titulo: string; voltar: () => void }

const ROTULO_DA_REGRA: Record<lcdpr.OrigemDaRegra, { rotulo: string; classe: string } | null> = {
  'NCM': { rotulo: 'NCM', classe: 'badge badge-ok' },
  'Padrão CT-e': { rotulo: 'padrão CT-e', classe: 'badge badge-neutral' },
  'Manual': { rotulo: 'manual', classe: 'badge badge-neutral' },
  'Nenhuma': null,
};

const SITUACAO: Record<lcdpr.SituacaoDoMes, string> = { vazio: 'parada', revisar: 'parada', pronto: 'andamento', baixado: 'concluida' };

const dataHora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const espera = () => new Promise(r => setTimeout(r, 0));
const rodando = (p: PedidoSieg | null) => !!p && (p.status === 'pendente' || p.status === 'processando');
const novoId = () => Date.now() + '-' + Math.random().toString(36).slice(2);

export function useLancamentosLcdpr() {
  const r = useRegrasDoLcdpr();
  const s = useSessaoDoLcdpr();
  const sieg = useSieg();
  const { modal, toast, aviso } = useRetorno();
  const [lendo, setLendo] = useState('');
  const [aberto, setAberto] = useState<number | 'novo' | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazivel | null>(null);
  /** os meses à espera do robô no "Puxar do SIEG": o mês → o id do pedido de antes do clique (para não pegar o velho) */
  const [esperandoSieg, setEsperandoSieg] = useState<Readonly<Record<string, string>>>({});
  /** a nota aberta (a DANFE; 11/11/2026: "tem que ter como ver a nota (danfe) por aqui") e o mês dela */
  const [vendo, setVendo] = useState<{ nota: tarefas.sieg.NotaDoSieg; competencia: string } | null>(null);

  const falhou = (msg: string) => aviso({ tom: 'erro', titulo: 'Não gravou o mês do LCDPR', texto: msg });
  const lancs = s.lancamentos;
  const total = lancs.length;
  const revisar = lancs.filter(l => l.revisar).length;
  const valor = lancs.reduce((t, l) => t + (Number(l.valor) || 0), 0);
  const visiveis = lcdpr.lancamentosVisiveis(lancs, { busca: s.busca, soRevisar: s.soRevisar });
  const contas = lcdpr.contasDePagamento(r.config);
  const padrao = r.config.config.contaCredoraPadrao;
  const varios = s.meses.length > 1;
  // a situação: a de cada mês e a de todos juntos (baixada só quando todos os meses com lançamento foram baixados)
  const comLancamento = s.porMes.filter(m => m.lancamentos.length);
  const situacao = lcdpr.situacaoDoMes({ lancamentos: [...lancs], baixadaEm: comLancamento.length && comLancamento.every(m => m.baixadaEm) ? 'sim' : '' });
  const unico = s.porMes.length === 1 ? s.porMes[0] : null;
  const ultimo = [...s.porMes].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0];

  // o SIEG de cada mês aberto: o resumo que o robô baixou e o pedido de baixar
  const codigo = s.empresa != null ? String(s.empresa) : '';
  const robo = sieg.robo();
  const doSieg = s.meses.map(mes => ({ mes, notas: codigo ? sieg.notas(codigo, mes).dados : null, pedido: codigo ? sieg.pedido(codigo, mes, 'xmls') : null }));
  const baixandoMeses = doSieg.filter(x => rodando(x.pedido) || x.mes in esperandoSieg);
  const baixando = baixandoMeses.length > 0;
  const notasDoMes = (mes: string) => doSieg.find(x => x.mes === mes)?.notas || null;
  const servem = doSieg.filter(x => lcdpr.resumoServeParaOLcdpr(x.notas));

  /** a categoria em vários de uma vez, com o Desfazer (aplicar em lote reescrevia 200 linhas sem volta) */
  const classificar = (ids: readonly number[], categoria: string) => {
    const antes = lerSessao().lancamentos.filter(l => ids.includes(l.id));
    if (!antes.length || !categoria) return [];
    const depois = antes.map(l => lcdpr.aplicarCategoria(l, categoria, r.config.categorias));
    trocarLancamentos(depois, falhou);
    setDesfazer({ titulo: antes.length + ' lançamento(s) classificado(s)', voltar: () => trocarLancamentos(antes, falhou) });
    return depois;
  };

  /** a conta de pagamento em vários de uma vez (com o Desfazer); o fornecedor fica com ela */
  const pagarCom = (ids: readonly number[], conta: string) => {
    const antes = lerSessao().lancamentos.filter(l => ids.includes(l.id) && l.contaCred !== conta);
    if (!antes.length || !conta) return;
    const depois = antes.map(l => lcdpr.aplicarContaCredora(l, conta));
    trocarLancamentos(depois, falhou);
    lembrarContasDe(depois, padrao).catch((e: Error) => falhou(e.message));
    if (antes.length > 1) setDesfazer({ titulo: antes.length + ' lançamento(s) com a conta ' + lcdpr.rotuloDaConta(contas, conta), voltar: () => trocarLancamentos(antes, falhou) });
  };

  /** depois de classificar à mão: oferece a regra do NCM (que vale já para o que está em REVISAR e para as próximas) */
  const talvezVirarRegra = async (l: lcdpr.Lancamento) => {
    const sug = lcdpr.regraSugerida(l, lerSessao().lancamentos, r.atual());
    if (!sug) return;
    const ok = await modal({
      icone: 'hash', titulo: 'Classificar sempre o NCM ' + sug.regra.prefixo + '… na conta ' + sug.regra.conta + '?',
      texto: 'Vale para ' + sug.quantas + ' lançamento(s) deste mês e para as próximas importações, sem passar por REVISAR. Dá para mudar depois em LCDPR › Regras de NCM.',
      botoes: [{ rotulo: 'Agora não', valor: false, variante: 'btn-outline' }, { rotulo: 'Criar regra', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    const atual = r.atual();
    const nova = { ...atual, ncmRules: [...atual.ncmRules, sug.regra] };
    if (!(await r.gravar(nova))) return;
    mudarCadaMes(m => ({ ...m, lancamentos: lcdpr.aplicarRegraNosPendentes(m.lancamentos, sug.regra, nova.categorias) }), falhou);
    toast('Regra criada para o NCM ' + sug.regra.prefixo + '.');
  };

  /**
   * Junta os lançamentos lidos, cada um no mês da data (sem data, ou fora dos meses abertos, no `padrao`): os repetidos não
   * entram, a conta lembrada do fornecedor já vem, e cada mês registra a leitura.
   */
  const juntar = (arquivo: string, bytes: number, lidos: lcdpr.Lancamento[], padrao: string): { entraram: number; repetidos: number } => {
    let entraram = 0, repetidos = 0;
    for (const [mes, doMes] of lcdpr.porMes(lidos, lerSessao().meses, padrao)) {
      mudarMes(mes, m => {
        // os ids são os do mês (o que veio do arquivo é renumerado depois dos guardados)
        let proximo = lcdpr.proximoIdDoMes(m.lancamentos, mes);
        const novos = lcdpr.comContaDosFornecedores(doMes, contasLembradas()).map(l => ({ ...l, id: proximo++ }));
        const j = lcdpr.juntarNoMes(m.lancamentos, novos);
        entraram += j.entraram.length;
        repetidos += j.repetidos;
        const imp: lcdpr.ImportacaoDoMes = { id: novoId(), arquivo, bytes, em: new Date().toISOString(), quantos: j.entraram.length, repetidos: j.repetidos, erro: '', ids: j.entraram.map(l => l.id), desfeita: '', por: '' };
        return { ...m, lancamentos: j.lancamentos, importacoes: [imp, ...m.importacoes].slice(0, lcdpr.IMPORTACOES_GUARDADAS) };
      }, falhou);
    }
    return { entraram, repetidos };
  };

  const registrarErro = (arquivo: string, bytes: number, erro: string) => {
    const imp: lcdpr.ImportacaoDoMes = { id: novoId(), arquivo, bytes, em: new Date().toISOString(), quantos: 0, repetidos: 0, erro, ids: [], desfeita: '', por: '' };
    mudarMes(lerSessao().competencia, m => ({ ...m, importacoes: [imp, ...m.importacoes].slice(0, lcdpr.IMPORTACOES_GUARDADAS) }), falhou);
  };

  /** as notas do resumo do SIEG de um mês viram lançamentos dele */
  const doResumo = (n: tarefas.sieg.NotasSieg, mes: string) => {
    const lido = lcdpr.lerDoSieg(n, r.atual(), (() => { let i = 1; return () => i++; })());
    const { entraram, repetidos } = juntar('SIEG (' + lido.notas + ' nota(s) e ' + lido.fretes + ' CT-e)', 0, lido.lancamentos, mes);
    const fora = [lido.canceladas ? lido.canceladas + ' cancelada(s)' : '', lido.entradas ? lido.entradas + ' nota(s) de entrada (venda)' : ''].filter(Boolean).join(' e ');
    toast((varios ? formatos.mesCurto(mes) + ': ' : '') + entraram + ' lançamento(s) do SIEG' + (repetidos ? '; ' + repetidos + ' já estavam no mês' : '') + (fora ? '; ficaram de fora ' + fora : '') + '.');
    if (lido.semItens) aviso({ tom: 'info', titulo: 'O SIEG veio sem os itens das notas', texto: 'O mês tem notas demais para o resumo guardar os itens: as notas entraram em REVISAR (sem o NCM para classificar).' });
  };

  // o pedido de um mês terminou: as notas novas entram (uma vez)
  const situacaoDosPedidos = doSieg.map(x => x.mes + ':' + (x.pedido ? (x.pedido.id || x.pedido.em) + x.pedido.status : '') + ':' + (x.notas?.em || '')).join('|');
  useEffect(() => {
    for (const [mes, antes] of Object.entries(esperandoSieg)) {
      const x = doSieg.find(d => d.mes === mes);
      const p = x?.pedido;
      if (!x || !p || (p.id || p.em) === antes) continue;
      const tirar = () => setEsperandoSieg(e => { const n = { ...e }; delete n[mes]; return n; });
      if (p.status === 'erro') { tirar(); aviso({ tom: 'erro', titulo: 'O robô não baixou ' + formatos.mesCurto(mes) + ' do SIEG', texto: p.erro || 'Tente de novo.' }); continue; }
      if (p.status !== 'concluido' || !x.notas) continue;
      tirar();
      if (!lcdpr.resumoServeParaOLcdpr(x.notas)) { aviso({ tom: 'info', titulo: 'O robô ainda é o antigo', texto: 'As notas vieram sem o produto, a IE da fazenda e o tipo da nota. Atualize o robô e puxe de novo.' }); continue; }
      doResumo(x.notas, mes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esperandoSieg, situacaoDosPedidos]);
  const emAndamento = baixandoMeses.find(x => rodando(x.pedido)) || baixandoMeses[0];

  return {
    carregada: r.carregada && s.carregado, erro: r.erro || s.erro, exemplos: r.exemplos,
    competencia: varios ? s.meses.map(formatos.mesCurto).join(', ') : s.competencia ? formatos.rot(s.competencia) : '',
    situacao: {
      rotulo: situacao.rotulo, classe: SITUACAO[situacao.situacao],
      baixada: unico?.baixadaEm ? 'Baixada em ' + dataHora(unico.baixadaEm) + (unico.baixadaPor ? ' por ' + unico.baixadaPor : '') : '',
    },
    /** com vários meses: a situação de cada um */
    meses: varios ? s.porMes.map(m => { const x = lcdpr.situacaoDoMes(m); return { mes: m.competencia, rotulo: formatos.mesCurto(m.competencia), situacao: x.rotulo, classe: SITUACAO[x.situacao] }; }) : [],
    salvo: s.salvando ? 'Salvando…' : ultimo?.atualizadoEm ? 'Salvo ' + dataHora(ultimo.atualizadoEm) + (ultimo.atualizadoPor ? ' por ' + ultimo.atualizadoPor : '') : '',
    total, revisar, classificados: total - revisar,
    valor: formatos.reais(valor),
    pronto: total > 0 && revisar === 0,
    pct: total ? Math.round(((total - revisar) / total) * 100) : 0,
    lendo,
    busca: s.busca, soRevisar: s.soRevisar,
    setBusca: (v: string) => mudarTela(x => ({ ...x, busca: v })),
    alternarRevisar: () => mudarTela(x => ({ ...x, soRevisar: !x.soRevisar })),
    categorias: r.config.categorias.map(c => c.nome),
    /** as contas de pagamento (o Caixa e os bancos), para a coluna Conta e o "Pagar com" da seleção */
    contas: contas.map(c => ({ valor: c.codigo, rotulo: c.codigo + ' — ' + c.nome })),

    /** a coluna do mês (só com vários meses abertos) */
    varios,
    linhas: visiveis.map(l => ({
      mes: formatos.mesCurto(mesDoLancamento(l.id)),
      id: l.id, origem: l.origem === 'NF' ? 'NF' : l.origem === 'CTe' ? 'CT-e' : 'À mão', revisar: l.revisar, regra: ROTULO_DA_REGRA[l.origemRegra],
      categoria: l.categoria, data: lcdpr.dataBr(l.data), fornecedor: l.fornecedor, documento: l.documento, valor: formatos.brl(Number(l.valor) || 0),
      /** os itens da nota (12/11/2026: "preciso saber quais os itens"): os produtos; sem eles, os NCMs */
      itens: l.produto ? l.produto.split(' | ').join(' · ') : l.ncm ? 'NCM ' + l.ncm : '',
      conta: l.contaCred,
      /** a conta que não está mais entre as de pagamento aparece como está */
      contaFora: !!l.contaCred && !contas.some(c => c.codigo === l.contaCred),
      /** a nota está no resumo do SIEG do mês (dá para abrir a DANFE) */
      temNota: !!lcdpr.notaDoLancamento(l, notasDoMes(mesDoLancamento(l.id))),
      selecionado: s.selecionados.has(l.id),
    })),
    importacoes: s.importacoes.map(i => ({
      id: i.id, arquivo: (varios ? formatos.mesCurto(i.mes) + ' · ' : '') + i.arquivo, em: dataHora(i.em), erro: i.erro,
      resultado: i.erro || i.quantos + ' lançamento(s)' + (i.repetidos ? ' · ' + i.repetidos + ' já estavam' : ''),
      podeDesfazer: i.ids.length > 0, desfeita: !!i.desfeita,
    })),

    // o SIEG
    sieg: {
      /** o robô está ligado (com as credenciais do SIEG) */
      ligado: robo.ligado,
      motivo: robo.ligado ? '' : robo.motivo || 'O robô do SIEG está desligado.',
      baixando,
      /** o passo do robô (uma linha; com vários meses, de qual) e a porcentagem (null = ainda sem número) */
      andamento: !emAndamento ? '' : (varios ? formatos.mesCurto(emAndamento.mes) + (baixandoMeses.length > 1 ? ' (+' + (baixandoMeses.length - 1) + ')' : '') + ' · ' : '')
        + (rodando(emAndamento.pedido) ? emAndamento.pedido?.andamento || 'O robô pegou o pedido' : 'Pedido enviado ao robô'),
      pct: emAndamento && rodando(emAndamento.pedido) && typeof emAndamento.pedido?.pct === 'number' ? Math.max(2, Math.min(99, Math.round(emAndamento.pedido.pct))) : null,
      /** as notas de todos os meses abertos já baixadas e prontas para o LCDPR (a mais recente) */
      baixadasEm: servem.length === doSieg.length && servem.length ? dataHora(servem.map(x => x.notas?.em || '').sort().slice(-1)[0]) : '',
    },
    /** traz as notas do SIEG de cada mês aberto: do resumo já baixado pelo robô novo, ou pedindo ao robô (de novo = baixar outra vez) */
    async puxarDoSieg(deNovo = false) {
      if (!codigo || !r.carregada || baixando) return;
      const pedir: string[] = [];
      for (const x of doSieg) {
        if (!deNovo && x.notas && lcdpr.resumoServeParaOLcdpr(x.notas)) doResumo(x.notas, x.mes);
        else pedir.push(x.mes);
      }
      if (!pedir.length) return;
      if (!robo.ligado) { aviso({ tom: 'erro', titulo: 'O robô do SIEG está desligado', texto: robo.motivo || 'Sem o robô não dá para baixar as notas. Importe os relatórios do SIEG.' }); return; }
      setEsperandoSieg(Object.fromEntries(pedir.map(mes => { const p = doSieg.find(x => x.mes === mes)?.pedido; return [mes, p ? p.id || p.em : '']; })));
      for (const mes of pedir) {
        try { await sieg.pedirXmls(codigo, mes); } catch (e) {
          setEsperandoSieg(x => { const n = { ...x }; delete n[mes]; return n; });
          aviso({ tom: 'erro', titulo: 'Não pediu ao robô (' + formatos.mesCurto(mes) + ')', texto: e instanceof Error ? e.message : String(e) });
        }
      }
    },

    /** lê os relatórios escolhidos (um de cada vez, dizendo em qual está) */
    async importar(arquivos: File[]) {
      if (!r.carregada || !s.carregado || lendo) return;
      let somados = 0, repetidos = 0;
      for (let k = 0; k < arquivos.length; k++) {
        const f = arquivos[k];
        setLendo('Lendo ' + (k + 1) + ' de ' + arquivos.length + ': ' + f.name + '…');
        await espera();
        try {
          const lido = lcdpr.lerRelatorio(lcdpr.linhasDoArquivo(await f.arrayBuffer()), r.atual(), (() => { let i = 1; return () => i++; })());
          if (lido.erro) {
            registrarErro(f.name, f.size, lido.erro);
            if (lido.tipo === 'desconhecido') aviso({ tom: 'erro', titulo: 'Arquivo "' + f.name + '" não reconhecido', texto: lido.erro === 'planilha vazia' ? 'A planilha está vazia.' : 'Não é o Relatório de Detalhamento de Produtos nem o de CT-e do SIEG.' });
            continue;
          }
          const j = juntar(f.name, f.size, lido.lancamentos, lerSessao().competencia);
          somados += j.entraram;
          repetidos += j.repetidos;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          registrarErro(f.name, f.size, msg);
          aviso({ tom: 'erro', titulo: 'Erro ao ler "' + f.name + '"', texto: msg });
        }
      }
      setLendo('');
      if (somados) toast(somados + ' lançamento(s) importado(s)' + (repetidos ? '; ' + repetidos + ' já estavam no mês' : '') + '.');
      else if (repetidos) toast('Nada novo: os ' + repetidos + ' lançamento(s) já estavam no mês.');
    },

    /** tira os lançamentos que vieram de um arquivo */
    async desfazerImportacao(id: string) {
      const imp = lerSessao().importacoes.find(i => i.id === id);
      if (!imp || !imp.ids.length) return;
      const ok = await modal({
        icone: 'alert', titulo: 'Desfazer esta importação?', texto: 'Saem de ' + formatos.rot(imp.mes) + ' os ' + imp.ids.length + ' lançamento(s) que vieram de "' + imp.arquivo + '", com o que foi mudado neles.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desfazer', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      const fora = new Set(imp.ids);
      mudarMes(imp.mes, m => ({
        ...m, lancamentos: m.lancamentos.filter(l => !fora.has(l.id)),
        importacoes: m.importacoes.map(i => (i.id === id ? { ...i, ids: [], desfeita: new Date().toISOString() } : i)),
      }), falhou);
      mudarTela(x => ({ ...x, selecionados: new Set([...x.selecionados].filter(i => !fora.has(i))) }));
      toast('Importação desfeita.');
    },

    /** a planilha .xls; com lançamento sem classificar, pergunta antes (ele iria sem conta e com o aviso no histórico) */
    async baixar() {
      const todos = lerSessao().lancamentos;
      if (!todos.length) return;
      const pendentes = todos.filter(l => l.revisar);
      if (pendentes.length) {
        const soma = pendentes.reduce((t, l) => t + (Number(l.valor) || 0), 0);
        const ok = await modal({
          icone: 'alert', titulo: 'Baixar com lançamentos sem classificar?',
          texto: pendentes.length + ' lançamento(s), somando ' + formatos.reais(soma) + ', ainda não foram classificados. Eles vão para a planilha sem conta e com o aviso de classificar manualmente no histórico.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Baixar assim mesmo', valor: true, variante: 'btn-primary' }],
        });
        if (!ok) return;
      }
      baixarBytes(lcdpr.planilhaDoLcdpr(todos), lcdpr.NOME_DA_PLANILHA, 'application/vnd.ms-excel');
      // cada mês com lançamento fica como "planilha baixada" (até mudar algum lançamento)
      if (!pendentes.length) mudarCadaMes(m => (m.lancamentos.length ? { ...m, baixadaEm: new Date().toISOString(), baixadaPor: '' } : m), falhou);
    },

    /** a categoria de uma linha (e a regra sugerida) */
    escolherCategoria(id: number, categoria: string) {
      const l = lerSessao().lancamentos.find(x => x.id === id);
      if (!l) return;
      const novo = lcdpr.aplicarCategoria(l, categoria, r.config.categorias);
      trocarLancamentos([novo], falhou);
      if (categoria) void talvezVirarRegra(novo);
    },
    /** a conta de pagamento de uma linha */
    escolherConta: (id: number, conta: string) => pagarCom([id], conta),

    // a seleção
    selecionados: s.selecionados.size,
    todosVisiveisMarcados: visiveis.length > 0 && visiveis.every(l => s.selecionados.has(l.id)),
    alternar: (id: number) => mudarTela(x => { const n = new Set(x.selecionados); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, selecionados: n }; }),
    marcarVisiveis: (marcar: boolean) => {
      const ids = lcdpr.lancamentosVisiveis(lerSessao().lancamentos, { busca: s.busca, soRevisar: s.soRevisar }).map(l => l.id);
      mudarTela(x => { const n = new Set(x.selecionados); for (const i of ids) { if (marcar) n.add(i); else n.delete(i); } return { ...x, selecionados: n }; });
    },
    marcarRevisar: () => {
      const ids = lcdpr.lancamentosVisiveis(lerSessao().lancamentos, { busca: s.busca, soRevisar: s.soRevisar }).filter(l => l.revisar).map(l => l.id);
      mudarTela(x => ({ ...x, selecionados: new Set([...x.selecionados, ...ids]) }));
    },
    limparSelecao: () => mudarTela(x => ({ ...x, selecionados: new Set() })),
    classificarSelecao: (categoria: string) => { classificar([...lerSessao().selecionados], categoria); },
    pagarSelecaoCom: (conta: string) => pagarCom([...lerSessao().selecionados], conta),

    // o Desfazer
    desfazer,
    voltarDesfeito: () => { desfazer?.voltar(); setDesfazer(null); },
    esquecerDesfazer: () => setDesfazer(null),

    // a nota (a DANFE) de um lançamento
    vendo,
    empresa: codigo,
    verNota: (id: number) => {
      const l = lerSessao().lancamentos.find(x => x.id === id);
      const mes = mesDoLancamento(id);
      const n = l ? lcdpr.notaDoLancamento(l, notasDoMes(mes)) : null;
      if (n) setVendo({ nota: n, competencia: mes });
    },
    fecharNota: () => setVendo(null),

    // a janela de um lançamento
    aberto,
    abrir: (id: number) => setAberto(id),
    /** a janela do lançamento à mão */
    novoLancamento: () => setAberto('novo'),
    fechar: () => setAberto(null),
  };
}
