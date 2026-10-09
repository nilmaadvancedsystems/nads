// O SIEG no Fiscal do nads (Vitor, 06/10/2026: "integre a API do SIEG ao app"). Roda no processo do arquivador, neste
// PC (as credenciais ficam só aqui: scripts/sieg_credenciais.json, fora do git). Faz duas coisas, e só elas:
//
// 1. Toda madrugada conta as notas de cada cliente ativo com CNPJ no mês (emitidas e recebidas, por tipo) e grava em
//    siegContagens/{codigo}_{AAAA-MM}. O Fiscal do nads mostra ("SIEG: 214 notas") e avisa de quem está com zero.
// 2. Atende os pedidos do nads (pedidosSieg): baixa os XMLs de saída do mês de uma empresa (NF-e e NFC-e, com os
//    eventos de cancelamento) e grava só os números por série e as canceladas em siegSaidas/{codigo}_{AAAA-MM}, que a
//    Conferência de Saídas usa para achar os buracos da numeração.
//
// A API (integracoes.sieg.com › Clientes SIEG): o token (create-jwt, com o ClientId e a SecretKey do cadastro do
// sistema, vale 24 h) e a API Key em toda chamada. Limites: contar-xmls 5 por minuto; baixar-xmls 2 por minuto, 50 XMLs
// cada. Respondeu 429: espera e tenta de novo. Sem as três credenciais, fica desligado (e diz por quê em robo/sieg).
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const CREDENCIAIS = path.join(__dirname, 'sieg_credenciais.json');
// a pasta do Drive deste PC (o Google Drive para computador): os XMLs do mês vão para Claudio Secretario/AAAA-MM/<cliente>,
// a mesma do "Salvar no Drive" do Gmail, de onde a rotina das 9h arquiva e o Alterdata importa (07/10/2026)
const PASTA_DO_DRIVE = process.env.PASTA_DESTINO || 'G:\\Meu Drive\\Claudio Secretario';
const sx = require('./sieg-xmls');
const BASE = 'https://api.sieg.com/api/v1/';
const ESPERA_MS = { 'contar-xmls': 13000, 'baixar-xmls': 31000, 'create-jwt': 2000 };
const TIPO = { NFe: 1, CTe: 2, NFSe: 3, NFCe: 4, CFe: 5 };

const dormir = ms => new Promise(r => setTimeout(r, ms));
const soDigitos = v => String(v || '').replace(/\D/g, '');
// o documento do cliente: CNPJ (14) ou CPF (11, o produtor rural; o SIEG conta pelos dois, 07/10/2026)
const documentoValido = d => d.length === 14 || d.length === 11;
// o código do cliente no Alterdata: nos clientes do Entregas ele está em codigoOrigem (07/10/2026: com `codigo` só, a
// contagem não achava ninguém)
const codigoDe = x => soDigitos(x && (x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem));

function lerCredenciais() {
  try {
    const c = JSON.parse(fs.readFileSync(CREDENCIAIS, 'utf8'));
    const faltam = ['apiKey', 'clientId', 'secretKey'].filter(k => !String(c[k] || '').trim());
    return { c, faltam };
  } catch (e) { return { c: null, faltam: ['apiKey', 'clientId', 'secretKey'] }; }
}

// o baixar-xmls às vezes leva mais de 2 minutos (07/10/2026, ~100 s numa chamada de 2 notas): 5 minutos para ele
const LIMITE_MS = { 'baixar-xmls': 5 * 60000 };
// o .zip entregue ao nads: pedaços de 900 mil caracteres (Base64), guardados por 1 dia
const ZIP_PEDACO = 900000;
const ZIP_GUARDADO_MS = 24 * 3600 * 1000;

function http(metodo, rota, headers, corpo) {
  return new Promise((resolve, reject) => {
    const dados = corpo == null ? null : Buffer.from(JSON.stringify(corpo));
    const req = https.request(BASE + rota, {
      method: metodo, timeout: LIMITE_MS[rota] || 120000,
      headers: Object.assign({ Accept: 'application/json' }, dados ? { 'Content-Type': 'application/json', 'Content-Length': dados.length } : {}, headers),
    }, res => {
      const partes = [];
      res.on('data', d => partes.push(d));
      res.on('end', () => { const bytes = Buffer.concat(partes); resolve({ status: res.statusCode, texto: bytes.toString('utf8'), bytes }); });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('o SIEG não respondeu em ' + Math.round((LIMITE_MS[rota] || 120000) / 60000) + ' minutos'), { tempo: true })));
    req.on('error', reject);
    if (dados) req.write(dados);
    req.end();
  });
}

// ---------- o token (24 h) ----------
let jwt = { token: '', ate: 0 };
async function token(c) {
  if (jwt.token && Date.now() < jwt.ate) return jwt.token;
  const cab = { clientId: c.clientId, secretKey: c.secretKey, 'X-Client-Id': c.clientId, 'X-Secret-Key': c.secretKey };
  let ultimo = '';
  for (const metodo of ['POST', 'GET']) {
    const r = await http(metodo, 'create-jwt', cab, null);
    ultimo = 'HTTP ' + r.status;
    if (r.status >= 300) continue;
    let t = r.texto.trim();
    try { const j = JSON.parse(t); t = typeof j === 'string' ? j : (j.token || j.Token || j.accessToken || j.jwt || j.access_token || ''); } catch (e) { /* veio o token cru */ }
    t = String(t).replace(/^"|"$/g, '');
    if (t) { jwt = { token: t, ate: Date.now() + 23 * 36e5 }; return t; }
  }
  throw new Error('não consegui gerar o token do SIEG (' + ultimo + ')');
}

