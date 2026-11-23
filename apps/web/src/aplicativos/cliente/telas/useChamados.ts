// ViewModel das Solicitações da Área do Cliente, refeitas como lista + painel (12/11/2026: "refaz essa parte inteira"; a
// escolhida: "lista + painel ao lado", como um e-mail ou um helpdesk). À esquerda a lista com os filtros (Abertas,
// Respondidas, Concluídas, Todas) e a prévia da última resposta; à direita a solicitação escolhida (as etapas, o pedido, a
// resposta, enviar arquivos e o WhatsApp) ou a nova (o assunto em cartões e, depois, o formulário). No celular, um de cada
// vez (a lista; o painel com o "voltar").
// Sem chat (11/11/2026): para conversar, o WhatsApp do escritório já com o assunto; o cliente não responde por aqui, só
// manda os arquivos que o escritório pediu (vão pela caixa de envios e a solicitação ganha "Enviei os arquivos: …").
// Vindo da Visão geral: a solicitação pedida já abre, ou a nova já com o assunto e o título ("Pedir guia nova").
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { guardarNota, notasDadas } from '../dados/avaliadas';
import { repoAreaCliente } from '../dados/repo';
import { DOCUMENTOS_PARA_PEDIR, erroDoPedidoDeDocumento, partesDaSolicitacao, passoDaSolicitacao, textoDoChamado, textoDoPedidoDeDocumento, textoDosAnexos, whatsappDaSolicitacao } from '../dados/regras';
import { resumoDasSolicitacoes } from '../dados/solicitacoes';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';
import { comMime } from './useEnviar';
import { useDp, type DadosDoPedido, type Pedido } from './useDp';

export const PRIORIDADES = ['Normal', 'Alta', 'Urgente'];
/** os pedidos do DP: a tela própria de cada um (a mesma do RH) */
const DO_DP = new Set<string>(['admissao', 'ferias', 'demissao']);
export const ehDoDp = (t: string): t is Pedido => DO_DP.has(t);
export type FiltroDasSolicitacoes = 'abertas' | 'respondidas' | 'concluidas' | 'todas';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const DO_FILTRO: Record<FiltroDasSolicitacoes, (s: ac.SituacaoDoChamado) => boolean> = {
  abertas: s => s === 'aberto' || s === 'em andamento', respondidas: s => s === 'respondido', concluidas: s => s === 'concluido', todas: () => true,
};

