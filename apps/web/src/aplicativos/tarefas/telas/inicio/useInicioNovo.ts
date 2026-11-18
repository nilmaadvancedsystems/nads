// ViewModel do Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo… só quero o posicionamento das coisas e
// tudo com a UI do nads"; a novidade 'inicio-novo', aprovada para todos em 13/11/2026). As abas no alto ("O menu lateral é superior"):
// Painel, Minhas tarefas, Documentos e Notificações. O Painel tem os cartões do print: o calendário do mês (prazos e reuniões),
// as próximas tarefas, as delegadas por mim e as próximas reuniões. As Notificações são a
// comunicação da equipe ("Reuniões, avisos vai ficar fixado nessa pagina, links de estudos da legislação… sem chats"). A tarefa
// abre numa janela só, por cima de qualquer aba. As regras são do core (tarefas.agenda, tarefas.delegadas, o mural).
import { tarefas, usuarios } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAcesso, useAvisos, useTarefasDelegadas } from '../../dados/repo';
import { encolherAnexo } from '../../dados/encolherAnexo';
import type { ArquivoParaAnexar } from '../../dados/tarefasDelegadas';
import { useOperador, type Operador } from '../../casca/operador';
import { useAgoraDoExpediente } from '../delegador/useAgoraDoExpediente';
import { abaDaUrl, ABAS_DO_INICIO, type AbaDoInicio } from './abasDoInicio';
import { useNivelDoInicio, useReunioesDoInicio } from './useReunioesDoInicio';
import { useNovidade } from '../../../../comum/novidades';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';

const d = tarefas.delegadas;
const ag = tarefas.agenda;
const fe = tarefas.feriados;

/** Uma pessoa com a foto (a do Entregas) ou as iniciais. */
export interface PessoaComFoto { uid: string; nome: string; foto: string | null; iniciais: string }

/**
 * as pílulas da busca (o print: "Add filters"), de cada aba (Vitor, 13/11/2026: "Se eu to na tela de documento, os filtros vão
 * ser só de documento"; "Da mesma forma para tarefas"): no Painel, as gerais; nas Tarefas, as de tarefa; nos Documentos, as de
 * documento; nas Notificações, as dos comunicados. Nas Tarefas e nos Documentos também o Cliente ("em ambos coloca um filtro
 * de cliente")
 */
type IdDoFiltro = 'atrasadas' | 'hoje' | 'urgentes' | 'delegadas' | 'documentos' | 'recebidos' | 'enviados' | 'pendentes' | 'concluidos' | 'avisos' | 'reunioes' | 'estudos' | 'fixados';
type Filtro = { id: IdDoFiltro; rotulo: string; icone: 'alert' | 'clock' | 'zap' | 'aviao' | 'clipe' | 'caixaEntrada' | 'checkCircle' | 'calendar' | 'lampada' | 'mapaPin' };
const DE_TAREFA: Filtro[] = [
  { id: 'atrasadas', rotulo: 'Atrasadas', icone: 'alert' },
  { id: 'hoje', rotulo: 'Para hoje', icone: 'clock' },
  { id: 'urgentes', rotulo: 'Urgentes', icone: 'zap' },
  { id: 'delegadas', rotulo: 'Delegadas por mim', icone: 'aviao' },
];
export const FILTROS_POR_ABA: Record<AbaDoInicio, Filtro[]> = {
  painel: [...DE_TAREFA, { id: 'documentos', rotulo: 'Documentos', icone: 'clipe' }],
  tarefas: DE_TAREFA,
  documentos: [
    { id: 'recebidos', rotulo: 'Recebidos', icone: 'caixaEntrada' },
    { id: 'enviados', rotulo: 'Enviados', icone: 'aviao' },
    { id: 'pendentes', rotulo: 'Pendentes', icone: 'clock' },
    { id: 'concluidos', rotulo: 'Concluídos', icone: 'checkCircle' },
  ],
  notificacoes: [
    { id: 'avisos', rotulo: 'Avisos', icone: 'alert' },
    { id: 'reunioes', rotulo: 'Reuniões', icone: 'calendar' },
    { id: 'estudos', rotulo: 'Estudos', icone: 'lampada' },
    { id: 'fixados', rotulo: 'Fixados', icone: 'mapaPin' },
  ],
};
const PLACEHOLDER: Record<AbaDoInicio, string> = { painel: 'Buscar nas tarefas', tarefas: 'Buscar nas tarefas', documentos: 'Buscar nos documentos', notificacoes: 'Buscar nas notificações' };
const nomeDoCliente = (c: tarefas.delegadas.ClienteVinculado) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;
/** a data e a hora da cobrança: "16/11/2026, 10:30" */
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** os dias do calendário mais os dias de reunião (cada reunião conta um) */
function somarDias(dias: Record<number, number>, mais: number[]): Record<number, number> {
  const r = { ...dias };
  for (const d of mais) r[d] = (r[d] || 0) + 1;
  return r;
}


