// Os tickets do Mandei para a Tarefa (a central, as etapas que criam e o Novo ticket). Dois repositórios com as mesmas
// funções (11/11/2026, "liga ao banco"):
//   - no banco (mandei.firestore.ts): os tickets no Entregas, o formulário do cliente em ticketsLinks, o e-mail pelo robô
//     (solicitacoesEmail, tipo 'mandei') e os arquivos pelo enviosSecretario (o robô grava no Drive);
//   - nos dados de exemplo (comum/mandeiExemplo.ts): neste navegador, o e-mail só marcado como enviado.
// A regra (o ticket, os links, a revisão) está no @nads/core (mandei); aqui, onde guardar e o pedido do e-mail.
import { mandei as m } from '@nads/core';
import { useSyncExternalStore } from 'react';
import { codigoNovo, exemplo } from '../../../comum/mandeiExemplo';
import { noBanco, quemPede } from './fonte';
import { criarMandeiFirestore } from './mandei.firestore';

export interface RepoMandei {
  /** true = os dados de exemplo (neste navegador; o e-mail não sai) */
  exemplo: boolean;
  assinar(f: () => void): () => void;
  versao(): number;
  /** os tickets já com o que o cliente fez nos links (as respostas, os arquivos, quando abriu) */
  tickets(): m.Ticket[];
  /** cria o ticket com o 1º link e pede o e-mail */
  criar(d: m.DadosDoTicket): Promise<m.Ticket>;
  /** grava o que a equipe mudou (aceitar, a nota) */
  gravar(t: m.Ticket): Promise<void>;
  /** um link novo no ticket (o 2º ou o da volta): o formulário dele, o de antes fechado e o e-mail. false = alguém já fez */
  novoLink(antes: m.Ticket, depois: m.Ticket): Promise<boolean>;
  /** resolve: grava e fecha o link (o cliente não grava mais nada) */
  resolver(t: m.Ticket, por: string): Promise<void>;
  apagar(id: string): Promise<void>;
  /** o arquivo para baixar: no exemplo, o guardado neste navegador; no banco, null (está no Drive: ArquivoDoTicket.local) */
  arquivo(a: m.ArquivoDoTicket): string | null;
  /** o endereço do formulário do link */
  urlDoLink(codigo: string): string;
}

/** O e-mail com o link, nos dados de exemplo: só marca como enviado. */
const enviadoNoExemplo = (t: m.Ticket, agora: Date) => m.linkEnviado(t, m.linkAtual(t).codigo, agora, 'exemplo');

function criarMandeiMemoria(): RepoMandei {
  return {
    exemplo: true,
    assinar: exemplo.assinar, versao: exemplo.versao, tickets: exemplo.tickets,
    async criar(d) {
      const agora = new Date();
      const t = enviadoNoExemplo(exemplo.criar(d, codigoNovo(), agora), agora);
      exemplo.gravar(t);
      return t;
    },
    async gravar(t) { exemplo.gravar(t); },
    async novoLink(antes, depois) {
      const atual = exemplo.tickets().find(x => x.id === antes.id);
      if (!atual || atual.links.length !== antes.links.length) return false;
      exemplo.gravar(enviadoNoExemplo(depois, new Date()));
      return true;
    },
    async resolver(t, por) { exemplo.gravar(m.resolver(t, por, new Date())); },
    async apagar(id) { exemplo.apagar(id); },
    arquivo: a => exemplo.arquivo(a.id),
    urlDoLink: codigo => window.location.origin + '/mandei/' + codigo,
  };
}

let repo: RepoMandei | null = null;
export function repoDoMandei(): RepoMandei {
  if (!repo) repo = noBanco ? criarMandeiFirestore(codigoNovo, quemPede) : criarMandeiMemoria();
  return repo;
}

/** Os tickets, sempre a versão mais nova. */
export function useTicketsDoMandei(): m.Ticket[] {
  const r = repoDoMandei();
  useSyncExternalStore(r.assinar, r.versao, r.versao);
  return r.tickets();
}

/** O endereço do formulário (no exemplo, neste mesmo site; no banco, o site do cliente). */
export const urlDoLink = (codigo: string) => repoDoMandei().urlDoLink(codigo);

/** Cria o ticket e manda o 1º link. */
export function criarTicket(d: m.DadosDoTicket): Promise<m.Ticket> { return repoDoMandei().criar(d); }

