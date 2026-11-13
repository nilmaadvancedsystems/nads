// ViewModel do Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo… só quero o posicionamento das coisas e
// tudo com a UI do nads"; a novidade 'inicio-novo', só no modo desenvolvedor). As abas no alto ("O menu lateral é superior"):
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

const d = tarefas.delegadas;
const ag = tarefas.agenda;

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
    precisaReceber: !!a.pedeConfirmacao && a.porUid !== uid && !tarefas.recebeu(a, uid) && tarefas.avisoParaMim(a, { uid, departamento: op.departamento }),
    jaRecebi: tarefas.recebeu(a, uid),
    acompanha: !!a.pedeConfirmacao && (a.porUid === uid || veTodos),
    faltaReceber: tarefas.faltaReceber(a, equipeComSetor).map(p => p.nome),
    destino: tarefas.rotuloDoDestino(a.para, usuarios.DEPARTAMENTOS),
  }));
  // o calendário: o mês mostrado e o dia escolhido (filtra as próximas tarefas)
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const doDia = dia ? abertas.filter(t => t.prazo === dia) : minhas;

  const concluir = (t: tarefas.delegadas.TarefaDelegada) => {
    // concluir pelo círculo só quando a tarefa deixa: os documentos (o envio e o requerer) e as que não deixam abrem a janela
    if (d.pedeDocumentos(t) || !d.acoesDaTarefa(t, relogio).some(a => a.id === 'concluir')) { setAberta(t.id); return; }
    repo.salvar(t.id, { status: 'concluida' }).then(() => toast('Tarefa concluída.'))
      .catch((e: unknown) => aviso({ tom: 'erro', titulo: 'Não deu para concluir', texto: e instanceof Error ? e.message : String(e) }));
  };

  const [comunicado, setComunicado] = useState<string | null>(null);
  const agoraLocal = d.hojeIso() + 'T' + agora;

  return {
    nome: op.nome.split(/[ .]/)[0],
    carregando: !carregadas,
    exemplos: repo.exemplos,
    aba, mudarAba,
    abas: ABAS_DO_INICIO.map(a => ({
      ...a, ativa: a.id === aba,
      qtd: a.id === 'tarefas' ? minhas.filter(t => !d.pedeDocumentos(t)).length : a.id === 'documentos' ? abertas.filter(d.pedeDocumentos).length : a.id === 'notificacoes' ? mural.avisos.length : 0,
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
    },
    proximas: {
      titulo: dia ? 'Prazo em ' + d.prazoParaTela(dia) : 'Minhas tarefas',
      total: dia ? doDia.length : minhas.length,
      linhas: doDia.slice(0, 6).map(t => ({
        id: t.id, titulo: t.titulo, prazo: ag.prazoCurto(t.prazo, hoje) || 'Sem prazo', atrasada: d.atrasada(t, hoje, agora),
        concluir: () => concluir(t),
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
        andando: t.status === 'andamento',
      };
    }),
    // as próximas: as reuniões aprovadas (ou remarcadas) e os comunicados de reunião, a mais perto primeiro
    reunioes: [
      ...reunioes.proximas.map(x => ({ id: x.id, tituloNaLista: x.titulo, reuniao: x.quandoTexto, quando: x.quando, rotulo: x.rotulo })),
      ...tarefas.proximasReunioes(comunicados, agoraLocal).map(c => ({ id: c.id, tituloNaLista: c.tituloNaLista, reuniao: c.reuniao, quando: c.quando || '', rotulo: '' })),
    ].sort((a, b) => a.quando.localeCompare(b.quando)).slice(0, 4),
    /**
     * o que espera a confirmação da pessoa, por cima do calendário do Painel (Vitor, 13/11/2026: "Se for algo que precisa de
     * confirmação faça aquele esquema de colocar sobrepondo o calendário"): a reunião sem a resposta de presença e o aviso
     * sem o Recebido, um de cada vez; respondeu, aparece o próximo
     */
    paraConfirmar: [
      ...reunioes.lista.filter(x => x.acoes.includes('confirmar') && x.minhaPresenca === null)
        .map(x => ({ tipo: 'reuniao' as const, id: x.id, titulo: x.titulo, texto: x.pauta, quem: x.criadaPor.nome, quando: x.quandoTexto })),
      ...comunicados.filter(c => c.precisaReceber)
        .map(c => ({ tipo: 'aviso' as const, id: c.id, titulo: c.tituloNaLista, texto: c.texto, quem: c.por, quando: c.quandoFoi })),
    ],
    /** o ViewModel das reuniões (os botões das Notificações e o detalhe) */
    reunioesVm: reunioes,
    comFoto,

    // as Notificações
    carregandoMural: !mural.carregados,
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
  const [destino, setDestino] = useState<'todos' | 'setor' | 'pessoas'>('todos');
  const [setores, setSetores] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<tarefas.delegadas.Pessoa[]>([]);
  const acesso = useAcesso();
  const uid = useTarefasDelegadas().eu()?.uid || '';
  const para: tarefas.DestinoDoAviso = destino === 'setor' ? { tipo: 'setor', setores } : destino === 'pessoas' ? { tipo: 'pessoas', pessoas } : { tipo: 'todos' };
  const dia = d.prazoDaTela(data);
  const norma = tipo === 'aviso' && jeito === 'norma';
  const extras: tarefas.ExtrasDoComunicado = { tipo, titulo, link: tipo === 'aviso' ? '' : link, quando: tipo === 'reuniao' && dia && hora ? dia + 'T' + hora : '', pedeConfirmacao, para, jeito, comPdf: norma && !!pdf };
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
    pedeConfirmacao, setPedeConfirmacao,
    destino, setDestino, setores, pessoas,
    opcoesDeSetor: usuarios.DEPARTAMENTOS,
    equipe: acesso.equipe().lista.filter(u => u.ativo && u.uid !== uid && !usuarios.ehContaReservada(u.email)).map(u => ({ uid: u.uid, nome: u.nome })),
    alternarSetor: (s: string) => setSetores(x => (x.includes(s) ? x.filter(y => y !== s) : [...x, s])),
    alternarPessoa: (p: tarefas.delegadas.Pessoa) => setPessoas(x => (x.some(y => y.uid === p.uid) ? x.filter(y => y.uid !== p.uid) : [...x, p])),
    rotuloDoDestino: tarefas.rotuloDoDestino(para, usuarios.DEPARTAMENTOS),
    async publicar() {
      if (problema) { aviso({ tom: 'erro', titulo: problema }); return; }
      setPublicando(true);
      try { await repo.publicar(texto, op.nome, extras, uid || undefined, norma && pdf ? pdf : undefined); toast('Publicado nas Notificações.'); fechar(); }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não foi publicado', texto: e instanceof Error ? e.message : String(e) }); }
      finally { setPublicando(false); }
    },
  };
}
