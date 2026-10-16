// A NFS-e autorizada por e-mail ao cliente (15/10/2026), ligado pelo nfse.js. Dois caminhos:
//
//   automático — quando a nota fica 'autorizada' e o admin ligou config/nfse.email.automatico: UM e-mail para o e-mail do
//                tomador que está na nota, com a DANFSe (PDF) e o XML. Nunca duas vezes: a nota ganha o campo `email`
//                (numa transação, antes de mandar) e o automático só age em nota sem `email`. Homologação e cancelada
//                não vão no automático.
//   manual     — o nads grava nfseEmissoes/{id}.envioEmail { para, pedidoPor, pedidoEm } (Enviar por e-mail, na janela
//                da nota): o robô manda para esse endereço (homologação pode, com o aviso "sem valor fiscal"), grava
//                `email` e apaga `envioEmail`.
//
// O que fica na nota: email { para, enviadoEm, erro } (+ pedidoPor no manual; enviandoEm enquanto sai).
// O PDF é o mesmo do botão "Baixar DANFSe" do nads: robo/gerado/danfse.js (scripts/robo-danfse.mjs), com o texto do
// e-mail do core (mensagemDaNota). Sai pela caixa do robô (o `correio` do vigia-robo), com o freio por hora de lá.
const { htmlDaNfse } = require('./email-html');

let gerado = null;
/** o pacote gerado (467 KB): só carrega quando vai mandar */
const pacote = () => gerado || (gerado = require('./gerado/danfse'));

const TRAVA_MS = 10 * 60 * 1000;
const DE_NOVO_MS = 10 * 60 * 1000;
const agora = () => new Date().toISOString();
const ambienteDa = p => (p && p.dps && p.dps.ambiente) || (p && p.ambiente) || 'homologacao';
const soDigitos = v => String(v == null ? '' : v).replace(/\D/g, '');

const nomeDoPdf = numero => 'DANFSe-' + (soDigitos(numero) || 'nota') + '.pdf';
const nomeDoXml = chave => 'NFSe-' + (soDigitos(chave) || 'nota') + '.xml';

/** Por que o automático NÃO manda esta nota ('' = manda). Puro. */
function motivoParaNaoMandar(p, cfgEmail) {
  if (!cfgEmail || cfgEmail.automatico !== true) return 'o envio automático está desligado';
  if (!p) return 'a nota não existe';
  if (p.email) return 'a nota já foi tratada';
  if (p.status !== 'autorizada') return 'a nota não está autorizada';
  if (ambienteDa(p) === 'homologacao') return 'nota de homologação';
  if (!p.xmlNfse) return 'a nota não tem o XML';
  return '';
}

/** O e-mail pronto para o correio: { assunto, corpo, html, imagens, anexos } (DANFSe em PDF + XML). */
async function montarEmailDaNota(p, cfgEmail, extra = {}) {
  const g = pacote();
  const nota = { tomador: p.tomador || { nome: '' }, numeroNfse: String(p.numeroNfse || ''), servico: p.servico || { valor: 0, competencia: '' }, ambiente: ambienteDa(p) };
  const m = g.mensagemDaNota(nota, g.configDoEmail(cfgEmail));
  const campos = g.camposDaNota(nota);
  const pdf = Buffer.from(await g.pdfDaDanfse(p.xmlNfse));
  const anexos = [
    { nome: nomeDoPdf(p.numeroNfse), mime: 'application/pdf', buffer: pdf },
    { nome: nomeDoXml(p.chaveAcesso), mime: 'application/xml', buffer: Buffer.from(String(p.xmlNfse), 'utf8') },
  ];
  const semValor = nota.ambiente === 'homologacao';
  const visual = htmlDaNfse({
    assunto: m.assunto, texto: semValor ? m.texto.replace(g.AVISO_SEM_VALOR, '').trim() : m.texto, semValor,
    cliente: campos.cliente, numero: campos.numero, valor: campos.valor, competencia: campos.competencia, chave: String(p.chaveAcesso || ''),
    anexos: anexos.map(a => ({ nome: a.nome, tamanho: a.buffer.length })), caixa: extra.caixa || '',
  });
  return { assunto: m.assunto, corpo: m.texto, html: visual.html, imagens: visual.imagens, anexos };
}

const textoDoErro = err => String((err && err.message) || err || 'erro').replace(/\s+/g, ' ').slice(0, 300);

/**
 * O envio, para o nfse.js: { automatico(id), manual(id) }. Cada um é uma tarefa da fila do nfse.js (um por vez).
 * correio: { enviar(dados), podeEnviar(n), contar(), endereco?() } — sem ele, o envio fica desligado.
 * configEmail(): a config/nfse.email de agora (async). deNovo(tipo, id): põe a tarefa de volta na fila mais tarde.
 */
