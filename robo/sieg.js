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

const CREDENCIAIS = process.env.SIEG_CREDENCIAIS || path.join(__dirname, 'sieg_credenciais.json');
// a pasta do Drive deste PC (o Google Drive para computador): os XMLs do mês vão para Claudio Secretario/AAAA-MM/<cliente>,
// a mesma do "Salvar no Drive" do Gmail, de onde a rotina das 9h arquiva e o Alterdata importa (07/10/2026)
const PASTA_DO_DRIVE = process.env.PASTA_DESTINO || 'G:\\Meu Drive\\Claudio Secretario';
const sx = require('./sieg-xmls');
const siegPdfs = require('./sieg-pdfs');
// o painel do robô (21/10/2026): o que o SIEG está fazendo agora, os XMLs baixados, as contagens e os erros
const painel = require('./painel');
const pausaLocal = require('./pausa-local');
const { ouvir } = require('./ouvinte');
const BASE = 'https://api.sieg.com/api/v1/';
const ESPERA_MS = { 'contar-xmls': 13000, 'baixar-xmls': 31000, 'create-jwt': 2000 };
const TIPO = { NFe: 1, CTe: 2, NFSe: 3, NFCe: 4, CFe: 5 };

const dormir = ms => new Promise(r => setTimeout(r, ms));
// o "fetch failed" do Node esconde o motivo em err.cause (03/11/2026, no NILMA-SERVER: o portal falhava em 33 s sem dizer por quê)
// (07/11/2026: "erro nos XMLs de 66 - " saiu vazio porque a mensagem era vazia: sem mensagem, vale o nome ou o código do erro)
const motivo = e => (String(e && e.message || '') || String(e && (e.code || e.name) || e || 'erro sem mensagem')) + (e && e.cause ? ' — ' + (e.cause.code || '') + ' ' + (e.cause.message || '') : '');
const est = require('./sieg-estado');
// os clientes em que o portal respondeu 404 (04/11/2026: 11 de uma vez): por 3 dias vão direto pela API; fica em arquivo no PC
const portal404 = est.criarPortal404(path.join(require('./pastas-locais').ROBO, 'sieg-portal-404.json'), { dias: 3 });
// o índice de chaves do arquivador (arquivador-chaves.js): o que o SIEG baixa de novo e o arquivador já arquivou não vai de novo
// para a pasta de entrada. Lido uma vez por rodada (30 min); sem poder ler, baixa tudo como antes
const jaArquivados = est.criarFiltroDeArquivados(() => {
  const L = require('./pastas-locais');
  const K = require('./arquivador-chaves');
  const controle = process.env.SIEG_INDICE_CONTROLE || L.CONTROLE;
  const antigo = path.join(process.env.ARQUIVO_RAIZ || 'C:\Users\DPTO FISCAL 004\GUSTAVO\claudio', '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
  return K.carregar({ controle, manifestoAntigo: antigo, raiz: require('./arquivador-regras').RAIZ_CLIENTES });
}, { log: (...m) => console.log(new Date().toLocaleString('pt-BR'), ...m) });
// os cancelamentos já gravados no Drive, por empresa e mês (procurarCancelamentos, 11/11/2026): no PC, nunca no banco
const cancelamentosVistos = est.criarMemoriaDeCancelamentos(path.join(require('./pastas-locais').ROBO, 'sieg-cancelamentos.json'));
const soDigitos = v => String(v || '').replace(/\D/g, '');
// o documento do cliente: CNPJ (14) ou CPF (11, o produtor rural; o SIEG conta pelos dois, 07/10/2026)
// (23/10/2026: a contagem da madrugada mandava ao SIEG qualquer número de 11 ou 14 dígitos e ele devolvia HTTP 400 "CNPJ/CPF
// do Emitente inválido" para os de dígito verificador errado, uma vez por madrugada; agora o dígito é conferido aqui antes)
function cpfOk(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    if ((soma * 10 % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}
function cnpjOk(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  for (const t of [12, 13]) {
    const pesos = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * pesos[i];
    if ((soma % 11 < 2 ? 0 : 11 - soma % 11) !== Number(d[t])) return false;
  }
  return true;
}
/**
 * O documento do cadastro pronto para o SIEG: só os dígitos, com os zeros à esquerda que um número no lugar de texto perde
 * (CPF de 10 dígitos vira 11, CNPJ de 13 vira 14), e só se o dígito verificador bate. Devolve '' quando não serve.
 * CPF vai com 11 dígitos no CnpjEmit/CnpjDest (a própria mensagem do SIEG diz que aceita).
 */
function normalizarDocumento(valor, enquadramento) {
  const d = soDigitos(typeof valor === 'number' ? Math.trunc(valor) : valor);
  if (!d) return '';
  if (d.length === 14 && cnpjOk(d)) return d;
  if (d.length === 11 && cpfOk(d)) return d;
  if (d.length < 11 && cpfOk(d.padStart(11, '0'))) return d.padStart(11, '0');
  if (d.length > 11 && d.length < 14 && cnpjOk(d.padStart(14, '0'))) return d.padStart(14, '0');
  // produtor rural (enquadramento Física): o cadastro veio do Toriba com o número de 14 dígitos do produtor (CAEPF: 9 da base do
  // CPF + 3 de sequência + 2 dígitos) e o SIEG só aceita CPF ou CNPJ. Sem ser CNPJ válido, o CPF sai da base (23/10/2026, o Vitor
  // aprovou). Não consegui validar o dígito do CAEPF (as fórmulas de CNPJ e de CPF não fecham nos 6 casos do cadastro), então
  // a regra é só o enquadramento. O robô avisa no painel (soComDocumento) para gravar o CPF no Cadastro.
  if (d.length === 14 && /^f[ií]sica$/i.test(String(enquadramento || '').trim())) return cpfDaBase(d.slice(0, 9));
  return '';
}
/** O CPF de 11 dígitos a partir dos 9 primeiros (a base), com os dois dígitos verificadores calculados. */
function cpfDaBase(base) {
  let cpf = base;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    cpf += (soma * 10 % 11) % 10;
  }
  return cpfOk(cpf) ? cpf : '';
}
const comMascaraCpf = c => c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9);
const SEM_DOC = cod => 'Cliente ' + cod + ' sem CNPJ/CPF válido no cadastro — corrija em Cadastro';
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
    const r = await est.comTentativas(() => http(metodo, 'create-jwt', cab, null));
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
// desistir (31/10/2026): a conferência com o Drive que ficou sem serventia (o portal já trouxe tudo) sai da fila do limite
// sem gastar a vez, para não atrasar o "Contar agora" de alguém
const DESISTIU = 'a consulta não é mais necessária';
async function vez(rota, desistir) {
  const limite = POR_MINUTO[rota];
  if (!limite) {
    const falta = (chamadas[rota] ? chamadas[rota][chamadas[rota].length - 1] : 0) + (ESPERA_MS[rota] || 15000) - Date.now();
    if (falta > 0) await dormir(falta);
  } else {
    for (;;) {
      const recentes = (chamadas[rota] || []).filter(t => Date.now() - t < 61000);
      chamadas[rota] = recentes;
      if (desistir && desistir()) throw new Error(DESISTIU);
      if (recentes.length < limite) break;
      await dormir(recentes[0] + 61000 - Date.now() + 50);
    }
  }
  (chamadas[rota] = chamadas[rota] || []).push(Date.now());
}
async function chamar(c, rota, corpo, desistir) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    await vez(rota, desistir);
    let r;
    try { r = await http('POST', rota, { Authorization: 'Bearer ' + await token(c), 'X-API-Key': c.apiKey }, corpo); }
    // demorou demais: tenta de novo (até 3 vezes); outro erro de rede sobe
    catch (e) {
      if (e.tempo && tentativa < 2) continue;
      // rede que caiu (ETIMEDOUT, ECONNRESET, EAI_AGAIN... 07/11/2026: a contagem das 3:30 pulou os clientes 510 a 519): espera
      // crescente e tenta de novo antes de desistir do cliente
      if (!e.tempo && est.ehErroDeRede(e) && tentativa < 3) {
        const espera = [5000, 15000, 30000][tentativa];
        console.log(new Date().toLocaleString('pt-BR'), 'SIEG:', rota, '- a rede falhou (' + motivo(e) + '), de novo em', espera / 1000, 's');
        await dormir(espera);
        continue;
      }
      throw e;
    }
    // 503/502/504: o portal do SIEG cai por instantes (03/11/2026, 7 erros em 7 min): espera e tenta de novo, como o 429
    if (r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504) { await dormir(60000 * (tentativa + 1)); continue; }
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
async function contagemDoMes(c, cnpj, competencia, aoAndar, desistir) {
  const p = periodo(competencia);
  const norm = r => ({ NFe: Number(r.NFe) || 0, NFCe: Number(r.NFCe) || 0, NFSe: Number(r.NFSe) || 0, CTe: Number(r.CTe) || 0, CFe: Number(r.CFe) || 0 });
  if (aoAndar) await aoAndar('emitidas');
  const emitidas = norm(await chamar(c, 'contar-xmls', Object.assign({ CnpjEmit: cnpj }, p), desistir));
  if (aoAndar) await aoAndar('recebidas');
  const recebidas = norm(await chamar(c, 'contar-xmls', Object.assign({ CnpjDest: cnpj }, p), desistir));
  // o CT-e recebido é o do tomador (10/11/2026), então a conta dele vem do tomador; se o SIEG não responder, fica a do destinatário
  try { recebidas.CTe = norm(await chamar(c, 'contar-xmls', Object.assign({ CnpjTom: cnpj }, p), desistir)).CTe; }
  catch (err) { if (err.message === DESISTIU) throw err; console.log(new Date().toLocaleString('pt-BR'), 'SIEG: contagem do tomador de', cnpj, '-', motivo(err)); }
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
    // o CT-e recebido vem pelo tomador (10/11/2026), o resto pelo destinatário
    ['recebidas', 'CnpjDest', [['NF-e', TIPO.NFe], ['CT-e', TIPO.CTe, 'CnpjTom'], ['NFS-e', TIPO.NFSe]]],
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
    for (const [nome, tipo, campoDoTipo] of tipos) {
      if (!contagem[grupo][CHAVE[nome]]) continue;
      for (let skip = 0; skip < 50000; skip += 50) {
        if (aoAndar) await aoAndar((grupo === 'emitidas' ? 'Emitidas' : 'Recebidas') + ' · ' + nome + ' (' + arquivos.size + ' XMLs até agora)');
        // a NFS-e só aceita dia/mês/ano, sem a hora ("Certifique-se de apenas passar dia/mês/ano em NFSe", 07/10/2026)
        const datas = tipo === TIPO.NFSe ? { DataEmissaoInicio: p.DataEmissaoInicio, DataEmissaoFim: p.DataEmissaoFim.slice(0, 10) } : p;
        const xmls = xmlsDaResposta(await chamar(c, 'baixar-xmls', Object.assign({ TipoXml: tipo, Take: 50, Skip: skip, [campoDoTipo || campo]: doc, BaixarEventos: true }, datas)));
        for (const x of xmls) {
          arquivos.set(sx.nomeDoArquivo(x), x);
          const r = sx.resumoDaNota(x);
          if (!r) continue;
          if (r.cancela) { canceladas.add(r.cancela); continue; }
          // o CT-e que o próprio cliente emitiu e tomou já entrou nas emitidas
          if (campoDoTipo && soDigitos(r.emitente && r.emitente.doc) === soDigitos(doc)) continue;
          resumo[grupo].push(r);
        }
        if (xmls.length < 50) break; // a página vem com 50 XMLs, contando os eventos (08/10/2026: parar pelas notas perdia metade)
      }
    }
  }
  sx.marcarCanceladas(resumo, canceladas);
  return { arquivos: [...arquivos].map(([nome, xml]) => ({ nome, xml })), resumo, contagem };
}

