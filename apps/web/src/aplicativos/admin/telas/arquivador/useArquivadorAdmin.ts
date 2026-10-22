// ViewModel de Admin › Arquivador (Vitor, 22/10/2026: "a parte do arquivador é toda bagunçada, quero uma só para ele e bem
// organizada"). Abas pelo ciclo de vida do arquivo, como o Dext: Visão geral, Chegando, Para resolver, Arquivados e Erros,
// com o contador em cada uma; à direita, a Comparação com a rotina antiga e a Configuração. A lista com o detalhe ao lado
// (o porquê de cada arquivo). O "Arquivar agora" e o "Parar" são os mesmos da Tarefas (o view-model do Drive). A aba e o
// arquivo aberto ficam no endereço (?aba=…&item=…), para voltar e para mandar o link.
import { entregas } from '@nads/core';
import { formatoPeloNome, type FormatoDoArquivo, type NomeIcone } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useArquivadorDoDrive } from '../../../tarefas/telas/drive/useArquivadorDoDrive';
import { hojeLocal } from '../../dados/arquivadorNovo';
import { useArquivadorNovo } from '../../dados/repo';

export type AbaDoArquivador = 'geral' | 'chegando' | 'resolver' | 'arquivados' | 'erros' | 'comparacao' | 'config';
export type Tom = 'ok' | 'aviso' | 'erro' | 'neutro';
const ABAS: readonly AbaDoArquivador[] = ['geral', 'chegando', 'resolver', 'arquivados', 'erros', 'comparacao', 'config'];

const mil = (n: number) => n.toLocaleString('pt-BR');
const hora = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
/** "hoje, 14:32", "ontem, 09:10", "20/10, 18:02" */
function quando(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const dias = Math.round((new Date(new Date(agora).toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  return (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })) + ', ' + hora(iso);
}
/** "há 2 min", "há 1 h 10 min" */
function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - (Date.parse(iso) || agora)) / 60000));
  if (min < 1) return 'há menos de 1 min';
  return 'há ' + (min < 60 ? min + ' min' : Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : ''));
}
const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

/** A confiança no tom: 95+ verde, 85+ neutro, abaixo âmbar. */
const tomDaConfianca = (c: number | null): Tom => (c == null ? 'neutro' : c >= 95 ? 'ok' : c >= 85 ? 'neutro' : 'aviso');
const TOM_DA_ACAO: Record<entregas.AcaoDoArquivador, Tom> = { arquivou: 'ok', arquivaria: 'neutro', jaArquivado: 'neutro', naoIdentificado: 'aviso', fica: 'aviso', erro: 'erro' };

/** Uma linha das listas (o ícone do formato, o nome, o cliente, o tipo, a confiança e a hora). */
export interface LinhaDoArquivador {
  id: string; nome: string; formato: FormatoDoArquivo; apoio: string; selo: { rotulo: string; tom: Tom }; confianca: string; tomConfianca: Tom; hora: string;
}

function linhaDoItem(x: entregas.ItemDoArquivador, agora: number): LinhaDoArquivador {
  const cliente = x.cliente ? x.cliente + (x.clienteNome ? ' · ' + x.clienteNome : '') : '';
  const apoio = x.acao === 'erro' ? (x.erroTitulo || 'Erro')
    : x.acao === 'naoIdentificado' || x.acao === 'fica' ? [x.motivoTexto || 'Não identificado', cliente].filter(Boolean).join(' · ')
      : [cliente || 'sem cliente', x.tipo].filter(Boolean).join(' · ');
  return {
    id: x.id, nome: x.nome, formato: formatoPeloNome(x.nome), apoio,
    selo: { rotulo: x.acao === 'arquivou' ? (x.tipo ? entregas.grupoDoTipo(x.tipo).rotulo : 'Arquivado') : entregas.ROTULO_DA_ACAO[x.acao], tom: TOM_DA_ACAO[x.acao] },
    confianca: x.confianca && x.acao !== 'erro' ? x.confianca + '%' : '', tomConfianca: tomDaConfianca(x.confianca), hora: quando(x.em, agora),
  };
}

