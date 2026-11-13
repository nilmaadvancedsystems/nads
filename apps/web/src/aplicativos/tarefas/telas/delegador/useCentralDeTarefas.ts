// ViewModel da Central de tarefas (28/10/2026): as abas Minhas tarefas, Delegadas por mim e Concluídas (com quantas tem), a
// barra (a busca, os filtros, o Excel e o Nova tarefa), as situações que filtram ao clicar e a lista agrupada pelo prazo
// (09/11/2026: "dá uma repaginada total"). Clicar numa linha abre a tarefa no
// lugar da lista (useTarefaAberta). As regras (a ordem, as abas, a busca) são do core: tarefas.delegadas.
import { formatos, tarefas } from '@nads/core';
import { baixarArquivo, baixarBytes } from '@nads/ui';
import { useState } from 'react';
import { useTarefasDelegadas } from '../../dados/repo';
import { useAgoraDoExpediente } from './useAgoraDoExpediente';

const d = tarefas.delegadas;
const ag = tarefas.agenda;
export type AbaDaCentral = tarefas.delegadas.Aba;
type Status = tarefas.delegadas.Status;
type Filtro = tarefas.delegadas.FiltroDaLista;

/** A coluna da pessoa muda com a aba: nas minhas, quem delegou; nas delegadas, o responsável; nas concluídas, de/para quem. */
const COLUNA_DA_PESSOA: Record<AbaDaCentral, string> = { minhas: 'Quem delegou', delegadas: 'Responsável', concluidas: 'Delegação' };
const VAZIO_DA_ABA: Record<AbaDaCentral, { titulo: string; texto: string }> = {
  minhas: { titulo: 'Tudo em dia', texto: 'Nenhuma tarefa em aberto para você.' },
  delegadas: { titulo: 'Nada delegado em aberto', texto: 'As tarefas que você passar para outras pessoas aparecem aqui.' },
  concluidas: { titulo: 'Nenhuma tarefa encerrada', texto: 'As tarefas concluídas e canceladas aparecem aqui.' },
};

const nomeDoCliente = (c: tarefas.delegadas.ClienteVinculado) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;

/** O andamento para quem delegou: quem fez o quê e quando; sem movimento, ainda não começou. */
function movimentoDe(t: tarefas.delegadas.TarefaDelegada): string {
  const m = d.ultimoMovimento(t);
  if (!m) return 'Ainda não iniciou';
  const quando = new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return m.por + ' · ' + m.texto.replace(/ a tarefa$/, '').toLowerCase() + ' · ' + quando;
}

/**
 * opcoes, do Início novo (13/11/2026, só no modo desenvolvedor): agenda = os grupos Hoje, Amanhã e Esta semana (o print) em
 * vez dos do prazo; documentos = só os documentos delegados (a aba Documentos), todos juntos (recebidos, enviados e
 * concluídos; 13/11/2026: os filtros ficam na busca do alto); busca e filtrar = a busca e as pílulas do alto do Início novo
 * (uma busca só na tela).
 */
