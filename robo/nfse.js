// A NFS-e dos honorários do escritório (15/10/2026). A Nilma Contabilidade é a PRESTADORA; os clientes são os tomadores.
// Taiobeiras/MG (IBGE 3168002) usa o sistema da E&L no padrão DPS da NFS-e Nacional: o robô monta a DPS, assina com o
// certificado e-CNPJ do escritório (o mesmo do FGTS: fgts_certificado.pfx + .senha, gravados pelo nuvem/iniciar-maquina.sh),
// compacta (gzip + base64) e manda pela API da E&L com o token que o escritório gera no portal da prefeitura.
//
// O contrato com o nads (banco do Entregas):
//   config/nfse     — o admin edita; o robô lê e só incrementa proximoNumero[ambiente] (numa transação):
//                     { ambiente, prestador: { cnpj, opSimpNac, regApTribSN?, regEspTrib, cLocEmi }, servico: { cTribNac,
//                       cIntContrib, cNBS, pAliq, tribISSQN, tpRetISSQN, infoCompl? }, serie, proximoNumero: { homologacao, producao } }
//   segredos/nfse   — { token, tokenHomologacao? }: só o robô lê. O token NUNCA vai para log, erro ou outro documento.
//   nfseEmissoes/{id} — uma nota por documento. O nads cria com status 'pedida'; o robô leva a 'enviando' → 'processando'
//                     → 'autorizada' | 'erro'. Reenvio: o nads volta para 'pedida' um documento que já tem dps → mesmo idDPS e
//                     número (a E&L aceita a mesma DPS corrigida com o mesmo id; antes de reenviar o robô consulta, para não
//                     duplicar uma nota que já saiu). Cancelamento: status 'cancelamento-pedido' + cancelamento { cMotivo,
//                     motivo } → 'cancelada' | 'erro-cancelamento'.
//   robo/nfse       — o estado do módulo para a tela: { ligado, motivo, certificado: { titular, validade } | null, atualizadoEm }.
//
// A estrutura da DPS segue a nota REAL que a prefeitura autorizou pelo portal em 14/10/2026 (a DPS dentro de NFSe/infNFSe):
// prest só com CNPJ e regTrib (sem IM, que tem barra, e sem fone), cServ com cTribNac/xDescServ/cNBS/cIntContrib, infoCompl
// com o percentual do IBPT, tribMun com pAliq e totTrib com indTotTrib 0. Sem PIS/COFINS/retenções e sem IBSCBS por enquanto.
// O portal usa a série 70000 (numeração própria); a API usa config/nfse.serie (padrão '1') para não colidir.
//
// Só roda na máquina do Google (é onde está o certificado do escritório). Um pedido por vez.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ouvir } = require('./ouvinte');

// As URLs da E&L para Taiobeiras (passadas pela prefeitura). Produção não tem o segmento do ambiente, como no envio.
const BASE_EL = 'https://mg-taiobeiras-pm-nfs-backend.cloud.el.com.br/producao17/api/nacional';
const URLS = {
  homologacao: BASE_EL + '/homologacao',
  producao: BASE_EL,
};
const ENDERECOS = {
  envio: amb => URLS[amb] + '/nfse',
  consultaDps: (amb, idDps) => URLS[amb] + '/nfseDps/' + encodeURIComponent(idDps),
  nota: (amb, chave) => URLS[amb] + '/nfse/' + encodeURIComponent(chave),
  eventos: (amb, chave) => URLS[amb] + '/nfse/' + encodeURIComponent(chave) + '/eventos',
};

const CERTIFICADO = path.join(__dirname, 'fgts_certificado.pfx');
const SENHA = path.join(__dirname, 'fgts_certificado.senha');

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO = '1.01';
const VER_APLIC = 'nads-1.0';
const INFO_COMPL_PADRAO = 'Percentual aproximado de tributos: 16,42% Fonte: IBPT';
const AMBIENTES = ['homologacao', 'producao'];

const CONSULTA_A_CADA_MS = 30 * 1000;
const MAX_CONSULTAS = 40;
const TEMPO_HTTP_MS = 60 * 1000;
// a hora de emissão vai um minuto para trás: relógio do servidor da prefeitura um pouco atrasado recusa DPS "do futuro"
const FOLGA_DHEMI_MS = 60 * 1000;

const ALG = {
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  sha1: 'http://www.w3.org/2000/09/xmldsig#sha1',
};

const agora = () => new Date().toISOString();
const digitos = v => String(v == null ? '' : v).replace(/\D/g, '');
const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- texto e formatos ----------

/** Escapa para dentro de um elemento ou atributo XML. */
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Texto que o XSD aceita (TSString: só a faixa Latin-1, sem espaço nas pontas). Aspas curvas, travessões e afins viram
 *  os equivalentes simples; o que sobrar fora da faixa (emoji, por exemplo) sai. Com quebras = a descrição do serviço. */
function textoLimpo(t, { quebras = false, max = 0 } = {}) {
  let s = String(t == null ? '' : t).normalize('NFC')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-').replace(/…/g, '...').replace(/[   ]/g, ' ');
  s = quebras ? s.replace(/\r\n?/g, '\n').replace(/[^\n\x20-\xFF]/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')
    : s.replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ');
  s = s.trim();
  if (max && s.length > max) s = s.slice(0, max).trim();
  return s;
}

const el = (nome, valor) => '<' + nome + '>' + esc(valor) + '</' + nome + '>';
const dinheiro = v => (Math.round(Number(v) * 100) / 100).toFixed(2);

/** Data e hora em Brasília no formato do XSD (AAAA-MM-DDThh:mm:ss-03:00), sem depender do TZ do processo. */
function dataHoraBrasilia(d) {
  const partes = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset',
  }).formatToParts(d).forEach(p => { partes[p.type] = p.value; });
  const m = /GMT([+-]\d{2}):?(\d{2})?/.exec(partes.timeZoneName || '');
  const fuso = m ? m[1] + ':' + (m[2] || '00') : '-03:00';
  return partes.year + '-' + partes.month + '-' + partes.day + 'T' + partes.hour + ':' + partes.minute + ':' + partes.second + fuso;
}

function dataValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = new Date(iso + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === iso;
}

function cpfValido(c) {
  c = digitos(c);
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}

function cnpjValido(c) {
  c = digitos(c);
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  for (const n of [12, 13]) {
    let s = 0;
    let p = n - 7;
    for (let i = 0; i < n; i++) { s += Number(c[i]) * p; p = p === 2 ? 9 : p - 1; }
    const dv = s % 11 < 2 ? 0 : 11 - (s % 11);
    if (dv !== Number(c[n])) return false;
  }
  return true;
}

// ---------- conferência do que veio do nads ----------

const ambienteDe = (config, pedido) => (AMBIENTES.includes(pedido && pedido.ambiente) ? pedido.ambiente : (config && config.ambiente));
const serieDe = config => String(config && config.serie != null && config.serie !== '' ? config.serie : '1');

/** O que falta ou está errado em config/nfse, em português (lista vazia = pode emitir). */
function problemasDaConfig(config, ambiente) {
  const p = [];
  if (!config) return ['a configuração da NFS-e (config/nfse) ainda não foi feita no nads'];
  const amb = ambiente || config.ambiente;
  if (!AMBIENTES.includes(amb)) p.push('o ambiente da NFS-e precisa ser homologação ou produção');
  const pr = config.prestador || {};
  if (!cnpjValido(pr.cnpj)) p.push('o CNPJ do prestador (o escritório) está vazio ou inválido');
  if (!/^\d{7}$/.test(digitos(pr.cLocEmi))) p.push('o código IBGE do município emissor (cLocEmi) precisa ter 7 dígitos');
  const op = Number(pr.opSimpNac);
  if (![1, 2, 3].includes(op)) p.push('a situação no Simples Nacional (opSimpNac) precisa ser 1, 2 ou 3');
  if (op === 3 && ![1, 2, 3].includes(Number(pr.regApTribSN))) p.push('para ME/EPP do Simples (opSimpNac 3) falta o regime de apuração (regApTribSN 1, 2 ou 3)');
  if (![0, 1, 2, 3, 4, 5, 6, 9].includes(Number(pr.regEspTrib)) || pr.regEspTrib === '' || pr.regEspTrib == null) p.push('o regime especial de tributação (regEspTrib) precisa ser 0 a 6 ou 9');
  const sv = config.servico || {};
  if (!/^\d{6}$/.test(String(sv.cTribNac || ''))) p.push('o código de tributação nacional (cTribNac) precisa ter 6 dígitos');
  if (!/^[a-zA-Z0-9]{1,20}$/.test(String(sv.cIntContrib || ''))) p.push('falta o código de serviço municipal (cIntContrib), obrigatório na E&L (só letras e números, até 20)');
  if (sv.cNBS != null && sv.cNBS !== '' && !/^\d{9}$/.test(digitos(sv.cNBS))) p.push('o código NBS (cNBS) precisa ter 9 dígitos');
  if (sv.pAliq != null && sv.pAliq !== '' && !(Number(sv.pAliq) > 0 && Number(sv.pAliq) < 10)) p.push('a alíquota do ISS (pAliq) precisa estar entre 0 e 9,99');
  if (![1, 2, 3, 4].includes(Number(sv.tribISSQN == null ? 1 : sv.tribISSQN))) p.push('a tributação do ISS (tribISSQN) precisa ser 1 a 4');
  if (![1, 2, 3].includes(Number(sv.tpRetISSQN == null ? 1 : sv.tpRetISSQN))) p.push('a retenção do ISS (tpRetISSQN) precisa ser 1, 2 ou 3');
  const serie = serieDe(config);
  // 70000 a 79999 é a série do emissor web (o portal); a faixa de sistema próprio é 1 a 49999
  if (!/^\d{1,5}$/.test(serie) || Number(serie) < 1 || Number(serie) > 49999) p.push('a série da DPS precisa ser de 1 a 49999 (a 70000 é a do portal)');
  if (AMBIENTES.includes(amb)) {
    const n = Number((config.proximoNumero || {})[amb]);
    if (!Number.isInteger(n) || n < 1 || n > 999999999999999) p.push('o próximo número da DPS em ' + amb + ' precisa ser um inteiro a partir de 1');
  }
  return p;
}

