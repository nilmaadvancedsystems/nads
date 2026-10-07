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

// ─── o ⚡ do modo desenvolvedor (Vitor, 07/10/2026): simular o caminho do ticket sem esperar os prazos ──────────

/** Um ticket de teste (empresa 9999, três itens), como se tivesse saído do Clientes › Envio. */
export function criarTicketDeTeste(por: string): m.Ticket {
  return criarTicket({
    empresa: { nome: 'PERSONALY COMPANY', codigo: 9999 }, para: { nome: 'Cliente de teste', email: 'teste@exemplo.com' },
    assunto: 'Clientes em aberto — teste', mensagem: 'Ticket de teste do modo desenvolvedor: pode responder à vontade.',
    criadoPor: { nome: por }, origem: { titulo: 'Teste (modo desenvolvedor)', rota: '' },
    itens: [
      { id: 't1', titulo: 'MERCADO BOM PRECO LTDA', valor: 'R$ 1.250,40', detalhe: 'Não encontrei, onde está esse valor?', opcoes: m.OPCOES_PADRAO },
      { id: 't2', titulo: 'CONSTRUTORA ALFA LTDA', valor: 'R$ 8.730,00', detalhe: 'Foi pago em dinheiro?', opcoes: m.OPCOES_PADRAO },
      { id: 't3', titulo: 'PADARIA DO JOAO', valor: 'R$ 312,90', detalhe: 'No meu sistema, está em aberto: 10/07/2026 - NF 200 - R$ 312,90', opcoes: m.OPCOES_PADRAO },
    ],
  });
}

export type SimulacaoDoMandei = 'abriu' | 'respondeu' | 'anexou' | 'vencer' | 'apagar';
export const ROTULO_DA_SIMULACAO: Record<SimulacaoDoMandei, string> = {
  abriu: 'Simular: o cliente abriu o link',
  respondeu: 'Simular: o cliente respondeu (sem arquivo)',
  anexou: 'Simular: o cliente anexou um arquivo',
  vencer: 'Simular: vencer o link atual',
  apagar: 'Apagar este ticket',
};

/** Faz o que o cliente (ou o tempo) faria com o ticket: abrir, responder, anexar, vencer o link; ou apagar. */
export function simular(t: m.Ticket, acao: SimulacaoDoMandei, agora = new Date()) {
  const l = m.linkAtual(t);
  if (acao === 'apagar') { exemplo.apagar(t.id); return; }
  if (acao === 'abriu') { exemplo.gravar(m.linkAberto(t, l.codigo, agora)); return; }
  if (acao === 'respondeu') {
    exemplo.gravar(m.responder(m.linkAberto(t, l.codigo, agora), Object.fromEntries(t.itens.map(it => [it.id, { opcao: it.opcoes[0], texto: 'Resposta de teste' }])), agora));
    return;
  }
  if (acao === 'anexou') {
    const id = 'arq-teste-' + agora.getTime().toString(36);
    exemplo.guardarArquivo(id, 'data:text/plain;base64,' + btoa('comprovante de teste'));
    exemplo.gravar(m.comArquivo(m.linkAberto(t, l.codigo, agora), { id, nome: 'comprovante-teste.txt', tamanho: 20, itemId: t.itens[0]?.id, enviadoEm: agora.toISOString(), status: 'na-fila' }));
    return;
  }
  // vencer: o prazo do link atual passa para ontem (o 2º link sai sozinho na tela de quem mandou; vencido o 2º, "Ligar")
  const ontem = new Date(agora.getTime() - 24 * 3600 * 1000).toISOString();
  exemplo.gravar({ ...t, links: t.links.map(x => (x.codigo === l.codigo ? { ...x, validoAte: ontem } : x)) });
}
