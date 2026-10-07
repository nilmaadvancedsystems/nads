// Os tickets do Mandei para a Tarefa (a central e a etapa que cria). Por enquanto com os dados de exemplo
// (comum/mandeiExemplo.ts: neste navegador, o e-mail simulado); com a regra do banco publicada pelo Vitor, entra o
// repositório do Entregas (os tickets na coleção do escritório, o e-mail pelo robô, os arquivos pelo robô do Drive).
import { mandei as m } from '@nads/core';
import { useSyncExternalStore } from 'react';
import { codigoNovo, exemplo } from '../../../comum/mandeiExemplo';

/** Os tickets, sempre a versão mais nova. */
export function useTicketsDoMandei(): m.Ticket[] {
  useSyncExternalStore(exemplo.assinar, exemplo.versao, exemplo.versao);
  return exemplo.tickets();
}

/** O endereço do formulário (no exemplo, neste mesmo site; no banco, o mandei-nilma). */
export const urlDoLink = (codigo: string) => window.location.origin + '/mandei/' + codigo;

/** O e-mail com o link: no exemplo, só marca como enviado (no banco, o pedido ao robô de e-mail do Entregas). */
function enviarLink(t: m.Ticket, l: m.LinkDoTicket, agora: Date): m.Ticket {
  return m.linkEnviado(t, l.codigo, agora, 'exemplo');
}

/** Cria o ticket e manda o 1º link. */
export function criarTicket(d: m.DadosDoTicket, agora = new Date()): m.Ticket {
  const t = exemplo.criar(d, codigoNovo(), agora);
  const enviado = enviarLink(t, t.links[0], agora);
  exemplo.gravar(enviado);
  return enviado;
}

/** O 1º link venceu sem arquivo: gera o 2º e manda (uma vez). */
export function gerarSegundoLink(t: m.Ticket, agora = new Date()) {
  const novo = m.comSegundoLink(t, codigoNovo(), agora);
  if (novo === t) return;
  exemplo.gravar(enviarLink(novo, m.linkAtual(novo), agora));
}

export function gravarTicket(t: m.Ticket) { exemplo.gravar(t); }

/** O arquivo para baixar (no exemplo, guardado neste navegador; no banco, do Drive pelo robô). */
export function arquivoParaBaixar(a: m.ArquivoDoTicket): string | null { return exemplo.arquivo(a.id); }

/** Os dados de exemplo (neste navegador): o e-mail não sai de verdade. */
export const MANDEI_NO_EXEMPLO = true;
