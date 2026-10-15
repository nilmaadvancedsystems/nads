// Teste da NFS-e (nfse.js), sem rede e sem banco: `node teste-nfse.js`.
//
// Monta uma DPS com os dados da nota real de 14/10/2026 (prestador, serviço, alíquota) e um tomador fictício, assina com um
// certificado autoassinado gerado na hora e confere: o Id, a ordem dos elementos (pelo XSD e, se a nota real estiver no
// PC, contra a DPS de dentro dela), o cIntContrib, a assinatura (xml-crypto) e o XSD oficial (xmllint-wasm, se instalado:
// é devDependency, não vai para a máquina do Google).
//
// A nota real (tem dados de cliente) NÃO fica no repositório: o teste a lê de NFSE_REAL ou do caminho padrão abaixo, e
// pula essa parte se não achar. Não imprime nada dela além da estrutura.
const fs = require('fs');
const os = require('os');
const path = require('path');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { SignedXml } = require('xml-crypto');
const nfse = require('./nfse');

const NOTA_REAL = process.env.NFSE_REAL || 'C:\\Users\\DPTO FISCAL 004\\EurekaLog\\Downloads\\31680021227872981000113260000000409926100002961714.xml';
const PASTA_XSD = path.join(__dirname, 'nfse-xsd');

let falhas = 0;
let total = 0;
function confere(nome, ok, detalhe) {
  total++;
  if (!ok) falhas++;
  console.log((ok ? '  ok   ' : '  FALHA ') + nome + (detalhe ? ' — ' + detalhe : ''));
}

// ---------- os dados ----------
const config = {
  ambiente: 'homologacao',
  prestador: { cnpj: '27872981000113', opSimpNac: 3, regApTribSN: 1, regEspTrib: 0, cLocEmi: '3168002', im: '250517/6308', fone: '3838451234' },
  servico: { cTribNac: '171901', cIntContrib: '1719', cNBS: '113022100', pAliq: 3.74, tribISSQN: 1, tpRetISSQN: 1 },
  serie: '1',
  proximoNumero: { homologacao: 1, producao: 1 },
};
const pedido = {
  status: 'pedida', ambiente: 'homologacao', pedidoPor: 'teste', pedidoEm: '2026-10-15T12:00:00.000Z',
  tomador: {
    documento: '529.982.247-25', nome: 'TOMADOR DE TESTE “FICTÍCIO” — LTDA', email: 'tomador@exemplo.com.br', fone: '(38) 99999-0000',
    endereco: { cMun: '3130655', cep: '39536-000', logradouro: 'FAZENDA DE TESTE', numero: '0', bairro: 'ZONA RURAL' },
  },
  servico: { descricao: 'Serviços Contábeis Ref. 09/2026 & <teste>', valor: 950, competencia: '2026-10-14' },
};

// ---------- utilidades de DOM ----------
const elementos = no => Array.from(no.childNodes || []).filter(n => n.nodeType === 1);
const filho = (no, nome) => elementos(no).find(n => n.localName === nome);
function caminhos(no, prefixo = '', acc = []) {
  for (const f of elementos(no)) {
    const p = prefixo + '/' + f.localName;
    acc.push(p);
    caminhos(f, p, acc);
  }
  return acc;
}
const parse = xml => new DOMParser().parseFromString(xml, 'text/xml');

// ---------- certificado autoassinado ----------
function certificadoDeTeste() {
  const chaves = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
  const nome = [{ name: 'commonName', value: 'NILMA CONTABILIDADE LTDA:27872981000113' }, { name: 'countryName', value: 'BR' }];
  cert.setSubject(nome);
  cert.setIssuer(nome);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const senha = 'senha-de-teste';
  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], senha, { algorithm: '3des' });
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-teste-'));
  const pfx = path.join(pasta, 'teste.pfx');
  const arqSenha = path.join(pasta, 'teste.senha');
  fs.writeFileSync(pfx, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
  fs.writeFileSync(arqSenha, senha + '\n');
  return { pfx, arqSenha, pasta };
}

