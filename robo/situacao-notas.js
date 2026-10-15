// A situação das notas na SEFAZ (15/10/2026: "quero que verifique o cupom ou nfce via vm para ter o feedback do status da
// nota"). As páginas de consulta pública da SEFAZ têm captcha (o robô não resolve captcha); quem dá a situação sem
// captcha é o serviço oficial de consulta pela chave (NFeConsultaProtocolo 4.00 e CTeConsultaV4), com o certificado do
// escritório — o mesmo do FGTS e da NFS-e (fgts_certificado.pfx + .senha, gravados pelo nuvem/iniciar-maquina.sh).
//
// O contrato com o nads (banco do Entregas):
//   pedidosSituacao/{id} — o fiscal cria { status: 'pendente', codigo, competencia, criadoEm, criadoPor, criadoPorUid };
//                          o robô pega as notas emitidas do mês (siegNotas/{codigo}_{AAAA-MM}: NF-e, NFC-e e CT-e), consulta
//                          uma a uma e grava no próprio pedido o andamento (feitas/total) e o resultado: a contagem por
//                          situação e as que não batem com o SIEG (cancelada lá e autorizada aqui, denegada, não encontrada).
//   robo/situacao        — { ligado, motivo, certificado: { titular, validade } | null, atualizadoEm }.
//
// Consulta só o que a MG autoriza (cUF 31) e os estados do SVRS; os outros ficam como "outro estado". Uma nota a cada
// ~300 ms; parar no 656 (consumo indevido: a SEFAZ bloqueia por uma hora quem consulta demais). Um pedido por vez.
const https = require('https');
const { ouvir } = require('./ouvinte');
const { lerCertificadoComChave } = require('./nfse');

/** Os endereços de produção (as SEFAZ autorizadoras). */
const MG = {
  nfe: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  nfce: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  cte: 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
};
const SVRS = {
  nfe: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  nfce: 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  cte: 'https://cte.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
};
/** Os estados que autorizam pelo SVRS (código IBGE da UF, os 2 primeiros dígitos da chave). */
const UFS_DO_SVRS = new Set(['11', '12', '14', '15', '16', '17', '24', '25', '27', '28', '32', '33', '42', '53']);
const ESPERA_MS = 300;

/** O tipo da chave pelo modelo (posições 21–22): 55 NF-e, 65 NFC-e, 57 CT-e. */
function tipoDaChave(chave) {
  const m = String(chave).slice(20, 22);
  return m === '65' ? 'nfce' : m === '57' ? 'cte' : m === '55' ? 'nfe' : '';
}

/** O endereço para a chave (vazio = estado que o robô não consulta). */
function enderecoDaChave(chave) {
  const tipo = tipoDaChave(chave);
  if (!tipo) return '';
  const uf = String(chave).slice(0, 2);
  if (uf === '31') return MG[tipo];
  if (UFS_DO_SVRS.has(uf)) return SVRS[tipo];
  return '';
}

/** O envelope SOAP 1.2 da consulta pela chave. */
function envelope(chave) {
  const tipo = tipoDaChave(chave);
  const corpo = tipo === 'cte'
    ? '<cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4"><consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00"><tpAmb>1</tpAmb><xServ>CONSULTAR</xServ><chCTe>' + chave + '</chCTe></consSitCTe></cteDadosMsg>'
    : '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>1</tpAmb><xServ>CONSULTAR</xServ><chNFe>' + chave + '</chNFe></consSitNFe></nfeDadosMsg>';
  return '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>' + corpo + '</soap12:Body></soap12:Envelope>';
}

/**
 * A situação pela resposta: o cStat do retorno (e o do protocolo e dos eventos). 100/150 autorizada; 101/151/155 ou um
 * evento de cancelamento (110111) registrado = cancelada; 110/301/302/303 denegada; 217 não consta na SEFAZ; 656 consumo
 * indevido (para tudo). O resto é erro, com o motivo da SEFAZ.
 */
function situacaoDaResposta(xml) {
  const tags = nome => [...String(xml).matchAll(new RegExp('<(?:\\w+:)?' + nome + '>([^<]*)</(?:\\w+:)?' + nome + '>', 'g'))].map(m => m[1]);
  const cStats = tags('cStat');
  const motivo = tags('xMotivo')[0] || '';
  const ret = cStats[0] || '';
  const cancelEvento = /<(?:\w+:)?tpEvento>110111</.test(xml) && cStats.some(c => c === '135' || c === '136' || c === '155');
  if (ret === '656') return { situacao: 'bloqueado', cStat: ret, motivo };
  if (['101', '151', '155'].includes(ret) || cancelEvento) return { situacao: 'cancelada', cStat: ret, motivo };
  if (['110', '301', '302', '303'].includes(ret)) return { situacao: 'denegada', cStat: ret, motivo };
  if (['100', '150'].includes(ret)) return { situacao: 'autorizada', cStat: ret, motivo };
  if (ret === '217') return { situacao: 'nao-encontrada', cStat: ret, motivo };
  return { situacao: 'erro', cStat: ret, motivo: motivo || 'resposta sem situação' };
}

function consultar(chave, cert) {
  const url = new URL(enderecoDaChave(chave));
  const corpo = envelope(chave);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST', key: cert.chavePem, cert: cert.certPem, timeout: 30000,
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo) },
    }, res => {
      let t = '';
      res.setEncoding('utf8');
      res.on('data', c => { t += c; });
      res.on('end', () => resolve(t));
    });
    req.on('timeout', () => req.destroy(new Error('a SEFAZ não respondeu em 30 s')));
    req.on('error', reject);
    req.end(corpo);
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));
const agora = () => new Date().toISOString();

