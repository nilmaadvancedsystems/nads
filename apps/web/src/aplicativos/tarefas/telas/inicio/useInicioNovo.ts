// ViewModel do Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo… só quero o posicionamento das coisas e
// tudo com a UI do nads"; a novidade 'inicio-novo', só no modo desenvolvedor). As abas no alto ("O menu lateral é superior"):
// Painel, Minhas tarefas, Documentos e Notificações. O Painel tem os cartões do print: o calendário do mês (prazos e reuniões),
// as próximas tarefas, as delegadas por mim e as próximas reuniões. As Notificações são a
// comunicação da equipe ("Reuniões, avisos vai ficar fixado nessa pagina, links de estudos da legislação… sem chats"). A tarefa
// abre numa janela só, por cima de qualquer aba. As regras são do core (tarefas.agenda, tarefas.delegadas, o mural).
import { tarefas, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAcesso, useAvisos, useTarefasDelegadas } from '../../dados/repo';
import { useOperador, type Operador } from '../../casca/operador';
import { useAgoraDoExpediente } from '../delegador/useAgoraDoExpediente';
import { abaDaUrl, ABAS_DO_INICIO, type AbaDoInicio } from './abasDoInicio';

const d = tarefas.delegadas;
const ag = tarefas.agenda;

/** Uma pessoa com a foto (a do Entregas) ou as iniciais. */
export interface PessoaComFoto { uid: string; nome: string; foto: string | null; iniciais: string }

/** as pílulas da busca (o print: "Add filters"): cada uma estreita o que a busca acha */
export const FILTROS_DA_BUSCA = [
  { id: 'atrasadas', rotulo: 'Atrasadas', icone: 'alert' },
  { id: 'hoje', rotulo: 'Para hoje', icone: 'clock' },
  { id: 'urgentes', rotulo: 'Urgentes', icone: 'zap' },
  { id: 'delegadas', rotulo: 'Delegadas por mim', icone: 'aviao' },
  { id: 'documentos', rotulo: 'Documentos', icone: 'clipe' },
] as const;
type FiltroDaBusca = (typeof FILTROS_DA_BUSCA)[number]['id'];

/** os dias do calendário mais os dias de reunião (cada reunião conta um) */
function somarDias(dias: Record<number, number>, mais: number[]): Record<number, number> {
  const r = { ...dias };
  for (const d of mais) r[d] = (r[d] || 0) + 1;
  return r;
}