export function useInicioNovo() {
  const op = useOperador().operador as Operador;
  // as reuniões das Notificações (o Sênior pede, o Diretor e o Dono decidem): também no Painel e no calendário
  const reunioes = useReunioesDoInicio();
  // a confirmação de presença só quando quem marcou pediu: em teste no modo desenvolvedor (18/11/2026)
  const [devPresenca] = useModoDesenvolvedor();
  const { toast, aviso } = useRetorno();
  const [params, setParams] = useSearchParams();
  const aba = abaDaUrl(params.get('aba'));
  const mudarAba = (a: AbaDoInicio) => setParams(p => { const n = new URLSearchParams(p); n.set('aba', a); return n; }, { replace: true });

  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  const docs = acesso.equipe().docs;
  const comFoto = (p: tarefas.delegadas.Pessoa): PessoaComFoto => ({ uid: p.uid, nome: p.nome, foto: String(docs[p.uid]?.fotoPerfil || '') || null, iniciais: usuarios.iniciais(p.nome) });
  const eu = repo.eu();
  const uid = eu?.uid || '';
  const meuNome = eu?.nome || op.nome;
  const { carregadas, tarefas: todas } = repo.lista();
  const hoje = d.hojeIso();
  const agora = new Date().toTimeString().slice(0, 5);
  const relogio = useAgoraDoExpediente();
  const minhas = d.ordenar(d.daAba(todas, 'minhas', uid), hoje, agora);
  const delegadas = d.ordenar(d.daAba(todas, 'delegadas', uid), hoje, agora);
  const abertas = [...minhas, ...delegadas];

  // a busca do alto, uma só na tela (13/11/2026: "tem duas buscas na mesma tela… deixe uma só"), com as pílulas de cada aba e o
  // cliente; no Painel acha em todas as tarefas da pessoa; nas outras abas, filtra a própria lista
  const [busca, setBusca] = useState('');
  const [filtrosPorAba, setFiltrosPorAba] = useState<Partial<Record<AbaDoInicio, IdDoFiltro[]>>>({});
  const [clientePorAba, setClientePorAba] = useState<Partial<Record<AbaDoInicio, string>>>({});
  const filtros = filtrosPorAba[aba] || [];
  const cliente = clientePorAba[aba] || '';
  const passa = (t: tarefas.delegadas.TarefaDelegada) => (!cliente || t.clientes.some(c => nomeDoCliente(c) === cliente)) && filtros.every(f =>
    f === 'atrasadas' ? d.atrasada(t, hoje, agora) : f === 'hoje' ? t.prazo === hoje && d.emAberto(t) : f === 'urgentes' ? t.prioridade === 'urgente'
      : f === 'delegadas' ? t.criadaPor.uid === uid && t.responsavel.uid !== uid : f === 'documentos' ? d.pedeDocumentos(t)
        : f === 'recebidos' ? t.responsavel.uid === uid : f === 'enviados' ? t.criadaPor.uid === uid && t.responsavel.uid !== uid
          : f === 'pendentes' ? d.emAberto(t) : f === 'concluidos' ? !d.emAberto(t) : true);
  const buscando = !!busca.trim() || filtros.length > 0 || !!cliente;
  const achados = aba === 'painel' && buscando ? d.ordenar(d.buscar(todas.filter(passa), busca), hoje, agora).slice(0, 8) : [];
  const clientesDaAba = [...new Set((aba === 'documentos' ? todas.filter(d.pedeDocumentos) : todas).flatMap(t => t.clientes.map(nomeDoCliente)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  // a tarefa aberta (o id, 'nova' ou 'documentos'), por cima de qualquer aba
  const [aberta, setAberta] = useState<string | null>(null);

  // as Notificações: os comunicados da equipe (o mural), os fixados em cima
  const avisos = useAvisos();
  const mural = avisos.lista();
  const agoraIso = new Date();
  // nas Notificações, a busca e as pílulas filtram os comunicados
  const q = busca.trim().toLowerCase();
  const passaComunicado = (a: tarefas.AvisoDoEscritorio) => aba !== 'notificacoes' || ((!q || ((a.titulo || '') + ' ' + a.texto + ' ' + a.por).toLowerCase().includes(q)) && filtros.every(f =>
    f === 'avisos' ? !a.tipo || a.tipo === 'aviso' || a.tipo === 'geral' : f === 'reunioes' ? a.tipo === 'reuniao' : f === 'estudos' ? a.tipo === 'estudo' : f === 'fixados' ? !!a.fixado : true));
  // só os avisos para a pessoa (todos, o setor dela ou ela escolhida; o Diretor, o Dono e o admin veem todos)
  const veTodos = op.admin || reunioes.papel === 'aprova';
  const equipeComSetor = acesso.equipe().lista.filter(u => u.ativo).map(u => ({ uid: u.uid, nome: u.nome, departamento: u.departamento }));
  const paraMim = (a: tarefas.AvisoDoEscritorio) => veTodos || tarefas.avisoParaMim(a, { uid, departamento: op.departamento });
  const comunicados = tarefas.ordenarAvisos(mural.avisos.filter(paraMim).filter(passaComunicado)).map(a => ({
    ...a,
    tipoRotulo: tarefas.rotuloDoTipoDoAviso(a),
    tituloNaLista: a.titulo || a.texto.split('\n')[0].slice(0, 80),
    quandoFoi: tarefas.quandoFoi(a.em, agoraIso),
    reuniao: a.quando ? new Date(a.quando).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
    // o Recebido: a pessoa ainda precisa marcar? quem escreveu (e o Diretor) vê quem marcou e quem falta
    // no modo desenvolvedor, todo aviso pede o Recebido (Vitor, 18/11/2026: "todos vao ter confirmacao")
    precisaReceber: (devPresenca ? a.tipo !== 'reuniao' : !!a.pedeConfirmacao) && a.porUid !== uid && !tarefas.recebeu(a, uid) && tarefas.avisoParaMim(a, { uid, departamento: op.departamento }),
    jaRecebi: tarefas.recebeu(a, uid),
    acompanha: !!a.pedeConfirmacao && (a.porUid === uid || veTodos),
    faltaReceber: tarefas.faltaReceber(a, equipeComSetor).map(p => p.nome),
    destino: tarefas.rotuloDoDestino(a.para, usuarios.DEPARTAMENTOS),
  }));
  // o calendário: o mês mostrado e o dia escolhido (filtra as próximas tarefas)
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const doDia = dia ? abertas.filter(t => t.prazo === dia) : minhas;
  const horaDe = (q: string) => (q.length >= 16 ? q.slice(11, 16) : '');
  // publicado para todos (18/11/2026: "pode publicar essa parte do inicio")
  const reunioesDoDia = !dia ? [] : [
    ...reunioes.proximas.filter(x => x.quando.startsWith(dia)).map(x => ({ id: x.id, titulo: x.titulo, hora: horaDe(x.quando), duracao: x.duracaoTexto, quando: x.quando })),
    ...comunicados.filter(c => c.tipo === 'reuniao' && (c.quando || '').startsWith(dia)).map(c => ({ id: c.id, titulo: c.tituloNaLista, hora: horaDe(c.quando || ''), duracao: '', quando: c.quando || '' })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  const concluir = (t: tarefas.delegadas.TarefaDelegada) => {
    // concluir pelo círculo só quando a tarefa deixa: os documentos (o envio e o requerer) e as que não deixam abrem a janela
    if (d.pedeDocumentos(t) || !d.acoesDaTarefa(t, relogio).some(a => a.id === 'concluir')) { setAberta(t.id); return; }
    repo.salvar(t.id, { status: 'concluida' }).then(() => toast('Tarefa concluída.'))
      .catch((e: unknown) => aviso({ tom: 'erro', titulo: 'Não deu para concluir', texto: e instanceof Error ? e.message : String(e) }));
  };

  const [comunicado, setComunicado] = useState<string | null>(null);
  const agoraLocal = d.hojeIso() + 'T' + agora;

  // as cobranças que a pessoa recebeu, nas Notificações, e quem cobrou no Cobrada (a novidade 'cobranca-notificada'; 16/11/2026:
  // "faça aparecer em notificações que houve uma cobrança"); a busca vale para elas e qualquer pílula as esconde
  const cobrancaNotificada = useNovidade('cobranca-notificada');
  const recebidas = cobrancaNotificada ? d.cobrancasRecebidas(todas, uid) : [];
  // e, para quem cobrou, o que voltou: o mais tempo pedido (com a justificativa) e a resposta (16/11/2026: "para quem cobrou
  // aparece que o usuario pediu + 5 +10 minutos")
  const retornos = cobrancaNotificada ? d.retornosDasCobrancas(todas, uid) : [];
  const cobrancas = [
    ...recebidas.map(c => ({ tarefa: c.tarefa, nota: c.nota, aberta: c.aberta, icone: 'sino' as const, texto: c.nota.por + ' cobrou atualização da tarefa ' + c.tarefa.titulo })),
    ...retornos.map(c => ({
      tarefa: c.tarefa, nota: c.nota, aberta: false, icone: c.nota.tipo === 'adiamento' ? 'clock' as const : 'checkCircle' as const,
      texto: c.nota.tipo === 'adiamento' ? c.nota.por + ' pediu mais ' + (c.nota.minutos || 0) + ' minutos na tarefa ' + c.tarefa.titulo + ': ' + c.nota.texto
        : c.nota.por + ' respondeu à cobrança da tarefa ' + c.tarefa.titulo + ': ' + c.nota.texto,
    })),
  ].sort((a, b) => b.nota.em.localeCompare(a.nota.em))
    .filter(c => aba !== 'notificacoes' || (!filtros.length && (!q || (c.texto + ' ' + c.nota.por).toLowerCase().includes(q))))
    .map(c => ({
      id: c.tarefa.id + '|' + c.nota.em + '|' + (c.nota.tipo || ''), tarefa: c.tarefa.id, aberta: c.aberta, icone: c.icone, texto: c.texto,
      quando: dataHora(c.nota.em), quandoFoi: tarefas.quandoFoi(c.nota.em, agoraIso),
    }));
  const dicaDoCobrada = (t: tarefas.delegadas.TarefaDelegada) => {
    const n = d.cobrancaAberta(t);
    return cobrancaNotificada && n ? d.dicaDaCobranca(n, dataHora(n.em)) : 'Cobraram uma atualização: abra a tarefa e responda';
  };

  return {
    nome: op.nome.split(/[ .]/)[0],
    carregando: !carregadas,
    exemplos: repo.exemplos,
    aba, mudarAba,
    abas: ABAS_DO_INICIO.map(a => ({
      ...a, ativa: a.id === aba,
      qtd: a.id === 'tarefas' ? minhas.filter(t => !d.pedeDocumentos(t)).length : a.id === 'documentos' ? abertas.filter(d.pedeDocumentos).length : a.id === 'notificacoes' ? mural.avisos.length + recebidas.filter(c => c.aberta).length : 0,
    })),
    // a tarefa aberta
    aberta, abrir: (id: string) => setAberta(id), nova: () => setAberta('nova'), pedirDocumentos: () => setAberta('documentos'), fechar: () => setAberta(null),
    criada: (paraMim: boolean) => { setAberta(null); mudarAba(paraMim ? 'tarefas' : 'painel'); },

    // a busca do alto
    busca, setBusca,
    placeholder: PLACEHOLDER[aba],
    filtrosDaBusca: FILTROS_POR_ABA[aba].map(f => ({ ...f, ligado: filtros.includes(f.id) })),
    alternarFiltro: (id: IdDoFiltro) => setFiltrosPorAba(x => { const l = x[aba] || []; return { ...x, [aba]: l.includes(id) ? l.filter(y => y !== id) : [...l, id] }; }),
    /** o filtro do cliente (nas Tarefas e nos Documentos) */
    comCliente: aba === 'tarefas' || aba === 'documentos',
    cliente, clientes: clientesDaAba,
    escolherCliente: (c: string) => setClientePorAba(x => ({ ...x, [aba]: c })),
    limparBusca: () => { setBusca(''); setFiltrosPorAba(x => ({ ...x, [aba]: [] })); setClientePorAba(x => ({ ...x, [aba]: '' })); },
    buscando,
    /** quantos filtros ligados (a marca ao lado da busca) */
    quantosFiltros: filtros.length + (cliente ? 1 : 0),
    /** a busca e as pílulas valendo na lista das Tarefas e dos Documentos */
    filtrarLista: passa,
    achados: achados.map(t => ({
      id: t.id, titulo: t.titulo, feita: !d.emAberto(t),
      detalhe: [t.clientes[0] ? (t.clientes[0].codigo != null ? t.clientes[0].codigo + ' · ' : '') + t.clientes[0].nome : '', d.rotuloDaPrioridade(t.prioridade), ag.prazoCurto(t.prazo, hoje)].filter(Boolean).join(' · '),
    })),

    // o Painel
    calendario: {
      mes, setMes, hoje, dia,
      escolher: (x: string | null) => { setDia(x); if (x) setMes(x.slice(0, 7)); },
      // os dias com prazo de tarefa e os dias com reunião (das Notificações)
      marcados: somarDias(ag.diasComPrazo(abertas, mes), [
        ...comunicados.filter(c => c.tipo === 'reuniao' && c.quando?.startsWith(mes + '-')).map(c => Number(c.quando!.slice(8, 10))),
        ...reunioes.proximas.filter(x => x.quando.startsWith(mes + '-')).map(x => Number(x.quando.slice(8, 10))),
      ]),
      // os feriados e os pontos facultativos do mês (o Decreto 4068/2026 de Taiobeiras; 15/11/2026: "Atualiza o calendário com essas datas")
      feriados: Object.fromEntries(fe.feriadosDoMes(mes).map(f => [Number(f.data.slice(8, 10)), { dica: fe.dicaDoFeriado(f), tipo: f.tipo }])),
      /** a lista embaixo do calendário: "20 · São Sebastião · Feriado"; só os de hoje em diante (16/11/2026: "os feriados que já
       * passaram, pode tirar da parte inferior"; no calendário eles continuam marcados) */
      feriadosDoMes: fe.feriadosDoMes(mes).filter(f => f.data >= hoje).map(f => ({ data: f.data, dia: f.data.slice(8, 10), nome: f.nome, rotulo: fe.rotuloDoFeriado(f), tipo: f.tipo, passou: false })),
    },
    proximas: {
      titulo: dia ? 'Prazo em ' + d.prazoParaTela(dia) : 'Minhas tarefas',
      total: dia ? doDia.length + reunioesDoDia.length : minhas.length,
      /**
       * as reuniões do dia escolhido, em primeiro e destacadas (Vitor, 18/11/2026: "essa reuniao ao selecionar o dia apareca na
       * caixa de prazos destacada e em primeiro"): as marcadas (aprovadas ou remarcadas) e os comunicados de reunião
       */
      reunioes: reunioesDoDia,
      linhas: doDia.slice(0, 6).map(t => ({
        id: t.id, titulo: t.titulo, prazo: ag.prazoCurto(t.prazo, hoje) || 'Sem prazo', atrasada: d.atrasada(t, hoje, agora),
        concluir: () => concluir(t),
        /** quem faz foi cobrado e ainda não respondeu (o sino; 13/11/2026) */
        cobrada: d.deveResponderCobranca(t, uid),
        /** ao passar o mouse no Cobrada: quem cobrou e quando */
        dicaDaCobranca: dicaDoCobrada(t),
      })),
    },
    /**
     * As delegadas por mim (Vitor, 13/11/2026): a foto de quem faz, "código – cliente" e, embaixo, a tarefa. A cápsula: Pendente
     * em cinza, Visualizada em amarelo, Em andamento como sempre, com o cronômetro (horas e minutos trabalhados) embaixo.
     */
    delegadasPorMim: delegadas.slice(0, 5).map(t => {
      const c = t.clientes[0];
      const pendente = d.situacaoNoHorario(t, relogio).status === 'pendente';
      const vista = pendente && !!t.visualizadaEm && t.responsavel.uid !== t.criadaPor.uid;
      return {
        id: t.id, titulo: t.titulo, responsavel: comFoto(t.responsavel),
        cliente: c ? (c.codigo != null ? c.codigo + ' – ' : '') + c.nome + (t.clientes.length > 1 ? ' +' + (t.clientes.length - 1) : '') : '',
        status: vista ? { rotulo: 'Visualizada', tom: 'warn' as const }
          : pendente ? { rotulo: 'Pendente', tom: 'neutral' as const }
          : { rotulo: d.rotuloNoHorario(t, relogio), tom: d.tomDoStatus(d.situacaoNoHorario(t, relogio).status) },
        /** em andamento ou pausada: os minutos trabalhados até "agora" (o cronômetro da tela pede de minuto em minuto) */
        minutos: t.status === 'andamento' || t.status === 'pausada' ? (agora: Date) => d.minutosTrabalhados(t, agora) : null,
        /** o relógio pisca enquanto está em andamento; pausada, para (Vitor, 13/11/2026: "em progresso o icone fica piscando, se ela pausar, para de piscar") */
        // pela situação de agora, não pela do banco: na pausa do intervalo (o banco segue Em andamento) o relógio para e fica cinza
        // (Vitor, 13/11/2026: "pausadas, para de piscar e fica cinza o reloginho")
        andando: d.situacaoNoHorario(t, relogio).status === 'andamento',
        /** o sino (13/11/2026): cobrar uma atualização, ou a cobrança esperando a resposta */
        cobranca: d.podeCobrar(t, uid) ? 'cobrar' as const : d.cobrancaAberta(t) ? 'esperando' as const : null,
        cobrar: () => repo.cobrar(t.id, '').then(() => toast('Cobrança enviada para ' + t.responsavel.nome + '.'))
          .catch((e: unknown) => toast('Não cobrei: ' + (e instanceof Error ? e.message : String(e)))),
      };
    }),
    /**
     * os avisos (os que não são reunião) nos cards do Painel, junto das reuniões (Vitor, 18/11/2026: "deixa so os cards, tanto de
     * aviso quanto de reuniao"): os fixados e os que esperam o Recebido, na ordem do mural, até 6
     */
    // os fixados ficam sempre; os outros, até a pessoa marcar o Recebido (18/11/2026: o fixado "fica meio que permanente na tela inicial")
    avisosNoQuadro: comunicados.filter(c => c.tipo !== 'reuniao' && (c.fixado || c.precisaReceber)).slice(0, 6).map(c => ({
      id: c.id, titulo: c.tituloNaLista, detalhe: [c.tipoRotulo, c.por, c.quandoFoi].filter(Boolean).join(' · '), em: c.em, fixado: !!c.fixado, precisaReceber: c.precisaReceber,
    })),
    // as próximas: as reuniões aprovadas (ou remarcadas) e os comunicados de reunião, a mais perto primeiro
    reunioes: [
      // o que o card espera da pessoa (18/11/2026, o botão ao passar o mouse): a presença na reunião ou o Recebido do comunicado
      ...reunioes.proximas.map(x => ({ id: x.id, tituloNaLista: x.titulo, reuniao: x.quandoTexto, quando: x.quando, rotulo: x.rotulo,
        espera: (x.acoes.includes('confirmar') && x.minhaPresenca === null ? 'presenca' : '') as '' | 'presenca' | 'recebido' })),
      ...tarefas.proximasReunioes(comunicados, agoraLocal).map(c => ({ id: c.id, tituloNaLista: c.tituloNaLista, reuniao: c.reuniao, quando: c.quando || '', rotulo: '',
        espera: (c.precisaReceber ? 'recebido' : '') as '' | 'presenca' | 'recebido' })),
    ].sort((a, b) => a.quando.localeCompare(b.quando)).slice(0, 4),
    /**
     * o que espera a confirmação da pessoa, por cima do calendário do Painel (Vitor, 13/11/2026: "Se for algo que precisa de
     * confirmação faça aquele esquema de colocar sobrepondo o calendário"): a reunião sem a resposta de presença e o aviso
     * sem o Recebido, um de cada vez; respondeu, aparece o próximo
     */
    paraConfirmar: [
      // só as reuniões em que quem marcou pediu a confirmação de presença (18/11/2026)
      ...reunioes.lista.filter(x => x.acoes.includes('confirmar') && x.minhaPresenca === null && x.pedirPresenca === true)
        .map(x => ({ tipo: 'reuniao' as const, id: x.id, titulo: x.titulo, texto: x.pauta, quem: x.criadaPor.nome, quando: x.quandoTexto })),
      ...comunicados.filter(c => c.precisaReceber)
        .map(c => ({ tipo: 'aviso' as const, id: c.id, titulo: c.tituloNaLista, texto: c.texto, quem: c.por, quando: c.quandoFoi })),
    ],
    /** o ViewModel das reuniões (os botões das Notificações e o detalhe) */
    reunioesVm: reunioes,
    comFoto,

    // as Notificações
    carregandoMural: !mural.carregados,
    /** as cobranças que a pessoa recebeu, a mais nova primeiro (aberta = ainda sem resposta); clicar abre a tarefa */
    cobrancas,
    comunicados,
    comunicado: comunicados.find(c => c.id === comunicado) || (reunioes.lista.some(x => x.id === comunicado) ? null : comunicados[0]) || null,
    /** a reunião escolhida (o mesmo escolher dos comunicados: o id diz qual é) */
    reuniao: reunioes.lista.find(x => x.id === comunicado) || null,
    escolherComunicado: setComunicado,
    /** as reuniões na lista das Notificações (a busca e a pílula Reuniões valem para elas) */
    reunioesNaLista: reunioes.lista.filter(x => (!q || (x.titulo + ' ' + x.pauta + ' ' + x.criadaPor.nome).toLowerCase().includes(q)) && filtros.every(f => f === 'reunioes')),
    /** o PDF da norma da empresa */
    async baixarPdf(id: string) {
      const a = mural.avisos.find(x => x.id === id)?.anexo;
      const bytes = await avisos.baixar(id).catch(() => null);
      if (!a || !bytes) { toast('O PDF não foi encontrado.'); return; }
      baixarBytes(bytes, a.nome, 'application/pdf');
    },
    marcarRecebido: (id: string) => avisos.marcarRecebido(id, { uid, nome: meuNome }).then(() => toast('Marcado como recebido.'))
      .catch((e: unknown) => aviso({ tom: 'erro', titulo: 'Não deu para marcar', texto: e instanceof Error ? e.message : String(e) })),
  };
}

/** A janela do Novo comunicado (as Notificações): o tipo, o título, o dia e a hora da reunião, o link e o texto. */
export function useNovoComunicado(fechar: () => void, tipoInicial: tarefas.TipoDeComunicado = 'aviso') {
  const op = useOperador().operador as Operador;
  const { toast, aviso } = useRetorno();
  const repo = useAvisos();
  const nivel = useNivelDoInicio();
  const [tipo, setTipo] = useState<tarefas.TipoDeComunicado>(tipoInicial);
  const [jeito, setJeito] = useState<tarefas.JeitoDoAviso>('normal');
  const [pdf, setPdf] = useState<ArquivoParaAnexar | null>(null);
  const [titulo, setTitulo] = useState('');
  const [link, setLink] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  // o Diretor e o Dono pedem o Recebido e escolhem para quem é (todos, setores ou pessoas)
  const [pedeConfirmacao, setPedeConfirmacao] = useState(false);
  // todo aviso novo pede o Recebido e quem cria escolhe fixar na tela inicial (18/11/2026; publicado para todos)
  const devAviso = true;
  const [fixarNoInicio, setFixarNoInicio] = useState(false);
  const [destino, setDestino] = useState<'todos' | 'setor' | 'pessoas'>('todos');
  const [setores, setSetores] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<tarefas.delegadas.Pessoa[]>([]);
  const acesso = useAcesso();
  const uid = useTarefasDelegadas().eu()?.uid || '';
  const para: tarefas.DestinoDoAviso = destino === 'setor' ? { tipo: 'setor', setores } : destino === 'pessoas' ? { tipo: 'pessoas', pessoas } : { tipo: 'todos' };
  const dia = d.prazoDaTela(data);
  const norma = tipo === 'aviso' && jeito === 'norma';
  const extras: tarefas.ExtrasDoComunicado = { tipo, titulo, link: tipo === 'aviso' ? '' : link, quando: tipo === 'reuniao' && dia && hora ? dia + 'T' + hora : '', pedeConfirmacao: devAviso ? tipo !== 'reuniao' : pedeConfirmacao, para, jeito, comPdf: norma && !!pdf };
  // o menu do Tipo: os jeitos do aviso (o aviso não tem link; a norma leva o PDF), o estudo e o comunicado
  const opcoes = [
    ...tarefas.JEITOS_DO_AVISO.map(j => ({ tipo: 'aviso' as const, jeito: j.valor, rotulo: j.rotulo })),
    ...tarefas.TIPOS_DE_COMUNICADO.filter(t => t.valor === 'estudo' || t.valor === 'geral').map(t => ({ tipo: t.valor, jeito: 'normal' as const, rotulo: t.rotulo })),
  ];
  const problema = tarefas.problemaDoComunicado(texto, extras);
  return {
    tipo, jeito, norma, pdf,
    opcoes: opcoes.map(o => ({ ...o, marcada: o.tipo === tipo && (tipo !== 'aviso' || o.jeito === jeito) })),
    escolher: (o: { tipo: tarefas.TipoDeComunicado; jeito: tarefas.JeitoDoAviso }) => { setTipo(o.tipo); setJeito(o.jeito); },
    rotuloDoTipo: opcoes.find(o => o.tipo === tipo && (tipo !== 'aviso' || o.jeito === jeito))?.rotulo || tarefas.rotuloDoComunicado(tipo),
    temLink: tipo !== 'aviso',
    async escolherPdf(f: File) { setPdf(await encolherAnexo(f)); },
    tirarPdf: () => setPdf(null),
    titulo, setTitulo, maiorTitulo: tarefas.MAIOR_TITULO_DO_COMUNICADO,
    link, setLink, data, setData, hora, setHora, texto, setTexto,
    faltam: tarefas.MAIOR_AVISO - tarefas.limparAviso(texto).length,
    problema, publicando,
    /** só o Diretor, o Dono e o admin pedem o Recebido */
    podePedirConfirmacao: op.admin || usuarios.nivelDeDiretor(nivel),
    pedeConfirmacao, setPedeConfirmacao, devAviso, fixarNoInicio, setFixarNoInicio,
    destino, setDestino, setores, pessoas,
    opcoesDeSetor: usuarios.DEPARTAMENTOS,
    equipe: acesso.equipe().lista.filter(u => u.ativo && u.uid !== uid && !usuarios.ehContaReservada(u.email)).map(u => ({ uid: u.uid, nome: u.nome })),
    alternarSetor: (s: string) => setSetores(x => (x.includes(s) ? x.filter(y => y !== s) : [...x, s])),
    alternarPessoa: (p: tarefas.delegadas.Pessoa) => setPessoas(x => (x.some(y => y.uid === p.uid) ? x.filter(y => y.uid !== p.uid) : [...x, p])),
    rotuloDoDestino: tarefas.rotuloDoDestino(para, usuarios.DEPARTAMENTOS),
    async publicar() {
      if (problema) { aviso({ tom: 'erro', titulo: problema }); return; }
      setPublicando(true);
      try {
        const id = await repo.publicar(texto, op.nome, extras, uid || undefined, norma && pdf ? pdf : undefined);
        if (devAviso && fixarNoInicio && id) await repo.fixar(id, true);
        toast('Publicado nas Notificações.'); fechar();
      }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não foi publicado', texto: e instanceof Error ? e.message : String(e) }); }
      finally { setPublicando(false); }
    },
  };
}