// ---------- uma chamada, no ritmo do limite de cada rota ----------
// o limite do SIEG é por minuto (contar: 5; baixar: 2): em vez de esperar 13 s entre uma contagem e outra, até 5 dentro
// de 61 s (09/10/2026: as 2 contagens de um "Baixar XMLs" saem juntas, ~13 s a menos)
const POR_MINUTO = { 'contar-xmls': 5, 'baixar-xmls': 2 };
const chamadas = {};
async function vez(rota) {
  const limite = POR_MINUTO[rota];
  if (!limite) {
    const falta = (chamadas[rota] ? chamadas[rota][chamadas[rota].length - 1] : 0) + (ESPERA_MS[rota] || 15000) - Date.now();
    if (falta > 0) await dormir(falta);
  } else {
    for (;;) {
      const recentes = (chamadas[rota] || []).filter(t => Date.now() - t < 61000);
      chamadas[rota] = recentes;
      if (recentes.length < limite) break;
      await dormir(recentes[0] + 61000 - Date.now() + 50);
    }
  }
  (chamadas[rota] = chamadas[rota] || []).push(Date.now());
}
async function chamar(c, rota, corpo) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    await vez(rota);
    let r;
    try { r = await http('POST', rota, { Authorization: 'Bearer ' + await token(c), 'X-API-Key': c.apiKey }, corpo); }
    // demorou demais: tenta de novo (até 3 vezes); outro erro de rede sobe
    catch (e) { if (e.tempo && tentativa < 2) continue; throw e; }
    if (r.status === 429) { await dormir(60000 * (tentativa + 1)); continue; }
    if (r.status === 401) { jwt = { token: '', ate: 0 }; continue; }
    // nada no período: o SIEG responde 404 "Nenhum arquivo XML localizado." (07/10/2026) — lista vazia, não é erro
    if (r.status === 404 && /nenhum arquivo|nenhum xml|não localizado|nao localizado/i.test(r.texto)) return [];
    if (r.status >= 300) throw new Error(rota + ': HTTP ' + r.status + ' ' + r.texto.slice(0, 200));
    // o baixar-xmls responde com o .zip direto (binário: "PK…", 07/10/2026): vai como bytes para o xmlsDaResposta abrir
    if (r.bytes.length > 4 && r.bytes.readUInt32LE(0) === 0x04034b50) return r.bytes;
    let j;
    try { j = JSON.parse(r.texto); } catch (e) { return r.texto; }
    // a resposta vem embrulhada (07/10/2026, a primeira chamada de verdade): { IsSuccess, ErrorMessage, StatusCode, Data }
    if (j && typeof j === 'object' && 'IsSuccess' in j) {
      // sem nada no período: lista vazia (não é erro)
      if (!j.IsSuccess && /nenhum|nao encontr|não encontr|sem xml|sem arquivo|not found|no file/i.test(String(j.ErrorMessage || ''))) return [];
      if (!j.IsSuccess) throw new Error(rota + ': ' + (j.ErrorMessage || 'o SIEG recusou'));
      return j.Data;
    }
    return j;
  }
  throw new Error(rota + ': o SIEG seguiu recusando (limite de chamadas)');
}

// ---------- ZIP (o baixar-xmls pode mandar os XMLs num .zip em Base64): leitor mínimo, sem biblioteca ----------
function lerZip(buf) {
  const saida = [];
  // pelo índice do fim do arquivo (o zip do portal, 08/10/2026, grava os tamanhos depois dos dados: o cabeçalho de cada
  // arquivo vem com tamanho 0)
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim >= 0) {
    const total = buf.readUInt16LE(fim + 10);
    let j = buf.readUInt32LE(fim + 16);
    for (let n = 0; n < total && buf.readUInt32LE(j) === 0x02014b50; n++) {
      const metodo = buf.readUInt16LE(j + 10);
      const tam = buf.readUInt32LE(j + 20);
      const local = buf.readUInt32LE(j + 42);
      const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const dados = buf.subarray(ini, ini + tam);
      saida.push((metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString('utf8'));
      j += 46 + buf.readUInt16LE(j + 28) + buf.readUInt16LE(j + 30) + buf.readUInt16LE(j + 32);
    }
    return saida;
  }
  let i = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const metodo = buf.readUInt16LE(i + 8);
    const tam = buf.readUInt32LE(i + 18);
    const nome = buf.readUInt16LE(i + 26);
    const extra = buf.readUInt16LE(i + 28);
    const ini = i + 30 + nome + extra;
    const dados = buf.subarray(ini, ini + tam);
    saida.push((metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString('utf8'));
    i = ini + tam;
  }
  return saida;
}

/** Os XMLs que vieram na resposta, seja qual for o formato (lista de Base64, objeto com a lista, ZIP em Base64). */
function xmlsDaResposta(resp) {
  if (Buffer.isBuffer(resp)) return resp.length > 4 && resp.readUInt32LE(0) === 0x04034b50 ? lerZip(resp) : [resp.toString('utf8')];
  const lista = Array.isArray(resp) ? resp
    : resp && typeof resp === 'object' ? (resp.xmls || resp.Xmls || resp.data || resp.arquivos || Object.values(resp).find(Array.isArray) || [])
      : typeof resp === 'string' ? [resp] : [];
  const xmls = [];
  for (const item of lista) {
    const s = typeof item === 'string' ? item : (item && (item.xml || item.Xml || item.conteudo)) || '';
    if (!s) continue;
    if (s.trim().startsWith('<')) { xmls.push(s); continue; }
    const buf = Buffer.from(s, 'base64');
    if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) xmls.push(...lerZip(buf));
    else xmls.push(buf.toString('utf8'));
  }
  return xmls;
}

const tag = (xml, nome) => { const m = new RegExp('<(?:\\w+:)?' + nome + '>([^<]*)</(?:\\w+:)?' + nome + '>').exec(xml); return m ? m[1].trim() : ''; };

/** Uma NF-e/NFC-e ({ chave, modelo, serie, numero, valor }) ou um evento de cancelamento ({ cancela: chave }). */
function lerXml(xml) {
  if (/<(?:\w+:)?tpEvento>110111</.test(xml)) return { cancela: tag(xml, 'chNFe') };
  const id = /Id="NFe(\d{44})"/.exec(xml);
  if (!id) return null;
  return { chave: id[1], modelo: tag(xml, 'mod'), serie: tag(xml, 'serie'), numero: Number(tag(xml, 'nNF')) || 0, valor: Number(tag(xml, 'vNF')) || 0 };
}

function periodo(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  const fim = new Date(a, m, 0).getDate();
  return { DataEmissaoInicio: competencia + '-01', DataEmissaoFim: competencia + '-' + String(fim).padStart(2, '0') + 'T23:59:59.999' };
}

/** As contagens do mês: emitidas (o cliente emitiu) e recebidas (o cliente é o destinatário), por tipo. */
async function contagemDoMes(c, cnpj, competencia, aoAndar) {
  const p = periodo(competencia);
  const norm = r => ({ NFe: Number(r.NFe) || 0, NFCe: Number(r.NFCe) || 0, NFSe: Number(r.NFSe) || 0, CTe: Number(r.CTe) || 0, CFe: Number(r.CFe) || 0 });
  if (aoAndar) await aoAndar('emitidas');
  const emitidas = norm(await chamar(c, 'contar-xmls', Object.assign({ CnpjEmit: cnpj }, p)));
  if (aoAndar) await aoAndar('recebidas');
  const recebidas = norm(await chamar(c, 'contar-xmls', Object.assign({ CnpjDest: cnpj }, p)));
  return { emitidas, recebidas };
}

/**
 * Todos os XMLs do mês (nads, 07/10/2026: "importar os XML direto do SIEG"): emitidos (NF-e, NFC-e, CT-e, NFS-e) e recebidos
 * (NF-e, CT-e, NFS-e), com os eventos. Devolve os arquivos (nome e conteúdo) e o resumo de cada nota (o que vai para o banco).
 */