/** O que está errado no pedido (nfseEmissoes/{id}), em português. */
function problemasDoPedido(pedido) {
  const p = [];
  const t = (pedido && pedido.tomador) || {};
  const doc = digitos(t.documento);
  if (doc.length === 11) { if (!cpfValido(doc)) p.push('o CPF do tomador é inválido'); }
  else if (doc.length === 14) { if (!cnpjValido(doc)) p.push('o CNPJ do tomador é inválido'); }
  else p.push('o documento do tomador precisa ser um CPF (11 dígitos) ou CNPJ (14 dígitos)');
  if (!textoLimpo(t.nome)) p.push('falta o nome do tomador');
  if (t.email && textoLimpo(t.email).length > 80) p.push('o e-mail do tomador passa de 80 caracteres');
  if (t.fone && !/^\d{6,20}$/.test(digitos(t.fone))) p.push('o telefone do tomador precisa ter de 6 a 20 dígitos');
  const e = t.endereco;
  if (e && Object.values(e).some(v => String(v == null ? '' : v).trim())) {
    if (!/^\d{7}$/.test(digitos(e.cMun))) p.push('o endereço do tomador precisa do código IBGE do município (7 dígitos)');
    if (!/^\d{8}$/.test(digitos(e.cep))) p.push('o CEP do tomador precisa ter 8 dígitos');
    if (!textoLimpo(e.logradouro)) p.push('falta o logradouro do tomador');
    if (!textoLimpo(e.numero)) p.push('falta o número do endereço do tomador (use 0 ou S/N se não tiver)');
    if (!textoLimpo(e.bairro)) p.push('falta o bairro do tomador');
  }
  const s = (pedido && pedido.servico) || {};
  if (!textoLimpo(s.descricao, { quebras: true })) p.push('falta a descrição do serviço');
  if (textoLimpo(s.descricao, { quebras: true }).length > 2000) p.push('a descrição do serviço passa de 2000 caracteres');
  if (!(typeof s.valor === 'number' && isFinite(s.valor) && s.valor > 0 && s.valor < 1e13)) p.push('o valor do serviço precisa ser um número maior que zero');
  if (!dataValida(s.competencia)) p.push('a data da competência precisa estar no formato AAAA-MM-DD');
  else if (s.competencia > dataHoraBrasilia(new Date()).slice(0, 10)) p.push('a competência não pode ser depois de hoje');
  return p;
}

// ---------- a DPS ----------

/** O Id do infDPS: "DPS" + município (7) + tipo de inscrição (2 = CNPJ) + CNPJ (14) + série (5) + número (15). */
function idDps(cLocEmi, cnpj, serie, numero) {
  return 'DPS' + digitos(cLocEmi).padStart(7, '0') + '2' + digitos(cnpj).padStart(14, '0') +
    String(serie).padStart(5, '0') + String(numero).padStart(15, '0');
}

/**
 * Monta o XML da DPS, ainda sem assinatura. Função pura: tudo vem dos argumentos (opcoes.agora fixa a hora de emissão,
 * opcoes.ambiente força o ambiente — o do número já reservado, num reenvio). Não confere os dados: chame
 * problemasDaConfig/problemasDoPedido antes.
 */
function montarDps(config, pedido, numero, opcoes = {}) {
  const ambiente = opcoes.ambiente || ambienteDe(config, pedido);
  const pr = config.prestador || {};
  const sv = config.servico || {};
  const t = pedido.tomador || {};
  const s = pedido.servico || {};
  const serie = serieDe(config);
  const cLocEmi = digitos(pr.cLocEmi);
  const id = idDps(cLocEmi, pr.cnpj, serie, numero);
  const dhEmi = dataHoraBrasilia(new Date((opcoes.agora ? new Date(opcoes.agora).getTime() : Date.now()) - (opcoes.agora ? 0 : FOLGA_DHEMI_MS)));

  // prestador: só o CNPJ e o regime (tpEmit 1: o nome e o endereço vêm do cadastro; a IM "250517/6308" fica de fora)
  const op = Number(pr.opSimpNac);
  const regTrib = '<regTrib>' + el('opSimpNac', op) +
    (op === 3 ? el('regApTribSN', Number(pr.regApTribSN)) : '') +
    el('regEspTrib', Number(pr.regEspTrib)) + '</regTrib>';
  const prest = '<prest>' + el('CNPJ', digitos(pr.cnpj)) + regTrib + '</prest>';

  // tomador: CPF ou CNPJ pelo tamanho, nome, endereço nacional (completo, se vier), fone e e-mail
  const doc = digitos(t.documento);
  let toma = '<toma>' + el(doc.length === 14 ? 'CNPJ' : 'CPF', doc) + el('xNome', textoLimpo(t.nome, { max: 300 }));
  const e = t.endereco;
  if (e && digitos(e.cMun)) {
    toma += '<end><endNac>' + el('cMun', digitos(e.cMun)) + el('CEP', digitos(e.cep)) + '</endNac>' +
      el('xLgr', textoLimpo(e.logradouro, { max: 255 })) + el('nro', textoLimpo(e.numero, { max: 60 })) +
      (textoLimpo(e.complemento) ? el('xCpl', textoLimpo(e.complemento, { max: 156 })) : '') +
      el('xBairro', textoLimpo(e.bairro, { max: 60 })) + '</end>';
  }
  if (digitos(t.fone)) toma += el('fone', digitos(t.fone));
  if (textoLimpo(t.email)) toma += el('email', textoLimpo(t.email, { max: 80 }));
  toma += '</toma>';

  // serviço
  const infoCompl = sv.infoCompl === undefined || sv.infoCompl === null ? INFO_COMPL_PADRAO : textoLimpo(sv.infoCompl, { max: 2000 });
  const serv = '<serv><locPrest>' + el('cLocPrestacao', digitos(sv.cLocPrestacao) || cLocEmi) + '</locPrest>' +
    '<cServ>' + el('cTribNac', String(sv.cTribNac)) +
    el('xDescServ', textoLimpo(s.descricao, { quebras: true, max: 2000 })) +
    (digitos(sv.cNBS) ? el('cNBS', digitos(sv.cNBS)) : '') +
    el('cIntContrib', String(sv.cIntContrib)) + '</cServ>' +
    (infoCompl ? '<infoCompl>' + el('xInfComp', infoCompl) + '</infoCompl>' : '') +
    '</serv>';

  // valores: o ISS no município (alíquota se informada) e "não informar" o total aproximado de tributos (indTotTrib 0)
  const temAliq = sv.pAliq != null && sv.pAliq !== '';
  const valores = '<valores><vServPrest>' + el('vServ', dinheiro(s.valor)) + '</vServPrest>' +
    '<trib><tribMun>' + el('tribISSQN', Number(sv.tribISSQN == null ? 1 : sv.tribISSQN)) +
    el('tpRetISSQN', Number(sv.tpRetISSQN == null ? 1 : sv.tpRetISSQN)) +
    (temAliq ? el('pAliq', Number(sv.pAliq).toFixed(2)) : '') + '</tribMun>' +
    '<totTrib>' + el('indTotTrib', 0) + '</totTrib></trib></valores>';

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<DPS xmlns="' + NS + '" versao="' + VERSAO + '"><infDPS Id="' + id + '">' +
    el('tpAmb', ambiente === 'producao' ? 1 : 2) +
    el('dhEmi', dhEmi) +
    el('verAplic', VER_APLIC) +
    el('serie', serie) +
    el('nDPS', String(Number(numero))) +
    el('dCompet', s.competencia) +
    el('tpEmit', 1) +
    el('cLocEmi', cLocEmi) +
    prest + toma + serv + valores +
    '</infDPS></DPS>';
}