// a ordem de cada grupo, copiada das sequências do XSD (tiposComplexos_v1.01.xsd) — só os elementos possíveis
const ORDEM_XSD = {
  infDPS: ['tpAmb', 'dhEmi', 'verAplic', 'serie', 'nDPS', 'dCompet', 'tpEmit', 'cMotivoEmisTI', 'chNFSeRej', 'cLocEmi', 'subst', 'prest', 'toma', 'interm', 'serv', 'valores', 'IBSCBS'],
  prest: ['CNPJ', 'CPF', 'NIF', 'cNaoNIF', 'CAEPF', 'IM', 'xNome', 'end', 'fone', 'email', 'regTrib'],
  regTrib: ['opSimpNac', 'regApTribSN', 'regEspTrib'],
  toma: ['CNPJ', 'CPF', 'NIF', 'cNaoNIF', 'CAEPF', 'IM', 'xNome', 'end', 'fone', 'email'],
  end: ['endNac', 'endExt', 'xLgr', 'nro', 'xCpl', 'xBairro'],
  endNac: ['cMun', 'CEP'],
  serv: ['locPrest', 'cServ', 'comExt', 'obra', 'atvEvento', 'infoCompl'],
  cServ: ['cTribNac', 'cTribMun', 'xDescServ', 'cNBS', 'cIntContrib'],
  infoCompl: ['idDocTec', 'docRef', 'xPed', 'gItemPed', 'xInfComp'],
  valores: ['vServPrest', 'vDescCondIncond', 'vDedRed', 'trib'],
  vServPrest: ['vReceb', 'vServ'],
  trib: ['tribMun', 'tribFed', 'totTrib'],
  tribMun: ['tribISSQN', 'cPaisResult', 'tpImunidade', 'exigSusp', 'BM', 'tpRetISSQN', 'pAliq'],
  totTrib: ['vTotTrib', 'pTotTrib', 'indTotTrib', 'pTotTribSN'],
};
const OBRIGATORIOS = {
  infDPS: ['tpAmb', 'dhEmi', 'verAplic', 'serie', 'nDPS', 'dCompet', 'tpEmit', 'cLocEmi', 'prest', 'serv', 'valores'],
  prest: ['regTrib'], regTrib: ['opSimpNac', 'regEspTrib'], toma: ['xNome'], cServ: ['cTribNac', 'xDescServ'],
  valores: ['vServPrest', 'trib'], trib: ['tribMun', 'totTrib'], tribMun: ['tribISSQN', 'tpRetISSQN'],
};
function conferirOrdem(no, erros) {
  const nome = no.localName;
  const ordem = ORDEM_XSD[nome];
  const nomes = elementos(no).map(f => f.localName);
  if (ordem) {
    let ultimo = -1;
    for (const n of nomes) {
      const i = ordem.indexOf(n);
      if (i < 0) erros.push(nome + ': elemento inesperado ' + n);
      else if (i <= ultimo) erros.push(nome + ': ' + n + ' fora de ordem');
      else ultimo = i;
    }
    for (const o of OBRIGATORIOS[nome] || []) if (!nomes.includes(o)) erros.push(nome + ': falta ' + o);
  }
  elementos(no).forEach(f => conferirOrdem(f, erros));
}

async function validarXsd(xml, principal, arquivos) {
  let validateXML;
  try { ({ validateXML } = require('xmllint-wasm')); } catch (e) { return null; }
  const ler = n => ({ fileName: n, contents: fs.readFileSync(path.join(PASTA_XSD, n), 'utf8') });
  const r = await validateXML({ xml: [{ fileName: 'doc.xml', contents: xml }], schema: [ler(principal)], preload: arquivos.map(ler) });
  return r;
}

