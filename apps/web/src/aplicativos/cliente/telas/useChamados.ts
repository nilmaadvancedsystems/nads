// ViewModel de Solicitações e chamados (Vitor, 16/10/2026): a abertura rápida (assunto, prioridade, o texto e um anexo),
// o histórico, a conversa e a resposta. A prioridade e o nome do anexo vão no fim do texto; o anexo segue pelo Enviar.
// "Melhora mais" de 17/10/2026: o irPara da Visão geral chega com um pedido (abrir a conversa de um chamado, ou o
// formulário já com o assunto e o título, como o "Pedir guia nova"); os chamados que o escritório respondeu vêm primeiro.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { repoAreaCliente } from '../dados/repo';
import { textoDoChamado } from '../dados/regras';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';
import { comMime } from './useEnviar';

export const PRIORIDADES = ['Normal', 'Alta', 'Urgente'];

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
  const [resposta, setResposta] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aberto = area.chamados.find(c => c.id === abertoId) ?? null;
  // os que o escritório respondeu primeiro (esperam o cliente); o resto na ordem do espelho
  const chamados = [...area.chamados.filter(c => c.situacao === 'respondido'), ...area.chamados.filter(c => c.situacao !== 'respondido')];

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
        toast('Chamado aberto. O escritório vai responder por aqui.');
      }
    } catch (e) {
      // o banco recusou (link revogado) ou caiu a internet: a frase vem pronta do repositório
      setErro(e instanceof Error ? e.message : 'Não deu para abrir o chamado. Tente de novo.');
    } finally { setEnviando(false); }
  }

  async function responder() {
    if (!aberto || !resposta.trim()) return;
    setEnviando(true);
    try {
      await repoAreaCliente.responderChamado(token, aberto.id, resposta);
      setResposta('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para responder. Tente de novo.');
    } finally { setEnviando(false); }
  }

  return {
    pedido, chamados, primeiroRespondido: chamados.find(c => c.situacao === 'respondido')?.id ?? '', aberto, alternar: (id: string) => { setAbertoId(a => (a === id ? '' : id)); setResposta(''); },
    tipos: ac.TIPOS_DE_CHAMADO, tipo, mudarTipo: (v: string) => setTipo(v as ac.TipoDeChamado | ''),
    prioridades: PRIORIDADES, prioridade, mudarPrioridade: setPrioridade,
    limite: ac.LIMITE_DO_ENVIO,
    titulo, mudarTitulo: setTitulo, texto, mudarTexto: setTexto, anexo, mudarAnexo: setAnexo, aceitar: ac.ACEITAR_NO_CAMPO,
    criar, erro, resposta, mudarResposta: setResposta, responder, enviando,
    aceitaResposta: !!aberto && ac.chamadoAceitaResposta(aberto),
    rotuloDaSituacao: ac.ROTULO_DA_SITUACAO_DO_CHAMADO, rotuloDoTipo: (t: string) => ac.TIPOS_DE_CHAMADO.find(x => x.valor === t)?.rotulo ?? 'Outro assunto',
    // a prévia de cada chamado na lista: a última mensagem e quando
    ultimaMensagem: (c: ac.ChamadoDoCliente) => c.mensagens[c.mensagens.length - 1] ?? null,
    abertoEm: (c: ac.ChamadoDoCliente) => c.mensagens[0] ? new Date(c.mensagens[0].em).toLocaleDateString('pt-BR') : '',
    quando: (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
  };
}