/** O pedido de registro do evento de cancelamento (e101101), sem assinatura. */
function montarCancelamento({ ambiente, cnpjAutor, chaveAcesso, cMotivo, motivo, agora: quando }) {
  const id = 'PRE' + chaveAcesso + '101101';
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<pedRegEvento xmlns="' + NS + '" versao="' + VERSAO + '"><infPedReg Id="' + id + '">' +
    el('tpAmb', ambiente === 'producao' ? 1 : 2) +
    el('verAplic', VER_APLIC) +
    el('dhEvento', dataHoraBrasilia(quando ? new Date(quando) : new Date(Date.now() - FOLGA_DHEMI_MS))) +
    el('CNPJAutor', digitos(cnpjAutor)) +
    el('chNFSe', chaveAcesso) +
    '<e101101>' + el('xDesc', 'Cancelamento de NFS-e') + el('cMotivo', String(cMotivo)) + el('xMotivo', textoLimpo(motivo, { max: 255 })) + '</e101101>' +
    '</infPedReg></pedRegEvento>';
}

// ---------- assinatura ----------

/**
 * Assina com XMLDSig enveloped, como a nota real: c14n inclusiva (REC-xml-c14n-20010315), RSA-SHA1 e SHA1, a referência
 * no Id do elemento `alvo` (infDPS ou infPedReg) e a Signature logo depois dele, dentro da raiz; KeyInfo com o certificado.
 */
function assinar(xml, alvo, { chavePem, certPem }) {
  const { SignedXml } = require('xml-crypto');
  const declaracao = /^<\?xml[^>]*\?>/.exec(xml);
  const corpo = declaracao ? xml.slice(declaracao[0].length) : xml;
  const sig = new SignedXml({ privateKey: chavePem, publicCert: certPem, signatureAlgorithm: ALG.rsaSha1, canonicalizationAlgorithm: ALG.c14n });
  const caminho = "//*[local-name(.)='" + alvo + "']";
  sig.addReference({ xpath: caminho, transforms: [ALG.enveloped, ALG.c14n], digestAlgorithm: ALG.sha1 });
  sig.computeSignature(corpo, { location: { reference: caminho, action: 'after' } });
  return (declaracao ? declaracao[0] : '') + sig.getSignedXml();
}

/** A chave e o certificado do escritório (o .pfx do FGTS). Devolve { chavePem, certPem, titular, documento, validade } ou { erro }. */
function lerCertificadoComChave(caminhoPfx = CERTIFICADO, caminhoSenha = SENHA) {
  if (!fs.existsSync(caminhoPfx)) return { erro: 'falta o certificado do escritório na máquina do robô' };
  if (!fs.existsSync(caminhoSenha)) return { erro: 'falta a senha do certificado do escritório na máquina do robô' };
  try {
    const forge = require('node-forge');
    const senha = fs.readFileSync(caminhoSenha, 'utf8').replace(/\r?\n$/, '');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(fs.readFileSync(caminhoPfx).toString('binary')), senha);
    const chaves = [].concat(
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [],
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []).map(b => b.key).filter(Boolean);
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean);
    if (!chaves.length) return { erro: 'o arquivo do certificado não tem a chave privada' };
    // o certificado que casa com a chave (não o da autoridade certificadora)
    let par = null;
    for (const k of chaves) {
      const c = certs.find(x => x.publicKey && x.publicKey.n && x.publicKey.n.equals(k.n));
      if (c) { par = { k, c }; break; }
    }
    if (!par) return { erro: 'o arquivo do certificado não tem o certificado da chave' };
    const cn = String((par.c.subject.getField('CN') || {}).value || '');
    const validade = par.c.validity.notAfter;
    if (validade < new Date()) return { erro: 'o certificado do escritório venceu em ' + validade.toISOString().slice(0, 10) };
    return {
      chavePem: forge.pki.privateKeyToPem(par.k),
      certPem: forge.pki.certificateToPem(par.c),
      titular: cn.split(':')[0].trim(),
      documento: (cn.split(':')[1] || '').replace(/\D/g, ''),
      validade: validade.toISOString().slice(0, 10),
    };
  } catch (err) {
    return { erro: /password|mac|invalid/i.test(err.message) ? 'a senha não abre o certificado do escritório' : 'não consegui ler o certificado do escritório (' + err.message + ')' };
  }
}