// ---------- banco de mentira (só o que o nfse.js usa do Firestore) ----------
function bancoDeMentira() {
  const docs = new Map();
  const ouvintes = [];
  const copia = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const apagar = v => v && v.constructor && v.constructor.name === 'DeleteTransform';
  let avisando = false;
  function avisar() {
    if (avisando) return;
    avisando = true;
    setImmediate(() => {
      avisando = false;
      for (const o of ouvintes) o.rodar();
    });
  }
  function gravar(chave, dados, modo) {
    if (modo === 'update' && !docs.has(chave)) throw new Error('documento não existe: ' + chave);
    const atual = modo === 'set' ? {} : copia(docs.get(chave) || {});
    for (const [k, v] of Object.entries(dados)) {
      const partes = modo === 'update' ? k.split('.') : [k];
      let alvo = atual;
      for (const p of partes.slice(0, -1)) { if (!alvo[p] || typeof alvo[p] !== 'object') alvo[p] = {}; alvo = alvo[p]; }
      const ult = partes[partes.length - 1];
      if (apagar(v)) delete alvo[ult];
      else alvo[ult] = copia(v);
    }
    docs.set(chave, atual);
    avisar();
  }
  function ref(col, id) {
    const chave = col + '/' + id;
    const r = {
      id, chave,
      get: async () => foto(),
      set: async (d, o) => gravar(chave, d, o && o.merge ? 'merge' : 'set'),
      update: async d => gravar(chave, d, 'update'),
      onSnapshot(cb) {
        let antes = null;
        const o = { rodar: () => { const agora = JSON.stringify(docs.get(chave) || null); if (agora !== antes) { antes = agora; cb(foto()); } } };
        ouvintes.push(o);
        avisar();
        return () => ouvintes.splice(ouvintes.indexOf(o), 1);
      },
    };
    const foto = () => ({ id, ref: r, exists: docs.has(chave), data: () => copia(docs.get(chave)) });
    return r;
  }
  function consulta(col, filtros) {
    const casa = d => filtros.every(([c, op, v]) => (op === 'in' ? v.includes(d[c]) : d[c] === v));
    const atuais = () => [...docs.entries()].filter(([k, d]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/') && casa(d))
      .map(([k]) => ref(col, k.slice(col.length + 1)));
    return {
      where: (c, op, v) => consulta(col, filtros.concat([[c, op, v]])),
      get: async () => { const lista = await Promise.all(atuais().map(r => r.get())); return { docs: lista, size: lista.length }; },
      onSnapshot(cb) {
        const vistos = new Map();
        let primeira = true;
        const o = {
          rodar: () => {
            const agora = new Map(atuais().map(r => [r.id, JSON.stringify(docs.get(r.chave))]));
            const mud = [];
            for (const [id, j] of agora) if (!vistos.has(id)) mud.push({ type: 'added', id }); else if (vistos.get(id) !== j) mud.push({ type: 'modified', id });
            for (const id of vistos.keys()) if (!agora.has(id)) mud.push({ type: 'removed', id });
            if (!mud.length && !primeira) return;
            primeira = false;
            vistos.clear();
            agora.forEach((j, id) => vistos.set(id, j));
            const fotos = mud.map(m => ({ type: m.type, doc: { id: m.id, ref: ref(col, m.id), exists: true, data: () => copia(docs.get(col + '/' + m.id)) || {} } }));
            cb({ docChanges: () => fotos, docs: [...agora.keys()].map(id => ({ id, data: () => copia(docs.get(col + '/' + id)) })) });
          },
        };
        ouvintes.push(o);
        avisar();
        return () => ouvintes.splice(ouvintes.indexOf(o), 1);
      },
    };
  }
  return {
    ler: chave => copia(docs.get(chave)),
    collection: col => ({ doc: id => ref(col, id), where: (c, op, v) => consulta(col, [[c, op, v]]) }),
    async runTransaction(fn) {
      const ops = [];
      const r = await fn({ get: x => x.get(), update: (x, d) => ops.push([x, d]) });
      for (const [x, d] of ops) gravar(x.chave, d, 'update');
      return r;
    },
  };
}

// ---------- prefeitura de mentira (troca o fetch) ----------
function prefeituraDeMentira(certPem) {
  const zlib = require('zlib');
  const gz = x => zlib.gzipSync(Buffer.from(x)).toString('base64');
  const p = { chamadas: [], recebidas: new Map(), recusarProximo: false, assinaturasOk: true, notas: 0 };
  global.fetch = async (url, opts) => {
    const u = new URL(url);
    const corpo = opts.body ? JSON.parse(opts.body) : null;
    p.chamadas.push({ metodo: opts.method, caminho: u.pathname, token: u.searchParams.get('token') });
    const resp = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    let m;
    if (opts.method === 'POST' && /\/nfse$/.test(u.pathname)) {
      const xml = nfse.desgzipB64(corpo.dpsXmlGZipB64);
      const d = parse(xml);
      const s = d.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
      const v = new SignedXml({ publicCert: certPem });
      v.loadSignature(s);
      if (!v.checkSignature(xml)) p.assinaturasOk = false;
      const id = /Id="(DPS\d{42})"/.exec(xml)[1];
      if (p.recusarProximo) { p.recusarProximo = false; return resp(400, { idDPS: id, erros: [{ Codigo: 'E9999', Descricao: 'Erro de teste da prefeitura.' }] }); }
      p.recebidas.set(id, { consultas: 0 });
      return resp(201, { tipoAmbiente: 2, idDPS: id, nfseXmlGZipB64: '<em processamento no ambiente nacional>' });
    }
    if (opts.method === 'GET' && (m = /\/nfseDps\/(DPS\d{42})$/.exec(u.pathname))) {
      const r = p.recebidas.get(m[1]);
      if (!r) return resp(404, { erros: [{ Codigo: '404', Descricao: 'DPS não encontrada' }] });
      if (++r.consultas < 2) return resp(200, { idDPS: m[1], nfseXmlGZipB64: '<em processamento no ambiente nacional>' });
      if (!r.chave) { r.numero = String(2600000005000 + ++p.notas); r.chave = '3168002' + '2' + '27872981000113' + '26' + r.numero.padStart(25, '0').slice(-25); r.chave = r.chave.padEnd(50, '0').slice(0, 50); }
      return resp(200, { idDPS: m[1], chaveAcesso: r.chave, nfseXmlGZipB64: gz('<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS' + r.chave + '"><nNFSe>' + r.numero + '</nNFSe></infNFSe></NFSe>') });
    }
    if (opts.method === 'POST' && /\/eventos$/.test(u.pathname)) return resp(201, { eventoXmlGZipB64: gz('<evento>cancelada</evento>') });
    return resp(404, {});
  };
  return p;
}

async function esperar(cond, ms = 8000) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) { if (cond()) return true; await new Promise(r => setTimeout(r, 30)); }
  return false;
}