export function useCentralDeTarefas(abaInicial: AbaDaCentral, opcoes: { agenda?: boolean; documentos?: boolean; busca?: string; filtrar?: (t: tarefas.delegadas.TarefaDelegada) => boolean } = {}) {
  const repo = useTarefasDelegadas();
  const [aba, setAba] = useState<AbaDaCentral>(abaInicial);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('');
  const [prioridade, setPrioridade] = useState('');
  const [quem, setQuem] = useState('');
  // o cliente (o Início novo; Vitor, 13/11/2026: "Coloca filtro por cliente")
  const [cliente, setCliente] = useState('');
  // a tarefa aberta no lugar da lista: o id, 'nova' ou null (a lista)
  const [aberta, setAberta] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState('');
  const uid = repo.eu()?.uid || '';
  const lidas = repo.lista();
  const { carregadas, erro } = lidas;
  const todas = opcoes.documentos ? lidas.tarefas.filter(d.pedeDocumentos) : lidas.tarefas;
  const hoje = d.hojeIso();
  const agora = new Date().toTimeString().slice(0, 5);
  // a em andamento aparece Pausada nos intervalos (11:05–13:00 e 18:05–07:00); o banco segue Em andamento
  const relogio = useAgoraDoExpediente();
  const doBanco = new Map(todas.map(t => [t.id, t]));
  const contadores = d.contarAbas(todas, uid);
  const daAba = (opcoes.documentos ? todas : d.daAba(todas, aba, uid)).map(t => ({ ...t, status: d.situacaoNoHorario(t, relogio).status }));
  const pessoa = (t: tarefas.delegadas.TarefaDelegada) => {
    if (aba === 'minhas' && !opcoes.documentos) return t.criadaPor.uid === uid ? 'Você mesmo' : t.criadaPor.nome;
    if (aba === 'delegadas') return t.responsavel.nome;
    if (t.criadaPor.uid === t.responsavel.uid) return 'Você mesmo';
    return t.responsavel.uid === uid ? 'de ' + t.criadaPor.nome : 'para ' + t.responsavel.nome;
  };
  // os filtros de cima e a busca valem para os números; o número clicado só escolhe o que a lista mostra
  const filtradas = d.buscar(daAba, opcoes.busca ?? busca).filter(t => (!opcoes.filtrar || opcoes.filtrar(t)) && (!prioridade || t.prioridade === prioridade) && (!quem || pessoa(t) === quem) && (!cliente || t.clientes.some(x => nomeDoCliente(x) === cliente)));
  const lista = d.ordenar(d.filtrarPorSituacao(filtradas, filtro, hoje, agora), hoje, agora);
  const algumFiltro = !!filtro || !!prioridade || !!quem || !!cliente || !!busca.trim();
  const limparFiltros = () => { setFiltro(''); setPrioridade(''); setQuem(''); setCliente(''); setBusca(''); };
  const nomeDoArquivo = 'tarefas-' + aba + '-' + hoje;
  const linha = (t: tarefas.delegadas.TarefaDelegada) => ({
    id: t.id, numero: t.numero, titulo: t.titulo,
    status: { valor: t.status, rotulo: d.rotuloNoHorario(doBanco.get(t.id) || t, relogio) },
    prioridade: { valor: t.prioridade, rotulo: d.rotuloDaPrioridade(t.prioridade) },
    prazo: d.prazoComHora(t), atrasada: d.atrasada(t, hoje, agora),
    cliente: t.clientes[0] ? nomeDoCliente(t.clientes[0]) : '',
    maisClientes: t.clientes.length - 1,
    clientes: t.clientes.map(nomeDoCliente).join('\n'),
    pessoa: pessoa(t), anexos: t.anexos.length, pareceres: t.pareceres.length,
    // o Início novo: o prazo curto ("Hoje", "Quarta") e o responsável (a foto na coluna)
    prazoCurto: ag.prazoCurto(t.prazo, hoje) + (t.prazoHora ? ' ' + t.prazoHora : ''), responsavel: t.responsavel,
    // os botões de quem faz a tarefa (Minhas tarefas)
    acoes: (aba === 'minhas' || (opcoes.documentos && t.responsavel.uid === uid)) ? d.acoesNoHorario(doBanco.get(t.id) || t, relogio) : [],
    // o que aconteceu por último (Delegadas por mim)
    // e se quem recebeu já abriu a tarefa (o Visualizado, 12/11/2026)
    movimento: aba === 'delegadas' ? [movimentoDe(t), d.rotuloDaVisualizacao(t)].filter(Boolean).join(' · ') : '',
  });
  return {
    carregando: !carregadas,
    erro: erro || erroDaAcao,
    /** as abas da lateral, com quantas tem */
    abas: d.ABAS.map(a => ({ id: a.valor, rotulo: a.rotulo, qtd: contadores[a.valor], ativa: a.valor === aba })),
    aba,
    mudarAba: (a: AbaDaCentral) => { setAba(a); limparFiltros(); setAberta(null); },
    busca, setBusca,
    exemplos: repo.exemplos,
    /** os números do alto: clicar filtra a lista, clicar de novo volta a todas */
    numeros: d.numerosDaLista(filtradas, aba, hoje, agora),
    filtro, setFiltro,
    prioridade, setPrioridade,
    opcoesDePrioridade: d.PRIORIDADES.map(x => ({ valor: x.valor as string, rotulo: x.rotulo })),
    /** o filtro da pessoa, com o nome da coluna da aba */
    quem, setQuem,
    cliente, setCliente,
    /** os clientes das tarefas da aba (o filtro por cliente) */
    clientes: [...new Set(daAba.flatMap(t => t.clientes.map(nomeDoCliente)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    pessoas: [...new Set(daAba.map(pessoa))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    algumFiltro, limparFiltros,
    /** a aba não tem tarefa nenhuma (o Vazio chama para criar; com filtro, para limpar) */
    abaVazia: !daAba.length,
    colunaDaPessoa: opcoes.documentos ? 'Delegação' : COLUNA_DA_PESSOA[aba],
    /** os botões de quem faz a tarefa, só nas minhas (nas delegadas, o andamento vai na linha: 09/11/2026 "eu tenha esse controle") */
    comAcoes: aba === 'minhas',
    fazerAcao: (id: string, novo: Status) => { repo.salvar(id, { status: novo }).catch((e: unknown) => setErroDaAcao('Não gravei: ' + (e instanceof Error ? e.message : String(e)))); },
    vazio: daAba.length ? { titulo: 'Nenhuma tarefa com isso', texto: '' } : VAZIO_DA_ABA[aba],
    /** as linhas agrupadas pelo prazo, na ordem do core em cada grupo; as encerradas num grupo só */
    grupos: opcoes.documentos
      ? [...ag.GRUPOS_DA_AGENDA.map(g => ({ id: g.valor as string, rotulo: g.rotulo, linhas: lista.filter(t => d.emAberto(t) && ag.grupoDaAgenda(t, hoje, agora) === g.valor).map(linha) })), { id: 'encerradas', rotulo: 'Concluídos', linhas: lista.filter(t => !d.emAberto(t)).map(linha) }].filter(g => g.linhas.length > 0)
      : aba === 'concluidas'
      ? [{ id: 'encerradas', rotulo: '', linhas: lista.map(linha) }]
      : opcoes.agenda
        ? ag.GRUPOS_DA_AGENDA.map(g => ({ id: g.valor as string, rotulo: g.rotulo, linhas: lista.filter(t => ag.grupoDaAgenda(t, hoje, agora) === g.valor).map(linha) })).filter(g => g.linhas.length > 0)
        : d.GRUPOS_DO_PRAZO.map(g => ({ id: g.valor as string, rotulo: g.rotulo, linhas: lista.filter(t => d.grupoDoPrazo(t, hoje, agora) === g.valor).map(linha) })).filter(g => g.linhas.length > 0),
    temLinhas: lista.length > 0,
    aberta,
    abrir: (id: string) => setAberta(id),
    nova: () => setAberta('nova'),
    pedirDocumentos: () => setAberta('documentos'),
    voltar: () => setAberta(null),
    /** depois de criar, a lista da aba onde a tarefa foi parar (a minha: Minhas; para outro: Delegadas) */
    criada: (paraMim: boolean) => { setAberta(null); setAba(paraMim ? 'minhas' : 'delegadas'); limparFiltros(); },
    /** a lista que está na tela (com a busca e o filtro), em planilha */
    exportar(formato: 'xlsx' | 'csv') {
      const cabecalho = [...d.CABECALHO_DA_PLANILHA];
      const linhas = d.linhasDaPlanilha(lista);
      if (formato === 'xlsx') {
        baixarBytes(tarefas.planilhaXlsx('Tarefas', cabecalho, linhas), nomeDoArquivo + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        baixarArquivo(formatos.montarCsv([cabecalho, ...linhas].map(l => l.map(d.celulaDoCsv).join(';'))), nomeDoArquivo + '.csv');
      }
    },
    podeExportar: lista.length > 0,
  };
}