async function xmlsDoMes(c, doc, competencia, aoAndar) {
  const p = periodo(competencia);
  const grupos = [
    ['emitidas', 'CnpjEmit', [['NF-e', TIPO.NFe], ['NFC-e', TIPO.NFCe], ['CT-e', TIPO.CTe], ['NFS-e', TIPO.NFSe]]],
    ['recebidas', 'CnpjDest', [['NF-e', TIPO.NFe], ['CT-e', TIPO.CTe], ['NFS-e', TIPO.NFSe]]],
  ];
  const arquivos = new Map();
  const resumo = { emitidas: [], recebidas: [] };
  const canceladas = new Set();
  // conta antes (2 chamadas rápidas: o SIEG aceita 5 contagens por minuto) e só baixa os tipos que têm nota — o download
  // é que é lento (2 por minuto, até 1,5 min cada; 08/10/2026: "eu acho que demora muito")
  if (aoAndar) await aoAndar('Contando as notas no SIEG');
  const contagem = await contagemDoMes(c, doc, competencia);
  const CHAVE = { 'NF-e': 'NFe', 'NFC-e': 'NFCe', 'CT-e': 'CTe', 'NFS-e': 'NFSe' };
  for (const [grupo, campo, tipos] of grupos) {
    for (const [nome, tipo] of tipos) {
      if (!contagem[grupo][CHAVE[nome]]) continue;
      for (let skip = 0; skip < 50000; skip += 50) {
        if (aoAndar) await aoAndar((grupo === 'emitidas' ? 'Emitidas' : 'Recebidas') + ' · ' + nome + ' (' + arquivos.size + ' XMLs até agora)');
        // a NFS-e só aceita dia/mês/ano, sem a hora ("Certifique-se de apenas passar dia/mês/ano em NFSe", 07/10/2026)
        const datas = tipo === TIPO.NFSe ? { DataEmissaoInicio: p.DataEmissaoInicio, DataEmissaoFim: p.DataEmissaoFim.slice(0, 10) } : p;
        const xmls = xmlsDaResposta(await chamar(c, 'baixar-xmls', Object.assign({ TipoXml: tipo, Take: 50, Skip: skip, [campo]: doc, BaixarEventos: true }, datas)));
        for (const x of xmls) {
          arquivos.set(sx.nomeDoArquivo(x), x);
          const r = sx.resumoDaNota(x);
          if (!r) continue;
          if (r.cancela) { canceladas.add(r.cancela); continue; }
          resumo[grupo].push(r);
        }
        if (xmls.length < 50) break; // a página vem com 50 XMLs, contando os eventos (08/10/2026: parar pelas notas perdia metade)
      }
    }
  }
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g]) if (n.chave && canceladas.has(n.chave)) n.cancelada = true;
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem };
}

/**
 * Os XMLs do mês que já estão no Drive (Vitor, 09/10/2026: "verificar se os arquivos estão na pasta 2026 e, se não
 * tiver lá, verifica no Claudio Secretario"). A rotina das 9h arquiva o que o robô salva em Claudio Secretario/AAAA-MM/
 * <cliente> na pasta do cliente: <AAAA>/<código - nome>/FISCAL/<regime>/<nº>. XML/<tipo>[/EVENTOS], com outro nome
 * ("09-2026_NF-e_347197.xml"). Então cada XML vale pelo conteúdo (o nome que o robô daria a ele), não pelo nome do
 * arquivo. Devolve os XMLs (para não baixar de novo) e os nomes do robô (para não salvar de novo).
 */
