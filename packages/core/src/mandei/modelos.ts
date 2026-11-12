// Os modelos de ticket (11/11/2026, no padrão do Karbon, do Canopy e do G-Click da Omie): o ticket avulso que a equipe
// manda da Central, sem sair de uma etapa da Tarefa — pedir os extratos do mês, o faturamento, os documentos de uma
// admissão ou uma pergunta livre. Cada item vira uma pergunta do formulário, com as respostas prontas do modelo; no
// pedido de documento, "Não tenho este mês" responde sem arquivo (o pedido mensal que às vezes não se aplica).
import type { DadosDoTicket, ItemDoTicket, Ticket } from './index';

/** As respostas do pedido de documento: manda o arquivo, não tem neste mês, ou explica. */
export const OPCOES_DE_DOCUMENTO = ['Envio o arquivo', 'Não tenho este mês', 'Outro (explico abaixo)'];
/** A pergunta livre: o cliente responde por escrito. */
export const OPCOES_DE_PERGUNTA = ['Respondo abaixo'];

export type TipoDoItemDoModelo = 'documento' | 'pergunta';

export interface ItemDoModelo { titulo: string; detalhe?: string; tipo: TipoDoItemDoModelo }

export interface ModeloDeTicket {
  id: string;
  nome: string;
  /** a linha de baixo no seletor */
  descricao: string;
  /** o pedido é de um mês (os extratos, o faturamento): o assunto e a mensagem levam a competência */
  mensal: boolean;
  assunto: string;
  mensagem: string;
  itens: ItemDoModelo[];
}

export const OPCOES_DO_TIPO: Record<TipoDoItemDoModelo, string[]> = { documento: OPCOES_DE_DOCUMENTO, pergunta: OPCOES_DE_PERGUNTA };
export const ROTULO_DO_TIPO_DO_ITEM: Record<TipoDoItemDoModelo, string> = { documento: 'Pedir arquivo', pergunta: 'Pergunta' };

/** {mes} vira a competência (08/2026). */
export const MODELOS_DE_TICKET: ModeloDeTicket[] = [
  {
    id: 'extratos', nome: 'Extratos do mês', descricao: 'Os extratos das contas, das aplicações e do cartão', mensal: true,
    assunto: 'Extratos de {mes}', mensagem: 'Para fecharmos {mes}, precisamos dos extratos abaixo. Se não tiver algum, é só marcar "Não tenho este mês".',
    itens: [
      { titulo: 'Extrato de todas as contas bancárias', detalhe: 'O mês inteiro, em PDF ou OFX.', tipo: 'documento' },
      { titulo: 'Extrato das aplicações e investimentos', tipo: 'documento' },
      { titulo: 'Fatura do cartão de crédito da empresa', tipo: 'documento' },
    ],
  },
  {
    id: 'faturamento', nome: 'Faturamento do mês', descricao: 'As notas emitidas e recebidas e as vendas no cartão', mensal: true,
    assunto: 'Faturamento de {mes}', mensagem: 'Para apurarmos os impostos de {mes}, precisamos do que está abaixo.',
    itens: [
      { titulo: 'Notas fiscais de serviço emitidas', tipo: 'documento' },
      { titulo: 'Notas de compra recebidas', tipo: 'documento' },
      { titulo: 'Relatório de vendas no cartão (maquininha)', tipo: 'documento' },
    ],
  },
  {
    id: 'admissao', nome: 'Documentos de admissão', descricao: 'O que precisamos para registrar um funcionário novo', mensal: false,
    assunto: 'Documentos para a admissão', mensagem: 'Para registrarmos o funcionário novo, precisamos dos documentos e das informações abaixo.',
    itens: [
      { titulo: 'Cargo, salário e data de início', detalhe: 'E o horário de trabalho.', tipo: 'pergunta' },
      { titulo: 'RG e CPF', tipo: 'documento' },
      { titulo: 'Carteira de Trabalho Digital', detalhe: 'Um print da tela do aplicativo serve.', tipo: 'documento' },
      { titulo: 'Comprovante de residência', tipo: 'documento' },
      { titulo: 'Exame admissional (ASO)', tipo: 'documento' },
    ],
  },
  {
    id: 'pergunta', nome: 'Pergunta livre', descricao: 'Uma pergunta que o cliente responde por escrito', mensal: false,
    assunto: 'Uma pergunta do escritório', mensagem: 'Pode nos responder a pergunta abaixo?',
    itens: [{ titulo: '', tipo: 'pergunta' }],
  },
];

