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
const ultimaChamada = {};
async function chamar(c, rota, corpo) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const falta = (ultimaChamada[rota] || 0) + (ESPERA_MS[rota] || 15000) - Date.now();
    if (falta > 0) await dormir(falta);
    ultimaChamada[rota] = Date.now();
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
        let notasNaPagina = 0;
        for (const x of xmls) {
          arquivos.set(sx.nomeDoArquivo(x), x);
          const r = sx.resumoDaNota(x);
          if (!r) continue;
          if (r.cancela) { canceladas.add(r.cancela); continue; }
          notasNaPagina++;
          resumo[grupo].push(r);
        }
        if (notasNaPagina < 50) break;
      }
    }
  }
  for (const g of ['emitidas', 'recebidas']) for (const n of resumo[g]) if (n.chave && canceladas.has(n.chave)) n.cancelada = true;
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem };
}

/** Grava um arquivo sem duplicar: o mesmo nome e o mesmo conteúdo já estão lá = não grava. Devolve se gravou. */
async function gravarSeNovo(pasta, nome, texto) {
  const destino = path.join(pasta, nome);
  try { if (await fs.promises.readFile(destino, 'utf8') === texto) return false; } catch (e) { /* ainda não existe */ }
  await fs.promises.writeFile(destino, texto);
  return true;
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
      let notasNaPagina = 0;
      for (const x of xmls) {
        const n = lerXml(x);
        if (!n) continue;
        if (n.cancela) canceladas.add(n.cancela);
        else { notas.set(n.chave, n); notasNaPagina++; }
      }
      if (aoAndar) aoAndar(nome + ': ' + notas.size + ' notas');
      if (notasNaPagina < 50) break;
    }
  }
  const series = new Map();
  for (const n of notas.values()) {
    const k = n.modelo + '|' + n.serie;
    const s = series.get(k) || { modelo: n.modelo, serie: n.serie, numeros: [], canceladas: [], valor: 0 };
    s.numeros.push(n.numero);
    if (canceladas.has(n.chave)) s.canceladas.push(n.numero);
    else s.valor += n.valor;
    series.set(k, s);
  }
  return [...series.values()].map(s => ({ ...s, numeros: s.numeros.sort((a, b) => a - b), canceladas: s.canceladas.sort((a, b) => a - b), valor: Math.round(s.valor * 100) / 100 }));
}

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
  async function entregarZip(pedidoId, id, zip) {
    const b64 = zip.toString('base64');
    const partes = [];
    for (let i = 0, n = 1; i < b64.length; i += ZIP_PEDACO, n++) {
      const nome = id + '~zip~' + String(n).padStart(2, '0');
      await db.collection('siegNotas').doc(nome).set({ pedido: pedidoId, n, dados: b64.slice(i, i + ZIP_PEDACO) });
      partes.push(nome);
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
  async function atenderPedidos() {
    if (ocupado) return;
    ocupado = true;
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
          if (p.tipo === 'xmls') {
            situacao = 'baixando os XMLs de ' + p.codigo;
            const lista = [];
            (await require('./clientes-cache').clientesAtivos(db)).forEach(x => lista.push(x.data()));
            const cli = lista.find(x => codigoDe(x) === soDigitos(p.codigo));
            if (!cli) throw new Error('o cliente ' + p.codigo + ' não está no cadastro');
            if (!fs.existsSync(PASTA_DO_DRIVE)) throw new Error('a pasta do Drive deste PC não está em ' + PASTA_DO_DRIVE);
            await d.ref.update({ andamento: 'Baixando do SIEG' });
            const andar = t => d.ref.update({ andamento: t }).catch(() => {});
            // pelo portal primeiro (08/10/2026: "tem clientes com 1000 xml de uma vez, quero que ele vá no site e baixe"):
            // um .zip por tipo de nota, em segundos; sem a sessão do portal ou com erro, pela API (mais lenta)
            let baixado;
            try {
              baixado = await require('./sieg-portal').xmlsPeloPortal(cnpj, p.competencia, andar, lerZip);
              log('SIEG: XMLs de', p.codigo, 'pelo portal');
            } catch (err) {
              log('SIEG: portal não deu (' + err.message + '), XMLs de', p.codigo, 'pela API');
              await andar('O portal não deu (' + err.message + '): baixando pela API');
              baixado = await xmlsDoMes(c, cnpj, p.competencia, andar);
            }
            const { arquivos, resumo, contagem } = baixado;
            const nomeDaPasta = (cli.nome || 'cliente ' + p.codigo).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
            const nomeDoZip = 'SIEG ' + p.competencia + ' - ' + nomeDaPasta + '.zip';
            const zip = arquivos.length ? sx.zipDe(arquivos) : null;
            // a ordem (Vitor, 08/10/2026: "seja entregue para a pessoa o zip dos XML, depois que ele introduza esses XML
            // no sistema (nads), depois que ele salve no drive"): 1) o .zip para quem pediu, que o nads baixa na hora
            if (zip) {
              await andar('Entregando o .zip (' + arquivos.length + ' XMLs)');
              const partes = await entregarZip(d.ref.id, id, zip);
              await d.ref.update({ zip: { nome: nomeDoZip, partes, bytes: zip.length }, zipApagarEm: new Date(Date.now() + ZIP_GUARDADO_MS).toISOString() });
            }
            // 2) as notas no nads (o resumo e a contagem)
            await andar('Lendo as notas no nads');
            await db.collection('siegContagens').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), ...contagem });
            const onde = 'Claudio Secretario/' + p.competencia + '/' + nomeDaPasta;
            await db.collection('siegNotas').doc(id).set(resumoQueCabe({
              codigo: soDigitos(p.codigo), competencia: p.competencia, em: new Date().toISOString(), pasta: onde, zip: zip ? nomeDoZip : '', arquivos: arquivos.length, novos: arquivos.length,
              emitidas: resumo.emitidas, recebidas: resumo.recebidas,
            }));
            // 3) a pasta do cliente no Drive (os XMLs para o Alterdata e o .zip)
            await andar('Salvando ' + arquivos.length + ' XMLs no Drive');
            const pasta = path.join(PASTA_DO_DRIVE, p.competencia, nomeDaPasta);
            fs.mkdirSync(pasta, { recursive: true });
            // em paralelo (16 por vez): no Drive cada arquivo leva ~120 ms, um por um 850 XMLs levavam 100 s
            let novos = 0;
            const fila = arquivos.slice();
            await Promise.all(Array.from({ length: 16 }, async () => {
              for (let a = fila.shift(); a; a = fila.shift()) if (await gravarSeNovo(pasta, a.nome, a.xml)) novos++;
            }));
            // e o .zip com todos, na mesma pasta (07/10/2026: "quero que ele também salve um arquivo .zip na hora")
            if (zip) await fs.promises.writeFile(path.join(pasta, nomeDoZip), zip);
            await db.collection('siegNotas').doc(id).update({ novos }).catch(() => {});
            await d.ref.update({
              status: 'concluido', concluidoEm: new Date().toISOString(), andamento: '',
              resultado: { arquivos: arquivos.length, novos, pasta: onde, zip: arquivos.length ? nomeDoZip : '', emitidas: resumo.emitidas.length, recebidas: resumo.recebidas.length },
            });
            log('SIEG: XMLs de', p.codigo, p.competencia, '-', arquivos.length, 'arquivos (' + novos + ' novos) em', onde);
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
          const series = await saidasDoMes(c, cnpj, p.competencia, t => d.ref.update({ andamento: t }).catch(() => {}));
          await db.collection('siegSaidas').doc(id).set({ codigo: String(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series });
          await d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString() });
          log('SIEG: saídas de', p.codigo, p.competencia, '-', series.reduce((s, x) => s + x.numeros.length, 0), 'notas');
        } catch (err) {
          await d.ref.update({ status: 'erro', erro: err.message, erroEm: new Date().toISOString() });
          log('SIEG: erro', p.tipo === 'contagem' ? 'na contagem de' : p.tipo === 'xmls' ? 'nos XMLs de' : 'nas saídas de', p.codigo, '-', err.message);
        }
      }
    } catch (err) { log('SIEG: não consegui ler os pedidos -', err.message); }
    finally { situacao = 'livre'; ocupado = false; }
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
  }
  const relogioNoite = setInterval(() => { contarTodos(); if (!ocupado) atenderPedidos(); }, 10 * 60 * 1000);
  log('SIEG ligado: contagem da madrugada e os pedidos do nads');
  return () => { clearInterval(relogio); clearInterval(relogioNoite); pararPedidos(); };
}

module.exports = { iniciarSieg, lerXml, xmlsDaResposta, lerZip, periodo, contagemDoMes, saidasDoMes, xmlsDoMes, resumoQueCabe };