async function xmlsJaNoDrive(codigo, nomeDaPasta, competencia, db) {
  const [ano, mes] = competencia.split('-');
  const raiz = path.dirname(PASTA_DO_DRIVE);
  const xmls = [];
  // primeiro a lista dos arquivos; depois a leitura, 32 de uma vez (09/10/2026: um por um, 1229 XMLs levavam 38 s). O
  // arquivo do mapa (com o id e a data do Drive) tem a cópia no C: (o G: leva de 10 a 25 s para o mesmo): só o novo ou o
  // que mudou é lido do Drive
  const aLer = [];
  const lerArquivo = (f, chave) => { aLer.push({ f, chave }); };
  // 1a) a pasta do ano do cliente pelo mapa do Drive (driveIndice, que o robô da nuvem mantém; ~1,5 s em vez de ~15 s
  // de listar o G:)
  let peloMapa = false;
  try {
    const mapa = db ? (await db.collection('driveIndice').doc('raiz').get()).data() : null;
    const cli = mapa && String(mapa.pastaNome) === ano ? (mapa.clientes || []).find(c => Number(c.codigo) === Number(codigo)) : null;
    if (cli) {
      const itens = (await db.collection('driveIndice').doc(cli.id).collection('partes').get()).docs.flatMap(d => d.data().itens || []);
      const filhos = new Map();
      for (const it of itens) { if (!filhos.has(it.p)) filhos.set(it.p, []); filhos.get(it.p).push(it); }
      const fiscal = (filhos.get(cli.id) || []).find(it => it.t === 'd' && it.n === 'FISCAL');
      if (fiscal) {
        peloMapa = true;
        for (const regime of (filhos.get(fiscal.i) || []).filter(it => it.t === 'd')) {
          const pastaXml = (filhos.get(regime.i) || []).find(it => it.t === 'd' && /^\d+\.\s*XML$/i.test(it.n));
          if (!pastaXml) continue;
          const base = path.join(raiz, ano, cli.nomePasta, 'FISCAL', regime.n, pastaXml.n);
          const andar = (pasta, caminho, eventos) => {
            for (const it of filhos.get(pasta.i) || []) {
              if (it.t === 'd') { andar(it, [...caminho, it.n], eventos || /eventos/i.test(it.n)); continue; }
              if (!/\.xml$/i.test(it.n)) continue;
              if (eventos || it.n.startsWith(mes + '-' + ano)) lerArquivo(path.join(base, ...caminho, it.n), it.i + '_' + String(it.m || '').replace(/\D/g, ''));
            }
          };
          andar(pastaXml, [], false);
        }
      }
    }
  } catch (_) { peloMapa = false; aLer.length = 0; }
  // 1b) sem o mapa: a pasta do ano do cliente pelo G: (o arquivado)
  if (!peloMapa) try {
    const doAno = path.join(raiz, ano);
    const cliente = (await fs.promises.readdir(doAno)).find(n => new RegExp('^0*' + Number(codigo) + '\\s*-').test(n));
    if (cliente) {
      const fiscal = path.join(doAno, cliente, 'FISCAL');
      for (const regime of await fs.promises.readdir(fiscal).catch(() => [])) {
        // "12. XML" no Simples, "14. XML" no Presumido: a pasta "<número>. XML" do regime
        const nomeXml = (await fs.promises.readdir(path.join(fiscal, regime)).catch(() => [])).find(n => /^\d+\.\s*XML$/i.test(n));
        if (!nomeXml) continue;
        const xml = path.join(fiscal, regime, nomeXml);
        const andar = async (dir, eventos) => {
          for (const it of await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])) {
            const f = path.join(dir, it.name);
            if (it.isDirectory()) { await andar(f, eventos || /eventos/i.test(it.name)); continue; }
            if (!/\.xml$/i.test(it.name)) continue;
            // as notas do mês pelo nome ("09-2026_…"); os eventos, todos (o do mês fica pela chave, abaixo)
            if (eventos || it.name.startsWith(mes + '-' + ano)) lerArquivo(f);
          }
        };
        await andar(xml, false);
      }
    }
  } catch (_) { /* sem a pasta do ano: segue para o Claudio Secretario */ }
  // 2) o Claudio Secretario (o que ainda não foi arquivado: os XMLs soltos e o .zip)
  const pasta = path.join(PASTA_DO_DRIVE, competencia, nomeDaPasta);
  for (const n of await fs.promises.readdir(pasta).catch(() => [])) {
    if (/\.xml$/i.test(n)) lerArquivo(path.join(pasta, n));
    else if (/^SIEG .*\.zip$/i.test(n)) { try { xmls.push(...lerZip(await fs.promises.readFile(path.join(pasta, n)))); } catch (_) { /* .zip quebrado */ } }
  }
  const CACHE = path.join(process.env.LOCALAPPDATA || __dirname, 'nads-robo', 'xmls-do-drive');
  await fs.promises.mkdir(CACHE, { recursive: true }).catch(() => {});
  await Promise.all(Array.from({ length: 32 }, async () => {
    for (let x = aLer.shift(); x; x = aLer.shift()) {
      try {
        const local = x.chave ? path.join(CACHE, x.chave + '.xml') : null;
        let t = local ? await fs.promises.readFile(local, 'utf8').catch(() => null) : null;
        if (t == null) {
          t = await fs.promises.readFile(x.f, 'utf8');
          if (local) await fs.promises.writeFile(local, t).catch(() => {});
        }
        if (sx.tipoDoXml(t)) xmls.push(t);
      } catch (_) { /* sem acesso: fica de fora */ }
    }
  }));
  // os eventos de outro mês (a pasta EVENTOS junta todos) ficam de fora: o AAMM da chave
  const doMes = x => {
    if (sx.tipoDoXml(x) !== 'evento') return true;
    const ch = /<(?:\w+:)?ch(?:NFe|CTe)>(\d{44})</.exec(x);
    return !ch || ch[1].slice(2, 6) === ano.slice(2) + mes;
  };
  // para reaproveitar, só os do mês; para "já está salvo", todos os que estão lá (o evento de setembro de uma nota de
  // agosto não é gravado de novo a cada pedido)
  const unicos = new Map();
  const nomes = new Set();
  for (const x of xmls) { const n = sx.nomeDoArquivo(x); nomes.add(n); if (doMes(x)) unicos.set(n, x); }
  return { xmls: [...unicos.values()], nomes };
}

/** O resumo para o banco, cabendo num documento (até ~900 KB): se passar, sai o detalhe dos itens (fica o resto da nota). */
function resumoQueCabe(doc) {
  if (Buffer.byteLength(JSON.stringify(doc)) < 900000) return doc;
  const sem = n => { const x = Object.assign({}, n); delete x.itens; return x; };
  return Object.assign({}, doc, { emitidas: doc.emitidas.map(sem), recebidas: doc.recebidas.map(sem), itensCortados: true });
}

/** As saídas do mês (NF-e e NFC-e emitidas), com os cancelamentos: os números por modelo e série. */
async function saidasDoMes(c, cnpj, competencia, aoAndar) {
  const p = periodo(competencia);
  const notas = new Map();
  const canceladas = new Set();
  for (const [nome, tipo] of [['NF-e', TIPO.NFe], ['NFC-e', TIPO.NFCe]]) {
    for (let skip = 0; skip < 50000; skip += 50) {
      const resp = await chamar(c, 'baixar-xmls', Object.assign({ TipoXml: tipo, Take: 50, Skip: skip, CnpjEmit: cnpj, BaixarEventos: true }, p));
      const xmls = xmlsDaResposta(resp);
      for (const x of xmls) {
        const n = lerXml(x);
        if (!n) continue;
        if (n.cancela) canceladas.add(n.cancela);
        else notas.set(n.chave, n);
      }
      if (aoAndar) aoAndar(nome + ': ' + notas.size + ' notas');
      if (xmls.length < 50) break; // a página vem com 50 XMLs, contando os eventos (08/10/2026: parar pelas notas perdia metade)
    }
  }
  return seriesDasNotas([...notas.values()].map(n => Object.assign({}, n, { cancelada: canceladas.has(n.chave) })));
}

/**
 * A sequência das saídas, série por série, de notas { modelo, serie, numero, valor, cancelada }. Serve às saídas pela API e
 * ao "Baixar XMLs" (08/10/2026: "se eu já baixei, por que não vem para cá direto"): as NF-e e NFC-e emitidas do resumo.
 */
function seriesDasNotas(notas) {
  const series = new Map();
  for (const n of notas) {
    const k = n.modelo + '|' + n.serie;
    const s = series.get(k) || { modelo: n.modelo, serie: n.serie, numeros: [], canceladas: [], valor: 0 };
    s.numeros.push(n.numero);
    if (n.cancelada) s.canceladas.push(n.numero);
    else s.valor += n.valor;
    series.set(k, s);
  }
  return [...series.values()].map(s => ({ ...s, numeros: s.numeros.sort((a, b) => a - b), canceladas: s.canceladas.sort((a, b) => a - b), valor: Math.round(s.valor * 100) / 100 }));
}

/** As saídas (NF-e e NFC-e emitidas) do resumo das notas dos XMLs, no formato do seriesDasNotas. */
const saidasDoResumo = emitidas => emitidas.filter(n => n.tipo === 'NF-e' || n.tipo === 'NFC-e')
  .map(n => ({ chave: n.chave, modelo: n.tipo === 'NFC-e' ? '65' : '55', serie: String(n.serie || ''), numero: Number(n.numero) || 0, valor: Number(n.valor) || 0, cancelada: !!n.cancelada }));

const competenciaDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