// ---------- a conversa com a E&L ----------

const gzipB64 = xml => zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64');

/** O XML que a E&L devolve (gzip + base64), ou null quando ainda é o texto "em processamento". */
function desgzipB64(b64) {
  if (typeof b64 !== 'string' || b64.length < 20) return null;
  try {
    const buf = Buffer.from(b64.trim(), 'base64');
    if (buf[0] !== 0x1f || buf[1] !== 0x8b) return null;
    return zlib.gunzipSync(buf).toString('utf8');
  } catch (e) { return null; }
}

/** A lista de erros da resposta, em { codigo, descricao } (a E&L manda Codigo/Descricao; aceita outras grafias). */
function errosDaResposta(corpo) {
  if (!corpo || typeof corpo !== 'object') return [];
  const lista = corpo.erros || corpo.Erros || corpo.errors;
  const saida = [];
  if (Array.isArray(lista)) {
    for (const e of lista) {
      if (!e) continue;
      if (typeof e === 'string') { saida.push({ codigo: '', descricao: e }); continue; }
      saida.push({ codigo: String(e.Codigo || e.codigo || e.code || ''), descricao: String(e.Descricao || e.descricao || e.Mensagem || e.mensagem || e.message || '').trim() });
    }
  } else if (lista && typeof lista === 'object') {
    // formato de validação do ASP.NET: { errors: { campo: [mensagens] } }
    for (const [campo, msgs] of Object.entries(lista)) [].concat(msgs).forEach(m => saida.push({ codigo: campo, descricao: String(m) }));
  }
  return saida.filter(e => e.codigo || e.descricao);
}

const numeroDaNota = xml => { const m = /<nNFSe>(\d+)<\/nNFSe>/.exec(xml || ''); return m ? m[1] : null; };
const chaveDaNota = xml => { const m = /Id="NFS(\d{50})"/.exec(xml || ''); return m ? m[1] : null; };

class ErroHttp extends Error {
  constructor(status, corpo, msg) { super(msg); this.status = status; this.corpo = corpo; }
}