function criarEnvioDeEmail({ db, log, correio, emissoes, configEmail, deNovo, FieldValue }) {
  const enderecoDoRobo = async () => { try { return correio && correio.endereco ? await correio.endereco() : ''; } catch (e) { return ''; } };
  const adiar = (tipo, id) => { const t = setTimeout(() => deNovo(tipo, id), DE_NOVO_MS); if (t.unref) t.unref(); };

  async function mandar(p, para, cfgEmail) {
    const msg = await montarEmailDaNota(p, cfgEmail, { caixa: await enderecoDoRobo() });
    await correio.enviar({ para, assunto: msg.assunto, corpo: msg.corpo, html: msg.html, imagens: msg.imagens, anexos: msg.anexos });
    correio.contar();
  }

  async function automatico(id) {
    if (!correio) return;
    const cfg = await configEmail();
    if (!cfg.automatico) return;
    const ref = emissoes.doc(id);
    if (!correio.podeEnviar(1)) {
      const s = await ref.get();
      if (!motivoParaNaoMandar(s.exists ? s.data() : null, cfg)) { log('NFS-e: e-mail da nota no freio por hora, tento de novo em', DE_NOVO_MS / 60000, 'min'); adiar('email', id); }
      return;
    }
    // a trava: grava `email` antes de mandar; quem achar a nota com `email` não manda
    const p = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      const d = s.exists ? s.data() : null;
      if (motivoParaNaoMandar(d, cfg)) return null;
      const para = String((d.tomador && d.tomador.email) || '').trim();
      if (!pacote().emailValido(para)) {
        tx.update(ref, { email: { para, enviadoEm: '', erro: 'a nota não tem um e-mail válido do tomador: use Enviar por e-mail na nota' } });
        return null;
      }
      tx.update(ref, { email: { para, enviadoEm: '', erro: '', enviandoEm: agora() } });
      return Object.assign({}, d, { para });
    });
    if (!p) return;
    try {
      await mandar(p, p.para, cfg);
      await ref.update({ email: { para: p.para, enviadoEm: agora(), erro: '' } });
      log('NFS-e: nota', p.numeroNfse, 'enviada por e-mail ao tomador (automático)');
    } catch (err) {
      // não tenta de novo sozinho (o Gmail pode ter mandado e só a resposta se perdeu): fica o erro, e a nota pode ir pelo manual
      await ref.update({ email: { para: p.para, enviadoEm: '', erro: 'não consegui mandar: ' + textoDoErro(err) } }).catch(() => {});
      log('NFS-e: e-mail da nota', p.numeroNfse, 'não saiu:', textoDoErro(err));
    }
  }

  async function manual(id) {
    if (!correio) return;
    const ref = emissoes.doc(id);
    const p = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      const d = s.exists ? s.data() : null;
      const e = d && d.envioEmail;
      if (!e || typeof e !== 'object') return null;
      if (e.enviandoEm && Date.now() - Date.parse(e.enviandoEm) < TRAVA_MS) return null;
      tx.update(ref, { 'envioEmail.enviandoEm': agora() });
      return d;
    });
    if (!p) return;
    const e = p.envioEmail;
    const para = String(e.para || '').trim();
    const pedidoPor = String(e.pedidoPor || '');
    const fim = email => ref.update({ email: Object.assign({ para, enviadoEm: '', erro: '' }, email, pedidoPor ? { pedidoPor } : {}), envioEmail: FieldValue.delete() });
    if (!pacote().emailValido(para)) { await fim({ erro: 'o endereço não parece um e-mail' }); return; }
    if (p.status !== 'autorizada') { await fim({ erro: 'só dá para mandar nota autorizada' }); return; }
    if (!p.xmlNfse) { await fim({ erro: 'a nota não tem o XML' }); return; }
    if (!correio.podeEnviar(1)) {
      await ref.update({ 'envioEmail.enviandoEm': FieldValue.delete() }).catch(() => {});
      log('NFS-e: e-mail pedido da nota no freio por hora, tento de novo em', DE_NOVO_MS / 60000, 'min');
      adiar('email-manual', id);
      return;
    }
    try {
      await mandar(p, para, await configEmail());
      await fim({ enviadoEm: agora() });
      log('NFS-e: nota', p.numeroNfse, 'enviada por e-mail (pedido por ' + pedidoPor + ')');
    } catch (err) {
      await fim({ erro: 'não consegui mandar: ' + textoDoErro(err) }).catch(() => {});
      log('NFS-e: e-mail pedido da nota', p.numeroNfse, 'não saiu:', textoDoErro(err));
    }
  }

  return { automatico, manual };
}

module.exports = { criarEnvioDeEmail, montarEmailDaNota, motivoParaNaoMandar, nomeDoPdf, nomeDoXml };
