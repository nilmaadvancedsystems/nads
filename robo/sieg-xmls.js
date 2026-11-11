// Os XMLs que o SIEG manda (nads, 07/10/2026: "quero que tenha como importar os XML direto do SIEG"): o nome de cada
// arquivo na pasta do cliente (para o Alterdata importar) e o resumo de cada nota que vai para o banco (siegNotas) — só o
// resumo, nunca o arquivo. Funções puras: o sieg.js baixa e grava; aqui só se lê o XML.
//   NF-e/NFC-e: a chave, o número, a série, a data, o emitente, o destinatário, o valor e os itens (NCM, CFOP, CST/CSOSN, CEST)
//   CT-e: a chave, o número, a data, o emitente, o valor e o CFOP
//   NFS-e (o padrão nacional e o ABRASF): o número, a data, o prestador, o tomador, o valor, o NBS, a descrição e as retenções
//   evento de cancelamento (110111 da NF-e, NFC-e e CT-e; o da NFS-e nacional): { cancela: chave }; os outros eventos: só o arquivo
const crypto = require('crypto');

const re = (nome, g) => new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', g);
/** O conteúdo da primeira tag com este nome (sem prefixo), ou ''. */
const tag = (xml, nome) => { const m = re(nome).exec(xml || ''); return m ? m[1].trim() : ''; };
/** O primeiro de vários nomes que existir. */
const primeira = (xml, ...nomes) => { for (const n of nomes) { const v = tag(xml, n); if (v) return v; } return ''; };
/** Todos os blocos <nome …>…</nome>. */
const blocos = (xml, nome) => { const out = []; const r = re(nome, 'g'); let m; while ((m = r.exec(xml || ''))) out.push(m[1]); return out; };
const num = v => { const n = Number(String(v || '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
/** dd/mm/aaaa de uma data ISO (2026-09-03T10:00:00-03:00) ou aaaa-mm-dd. */
const data = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
const pessoa = bloco => ({ doc: primeira(bloco, 'CNPJ', 'CPF', 'Cnpj', 'Cpf'), nome: primeira(bloco, 'xNome', 'RazaoSocial', 'xFant') });

/** O que é o XML: 'nfe' (NF-e e NFC-e), 'cte', 'evento', 'nfse' ou null. */
function tipoDoXml(xml) {
  // o evento da NFS-e nacional (11/11/2026) não tem tpEvento: <evento><infEvento><pedRegEvento><infPedReg> com a chave de 50 dígitos
  if (/<(?:\w+:)?tpEvento>/.test(xml) || /<(?:\w+:)?infPedReg[\s>]/.test(xml)) return 'evento';
  if (/Id="NFe\d{44}"/.test(xml)) return 'nfe';
  if (/Id="CTe\d{44}"/.test(xml)) return 'cte';
  if (/<(?:\w+:)?(?:NFSe|CompNfse|Nfse|InfNfse|infNFSe)[\s>]/.test(xml)) return 'nfse';
  return null;
}

/** O tipo de nota de qualquer XML do mês, a nota ou um evento dela (pelo modelo na chave: 55, 65, 57, 59); '' se não sabe. */
function tipoDeNota(xml) {
  if (tipoDoXml(xml) === 'nfse' || /<(?:\w+:)?chNFSe>/.test(xml)) return 'NFS-e';
  const m = /Id="(?:NFe|CTe)(\d{44})"/.exec(xml) || /<(?:\w+:)?ch(?:NFe|CTe)>(\d{44})</.exec(xml);
  return m ? ({ 55: 'NF-e', 65: 'NFC-e', 57: 'CT-e', 67: 'CT-e', 59: 'CF-e' }[m[1].slice(20, 22)] || '') : '';
}

/**
 * Quem paga o frete do CT-e (10/11/2026: "quando o robô for baixar as CT-e do SIEG quero que puxe pelo tomador"): o toma3
 * aponta para o remetente (0), o expedidor (1), o recebedor (2) ou o destinatário (3); o toma4 e o CT-e OS trazem a pessoa.
 * Devolve { doc, nome }, ou null quando o XML não diz.
 */
function tomadorDoCte(xml) {
  const ide = tag(xml, 'ide');
  const t4 = tag(ide, 'toma4');
  if (t4) return pessoa(t4);
  const t3 = primeira(ide, 'toma3', 'toma03');
  if (t3) {
    const papel = { 0: 'rem', 1: 'exped', 2: 'receb', 3: 'dest' }[tag(t3, 'toma')];
    return papel && tag(xml, papel) ? pessoa(tag(xml, papel)) : null;
  }
  const bloco = tag(xml, 'toma');
  return bloco && primeira(bloco, 'CNPJ', 'CPF') ? pessoa(bloco) : null;
}
/** O CT-e é do cliente: ele é o tomador ou quem emitiu. O XML que não diz o tomador fica (melhor sobrar que sumir). */
function cteDoCliente(xml, doc) {
  const so = v => String(v || '').replace(/\D/g, '');
  const tomador = tomadorDoCte(xml);
  return !tomador || !so(tomador.doc) || so(tomador.doc) === so(doc) || so(pessoa(tag(xml, 'emit')).doc) === so(doc);
}
/** Tira os CT-e em que o cliente não é tomador nem emitente, e os eventos deles; o resto passa como veio. */
function cteQueEntram(doc, xmls) {
  const fora = new Set();
  const ficam = xmls.filter(x => {
    if (tipoDoXml(x) !== 'cte' || cteDoCliente(x, doc)) return true;
    fora.add(/Id="CTe(\d{44})"/.exec(x)[1]);
    return false;
  });
  return fora.size ? ficam.filter(x => !(tipoDoXml(x) === 'evento' && fora.has(tag(x, 'chCTe')))) : ficam;
}

/** O nome do arquivo na pasta: a chave (NF-e/CT-e), a chave e o evento, ou o número da NFS-e. Sempre o mesmo para o mesmo XML. */
function nomeDoArquivo(xml) {
  const t = tipoDoXml(xml);
  const hash = crypto.createHash('md5').update(xml).digest('hex').slice(0, 10);
  if (t === 'nfe') return /Id="NFe(\d{44})"/.exec(xml)[1] + '-nfe.xml';
  if (t === 'cte') return /Id="CTe(\d{44})"/.exec(xml)[1] + '-cte.xml';
  if (t === 'evento') return (primeira(xml, 'chNFe', 'chCTe', 'chNFSe') || hash) + '-evento-' + (tag(xml, 'tpEvento') || codigoDoEventoNfse(xml) || 'x') + '-' + (tag(xml, 'nSeqEvento') || '1') + '.xml';
  if (t === 'nfse') {
    const n = primeira(xml, 'nNFSe', 'Numero');
    const prest = pessoa(primeira(xml, 'emit', 'PrestadorServico', 'Prestador')).doc;
    return 'nfse-' + (prest ? prest + '-' : '') + (n || hash) + '.xml';
  }
  return 'xml-' + hash + '.xml';
}

// ---------- o evento de cancelamento (11/11/2026: "preciso que ele puxe evento de cancelamento") ----------
/** O código do evento da NFS-e nacional, pelo nome do grupo dentro do infPedReg (<e101101>: 101101), ou ''. */
const codigoDoEventoNfse = xml => { const m = /<(?:\w+:)?e(\d{6})[\s>]/.exec(tag(xml, 'infPedReg')); return m ? m[1] : ''; };
const semZeros = v => String(v || '').replace(/\D/g, '').replace(/^0+/, '');
/**
 * O XML é o evento de cancelamento de uma nota: o 110111 da NF-e, da NFC-e e do CT-e, ou o cancelamento da NFS-e nacional
 * (o grupo e101101, "Cancelamento de NFS-e", e os outros "Cancelamento de NFS-e…" pela descrição, menos o indeferido). Só o cancelamento: a carta
 * de correção, a ciência e os outros eventos não.
 */
function ehCancelamento(xml) {
  if (tipoDoXml(xml) !== 'evento') return false;
  if (tag(xml, 'tpEvento')) return tag(xml, 'tpEvento') === '110111';
  const desc = tag(tag(xml, 'infPedReg'), 'xDesc');
  return codigoDoEventoNfse(xml) === '101101' || (/^cancelamento de nfs-?e\b/i.test(desc) && !/indeferid/i.test(desc));
}
/**
 * A identidade da nota cancelada: a chave de 44 dígitos (NF-e, NFC-e, CT-e) ou, na NFS-e nacional (chave de 50 dígitos: o
 * município, o ambiente, o tipo e a inscrição do prestador, o número…), "NFSE:<prestador>:<número>", que é como a nota
 * aparece no resumo (idParaCancelamento). '' quando não dá para dizer.
 */
function chaveCancelada(xml) {
  const ch = primeira(xml, 'chNFe', 'chCTe');
  if (ch) return ch;
  const n = tag(xml, 'chNFSe');
  return /^\d{50}$/.test(n) ? 'NFSE:' + semZeros(n.slice(9, 23)) + ':' + semZeros(n.slice(23, 36)) : '';
}
/** A identidade de uma nota do resumo para casar com o cancelamento (chaveCancelada). */
const idParaCancelamento = n => (n && n.chave) || (n && n.tipo === 'NFS-e' && n.numero ? 'NFSE:' + semZeros(n.emitente && n.emitente.doc) + ':' + semZeros(n.numero) : '');
/** Marca n.cancelada nas notas do resumo ({ emitidas, recebidas }) que estão em `canceladas` (as chaveCancelada). */
function marcarCanceladas(resumo, canceladas) {
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g] || []) { const id = idParaCancelamento(n); if (id && canceladas.has(id)) n.cancelada = true; }
  return resumo;
}

/** O CST do item: o CSOSN (Simples) ou a origem + o CST (ex.: 060). */
function cstDoItem(det) {
  const icms = tag(det, 'ICMS');
  const csosn = tag(icms, 'CSOSN');
  if (csosn) return csosn;
  const cst = tag(icms, 'CST');
  return cst ? (tag(icms, 'orig') || '') + cst : '';
}

/**
 * Um item da NF-e: o NCM, o CFOP, o CST/CSOSN, o CEST e o valor; e (13/10/2026, a apuração do Presumido e do Real) o ICMS
 * destacado, o ICMS-ST, o IPI e o CST do PIS, só quando têm (para o resumo não crescer à toa). Desde o resumo 4
 * (22/10/2026, a antecipação do ICMS do ES): a base e a alíquota do ICMS e as despesas do item (frete, seguro e outras,
 * menos o desconto), também só quando têm.
 */
function itemDoXml(det) {
  const it = { ncm: tag(det, 'NCM'), cfop: tag(det, 'CFOP'), cst: cstDoItem(det), cest: tag(det, 'CEST'), valor: num(tag(det, 'vProd')) };
  const icmsBloco = tag(det, 'ICMS');
  const icms = num(tag(icmsBloco, 'vICMS')), st = num(tag(icmsBloco, 'vICMSST')), ipi = num(tag(tag(det, 'IPI'), 'vIPI'));
  const cstPis = tag(tag(det, 'PIS'), 'CST');
  const prod = tag(det, 'prod');
  const bc = num(tag(icmsBloco, 'vBC')), aliq = num(tag(icmsBloco, 'pICMS'));
  const desp = num(num(tag(prod, 'vFrete')) + num(tag(prod, 'vSeg')) + num(tag(prod, 'vOutro')) - num(tag(prod, 'vDesc')));
  if (icms) it.icms = icms;
  if (st) it.st = st;
  if (ipi) it.ipi = ipi;
  if (cstPis) it.cstPis = cstPis;
  if (bc) it.bc = bc;
  if (aliq) it.aliq = aliq;
  if (desp) it.desp = desp;
  return it;
}

/** O resumo de uma nota (o que vai para o banco), { cancela } para o cancelamento, ou null (outro evento, XML desconhecido). */
function resumoDaNota(xml) {
  const t = tipoDoXml(xml);
  if (t === 'evento') return ehCancelamento(xml) && chaveCancelada(xml) ? { cancela: chaveCancelada(xml) } : null;
  if (t === 'nfe') {
    const ide = tag(xml, 'ide');
    const r = {
      tipo: tag(ide, 'mod') === '65' ? 'NFC-e' : 'NF-e',
      chave: /Id="NFe(\d{44})"/.exec(xml)[1], numero: tag(ide, 'nNF'), serie: tag(ide, 'serie'), data: data(primeira(ide, 'dhEmi', 'dEmi')),
      emitente: pessoa(tag(xml, 'emit')), destinatario: pessoa(tag(xml, 'dest')), valor: num(tag(tag(xml, 'ICMSTot'), 'vNF')),
      itens: blocos(xml, 'det').map(itemDoXml),
    };
    // o frete e o desconto da nota (22/10/2026: o Rateio de frete do Fiscal), só quando têm
    const tot = tag(xml, 'ICMSTot'), frete = num(tag(tot, 'vFrete')), desconto = num(tag(tot, 'vDesc'));
    if (frete) r.frete = frete;
    if (desconto) r.desconto = desconto;
    return r;
  }
  if (t === 'cte') {
    const ide = tag(xml, 'ide');
    const r = {
      tipo: 'CT-e', chave: /Id="CTe(\d{44})"/.exec(xml)[1], numero: tag(ide, 'nCT'), serie: tag(ide, 'serie'), data: data(tag(ide, 'dhEmi')),
      emitente: pessoa(tag(xml, 'emit')), destinatario: pessoa(primeira(xml, 'dest', 'rem')), valor: num(primeira(xml, 'vTPrest', 'vRec')), cfop: tag(ide, 'CFOP'),
    };
    // as NF-e que o CT-e transporta (infDoc/infNFe/chave) e o ICMS do CT-e (23/10/2026: o Rateio de frete pelo CT-e), só quando têm
    const nfes = [...new Set(blocos(tag(xml, 'infDoc'), 'infNFe').map(b => tag(b, 'chave')).filter(Boolean))];
    const icms = num(tag(tag(xml, 'imp'), 'vICMS'));
    if (nfes.length) r.nfes = nfes;
    if (icms) r.icms = icms;
    return r;
  }
  if (t === 'nfse') {
    const ret = {
      ISS: num(primeira(xml, 'vISSRet', 'ValorIssRetido', 'vISSQNRet')), INSS: num(primeira(xml, 'vRetCP', 'ValorInss')),
      IRRF: num(primeira(xml, 'vRetIRRF', 'ValorIr')), PIS: num(primeira(xml, 'vRetPIS', 'ValorPis')),
      COFINS: num(primeira(xml, 'vRetCOFINS', 'ValorCofins')), CSLL: num(primeira(xml, 'vRetCSLL', 'ValorCsll')),
    };
    // o ISS do ABRASF só é retido com IssRetido = 1
    if (!tag(xml, 'vISSRet') && tag(xml, 'IssRetido') && tag(xml, 'IssRetido') !== '1') ret.ISS = 0;
    return {
      tipo: 'NFS-e', chave: '', numero: primeira(xml, 'nNFSe', 'Numero'), serie: '', data: data(primeira(xml, 'dhEmi', 'dhProc', 'DataEmissao', 'Competencia')),
      emitente: pessoa(primeira(xml, 'emit', 'PrestadorServico', 'Prestador')), destinatario: pessoa(primeira(xml, 'toma', 'TomadorServico', 'Tomador')),
      valor: num(primeira(xml, 'vServ', 'ValorServicos')), nbs: primeira(xml, 'cNBS', 'CodigoNbs'),
      descricao: primeira(xml, 'xDescServ', 'Discriminacao').slice(0, 300),
      retencoes: Object.entries(ret).filter(([, v]) => v > 0).map(([imposto, valor]) => ({ imposto, valor })),
    };
  }
  return null;
}

// ---------- o .zip com todos os XMLs (07/10/2026: "quero que ele também salve um arquivo .zip na hora"), sem biblioteca ----------
const zlib = require('zlib');
const TABELA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Um .zip (deflate) com os arquivos [{ nome, xml }] (ou { nome, dados }, um Buffer): o cabeçalho de cada um, o diretório central e o fim. */
function zipDe(arquivos) {
  const locais = [];
  const centrais = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, 'utf8');
    const dados = a.dados || Buffer.from(a.xml, 'utf8');   // a.dados: binário já pronto (os PDFs, 09/11/2026)
    const comp = zlib.deflateRawSync(dados);
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(dados.length, 22); local.writeUInt16LE(nome.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(dados.length, 24); central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(pos, 42);
    locais.push(local, nome, comp);
    centrais.push(central, nome);
    pos += 30 + nome.length + comp.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(dir.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...locais, dir, fim]);
}

/** A versão do resumo (2 = os itens com o ICMS, o ICMS-ST, o IPI e o CST do PIS; 13/10/2026; 3 = o frete e o desconto da NF-e; 22/10/2026; 4 = a base, a alíquota e as despesas do item; 22/10/2026;
 * 5 = as NF-e que o CT-e transporta e o ICMS do CT-e; 23/10/2026). */
const VERSAO_DO_RESUMO = 5;

module.exports = { ehCancelamento, chaveCancelada, idParaCancelamento, marcarCanceladas, tomadorDoCte, cteDoCliente, cteQueEntram, VERSAO_DO_RESUMO, tipoDoXml, tipoDeNota, nomeDoArquivo, resumoDaNota, zipDe, crc32 };