/** 'aaaa-mm' → '08/2026' */
const mesBR = (competencia: string) => (/^\d{4}-\d{2}$/.test(competencia) ? competencia.slice(5, 7) + '/' + competencia.slice(0, 4) : '');
const comMes = (texto: string, competencia: string) => texto.split('{mes}').join(mesBR(competencia) || 'este mês');

/** O que a pessoa monta na Central: o modelo, a empresa, para quem, o mês e os itens (já editados). */
export interface TicketAvulso {
  modelo: ModeloDeTicket;
  empresa: Ticket['empresa'];
  para: Ticket['para'];
  criadoPor: Ticket['criadoPor'];
  /** 'aaaa-mm' (só nos modelos mensais) */
  competencia: string;
  assunto: string;
  mensagem: string;
  itens: ItemDoModelo[];
}

/** O rascunho do ticket avulso, com o assunto e a mensagem do modelo (o mês já no texto). */
export function avulsoDoModelo(modelo: ModeloDeTicket, base: Pick<TicketAvulso, 'empresa' | 'para' | 'criadoPor' | 'competencia'>): TicketAvulso {
  return { ...base, modelo, assunto: comMes(modelo.assunto, base.competencia), mensagem: comMes(modelo.mensagem, base.competencia), itens: modelo.itens.map(i => ({ ...i })) };
}

/** O que impede de mandar ('' = pode). */
export function erroDoAvulso(a: TicketAvulso): string {
  if (!a.empresa.nome.trim()) return 'Escolha a empresa.';
  if (!a.para.email.trim() && !a.para.whatsapp?.trim()) return 'A empresa não tem e-mail nem WhatsApp no Cadastro.';
  if (a.para.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.para.email.trim())) return 'O e-mail não parece certo.';
  if (a.modelo.mensal && !/^\d{4}-\d{2}$/.test(a.competencia)) return 'Escolha o mês.';
  if (!a.assunto.trim()) return 'Escreva o assunto.';
  const itens = a.itens.filter(i => i.titulo.trim());
  if (!itens.length) return 'Escreva ao menos um item.';
  return '';
}

/** Os dados do ticket (o que o novoTicket recebe): só os itens com título, cada um com as respostas do tipo dele. */
export function dadosDoAvulso(a: TicketAvulso): DadosDoTicket {
  const itens: ItemDoTicket[] = a.itens.filter(i => i.titulo.trim()).map((i, n) => ({
    id: 'i' + (n + 1), titulo: i.titulo.trim(), ...(i.detalhe?.trim() ? { detalhe: i.detalhe.trim() } : {}), opcoes: OPCOES_DO_TIPO[i.tipo],
  }));
  const mes = a.modelo.mensal ? mesBR(a.competencia) : '';
  return {
    empresa: a.empresa, para: { nome: a.para.nome.trim(), email: a.para.email.trim(), ...(a.para.whatsapp?.trim() ? { whatsapp: a.para.whatsapp.trim() } : {}) },
    assunto: a.assunto.trim(), mensagem: a.mensagem.trim(), criadoPor: a.criadoPor,
    origem: { titulo: a.modelo.nome + (mes ? ' · ' + mes : ''), rota: '', ...(a.modelo.mensal ? { competencia: a.competencia } : {}) },
    itens,
  };
}
