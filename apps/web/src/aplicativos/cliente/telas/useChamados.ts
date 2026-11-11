// ViewModel das Solicitações da Área do Cliente (Vitor, 16/10/2026): a abertura rápida (assunto, prioridade, o texto e um
// anexo) e a lista das solicitações. A prioridade e o nome do anexo vão no fim do texto; o anexo segue pelo Enviar.
// "Melhora mais" de 17/10/2026: o irPara da Visão geral chega com um pedido (abrir uma solicitação, ou o formulário já com
// o assunto e o título, como o "Pedir guia nova"); as que o escritório respondeu vêm primeiro.
// Sem chat (11/11/2026: "por existir o WhatsApp, não precisa de um chat; um sistema de requisições já serve; o chat só fica
// bom no PC"): cada solicitação mostra o pedido, a situação em passos e a resposta do escritório; para conversar, o
// WhatsApp do escritório já com o assunto. O cliente não responde mais por aqui.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { repoAreaCliente } from '../dados/repo';
import { partesDaSolicitacao, passoDaSolicitacao, PASSOS_DA_SOLICITACAO, textoDoChamado, whatsappDaSolicitacao } from '../dados/regras';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';
import { comMime } from './useEnviar';

export const PRIORIDADES = ['Normal', 'Alta', 'Urgente'];

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function useChamados({ token, area }: DaCasca) {
  const { toast } = useRetorno();
  // o pedido que veio com a aba (só na abertura dela)
  const { state } = useLocation();
  const [pedido] = useState(() => (state ?? {}) as PedidoDaTela);
  const [abertoId, setAbertoId] = useState(pedido.chamado ?? '');
  const [tipo, setTipo] = useState<ac.TipoDeChamado | ''>(pedido.novoChamado?.tipo ?? '');
  const [prioridade, setPrioridade] = useState('Normal');
  const [titulo, setTitulo] = useState(pedido.novoChamado?.titulo ?? '');
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const whatsapp = area.resumo?.escritorio.whatsapp;

  // as que o escritório respondeu primeiro (esperam o cliente ler); o resto na ordem do espelho
  const ordem = [...area.chamados.filter(c => c.situacao === 'respondido'), ...area.chamados.filter(c => c.situacao !== 'respondido')];
  const solicitacoes = ordem.map(c => {
    const partes = partesDaSolicitacao(c);
    const { passo, rotulo } = passoDaSolicitacao(c.situacao);
    const primeira = c.mensagens[0];
    return {
      id: c.id, titulo: c.titulo, situacao: c.situacao, rotulo, passo,
      assunto: ac.TIPOS_DE_CHAMADO.find(x => x.valor === c.tipo)?.rotulo ?? 'Outro assunto',
      abertaEm: primeira ? new Date(primeira.em).toLocaleDateString('pt-BR') : '',
      pedido: partes.pedido, complementos: partes.complementos,
      respostas: partes.respostas.map(r => ({ texto: r.texto, quando: quando(r.em) })),
      aberta: c.id === abertoId,
      whatsapp: whatsappDaSolicitacao(whatsapp, c.titulo),
    };
  });

  async function criar() {
    const problema = ac.erroDoNovoChamado(tipo, (titulo + ' ' + texto).trim()) || (anexo ? ac.erroDoEnvio({ nome: anexo.name, tamanho: anexo.size }) : '');
    setErro(problema);
    if (problema || !tipo) return;
    setEnviando(true);
    try {
      if (anexo) await repoAreaCliente.enviar(token, 'outro', [comMime(anexo)]);
      const id = await repoAreaCliente.abrirChamado(token, { tipo, texto: textoDoChamado(titulo, texto, prioridade, anexo?.name ?? '') });
      if (id) {
        setAbertoId(id); setTipo(''); setTitulo(''); setTexto(''); setPrioridade('Normal'); setAnexo(null);
        toast('Solicitação enviada. A resposta do escritório aparece aqui.');
      }
    } catch (e) {
      // o banco recusou (link revogado) ou caiu a internet: a frase vem pronta do repositório
      setErro(e instanceof Error ? e.message : 'Não deu para enviar a solicitação. Tente de novo.');
    } finally { setEnviando(false); }
  }

  return {
    pedido, solicitacoes, passos: PASSOS_DA_SOLICITACAO,
    primeiraRespondida: solicitacoes.find(c => c.situacao === 'respondido')?.id ?? '',
    alternar: (id: string) => setAbertoId(a => (a === id ? '' : id)),
    tipos: ac.TIPOS_DE_CHAMADO, tipo, mudarTipo: (v: string) => setTipo(v as ac.TipoDeChamado | ''),
    prioridades: PRIORIDADES, prioridade, mudarPrioridade: setPrioridade,
    limite: ac.LIMITE_DO_ENVIO,
    titulo, mudarTitulo: setTitulo, texto, mudarTexto: setTexto, anexo, mudarAnexo: setAnexo, aceitar: ac.ACEITAR_NO_CAMPO,
    criar, erro, enviando,
  };
}
