// Os XMLs de nota que chegam por e-mail (Vitor, 08/10/2026: "2" — "o robô do Gmail já lê os anexos: quando o cliente
// mandar XML ou .zip de notas, faz sozinho o mesmo que o botão XMLs do cliente"). Chamado pelo download-attachments.js
// depois de decidir de qual cliente é o e-mail: separa os XMLs (soltos ou dentro de .zip), agrupa pelo mês da nota e
// cria o pedido xmlsCliente (os pedaços em pedidosSieg/{id}/xmls, o mesmo formato do nads). O robô do PC (sieg.js) fica
// com os do cliente, lança no nads e salva no Drive só os novos. O id do pedido é o do e-mail e do mês: o mesmo e-mail
// lido de novo não manda duas vezes.
const sx = require('./sieg-xmls');

const soDigitos = v => String(v || '').replace(/\D/g, '');
const codigoDe = x => soDigitos(x && (x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem));
const PEDACO = 350000;

/** O texto do XML (UTF-8, ou ISO-8859-1 quando o próprio XML diz). */
function texto(buf) {
  const t = buf.toString('utf8');
  return /encoding=["']ISO-8859-1["']/i.test(t.slice(0, 200)) ? buf.toString('latin1') : t;
}

/** Os XMLs de nota ou evento dos anexos (.xml e .zip). */
function xmlsDosAnexos(anexos) {
  const { lerZip } = require('./sieg');
  const xmls = [];
  for (const a of anexos) {
    if (!a.buffer || !a.filename) continue;
    try {
      if (/\.zip$/i.test(a.filename)) { for (const t of lerZip(a.buffer)) if (sx.tipoDoXml(t)) xmls.push(t); }
      else if (/\.xml$/i.test(a.filename)) { const t = texto(a.buffer); if (sx.tipoDoXml(t)) xmls.push(t); }
    } catch (_) { /* .zip quebrado: fica de fora */ }
  }
  return [...new Set(xmls)];
}

/** O mês da nota (dd/mm/aaaa → aaaa-mm); o evento vai com a nota dele (o AAMM da chave); sem nada, o mês do e-mail. */
function mesDaNota(x, padrao) {
  const r = sx.resumoDaNota(x);
  const m = r && r.data && /^\d{2}\/(\d{2})\/(\d{4})$/.exec(r.data);
  if (m) return m[2] + '-' + m[1];
  const ch = /<(?:\w+:)?ch(?:NFe|CTe)>(\d{44})</.exec(x);
  return ch ? '20' + ch[1].slice(2, 4) + '-' + ch[1].slice(4, 6) : padrao;
}

/** Cria os pedidos (um por mês) e devolve quantos XMLs foram mandados. */
async function mandarXmlsDoEmail({ db, cliente, anexos, mensagemId, competencia, simular, log }) {
  const codigo = codigoDe(cliente);
  if (!codigo || !soDigitos(cliente.documento)) return 0;
  const xmls = xmlsDosAnexos(anexos);
  if (!xmls.length) return 0;
  const porMes = new Map();
  for (const x of xmls) {
    const mes = mesDaNota(x, competencia);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(x);
  }
  let mandados = 0;
  for (const [mes, lista] of porMes) {
    const ref = db.collection('pedidosSieg').doc('gmail_' + mensagemId + '_' + mes);
    if ((await ref.get()).exists) continue;
    if (simular) { if (log) log('XMLs do e-mail (simulado): ' + lista.length + ' de ' + mes); continue; }
    const t = JSON.stringify(lista);
    let n = 0;
    for (let i = 0; i < t.length; i += PEDACO) {
      n++;
      await ref.collection('xmls').doc(String(n).padStart(3, '0')).set({ n, dados: t.slice(i, i + PEDACO) });
    }
    await ref.set({ status: 'pendente', tipo: 'xmlsCliente', codigo, competencia: mes, criadoEm: new Date().toISOString(),
      criadoPor: 'Robô do Gmail', criadoPorUid: 'robo', partes: n, mensagemId });
    mandados += lista.length;
    if (log) log('XMLs do e-mail: ' + lista.length + ' de ' + mes + ' para o nads');
  }
  return mandados;
}

module.exports = { mandarXmlsDoEmail, xmlsDosAnexos, mesDaNota };
