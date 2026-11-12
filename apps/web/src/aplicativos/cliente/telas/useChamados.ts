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
import { repoAreaCliente } from '../dados/repo';
import { partesDaSolicitacao, passoDaSolicitacao, PASSOS_DA_SOLICITACAO, textoDoChamado, textoDosAnexos, whatsappDaSolicitacao } from '../dados/regras';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';
import { comMime } from './useEnviar';

export const PRIORIDADES = ['Normal', 'Alta', 'Urgente'];
export type FiltroDasSolicitacoes = 'abertas' | 'respondidas' | 'concluidas' | 'todas';

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const DO_FILTRO: Record<FiltroDasSolicitacoes, (s: ac.SituacaoDoChamado) => boolean> = {
  abertas: s => s === 'aberto' || s === 'em andamento', respondidas: s => s === 'respondido', concluidas: s => s === 'concluido', todas: () => true,
};

export function useChamados({ token, area }: DaCasca) {
  const { toast } = useRetorno();
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
  const [titulo, setTitulo] = useState(pedido.novoChamado?.titulo ?? '');
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [anexando, setAnexando] = useState('');
  const [erroDoAnexo, setErroDoAnexo] = useState<{ id: string; texto: string }>({ id: '', texto: '' });
  const whatsapp = area.resumo?.escritorio.whatsapp;

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
    const { passo, rotulo } = passoDaSolicitacao(c.situacao);
    const primeira = c.mensagens[0];
    const ultima = c.mensagens[c.mensagens.length - 1];
    const resposta = partes.respostas[partes.respostas.length - 1];
    return {
      id: c.id, titulo: c.titulo, situacao: c.situacao, rotulo, passo,
      assunto: ac.TIPOS_DE_CHAMADO.find(x => x.valor === c.tipo)?.rotulo ?? 'Outro assunto',
      abertaEm: primeira ? new Date(primeira.em).toLocaleDateString('pt-BR') : '',
      atualizada: ultima ? dia(ultima.em) : '',
      previa: resposta ? resposta.texto : partes.pedido,
      previaDoEscritorio: !!resposta,
      pedido: partes.pedido, complementos: partes.complementos,
      respostas: partes.respostas.map(r => ({ texto: r.texto, quando: quando(r.em) })),
      escolhida: c.id === atualId,
      whatsapp: whatsappDaSolicitacao(whatsapp, c.titulo),
      aceitaArquivo: c.situacao !== 'concluido',
      anexando: anexando === c.id,
      erroDoAnexo: erroDoAnexo.id === c.id ? erroDoAnexo.texto : '',
    };
  };
  const atual = todas.find(c => c.id === atualId);

  async function criar() {
    const problema = ac.erroDoNovoChamado(tipo, (titulo + ' ' + texto).trim()) || (anexo ? ac.erroDoEnvio({ nome: anexo.name, tamanho: anexo.size }) : '');
    setErro(problema);
    if (problema || !tipo) return;
    setEnviando(true);
    try {
      if (anexo) await repoAreaCliente.enviar(token, 'outro', [comMime(anexo)]);
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto: textoDoChamado(titulo, texto, prioridade, anexo?.name ?? '') });
      if (id) {
        setTipo(''); setTitulo(''); setTexto(''); setPrioridade('Normal'); setAnexo(null);
        setFiltro('todas'); setEscolhida(id); setModo('ver');
        toast('Solicitação enviada. A resposta do escritório aparece aqui.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar a solicitação. Tente de novo.');
    } finally { setEnviando(false); }
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
    modo, atual: atual ? vista(atual) : null, passos: PASSOS_DA_SOLICITACAO, painelNoCelular,
    abrir: (id: string) => { setEscolhida(id); setModo('ver'); setPainelNoCelular(true); },
    nova: () => { setModo('nova'); setErro(''); setPainelNoCelular(true); },
    voltar: () => setPainelNoCelular(false),
    // a nova: primeiro o assunto (os cartões), depois o formulário
    tipos: ac.TIPOS_DE_CHAMADO, tipo, rotuloDoTipo: ac.TIPOS_DE_CHAMADO.find(t => t.valor === tipo)?.rotulo ?? '',
    escolherTipo: (v: ac.TipoDeChamado | '') => { setTipo(v); setErro(''); },
    prioridades: PRIORIDADES, prioridade, mudarPrioridade: setPrioridade,
    titulo, mudarTitulo: setTitulo, texto, mudarTexto: setTexto, anexo, mudarAnexo: setAnexo,
    aceitar: ac.ACEITAR_NO_CAMPO, limite: ac.LIMITE_DO_ENVIO,
    criar: () => { void criar(); }, erro, enviando,
    cancelarNova: () => { setModo('ver'); setTipo(''); setErro(''); setPainelNoCelular(false); },
    anexar: (id: string, fs: File[]) => { void anexar(id, fs); },
  };
}