export function useChamados(casca: DaCasca) {
  const { token, area, marcarLida } = casca;
  const { toast } = useRetorno();
  // os pedidos do DP (23/11/2026: "cada solicitacao tenha uma tela diferente"): o mesmo formulário e o mesmo envio do RH
  const dp = useDp(casca);
  // o pedido que veio com a aba (só na abertura dela)
  const { state } = useLocation();
  const [pedido] = useState(() => (state ?? {}) as PedidoDaTela);
  const [filtro, setFiltro] = useState<FiltroDasSolicitacoes>('todas');
  const [modo, setModo] = useState<'ver' | 'nova'>(pedido.novoChamado ? 'nova' : 'ver');
  const [escolhida, setEscolhida] = useState(pedido.chamado ?? '');
  // no celular: o painel por cima da lista (veio da Visão geral = já abre o painel)
  const [painelNoCelular, setPainelNoCelular] = useState(!!(pedido.chamado || pedido.novoChamado));
  const [tipo, setTipo] = useState<ac.TipoDeChamado | ''>(pedido.novoChamado?.tipo ?? '');
  const [prioridade, setPrioridade] = useState('Normal');
  const [titulo, setTitulo] = useState(pedido.novoChamado?.tipo === 'documento' ? '' : pedido.novoChamado?.titulo ?? '');
  const [texto, setTexto] = useState(pedido.novoChamado?.tipo === 'documento' ? pedido.novoChamado.titulo : '');
  // o pedido de documento: qual, para quando e os detalhes (a guia nova da Visão geral já vem escolhida)
  const [documento, setDocumento] = useState(pedido.novoChamado?.tipo === 'documento' && pedido.novoChamado.titulo ? 'Guia nova (segunda via)' : '');
  const [prazo, setPrazo] = useState('');
  // os dados do pedido do DP (o formulário avisa a cada mudança)
  const [dadosDp, setDadosDp] = useState<DadosDoPedido | null>(() => {
    const t = pedido.novoChamado?.tipo;
    return t === 'admissao' ? dp.novaAdmissao() : t === 'ferias' ? dp.novasFerias() : t === 'demissao' ? dp.novaDemissao() : null;
  });
  const [anexo, setAnexo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [anexando, setAnexando] = useState('');
  const [erroDoAnexo, setErroDoAnexo] = useState<{ id: string; texto: string }>({ id: '', texto: '' });
  const whatsapp = area.resumo?.escritorio.whatsapp;
  // a avaliação da concluída (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir")
  const [notas, setNotas] = useState<Record<string, number>>(() => notasDadas(token));
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [avaliando, setAvaliando] = useState(false);
  const [reavaliar, setReavaliar] = useState(false);

  // as respondidas primeiro (esperam o cliente ler); depois as abertas; as concluídas por último
  const peso = (s: ac.SituacaoDoChamado) => (s === 'respondido' ? 0 : s === 'concluido' ? 2 : 1);
  const todas = [...area.chamados].sort((a, b) => peso(a.situacao) - peso(b.situacao));
  const contagem = { abertas: 0, respondidas: 0, concluidas: 0, todas: todas.length };
  for (const c of todas) for (const f of ['abertas', 'respondidas', 'concluidas'] as const) if (DO_FILTRO[f](c.situacao)) contagem[f]++;
  const visiveis = todas.filter(c => DO_FILTRO[filtro](c.situacao));
  // a escolhida: a pedida, ou a primeira da lista
  const atualId = modo === 'ver' ? (todas.some(c => c.id === escolhida) ? escolhida : visiveis[0]?.id ?? '') : '';

  const vista = (c: ac.ChamadoDoCliente) => {
    const partes = partesDaSolicitacao(c);
    const { rotulo } = passoDaSolicitacao(c.situacao);
    const primeira = c.mensagens[0];
    const ultima = c.mensagens[c.mensagens.length - 1];
    const resposta = partes.respostas[partes.respostas.length - 1];
    return {
      id: c.id, titulo: c.titulo, situacao: c.situacao, rotulo,
      assunto: ac.TIPOS_DE_CHAMADO.find(x => x.valor === c.tipo)?.rotulo ?? 'Outro assunto',
      abertaEm: primeira ? new Date(primeira.em).toLocaleDateString('pt-BR') : '',
      atualizada: ultima ? dia(ultima.em) : '',
      previa: resposta ? resposta.texto : partes.pedido,
      previaDoEscritorio: !!resposta,
      // quem respondeu por último, na prévia da lista: o primeiro nome (ou "Escritório")
      quemRespondeu: resposta ? resposta.autor || 'Escritório' : '',
      pedido: partes.pedido, complementos: partes.complementos,
      // a conversa em ordem, como num chat (23/11/2026: "e para ficar tipo um chat"): depois do pedido, cada mensagem no seu
      // lugar (o arquivo que o cliente mandou depois da resposta fica depois dela)
      conversa: c.mensagens.slice(1).map((m, i) => ({ chave: i + '-' + m.em, deVoce: m.de === 'cliente', texto: m.texto, quando: quando(m.em), autor: m.de === 'cliente' ? '' : m.autor && m.autor !== 'Escritório' ? m.autor : '' })),
      respostas: partes.respostas.map(r => ({ texto: r.texto, quando: quando(r.em), autor: r.autor })),
      escolhida: c.id === atualId,
      // o passo atual do pedido do DP (23/11/2026, ficha processos-visiveis)
      passo: c.passo ?? null,
      whatsapp: whatsappDaSolicitacao(whatsapp, c.titulo),
      aceitaArquivo: c.situacao !== 'concluido',
      // só a concluída pede a nota; a já avaliada neste aparelho mostra o obrigado
      avaliar: c.situacao === 'concluido',
      notaDada: notas[c.id] ?? 0,
      anexando: anexando === c.id,
      erroDoAnexo: erroDoAnexo.id === c.id ? erroDoAnexo.texto : '',
    };
  };
  const atual = todas.find(c => c.id === atualId);

  const limpar = () => { setTipo(''); setTitulo(''); setTexto(''); setDocumento(''); setPrazo(''); setDadosDp(null); setPrioridade('Normal'); setAnexo(null); };
  /** o formulário novo do assunto: o pedido do DP começa com o padrão dele (o mesmo do RH) */
  const escolherTipo = (v: ac.TipoDeChamado | '') => {
    setTipo(v); setErro('');
    setDadosDp(v === 'admissao' ? dp.novaAdmissao() : v === 'ferias' ? dp.novasFerias() : v === 'demissao' ? dp.novaDemissao() : null);
  };

  async function criar() {
    if (!tipo) return;
    // o pedido do DP: o mesmo envio do RH (confere, manda e avisa)
    if (ehDoDp(tipo)) {
      if (!dadosDp) return;
      setEnviando(true);
      try {
        const problema = await dp.pedir(tipo, dadosDp);
        setErro(problema);
        if (!problema) { limpar(); setFiltro('todas'); setEscolhida(''); setModo('ver'); }
      } finally { setEnviando(false); }
      return;
    }
    const doDocumento = tipo === 'documento';
    const problema = (doDocumento ? erroDoPedidoDeDocumento(documento, texto) : !titulo.trim() ? (tipo === 'duvida' ? 'Diga sobre o que é a dúvida.' : 'Dê um assunto à solicitação.') : ac.erroDoNovoChamado(tipo, texto))
      || (anexo ? ac.erroDoEnvio({ nome: anexo.name, tamanho: anexo.size }) : '');
    setErro(problema);
    if (problema) return;
    setEnviando(true);
    try {
      if (anexo) await repoAreaCliente.enviar(token, 'outro', [comMime(anexo)]);
      const corpo = doDocumento ? textoDoPedidoDeDocumento(documento, prazo, texto, prioridade, anexo?.name ?? '') : textoDoChamado(titulo, texto, prioridade, anexo?.name ?? '');
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto: corpo });
      if (id) {
        limpar();
        setFiltro('todas'); setEscolhida(id); setModo('ver');
        toast('Solicitação enviada. A resposta do escritório aparece aqui.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar a solicitação. Tente de novo.');
    } finally { setEnviando(false); }
  }

  /** a nota (e o comentário opcional) da concluída: vai para o escritório, não vira conversa */
  async function avaliar(id: string) {
    if (!nota || avaliando) return;
    setAvaliando(true);
    try {
      await repoAreaCliente.avaliarChamado(token, id, nota, comentario);
      guardarNota(token, id, nota);
      setNotas(n => ({ ...n, [id]: nota }));
      setNota(0); setComentario(''); setReavaliar(false);
      toast('Obrigado pela avaliação.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para enviar a avaliação. Tente de novo.');
    } finally { setAvaliando(false); }
  }

  /** os arquivos da solicitação: confere todos, manda pela caixa de envios e avisa na própria solicitação */
  async function anexar(id: string, arquivos: File[]) {
    const c = area.chamados.find(x => x.id === id);
    if (!c || !arquivos.length) return;
    const problema = arquivos.map(a => ac.erroDoEnvio({ nome: a.name, tamanho: a.size })).find(Boolean) || '';
    setErroDoAnexo({ id, texto: problema });
    if (problema) return;
    setAnexando(id);
    try {
      await repoAreaCliente.enviar(token, 'outro', arquivos.map(comMime));
      await repoAreaCliente.responderChamado(token, id, textoDosAnexos(arquivos.map(a => a.name)));
      toast(arquivos.length === 1 ? 'Arquivo enviado ao escritório.' : arquivos.length + ' arquivos enviados ao escritório.');
    } catch (e) {
      setErroDoAnexo({ id, texto: e instanceof Error ? e.message : 'Não deu para enviar. Tente de novo.' });
    } finally { setAnexando(''); }
  }

  return {
    filtros: (['todas', 'abertas', 'respondidas', 'concluidas'] as const).map(f => ({
      id: f, rotulo: { todas: 'Todas', abertas: 'Abertas', respondidas: 'Respondidas', concluidas: 'Concluídas' }[f], n: contagem[f], ativo: filtro === f,
    })),
    escolherFiltro: setFiltro,
    lista: visiveis.map(vista), total: todas.length,
    // a linha embaixo do título (13/11/2026: "essa tem que ficar impecável"); 16/11/2026 ("muita informação"): no
    // máximo dois fatos, sem o total (já está na aba Todas)
    resumo: resumoDasSolicitacoes({ total: todas.length, respondidas: contagem.respondidas, abertas: contagem.abertas }),
    // quem fala na conversa: a empresa (o "Você") com a logo ou as iniciais
    empresa: { nome: area.ficha?.nomeFantasia || area.ficha?.razaoSocial || area.resumo?.empresas?.[0]?.nome || 'Você', logo: area.logo },
    // os passos Recebida › Em andamento › Respondida saíram do painel (16/11/2026: "muita informação"): repetiam o selo
    modo, atual: atual ? vista(atual) : null, painelNoCelular,
    abrir: (id: string) => {
      setEscolhida(id); setModo('ver'); setPainelNoCelular(true);
      setNota(0); setComentario(''); setReavaliar(false);
      // abriu a resposta do escritório: o aviso sai do sino e não volta (ficha aviso-de-resposta, 17/11/2026)
      const c = area.chamados.find(x => x.id === id);
      if (c?.situacao === 'respondido') marcarLida?.('c-' + c.id + '-' + c.mensagens.length);
    },
    nova: () => { setModo('nova'); setErro(''); setPainelNoCelular(true); },
    voltar: () => setPainelNoCelular(false),
    // a nova: primeiro o assunto (os cartões), depois o formulário
    tipos: ac.TIPOS_DE_CHAMADO, tipo, rotuloDoTipo: ac.TIPOS_DE_CHAMADO.find(t => t.valor === tipo)?.rotulo ?? '',
    escolherTipo,
    // o formulário de cada assunto (23/11/2026: "cada solicitacao tenha uma tela diferente")
    doDp: tipo !== '' && ehDoDp(tipo), dadosDp, mudarDadosDp: setDadosDp, nomes: dp.nomes, equipe: dp.equipeDasFerias, hoje: dp.hoje,
    documentos: DOCUMENTOS_PARA_PEDIR, documento, mudarDocumento: setDocumento, prazo, mudarPrazo: setPrazo,
    prioridades: PRIORIDADES, prioridade, mudarPrioridade: setPrioridade,
    titulo, mudarTitulo: setTitulo, texto, mudarTexto: setTexto, anexo, mudarAnexo: setAnexo,
    aceitar: ac.ACEITAR_NO_CAMPO, limite: ac.LIMITE_DO_ENVIO,
    criar: () => { void criar(); }, erro, enviando,
    cancelarNova: () => { setModo('ver'); limpar(); setErro(''); setPainelNoCelular(false); },
    anexar: (id: string, fs: File[]) => { void anexar(id, fs); },
    // a avaliação (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir")
    nota, escolherNota: setNota, comentario, mudarComentario: setComentario, avaliando, reavaliar,
    mudarNota: () => setReavaliar(true), maiorComentario: ac.MAIOR_COMENTARIO_DA_AVALIACAO, rotuloDaNota: (n: number) => ac.ROTULO_DA_NOTA[n] ?? '',
    avaliar: (id: string) => { void avaliar(id); },
  };
}