/** O detalhe de um arquivo: a decisão e o porquê. */
export interface DetalheDoArquivo {
  id: string; nome: string; formato: FormatoDoArquivo; selo: { rotulo: string; tom: Tom }; quando: string;
  dados: { rotulo: string; valor: string }[];
  /** o que fazer (não identificado ou erro) */
  acao: { titulo: string; texto: string; tom: Tom } | null;
  evidencias: string[];
  copias: string[]; pastaNova: string; erroTecnico: string;
}
function detalheDoItem(x: entregas.ItemDoArquivador, agora: number): DetalheDoArquivo {
  const g = x.tipo ? entregas.grupoDoTipo(x.tipo) : null;
  const dados = [
    { rotulo: 'Cliente', valor: x.cliente ? x.cliente + (x.clienteNome ? ' · ' + x.clienteNome : '') : '' },
    { rotulo: 'Tipo', valor: x.tipo ? (g && g.rotulo !== x.tipo ? x.tipo + ' (' + g.rotulo + ')' : x.tipo) : '' },
    { rotulo: 'Confiança', valor: x.confianca != null && x.acao !== 'erro' ? x.confianca + '%' + (x.confianca < 85 ? ' (abaixo de 85%: não arquiva sozinho)' : '') : '' },
    { rotulo: x.acao === 'arquivaria' ? 'Iria para' : x.acao === 'jaArquivado' ? 'Já está em' : 'Destino', valor: x.destino },
    { rotulo: 'Nome final', valor: x.nomeFinal && x.nomeFinal !== x.nome ? x.nomeFinal : '' },
    { rotulo: 'Sugestão de destino', valor: x.destinoSugerido },
    { rotulo: 'Veio de', valor: 'Claudio Secretario\\' + x.rel + (x.dentroDe ? ' (dentro de ' + x.dentroDe + ')' : '') },
    { rotulo: 'Leitura', valor: x.ocr ? 'Por OCR (escaneado)' + (x.ocr.confianca != null ? ', leitura ' + x.ocr.confianca + '%' : '') + (x.ocr.segundos != null ? ', ' + x.ocr.segundos + ' s' : '') + (x.ocr.erro ? ' · ' + x.ocr.erro : '') : '' },
    { rotulo: 'Observação', valor: x.naoAplicado },
  ].filter(d => d.valor);
  const acao = x.acao === 'erro' ? { titulo: x.erroTitulo || 'Erro', texto: x.oQueFazer, tom: 'erro' as Tom }
    : x.acao === 'naoIdentificado' || x.acao === 'fica' ? { titulo: x.motivoTexto || 'Não identificado', texto: x.sugestao, tom: 'aviso' as Tom } : null;
  return {
    id: x.id, nome: x.nome, formato: formatoPeloNome(x.nome), selo: { rotulo: entregas.ROTULO_DA_ACAO[x.acao], tom: TOM_DA_ACAO[x.acao] }, quando: quando(x.em, agora),
    dados, acao, evidencias: x.evidencias, copias: x.copias, pastaNova: x.pastaNova, erroTecnico: x.acao === 'erro' ? x.erro : '',
  };
}

/** Uma barra do gráfico (por tipo ou por cliente). */
export interface BarraDoArquivador { chave: string; rotulo: string; n: number; pct: number; marca: entregas.MarcaDoTipo; formato: FormatoDoArquivo | null; icone: NomeIcone | null; dica: string }

const DIAS_NO_FILTRO = 7;