const quandoCurto = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function useInicioNovo() {
  const op = useOperador().operador as Operador;
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

  // a busca do alto, com as pílulas: acha em todas as tarefas da pessoa (abertas e encerradas)
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<FiltroDaBusca[]>([]);
  const passa = (t: tarefas.delegadas.TarefaDelegada) => filtros.every(f =>
    f === 'atrasadas' ? d.atrasada(t, hoje, agora) : f === 'hoje' ? t.prazo === hoje && d.emAberto(t) : f === 'urgentes' ? t.prioridade === 'urgente'
      : f === 'delegadas' ? t.criadaPor.uid === uid && t.responsavel.uid !== uid : d.pedeDocumentos(t));
  const buscando = !!busca.trim() || filtros.length > 0;
  const achados = buscando ? d.ordenar(d.buscar(todas.filter(passa), busca), hoje, agora).slice(0, 8) : [];

  // a tarefa aberta (o id, 'nova' ou 'documentos'), por cima de qualquer aba
  const [aberta, setAberta] = useState<string | null>(null);

  // as Notificações: os comunicados da equipe (o mural), os fixados em cima
  const avisos = useAvisos();
  const mural = avisos.lista();
  const agoraIso = new Date();
  const comunicados = tarefas.ordenarAvisos(mural.avisos).map(a => ({
    ...a,
    tipoRotulo: tarefas.rotuloDoComunicado(a.tipo),
    tituloNaLista: a.titulo || a.texto.split('\n')[0].slice(0, 80),
    quandoFoi: tarefas.quandoFoi(a.em, agoraIso),
    reuniao: a.quando ? new Date(a.quando).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
  }));
  // o calendário: o mês mostrado e o dia escolhido (filtra as próximas tarefas)
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const doDia = dia ? abertas.filter(t => t.prazo === dia) : minhas;

  const concluir = (t: tarefas.delegadas.TarefaDelegada) => {
    // concluir pelo círculo só quando a tarefa deixa (o pedido de documentos pede os anexos): senão, abre a tarefa
    if (!d.acoesDaTarefa(t, relogio).some(a => a.id === 'concluir')) { setAberta(t.id); return; }
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
      qtd: a.id === 'tarefas' ? minhas.length : a.id === 'documentos' ? abertas.filter(d.pedeDocumentos).length : a.id === 'notificacoes' ? mural.avisos.length : 0,
    })),
    // a tarefa aberta
    aberta, abrir: (id: string) => setAberta(id), nova: () => setAberta('nova'), pedirDocumentos: () => setAberta('documentos'), fechar: () => setAberta(null),
    criada: (paraMim: boolean) => { setAberta(null); mudarAba(paraMim ? 'tarefas' : 'painel'); },

    // a busca do alto
    busca, setBusca,
    filtrosDaBusca: FILTROS_DA_BUSCA.map(f => ({ ...f, ligado: filtros.includes(f.id) })),
    alternarFiltro: (id: FiltroDaBusca) => setFiltros(x => (x.includes(id) ? x.filter(y => y !== id) : [...x, id])),
    limparBusca: () => { setBusca(''); setFiltros([]); },
    buscando,
    achados: achados.map(t => ({
      id: t.id, titulo: t.titulo, feita: !d.emAberto(t),
      detalhe: [t.clientes[0] ? (t.clientes[0].codigo != null ? t.clientes[0].codigo + ' · ' : '') + t.clientes[0].nome : '', d.rotuloDaPrioridade(t.prioridade), ag.prazoCurto(t.prazo, hoje)].filter(Boolean).join(' · '),
    })),

    // o Painel
    calendario: {
      mes, setMes, hoje, dia,
      escolher: (x: string | null) => { setDia(x); if (x) setMes(x.slice(0, 7)); },
      // os dias com prazo de tarefa e os dias com reunião (das Notificações)
      marcados: somarDias(ag.diasComPrazo(abertas, mes), comunicados.filter(c => c.tipo === 'reuniao' && c.quando?.startsWith(mes + '-')).map(c => Number(c.quando!.slice(8, 10)))),
    },
    proximas: {
      titulo: dia ? 'Prazo em ' + d.prazoParaTela(dia) : 'Minhas tarefas',
      total: dia ? doDia.length : minhas.length,
      linhas: doDia.slice(0, 6).map(t => ({
        id: t.id, titulo: t.titulo, prazo: ag.prazoCurto(t.prazo, hoje) || 'Sem prazo', atrasada: d.atrasada(t, hoje, agora),
        concluir: () => concluir(t),
      })),
    },
    delegadasPorMim: delegadas.slice(0, 5).map(t => {
      const m = d.ultimoMovimento(t);
      return {
        id: t.id, titulo: t.titulo, responsavel: comFoto(t.responsavel),
        status: { rotulo: d.rotuloNoHorario(t, relogio), tom: d.tomDoStatus(d.situacaoNoHorario(t, relogio).status) },
        // a linha já começa com quem faz: o nome só entra quando o movimento é de outra pessoa
        movimento: m ? (m.por === t.responsavel.nome ? '' : m.por + ' ') + m.texto.replace(/ a tarefa$/, '').toLowerCase() + ' · ' + quandoCurto(m.em) : d.rotuloDaVisualizacao(t) || 'Ainda não abriu',
      };
    }),
    reunioes: tarefas.proximasReunioes(comunicados, agoraLocal).slice(0, 3),
    comFoto,

    // as Notificações
    carregandoMural: !mural.carregados,
    comunicados,
    comunicado: comunicados.find(c => c.id === comunicado) || comunicados[0] || null,
    escolherComunicado: setComunicado,
  };
}

/** A janela do Novo comunicado (as Notificações): o tipo, o título, o dia e a hora da reunião, o link e o texto. */
export function useNovoComunicado(fechar: () => void, tipoInicial: tarefas.TipoDeComunicado = 'aviso') {
  const op = useOperador().operador as Operador;
  const { toast, aviso } = useRetorno();
  const repo = useAvisos();
  const [tipo, setTipo] = useState<tarefas.TipoDeComunicado>(tipoInicial);
  const [titulo, setTitulo] = useState('');
  const [link, setLink] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const dia = d.prazoDaTela(data);
  const extras: tarefas.ExtrasDoComunicado = { tipo, titulo, link, quando: tipo === 'reuniao' && dia && hora ? dia + 'T' + hora : '' };
  const problema = tarefas.problemaDoComunicado(texto, extras);
  return {
    tipo, setTipo, tipos: tarefas.TIPOS_DE_COMUNICADO, rotuloDoTipo: tarefas.rotuloDoComunicado(tipo),
    titulo, setTitulo, maiorTitulo: tarefas.MAIOR_TITULO_DO_COMUNICADO,
    link, setLink, data, setData, hora, setHora, texto, setTexto,
    faltam: tarefas.MAIOR_AVISO - tarefas.limparAviso(texto).length,
    problema, publicando,
    async publicar() {
      if (problema) { aviso({ tom: 'erro', titulo: problema }); return; }
      setPublicando(true);
      try { await repo.publicar(texto, op.nome, extras); toast('Publicado nas Notificações.'); fechar(); }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não foi publicado', texto: e instanceof Error ? e.message : String(e) }); }
      finally { setPublicando(false); }
    },
  };
}