/** Chama a API com o token na query. Nenhuma mensagem de erro carrega a URL (o token está nela). */
async function chamar(metodo, url, token, corpo) {
  if (!token) throw new ErroHttp(0, null, 'falta o token da prefeitura — grave no nads');
  const endereco = url + '?token=' + encodeURIComponent(token);
  const semToken = t => String(t).split(token).join('***').split(encodeURIComponent(token)).join('***');
  let resp;
  try {
    resp = await fetch(endereco, {
      method: metodo,
      headers: Object.assign({ Accept: 'application/json' }, corpo ? { 'Content-Type': 'application/json' } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(TEMPO_HTTP_MS),
    });
  } catch (err) {
    const tempo = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new ErroHttp(0, null, tempo ? 'a prefeitura não respondeu em ' + TEMPO_HTTP_MS / 1000 + ' s' : 'não consegui falar com o servidor da prefeitura (' + semToken((err.cause && err.cause.code) || err.message) + ')');
  }
  const texto = await resp.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch (e) { json = null; }
  return { status: resp.status, json, texto: semToken(texto).slice(0, 500) };
}

function mensagemHttp(r) {
  if (r.status === 401 || r.status === 403) return 'a prefeitura recusou o token (vencido, inativo ou de outro contribuinte). Gere um token novo no portal da prefeitura (Configurações > Integração) e grave no nads';
  if (r.status === 404) return 'a prefeitura não achou o endereço ou o documento (HTTP 404)';
  if (r.status >= 500) return 'o servidor da prefeitura deu erro (HTTP ' + r.status + '); tente de novo mais tarde';
  return 'a prefeitura respondeu HTTP ' + r.status + (r.texto ? ': ' + r.texto.slice(0, 200) : '');
}

// ---------- o módulo ----------

/** Liga o módulo. opcoes (só para o teste): { pfx, senha } outro certificado, consultaMs outro intervalo de consulta. */
function iniciarNfse(db, log, opcoes = {}) {
  const CONSULTA_MS = opcoes.consultaMs || CONSULTA_A_CADA_MS;
  const estadoRef = db.collection('robo').doc('nfse');
  const configRef = db.collection('config').doc('nfse');
  const segredoRef = db.collection('segredos').doc('nfse');
  const emissoes = db.collection('nfseEmissoes');
  const { FieldValue } = require('firebase-admin/firestore');

  let config = null;
  let segredo = null;
  let cert = null;
  let certLidoEm = 0;
  let ultimoEstado = '';

  function certificado() {
    // relê a cada hora (o certificado pode ser trocado pelos metadados sem reiniciar a máquina)
    if (!cert || Date.now() - certLidoEm > 60 * 60 * 1000) { cert = lerCertificadoComChave(opcoes.pfx || CERTIFICADO, opcoes.senha || SENHA); certLidoEm = Date.now(); }
    return cert;
  }
  const tokenPara = amb => {
    const s = segredo || {};
    const t = amb === 'homologacao' ? (s.tokenHomologacao || s.token) : s.token;
    return typeof t === 'string' && t.trim() ? t.trim() : '';
  };

  /** Por que não dá para emitir no ambiente (texto vazio = pode). */
  function motivoDesligado(amb) {
    const c = certificado();
    if (c.erro) return c.erro;
    const probl = problemasDaConfig(config, amb);
    if (probl.length) return probl.join('; ');
    const cnpj = digitos(config.prestador.cnpj);
    if (c.documento && c.documento.slice(0, 8) !== cnpj.slice(0, 8)) return 'o certificado do robô é do CNPJ ' + c.documento + ', mas o prestador em config/nfse é ' + cnpj;
    if (!tokenPara(amb || config.ambiente)) return 'falta o token da prefeitura (' + ((amb || config.ambiente) === 'homologacao' ? 'homologação' : 'produção') + ') — grave no nads';
    return '';
  }

  function publicarEstado(forcar) {
    const motivo = motivoDesligado();
    const c = certificado();
    const dados = { ligado: !motivo, motivo, certificado: c.erro ? null : { titular: c.titular, validade: c.validade } };
    const chave = JSON.stringify(dados);
    if (!forcar && chave === ultimoEstado) return;
    if (chave !== ultimoEstado) log('NFS-e:', motivo ? 'desligado (' + motivo + ')' : 'ligado (certificado de ' + c.titular + ', até ' + c.validade + ', ' + config.ambiente + ')');
    ultimoEstado = chave;
    estadoRef.set(Object.assign(dados, { atualizadoEm: agora() })).catch(err => log('NFS-e: não gravei o estado:', err.message));
  }

  let configChegou = false;
  let segredoChegou = false;
  const talvezPublicar = () => { if (configChegou && segredoChegou) publicarEstado(); };
  ouvir('NFS-e (config)', () => configRef, snap => { config = snap.exists ? snap.data() : null; configChegou = true; talvezPublicar(); }, log);
  ouvir('NFS-e (token)', () => segredoRef, snap => { segredo = snap.exists ? snap.data() : null; segredoChegou = true; talvezPublicar(); }, log);
  setInterval(() => { if (configChegou && segredoChegou) publicarEstado(true); }, 6 * 60 * 60 * 1000);

  // ----- fila: um pedido por vez -----
  const fila = [];
  const naFila = new Set();
  let ocupado = false;
  function enfileirar(tipo, id, extra) {
    const chave = tipo + ':' + id;
    if (naFila.has(chave)) return;
    naFila.add(chave);
    fila.push(Object.assign({ tipo, id, chave }, extra || {}));
    andar();
  }
  async function andar() {
    if (ocupado) return;
    ocupado = true;
    try {
      while (fila.length) {
        const t = fila.shift();
        try {
          if (t.tipo === 'enviar') await enviar(t.id, t.retomar);
          else if (t.tipo === 'consultar') await consultar(t.id);
          else if (t.tipo === 'cancelar') await cancelar(t.id);
        } catch (err) {
          log('NFS-e: erro inesperado em', t.tipo, t.id + ':', err.message);
          const campo = t.tipo === 'cancelar'
            ? { status: 'erro-cancelamento', erros: [{ codigo: 'ROBO', descricao: 'o robô parou no meio: ' + String(err.message).slice(0, 300) }], 'cancelamento.enviandoEm': FieldValue.delete() }
            : { status: 'erro', erros: [{ codigo: 'ROBO', descricao: 'o robô parou no meio: ' + String(err.message).slice(0, 300) }] };
          await emissoes.doc(t.id).update(Object.assign(campo, { atualizadoEm: agora() })).catch(() => {});
        } finally { naFila.delete(t.chave); }
      }
    } finally { ocupado = false; }
  }

  const falhar = (ref, erros, extra) => ref.update(Object.assign({ status: 'erro', erros, atualizadoEm: agora() }, extra || {}));
  const erroRobo = descricao => [{ codigo: 'ROBO', descricao }];

  // ----- envio -----
  async function enviar(id, retomar) {
    const ref = emissoes.doc(id);
    const antes = await ref.get();
    if (!antes.exists) return;
    const p0 = antes.data();
    if (!(p0.status === 'pedida' || (retomar && p0.status === 'enviando'))) return;
    if (!config) config = (await configRef.get()).data() || null;
    if (!segredo) segredo = (await segredoRef.get()).data() || null;
    const amb = (p0.dps && p0.dps.ambiente) || ambienteDe(config, p0);

    // antes de reservar número: certificado, configuração, token e o pedido
    const motivo = motivoDesligado(amb);
    if (motivo) { await falhar(ref, erroRobo('Não emiti: ' + motivo + '.')); log('NFS-e: pedido', id, 'não enviado:', motivo); return; }
    const probl = problemasDoPedido(p0);
    if (probl.length) { await falhar(ref, probl.map(d => ({ codigo: 'PEDIDO', descricao: d }))); return; }

    // reserva o número (ou mantém o do envio anterior) e marca 'enviando', tudo numa transação
    const reservado = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      const p = s.data() || {};
      if (!(p.status === 'pedida' || (retomar && p.status === 'enviando'))) return null;
      let dps = p.dps;
      if (!dps || !dps.id) {
        const c = (await tx.get(configRef)).data();
        const pr = problemasDaConfig(c, amb);
        if (pr.length) throw new Error(pr.join('; '));
        const numero = Number(c.proximoNumero[amb]);
        dps = { serie: serieDe(c), numero, id: idDps(c.prestador.cLocEmi, c.prestador.cnpj, serieDe(c), numero), ambiente: amb };
        tx.update(configRef, { ['proximoNumero.' + amb]: numero + 1 });
      }
      tx.update(ref, { status: 'enviando', dps, erros: [], consultas: 0, atualizadoEm: agora() });
      return { dps, reenvio: !!(p.dps && p.dps.id) };
    });
    if (!reservado) return;
    const { dps, reenvio } = reservado;
    const token = tokenPara(dps.ambiente);

    // reenvio: confere antes se a nota já saiu (a resposta do envio anterior pode ter se perdido)
    if (reenvio) {
      const r = await chamar('GET', ENDERECOS.consultaDps(dps.ambiente, dps.id), token).catch(() => null);
      if (r && r.status === 200 && r.json && desgzipB64(r.json.nfseXmlGZipB64)) {
        await autorizar(ref, r.json, dps);
        return;
      }
    }

    const pedido = (await ref.get()).data();
    const xml = assinar(montarDps(config, pedido, dps.numero, { ambiente: dps.ambiente }), 'infDPS', cert);
    log('NFS-e: enviando', dps.id, '(' + dps.ambiente + (reenvio ? ', reenvio' : '') + ') para', textoLimpo(pedido.tomador.nome).slice(0, 40));

    let r = null;
    let falha = null;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        r = await chamar('POST', ENDERECOS.envio(dps.ambiente), token, { dpsXmlGZipB64: gzipB64(xml) });
        if (r.status < 500) break;
        falha = mensagemHttp(r);
      } catch (err) { falha = err.message; r = null; }
      if (tentativa < 3) await dormir(tentativa * 10000);
    }
    if (!r || r.status >= 500) {
      await falhar(ref, erroRobo('Não consegui entregar a DPS: ' + falha + '. Peça o reenvio pelo nads (o robô confere antes e usa o mesmo número).'), { xmlDps: xml });
      log('NFS-e:', dps.id, 'não entregue:', falha);
      return;
    }
    const erros = errosDaResposta(r.json);
    if (erros.length) {
      await falhar(ref, erros, { xmlDps: xml, enviadaEm: agora() });
      log('NFS-e:', dps.id, 'recusada:', erros.map(e => e.codigo + ' ' + e.descricao).join(' | ').slice(0, 300));
      return;
    }
    if (r.status !== 200 && r.status !== 201) {
      await falhar(ref, erroRobo(mensagemHttp(r)), { xmlDps: xml });
      log('NFS-e:', dps.id, 'HTTP', r.status);
      return;
    }
    if (r.json && desgzipB64(r.json.nfseXmlGZipB64)) { await autorizar(ref, r.json, dps, { xmlDps: xml, enviadaEm: agora() }); return; }
    await ref.update({ status: 'processando', enviadaEm: agora(), consultas: 0, xmlDps: xml, atualizadoEm: agora() });
    log('NFS-e:', dps.id, 'recebida pela prefeitura; consultando a cada', CONSULTA_MS / 1000, 's');
  }

  async function autorizar(ref, resposta, dps, extra) {
    const xmlNfse = desgzipB64(resposta.nfseXmlGZipB64);
    const chaveAcesso = String(resposta.chaveAcesso || chaveDaNota(xmlNfse) || '');
    const numeroNfse = numeroDaNota(xmlNfse);
    await ref.update(Object.assign({ status: 'autorizada', chaveAcesso, numeroNfse, xmlNfse, erros: [], autorizadaEm: agora(), atualizadoEm: agora() }, extra || {}));
    log('NFS-e:', dps.id, 'AUTORIZADA, nota', numeroNfse, 'chave', chaveAcesso);
  }

  // ----- consulta do processamento -----
  const processando = new Map(); // id -> momento da próxima consulta
  async function consultar(id) {
    const ref = emissoes.doc(id);
    const s = await ref.get();
    const p = s.exists ? s.data() : null;
    if (!p || p.status !== 'processando' || !p.dps || !p.dps.id) { processando.delete(id); return; }
    const dps = p.dps;
    const n = Number(p.consultas || 0) + 1;
    let r = null;
    let falha = '';
    try { r = await chamar('GET', ENDERECOS.consultaDps(dps.ambiente, dps.id), tokenPara(dps.ambiente)); } catch (err) { falha = err.message; }
    if (r && (r.status === 401 || r.status === 403)) { processando.delete(id); await falhar(ref, erroRobo(mensagemHttp(r))); return; }
    if (r && r.status === 200 && r.json) {
      if (desgzipB64(r.json.nfseXmlGZipB64)) { processando.delete(id); await autorizar(ref, r.json, dps); return; }
      const erros = errosDaResposta(r.json);
      if (erros.length) {
        processando.delete(id);
        await falhar(ref, erros, { consultas: n });
        log('NFS-e:', dps.id, 'rejeitada no processamento:', erros.map(e => e.codigo + ' ' + e.descricao).join(' | ').slice(0, 300));
        return;
      }
    } else if (r && r.status !== 404) falha = mensagemHttp(r);
    if (n >= MAX_CONSULTAS) {
      processando.delete(id);
      await falhar(ref, erroRobo('A prefeitura não terminou de processar a DPS depois de ' + n + ' consultas (cerca de ' + Math.round(n * CONSULTA_MS / 60000) +
        ' min)' + (falha ? '; a última resposta foi: ' + falha : '') + '. A nota ainda pode sair: peça o reenvio pelo nads (o robô confere antes e não duplica).'), { consultas: n });
      log('NFS-e:', dps.id, 'sem resposta depois de', n, 'consultas');
      return;
    }
    processando.set(id, Date.now() + CONSULTA_MS);
    await ref.update({ consultas: n, atualizadoEm: agora() });
  }
  setInterval(() => {
    const t = Date.now();
    for (const [id, quando] of processando) if (quando <= t) { processando.set(id, Infinity); enfileirar('consultar', id); }
  }, Math.min(5000, CONSULTA_MS));

  // ----- cancelamento -----
  const JA_CANCELADA = /j[aá]\s.*cancelad|cancelad[ao].*anteriormente|evento.*j[aá].*(registrad|vinculad)/i;
  async function cancelar(id) {
    const ref = emissoes.doc(id);
    const meu = agora();
    const ok = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      const p = s.data() || {};
      if (p.status !== 'cancelamento-pedido') return null;
      const c = p.cancelamento || {};
      // outro atendimento em curso (menos de 10 min): deixa
      if (c.enviandoEm && Date.now() - Date.parse(c.enviandoEm) < 10 * 60 * 1000) return null;
      tx.update(ref, { 'cancelamento.enviandoEm': meu, atualizadoEm: meu });
      return p;
    });
    if (!ok) return;
    const p = ok;
    const c = p.cancelamento || {};
    const falharCanc = (erros, extra) => ref.update(Object.assign({ status: 'erro-cancelamento', erros, 'cancelamento.enviandoEm': FieldValue.delete(), atualizadoEm: agora() }, extra || {}));
    const probl = [];
    if (!/^\d{50}$/.test(String(p.chaveAcesso || ''))) probl.push('a nota não tem chave de acesso (só dá para cancelar nota autorizada)');
    if (!['1', '2', '9'].includes(String(c.cMotivo))) probl.push('o código do motivo precisa ser 1 (erro na emissão), 2 (serviço não prestado) ou 9 (outros)');
    const motivoTexto = textoLimpo(c.motivo, { max: 255 });
    if (motivoTexto.length < 15) probl.push('a justificativa do cancelamento precisa ter pelo menos 15 caracteres');
    if (probl.length) { await falharCanc(probl.map(d => ({ codigo: 'PEDIDO', descricao: d }))); return; }
    if (!config) config = (await configRef.get()).data() || null;
    if (!segredo) segredo = (await segredoRef.get()).data() || null;
    const amb = (p.dps && p.dps.ambiente) || ambienteDe(config, p);
    const motivo = motivoDesligado(amb);
    if (motivo) { await falharCanc(erroRobo('Não cancelei: ' + motivo + '.')); return; }

    const xml = assinar(montarCancelamento({ ambiente: amb, cnpjAutor: config.prestador.cnpj, chaveAcesso: p.chaveAcesso, cMotivo: c.cMotivo, motivo: motivoTexto }), 'infPedReg', cert);
    log('NFS-e: cancelando a nota', p.numeroNfse || '', 'chave', p.chaveAcesso, '(' + amb + ')');
    let r;
    try { r = await chamar('POST', ENDERECOS.eventos(amb, p.chaveAcesso), tokenPara(amb), { pedidoRegistroEventoXmlGZipB64: gzipB64(xml) }); }
    catch (err) { await falharCanc(erroRobo('Não consegui entregar o cancelamento: ' + err.message + '. Peça de novo pelo nads.')); return; }
    const erros = errosDaResposta(r.json);
    const xmlEvento = r.json ? desgzipB64(r.json.eventoXmlGZipB64) : null;
    if (erros.length) {
      if (erros.some(e => JA_CANCELADA.test(e.descricao))) {
        await ref.update({ status: 'cancelada', canceladaEm: agora(), erros: [], observacao: 'a prefeitura disse que a nota já estava cancelada: ' + erros.map(e => e.descricao).join(' | ').slice(0, 300), 'cancelamento.enviandoEm': FieldValue.delete(), atualizadoEm: agora() });
        return;
      }
      await falharCanc(erros, { xmlCancelamento: xml });
      log('NFS-e: cancelamento recusado:', erros.map(e => e.codigo + ' ' + e.descricao).join(' | ').slice(0, 300));
      return;
    }
    if (r.status !== 200 && r.status !== 201) { await falharCanc(erroRobo(mensagemHttp(r)), { xmlCancelamento: xml }); return; }
    await ref.update(Object.assign({ status: 'cancelada', canceladaEm: agora(), erros: [], 'cancelamento.enviandoEm': FieldValue.delete(), atualizadoEm: agora() }, xmlEvento ? { xmlEvento } : {}));
    log('NFS-e: nota', p.numeroNfse || p.chaveAcesso, 'CANCELADA');
  }

  // ----- o que o nads pede -----
  // o que ficou 'enviando' quando o robô caiu: retoma (consulta antes e reenvia com o mesmo número, se precisar)
  emissoes.where('status', '==', 'enviando').get()
    .then(s => s.docs.forEach(d => enfileirar('enviar', d.id, { retomar: true })))
    .catch(err => log('NFS-e: não li os envios interrompidos:', err.message));
  ouvir('NFS-e (pedidos)', () => emissoes.where('status', 'in', ['pedida', 'processando', 'cancelamento-pedido']), snap => {
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      if (ch.type === 'removed') { processando.delete(id); return; }
      const st = (ch.doc.data() || {}).status;
      if (st === 'pedida') enfileirar('enviar', id);
      else if (st === 'cancelamento-pedido') enfileirar('cancelar', id);
      else if (st === 'processando' && !processando.has(id)) processando.set(id, Date.now() + (Number(ch.doc.data().consultas || 0) ? Math.min(5000, CONSULTA_MS) : CONSULTA_MS));
    });
  }, log);
  log('NFS-e: atendendo nfseEmissoes (Taiobeiras, E&L)');
}

module.exports = {
  iniciarNfse, montarDps, montarCancelamento, assinar, idDps, problemasDaConfig, problemasDoPedido,
  lerCertificadoComChave, gzipB64, desgzipB64, errosDaResposta, numeroDaNota, chaveDaNota, dataHoraBrasilia, textoLimpo,
  URLS, ENDERECOS, ALG,
};