/** O 1º link venceu sem arquivo: gera o 2º e manda (uma vez). */
export async function gerarSegundoLink(t: m.Ticket, agora = new Date()): Promise<void> {
  const novo = m.comSegundoLink(t, codigoNovo(), agora);
  if (novo !== t) await repoDoMandei().novoLink(t, novo);
}

export function gravarTicket(t: m.Ticket): Promise<void> { return repoDoMandei().gravar(t); }

export function resolverTicket(t: m.Ticket, por: string): Promise<void> { return repoDoMandei().resolver(t, por); }

/**
 * Pede de novo ao cliente as respostas marcadas, com o motivo de cada uma (11/11/2026): o ticket ganha o link da volta
 * (3 dias úteis) e o e-mail sai com ele. Devolve o ticket novo (o mesmo, se nada valeu).
 */
export async function pedirDeNovoAoCliente(t: m.Ticket, pedidos: { chave: string; motivo: string }[], por: string, agora = new Date()): Promise<m.Ticket> {
  const novo = m.pedirDeNovo(t, pedidos, por, codigoNovo(), agora);
  if (novo === t) return t;
  if (!await repoDoMandei().novoLink(t, novo)) throw new Error('O ticket mudou enquanto você revisava. Abra de novo e confira.');
  return novo;
}

/** O arquivo para baixar (no exemplo, guardado neste navegador; no banco, null: está no Drive). */
export function arquivoParaBaixar(a: m.ArquivoDoTicket): string | null { return repoDoMandei().arquivo(a); }

/** Os dados de exemplo (neste navegador): o e-mail não sai de verdade. */
export const mandeiNoExemplo = () => repoDoMandei().exemplo;

// ─── o ⚡ do modo desenvolvedor (Vitor, 07/10/2026): simular o caminho do ticket sem esperar os prazos ──────────
// Só nos dados de exemplo (no banco, o modo desenvolvedor não grava nada).

/** Um ticket de teste (empresa 9999, três itens), como se tivesse saído do Clientes › Envio. */
export function criarTicketDeTeste(por: string): Promise<m.Ticket> {
  return criarTicket({
    empresa: { nome: 'PERSONALY COMPANY', codigo: 9999 }, para: { nome: 'Cliente de teste', email: 'teste@exemplo.com' },
    assunto: 'Clientes em aberto — teste', mensagem: 'Ticket de teste do modo desenvolvedor: pode responder à vontade.',
    criadoPor: { nome: por }, origem: { titulo: 'Teste (modo desenvolvedor)', rota: '' },
    itens: [
      { id: 't1', titulo: 'MERCADO BOM PRECO LTDA', valor: 'R$ 1.250,40', detalhe: 'Não encontrei, onde está esse valor?', opcoes: m.OPCOES_PADRAO,
        linhas: [
          { data: '28/07/2026', nf: '9971', descricao: 'Venda a prazo', valor: 'R$ 839,33', tipo: 'nota' },
          { data: '25/08/2026', nf: '10111', descricao: 'Venda a prazo', valor: 'R$ 1.514,65', tipo: 'nota' },
          { data: '20/08/2026', nf: '—', descricao: 'TRANSFERENCIA PIX MERCADO BOM PRECO', valor: '−R$ 1.103,58', tipo: 'pagamento', conta: 'Banco Sicoob - 01' },
        ] },
      { id: 't2', titulo: 'CONSTRUTORA ALFA LTDA', valor: 'R$ 8.730,00', detalhe: 'Foi pago em dinheiro?', opcoes: m.OPCOES_PADRAO,
        linhas: [{ data: '05/08/2026', nf: '9971', descricao: 'Venda a prazo', valor: 'R$ 8.730,00', tipo: 'nota' }] },
      { id: 't3', titulo: 'PADARIA DO JOAO', valor: 'R$ 312,90', detalhe: 'No meu sistema, está em aberto: 10/07/2026 - NF 200 - R$ 312,90', opcoes: m.OPCOES_PADRAO,
        linhas: [
          { data: '10/07/2026', nf: '200', descricao: 'Venda a prazo (vendido R$ 500,00, recebido R$ 187,10)', valor: 'R$ 312,90', tipo: 'nota' },
          { data: '20/08/2026', nf: '—', descricao: 'TRANSFERENCIA PIX PADARIA DO JOAO', valor: '−R$ 50,00', tipo: 'pagamento', conta: 'Caixa Geral' },
        ] },
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
