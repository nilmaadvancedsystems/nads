// "Pedir extratos" (Extrator na etapa Importação): o pedido ao cliente, com os bancos e as competências
// escolhidos, e as mensagens prontas. E-mail: o robô do Entregas monta o HTML (com a cara do escritório) a
// partir do texto — cada linha "- Extrato bancário …" vira um cartão. WhatsApp: texto, aberto pelo link wa.me.
// O contato (e-mails e telefone) vem do cadastro de clientes do Entregas.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Um banco do pedido: o nome e, se tiver, "Ag. 0500 · C/C 22222-2". */
export interface BancoDoPedido { nome: string; conta?: string }

export interface PedidoDeExtratos {
  /** o nome da empresa (cliente) */
  cliente: string;
  bancos: BancoDoPedido[];
  /** 'aaaa-mm' */
  competencias: string[];
}

export type CanalDoPedido = 'email' | 'whatsapp';

/** "agosto/2026" */
export function mesPorExtenso(c: string): string {
  return MESES[Number(c.slice(5, 7)) - 1] + '/' + c.slice(0, 4);
}

export function rotuloDoBanco(b: BancoDoPedido): string {
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
  return 'Extratos bancários de ' + competenciasPorExtenso(p.competencias) + ' - ' + p.cliente;
}

/**
 * O texto do pedido. No e-mail, cada banco numa linha "- Extrato bancário …" (o robô do Entregas transforma
 * em cartão, com o logo); no WhatsApp, com "•".
 */
export function textoDoPedido(p: PedidoDeExtratos, canal: CanalDoPedido): string {
  const meses = competenciasPorExtenso(p.competencias);
  const umSo = p.bancos.length === 1;
  if (canal === 'whatsapp') {
    return [
      'Olá! Aqui é da Nilma Contabilidade.',
      'Para fecharmos a contabilidade de ' + meses + ' da ' + p.cliente + ', precisamos ' + (umSo ? 'do extrato bancário:' : 'dos extratos bancários:'),
      ...p.bancos.map(b => '• ' + rotuloDoBanco(b)),
      'Pode mandar em PDF ou OFX, do mês inteiro, por aqui ou por e-mail. Obrigado!',
    ].join('\n');
  }
  return [
    'Olá,',
    '',
    'Para fecharmos a contabilidade de ' + meses + ' da ' + p.cliente + ', precisamos ' + (umSo ? 'do extrato bancário abaixo:' : 'dos extratos bancários abaixo:'),
    '',
    ...p.bancos.map(b => '- Extrato bancário ' + rotuloDoBanco(b) + ' - ' + meses),
    '',
    'Pode responder este e-mail com os arquivos em anexo (PDF ou OFX, do mês inteiro, do primeiro ao último dia)? Assim que chegarem, o recebimento é registrado automaticamente.',
    '',
    'Obrigado,',
    'Nilma Contabilidade',
  ].join('\n');
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