// A pasta EVENTOS do ano junta os eventos de todos os meses, com a data do evento no nome ("29-10-2026 - CIENCIA DA OPERACAO
// NF-e 155769.xml"; conferido em 31/10/2026: 5496 de 5496 eventos com data, de 7 clientes, têm no nome o mês do dhEvento). O
// download de um mês só traz eventos de notas emitidas nele, e o evento não vem antes da nota: o evento com data de antes do
// mês não está no download e não precisa ser lido (o 380 de 10/2026 lia 3918 arquivos para 572 XMLs do mês). Sem a data no
// nome, lê como antes.
// a pasta das canceladas (11/11/2026): <regime>/03. DOCUMENTOS FISCAIS/EMITIDOS|RECEBIDOS/CANCELADAS
const PASTA_DOCS = /^\d+\.\s*DOCUMENTOS FISCAIS$/i;
const LADOS = /^(EMITIDOS|RECEBIDOS)$/i;
function eventoDeAntes(nome, competencia) {
  const m = /^(\d{2})-(\d{2})-(\d{4})\b/.exec(String(nome || ''));
  return !!m && m[3] + '-' + m[2] < competencia;
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
          // os cancelamentos já arquivados (11/11/2026): o arquivador põe o XML do evento de cancelamento em
          // <regime>/<nº>. DOCUMENTOS FISCAIS/EMITIDOS|RECEBIDOS/CANCELADAS, fora da pasta XML
          const docs = (filhos.get(regime.i) || []).find(it => it.t === 'd' && PASTA_DOCS.test(it.n));
          for (const lado of docs ? (filhos.get(docs.i) || []).filter(it => it.t === 'd' && LADOS.test(it.n)) : []) {
            const canc = (filhos.get(lado.i) || []).find(it => it.t === 'd' && /^CANCELADAS$/i.test(it.n));
            for (const it of canc ? filhos.get(canc.i) || [] : []) {
              if (it.t !== 'd' && /\.xml$/i.test(it.n) && !eventoDeAntes(it.n, competencia)) lerArquivo(path.join(raiz, ano, cli.nomePasta, 'FISCAL', regime.n, docs.n, lado.n, canc.n, it.n), it.i + '_' + String(it.m || '').replace(/\D/g, ''));
            }
          }
          const pastaXml = (filhos.get(regime.i) || []).find(it => it.t === 'd' && /^\d+\.\s*XML$/i.test(it.n));
          if (!pastaXml) continue;
          const base = path.join(raiz, ano, cli.nomePasta, 'FISCAL', regime.n, pastaXml.n);
          const andar = (pasta, caminho, eventos) => {
            for (const it of filhos.get(pasta.i) || []) {
              if (it.t === 'd') { andar(it, [...caminho, it.n], eventos || /eventos/i.test(it.n)); continue; }
              if (!/\.xml$/i.test(it.n)) continue;
              if (eventos ? !eventoDeAntes(it.n, competencia) : it.n.startsWith(mes + '-' + ano)) lerArquivo(path.join(base, ...caminho, it.n), it.i + '_' + String(it.m || '').replace(/\D/g, ''));
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
        const doRegime = await fs.promises.readdir(path.join(fiscal, regime)).catch(() => []);
        // os cancelamentos já arquivados (11/11/2026): <nº>. DOCUMENTOS FISCAIS/EMITIDOS|RECEBIDOS/CANCELADAS
        const nomeDocs = doRegime.find(n => PASTA_DOCS.test(n));
        for (const lado of nomeDocs ? (await fs.promises.readdir(path.join(fiscal, regime, nomeDocs)).catch(() => [])).filter(n => LADOS.test(n)) : []) {
          const canc = path.join(fiscal, regime, nomeDocs, lado, 'CANCELADAS');
          for (const n of await fs.promises.readdir(canc).catch(() => [])) if (/\.xml$/i.test(n) && !eventoDeAntes(n, competencia)) lerArquivo(path.join(canc, n));
        }
        // "12. XML" no Simples, "14. XML" no Presumido: a pasta "<número>. XML" do regime
        const nomeXml = doRegime.find(n => /^\d+\.\s*XML$/i.test(n));
        if (!nomeXml) continue;
        const xml = path.join(fiscal, regime, nomeXml);
        const andar = async (dir, eventos) => {
          for (const it of await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])) {
            const f = path.join(dir, it.name);
            if (it.isDirectory()) { await andar(f, eventos || /eventos/i.test(it.name)); continue; }
            if (!/\.xml$/i.test(it.name)) continue;
            // as notas do mês pelo nome ("09-2026_…"); os eventos, os do mês e de depois (eventoDeAntes; o do mês fica pela
            // chave, abaixo)
            if (eventos ? !eventoDeAntes(it.name, competencia) : it.name.startsWith(mes + '-' + ano)) lerArquivo(f);
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
  const CACHE = path.join(require('./pastas-locais').ROBO, 'xmls-do-drive');   // fora do AppData (26/10/2026)
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

// A ordem da fila (26/10/2026): primeiro a nota que alguém abriu na tela (zipFaltam), depois os pedidos das pessoas
// (saídas, contagem, XMLs), por último os da madrugada; dentro de cada um, o mais antigo primeiro.
// (31/10/2026: "Quero que melhore a velocidade do sieg") o "Contar agora" leva 2 s (o 443, 26/10) e um "Baixar XMLs", de 1
// a 5 min: a contagem não espera atrás deles, vai junto com o zipFaltam, na frente. E entre as pessoas,
// um de cada uma por vez: quem pede 10 meses de uma empresa (o 380 de 29/10: 10 pedidos, 37 min) não deixa o pedido único
// de outra pessoa esperando o lote inteiro; os meses dele seguem na ordem, intercalados.
// naFrenteEm: o "passar na frente" da Central dos robôs (10/11/2026), antes de qualquer outro
const urgenciaDoPedido = p => (p.naFrenteEm ? -1 : p.tipo === 'zipFaltam' || p.tipo === 'contagem' ? 0 : p.madrugada || p.criadoPorUid === 'robo' ? 2 : 1);
const quemPediu = p => String(p.criadoPorUid || p.criadoPor || '');
/**
 * Os candidatos ({ p: o pedido, u: a urgência }) na ordem em que o robô atende: em cada urgência, uma rodada com o pedido
 * mais antigo de cada pessoa, depois a segunda… e, na rodada, primeiro quem foi atendido há mais tempo. ultimaVez: a vez
 * (um número que só cresce) em que o robô atendeu cada pessoa (quemPediu) — sem isso, o 2º mês do lote voltava à frente
 * do pedido de outra pessoa assim que o 1º saía da fila.
 */
function ordemDaFila(candidatos, ultimaVez) {
  const porData = (a, b) => String(a.p.criadoEm || '').localeCompare(String(b.p.criadoEm || ''));
  const lista = candidatos.slice().sort((a, b) => a.u - b.u || porData(a, b));
  const rodadas = new Map();
  const rodada = new Map();
  for (const x of lista) { const k = x.u + '|' + quemPediu(x.p); const n = rodadas.get(k) || 0; rodada.set(x, n); rodadas.set(k, n + 1); }
  const atendido = x => (ultimaVez && ultimaVez.get(quemPediu(x.p))) || 0;
  return lista.sort((a, b) => a.u - b.u || rodada.get(a) - rodada.get(b) || atendido(a) - atendido(b) || porData(a, b));
}

// Dois pedidos ao mesmo tempo (31/10/2026: "Pode fazer"). Testado de verdade com a sessão do robô, só lendo: o 380 e o 309 de
// 10/2026 pelo portal (os 5 tipos de nota de cada um, 10 downloads juntos na mesma sessão) levaram 6,5 a 8 s juntos contra 12 a
// 16 s um depois do outro, com os mesmos 747 + 223 XMLs e nenhum erro; 3 meses juntos também passaram (11 s). SIEG_PARALELO
// muda (1 = um por vez, como antes). A API não passa do limite dela com 2: o vez() (acima) é um só para os dois.
const PARALELO = Math.max(1, Math.min(4, Math.trunc(Number(process.env.SIEG_PARALELO)) || 2));
// Sem esperar a leitura do Drive (31/10/2026, o "incremental a partir da madrugada"): medido com o 380 de 10/2026, o portal traz
// o mês inteiro (747 XMLs) em 5,6 a 7,8 s e a leitura do que já está no Drive leva 4,8 s com o cache do C: e 35 s sem ele (o
// que a rotina das 9h acabou de arquivar tem id novo no Drive e não está no cache; o Claudio Secretario é lido sempre do G:).
// O pedido esperava a mais lenta das duas. Quando o último resumo do mês (siegNotas) está todo no que o portal trouxe, o Drive
// não tem nota que falte: o .zip e as notas saem só do portal e a leitura do Drive termina por trás (o que ela achar a mais
// ainda entra no resumo e no .zip do Drive). Baixar só o que entrou depois (o portal filtra pela data de entrada no SIEG,
// periodType 2) não compensa: cai de ~6,6 s para ~3,4 s, mas o evento posterior de uma nota antiga não vem (o portal junta os
// eventos à data de entrada da nota: 516 de 516 no 380, set-out/2026) e o resto do mês teria de sair do Drive, que é o lento.
// SIEG_ESPERAR_DRIVE=1 volta a esperar sempre.
const ESPERAR_O_DRIVE = process.env.SIEG_ESPERAR_DRIVE === '1';
/** A empresa e o mês do pedido: dois pedidos com a mesma chave nunca rodam juntos (a mesma pasta do Drive, as mesmas notas). */
const chaveDaPasta = p => soDigitos(p && p.codigo) + '|' + String((p && p.competencia) || '');

/**
 * Os trabalhadores da fila: até `paralelo` pedidos ao mesmo tempo. escolher(ocupadas, pegos) devolve o próximo pedido
 * ({ id, chave, ... }) que não está em atendimento (pegos: os ids; ocupadas: as chaves empresa|mês), ou null; um escolhe por
 * vez (dois nunca pegam o mesmo pedido). atender(x, n) atende um (n: o número do trabalhador, 1 a paralelo). acordar()
 * põe os trabalhadores para andar e devolve uma promessa que se cumpre quando todos param (a fila não tem mais o que dar).
 * O pedido que chega enquanto um trabalhador está saindo não fica esquecido: quem achou a fila vazia olha de novo se alguém
 * acordou a fila nesse meio tempo (a geração).
 */
function criarTrabalhadores({ paralelo, escolher, atender, preparar, aoFicarLivre, log }) {
  const ocupadas = new Set();
  const pegos = new Set();
  const emUso = new Set();
  let geracao = 0;
  let vez = Promise.resolve();
  let preparo = null;
  let esperando = [];
  const pegar = () => {
    const v = vez.then(() => escolher(ocupadas, pegos)).then(x => { if (x) { ocupadas.add(x.chave); pegos.add(x.id); } return x; });
    vez = v.catch(() => null);
    return v;
  };
  async function trabalhador(n) {
    try {
      if (preparo) await preparo.catch(err => log && log('SIEG: preparar a fila -', motivo(err)));
      for (let voltas = 0; voltas < 1000; voltas++) {
        const g = geracao;
        const x = await pegar();
        if (!x) { if (g !== geracao) continue; break; }
        try { await atender(x, n); }
        catch (err) { if (log) log('SIEG: o pedido', x.id, 'parou -', motivo(err)); }
        finally { ocupadas.delete(x.chave); pegos.delete(x.id); }
      }
    } catch (err) { if (log) log('SIEG: não consegui ler os pedidos -', motivo(err)); }
    finally {
      emUso.delete(n);
      if (!emUso.size) {
        preparo = null;
        const e = esperando;
        esperando = [];
        try { if (aoFicarLivre) aoFicarLivre(); } catch (_) { /* segue */ }
        e.forEach(r => r());
      }
    }
  }
  function acordar() {
    geracao++;
    const livre = new Promise(r => esperando.push(r));
    if (!emUso.size && preparar) preparo = Promise.resolve().then(preparar);
    for (let n = 1; n <= paralelo; n++) if (!emUso.has(n)) { emUso.add(n); trabalhador(n); }
    return livre;
  }
  return { acordar, ativos: () => emUso.size, ocupadas, pegos };
}

/**
 * O download mais o que está no Drive e o SIEG não trouxe (ex.: NFC-e que o SIEG não captura em MG, 09/10/2026): o resumo do
 * mês no nads fica com tudo o que o escritório tem. Devolve { baixado, extras } (extras: quantos entraram).
 */
function juntarOsDoDrive(cnpj, baixado, xmlsDoDrive) {
  const tem = new Set(baixado.arquivos.map(a => a.nome));
  const extras = sx.cteQueEntram(cnpj, xmlsDoDrive).filter(x => !tem.has(sx.nomeDoArquivo(x)));
  if (!extras.length) return { baixado, extras: 0 };
  const junto = require('./sieg-portal').montarXmls(cnpj, [...baixado.arquivos.map(a => a.xml), ...extras]);
  return { baixado: Object.assign({}, baixado, { arquivos: junto.arquivos, resumo: junto.resumo, doDrive: (baixado.doDrive || 0) + extras.length }), extras: extras.length };
}

// a NFS-e não tem chave: vale o tipo, o número, o prestador e a data
const idDaNota = n => n.chave || [n.tipo, n.numero, soDigitos(n.emitente && n.emitente.doc), n.data].join('|');
/**
 * O que o último download do mês tinha (siegNotas: as notas do resumo) está todo no que o portal trouxe agora? Então não há
 * nota que só o Drive tenha (a NFC-e que o SIEG não captura em MG, os XMLs que o cliente mandou: essas entraram no resumo
 * da vez passada) e o pedido não precisa esperar a leitura do Drive para entregar o .zip e as notas.
 */
function cobreOUltimo(ultimo, resumo) {
  if (!ultimo || !Array.isArray(ultimo.emitidas) || !Array.isArray(ultimo.recebidas)) return false;
  const tem = new Set([...resumo.emitidas, ...resumo.recebidas].map(idDaNota));
  return [...ultimo.emitidas, ...ultimo.recebidas].every(n => tem.has(idDaNota(n)));
}

// ---------- a madrugada não repete o mês que não mudou (31/10/2026) ----------
// A madrugada pedia de novo, toda noite, o mês anterior de quem não fechava "as notas do nads = a contagem do SIEG", tipo
// por tipo. Dois casos nunca fecham: (1) o SIEG conta uma nota que a API não entrega (a NFS-e recebida "1" de uns 36
// clientes fora do portal, 404 no portal e 0 XMLs na API: 137, 145, 152, 313, 348…; noites de 29, 30 e 31/10, ~1 a 2 min
// cada) e (2) o Drive tem notas que o SIEG não tem (a NFC-e de MG: o 54 com 668 no nads e 0 no SIEG). E depois do dia 10 a
// contagem do mês anterior não é refeita à noite: a siegContagens desse mês é a que o próprio download gravou, então a
// comparação dava sempre o mesmo "não fecha". Agora o resumo guarda a contagem do SIEG de antes do download (contagemSieg)
// e a madrugada conta o mês de novo (2 contagens, que custam bem menos que um download): se o SIEG conta hoje o mesmo que
// contava antes do último download, não há nota nova e o mês não é baixado de novo. Nota nova de verdade muda a contagem.
const TIPOS_DA_CONTAGEM = ['NFe', 'NFCe', 'CTe', 'NFSe', 'CFe'];
/** Só os números da contagem ({ emitidas, recebidas }, os 5 tipos), ou null. */
function soAContagem(x) {
  if (!x || !x.emitidas || !x.recebidas) return null;
  const g = o => Object.fromEntries(TIPOS_DA_CONTAGEM.map(k => [k, Number(o[k]) || 0]));
  return { emitidas: g(x.emitidas), recebidas: g(x.recebidas) };
}
/** As duas contagens são iguais em todos os tipos, emitidas e recebidas. */
function mesmaContagem(a, b) {
  const x = soAContagem(a);
  const y = soAContagem(b);
  return !!x && !!y && ['emitidas', 'recebidas'].every(g => TIPOS_DA_CONTAGEM.every(k => x[g][k] === y[g][k]));
}
/**
 * As notas do nads (siegNotas) já têm, tipo por tipo, o que a contagem do SIEG diz (a regra de antes de 31/10/2026).
 */
const CHAVE_DO_TIPO = { 'NF-e': 'NFe', 'NFC-e': 'NFCe', 'CT-e': 'CTe', 'NFS-e': 'NFSe', 'CF-e': 'CFe' };
/** Por tipo de nota: [quantas o nads tem, quantas a contagem diz] (emitidas e recebidas juntas). */
function porTipo(cont, notas) {
  const tem = {};
  for (const n of [...((notas && notas.emitidas) || []), ...((notas && notas.recebidas) || [])]) tem[n.tipo] = (tem[n.tipo] || 0) + 1;
  return Object.keys(CHAVE_DO_TIPO).map(t => [tem[t] || 0, ((cont.emitidas || {})[CHAVE_DO_TIPO[t]] || 0) + ((cont.recebidas || {})[CHAVE_DO_TIPO[t]] || 0)]);
}
function completoNoNads(cont, notas) {
  if (!cont || !notas || !Array.isArray(notas.emitidas)) return false;
  return porTipo(cont, notas).every(([tem, conta]) => tem === conta);
}
/**
 * A contagem do SIEG de antes do último download do mês: a que o resumo guardou (contagemSieg) ou, nos resumos de antes de
 * 31/10/2026, a siegContagens que o próprio download gravou junto com o resumo (a mesma hora, com 2 min de folga). null quando
 * não se sabe (aí a madrugada baixa, como antes).
 */
function contagemDoUltimoDownload(notas, cont) {
  if (!notas) return null;
  if (soAContagem(notas.contagemSieg)) return soAContagem(notas.contagemSieg);
  const t = Date.parse(notas.em || '');
  const u = Date.parse((cont && cont.em) || '');
  return Number.isFinite(t) && Number.isFinite(u) && Math.abs(t - u) <= 120000 ? soAContagem(cont) : null;
}
/**
 * O mês não mudou no SIEG desde o último download: a contagem de agora é a de antes dele (agora null, não deu para contar:
 * mudou). E o que falta no nads tem a cara da nota que a API não entrega: o tipo veio com 0 (a NFS-e "1" que vem vazia). O
 * tipo que veio pela metade (120 contadas, 100 baixadas) pode ser um download que parou no meio sem erro: esse segue sendo
 * pedido toda noite, como antes.
 */
function semMudancaNoSieg(notas, cont, agora) {
  const antes = contagemDoUltimoDownload(notas, cont);
  return !!agora && mesmaContagem(agora, antes) && porTipo(antes, notas).every(([tem, conta]) => tem >= conta || tem === 0);
}

// ---------- os cancelamentos que chegam depois do download (11/11/2026) ----------
// "preciso que ele puxe evento de cancelamento": o evento vem junto com as notas do mês (BaixarEventos na API, includeEvents
// no portal), mas a nota cancelada DEPOIS do download não muda a contagem do SIEG, e a madrugada não baixava o mês de novo
// (semMudancaNoSieg, completoNoNads). Combinado com o usuário: só o cancelamento (110111; o da NFS-e nacional), das emitidas
// e das recebidas, na madrugada (os meses que ela conta: o atual e, até o dia 10, o anterior) e no "Baixar XMLs" (que agora
// baixa sempre todos os tipos pelo portal). O arquivador põe o XML do cancelamento em EMITIDOS|RECEBIDOS\CANCELADAS.
/** Os tipos do portal com nota no mês (emitidas + recebidas), dos que têm evento de cancelamento: o CF-e não entra. */
function tiposComNotas(contagem) {
  const k = { 'NF-e': 'NFe', 'NFC-e': 'NFCe', 'CT-e': 'CTe', 'NFS-e': 'NFSe' };
  return Object.keys(k).filter(t => ((contagem && contagem.emitidas && contagem.emitidas[k[t]]) || 0) + ((contagem && contagem.recebidas && contagem.recebidas[k[t]]) || 0) > 0);
}
/** As notas canceladas que estão nos arquivos ({ nome, xml }): a chaveCancelada de cada evento de cancelamento. */
const cancelamentosDe = arquivos => [...new Set((arquivos || []).filter(a => sx.ehCancelamento(a.xml)).map(a => sx.chaveCancelada(a.xml)).filter(Boolean))];
/** As notas marcadas como canceladas num resumo do nads (siegNotas). */
const canceladasDoResumo = r => [...((r && r.emitidas) || []), ...((r && r.recebidas) || [])].filter(n => n.cancelada).map(sx.idParaCancelamento).filter(Boolean);
/**
 * A busca da madrugada, sem rede nem banco (tudo vem de fora, para dar para testar). Para cada empresa e mês com nota:
 *  - o mês que a memória não conhece: lê o resumo do último download (lerResumo; 1 leitura, só da primeira vez). Sem resumo,
 *    o mês nunca foi baixado: fica marcado e não é olhado (o download normal traz os cancelamentos quando vier);
 *  - baixa pelo portal (baixar: os tipos com nota) e separa os eventos de cancelamento;
 *  - cancelamento que a memória não tem: pede o download do mês (pedir), que grava no Drive e marca as canceladas no nads.
 * pararTudo(err): o erro que encerra a busca (o portal pediu login). Devolve os números para o log.
 */
async function procurarCancelamentos({ itens, memoria, lerResumo, baixar, pedir, deveParar, pararTudo, aoAndar, log }) {
  const r = { olhados: 0, pedidos: 0, semDownload: 0, erros: 0, novos: 0, parou: '' };
  for (const it of itens) {
    if (deveParar && deveParar()) { r.parou = 'pausado'; break; }
    const tipos = tiposComNotas(it.contagem);
    if (!tipos.length || memoria.semDownload(it.codigo, it.comp)) continue;
    if (!memoria.conhece(it.codigo, it.comp)) {
      const resumo = await lerResumo(it.codigo, it.comp);
      if (!resumo) { memoria.marcarSemDownload(it.codigo, it.comp); r.semDownload++; continue; }
      memoria.anotar(it.codigo, it.comp, canceladasDoResumo(resumo));
    }
    if (aoAndar) aoAndar('cancelamentos de ' + it.codigo + ' (' + it.comp + ')');
    let arquivos;
    try { arquivos = await baixar(it.cnpj, it.comp, tipos); }
    catch (err) {
      if (pararTudo && pararTudo(err)) { r.parou = motivo(err); break; }
      r.erros++;
      if (log) log('SIEG: cancelamentos de', it.codigo, it.comp, '-', motivo(err));
      continue;
    }
    r.olhados++;
    const novas = memoria.novas(it.codigo, it.comp, cancelamentosDe(arquivos));
    if (!novas.length) continue;
    await pedir(it, novas);
    r.pedidos++;
    r.novos += novas.length;
    if (log) log('SIEG: cancelamentos de', it.codigo, it.comp, '-', novas.length, 'novo(s) desde o último download: o mês vai ser baixado de novo');
  }
  return r;
}

function iniciarSieg({ db, log }) {
  const estadoRef = db.collection('robo').doc('sieg');
  const { c, faltam } = lerCredenciais();
  if (faltam.length) {
    log('SIEG desligado: falta ' + faltam.join(', ') + ' em scripts/sieg_credenciais.json');
    painel.modulo('sieg', 'SIEG', false, 'falta ' + faltam.join(', ') + ' nas credenciais');
    estadoRef.set({ em: new Date().toISOString(), ligado: false, motivo: 'falta ' + faltam.join(', ') }, { merge: true }).catch(() => {});
    return () => {};
  }
  // o que cada trabalhador da fila está fazendo (31/10/2026: dois pedidos ao mesmo tempo) e a contagem da madrugada
  const fazendo = new Map();
  let daNoite = '';
  const situacaoAgora = () => [...fazendo.values(), daNoite].filter(Boolean).join(' · ') || 'livre';
  // quantos pedidos esperam na fila (a tela mostra enquanto a pessoa espera; 26/10/2026)
  let naFila = 0;
  painel.fazendoPor('sieg', () => (situacaoAgora() !== 'livre' ? 'SIEG: ' + situacaoAgora() : gravandoNoDrive ? 'SIEG: salvando XMLs no Drive por trás' : null));
  // o ponto só vai ao banco quando muda (o que está fazendo, a fila) ou, sem mudança, a cada 5 min (batimento.js; 10/11/2026,
  // consumo do banco: era a cada 1 min, 1.440 gravações por dia com o robô parado; as telas: 7 min sem ponto = desligado)
  const batida = require('./batimento').criarBatimento();
  const ponto = () => {
    const d = { em: new Date().toISOString(), ligado: true, motivo: null, situacao: situacaoAgora(), naFila, paralelo: PARALELO };
    if (!batida.vale(d)) return Promise.resolve();
    return estadoRef.set(d, { merge: true }).catch(() => batida.falhou());
  };
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
  // de 30 em 30 min (11/11/2026, consumo do banco: rodava a cada volta da fila, de 2 em 2 min; o .zip vale por horas)
  let apagouZipsEm = 0;
  async function apagarZipsVelhos() {
    if (Date.now() - apagouZipsEm < 30 * 60 * 1000) return;
    apagouZipsEm = Date.now();
    const velhos = await db.collection('pedidosSieg').where('zipApagarEm', '<=', new Date().toISOString()).limit(20).get();
    for (const d of velhos.docs) {
      for (const nome of (d.data().zip && d.data().zip.partes) || []) await db.collection('siegNotas').doc(nome).delete().catch(() => {});
      await d.ref.update({ zipApagarEm: null, 'zip.partes': [], 'zip.apagado': true });
    }
  }
  // o robô caiu (ou foi atualizado) no meio de um pedido: volta para a fila
  db.collection('pedidosSieg').where('status', '==', 'processando').get().then(s => s.docs.forEach(d => {
    log('SIEG: retomando o pedido', d.id, 'que ficou pela metade');
    d.ref.update({ status: 'pendente', andamento: '' }).catch(err => log('SIEG: não consegui devolver à fila o pedido', d.id, '(' + motivo(err) + '): ele fica como processando'));
  })).catch(err => log('SIEG: não consegui ler os pedidos que ficaram pela metade -', motivo(err)));
  // e no meio do Drive por trás (31/10/2026: com a fila do Drive, um lote pode deixar uns minutos de XMLs para gravar): o
  // "Baixar XMLs" dos últimos 2 dias que não terminou de gravar volta para a fila (o portal baixa de novo em segundos e só
  // grava o que falta). O dos XMLs do cliente não volta (os pedaços que ele mandou já foram apagados): fica o aviso.
  db.collection('pedidosSieg').where('drive.pronto', '==', false).limit(100).get().then(s => {
    const desde = new Date(Date.now() - 2 * 864e5).toISOString();
    for (const d of s.docs) {
      const p = d.data();
      if (String(p.concluidoEm || '') < desde) continue;
      if (p.tipo === 'xmls') {
        log('SIEG: o pedido', d.id, 'de', p.codigo, p.competencia, 'não terminou de gravar no Drive: volta para a fila');
        d.ref.update({ status: 'pendente', andamento: '', drive: null }).catch(err => log('SIEG: não consegui devolver à fila o pedido', d.id, '(' + motivo(err) + ')'));
      } else {
        log('SIEG: o pedido', d.id, 'de', p.codigo, p.competencia, 'não terminou de gravar no Drive (' + (p.drive && p.drive.feitos) + ' de ' + (p.drive && p.drive.total) + ')');
        d.ref.update({ 'drive.pronto': true, 'drive.erro': 'o robô reiniciou antes de terminar de gravar no Drive' }).catch(err => log('SIEG: não consegui marcar o aviso do Drive no pedido', d.id, '(' + motivo(err) + ')'));
      }
    }
  }).catch(err => log('SIEG: não consegui conferir o Drive por trás dos pedidos -', motivo(err)));

  // a contagem da madrugada não roda junto com os pedidos (o limite é por API Key): os pedidos do nads passam na frente
  // dela. O pedido que chega no meio da contagem fica marcado (chegouOutro) e a contagem para para atendê-lo.
  let contando = false;
  let chegouOutro = false;
  // o Drive por trás (31/10/2026: "Quero que melhore a velocidade do sieg"): a pessoa já ficava livre quando o .zip e as
  // notas estavam no nads (09/10/2026), mas a FILA esperava o Drive gravar os XMLs novos para pegar o pedido seguinte. O G:
  // grava uns 3 a 4 XMLs por segundo (29/10, o 380 de 10/2025: 614 XMLs em 2 min 50 s), e o lote de 10 meses do 380
  // passou ~20 dos 37 minutos esperando o Drive. Agora o Drive grava numa fila só dele, um pedido de cada vez (para não
  // disputar o G:), e o robô já pega o próximo pedido; só um pedido da MESMA pasta (empresa e mês) espera a gravação dela
  // terminar antes de ler o que já está lá.
  let filaDoDrive = Promise.resolve();
  let gravandoNoDrive = 0;
  const driveDaPasta = new Map();
  const esperarODrive = pasta => driveDaPasta.get(pasta) || Promise.resolve();
  function gravarNoDrivePorTras(pasta, gravar) {
    gravandoNoDrive++;
    const vez = filaDoDrive.then(gravar).catch(err => log('SIEG: Drive por trás -', motivo(err))).finally(() => { gravandoNoDrive--; });
    filaDoDrive = vez;
    driveDaPasta.set(pasta, vez);
    vez.then(() => { if (driveDaPasta.get(pasta) === vez) driveDaPasta.delete(pasta); });
  }
  // sem o Google Drive deste PC aberto (26/10/2026: 59 erros "a pasta do Drive deste PC não está em…" às 3h35; o Drive só
  // abriu às 13h06): o pedido de XMLs não dá erro, fica na fila e é atendido quando a pasta aparecer (o relógio de 10 em
  // 10 minutos tenta de novo); e os que já deram esse erro nos últimos 3 dias voltam para a fila sozinhos quando o Drive
  // volta. Os outros pedidos (saídas, contagem) não precisam do Drive e seguem.
  const ERRO_SEM_DRIVE = 'a pasta do Drive deste PC não está em';
  const driveAberto = () => fs.existsSync(PASTA_DO_DRIVE);
  let avisouSemDrive = 0;
  // Só quando o Drive VOLTA (estava fechado e abriu) e uma vez ao ligar (11/11/2026, consumo do banco): a conferência de
  // 10 em 10 min relia todos os pedidos com erro (até 300; ~200 em 10/11) com o Drive aberto o tempo todo, ~1.200
  // leituras por hora, o dia inteiro, para não achar nada
  let conferiuAoLigar = false;
  let driveVistoFechado = false;
  async function devolverOsQueEsperavamODrive() {
    if (!driveAberto()) { driveVistoFechado = true; return; }
    if (conferiuAoLigar && !driveVistoFechado) return;
    conferiuAoLigar = true;
    driveVistoFechado = false;
    const desde = new Date(Date.now() - 3 * 864e5).toISOString();
    const s = await db.collection('pedidosSieg').where('status', '==', 'erro').limit(300).get();
    const voltam = s.docs.filter(d => String(d.data().erro || '').startsWith(ERRO_SEM_DRIVE) && String(d.data().erroEm || '') >= desde);
    for (const d of voltam) await d.ref.update({ status: 'pendente', erro: null, andamento: '' });
    if (voltam.length) {
      log('SIEG: o Drive deste PC abriu -', voltam.length, 'pedidos de XMLs que deram erro sem ele voltaram para a fila');
      painel.atividade('sieg', 'O Drive deste PC abriu: ' + voltam.length + ' pedidos de XMLs voltaram para a fila', 'eles tinham dado erro porque o Google Drive estava fechado');
    }
  }
  // A ordem da fila: ordemDaFila (acima). Os repetidos (o mesmo tipo, empresa e mês: a madrugada de 3 noites devolvida de
  // uma vez quando o Drive abriu) vão juntos: fica o mais novo, que é o que a tela acompanha, com a prioridade do mais
  // urgente deles; os outros fecham como concluídos ("juntadoCom"). Os de XMLs ficam esperando se o Drive deste PC não
  // estiver aberto (sem mexer neles).
  const JUNTAVEIS = new Set(['saidas', 'contagem', 'xmls']);
  const urgencia = urgenciaDoPedido;
  // a vez em que o robô atendeu cada pessoa (ordemDaFila)
  const ultimaVez = new Map();
  let vezes = 0;
  // ocupadas: as empresas e meses que um trabalhador já atende (o pedido da mesma espera); pegos: os pedidos em atendimento
  // (a leitura da fila pode ainda vê-los "pendente" antes de o "processando" chegar ao banco)
  // a fila viva (07/11/2026): a resposta do ouvinte dos pendentes (pararPedidos, lá embaixo) já é a fila; o banco só é lido
  // quando ele não respondeu nos últimos 2 min (fila parada, ou o ouvinte caiu: a reserva de 2 em 2 min continua valendo).
  // Antes eram até 500 leituras a CADA pedido atendido (uma fila de 500: ~125 mil para esvaziar). O que acabou de terminar
  // (ou de ser juntado) fica de fora por 2 min, até a resposta nova do ouvinte chegar sem ele.
  // A resposta do ouvinte vale enquanto ele está de pé (10/11/2026, consumo do banco): o ouvinte só responde quando a fila
  // muda, então "sem resposta há 2 min" era a fila parada, não o ouvinte caído, e a fila parada (pedidos esperando o Drive)
  // era relida inteira a cada 2 min. O ouvinte que cai é refeito pelo ouvinte.js, que zera a fila viva; 30 min é só a reserva.
  let filaViva = null, filaVivaEm = 0;
  const terminados = new Map();   // id → quando terminou
  const RECENTE_MS = 2 * 60 * 1000;
  const FILA_VIVA_VALE_MS = 30 * 60 * 1000;
  async function proximoPedido(ocupadas, pegos) {
    // pausado pela Central dos robôs: nenhum pedido novo; o que já está sendo atendido termina
    if (pausaLocal.estaPausado('sieg')) return null;
    const viva = filaViva && Date.now() - filaVivaEm < FILA_VIVA_VALE_MS ? filaViva : null;
    const docs = viva || (await db.collection('pedidosSieg').where('status', '==', 'pendente').limit(500).get()).docs;
    for (const [id, t] of terminados) if (Date.now() - t >= RECENTE_MS) terminados.delete(id);
    const pendentes = docs.filter(d => !terminados.has(d.id));
    const semDrive = !driveAberto();
    const vale = pendentes.filter(d => !pegos.has(d.id) && !(semDrive && (d.data().tipo === 'xmls' || d.data().tipo === 'xmlsCliente')));
    // (31/10/2026) só quando é o Drive que segura: com dois trabalhadores, o pedido que o outro já pegou (pegos) também fica de
    // fora e o aviso "esperando o Google Drive" saía com o Drive aberto (visto no ensaio)
    if (semDrive && pendentes.some(d => d.data().tipo === 'xmls' || d.data().tipo === 'xmlsCliente') && Date.now() - avisouSemDrive > 60 * 60 * 1000) {
      avisouSemDrive = Date.now();
      log('SIEG: pedidos de XMLs esperando o Google Drive deste PC abrir (' + PASTA_DO_DRIVE + ')');
      painel.atividade('sieg', 'Pedidos de XMLs esperando o Google Drive deste PC abrir', 'a pasta ' + PASTA_DO_DRIVE + ' não está aberta; o robô baixa assim que ela aparecer', { aviso: true });
    }
    const grupos = new Map();
    const candidatos = [];
    for (const d of vale) {
      const p = d.data();
      const tipo = p.tipo || 'saidas';
      if (!JUNTAVEIS.has(tipo)) { candidatos.push({ d, p, u: urgencia(p) }); continue; }
      const k = tipo + '|' + soDigitos(p.codigo) + '|' + p.competencia;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(d);
    }
    let juntados = 0;
    for (const g of grupos.values()) {
      g.sort((a, b) => String(b.data().criadoEm || '').localeCompare(String(a.data().criadoEm || '')));
      const fica = g[0];
      for (const d of g.slice(1)) {
        // se isto falhar o pedido repetido ficaria "trabalhando" para sempre: tenta de novo e, não dando, deixa dito no log
        await est.tentarDeNovo(() => d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString(), andamento: '', juntadoCom: fica.id }))
          .catch(err => log('SIEG: não consegui concluir o pedido repetido', d.id, '(' + motivo(err) + '): ele pode ficar como trabalhando'));
        terminados.set(d.id, Date.now());
        juntados++;
      }
      candidatos.push({ d: fica, p: fica.data(), u: Math.min(...g.map(x => urgencia(x.data()))) });
    }
    if (juntados) log('SIEG: ' + juntados + ' pedidos repetidos (mesmo tipo, empresa e mês) foram juntos com o mais novo');
    const fila = ordemDaFila(candidatos, ultimaVez);
    const vez = fila.find(x => !ocupadas.has(chaveDaPasta(x.p)));
    naFila = Math.max(0, fila.length - (vez ? 1 : 0));
    ponto();
    if (!vez) return null;
    ultimaVez.set(quemPediu(vez.p), ++vezes);
    return { d: vez.d, id: vez.d.id, chave: chaveDaPasta(vez.p) };
  }

  // a fila é relida antes de cada pedido (26/10/2026: "ta bugado ou demora muito para puxar a nota": a nota de uma tela
  // esperava atrás de 176 pedidos de XMLs da madrugada): cada trabalhador escolhe o mais urgente que está livre
  const trabalhadores = criarTrabalhadores({
    paralelo: PARALELO,
    escolher: proximoPedido,
    atender: async (x, n) => {
      try { await atenderUm(x.d, t => { if (t) fazendo.set(n, t); else fazendo.delete(n); }); }
      finally { fazendo.delete(n); terminados.set(x.id, Date.now()); ponto(); }
    },
    preparar: async () => {
      await apagarZipsVelhos().catch(err => log('SIEG: não consegui apagar os .zip velhos -', motivo(err)));
      await devolverOsQueEsperavamODrive().catch(err => log('SIEG: não consegui devolver os pedidos que esperavam o Drive -', motivo(err)));
    },
    aoFicarLivre: () => { naFila = 0; ponto(); },
    log,
  });
  /** Põe a fila para andar; a promessa se cumpre quando a fila esvazia. No meio da contagem da madrugada, só marca. */
  function atenderPedidos() {
    if (pausaLocal.estaPausado('sieg')) return Promise.resolve();
    if (contando) { chegouOutro = true; return Promise.resolve(); }
    return trabalhadores.acordar();
  }

  /** Um pedido, do começo ao fim (o status no banco: processando → concluido ou erro). ponha(texto): o que está fazendo. */
  async function atenderUm(d, ponha) {
    const p = d.data();
    const id = soDigitos(p.codigo) + '_' + p.competencia;
    ponha('baixando as saídas de ' + p.codigo);
    // de uma vez só (10/11/2026): o pedido cancelado pela Central dos robôs enquanto esperava não roda, mesmo com a fila viva atrasada
    const peguei = await db.runTransaction(async t => {
      const s = await t.get(d.ref);
      if (!s.exists || (s.data() || {}).status !== 'pendente') return false;
      t.update(d.ref, { status: 'processando', processandoEm: new Date().toISOString() });
      return true;
    });
    if (!peguei) { log('SIEG: o pedido', d.id, 'saiu da fila antes de começar'); return; }
    try {
      // o nads conhece a empresa pelo código: o CNPJ vem do cadastro de clientes
      let cnpj = normalizarDocumento(p.cnpj);
      if (!cnpj) {
        const lista = [];
        (await require('./clientes-cache').clientesAtivos(db)).forEach(x => lista.push(x.data()));
        const cli = lista.find(x => codigoDe(x) === soDigitos(p.codigo));
        cnpj = normalizarDocumento(cli && cli.documento, cli && cli.enquadramento);
        if (!cnpj) throw new Error(SEM_DOC(soDigitos(p.codigo)));
      }
      // "Baixar XMLs do SIEG" (07/10/2026): todos os XMLs do mês na pasta do cliente (Drive deste PC) e o resumo no banco
      // e os XMLs que o cliente mandou (xmlsCliente, 08/10/2026): o nads manda os arquivos em pedaços
      // (pedidosSieg/{id}/xmls); o robô junta com os do Drive e segue o mesmo caminho, sem o SIEG e sem o .zip para baixar
      if (p.tipo === 'xmls' || p.tipo === 'xmlsCliente') {
        const doCliente = p.tipo === 'xmlsCliente';
        ponha((doCliente ? 'lendo os XMLs do cliente ' : 'baixando os XMLs de ') + p.codigo);
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
        // a gravação por trás desta mesma pasta (o pedido anterior da empresa e mês) termina antes de ler o Drive
        await esperarODrive(pasta);
        // já baixou antes? (08/10/2026: "caso tenham baixado esses XMLs, para acelerar, verifica se tem todos no Drive,
        // aí puxa de lá, baixando apenas os excedentes"): conta agora no SIEG (2 consultas rápidas) e compara, tipo por
        // tipo, com as notas do último download; o tipo que não mudou sai do .zip que está na pasta, sem baixar
        // a conferência roda JUNTO com os downloads (08/10/2026: "tá demorando em média 3 minutos, queria que demorasse
        // 1"): quando ela diz que um tipo não mudou, o download dele é cancelado e ele sai do .zip do Drive
        // o que já está no Drive (a pasta 2026 do cliente, depois o Claudio Secretario; 09/10/2026), lido uma vez só
        const noDrive = xmlsJaNoDrive(soDigitos(p.codigo), nomeDaPasta, p.competencia, db).catch(() => ({ xmls: [], nomes: new Set() }));
        // e o resumo do último download do mês (para saber se dá para não esperar o Drive: ESPERAR_O_DRIVE, acima)
        const ultimoResumo = !doCliente ? db.collection('siegNotas').doc(id).get().then(s => (s.exists ? s.data() : null)).catch(() => null) : null;
        let peloPortal = false;
        // (11/11/2026: "preciso que ele puxe evento de cancelamento") o portal baixa sempre todos os tipos. Antes, o tipo que tinha a
        // mesma quantidade de notas que o Drive (a conferência "reaproveitar", 08/10/2026) tinha o download cancelado e saía do
        // Drive: a nota cancelada depois do último download tem a mesma quantidade e o evento de cancelamento nunca vinha. O
        // portal traz o mês em segundos (31/10/2026: 5,6 a 7,8 s no 380) e o que já está no Drive não é gravado de novo
        // (faltamNoDrive, abaixo). O xmlsPeloPortal ainda aceita a conferência; ela só não é mais passada daqui.
        // pelo portal primeiro (08/10/2026: "tem clientes com 1000 xml de uma vez, quero que ele vá no site e baixe"):
        // os tipos de nota ao mesmo tempo, em segundos; sem a sessão do portal ou com erro, pela API (mais lenta)
        let baixado;
        if (doCliente) {
          const sp = require('./sieg-portal');
          await andar('baixando', 'Lendo os XMLs que o cliente mandou', 0.1, true);
          const pedacos = await d.ref.collection('xmls').get();
          // sem arquivos (partes 0): "puxar os XMLs do cliente direto da pasta do Drive" (09/10/2026) — os do mês na
          // pasta do ano do cliente e no Claudio Secretario
          if (!p.partes) await andar('baixando', 'Lendo os XMLs da pasta do cliente no Drive', 0.2, true);
          const mandados = !p.partes ? (await noDrive).xmls
            : JSON.parse(pedacos.docs.sort((a, b) => a.data().n - b.data().n).map(x => x.data().dados).join('') || '[]');
          const deles = sp.soDoCliente(cnpj, mandados);
          // os do Drive (o último .zip da pasta) entram junto: o resumo do mês fica com tudo
          const velhos = (await noDrive).xmls;
          baixado = sp.montarXmls(cnpj, [...velhos, ...deles], { todosOsCte: true });
          baixado.doDrive = velhos.length;
          numeros.doCliente = deles.length;
          numeros.deOutros = mandados.length - deles.length;
          await andar('baixando', deles.length + ' XMLs do cliente' + (numeros.deOutros ? ' (' + numeros.deOutros + ' de outra empresa ficaram de fora)' : ''), 1, true);
          await Promise.all(pedacos.docs.map(x => x.ref.delete().catch(() => {})));
          log('SIEG: XMLs do cliente', p.codigo, p.competencia, '-', deles.length, 'dele,', numeros.deOutros, 'de outra empresa');
        } else if (portal404.recente(cnpj)) {
          // o portal respondeu 404 para este cliente há pouco (até 3 dias): nem tenta, vai pela API
          log('SIEG: XMLs de', p.codigo, '- o portal deu 404 para este cliente há pouco: direto pela API');
          await andar('baixando', 'Baixando pela API (o portal deu 404 há pouco)', null, true);
          baixado = await xmlsDoMes(c, cnpj, p.competencia, t => andar('baixando', t, null));
        } else try {
          baixado = await require('./sieg-portal').xmlsPeloPortal(cnpj, p.competencia, (t, f) => andar('baixando', t, f), lerZip, null, esperado);
          peloPortal = true;
          portal404.limpar(cnpj);
          log('SIEG: XMLs de', p.codigo, 'pelo portal' + (baixado.tiposDoDrive.length ? ' (do Drive: ' + baixado.tiposDoDrive.join(', ') + ')' : ''));
        } catch (err) {
          if (est.ehPortal404(err)) portal404.anotar(cnpj);
          log('SIEG: portal não deu (' + motivo(err) + '), XMLs de', p.codigo, 'pela API');
          await andar('baixando', 'O portal não deu (' + motivo(err) + '): baixando pela API', null, true);
          baixado = await xmlsDoMes(c, cnpj, p.competencia, t => andar('baixando', t, null));
        }
        // o que está no Drive e o SIEG não trouxe entra junto (juntarOsDoDrive); quando o portal trouxe tudo o que o último
        // download tinha, isso fica para depois, por trás (ESPERAR_O_DRIVE, acima)
        const semEsperarODrive = !doCliente && !ESPERAR_O_DRIVE && peloPortal && !baixado.tiposDoDrive.length && cobreOUltimo(await ultimoResumo, baixado.resumo);
        if (!doCliente && !semEsperarODrive) {
          const j = juntarOsDoDrive(cnpj, baixado, (await noDrive).xmls);
          baixado = j.baixado;
          if (j.extras) log('SIEG: XMLs de', p.codigo, '-', j.extras, 'que estavam só no Drive entraram no resumo');
        }
        if (semEsperarODrive) log('SIEG: XMLs de', p.codigo, p.competencia, '- o portal trouxe tudo o que o último download tinha: sem esperar a leitura do Drive');
        let { arquivos, resumo } = baixado;
        const { contagem } = baixado;
        numeros.xmls = arquivos.length;
        numeros.doDrive = baixado.doDrive || 0;
        // os PDFs das notas (09/11/2026: "quero tambem que o sieg puxe as notas em pdf tambem", "2 c": no .zip entregue e no
        // Drive). Saem do XML (sieg-pdfs.js); se falharem, o pedido segue só com os XMLs
        const pdfsFeitos = new Map();
        const fazerPdfs = async (lista, aoAndar) => {
          const { pdfs, falhas } = await siegPdfs.pdfsDasNotas(lista.filter(a => !pdfsFeitos.has(a.nome)), aoAndar);
          for (const pdf of pdfs) pdfsFeitos.set(pdf.de, pdf);
          if (falhas.length) log('SIEG: PDFs de', p.codigo, p.competencia, '-', falhas.length, 'não saíram (ex.:', falhas[0].nome + ':', falhas[0].motivo + ')');
          return lista.map(a => pdfsFeitos.get(a.nome)).filter(Boolean);
        };
        let extrasDoZip = [];
        if (arquivos.length && !doCliente && !p.madrugada) {
          try {
            const pdfs = await fazerPdfs(arquivos, (i, n) => andar('entregando', 'Gerando os PDFs (' + i + ' de ' + n + ')', 0));
            const { entram, fora } = siegPdfs.paraOZip(pdfs);
            extrasDoZip = entram;
            numeros.pdfs = pdfs.length;
            if (fora) log('SIEG: PDFs de', p.codigo, p.competencia, '-', fora, 'de', pdfs.length, 'ficaram fora do .zip (limite de tamanho)');
          } catch (err) { log('SIEG: não consegui fazer os PDFs de', p.codigo, p.competencia, '-', motivo(err)); }
        }
        const zip = arquivos.length ? sx.zipDe(arquivos.concat(extrasDoZip)) : null;
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
        // a contagem do SIEG de antes do download (a madrugada compara com ela: semMudancaNoSieg). Só vale a de antes: uma
        // contagem feita depois de começar a baixar poderia contar uma nota que o download não pegou. A API conta logo
        // antes de baixar; no portal vale a da madrugada que criou o pedido, ou a que estava gravada quando o pedido começou
        const contagemSieg = soAContagem(peloPortal || doCliente ? (p.contagemSieg || cont) : contagem);
        await db.collection('siegNotas').doc(id).set(resumoQueCabe({
          codigo: soDigitos(p.codigo), competencia: p.competencia, em: new Date().toISOString(), pasta: onde, zip: zip ? nomeDoZip : '', arquivos: arquivos.length, novos: arquivos.length,
          emitidas: resumo.emitidas, recebidas: resumo.recebidas, resumo: sx.VERSAO_DO_RESUMO, ...(contagemSieg ? { contagemSieg } : {}),
        }));
        // e a sequência das saídas (a Conferência de Saídas lê daqui, sem outro pedido)
        await db.collection('siegSaidas').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series: seriesDasNotas(saidasDoResumo(resumo.emitidas)) });
        // 3) a pasta do cliente no Drive: só os XMLs que ainda não estão lá (08/10/2026: "se já foi salvo uma vez, só
        // sobreponha os a mais e não salve no drive o que já foi salvo"). O nome do arquivo é a chave da nota: o mesmo
        // nome é a mesma nota. O .zip só é refeito quando entrou XML novo (ou quando ainda não existe)
        let pulados = 0;
        const faltamNoDrive = async lista => {
          const jaTem = new Set([...(await noDrive).nomes, ...(await fs.promises.readdir(pasta).catch(() => []))]);
          const faltam = lista.filter(a => !jaTem.has(a.nome));
          // o que o arquivador já arquivou (índice de chaves) não volta à pasta de entrada: em novembro 79% do trabalho dele era "já arquivado"
          const cli = +soDigitos(p.codigo);
          const novos = faltam.filter(a => !jaArquivados.pular(cli, a.nome));
          pulados = faltam.length - novos.length;
          return novos;
        };
        // sem esperar o Drive, ainda não se sabe quantos faltam: o total vai com todos e é acertado por trás; até lá o pedido
        // fica com drive.conferindo (31/10/2026: a tela mostrava "Salvando no Drive por trás (0 de 747)" e depois "de 175")
        let faltam = semEsperarODrive ? null : await faltamNoDrive(arquivos);
        numeros.jaSalvos = faltam ? arquivos.length - faltam.length : 0;
        const comoFica = f => ({ pasta: !f || f.length ? onde : 'o Drive do cliente (já estava tudo lá)', zip: !f || f.length ? nomeDoZip : '' });
        // a pessoa já está livre (09/10/2026: "sim" — liberar quando o .zip e as notas estão no nads): o pedido fica
        // concluído agora e o Drive termina por trás, contando em drive { total, feitos, pronto }
        await d.ref.update({
          status: 'concluido', concluidoEm: new Date().toISOString(), andamento: '', pct: 100, fase: 'pronto', numeros,
          drive: { total: faltam ? faltam.length : arquivos.length, feitos: 0, pronto: !!faltam && !faltam.length, ...(faltam ? {} : { conferindo: true }) },
          // nada novo: não grava no Claudio Secretario (já estava tudo arquivado ou lá)
          resultado: { arquivos: arquivos.length, novos: 0, jaSalvos: numeros.jaSalvos, ...comoFica(faltam), emitidas: resumo.emitidas.length, recebidas: resumo.recebidas.length },
        });
        // 3b) o Drive por trás, na fila do Drive (acima), e o robô segue para o próximo pedido
        // o .zip da pasta fica só com os XMLs: os PDFs vão soltos ao lado, e o arquivador os arquivaria duas vezes
        let zipDoDrive = extrasDoZip.length ? sx.zipDe(arquivos) : zip;
        gravarNoDrivePorTras(pasta, async () => {
          // sem ter esperado o Drive: a leitura dele termina aqui; o que ele tem a mais entra no resumo e no .zip da pasta
          if (!faltam) {
            const j = juntarOsDoDrive(cnpj, { arquivos, resumo }, (await noDrive).xmls);
            if (j.extras) {
              ({ arquivos, resumo } = j.baixado);
              zipDoDrive = sx.zipDe(arquivos);
              log('SIEG: XMLs de', p.codigo, '-', j.extras, 'que estavam só no Drive entraram no resumo (depois de entregar o .zip)');
              await db.collection('siegNotas').doc(id).set(resumoQueCabe({
                codigo: soDigitos(p.codigo), competencia: p.competencia, em: new Date().toISOString(), pasta: onde, zip: nomeDoZip, arquivos: arquivos.length, novos: arquivos.length,
                emitidas: resumo.emitidas, recebidas: resumo.recebidas, resumo: sx.VERSAO_DO_RESUMO, ...(contagemSieg ? { contagemSieg } : {}),
              })).catch(err => log('SIEG: não consegui juntar ao resumo de', p.codigo, 'o que só o Drive tinha -', motivo(err)));
              await db.collection('siegSaidas').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series: seriesDasNotas(saidasDoResumo(resumo.emitidas)) }).catch(err => log('SIEG: não consegui gravar as saídas de', p.codigo, '(' + motivo(err) + ')'));
            }
            faltam = await faltamNoDrive(arquivos);
            numeros.jaSalvos = arquivos.length - faltam.length;
            const fica = comoFica(faltam);
            await d.ref.update({ 'drive.total': faltam.length, 'drive.pronto': !faltam.length, 'drive.conferindo': false, 'numeros.jaSalvos': numeros.jaSalvos, 'numeros.xmls': arquivos.length,
              'resultado.jaSalvos': numeros.jaSalvos, 'resultado.arquivos': arquivos.length, 'resultado.pasta': fica.pasta, 'resultado.zip': fica.zip }).catch(err => log('SIEG: não consegui atualizar o resultado do pedido de', p.codigo, '(' + motivo(err) + ')'));
          }
          // em paralelo (48 por vez; 16 levavam 34 s para 1292 XMLs): o andamento do Drive no máximo a cada 1 s
          let novos = 0;
          let driveOk = true;
          if (faltam.length) {
            let ultimoDrive = 0;
            const contar = forcar => {
              if (!forcar && Date.now() - ultimoDrive < 1000) return Promise.resolve();
              ultimoDrive = Date.now();
              return d.ref.update({ 'drive.feitos': novos }).catch(() => {});
            };
            try {
              await fs.promises.mkdir(pasta, { recursive: true });
              const fila = faltam.slice();
              await Promise.all(Array.from({ length: 48 }, async () => {
                for (let a = fila.shift(); a; a = fila.shift()) {
                  await fs.promises.writeFile(path.join(pasta, a.nome), a.xml);
                  novos++;
                  contar(false);
                }
              }));
              // e o .zip com todos, na mesma pasta (07/10/2026: "quero que ele também salve um arquivo .zip na hora")
              if (zipDoDrive && novos) await fs.promises.writeFile(path.join(pasta, nomeDoZip), zipDoDrive);
              // os PDFs só das notas que acabaram de entrar: as já arquivadas não voltam para a pasta de entrada
              try {
                for (const pdf of await fazerPdfs(faltam)) await fs.promises.writeFile(path.join(pasta, pdf.nome), pdf.dados);
              } catch (err) { log('SIEG: não consegui salvar os PDFs de', p.codigo, p.competencia, 'no Drive -', motivo(err)); }
              await d.ref.update({ drive: { total: faltam.length, feitos: novos, pronto: true, em: new Date().toISOString() }, 'numeros.novos': novos, 'resultado.novos': novos }).catch(err => log('SIEG: o Drive de', p.codigo, 'gravou, mas não consegui marcar o pedido como pronto (' + motivo(err) + ')'));
            } catch (err) {
              driveOk = false;
              // o Drive falhou depois de a pessoa já ter o .zip e as notas: fica o aviso no pedido (o próximo pedido salva o que faltou)
              await d.ref.update({ drive: { total: faltam.length, feitos: novos, pronto: true, erro: motivo(err) } }).catch(e2 => log('SIEG: não consegui gravar o erro do Drive no pedido de', p.codigo, '(' + motivo(e2) + ')'));
              log('SIEG: Drive de', p.codigo, '- parou em', novos, 'de', faltam.length, '-', motivo(err));
            }
          }
          // os cancelamentos deste mês já estão no Drive: a madrugada só pede o mês de novo se aparecer outro (procurarCancelamentos)
          if (driveOk) cancelamentosVistos.anotar(p.codigo, p.competencia, cancelamentosDe(arquivos));
          await db.collection('siegNotas').doc(id).update({ novos }).catch(err => log('SIEG: não consegui gravar os novos em siegNotas de', p.codigo, '(' + motivo(err) + ')'));
          log('SIEG: XMLs de', p.codigo, p.competencia, '-', arquivos.length, 'arquivos (' + novos + ' novos' + (pulados ? ', ' + pulados + ' pulados: já arquivados' : '') + ') em', onde);
          painel.atividade('sieg', (doCliente ? 'Juntou os XMLs que o cliente mandou de ' : 'Baixou os XMLs do SIEG de ') + p.codigo + ' (' + p.competencia.slice(5) + '/' + p.competencia.slice(0, 4) + ')',
            arquivos.length + ' arquivo(s), ' + novos + ' novo(s) no Drive' + (p.madrugada ? ' · madrugada' : p.criadoPor ? ' · pedido de ' + p.criadoPor : ''));
        });
        return;
      }
      // o .zip das notas que faltam no Alterdata (08/10/2026: "3"): só essas chaves, pelo portal (ou do .zip do Drive), e
      // entregue como o do "Baixar XMLs" (o nads baixa na hora)
      if (p.tipo === 'zipFaltam') {
        ponha('montando o .zip das que faltam de ' + p.codigo);
        const chaves = (Array.isArray(p.chaves) ? p.chaves : []).map(String).filter(ch => /^\d{44}$/.test(ch));
        if (!chaves.length) throw new Error('nenhuma chave de nota no pedido');
        await d.ref.update({ andamento: 'Pegando ' + chaves.length + ' notas no SIEG', pct: 20, fase: 'baixando' });
        const quero = new Set(chaves);
        const daChave = x => ((/Id="(?:NFe|CTe)(\d{44})"/.exec(x)) || [])[1] || '';
        let xmls = [];
        try { xmls = await require('./sieg-portal').xmlsPorChaves(cnpj, chaves, lerZip); }
        catch (err) { log('SIEG: portal não deu nas chaves (' + motivo(err) + '), tentando o .zip do Drive'); }
        if (xmls.filter(x => quero.has(daChave(x))).length < chaves.length) {
          // o que faltou, do .zip do Drive (se a pasta do mês ainda está lá)
          const nota = (await db.collection('siegNotas').doc(id).get()).data();
          const nomeDaPasta = nota && nota.pasta ? nota.pasta.split('/').pop() : '';
          if (nomeDaPasta) {
            await esperarODrive(path.join(PASTA_DO_DRIVE, p.competencia, nomeDaPasta));
            xmls.push(...(await xmlsJaNoDrive(soDigitos(p.codigo), nomeDaPasta, p.competencia, db)).xmls);
          }
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
        painel.atividade('sieg', 'Montou o .zip das notas que faltam no Alterdata de ' + p.codigo, arquivos.length + ' de ' + chaves.length + ' notas');
        return;
      }
      // o "Contar agora" do nads (07/10/2026): só a contagem desta empresa e mês, sem esperar a madrugada
      if (p.tipo === 'contagem') {
        ponha('contando ' + p.codigo + ' (pedido)');
        await d.ref.update({ andamento: 'emitidas' });
        const r = await contagemDoMes(c, cnpj, p.competencia, t => d.ref.update({ andamento: t }).catch(() => {}));
        await db.collection('siegContagens').doc(id).set({ codigo: soDigitos(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), ...r });
        await d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString() });
        log('SIEG: contagem de', p.codigo, p.competencia, 'pedida pelo nads');
        painel.atividade('sieg', 'Contou as notas de ' + p.codigo + ' no SIEG (' + p.competencia.slice(5) + '/' + p.competencia.slice(0, 4) + ')', p.criadoPor ? 'pedido de ' + p.criadoPor : '');
        return;
      }
      // pelo portal primeiro (só NF-e e NFC-e: segundos), sem a sessão ou com erro pela API (50 por chamada)
      const andarSaidas = t => d.ref.update({ andamento: t }).catch(() => {});
      let series;
      try {
        if (portal404.recente(cnpj)) throw new Error('o portal deu 404 para este cliente há pouco');
        const r = await require('./sieg-portal').xmlsPeloPortal(cnpj, p.competencia, andarSaidas, lerZip, ['NF-e', 'NFC-e']);
        portal404.limpar(cnpj);
        series = seriesDasNotas(saidasDoResumo(r.resumo.emitidas));
      } catch (err) {
        if (est.ehPortal404(err)) portal404.anotar(cnpj);
        log('SIEG: portal não deu (' + motivo(err) + '), saídas de', p.codigo, 'pela API');
        series = await saidasDoMes(c, cnpj, p.competencia, andarSaidas);
      }
      await db.collection('siegSaidas').doc(id).set({ codigo: String(p.codigo), cnpj, competencia: p.competencia, em: new Date().toISOString(), series });
      await d.ref.update({ status: 'concluido', concluidoEm: new Date().toISOString() });
      log('SIEG: saídas de', p.codigo, p.competencia, '-', series.reduce((s, x) => s + x.numeros.length, 0), 'notas');
      painel.atividade('sieg', 'Baixou as saídas de ' + p.codigo + ' (' + p.competencia.slice(5) + '/' + p.competencia.slice(0, 4) + ')', series.reduce((s, x) => s + x.numeros.length, 0) + ' notas');
    } catch (err) {
      await d.ref.update({ status: 'erro', erro: motivo(err), erroEm: new Date().toISOString() })
        .catch(e2 => log('SIEG: não consegui gravar o erro do pedido', d.id, '(' + motivo(e2) + '): ele pode ficar como trabalhando'));
      log('SIEG: erro', p.tipo === 'contagem' ? 'na contagem de' : p.tipo === 'xmls' ? 'nos XMLs de' : 'nas saídas de', p.codigo, '-', motivo(err));
      painel.erro('sieg', 'O SIEG deu erro ' + (p.tipo === 'contagem' ? 'na contagem de ' : p.tipo === 'xmls' ? 'nos XMLs de ' : 'nas saídas de ') + p.codigo, motivo(err), { pedido: d.id });
    }
  }
  // o ouvinte que volta sozinho (31/10/2026): em 30/10 às 9:59 a rede caiu, o onSnapshot morreu ("Exceeded maximum number
  // of retries allowed") e ninguém religou; até o robô reiniciar, às 13:05, os pedidos só eram vistos no relógio de 10 em
  // 10 minutos (o 309 do Gustavo, às 10:36, esperou 7 min 32 s para começar). Agora ele volta (ouvinte.js) e, de reserva,
  // a fila é olhada a cada 2 minutos.
  const pararPedidos = ouvir('SIEG: pedidos', () => { filaViva = null; return db.collection('pedidosSieg').where('status', '==', 'pendente'); }, s => { filaViva = s.docs; filaVivaEm = Date.now(); if (!s.empty) atenderPedidos(); }, log);
  const relogioDaFila = setInterval(() => { if (!trabalhadores.ativos() && !contando) atenderPedidos(); }, 2 * 60 * 1000);
  pausaLocal.quandoRetomar('sieg', () => { void atenderPedidos(); });

  // quem não tem documento válido não vai ao SIEG: um aviso por cliente por dia no painel (o documento do dia é criado com
  // create(), que falha se já existe: vale também se o robô reiniciar no meio da madrugada)
  async function soComDocumento(ativos) {
    const bons = [];
    const dia = new Date().toISOString().slice(0, 10);
    for (const x of ativos) {
      const cod = codigoDe(x);
      if (!cod) continue;
      const doc = normalizarDocumento(x.documento, x.enquadramento);
      if (doc) {
        bons.push(x);
        // CPF calculado do número de produtor rural: pede para gravar o certo no Cadastro (um aviso por dia)
        if (doc !== normalizarDocumento(x.documento)) {
          try {
            await db.collection('siegAvisos').doc(cod + '_' + dia).create({ codigo: cod, dia, em: new Date().toISOString(), cpfCalculado: true });
            painel.atividade('sieg', 'Cliente ' + cod + ': usei o CPF ' + comMascaraCpf(doc) + ' calculado do número de produtor rural — confira e grave o CPF no Cadastro', 'documento no cadastro: ' + String(x.documento), { aviso: true });
            log('SIEG: cliente', cod, '- CPF', doc, 'calculado do número de produtor rural', soDigitos(x.documento));
          } catch (err) { /* já avisou hoje */ }
        }
        continue;
      }
      try {
        await db.collection('siegAvisos').doc(cod + '_' + dia).create({ codigo: cod, dia, em: new Date().toISOString() });
        painel.atividade('sieg', SEM_DOC(cod), 'documento no cadastro: ' + (x.documento == null || x.documento === '' ? '(vazio)' : String(x.documento)), { aviso: true });
        log('SIEG:', SEM_DOC(cod));
      } catch (err) { /* já avisou hoje (ou o banco falhou: o aviso não é motivo para parar a contagem) */ }
    }
    return bons;
  }

  // a contagem da madrugada (entre 1h e 5h, uma vez por dia): o mês atual e, até o dia 10, o anterior também
  let contouEm = '';
  async function contarTodos() {
    const hoje = new Date();
    const dia = hoje.toISOString().slice(0, 10);
    if (pausaLocal.estaPausado('sieg') || trabalhadores.ativos() || contando || contouEm === dia || hoje.getHours() < 1 || hoje.getHours() >= 5) return;
    contando = true;
    chegouOutro = false;
    contouEm = dia;
    const contouDesde = hoje.toISOString();
    // as contagens desta noite (em memória), para a busca dos cancelamentos depois dos XMLs da madrugada
    const daContagem = [];
    try {
      const comps = [competenciaDe(hoje)];
      if (hoje.getDate() <= 10) comps.push(competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)));
      const ativos = [];
      (await require('./clientes-cache').clientesAtivos(db)).forEach(d => ativos.push(d.data()));
      const comCnpj = await soComDocumento(ativos);
      log('SIEG: contando as notas de', comCnpj.length, 'clientes em', comps.join(' e '));
      for (const comp of comps) {
        for (const cli of comCnpj) {
          // um pedido do nads chegou no meio da noite (ou da manhã: em 08/10 a contagem foi até 7:46): atende antes de seguir
          if (chegouOutro) { chegouOutro = false; contando = false; daNoite = ''; await atenderPedidos(); contando = true; }
          daNoite = 'contando ' + codigoDe(cli) + ' (' + comp + ')';
          try {
            const r = await contagemDoMes(c, normalizarDocumento(cli.documento, cli.enquadramento), comp);
            await db.collection('siegContagens').doc(codigoDe(cli) + '_' + comp).set({ codigo: codigoDe(cli), cnpj: normalizarDocumento(cli.documento, cli.enquadramento), competencia: comp, em: new Date().toISOString(), ...r });
            daContagem.push({ codigo: codigoDe(cli), cnpj: normalizarDocumento(cli.documento, cli.enquadramento), comp, contagem: r });
          } catch (err) { log('SIEG: contagem de', codigoDe(cli), '-', motivo(err)); }
        }
      }
      log('SIEG: contagem da noite pronta');
      painel.atividade('sieg', 'Contagem da madrugada pronta', comCnpj.length + ' clientes em ' + comps.join(' e '));
    } catch (err) { log('SIEG: contagem da noite falhou -', motivo(err)); painel.erro('sieg', 'A contagem da madrugada falhou', motivo(err)); }
    finally { daNoite = ''; contando = false; ponto(); }
    await xmlsDaMadrugada(contouDesde).catch(err => log('SIEG: XMLs da madrugada falharam -', motivo(err)));
    await cancelamentosDaMadrugada(daContagem).catch(err => log('SIEG: cancelamentos da madrugada falharam -', motivo(err)));
  }

  /**
   * Os cancelamentos que chegaram depois do download (11/11/2026; procurarCancelamentos, acima): pelo portal, os meses que a
   * madrugada acabou de contar. O banco só é lido na primeira vez de cada empresa e mês (o resumo do último download); depois
   * vale a memória do PC. Achou cancelamento novo: o pedido do mês entra na fila, como os da madrugada.
   */
  async function cancelamentosDaMadrugada(itens) {
    if (!itens.length) return;
    // os pedidos da madrugada terminam de gravar no Drive por trás, e é lá que a memória é anotada: sem esperar, o mesmo
    // cancelamento que um deles acabou de baixar pareceria novo
    for (let f = null; f !== filaDoDrive;) { f = filaDoDrive; await f.catch(() => {}); }
    const sp = require('./sieg-portal');
    const inicio = Date.now();
    const r = await procurarCancelamentos({
      itens: itens.filter(it => !portal404.recente(it.cnpj)),
      memoria: cancelamentosVistos,
      lerResumo: async (codigo, comp) => { const s = await db.collection('siegNotas').doc(codigo + '_' + comp).get(); return s.exists ? s.data() : null; },
      baixar: async (cnpj, comp, tipos) => {
        try { return (await sp.xmlsPeloPortal(cnpj, comp, null, lerZip, tipos)).arquivos; }
        catch (err) { if (est.ehPortal404(err)) portal404.anotar(cnpj); throw err; }
      },
      pedir: (it, novas) => db.collection('pedidosSieg').add({ status: 'pendente', tipo: 'xmls', codigo: it.codigo, competencia: it.comp, madrugada: true, cancelamentos: novas.length,
        criadoEm: new Date().toISOString(), criadoPor: 'Robô (cancelamentos da madrugada)', criadoPorUid: 'robo', ...(soAContagem(it.contagem) ? { contagemSieg: soAContagem(it.contagem) } : {}) }),
      deveParar: () => pausaLocal.estaPausado('sieg'),
      pararTudo: err => String(err && err.message || '').startsWith(sp.SEM_LOGIN),
      aoAndar: t => { daNoite = t; },
      log,
    }).finally(() => { daNoite = ''; });
    log('SIEG: cancelamentos da madrugada -', r.olhados, 'meses olhados no portal,', r.novos, 'cancelamento(s) novo(s) em', r.pedidos, 'mês(es)' + (r.semDownload ? ', ' + r.semDownload + ' ainda sem download' : '') + (r.erros ? ', ' + r.erros + ' erro(s)' : '') + (r.parou ? ' (parou: ' + r.parou + ')' : '') + ' em ' + Math.round((Date.now() - inicio) / 60000) + ' min');
    if (r.pedidos) {
      painel.atividade('sieg', 'Cancelamentos novos no SIEG', r.novos + ' nota(s) cancelada(s) depois do download, em ' + r.pedidos + ' mês(es): baixando de novo');
      await atenderPedidos();
    }
  }

  /**
   * Os XMLs prontos de manhã (Vitor, 08/10/2026: "1"): depois da contagem, o mês anterior (o da rotina do Fiscal) de cada
   * cliente que teve nota e ainda não está completo no nads e no Drive (pela contagem: o mesmo número de notas por tipo).
   * Pelo mesmo caminho do "Baixar XMLs" (sem o .zip para baixar), e os pedidos do nads passam na frente. Os pedidos entram
   * na fila de uma vez (31/10/2026) e os trabalhadores atendem PARALELO deles ao mesmo tempo (antes: um, e o próximo só era
   * criado quando o anterior terminava).
   */
  async function xmlsDaMadrugada(contouDesde) {
    const hoje = new Date();
    const comp = competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
    const ativos = [];
    (await require('./clientes-cache').clientesAtivos(db)).forEach(d => ativos.push(d.data()));
    const comCnpj = await soComDocumento(ativos);
    let feitos = 0;
    let semMudanca = 0;
    for (const cli of comCnpj) {
      const id = codigoDe(cli) + '_' + comp;
      const cont = (await db.collection('siegContagens').doc(id).get()).data();
      if (!cont) continue;
      if (!TIPOS_DA_CONTAGEM.some(k => ((cont.emitidas || {})[k] || 0) + ((cont.recebidas || {})[k] || 0) > 0)) continue;
      const notas = (await db.collection('siegNotas').doc(id).get()).data();
      if (completoNoNads(cont, notas)) continue;
      // não fecha: o SIEG mudou desde o último download? (semMudancaNoSieg, acima). A contagem desta noite já serve (até o
      // dia 10 o mês anterior também é contado); depois do dia 10, conta agora, só este cliente
      let agora = null;
      if (contagemDoUltimoDownload(notas, cont)) {
        if (contouDesde && String(cont.em || '') >= contouDesde) agora = soAContagem(cont);
        else {
          daNoite = 'conferindo ' + codigoDe(cli) + ' (' + comp + ')';
          agora = await contagemDoMes(c, normalizarDocumento(cli.documento, cli.enquadramento), comp).catch(err => { log('SIEG: contagem de', codigoDe(cli), comp, '-', motivo(err)); return null; });
          daNoite = '';
        }
        if (semMudancaNoSieg(notas, cont, agora)) { semMudanca++; continue; }
      }
      // o pedido, como se fosse do nads (a tela mostra "XMLs baixados" de manhã); o ouvinte da fila já começa a atender.
      // Leva a contagem de agora: é a de antes do download, que o resumo guarda (contagemSieg)
      await db.collection('pedidosSieg').add({ status: 'pendente', tipo: 'xmls', codigo: codigoDe(cli), competencia: comp, madrugada: true,
        criadoEm: new Date().toISOString(), criadoPor: 'Robô (madrugada)', criadoPorUid: 'robo', ...(agora ? { contagemSieg: agora } : {}) });
      feitos++;
    }
    daNoite = '';
    if (semMudanca) log('SIEG: madrugada -', semMudanca, 'clientes sem nota nova no SIEG desde o último download de', comp, '(não baixados de novo)');
    // e espera a fila esvaziar
    if (feitos) await atenderPedidos();
    log('SIEG: XMLs da madrugada prontos -', feitos, 'clientes em', comp);
    if (feitos) painel.atividade('sieg', 'XMLs da madrugada prontos', feitos + ' cliente(s) em ' + comp);
  }
  const relogioNoite = setInterval(() => { contarTodos(); if (!trabalhadores.ativos() && !contando) atenderPedidos(); }, 10 * 60 * 1000);
  log('SIEG ligado: contagem da madrugada e os pedidos do nads');
  return () => { clearInterval(relogio); clearInterval(relogioNoite); clearInterval(relogioDaFila); pararPedidos(); };
}

module.exports = { procurarCancelamentos, tiposComNotas, cancelamentosDe, canceladasDoResumo, eventoDeAntes, ordemDaFila, urgenciaDoPedido, criarTrabalhadores, chaveDaPasta, cobreOUltimo, juntarOsDoDrive, mesmaContagem, completoNoNads, contagemDoUltimoDownload, semMudancaNoSieg, PARALELO, normalizarDocumento, xmlsJaNoDrive, seriesDasNotas, saidasDoResumo, iniciarSieg, lerXml, xmlsDaResposta, lerZip, periodo, contagemDoMes, saidasDoMes, xmlsDoMes, resumoQueCabe, chamar, lerCredenciais };