function iniciarSieg({ db, log }) {
  const estadoRef = db.collection('robo').doc('sieg');
  const { c, faltam } = lerCredenciais();
  if (faltam.length) {
    log('SIEG desligado: falta ' + faltam.join(', ') + ' em scripts/sieg_credenciais.json');
    estadoRef.set({ em: new Date().toISOString(), ligado: false, motivo: 'falta ' + faltam.join(', ') }, { merge: true }).catch(() => {});
    return () => {};
  }
  let situacao = 'livre';
  const ponto = () => estadoRef.set({ em: new Date().toISOString(), ligado: true, motivo: null, situacao }, { merge: true }).catch(() => {});
  ponto();
  const relogio = setInterval(ponto, 60 * 1000);

  /**
   * O .zip para o nads baixar na hora: em pedaços de ~900 KB (o limite de um documento é 1 MB) em siegNotas, que o fiscal
   * já lê ({codigo}_{AAAA-MM}~zip~01, ~02…; sem regra nova). Ficam 1 dia; depois o robô apaga (apagarZipsVelhos).
   */
  async function entregarZip(pedidoId, id, zip, aoAndar) {
    const b64 = zip.toString('base64');
    const partes = [];
    for (let i = 0, n = 1; i < b64.length; i += ZIP_PEDACO, n++) {
      const nome = id + '~zip~' + String(n).padStart(2, '0');
      await db.collection('siegNotas').doc(nome).set({ pedido: pedidoId, n, dados: b64.slice(i, i + ZIP_PEDACO) });
      partes.push(nome);
      if (aoAndar) await aoAndar(n, Math.ceil(b64.length / ZIP_PEDACO));
    }
    return partes;
  }
  async function apagarZipsVelhos() {
    const velhos = await db.collection('pedidosSieg').where('zipApagarEm', '<=', new Date().toISOString()).limit(20).get();
    for (const d of velhos.docs) {
      for (const nome of (d.data().zip && d.data().zip.partes) || []) await db.collection('siegNotas').doc(nome).delete().catch(() => {});
      await d.ref.update({ zipApagarEm: null, 'zip.partes': [], 'zip.apagado': true });
    }
  }
  // o robô caiu (ou foi atualizado) no meio de um pedido: volta para a fila
  db.collection('pedidosSieg').where('status', '==', 'processando').get().then(s => s.docs.forEach(d => {
    log('SIEG: retomando o pedido', d.id, 'que ficou pela metade');
    d.ref.update({ status: 'pendente', andamento: '' }).catch(() => {});
  })).catch(() => {});

  // uma coisa por vez (o limite é por API Key): os pedidos do nads passam na frente da contagem da noite
  let ocupado = false;
  // o pedido que chega enquanto o robô atende outro não pode ficar esquecido (08/10/2026: o 380 do Gustavo ficou parado
  // porque chegou durante o 62): ao terminar, olha a fila de novo
  let chegouOutro = false;
  async function atenderPedidos() {
    if (ocupado) { chegouOutro = true; return; }
    ocupado = true;
    chegouOutro = false;
    try {
      await apagarZipsVelhos().catch(err => log('SIEG: não consegui apagar os .zip velhos -', err.message));
      const snap = await db.collection('pedidosSieg').where('status', '==', 'pendente').limit(5).get();
      for (const d of snap.docs) {
        const p = d.data();
        const id = soDigitos(p.codigo) + '_' + p.competencia;
        situacao = 'baixando as saídas de ' + p.codigo;
        await d.ref.update({ status: 'processando', processandoEm: new Date().toISOString() });
        try {
          // o nads conhece a empresa pelo código: o CNPJ vem do cadastro de clientes
          let cnpj = soDigitos(p.cnpj);
          if (!documentoValido(cnpj)) {
            const lista = [];
            (await require('./clientes-cache').clientesAtivos(db)).forEach(x => lista.push(x.data()));
            const cli = lista.find(x => codigoDe(x) === soDigitos(p.codigo));
            cnpj = soDigitos(cli && cli.documento);
            if (!documentoValido(cnpj)) throw new Error('o cliente ' + p.codigo + ' não tem CNPJ nem CPF no cadastro');
          }
          // "Baixar XMLs do SIEG" (07/10/2026): todos os XMLs do mês na pasta do cliente (Drive deste PC) e o resumo no banco
          // e os XMLs que o cliente mandou (xmlsCliente, 08/10/2026): o nads manda os arquivos em pedaços
          // (pedidosSieg/{id}/xmls); o robô junta com os do Drive e segue o mesmo caminho, sem o SIEG e sem o .zip para baixar
          if (p.tipo === 'xmls' || p.tipo === 'xmlsCliente') {
            const doCliente = p.tipo === 'xmlsCliente';
            situacao = (doCliente ? 'lendo os XMLs do cliente ' : 'baixando os XMLs de ') + p.codigo;
            const lista = [];
            (await require('./clientes-cache').clientesAtivos(db)).forEach(x => lista.push(x.data()));
            const cli = lista.find(x => codigoDe(x) === soDigitos(p.codigo));
            if (!cli) throw new Error('o cliente ' + p.codigo + ' não está no cadastro');
            if (!fs.existsSync(PASTA_DO_DRIVE)) throw new Error('a pasta do Drive deste PC não está em ' + PASTA_DO_DRIVE);
            // o andamento de verdade (08/10/2026: "quero uma porcentagem melhor… pra espera não ficar estranha"): cada fase
            // tem a sua faixa da barra (baixar 0–70%, o .zip 70–80, o nads 80–84, o Drive 84–99) e o pedido guarda a
            // porcentagem, a fase e os números (gravado no máximo a cada 0,8 s, para não encher o banco)
            const FAIXA = { baixando: [0, 70], entregando: [70, 80], nads: [80, 84], drive: [84, 99] };
            const numeros = { xmls: 0, novos: 0, jaSalvos: 0 };
            let ultimo = 0;
            let pct = 1;
            const andar = (fase, texto, fracao, forcar) => {
              if (fracao != null) pct = Math.max(pct, Math.round(FAIXA[fase][0] + (FAIXA[fase][1] - FAIXA[fase][0]) * fracao));
              if (!forcar && Date.now() - ultimo < 800) return Promise.resolve();
              ultimo = Date.now();
              return d.ref.update({ andamento: texto, fase, pct, numeros }).catch(() => {});
            };
            await andar('baixando', 'Entrando no SIEG', 0, true);
            // o que a contagem espera de cada tipo (pesa a barra do download)
            const cont = (await db.collection('siegContagens').doc(id).get().catch(() => null))?.data();
            const soma = k => ((cont && cont.emitidas && cont.emitidas[k]) || 0) + ((cont && cont.recebidas && cont.recebidas[k]) || 0);
            const esperado = cont ? { 'NF-e': soma('NFe'), 'NFC-e': soma('NFCe'), 'CT-e': soma('CTe'), 'NFS-e': soma('NFSe'), 'CF-e': soma('CFe') } : null;
            const nomeDaPasta = (cli.nome || 'cliente ' + p.codigo).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
            const nomeDoZip = 'SIEG ' + p.competencia + ' - ' + nomeDaPasta + '.zip';
            const pasta = path.join(PASTA_DO_DRIVE, p.competencia, nomeDaPasta);
            // já baixou antes? (08/10/2026: "caso tenham baixado esses XMLs, para acelerar, verifica se tem todos no Drive,
            // aí puxa de lá, baixando apenas os excedentes"): conta agora no SIEG (2 consultas rápidas) e compara, tipo por
            // tipo, com as notas do último download; o tipo que não mudou sai do .zip que está na pasta, sem baixar
            // a conferência roda JUNTO com os downloads (08/10/2026: "tá demorando em média 3 minutos, queria que demorasse
            // 1"): quando ela diz que um tipo não mudou, o download dele é cancelado e ele sai do .zip do Drive
            // o que já está no Drive (a pasta 2026 do cliente, depois o Claudio Secretario; 09/10/2026), lido uma vez só
            const noDrive = xmlsJaNoDrive(soDigitos(p.codigo), nomeDaPasta, p.competencia, db).catch(() => ({ xmls: [], nomes: new Set() }));
            const reaproveitar = !doCliente ? (async () => {
              const [agora, ja] = await Promise.all([contagemDoMes(c, cnpj, p.competencia), noDrive]);
              if (!ja.xmls.length) return null;
              // as notas de cada tipo que estão no Drive x as que o SIEG tem agora: o tipo completo sai do Drive
              const montado = require('./sieg-portal').montarXmls(cnpj, ja.xmls).resumo;
              const antes = {};
              for (const n of [...montado.emitidas, ...montado.recebidas]) antes[n.tipo] = (antes[n.tipo] || 0) + 1;
              const CHAVE = { 'NF-e': 'NFe', 'NFC-e': 'NFCe', 'CT-e': 'CTe', 'NFS-e': 'NFSe', 'CF-e': 'CFe' };
              const tipos = Object.keys(CHAVE).filter(t => (agora.emitidas[CHAVE[t]] || 0) + (agora.recebidas[CHAVE[t]] || 0) === (antes[t] || 0));
              log('SIEG: XMLs de', p.codigo, '- não mudaram desde o último download:', tipos.join(', ') || 'nenhum');
              return { tipos, xmls: ja.xmls };
            })().catch(err => { log('SIEG: não deu para usar o Drive (' + err.message + '), baixando tudo'); return null; }) : null;
            // pelo portal primeiro (08/10/2026: "tem clientes com 1000 xml de uma vez, quero que ele vá no site e baixe"):
            // os tipos de nota ao mesmo tempo, em segundos; sem a sessão do portal ou com erro, pela API (mais lenta)
            let baixado;
            if (doCliente) {
              const sp = require('./sieg-portal');
              await andar('baixando', 'Lendo os XMLs que o cliente mandou', 0.1, true);
              const pedacos = await d.ref.collection('xmls').get();
              const mandados = JSON.parse(pedacos.docs.sort((a, b) => a.data().n - b.data().n).map(x => x.data().dados).join('') || '[]');
              const deles = sp.soDoCliente(cnpj, mandados);
              // os do Drive (o último .zip da pasta) entram junto: o resumo do mês fica com tudo
              const velhos = (await noDrive).xmls;
              baixado = sp.montarXmls(cnpj, [...velhos, ...deles]);
              baixado.doDrive = velhos.length;
              numeros.doCliente = deles.length;
              numeros.deOutros = mandados.length - deles.length;
              await andar('baixando', deles.length + ' XMLs do cliente' + (numeros.deOutros ? ' (' + numeros.deOutros + ' de outra empresa ficaram de fora)' : ''), 1, true);
              await Promise.all(pedacos.docs.map(x => x.ref.delete().catch(() => {})));
              log('SIEG: XMLs do cliente', p.codigo, p.competencia, '-', deles.length, 'dele,', numeros.deOutros, 'de outra empresa');
            } else try {
              baixado = await require('./sieg-portal').xmlsPeloPortal(cnpj, p.competencia, (t, f) => andar('baixando', t, f), lerZip, null, esperado, reaproveitar);
              log('SIEG: XMLs de', p.codigo, 'pelo portal' + (baixado.tiposDoDrive.length ? ' (do Drive: ' + baixado.tiposDoDrive.join(', ') + ')' : ''));
            } catch (err) {
              log('SIEG: portal não deu (' + err.message + '), XMLs de', p.codigo, 'pela API');
              await andar('baixando', 'O portal não deu (' + err.message + '): baixando pela API', null, true);
              baixado = await xmlsDoMes(c, cnpj, p.competencia, t => andar('baixando', t, null));
            }
            // o que está no Drive e o SIEG não trouxe (ex.: NFC-e que o SIEG não captura em MG, 09/10/2026) entra junto: o
            // resumo do mês no nads fica com tudo o que o escritório tem
            if (!doCliente) {
              const ja = await noDrive;
              const tem = new Set(baixado.arquivos.map(a => a.nome));
              const extras = ja.xmls.filter(x => !tem.has(sx.nomeDoArquivo(x)));
              if (extras.length) {
                const junto = require('./sieg-portal').montarXmls(cnpj, [...baixado.arquivos.map(a => a.xml), ...extras]);
                baixado = Object.assign({}, baixado, { arquivos: junto.arquivos, resumo: junto.resumo, doDrive: (baixado.doDrive || 0) + extras.length });
                log('SIEG: XMLs de', p.codigo, '-', extras.length, 'que estavam só no Drive entraram no resumo');
              }
            }
            const { arquivos, resumo, contagem } = baixado;
            numeros.xmls = arquivos.length;
            numeros.doDrive = baixado.doDrive || 0;
            const zip = arquivos.length ? sx.zipDe(arquivos) : null;
            // a ordem (Vitor, 08/10/2026: "seja entregue para a pessoa o zip dos XML, depois que ele introduza esses XML
            // no sistema (nads), depois que ele salve no drive"): 1) o .zip para quem pediu, que o nads baixa na hora
            if (zip && !doCliente && !p.madrugada) {
              await andar('entregando', 'Entregando o .zip (' + arquivos.length + ' XMLs)', 0, true);
              const partes = await entregarZip(d.ref.id, id, zip, (i, n) => andar('entregando', 'Entregando o .zip (parte ' + i + ' de ' + n + ')', i / n));
              await d.ref.update({ zip: { nome: nomeDoZip, partes, bytes: zip.length }, zipApagarEm: new Date(Date.now() + ZIP_GUARDADO_MS).toISOString() });
            }
            // 2) as notas no nads (o resumo e a contagem)
            await andar('nads', 'Lendo as notas no nads', 0, true);
            if (!doCliente) await db.collection('siegContagens').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), ...contagem });
            const onde = 'Claudio Secretario/' + p.competencia + '/' + nomeDaPasta;
            await db.collection('siegNotas').doc(id).set(resumoQueCabe({
              codigo: soDigitos(p.codigo), competencia: p.competencia, em: new Date().toISOString(), pasta: onde, zip: zip ? nomeDoZip : '', arquivos: arquivos.length, novos: arquivos.length,
              emitidas: resumo.emitidas, recebidas: resumo.recebidas,
            }));
            // e a sequência das saídas (a Conferência de Saídas lê daqui, sem outro pedido)
            await db.collection('siegSaidas').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series: seriesDasNotas(saidasDoResumo(resumo.emitidas)) });
            // 3) a pasta do cliente no Drive: só os XMLs que ainda não estão lá (08/10/2026: "se já foi salvo uma vez, só
            // sobreponha os a mais e não salve no drive o que já foi salvo"). O nome do arquivo é a chave da nota: o mesmo
            // nome é a mesma nota. O .zip só é refeito quando entrou XML novo (ou quando ainda não existe)
            const jaTem = new Set([...(await noDrive).nomes, ...(await fs.promises.readdir(pasta).catch(() => []))]);
            const faltam = arquivos.filter(a => !jaTem.has(a.nome));
            if (faltam.length) await fs.promises.mkdir(pasta, { recursive: true });
            numeros.jaSalvos = arquivos.length - faltam.length;
            await andar('drive', faltam.length ? 'Salvando ' + faltam.length + ' XMLs novos no Drive' : 'Todos os XMLs já estavam no Drive', 0, true);
            // em paralelo (16 por vez): no Drive cada arquivo leva ~120 ms
            let novos = 0;
            const fila = faltam.slice();
            await Promise.all(Array.from({ length: 16 }, async () => {
              for (let a = fila.shift(); a; a = fila.shift()) {
                await fs.promises.writeFile(path.join(pasta, a.nome), a.xml);
                novos++;
                numeros.novos = novos;
                andar('drive', 'Salvando no Drive (' + novos + ' de ' + faltam.length + ')', novos / faltam.length);
              }
            }));
            // e o .zip com todos, na mesma pasta (07/10/2026: "quero que ele também salve um arquivo .zip na hora")
            if (zip && novos) await fs.promises.writeFile(path.join(pasta, nomeDoZip), zip);
            await db.collection('siegNotas').doc(id).update({ novos }).catch(() => {});
            await d.ref.update({
              status: 'concluido', concluidoEm: new Date().toISOString(), andamento: '', pct: 100, fase: 'pronto', numeros,
              // nada novo: não gravou no Claudio Secretario (já estava tudo arquivado ou lá)
              resultado: { arquivos: arquivos.length, novos, jaSalvos: numeros.jaSalvos, pasta: novos ? onde : 'o Drive do cliente (já estava tudo lá)', zip: novos ? nomeDoZip : '', emitidas: resumo.emitidas.length, recebidas: resumo.recebidas.length },
            });
            log('SIEG: XMLs de', p.codigo, p.competencia, '-', arquivos.length, 'arquivos (' + novos + ' novos) em', onde);
            continue;
          }
          // o .zip das notas que faltam no Alterdata (08/10/2026: "3"): só essas chaves, pelo portal (ou do .zip do Drive), e
          // entregue como o do "Baixar XMLs" (o nads baixa na hora)
          if (p.tipo === 'zipFaltam') {
            situacao = 'montando o .zip das que faltam de ' + p.codigo;
            const chaves = (Array.isArray(p.chaves) ? p.chaves : []).map(String).filter(ch => /^\d{44}$/.test(ch));
            if (!chaves.length) throw new Error('nenhuma chave de nota no pedido');
            await d.ref.update({ andamento: 'Pegando ' + chaves.length + ' notas no SIEG', pct: 20, fase: 'baixando' });
            const quero = new Set(chaves);
            const daChave = x => ((/Id="(?:NFe|CTe)(\d{44})"/.exec(x)) || [])[1] || '';
            let xmls = [];
            try { xmls = await require('./sieg-portal').xmlsPorChaves(cnpj, chaves, lerZip); }
            catch (err) { log('SIEG: portal não deu nas chaves (' + err.message + '), tentando o .zip do Drive'); }
            if (xmls.filter(x => quero.has(daChave(x))).length < chaves.length) {
              // o que faltou, do .zip do Drive (se a pasta do mês ainda está lá)
              const nota = (await db.collection('siegNotas').doc(id).get()).data();
              const nomeDaPasta = nota && nota.pasta ? nota.pasta.split('/').pop() : '';
              if (nomeDaPasta) xmls.push(...(await xmlsJaNoDrive(soDigitos(p.codigo), nomeDaPasta, p.competencia, db)).xmls);
            }
            const arquivos = [...new Map(xmls.filter(x => quero.has(daChave(x))).map(x => [sx.nomeDoArquivo(x), x]))].map(([nome, xml]) => ({ nome, xml }));
            if (!arquivos.length) throw new Error('o SIEG não devolveu nenhuma dessas notas');
            await d.ref.update({ andamento: 'Entregando o .zip (' + arquivos.length + ' notas)', pct: 80, fase: 'entregando' });
            const zip = sx.zipDe(arquivos);
            const nomeDoZip = 'Faltam no Alterdata ' + p.competencia + ' - ' + p.codigo + '.zip';
            const partes = await entregarZip(d.ref.id, id + '_faltam', zip);
            await d.ref.update({
              status: 'concluido', concluidoEm: new Date().toISOString(), andamento: '', pct: 100, fase: 'pronto',
              zip: { nome: nomeDoZip, partes, bytes: zip.length }, zipApagarEm: new Date(Date.now() + ZIP_GUARDADO_MS).toISOString(),
              resultado: { arquivos: arquivos.length, novos: 0, pasta: '', emitidas: 0, recebidas: 0, zip: nomeDoZip, faltaram: chaves.length - arquivos.length },
            });
            log('SIEG: .zip das que faltam no Alterdata de', p.codigo, '-', arquivos.length, 'de', chaves.length, 'notas');
            continue;
          }
          // o "Contar agora" do nads (07/10/2026): só a contagem desta empresa e mês, sem esperar a madrugada
          if (p.tipo === 'contagem') {
            situacao = 'contando ' + p.codigo + ' (pedido)';
            await d.ref.update({ andamento: 'emitidas' });
            const r = await contagemDoMes(c, cnpj, p.competencia, t => d.ref.update({ andamento: t }).catch(() => {}));
            await db.collection('siegContagens').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), ...r });
            await d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString() });
            log('SIEG: contagem de', p.codigo, p.competencia, 'pedida pelo nads');
            continue;
          }
          // pelo portal primeiro (só NF-e e NFC-e: segundos), sem a sessão ou com erro pela API (50 por chamada)
          const andarSaidas = t => d.ref.update({ andamento: t }).catch(() => {});
          let series;
          try {
            const r = await require('./sieg-portal').xmlsPeloPortal(cnpj, p.competencia, andarSaidas, lerZip, ['NF-e', 'NFC-e']);
            series = seriesDasNotas(saidasDoResumo(r.resumo.emitidas));
          } catch (err) {
            log('SIEG: portal não deu (' + err.message + '), saídas de', p.codigo, 'pela API');
            series = await saidasDoMes(c, cnpj, p.competencia, andarSaidas);
          }
          await db.collection('siegSaidas').doc(id).set({ codigo: String(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series });
          await d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString() });
          log('SIEG: saídas de', p.codigo, p.competencia, '-', series.reduce((s, x) => s + x.numeros.length, 0), 'notas');
        } catch (err) {
          await d.ref.update({ status: 'erro', erro: err.message, erroEm: new Date().toISOString() });
          log('SIEG: erro', p.tipo === 'contagem' ? 'na contagem de' : p.tipo === 'xmls' ? 'nos XMLs de' : 'nas saídas de', p.codigo, '-', err.message);
        }
      }
    } catch (err) { log('SIEG: não consegui ler os pedidos -', err.message); }
    finally { situacao = 'livre'; ocupado = false; if (chegouOutro) setTimeout(atenderPedidos, 0); }
  }
  const pararPedidos = db.collection('pedidosSieg').where('status', '==', 'pendente').onSnapshot(s => { if (!s.empty) atenderPedidos(); }, err => log('SIEG: pedidos -', err.message));

  // a contagem da madrugada (entre 1h e 5h, uma vez por dia): o mês atual e, até o dia 10, o anterior também
  let contouEm = '';
  async function contarTodos() {
    const hoje = new Date();
    const dia = hoje.toISOString().slice(0, 10);
    if (ocupado || contouEm === dia || hoje.getHours() < 1 || hoje.getHours() >= 5) return;
    ocupado = true;
    contouEm = dia;
    try {
      const comps = [competenciaDe(hoje)];
      if (hoje.getDate() <= 10) comps.push(competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)));
      const ativos = [];
      (await require('./clientes-cache').clientesAtivos(db)).forEach(d => ativos.push(d.data()));
      const comCnpj = ativos.filter(x => documentoValido(soDigitos(x.documento)) && codigoDe(x));
      log('SIEG: contando as notas de', comCnpj.length, 'clientes em', comps.join(' e '));
      for (const comp of comps) {
        for (const cli of comCnpj) {
          // um pedido do nads chegou no meio da noite (ou da manhã: em 08/10 a contagem foi até 7:46): atende antes de seguir
          if (chegouOutro) { ocupado = false; await atenderPedidos(); ocupado = true; }
          situacao = 'contando ' + codigoDe(cli) + ' (' + comp + ')';
          try {
            const r = await contagemDoMes(c, soDigitos(cli.documento), comp);
            await db.collection('siegContagens').doc(codigoDe(cli) + '_' + comp).set({ codigo: codigoDe(cli), cnpj: soDigitos(cli.documento), competencia: comp, em: new Date().toISOString(), ...r });
          } catch (err) { log('SIEG: contagem de', codigoDe(cli), '-', err.message); }
        }
      }
      log('SIEG: contagem da noite pronta');
    } catch (err) { log('SIEG: contagem da noite falhou -', err.message); }
    finally { situacao = 'livre'; ocupado = false; }
    await xmlsDaMadrugada().catch(err => log('SIEG: XMLs da madrugada falharam -', err.message));
  }

  /**
   * Os XMLs prontos de manhã (Vitor, 08/10/2026: "1"): depois da contagem, o mês anterior (o da rotina do Fiscal) de cada
   * cliente que teve nota e ainda não está completo no nads e no Drive (pela contagem: o mesmo número de notas por tipo).
   * Um por vez, pelo mesmo caminho do "Baixar XMLs" (sem o .zip para baixar), e os pedidos do nads passam na frente.
   */
  async function xmlsDaMadrugada() {
    const hoje = new Date();
    const comp = competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
    const ativos = [];
    (await require('./clientes-cache').clientesAtivos(db)).forEach(d => ativos.push(d.data()));
    const comCnpj = ativos.filter(x => documentoValido(soDigitos(x.documento)) && codigoDe(x));
    const CHAVE = { 'NF-e': 'NFe', 'NFC-e': 'NFCe', 'CT-e': 'CTe', 'NFS-e': 'NFSe', 'CF-e': 'CFe' };
    let feitos = 0;
    for (const cli of comCnpj) {
      const id = codigoDe(cli) + '_' + comp;
      const cont = (await db.collection('siegContagens').doc(id).get()).data();
      if (!cont) continue;
      const esperado = t => ((cont.emitidas || {})[CHAVE[t]] || 0) + ((cont.recebidas || {})[CHAVE[t]] || 0);
      if (!Object.keys(CHAVE).some(t => esperado(t) > 0)) continue;
      const notas = (await db.collection('siegNotas').doc(id).get()).data();
      if (notas && Array.isArray(notas.emitidas)) {
        const tem = {};
        for (const n of [...notas.emitidas, ...(notas.recebidas || [])]) tem[n.tipo] = (tem[n.tipo] || 0) + 1;
        if (Object.keys(CHAVE).every(t => (tem[t] || 0) === esperado(t))) continue;
      }
      // o pedido, como se fosse do nads (a tela mostra "XMLs baixados" de manhã), e a fila atende na hora
      await db.collection('pedidosSieg').add({ status: 'pendente', tipo: 'xmls', codigo: codigoDe(cli), competencia: comp, madrugada: true,
        criadoEm: new Date().toISOString(), criadoPor: 'Robô (madrugada)', criadoPorUid: 'robo' });
      await atenderPedidos();
      while (ocupado) await dormir(2000);
      feitos++;
    }
    log('SIEG: XMLs da madrugada prontos -', feitos, 'clientes em', comp);
  }
  const relogioNoite = setInterval(() => { contarTodos(); if (!ocupado) atenderPedidos(); }, 10 * 60 * 1000);
  log('SIEG ligado: contagem da madrugada e os pedidos do nads');
  return () => { clearInterval(relogio); clearInterval(relogioNoite); pararPedidos(); };
}

module.exports = { xmlsJaNoDrive, seriesDasNotas, saidasDoResumo, iniciarSieg, lerXml, xmlsDaResposta, lerZip, periodo, contagemDoMes, saidasDoMes, xmlsDoMes, resumoQueCabe };