async function testarFluxo({ pfx, arqSenha, cert }) {
  const db = bancoDeMentira();
  const linhas = [];
  const log = (...m) => linhas.push(m.join(' '));
  const pref = prefeituraDeMentira(cert.certPem);
  await db.collection('config').doc('nfse').set(JSON.parse(JSON.stringify(config)));
  await db.collection('segredos').doc('nfse').set({ token: 'TOKEN-PROD-SECRETO', tokenHomologacao: 'TOKEN-HOMOLOG-SECRETO', gravadoEm: 'x', gravadoPor: 'teste' });
  nfse.iniciarNfse(db, log, { pfx, senha: arqSenha, consultaMs: 150 });
  const est = () => db.ler('robo/nfse') || {};
  confere('robo/nfse ligado, com o certificado', await esperar(() => est().ligado === true) && est().motivo === '' && est().certificado && est().certificado.titular === 'NILMA CONTABILIDADE LTDA', JSON.stringify(est()));

  const em = id => db.ler('nfseEmissoes/' + id) || {};
  const prox = () => db.ler('config/nfse').proximoNumero.homologacao;
  await db.collection('nfseEmissoes').doc('a').set(JSON.parse(JSON.stringify(pedido)));
  confere('pedida → autorizada', await esperar(() => em('a').status === 'autorizada'), em('a').status + ' ' + JSON.stringify(em('a').erros || ''));
  confere('dps com série 1, número 1 e o Id', em('a').dps && em('a').dps.numero === 1 && em('a').dps.serie === '1' && em('a').dps.id === 'DPS316800222787298100011300001000000000000001');
  confere('número da NFS-e, chave e XML gravados', /^\d+$/.test(em('a').numeroNfse || '') && /^\d{50}$/.test(em('a').chaveAcesso || '') && /<NFSe/.test(em('a').xmlNfse || ''));
  confere('proximoNumero.homologacao foi para 2', prox() === 2);
  confere('a prefeitura recebeu a DPS assinada e válida', pref.assinaturasOk && pref.recebidas.size === 1);
  confere('usou o token de homologação', pref.chamadas.every(c => c.token === 'TOKEN-HOMOLOG-SECRETO'));

  await db.collection('nfseEmissoes').doc('b').set(Object.assign(JSON.parse(JSON.stringify(pedido)), { tomador: { documento: '11111111111', nome: 'X' } }));
  confere('pedido com CPF inválido → erro explicado', await esperar(() => em('b').status === 'erro') && /CPF/.test(JSON.stringify(em('b').erros)));
  confere('erro no pedido não gasta número', prox() === 2 && !em('b').dps);

  await db.collection('nfseEmissoes').doc('a').update({ status: 'cancelamento-pedido', cancelamento: { cMotivo: '1', motivo: 'Erro na emissão do valor', pedidoPor: 'teste', pedidoEm: 'x' } });
  confere('cancelamento-pedido → cancelada', await esperar(() => em('a').status === 'cancelada') && !!em('a').canceladaEm && !em('a').cancelamento.enviandoEm, em('a').status);
  confere('o cancelamento foi para /nfse/{chave}/eventos', pref.chamadas.some(c => c.metodo === 'POST' && c.caminho.endsWith('/nfse/' + em('a').chaveAcesso + '/eventos')));

  pref.recusarProximo = true;
  await db.collection('nfseEmissoes').doc('c').set(JSON.parse(JSON.stringify(pedido)));
  confere('recusa da prefeitura → erro com o código dela', await esperar(() => em('c').status === 'erro') && em('c').erros[0].codigo === 'E9999');
  const idC = em('c').dps.id;
  await db.collection('nfseEmissoes').doc('c').update({ status: 'pedida' });
  confere('reenvio → autorizada', await esperar(() => em('c').status === 'autorizada'), em('c').status);
  confere('reenvio com o MESMO idDPS e número (2)', em('c').dps.id === idC && em('c').dps.numero === 2 && prox() === 3);

  await db.collection('segredos').doc('nfse').set({ gravadoEm: 'x' });
  confere('sem token → robo/nfse desligado e diz por quê', await esperar(() => est().ligado === false) && /token/.test(est().motivo), est().motivo);
  await db.collection('nfseEmissoes').doc('d').set(JSON.parse(JSON.stringify(pedido)));
  confere('pedido sem token → erro explicado, sem gastar número', await esperar(() => em('d').status === 'erro') && /token/.test(JSON.stringify(em('d').erros)) && prox() === 3);

  confere('o token não aparece em nenhum log nem documento', !linhas.join('\n').includes('SECRETO') &&
    !['a', 'b', 'c', 'd'].some(id => JSON.stringify(em(id)).includes('SECRETO')) && !JSON.stringify(est()).includes('SECRETO'));
  if (process.env.NFSE_VER_LOG) console.log(linhas.join('\n'));
}

