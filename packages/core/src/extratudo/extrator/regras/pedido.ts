// "Pedir extratos" (Extrator na etapa Importação): o pedido de documentos ao cliente — os documentos e as
// competências escolhidos, o prazo e as mensagens. E-mail (obrigatório: é a relação formal): o HTML montado
// sozinho (regras/email.ts) e o texto que vai junto; WhatsApp (opcional): a mensagem que a pessoa digita,
// aberta pelo link wa.me. O contato (e-mails e telefone) vem do cadastro de clientes do Entregas.
import type { EmpresaExtrator, PedidoRegistrado } from '../tipos';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Um documento do pedido: o nome, a explicação curta e, no extrato, o banco (para o logo). */
export interface DocumentoDoPedido {
  id: string;
  nome: string;
  detalhe: string;
  /** a marca do banco (o logo no e-mail) */
  banco?: string;
  /** as competências deste documento, quando o pedido tem mais de uma ('aaaa-mm') */
  competencias?: string[];
}

/** "Extrato bancário · Sicoob (julho e agosto/2026)" quando o documento vale para mais de uma competência. */
export function nomeComCompetencias(d: DocumentoDoPedido, p: PedidoDeExtratos): string {
  return d.competencias && new Set(p.competencias).size > 1 ? d.nome + ' (' + competenciasPorExtenso(d.competencias) + ')' : d.nome;
}

/** Um banco da empresa: o nome e, se tiver, "Ag. 0500 · C/C 22222-2". */
export interface BancoDoPedido { id: string; nome: string; marca?: string; conta?: string }

export interface PedidoDeExtratos {
  /** o nome da empresa (cliente) */
  cliente: string;
  documentos: DocumentoDoPedido[];
  /** 'aaaa-mm' */
  competencias: string[];
}

export type CanalDoPedido = 'email' | 'whatsapp';

/** Os documentos que dá para pedir: o extrato de cada banco da empresa e os de sempre. */
export function documentosDoPedido(bancos: readonly BancoDoPedido[]): DocumentoDoPedido[] {
  return [
    ...bancos.map(b => ({
      id: 'extrato:' + b.id, nome: 'Extrato bancário · ' + b.nome + (b.conta ? ' (' + b.conta + ')' : ''),
      detalhe: 'Do primeiro ao último dia do mês, em PDF ou OFX.', banco: b.marca || b.id,
    })),
    { id: 'comprovantes', nome: 'Comprovantes bancários', detalhe: 'Dos pagamentos e transferências feitos no mês.' },
    { id: 'cartao', nome: 'Cartão de crédito empresarial', detalhe: 'A fatura ou o relatório do cartão do mês.' },
    { id: 'cred', nome: 'CRED Liquidação', detalhe: 'O relatório de liquidação do mês inteiro.' },
    { id: 'aplicacao', nome: 'Extrato de aplicação', detalhe: 'Das aplicações e investimentos do mês.' },
  ];
}

/** "agosto/2026" */
export function mesPorExtenso(c: string): string {
  return MESES[Number(c.slice(5, 7)) - 1] + '/' + c.slice(0, 4);
}

/** "30 de setembro de 2026" */
export function dataPorExtenso(d: Date): string {
  return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
}

/** O prazo que já vem na tela: daqui a 7 dias ('dd/mm/aaaa'). */
export function prazoPadrao(agora: Date): string {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 7);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

export function rotuloDoBanco(b: { nome: string; conta?: string }): string {
  return b.nome + (b.conta ? ' (' + b.conta + ')' : '');
}

/** "agosto/2026", "julho e agosto/2026", "junho, julho e agosto/2026" (anos diferentes: cada um com o seu). */
export function competenciasPorExtenso(competencias: string[]): string {
  const cs = [...new Set(competencias)].sort();
  if (!cs.length) return '';
  const mesmoAno = cs.every(c => c.slice(0, 4) === cs[0].slice(0, 4));
  const nomes = cs.map(c => (mesmoAno ? MESES[Number(c.slice(5, 7)) - 1] : mesPorExtenso(c)));
  const lista = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  return mesmoAno ? lista + '/' + cs[0].slice(0, 4) : lista;
}

/** A competência que o pedido registra no Entregas (uma só por e-mail): a mais nova. */
export function competenciaDoPedido(p: PedidoDeExtratos): string {
  return [...p.competencias].sort().pop() || '';
}

/** O assunto do e-mail. */
export function assuntoDoPedido(p: PedidoDeExtratos): string {
  return 'Documentos de ' + competenciasPorExtenso(p.competencias) + ' - ' + p.cliente;
}

/**
 * O texto do e-mail (vai junto do HTML, para quem não abre HTML; o robô do Entregas também usa: cada linha
 * "- …" vira um cartão).
 */
export function textoDoPedido(p: PedidoDeExtratos, prazo: string): string {
  return [
    'Olá, tudo bem?',
    '',
    'Viemos através deste e-mail pedir a relação de documentos para o fechamento contábil do período de ' + competenciasPorExtenso(p.competencias) + '.',
    '',
    'O que precisamos:',
    ...p.documentos.map(d => '- ' + nomeComCompetencias(d, p)),
    '',
    ...(prazo ? ['Prazo: até ' + prazo + '.', ''] : []),
    'Responda este e-mail com os arquivos em anexo: PDF, OFX, planilha.',
    '',
    'Obrigado,',
    'Nilma Contabilidade',
  ].join('\n');
}

/** A mensagem do WhatsApp que já vem escrita (a pessoa muda à vontade). */
export function textoDoWhatsApp(p: PedidoDeExtratos, prazo: string): string {
  return [
    'Olá! Aqui é da Nilma Contabilidade.',
    'Mandamos por e-mail a relação de documentos para o fechamento de ' + competenciasPorExtenso(p.competencias) + ' da ' + p.cliente + ':',
    ...p.documentos.map(d => '• ' + nomeComCompetencias(d, p)),
    ...(prazo ? ['Prazo: até ' + prazo + '.'] : []),
    'Pode responder o e-mail com os arquivos. Obrigado!',
  ].join('\n');
}

/** Guarda o pedido no histórico da empresa (o mais novo primeiro) e na auditoria. */
export function registrarPedido(e: EmpresaExtrator, reg: PedidoRegistrado): EmpresaExtrator {
  const canais = [reg.email ? 'e-mail' : '', reg.whatsapp ? 'WhatsApp' : ''].filter(Boolean).join(' e ');
  return {
    ...e,
    pedidos: [reg, ...(e.pedidos || [])],
    auditoria: [{ ts: reg.em, acao: 'Pediu documentos', detalhe: reg.documentos.length + ' documento(s) de ' + competenciasPorExtenso(reg.competencias) + ' por ' + canais, tom: 'neutral' }, ...e.auditoria],
  };
}

/** O telefone do cadastro no formato do wa.me (só dígitos, com o 55); '' se não der para usar. */
export function telefoneParaWhatsApp(telefone: string): string {
  const d = (telefone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  return '';
}

/** O link que abre o WhatsApp com a mensagem pronta (a pessoa confere e envia de lá). */
export function linkDoWhatsApp(telefone: string, texto: string): string {
  return 'https://wa.me/' + telefoneParaWhatsApp(telefone) + '?text=' + encodeURIComponent(texto);
}