function iniciarSituacaoDasNotas(db, log) {
  const estadoRef = db.collection('robo').doc('situacao');
  const marcar = d => estadoRef.set(Object.assign({ atualizadoEm: agora() }, d), { merge: true }).catch(() => {});
  let cert = null;
  let certLidoEm = 0;
  const certificado = () => {
    // relê a cada hora (o certificado pode ser trocado pelos metadados sem reiniciar a máquina)
    if (!cert || Date.now() - certLidoEm > 60 * 60 * 1000) { cert = lerCertificadoComChave(); certLidoEm = Date.now(); }
    return cert;
  };
  const c0 = certificado();
  marcar(c0.erro ? { ligado: false, motivo: c0.erro, certificado: null }
    : { ligado: true, motivo: '', certificado: { titular: c0.titular || '', validade: c0.validade ? new Date(c0.validade).toISOString().slice(0, 10) : '' } });
  log('situação das notas: ' + (c0.erro ? 'desligada (' + c0.erro + ')' : 'ligada'));

  const fila = [];
  let ocupado = false;
  async function proximo() {
    if (ocupado || !fila.length) return;
    ocupado = true;
    const doc = fila.shift();
    try { await atender(doc); } catch (err) {
      log('situação das notas: erro', err.message);
      await doc.ref.update({ status: 'erro', erro: String(err.message).slice(0, 300), fimEm: agora() }).catch(() => {});
    }
    ocupado = false;
    proximo();
  }
  ouvir('pedidos da situação das notas', () => db.collection('pedidosSituacao').where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) if (ch.type === 'added' && !fila.some(d => d.id === ch.doc.id)) fila.push(ch.doc);
    proximo();
  }, log);

  async function atender(doc) {
    const p = doc.data();
    const c = certificado();
    if (c.erro) { await doc.ref.update({ status: 'erro', erro: c.erro, fimEm: agora() }); return; }
    const codigo = String(p.codigo || '').replace(/\D/g, '');
    if (!codigo || !/^\d{4}-\d{2}$/.test(String(p.competencia || ''))) { await doc.ref.update({ status: 'erro', erro: 'pedido sem empresa ou competência', fimEm: agora() }); return; }
    const notasDoc = await db.collection('siegNotas').doc(codigo + '_' + p.competencia).get();
    const emitidas = ((notasDoc.data() || {}).emitidas || []).filter(n => /^\d{44}$/.test(String(n.chave || '')) && tipoDaChave(n.chave));
    if (!emitidas.length) {
      await doc.ref.update({ status: 'erro', erro: 'não há NF-e, NFC-e ou CT-e do mês no nads: baixe os XMLs do SIEG (ou solte os XMLs de saída) e peça de novo', fimEm: agora() });
      return;
    }
    await doc.ref.update({ status: 'processando', inicioEm: agora(), feitas: 0, total: emitidas.length });
    const contagem = { autorizada: 0, cancelada: 0, denegada: 0, 'nao-encontrada': 0, erro: 0, 'outro-estado': 0 };
    const divergentes = [];
    let bloqueado = '';
    for (let i = 0; i < emitidas.length; i++) {
      const n = emitidas[i];
      let r;
      if (!enderecoDaChave(n.chave)) r = { situacao: 'outro-estado', cStat: '', motivo: 'estado que o robô ainda não consulta' };
      else {
        try { r = situacaoDaResposta(await consultar(n.chave, c)); } catch (err) { r = { situacao: 'erro', cStat: '', motivo: String(err.message).slice(0, 120) }; }
        await dormir(ESPERA_MS);
      }
      if (r.situacao === 'bloqueado') { bloqueado = r.motivo || 'consumo indevido'; break; }
      contagem[r.situacao] = (contagem[r.situacao] || 0) + 1;
      const noSieg = n.cancelada ? 'cancelada' : 'autorizada';
      if (r.situacao !== 'outro-estado' && r.situacao !== noSieg) {
        divergentes.push({ chave: n.chave, tipo: n.tipo || '', numero: String(n.numero || ''), serie: String(n.serie || ''), valor: Number(n.valor) || 0, sieg: noSieg, sefaz: r.situacao, cStat: r.cStat, motivo: String(r.motivo || '').slice(0, 160) });
      }
      if (i % 20 === 19) await doc.ref.update({ feitas: i + 1, andamento: 'consultadas ' + (i + 1) + ' de ' + emitidas.length }).catch(() => {});
    }
    const feitas = Object.values(contagem).reduce((a, b) => a + b, 0);
    await doc.ref.update({
      status: bloqueado ? 'erro' : 'concluido', fimEm: agora(), feitas, total: emitidas.length,
      ...(bloqueado ? { erro: 'a SEFAZ pediu para esperar (consumo indevido: ' + bloqueado + '); tente de novo daqui a uma hora' } : {}),
      resultado: { contagem, divergentes: divergentes.slice(0, 300), maisDivergentes: Math.max(0, divergentes.length - 300) },
    });
    log('situação das notas:', codigo, p.competencia, feitas + '/' + emitidas.length, 'consultadas,', divergentes.length, 'divergentes' + (bloqueado ? ' (parou no 656)' : ''));
  }
}

module.exports = { iniciarSituacaoDasNotas, situacaoDaResposta, enderecoDaChave, tipoDaChave, envelope };