(async () => {
  console.log('NFS-e — teste sem rede\n');

  // 1. o Id
  console.log('Id da DPS');
  confere('Id do exemplo da E&L', nfse.idDps('3301207', '99999999999999', '1', 1) === 'DPS330120729999999999999900001000000000000001');
  confere('Id da nota real (série 70000 do portal)', nfse.idDps('3168002', '27872981000113', '70000', '260000000000002') === 'DPS316800222787298100011370000260000000000002');

  // 2. a conferência dos dados
  console.log('\nConferência do config e do pedido');
  confere('config de exemplo sem problemas', nfse.problemasDaConfig(config).length === 0, nfse.problemasDaConfig(config).join('; '));
  confere('pedido de exemplo sem problemas', nfse.problemasDoPedido(pedido).length === 0, nfse.problemasDoPedido(pedido).join('; '));
  confere('config sem cIntContrib é recusado', nfse.problemasDaConfig(Object.assign({}, config, { servico: Object.assign({}, config.servico, { cIntContrib: '' }) })).some(p => /cIntContrib/.test(p)));
  confere('Simples ME/EPP sem regApTribSN é recusado', nfse.problemasDaConfig(Object.assign({}, config, { prestador: Object.assign({}, config.prestador, { regApTribSN: null }) })).some(p => /regApTribSN/.test(p)));
  confere('série 70000 (do portal) é recusada', nfse.problemasDaConfig(Object.assign({}, config, { serie: '70000' })).some(p => /série/.test(p)));
  confere('CPF inválido é recusado', nfse.problemasDoPedido(Object.assign({}, pedido, { tomador: Object.assign({}, pedido.tomador, { documento: '12345678900' }) })).some(p => /CPF/.test(p)));
  confere('endereço pela metade é recusado', nfse.problemasDoPedido(Object.assign({}, pedido, { tomador: Object.assign({}, pedido.tomador, { endereco: { cMun: '3130655' } }) })).length >= 3);
  confere('config inexistente explica', /config\/nfse/.test(nfse.problemasDaConfig(null)[0]));

  // 3. a DPS
  console.log('\nMontagem da DPS');
  const xml = nfse.montarDps(config, pedido, 1, { agora: '2026-10-15T15:00:00Z' });
  const doc = parse(xml);
  const raiz = doc.documentElement;
  const inf = filho(raiz, 'infDPS');
  const id = inf.getAttribute('Id');
  confere('raiz DPS no namespace da NFS-e, versão 1.01', raiz.localName === 'DPS' && raiz.namespaceURI === 'http://www.sped.fazenda.gov.br/nfse' && raiz.getAttribute('versao') === '1.01');
  confere('Id = DPS + 3168002 + 2 + CNPJ + 00001 + 000000000000001', id === 'DPS316800222787298100011300001000000000000001' && id.length === 45, id);
  confere('nDPS sem zeros à esquerda', filho(inf, 'nDPS').textContent === '1');
  confere('tpAmb 2 em homologação', filho(inf, 'tpAmb').textContent === '2');
  confere('tpAmb 1 em produção', /<tpAmb>1<\/tpAmb>/.test(nfse.montarDps(config, Object.assign({}, pedido, { ambiente: 'producao' }), 1)));
  confere('dhEmi em Brasília (-03:00)', filho(inf, 'dhEmi').textContent === '2026-10-15T12:00:00-03:00', filho(inf, 'dhEmi').textContent);
  confere('dCompet = a data do serviço', filho(inf, 'dCompet').textContent === '2026-10-14');
  const prest = filho(inf, 'prest');
  confere('prest só com CNPJ e regTrib (sem IM e sem fone)', elementos(prest).map(e => e.localName).join(',') === 'CNPJ,regTrib');
  confere('regTrib 3 / 1 / 0', elementos(filho(prest, 'regTrib')).map(e => e.textContent).join(',') === '3,1,0');
  const toma = filho(inf, 'toma');
  confere('tomador com CPF de 11 dígitos', filho(toma, 'CPF') && filho(toma, 'CPF').textContent === '52998224725');
  confere('tomador CNPJ quando tem 14 dígitos', /<toma><CNPJ>27872981000113<\/CNPJ>/.test(nfse.montarDps(config, Object.assign({}, pedido, { tomador: Object.assign({}, pedido.tomador, { documento: '27.872.981/0001-13' }) }), 1)));
  confere('nome do tomador sem aspas curvas e travessão', filho(toma, 'xNome').textContent === 'TOMADOR DE TESTE "FICTÍCIO" - LTDA', filho(toma, 'xNome').textContent);
  confere('fone do tomador só com dígitos', filho(toma, 'fone').textContent === '38999990000');
  confere('sem endereço quando o pedido não traz', !/<end>/.test(nfse.montarDps(config, Object.assign({}, pedido, { tomador: { documento: '52998224725', nome: 'X' } }), 1)));
  const cServ = filho(filho(inf, 'serv'), 'cServ');
  confere('cIntContrib presente (1719)', filho(cServ, 'cIntContrib') && filho(cServ, 'cIntContrib').textContent === '1719');
  confere('descrição com & e < escapados', filho(cServ, 'xDescServ').textContent === 'Serviços Contábeis Ref. 09/2026 & <teste>' && /&amp; &lt;teste&gt;/.test(xml));
  confere('infoCompl com o texto padrão do IBPT', /<infoCompl><xInfComp>Percentual aproximado de tributos: 16,42% Fonte: IBPT<\/xInfComp><\/infoCompl>/.test(xml));
  confere('sem infoCompl quando a config manda vazio', !/infoCompl/.test(nfse.montarDps(Object.assign({}, config, { servico: Object.assign({}, config.servico, { infoCompl: '' }) }), pedido, 1)));
  confere('vServ com 2 casas', /<vServ>950.00<\/vServ>/.test(xml));
  confere('pAliq 3.74', /<pAliq>3.74<\/pAliq>/.test(xml));
  confere('sem pAliq quando a config não informa', !/pAliq/.test(nfse.montarDps(Object.assign({}, config, { servico: Object.assign({}, config.servico, { pAliq: null }) }), pedido, 1)));
  confere('totTrib com indTotTrib 0', /<totTrib><indTotTrib>0<\/indTotTrib><\/totTrib>/.test(xml));
  confere('sem tribFed e sem IBSCBS', !/tribFed|IBSCBS|piscofins/.test(xml));
  confere('sem espaços entre as tags', !/>\s+</.test(xml));
  const errosOrdem = [];
  conferirOrdem(inf, errosOrdem);
  confere('ordem e obrigatórios conforme o XSD (conferência manual)', errosOrdem.length === 0, errosOrdem.join('; '));

  // 4. contra a DPS de dentro da nota real
  console.log('\nComparação com a nota real autorizada (14/10/2026)');
  let real = null;
  try { real = fs.readFileSync(NOTA_REAL, 'utf8'); } catch (e) { console.log('  (pulado: a nota real não está em ' + NOTA_REAL + ')'); }
  if (real) {
    const dReal = parse(real);
    const dpsReal = dReal.getElementsByTagNameNS('http://www.sped.fazenda.gov.br/nfse', 'infDPS')[0];
    const a = caminhos(dpsReal);
    const b = caminhos(inf);
    const so = (x, y) => x.filter(c => !y.includes(c));
    confere('mesmos elementos, na mesma ordem', a.join('|') === b.join('|'),
      a.join('|') === b.join('|') ? a.length + ' elementos' : 'só na real: ' + so(a, b).join(', ') + ' / só na nossa: ' + so(b, a).join(', '));
    const valor = (d, n) => { const e = d.getElementsByTagNameNS('http://www.sped.fazenda.gov.br/nfse', n); return e.length ? e[0].textContent : null; };
    const iguais = ['cLocEmi', 'tpEmit', 'opSimpNac', 'regApTribSN', 'regEspTrib', 'cLocPrestacao', 'cTribNac', 'cNBS', 'cIntContrib', 'xInfComp', 'vServ', 'tribISSQN', 'tpRetISSQN', 'pAliq', 'indTotTrib']
      .filter(n => valor(dpsReal, n) !== valor(inf, n));
    confere('mesmos valores fixos (prestador, serviço, ISS, valor)', iguais.length === 0, iguais.join(', '));
    const cnpjReal = valor(dpsReal, 'CNPJ');
    confere('mesmo CNPJ do prestador', cnpjReal === '27872981000113');
    confere('número da NFS-e lido do XML', nfse.numeroDaNota(real) === '2600000004099', nfse.numeroDaNota(real));
    confere('chave de acesso lida do XML', nfse.chaveDaNota(real) === '31680021227872981000113260000000409926100002961714');
    // a nossa verificação de assinatura aceita a assinatura de verdade (prova de que a canonicalização é a mesma)
    try {
      const sigReal = dReal.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
      const certB64 = sigReal.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'X509Certificate')[0].textContent.replace(/\s/g, '');
      const v = new SignedXml({ publicCert: '-----BEGIN CERTIFICATE-----\n' + certB64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n' });
      v.loadSignature(sigReal);
      confere('assinatura da nota real confere com o xml-crypto (c14n inclusiva, RSA-SHA1)', v.checkSignature(real));
    } catch (err) { confere('assinatura da nota real confere com o xml-crypto', false, err.message); }
  }

  // 5. a assinatura
  console.log('\nAssinatura');
  const { pfx, arqSenha, pasta } = certificadoDeTeste();
  const cert = nfse.lerCertificadoComChave(pfx, arqSenha);
  confere('certificado lido do .pfx (chave + certificado)', !cert.erro && /BEGIN RSA PRIVATE KEY/.test(cert.chavePem) && cert.documento === '27872981000113', cert.erro || cert.titular);
  confere('senha errada explica', /senha/.test(nfse.lerCertificadoComChave(pfx, (fs.writeFileSync(path.join(pasta, 'errada'), 'x'), path.join(pasta, 'errada'))).erro || ''));
  const assinado = nfse.assinar(xml, 'infDPS', cert);
  const dA = parse(assinado);
  const filhosRaiz = elementos(dA.documentElement).map(e => e.localName);
  confere('Signature logo depois do infDPS, no fim do DPS', filhosRaiz.join(',') === 'infDPS,Signature');
  confere('declaração XML mantida', assinado.startsWith('<?xml version="1.0" encoding="UTF-8"?><DPS'));
  confere('Reference URI = #Id', assinado.includes('<Reference URI="#' + id + '">'));
  confere('c14n inclusiva, RSA-SHA1 e SHA1, enveloped', assinado.includes('CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"')
    && assinado.includes('SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"')
    && assinado.includes('DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"')
    && assinado.includes('Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"'));
  confere('KeyInfo/X509Data/X509Certificate', /<KeyInfo><X509Data><X509Certificate>[A-Za-z0-9+/=]+<\/X509Certificate><\/X509Data><\/KeyInfo>/.test(assinado));
  const verificar = (x, certPem) => {
    const d = parse(x);
    const s = d.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
    const v = new SignedXml({ publicCert: certPem });
    v.loadSignature(s);
    try { return v.checkSignature(x); } catch (e) { return false; }
  };
  confere('assinatura valida (checkSignature)', verificar(assinado, cert.certPem));
  confere('assinatura acusa alteração no valor', !verificar(assinado.replace('<vServ>950.00</vServ>', '<vServ>9500.00</vServ>'), cert.certPem));
  const gz = nfse.gzipB64(assinado);
  confere('gzip + base64 vai e volta', nfse.desgzipB64(gz) === assinado);
  confere('texto "em processamento" não é XML', nfse.desgzipB64('<em processamento no ambiente nacional>') === null);

  // 6. o cancelamento
  console.log('\nCancelamento');
  const chave = '31680021227872981000113260000000409926100002961714';
  const canc = nfse.montarCancelamento({ ambiente: 'homologacao', cnpjAutor: '27872981000113', chaveAcesso: chave, cMotivo: '1', motivo: 'Erro na emissão: valor errado', agora: '2026-10-15T15:00:00Z' });
  const cancAss = nfse.assinar(canc, 'infPedReg', cert);
  confere('Id do pedido = PRE + chave + 101101 (59)', cancAss.includes('Id="PRE' + chave + '101101"') && ('PRE' + chave + '101101').length === 59);
  confere('assinatura do cancelamento valida', verificar(cancAss, cert.certPem));
  confere('xDesc "Cancelamento de NFS-e"', cancAss.includes('<e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>1</cMotivo><xMotivo>Erro na emissão: valor errado</xMotivo></e101101>'));

  // 7. o XSD oficial
  console.log('\nXSD oficial (xmllint-wasm)');
  const comuns = ['tiposComplexos_v1.01.xsd', 'tiposSimples_v1.01.xsd', 'xmldsig-core-schema.xsd'];
  const rDps = await validarXsd(assinado, 'DPS_v1.01.xsd', comuns);
  if (!rDps) console.log('  (pulado: xmllint-wasm não instalado — rode npm install em robo/)');
  else {
    confere('DPS assinada válida no DPS_v1.01.xsd', rDps.valid, rDps.errors.map(e => e.message).join(' | '));
    const rCanc = await validarXsd(cancAss, 'pedRegEvento_v1.01.xsd', comuns.concat('tiposEventos_v1.01.xsd'));
    confere('cancelamento assinado válido no pedRegEvento_v1.01.xsd', rCanc.valid, rCanc.errors.map(e => e.message).join(' | '));
    const ruim = await validarXsd(xml.replace('<cIntContrib>1719</cIntContrib>', '').replace('<tpAmb>2</tpAmb><dhEmi>', '<dhEmi>'), 'DPS_v1.01.xsd', comuns);
    confere('o XSD acusa uma DPS errada (prova de que valida de verdade)', !ruim.valid);
  }

  // 8. respostas da E&L
  console.log('\nRespostas da E&L');
  const e = nfse.errosDaResposta({ erros: [{ Codigo: 'E0037', Descricao: 'O código do município emissor...' }] });
  confere('erros { Codigo, Descricao } viram { codigo, descricao }', e.length === 1 && e[0].codigo === 'E0037' && e[0].descricao.startsWith('O código'));
  confere('sem erros = lista vazia', nfse.errosDaResposta({ idDPS: 'x', nfseXmlGZipB64: '<em processamento>' }).length === 0);
  confere('URLs: homologação com o segmento, produção sem', nfse.ENDERECOS.envio('homologacao').endsWith('/api/nacional/homologacao/nfse') && nfse.ENDERECOS.envio('producao').endsWith('/api/nacional/nfse')
    && nfse.ENDERECOS.consultaDps('producao', 'DPS1').endsWith('/api/nacional/nfseDps/DPS1'));

  // 9. o módulo inteiro, com um banco e uma prefeitura de mentira (sem rede)
  console.log('\nFluxo do módulo (banco e prefeitura de mentira)');
  await testarFluxo({ pfx, arqSenha, cert });

  fs.rmSync(pasta, { recursive: true, force: true });
  console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error('ERRO:', err.stack || err.message); process.exit(1); });
