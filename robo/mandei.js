// O e-mail do Mandei (nads, 11/11/2026: "liga ao banco"). A tela da Tarefa cria o ticket (tickets/{id}), o formulário
// do link (ticketsLinks/{código}) e põe o pedido na fila do vigia (solicitacoesEmail):
//   { tipo: 'mandei', status: 'pendente', ticket, link, numero, para, assunto, corpo, empresa, codigo, criadoEm, criadoPor,
//     criadoPorEmail, criadoPorUid, origem: 'nads' }
// Aqui (vigia-robo.js chama atenderMandei): confere o pedido contra o ticket (o link é o atual, o ticket não foi resolvido,
// o e-mail é o do ticket, o formulário existe), manda pela caixa do setor de quem pediu e marca no ticket, no link, quando
// enviou (enviadoEm, emailId) ou o erro (erroDoEmail). Sem registrar cobrança: o Mandei não é o Pedir extratos.
//
// A TRAVA (como a dos boletos, 10/11/2026): enquanto LIBERADO_PARA_CLIENTES for false, só sai para os endereços de INTERNOS
// (o teste com um e-mail do escritório antes de mandar para um cliente, docs/mandei/regras-do-banco.md). Liberar é mudar a
// constante, com o ok do escritório, e atualizar o robô.
const LIBERADO_PARA_CLIENTES = false;
const INTERNOS = ['nilmacontabilidade@gmail.com'];
const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;
const CODIGO = /^[A-Za-z0-9]{10,40}$/;

const texto = v => (typeof v === 'string' ? v : '');

/** Por que não mandar ('' = pode). p: o pedido; ticket: tickets/{id} (ou null); temLink: o formulário existe. */
function motivoParaNaoMandar(p, ticket, temLink, { liberado = LIBERADO_PARA_CLIENTES, internos = INTERNOS } = {}) {
  if (!p || !texto(p.ticket)) return 'pedido sem o ticket';
  if (!CODIGO.test(texto(p.link))) return 'pedido sem o código do link';
  if (!ticket) return 'o ticket ' + (p.numero || p.ticket) + ' não existe mais';
  if (ticket.resolvidoEm) return 'o ticket ' + (p.numero || '') + ' já foi resolvido';
  const links = Array.isArray(ticket.links) ? ticket.links : [];
  const atual = links[links.length - 1];
  if (!atual || atual.codigo !== p.link) return 'este link não é mais o atual do ticket (saiu outro depois)';
  if (!temLink) return 'o formulário do link não existe no banco';
  const para = texto(p.para).trim().toLowerCase();
  if (!EMAIL.test(para)) return 'e-mail inválido: ' + para;
  const doTicket = texto(ticket.para && ticket.para.email).trim().toLowerCase();
  if (para !== doTicket) return 'o e-mail do pedido (' + para + ') não é o do ticket (' + doTicket + ')';
  if (!texto(p.assunto).trim() || !texto(p.corpo).trim()) return 'pedido sem o assunto ou o texto';
  if (!liberado && !internos.includes(para)) {
    return 'o envio do Mandei aos clientes ainda não foi liberado (por enquanto só para ' + internos.join(', ') + '); não mandei para ' + para;
  }
  return '';
}

/** Os links do ticket com a marca do e-mail no link do pedido. */
function linksComEmail(links, codigo, marca) {
  return (Array.isArray(links) ? links : []).map(l => (l && l.codigo === codigo ? Object.assign({}, l, marca) : l));
}

/**
 * Atende um pedido. deps: { db, pedidoId, enviar(dados) -> gmailId, visual(p) -> { html?, imagens? }, agora() -> ISO, log }.
 * Devolve o que o vigia grava no pedido (status 'enviado'); dá erro com a frase para o pedido (o vigia grava 'erro').
 */
async function atenderMandei(p, deps) {
  const { db, pedidoId, enviar, visual, agora, log } = deps;
  const ref = db.collection('tickets').doc(texto(p.ticket) || '-');
  const marcar = async marca => {
    try {
      await db.runTransaction(async tx => {
        const s = await tx.get(ref);
        if (s.exists) tx.update(ref, { links: linksComEmail(s.data().links, p.link, marca) });
      });
    } catch (e) { log('Mandei: não marquei o ticket', p.ticket, '-', e.message); }
  };
  const s = await ref.get();
  const ticket = s.exists ? s.data() : null;
  const temLink = CODIGO.test(texto(p.link)) ? (await db.collection('ticketsLinks').doc(p.link).get()).exists : false;
  const motivo = motivoParaNaoMandar(p, ticket, temLink);
  if (motivo) {
    if (ticket) await marcar({ erroDoEmail: motivo, emailId: pedidoId });
    throw new Error(motivo);
  }
  const para = texto(p.para).trim().toLowerCase();
  let extra = {};
  try { extra = (await visual(p)) || {}; } catch (e) { log('Mandei: o e-mail sai só em texto -', e.message); }
  let gmailId;
  try {
    gmailId = await enviar(Object.assign({ para, assunto: texto(p.assunto), corpo: texto(p.corpo) }, extra));
  } catch (e) {
    await marcar({ erroDoEmail: e.message, emailId: pedidoId });
    throw e;
  }
  const em = agora();
  await marcar({ enviadoEm: em, emailId: pedidoId, erroDoEmail: null });
  log('Mandei: enviado', p.numero || p.ticket, 'para', para);
  return { status: 'enviado', enviadoEm: em, gmailId: String(gmailId || ''), para };
}

module.exports = { atenderMandei, motivoParaNaoMandar, linksComEmail, LIBERADO_PARA_CLIENTES, INTERNOS };