export function useArquivadorAdmin() {
  const d = useArquivadorNovo();
  const botao = useArquivadorDoDrive();
  const [params, setParams] = useSearchParams();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 30 * 1000); return () => clearInterval(r); }, []);
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('hoje');
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState('');
  const [tipo, setTipo] = useState('');
  const [acaoFiltro, setAcaoFiltro] = useState<entregas.AcaoDoArquivador | ''>('');
  const [dia, setDia] = useState(() => hojeLocal());

  const p = d.painel;
  const aba = (ABAS.includes(params.get('aba') as AbaDoArquivador) ? params.get('aba') : 'geral') as AbaDoArquivador;
  const itemAberto = params.get('item') || '';
  const irPara = (a: AbaDoArquivador, item?: string) => setParams(prev => {
    const n = new URLSearchParams(prev);
    if (a === 'geral') n.delete('aba'); else n.set('aba', a);
    if (item) n.set('item', item); else n.delete('item');
    return n;
  });
  const abrir = (id: string | null) => setParams(prev => { const n = new URLSearchParams(prev); if (id) n.set('item', id); else n.delete('item'); return n; }, { replace: true });

  // o histórico do dia escolhido (só quando a aba Arquivados está aberta)
  const historico = aba === 'arquivados' ? d.dia(dia) : null;

  const situacao = entregas.situacaoDoArquivador(p, agora);
  const progresso = p ? entregas.progressoDaPassada(p.passada, p.ritmo, agora) : null;
  const c = p ? (periodo === 'hoje' ? p.hoje : p.mes) : null;

  const modo = !p?.config ? { rotulo: 'Sem sinal', tom: 'neutro' as Tom, texto: 'O robô do PC ainda não publicou o modo.' }
    : p.config.modo === 'desligado' ? { rotulo: 'Desligado', tom: 'neutro' as Tom, texto: 'O arquivador novo não está olhando a pasta.' }
      : p.config.emProducao ? { rotulo: 'Produção', tom: 'ok' as Tom, texto: p.config.tiposProducao.includes('todos') ? 'Arquiva de verdade todos os tipos.' : 'Arquiva de verdade: ' + p.config.tiposProducao.join(', ') + '. O resto é simulado.' }
        : { rotulo: 'Simulação', tom: 'aviso' as Tom, texto: 'Só registra o que faria: nada é movido.' };

  // os números grandes (o dia ou o mês)
  const numeros = c ? [
    { id: 'arquivados', rotulo: p?.config?.emProducao ? 'Arquivados' : 'Arquivaria (simulação)', valor: mil(c.porAcao.arquivou + c.porAcao.arquivaria), icone: 'checkCircle' as NomeIcone, tom: 'ok' as Tom, aba: 'arquivados' as AbaDoArquivador },
    { id: 'resolver', rotulo: 'Para resolver', valor: mil(c.porAcao.naoIdentificado + c.porAcao.fica), icone: 'alert' as NomeIcone, tom: (c.porAcao.naoIdentificado + c.porAcao.fica ? 'aviso' : 'ok') as Tom, aba: 'resolver' as AbaDoArquivador },
    { id: 'ja', rotulo: 'Já estavam arquivados', valor: mil(c.porAcao.jaArquivado), icone: 'copiar' as NomeIcone, tom: 'neutro' as Tom, aba: 'arquivados' as AbaDoArquivador },
    { id: 'pastas', rotulo: 'Pastas novas', valor: mil(c.pastasNovas.length), icone: 'pasta' as NomeIcone, tom: 'neutro' as Tom, aba: 'arquivados' as AbaDoArquivador },
  ] : [];

  const barrasTipo: BarraDoArquivador[] = useMemo(() => {
    if (!c) return [];
    const b = entregas.barrasPorTipo(c.porTipo);
    const maior = Math.max(1, ...b.map(x => x.n));
    return b.map(x => ({ chave: x.id, rotulo: x.rotulo, n: x.n, pct: Math.max(2, Math.round((x.n / maior) * 100)), marca: x.marca, formato: x.marca ? null : x.formato, icone: x.marca || x.formato ? null : x.icone as NomeIcone, dica: x.tipos.join(', ') }));
  }, [c]);
  const barrasCliente: BarraDoArquivador[] = useMemo(() => {
    if (!c) return [];
    const top = c.clientes.slice(0, 10);
    const maior = Math.max(1, ...top.map(x => x.n));
    return top.map(x => ({ chave: x.codigo, rotulo: x.codigo + ' · ' + x.nome, n: x.n, pct: Math.max(2, Math.round((x.n / maior) * 100)), marca: null, formato: null, icone: null, dica: '' }));
  }, [c]);

  // a caixa de entrada: o que está na pasta × o que foi arquivado no mês (o anel do Paperless)
  const naPasta = p?.pasta?.naPasta ?? 0;
  const noMes = p ? p.mes.porAcao.arquivou + p.mes.porAcao.arquivaria : 0;
  const caixa = p ? {
    total: naPasta, fatias: [
      { id: 'pasta', rotulo: 'Na pasta Claudio Secretario', valor: naPasta, tom: (naPasta ? 'aviso' : 'ok') as 'aviso' | 'ok' },
      { id: 'mes', rotulo: 'Arquivados no mês', valor: noMes, tom: 'ok' as const },
    ],
    detalhe: p.pasta ? [
      p.pasta.chegando ? mil(p.pasta.chegando) + ' chegando' : '', p.pasta.naFila ? mil(p.pasta.naFila) + ' na fila' : '', p.pasta.sendoLidos ? mil(p.pasta.sendoLidos) + ' sendo lidos' : '',
      p.pasta.parados ? mil(p.pasta.parados) + ' parados (não identificados)' : '',
    ].filter(Boolean).join(' · ') : '',
  } : null;

  // as listas de cada aba
  const pendentes = p?.pendentes ?? [];
  const erros = p?.erros ?? [];
  const daLista = aba === 'resolver' ? pendentes : aba === 'erros' ? erros : aba === 'arquivados' ? (historico?.itens ?? []) : [];
  const filtrados = aba === 'arquivados' ? entregas.filtrarItens(daLista, { busca, cliente, tipo, acao: acaoFiltro }) : daLista;
  const MAX = 300;
  const linhas = filtrados.slice(0, MAX).map(x => linhaDoItem(x, agora));
  const aberto = itemAberto ? (filtrados.find(x => x.id === itemAberto) || [...(p?.ultimos ?? []), ...pendentes, ...erros].find(x => x.id === itemAberto)) : undefined;

  // os filtros da aba Arquivados: os clientes e os tipos que aparecem no dia
  const opcoesCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of historico?.itens ?? []) if (x.cliente && !m.has(x.cliente)) m.set(x.cliente, x.clienteNome);
    return [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([codigo, nome]) => ({ valor: codigo, rotulo: codigo + ' · ' + nome }));
  }, [historico?.itens]);
  const opcoesTipo = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of historico?.itens ?? []) if (x.tipo) { const g = entregas.grupoDoTipo(x.tipo); m.set(g.id, g.rotulo); }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([valor, rotulo]) => ({ valor, rotulo }));
  }, [historico?.itens]);
  const opcoesDia = Array.from({ length: DIAS_NO_FILTRO }, (_, i) => {
    const v = hojeLocal(agora - i * 864e5);
    return { valor: v, rotulo: i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : v.slice(8, 10) + '/' + v.slice(5, 7) };
  });

  // a pasta (aba Chegando)
  const SITUACAO = { lendo: { rotulo: 'Sendo lido', tom: 'ok' as Tom }, chegando: { rotulo: 'Chegando', tom: 'neutro' as Tom }, fila: { rotulo: 'Na fila', tom: 'neutro' as Tom }, original: { rotulo: 'Esperando o documento original', tom: 'aviso' as Tom } };
  const chegando = (p?.pasta?.lista ?? []).map(x => ({
    id: x.rel, nome: x.nome, formato: formatoPeloNome(x.nome), apoio: 'Claudio Secretario\\' + x.rel + ' · ' + tamanho(x.tam), selo: SITUACAO[x.situacao], confianca: '', tomConfianca: 'neutro' as Tom,
    hora: x.situacao === 'chegando' ? 'desde ' + hora(x.desde) : quando(x.desde, agora),
  }));
  const chegandoAberto = aba === 'chegando' && itemAberto ? (p?.pasta?.lista ?? []).find(x => x.rel === itemAberto) : undefined;

  const resolver = pendentes.length;
  const naFila = p?.pasta ? p.pasta.chegando + p.pasta.naFila + p.pasta.sendoLidos : 0;
  const abas: { id: AbaDoArquivador; rotulo: string; icone: NomeIcone; contador: string; aviso: boolean; direita?: boolean }[] = [
    { id: 'geral', rotulo: 'Visão geral', icone: 'painel', contador: '', aviso: false },
    { id: 'chegando', rotulo: 'Chegando', icone: 'caixaEntrada', contador: naFila ? mil(naFila) : '', aviso: false },
    { id: 'resolver', rotulo: 'Para resolver', icone: 'alert', contador: resolver ? mil(resolver) : '', aviso: resolver > 0 },
    { id: 'arquivados', rotulo: 'Arquivados', icone: 'checkCircle', contador: p?.historico.itens ? mil(p.historico.itens) : '', aviso: false },
    { id: 'erros', rotulo: 'Erros', icone: 'x', contador: erros.length ? mil(erros.length) : '', aviso: erros.length > 0 },
    { id: 'comparacao', rotulo: 'Comparação', icone: 'scale', contador: '', aviso: false, direita: true },
    { id: 'config', rotulo: 'Configuração', icone: 'settings', contador: '', aviso: false, direita: true },
  ];

  const l = p?.ladoALado ?? null;
  const comparacao = l ? {
    dia: l.dia.split('-').reverse().join('/'),
    total: l.rotinaArquivou,
    barras: [
      { chave: 'iguais', rotulo: 'Mesmo destino e nome', n: l.iguais, tom: 'ok' as Tom },
      { chave: 'nome', rotulo: 'Mesma pasta, nome diferente', n: l.pastaIgualNomeDiferente, tom: 'neutro' as Tom },
      { chave: 'diferentes', rotulo: 'Outro destino', n: l.diferentes, tom: 'erro' as Tom },
      { chave: 'ni', rotulo: 'O novo não identificaria', n: l.novoNaoIdentificou, tom: 'aviso' as Tom },
      { chave: 'naoViu', rotulo: 'O novo não chegou a ver', n: l.novoNaoViu, tom: 'neutro' as Tom },
    ].map(b => ({ ...b, pct: l.rotinaArquivou ? Math.round((b.n / l.rotinaArquivou) * 100) : 0 })),
    exemplos: l.exemplos.map((e, i) => ({ chave: String(i), tipo: e.tipo === 'NI' ? 'Não identificaria' : 'Outro destino', nome: e.nome, antigo: e.antigo.replace(/^G:\\Meu Drive\\\d{4}\\/i, ''), novo: e.tipo === 'NI' ? 'Não identificaria: ' + e.novo.replace(/^[A-Z_]+/, m => m.toLowerCase().replace(/_/g, ' ')) : e.novo.replace(/^G:\\Meu Drive\\\d{4}\\/i, '') })),
  } : null;

  const cfg = p?.config ?? null;
  const configuracao = cfg ? [
    { rotulo: 'Modo', valor: modo.rotulo + ' — ' + modo.texto },
    { rotulo: 'Tipos em produção', valor: cfg.tiposProducao.length ? (cfg.tiposProducao.includes('todos') ? 'Todos' : cfg.tiposProducao.join(', ')) : 'Nenhum' },
    { rotulo: 'Não identificados', valor: cfg.moverNaoIdentificados ? 'Vão para NÃO IDENTIFICADOS\\<dia>-NOVO (com o motivo no _nao_identificados.jsonl)' : 'Ficam na pasta, para a rotina antiga' },
    { rotulo: 'Botão "Arquivar agora"', valor: cfg.emProducao && !cfg.botaoRotinaAntiga ? 'Roda uma volta do arquivador novo' : 'Roda a rotina antiga (o /organizar do Claude)' },
    { rotulo: 'Olha a pasta', valor: cfg.intervaloMs ? 'A cada ' + Math.round(cfg.intervaloMs / 1000) + ' s (e na hora, quando o Drive avisa)' : '' },
    { rotulo: 'Arquivo pronto', valor: cfg.estavelMs != null ? 'Quando fica ' + Math.round(cfg.estavelMs / 1000) + ' s sem mudar' : '' },
    { rotulo: 'Por volta', valor: cfg.lote ? 'Até ' + cfg.lote + ' arquivos' : '' },
    { rotulo: 'PC', valor: p?.maquina || '' },
  ].filter(x => x.valor) : [];

  return {
    exemplos: d.exemplos,
    carregando: !d.carregado,
    semPermissao: d.semPermissao,
    semPainel: d.carregado && !d.semPermissao && !p,
    aba, irPara, itemAberto,
    abas,
    agora,
    // o topo
    modo,
    situacao,
    ultimoSinal: p?.em ? 'Último sinal ' + haQuanto(p.em, agora) : '',
    progresso: progresso ? {
      ...progresso,
      texto: mil(progresso.feitos) + ' de ' + mil(progresso.total) + (p?.config?.emProducao ? ' arquivos decididos' : ' arquivos simulados'),
      inicio: p?.passada?.inicio ? 'Passada começou ' + quando(p.passada.inicio, agora) : '',
    } : null,
    ritmo: p && p.ritmo > 0 ? mil(Math.round(p.ritmo * 10) / 10) + ' por minuto' : p ? 'parado agora' : '',
    resumo: p ? entregas.resumoDoDia(p) : '',
    alertas: p?.alertas ?? [],
    // o que precisa da pessoa (o normal é tudo ser arquivado sozinho: a tela destaca só as exceções)
    excecoes: { resolver, erros: erros.length },
    botao,
    // os números e os gráficos
    periodo, setPeriodo,
    numeros,
    caixa,
    barrasTipo, barrasCliente,
    totalDeClientes: c?.totalDeClientes ?? 0,
    pastasNovas: c?.pastasNovas ?? [],
    aoVivo: (p?.ultimos ?? []).slice(0, 8).map(x => linhaDoItem(x, agora)),
    // as listas
    linhas,
    maisQueOMaximo: Math.max(0, filtrados.length - MAX),
    totalDaLista: daLista.length,
    aberto: aberto ? detalheDoItem(aberto, agora) : null,
    abrir,
    chegando,
    chegandoAberto: chegandoAberto ? {
      nome: chegandoAberto.nome, formato: formatoPeloNome(chegandoAberto.nome), selo: SITUACAO[chegandoAberto.situacao],
      dados: [
        { rotulo: 'Situação', valor: chegandoAberto.situacao === 'lendo' ? 'O robô está lendo agora' : chegandoAberto.situacao === 'chegando' ? 'Ainda chegando: o robô espera o arquivo ficar ' + Math.round((cfg?.estavelMs ?? 45000) / 1000) + ' s sem mudar' : chegandoAberto.situacao === 'original' ? 'É um evento (cancelamento, CC-e, MDF-e…) de uma nota que ainda não foi arquivada: o robô espera a nota chegar (até 48 h), depois procura no SIEG pela chave e, sem ela, manda para Não identificados' : 'Pronto, esperando a vez na fila' },
        { rotulo: 'Na pasta desde', valor: quando(chegandoAberto.desde, agora) },
        { rotulo: 'Tamanho', valor: tamanho(chegandoAberto.tam) },
        { rotulo: 'Caminho', valor: 'Claudio Secretario\\' + chegandoAberto.rel },
      ],
    } : null,
    pasta: p?.pasta ?? null,
    historico: historico ? { carregado: historico.carregado, erro: historico.erro } : null,
    // os filtros da aba Arquivados
    filtro: {
      busca, setBusca, cliente, setCliente, tipo, setTipo, acao: acaoFiltro, setAcao: setAcaoFiltro, dia, setDia: (v: string) => { setDia(v); abrir(null); },
      opcoesCliente, opcoesTipo, opcoesDia,
      opcoesAcao: (['arquivou', 'arquivaria', 'jaArquivado', 'naoIdentificado', 'fica', 'erro'] as const).map(a => ({ valor: a, rotulo: entregas.ROTULO_DA_ACAO[a] })),
      ativo: !!(busca || cliente || tipo || acaoFiltro),
      limpar: () => { setBusca(''); setCliente(''); setTipo(''); setAcaoFiltro(''); },
    },
    comparacao,
    configuracao,
  };
}
