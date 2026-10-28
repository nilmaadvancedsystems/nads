// Arquivador NOVO da pasta "Claudio Secretario": determinístico, sem o Claude (Vitor, 20/10/2026).
//
// As regras moram em arquivador-regras.js (puro, testado). Aqui fica o que mexe em disco: varrer a origem, ler cada
// arquivo (texto do PDF, XML, OFX, TXT, planilha; abre .zip/.rar/.7z), pedir a decisão às regras, conferir o destino
// (nunca sobrescreve: mesmo conteúdo = já arquivado; mesmo nome com conteúdo diferente = sufixo " (N)", Dicionário §2) e,
// só em PRODUCAO, levar ao destino e registrar. Dentro do mesmo disco (o G: do Google Drive em streaming) o original é
// MOVIDO (rename: no Drive vira troca de pasta no servidor, sem baixar nem subir de novo; 23/10/2026); só a cópia para outro
// cliente (a NFS-e da Nilma no tomador, a regra das duas clientes), o de dentro de um .zip e a origem em outro disco
// (a entrada local) gravam o conteúdo, conferem o hash e mandam o original para a quarentena.
//
// Modos:
//   SIMULACAO (padrão)  só lê. Grava o relatório e o plano na pasta de controle deste arquivador (fora do Drive e fora
//                       do repositório da rotina antiga). Não copia, não move, não renomeia nada.
//   PRODUCAO            copia para G:\Meu Drive\2026, move o original para a quarentena própria e o que não deu para
//                       NÃO IDENTIFICADOS\<execução>\. Exige --confirmo e se recusa se a rotina antiga estiver rodando.
//
// A rotina antiga (/organizar, repositório GUSTAVO\claudio) continua sendo a que vale: daqui só se LÊ o manifesto e a
// planilha de cadastro dela. A pasta de controle deste arquivador é outra (ARQ_NOVO_CONTROLE).
//
// Uso:
//   node arquivador-novo.js                              simulação da pasta inteira
//   node arquivador-novo.js --incluir-nao-identificados  simula também o que está em NÃO IDENTIFICADOS
//   node arquivador-novo.js --pasta "2026-09"            só uma subpasta da origem
//   node arquivador-novo.js --publicar                   publica a execução em arquivamentos/ (aba Arquivo do nads)
//   node arquivador-novo.js --producao --confirmo        arquiva de verdade (NÃO ligado no robô)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const R = require('./arquivador-regras');

const ORIGEM = process.env.ARQ_NOVO_ORIGEM || 'G:\\Meu Drive\\Claudio Secretario';
const CLIENTES = process.env.ARQ_NOVO_CLIENTES || R.RAIZ_CLIENTES;
const ROTINA = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const PLANILHA = path.join(ROTINA, 'necessario para o claude', 'dados agentes', 'cadastro_empresas_unificado.xlsx');
const MANIFESTO_ANTIGO = path.join(ROTINA, '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
const K = require('./arquivador-chaves');
const TRAVA_ANTIGA = path.join(ROTINA, '_CONTROLE', '_execucao.lock');
// fora do AppData (26/10/2026: o AppData visto de dentro e de fora do Claude para Windows são dois; pastas-locais.js)
const CONTROLE = process.env.ARQ_NOVO_CONTROLE || require('./pastas-locais').CONTROLE;
const NAO_IDENTIFICADOS = 'NÃO IDENTIFICADOS';
const UNRAR = 'C:\\Program Files\\WinRAR\\UnRAR.exe';
const TAR = 'C:\\Windows\\System32\\tar.exe';
const PAGINAS_LIDAS = 3;   // Dicionário §12: leitura mínima (página 1; Santander na 2)
const OCR_LIGADO = process.env.ARQ_NOVO_OCR !== '0';   // OCR do escaneado (21/10/2026); ARQ_NOVO_OCR=0 desliga

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const dois = n => String(n).padStart(2, '0');
function carimbo(d) { return d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds()); }

// ---------------------------------------------------------------------------------------------------------------------
// cadastro: a planilha da rotina (só leitura) + as pastas que já existem em G:\Meu Drive\2026
// ---------------------------------------------------------------------------------------------------------------------
// Fonte do cadastro (decisão do Vitor, 21/10/2026: "o regime do nads vale"): o Cadastro do nads + o Entregas, lidos do
// banco e guardados em cadastro.json no controle; a planilha da rotina antiga só para o código que o banco não tem.
// opcoes.fonte = 'planilha' usa só a planilha (para medir contra a história nas mesmas condições da rotina antiga).
const CAD = require('./arquivador-cadastro');
function carregarCadastro(opcoes) {
  opcoes = opcoes || {};
  let planilha = [];
  try { planilha = CAD.lerPlanilha(opcoes.planilha || PLANILHA); } catch (e) { /* sem a planilha antiga: só o banco */ }
  const cache = opcoes.fonte === 'planilha' ? null : CAD.lerCache(path.join(opcoes.controle || CONTROLE, 'cadastro.json'));
  const { linhas, divergencias } = CAD.juntar({ planilha, entregas: cache ? cache.entregas : [], nads: cache ? cache.nads : [] });
  let pastas = [];
  try { pastas = fs.readdirSync(opcoes.clientes || CLIENTES, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { /* sem Drive: só a planilha */ }
  const cad = R.montarCadastro(linhas, pastas);
  // as outras raízes de ano (23/10/2026: a raiz pelo ano da competência) e o mapa da migração (a pasta de origem como pista)
  const porAno = new Map();
  const raizes = path.dirname(opcoes.clientes || CLIENTES);
  for (let ano = R.ANO_MINIMO; ano <= new Date().getFullYear(); ano++) {
    if (ano === R.ANO_DAS_PASTAS) continue;
    try { porAno.set(ano, fs.readdirSync(path.join(raizes, String(ano)), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)); } catch (e) { /* a raiz do ano ainda não existe */ }
  }
  let mapa = null;
  try { mapa = require('./arquivador-migracao').carregar({ controle: opcoes.controle || CONTROLE }); } catch (e) { /* sem o mapa: só o conteúdo */ }
  R.comAnosEMapa(cad, porAno, mapa);
  cad.divergencias = divergencias;
  cad.fonte = cache ? 'Cadastro do nads + Entregas (lido em ' + cache.em + '), planilha antiga só como reserva' : 'planilha da rotina antiga';
  return cad;
}
/** Relê o cadastro do banco (Entregas + nads) e grava o cache; sem banco, fica o cache que houver. */
async function atualizarCadastro(opcoes) {
  opcoes = opcoes || {};
  try {
    const db = opcoes.db || require('./firestore-client').getDb('entregas-2e5e2');
    // com prazo (23/10/2026: o banco parou de responder e o ciclo ficou esperando): sem resposta, fica o cache
    let t;
    await Promise.race([CAD.atualizar(db, path.join(opcoes.controle || CONTROLE, 'cadastro.json')),
      new Promise((_, rej) => { t = setTimeout(() => rej(new Error('o banco não respondeu em 45 s')), opcoes.prazoMs || 45000); if (t.unref) t.unref(); })]).finally(() => clearTimeout(t));
    return true;
  } catch (e) { if (opcoes.log) opcoes.log('cadastro: não li o banco (' + e.message + '); fica o cache/planilha'); return false; }
}

/** Manifesto da rotina antiga: hash → caminho arquivado (para "já arquivado anteriormente"). */
function indiceDoManifesto(arquivo) {
  const idx = new Map();
  let texto = '';
  try { texto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { return idx; }
  for (const l of texto.split(/\r?\n/)) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { try { r = JSON.parse(l.replace(/\\/g, '/')); } catch (e2) { continue; } }
    const full = caminhoArquivado(r.destino_final, r.nome_final);
    for (const k of ['hash_origem', 'hash_destino']) if (r[k] && !idx.has(r[k])) idx.set(r[k], full);
  }
  return idx;
}
/** O manifesto às vezes grava a pasta, às vezes a pasta já com o nome: devolve sempre o caminho do arquivo. */
function caminhoArquivado(destino, nome) {
  const d = String(destino || '').replace(/\//g, '\\').replace(/\\+$/, '');
  const n = String(nome || '');
  return n && d.toLowerCase().endsWith('\\' + n.toLowerCase()) ? d : d + '\\' + n;
}

/**
 * 03: "conta que aparece em extrato já arquivado de um cliente → é dele". Lê os extratos/comprovantes que a rotina já
 * arquivou (pelo manifesto dela) e anota banco:conta → cliente. O banco e o cliente vêm do CAMINHO onde o arquivo está
 * (…\<cód> - <nome>\CONTÁBIL\EXTRATOS\AAAA\MM\BANCÁRIOS\<BANCO>\), não de adivinhação. Grava contas.json no controle.
 */
async function aprenderContas(opcoes) {
  opcoes = Object.assign({ controle: CONTROLE }, opcoes);
  const idx = {};
  const vistos = new Set();
  let lidos = 0;
  for (const l of fs.readFileSync(opcoes.manifestoAntigo || MANIFESTO_ANTIGO, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { try { r = JSON.parse(l.replace(/\\/g, '/')); } catch (e2) { continue; } }
    const full = caminhoArquivado(r.destino_final, r.nome_final);
    if (!/\.pdf$/i.test(full) || vistos.has(full.toLowerCase())) continue;
    vistos.add(full.toLowerCase());
    const m = /\\(\d+) - [^\\]+\\CONT[ÁA]BIL\\(?:EXTRATOS\\\d{4}\\[^\\]+\\(?:BANC[ÁA]RIOS|COMPROVANTES|APLICA[ÇC][ÕO]ES|MAQUININHAS)\\([^\\]+)|RECEBIMENTO DE CLIENTES)\\/i.exec(full);
    if (!m || !m[2]) continue;
    let buf; try { buf = fs.readFileSync(full); } catch (e) { continue; }
    const t = await textoDoPdf(buf);
    if (++lidos % 200 === 0 && opcoes.log) opcoes.log('  contas: ' + lidos + ' arquivos lidos');
    const h = sha(buf);
    for (const c of R.contasDoTexto(t.paginas.join('\n'))) {
      const k = m[2].toUpperCase() + ':' + c;
      idx[k] = idx[k] || {};
      (idx[k][m[1]] = idx[k][m[1]] || []).push(h);
    }
  }
  fs.mkdirSync(opcoes.controle, { recursive: true });
  fs.writeFileSync(path.join(opcoes.controle, 'contas.json'), JSON.stringify({ em: new Date().toISOString(), arquivosLidos: lidos, contas: idx }));
  return idx;
}
/** contas.json → Map(banco:conta → Map(cliente → Set(hash))). */
function lerContas(controle) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(controle || CONTROLE, 'contas.json'), 'utf8'));
    return new Map(Object.entries(j.contas).map(([k, v]) => [k, new Map(Object.entries(v).map(([c, hs]) => [+c, new Set(hs)]))]));
  } catch (e) { return null; }
}

// ---------------------------------------------------------------------------------------------------------------------
// leitura dos arquivos
// ---------------------------------------------------------------------------------------------------------------------
/** Texto das primeiras páginas de um PDF, página por página. */
// O pdf.js que vem dentro do pdf-parse, chamado direto: pelo pdf-parse, um PDF lido logo depois de outro às vezes dava
// "bad XRef entry" (o documento anterior não era fechado antes do próximo; metade das NFC-e da GRANMIX falhava assim).
// Aqui cada documento recebe a sua cópia dos bytes e é fechado (destroy) antes do seguinte.
let PDFJS = null;
async function textoDoPdf(buffer) {
  if (!PDFJS) { PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js'); PDFJS.disableWorker = true; }
  const paginas = [];
  const log = console.log, warn = console.warn;
  console.log = () => {}; console.warn = () => {};   // o pdf.js fala sozinho ("Indexing all PDF objects")
  let doc = null;
  try {
    doc = await PDFJS.getDocument({ data: new Uint8Array(buffer) });
    for (let i = 1; i <= Math.min(PAGINAS_LIDAS, doc.numPages); i++) {
      let t = '';
      try {
        const tc = await (await doc.getPage(i)).getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let ultimoY;
        for (const it of tc.items) { if (ultimoY === undefined || ultimoY === it.transform[5]) t += it.str; else t += '\n' + it.str; ultimoY = it.transform[5]; }
      } catch (e) { /* página sem texto */ }
      paginas.push(t);
    }
    return { paginas, total: doc.numPages };
  } catch (e) {
    return { paginas: [], total: 0, erro: e.message };
  } finally {
    if (doc) { try { await doc.destroy(); } catch (e) { /* já fechado */ } }
    console.log = log; console.warn = warn;
  }
}
function textoDoXml(buffer) {
  const cab = buffer.slice(0, 200).toString('latin1');
  return /encoding=["']ISO-8859-1|encoding=["']windows-1252/i.test(cab) ? buffer.toString('latin1') : buffer.toString('utf8');
}
function linhasDaPlanilha(buffer, nome) {
  const erro = console.error;
  console.error = () => {};   // o xlsx reclama de zip "Bad uncompressed size" e lê assim mesmo
  try {
    const XLSX = require('xlsx');
    const wb = /\.csv$/i.test(nome) ? XLSX.read(buffer.toString('utf8'), { type: 'string' }) : XLSX.read(buffer, { type: 'buffer', sheetRows: 15 });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(0, 15);
  } catch (e) { return []; } finally { console.error = erro; }
}
// o OCR adiantado do escaneado que foi para a fila: { hash: Promise<resultado> }, no máximo OCR_ADIANTADOS pendentes (o
// buffer fica preso até a leitura acabar); o lote do OCR usa o resultado e o tira daqui
const OCR_ADIANTADOS = 60;
const ocrAdiantado = new Map();
// imagem: o OCR da imagem (27/10/2026), com os mesmos trabalhadores
const lerPorOcr = (buffer, imagem) => (imagem ? require('./arquivador-ocr').ocrDaImagem(buffer) : require('./arquivador-ocr').ocrDoPdf(buffer));
function adiantarOcr(hash, buffer, imagem) {
  if (ocrAdiantado.has(hash) || ocrAdiantado.size >= OCR_ADIANTADOS) return;
  const p = lerPorOcr(buffer, imagem);
  ocrAdiantado.set(hash, p);
  // o que ninguém veio buscar (a passada parou antes do lote do OCR) sai em 30 min e abre a vaga
  p.then(() => { const t = setTimeout(() => { if (ocrAdiantado.get(hash) === p) ocrAdiantado.delete(hash); }, 30 * 60000); if (t.unref) t.unref(); });
}
function ocrDe(hash, buffer, imagem) {
  const p = ocrAdiantado.get(hash);
  if (p) { ocrAdiantado.delete(hash); return p; }
  return lerPorOcr(buffer, imagem);
}

/**
 * O pacote de transmissão do Sintegra para a SEFAZ (o TED): tem extensão .zip, mas não é zip — o cabeçalho "02CL_PADRAO
 * CONV57/95 …" e o conteúdo comprimido no formato da SEFAZ (27/10/2026: 225 parados, o contínuo achava que estavam chegando).
 */
const ehTedSintegra = b => !!b && b.length > 11 && b.slice(0, 11).toString('latin1') === '02CL_PADRAO';

/** O que as regras precisam de cada formato. */
async function montarEntrada(nome, rel, buffer, op) {
  const e = { nome, rel, hash: sha(buffer), tamanho: buffer.length };
  const ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1];
  switch ((ext || '').toLowerCase()) {
    case 'pdf': {
      const t = await textoDoPdf(buffer);
      e.texto = t.paginas; e.paginas = t.total;
      if (t.erro) e.erroLeitura = t.erro;
      // escaneado (sem camada de texto, ou quase nada): OCR das primeiras páginas (arquivador-ocr.js)
      if (OCR_LIGADO && e.texto.join('').replace(/\s/g, '').length < 40) {
        // o contínuo manda o escaneado para a fila do OCR (26/10/2026): o lote não espera a leitura da imagem
        // e o OCR já começa, em paralelo (os trabalhadores do Tesseract rodam em outras threads): quando o lote do OCR
        // chegar, a leitura está pronta (26/10/2026: o lote do OCR de 12 levava ~52 s e parava a fila comum)
        if (op && op.adiarOcr) { e.precisaOcr = true; adiantarOcr(e.hash, buffer); break; }
        const o = await ocrDe(e.hash, buffer);
        e.ocr = { confianca: o.confianca, ms: o.ms, erro: o.erro || null };
        if (o.paginas.length && o.paginas.join('').replace(/\s/g, '').length >= 40) { e.texto = o.paginas; e.paginas = e.paginas || o.total; }
      }
      break;
    }
    case 'xml': e.xml = textoDoXml(buffer); break;
    case 'ofx': e.ofx = buffer.toString('latin1'); break;
    case 'txt': e.txt = buffer.slice(0, 64 * 1024).toString('latin1'); break;
    case 'xlsx': case 'xls': case 'csv': e.planilha = linhasDaPlanilha(buffer, nome); break;
    case 'zip': if (ehTedSintegra(buffer)) e.tedSintegra = true; break;
    // a imagem escaneada (27/10/2026, Vitor: os comprovantes "Imagem (10).jpg" do Posto Berizal) é lida por OCR, como o PDF
    // escaneado: na fila do OCR do contínuo (adiarOcr) ou na hora
    case 'jpg': case 'jpeg': case 'png': {
      // só imagem de verdade (JPEG FF D8, PNG 89 50 4E 47): o resto nem vai ao Tesseract
      if (!OCR_LIGADO || !(buffer.length > 8 && ((buffer[0] === 0xff && buffer[1] === 0xd8) || buffer.readUInt32BE(0) === 0x89504e47))) break;
      if (op && op.adiarOcr) { e.precisaOcr = true; adiantarOcr(e.hash, buffer, true); break; }
      const o = await ocrDe(e.hash, buffer, true);
      e.ocr = { confianca: o.confianca, ms: o.ms, erro: o.erro || null };
      if (o.paginas.length && o.paginas.join('').replace(/\s/g, '').length >= 40) e.texto = o.paginas;
      break;
    }
    // sem extensão e pequeno (27/10/2026: o registro de envio do emissor, "env-lot=…-env-sinc-lot.xml"): o texto vai para as regras
    default: if (!ext && buffer.length < 4096) e.semExtensao = buffer.toString('latin1'); break;
  }
  return e;
}

// ---------------------------------------------------------------------------------------------------------------------
// compactados (Dicionário §1, 01 Fase 1b): .zip lido aqui mesmo; .rar/.7z pelo tar do Windows ou pelo UnRAR
// ---------------------------------------------------------------------------------------------------------------------
/** Arquivos de um .zip: [{ nome, buffer }]. Só "stored" e "deflate" (o que os portais e o Windows geram). */
function abrirZip(buf) {
  let fimCd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fimCd = i; break; }
  if (fimCd < 0) throw new Error('zip sem diretório central');
  const n = buf.readUInt16LE(fimCd + 10);
  let p = buf.readUInt32LE(fimCd + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip corrompido');
    const flags = buf.readUInt16LE(p + 8), metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20);
    const lNome = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32), loc = buf.readUInt32LE(p + 42);
    const nome = buf.slice(p + 46, p + 46 + lNome).toString(flags & 0x800 ? 'utf8' : 'latin1');
    p += 46 + lNome + lExtra + lCom;
    if (nome.endsWith('/')) continue;
    if (flags & 1) throw new Error('zip com senha');
    const ini = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const dados = buf.slice(ini, ini + comp);
    if (metodo === 0) out.push({ nome, buffer: dados });
    else if (metodo === 8) out.push({ nome, buffer: zlib.inflateRawSync(dados) });
    else throw new Error('zip com compressão ' + metodo);
  }
  return out;
}
function abrirComFerramenta(arquivo) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arqnovo-'));
  try {
    try { execFileSync(TAR, ['-xf', arquivo, '-C', tmp], { stdio: 'ignore', timeout: 120000 }); }
    catch (e) {
      if (!/\.rar$/i.test(arquivo) || !fs.existsSync(UNRAR)) throw new Error('FERRAMENTA_EXTRACAO_AUSENTE');
      execFileSync(UNRAR, ['x', '-o+', '-inul', arquivo, tmp + path.sep], { stdio: 'ignore', timeout: 120000 });
    }
    const out = [];
    const andar = d => { for (const it of fs.readdirSync(d, { withFileTypes: true })) { const c = path.join(d, it.name); if (it.isDirectory()) andar(c); else out.push({ nome: path.relative(tmp, c), buffer: fs.readFileSync(c) }); } };
    andar(tmp);
    return out;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
/** Abre recursivamente (zip dentro de zip). */
function membros(nome, buffer, arquivoNoDisco) {
  let lista;
  if (/\.zip$/i.test(nome)) lista = abrirZip(buffer);
  else {
    let alvo = arquivoNoDisco;
    let tmpArq = null;
    if (!alvo) { tmpArq = path.join(os.tmpdir(), 'arqnovo-' + sha(buffer).slice(0, 12) + path.extname(nome)); fs.writeFileSync(tmpArq, buffer); alvo = tmpArq; }
    try { lista = abrirComFerramenta(alvo); } finally { if (tmpArq) fs.rmSync(tmpArq, { force: true }); }
  }
  const out = [];
  for (const m of lista) {
    if (/\.(zip|rar|7z)$/i.test(m.nome)) { for (const s of membros(m.nome, m.buffer)) out.push({ nome: m.nome + '\\' + s.nome, buffer: s.buffer }); }
    else out.push(m);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// varredura (Dicionário §1: recursiva; fora NÃO IDENTIFICADOS, CLAUDE FAVOR NÃO MEXER e pastas com "_")
// ---------------------------------------------------------------------------------------------------------------------
function varrer(origem, opcoes) {
  const out = [];
  const andar = (dir, rel) => {
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    itens.sort((a, b) => a.name.localeCompare(b.name));
    for (const it of itens) {
      const r = rel ? rel + '\\' + it.name : it.name;
      if (it.isDirectory()) {
        if (it.name.startsWith('_') || /^CLAUDE FAVOR N[ÃA]O MEXER$/i.test(it.name)) continue;
        if (it.name === NAO_IDENTIFICADOS && !opcoes.incluirNaoIdentificados) continue;
        andar(path.join(dir, it.name), r);
      } else if (!it.name.startsWith('_nao_identificados') && it.name !== 'desktop.ini') out.push(r);
    }
  };
  const base = opcoes.pasta ? path.join(origem, opcoes.pasta) : origem;
  andar(base, opcoes.pasta || '');
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// o destino: nunca sobrescreve
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Confere o destino de uma decisão de ARQUIVAR. Devolve { situacao: 'NOVO'|'JA_ARQUIVADO', nomeFinal, onde }.
 * Mesmo conteúdo já gravado (no mesmo nome, num " (N)" da mesma pasta, ou registrado no manifesto da rotina antiga com
 * o arquivo ainda lá) = JA_ARQUIVADO. Nome ocupado por outro conteúdo = próximo " (N)" livre (Dicionário §2).
 */
/**
 * O XML igual com bytes diferentes (23/10/2026: o mesmo evento solto e de dentro do .zip do SIEG, um com BOM e o outro
 * sem): o conteúdo sem BOM, sem espaço nas pontas e com quebra de linha única. Só para XML; os outros, o hash de sempre.
 */
// A nota autorizada é a mesma quando a chave E o protocolo de autorização são os mesmos (23/10/2026: a mesma NF-e com e
// sem "<?xml …?>", vinda do emissor e do SIEG); o evento, pela chave, tipo, sequência e protocolo.
function conteudoXml(buf) {
  const t = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const g = re => (re.exec(t) || [])[1] || '';
  const prot = g(/<nProt>(\d{10,20})</);
  const ev = g(/<tpEvento>(\d{6})</);
  const ch = ev ? g(/<ch(?:NFe|CTe|MDFe)>(\d{44})</) : g(/Id="(?:NFe|CTe|MDFe)(\d{44})"/);
  if (ch && prot) return 'XML:' + ch + ':' + (ev ? ev + ':' + g(/<nSeqEvento>(\d+)</) + ':' : '') + prot;
  return sha(Buffer.from(t, 'utf8'));
}
function conteudoDe(p, ctx) {
  const k = 'xml:' + p;
  if (!ctx.hashes.has(k)) {
    let h = '', buf = null;
    try { if (/\.xml$/i.test(p) && fs.statSync(p).isFile()) { buf = fs.readFileSync(p); h = conteudoXml(buf); } } catch (e) {}
    ctx.hashes.set(k, h);
    // abriu o destino uma vez: o índice guarda o conteúdo dele (não abre de novo)
    if (buf && ctx.conteudos) { if (!ctx.hashes.has(p)) ctx.hashes.set(p, sha(buf)); ctx.conteudos.anotar([ctx.hashes.get(p), h], p); }
  }
  return ctx.hashes.get(k);
}
/** A raiz de um ano: a irmã da de clientes (G:\Meu Drive\2026 → G:\Meu Drive\2024); sem ano, a de clientes. */
function raizDoAno(clientes, ano) {
  if (!ano) return clientes;
  const base = path.basename(clientes);
  if (base === String(ano)) return clientes;
  if (!/^\d{4}$/.test(base) && +ano === R.ANO_DAS_PASTAS) return clientes;   // raiz de teste sem o ano no nome
  return path.join(path.dirname(clientes), String(ano));
}
function conferirDestino(d, hash, ctx, soNaPasta, hashXml) {
  const pasta = path.join(d.raiz || ctx.clientes, d.destinoRelativo);
  // o índice de conteúdo (arquivador-conteudos.js; 23/10/2026): o mesmo conteúdo já arquivado NESTA pasta, sem abrir o destino
  if (ctx.conteudos) for (const onde of ctx.conteudos.achar(hash, hashXml)) {
    if (path.dirname(onde).toLowerCase() === pasta.toLowerCase() && !ctx.reservados.has(onde.toLowerCase()) && existe(onde, ctx)) return { situacao: 'JA_ARQUIVADO', nomeFinal: path.basename(onde), onde };
  }
  const anterior = ctx.manifesto.get(hash);
  // soNaPasta (as cópias, ex. a NFS-e da Nilma no tomador): o manifesto antigo só vale se o arquivo dele está NESTA pasta
  if (anterior && existe(anterior, ctx) && (!soNaPasta || path.dirname(anterior).toLowerCase() === pasta.toLowerCase())) return { situacao: 'JA_ARQUIVADO', nomeFinal: path.basename(anterior), onde: anterior };
  const ext = path.extname(d.nomeFinal), base = d.nomeFinal.slice(0, d.nomeFinal.length - ext.length);
  for (let k = 0; k < 500; k++) {
    const nome = k === 0 ? d.nomeFinal : base + ' (' + k + ')' + ext;
    const alvo = path.join(pasta, nome);
    const chave = alvo.toLowerCase();
    if (ctx.reservados.has(chave)) { const r = ctx.reservados.get(chave); if (r === hash || (hashXml && ctx.reservadosXml && ctx.reservadosXml.get(chave) === hashXml)) return { situacao: 'JA_ARQUIVADO', nomeFinal: nome, onde: alvo + ' (neste lote)' }; continue; }
    if (!existe(alvo, ctx)) { ctx.reservados.set(chave, hash); if (hashXml) (ctx.reservadosXml || (ctx.reservadosXml = new Map())).set(chave, hashXml); return { situacao: 'NOVO', nomeFinal: nome, onde: alvo }; }
    if (hashDe(alvo, ctx) === hash || (hashXml && conteudoDe(alvo, ctx) === hashXml)) return { situacao: 'JA_ARQUIVADO', nomeFinal: nome, onde: alvo };
  }
  throw new Error('nomes esgotados em ' + pasta);
}
// "existe" é qualquer coisa com o nome (a rotina antiga deixou PASTAS chamadas "CONTRATO.pdf"): ocupado, vai para " (N)"
function existe(p, ctx) { if (!ctx.existe.has(p)) { let ok = false; try { fs.statSync(p); ok = true; } catch (e) {} ctx.existe.set(p, ok); } return ctx.existe.get(p); }
function hashDe(p, ctx) {
  if (!ctx.hashes.has(p)) {
    let h = '', buf = null;
    try { if (fs.statSync(p).isFile()) { buf = fs.readFileSync(p); h = sha(buf); } } catch (e) {}
    ctx.hashes.set(p, h);
    if (buf && ctx.conteudos) { const hx = /\.xml$/i.test(p) ? conteudoXml(buf) : null; if (hx) ctx.hashes.set('xml:' + p, hx); ctx.conteudos.anotar([h, hx], p); }
  }
  return ctx.hashes.get(p);
}

/**
 * Move um arquivo. Entre discos (o G: do Drive para a quarentena no C:) o rename do Windows não vale (EXDEV): copia,
 * confere o hash da cópia e só então tira o original. Nunca sobrescreve o destino.
 */
function mover(de, para) {
  try { fs.renameSync(de, para); return; } catch (e) { if (e.code !== 'EXDEV') throw e; }
  const buf = fs.readFileSync(de);
  fs.writeFileSync(para, buf, { flag: 'wx' });
  if (sha(fs.readFileSync(para)) !== sha(buf)) { try { fs.unlinkSync(para); } catch (x) { /* fica a cópia ruim */ } throw new Error('a cópia para ' + para + ' não conferiu; o original ficou'); }
  fs.unlinkSync(de);
}

// ---------------------------------------------------------------------------------------------------------------------
// a execução
// ---------------------------------------------------------------------------------------------------------------------
async function executar(opcoes) {
  opcoes = Object.assign({ modo: 'SIMULACAO', origem: ORIGEM, clientes: CLIENTES, controle: CONTROLE }, opcoes);
  for (const [k, v] of [['origem', ORIGEM], ['clientes', CLIENTES], ['controle', CONTROLE]]) if (!opcoes[k]) opcoes[k] = v;   // undefined passado não apaga o padrão
  const producao = opcoes.modo === 'PRODUCAO';
  if (producao) {
    if (!opcoes.confirmo) throw new Error('PRODUCAO exige --confirmo');
    try { const st = fs.statSync(opcoes.travaAntiga || TRAVA_ANTIGA); if (Date.now() - st.mtimeMs < 4 * 36e5) throw new Error('a rotina antiga está rodando (_execucao.lock): não arquivo ao mesmo tempo'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const agora = new Date();
  const id = (producao ? 'EXEC-' : 'SIM-') + carimbo(agora) + '-NOVO';
  const cadastro = opcoes.cadastro || carregarCadastro(opcoes);
  const ctx = { cadastro, hoje: agora, contas: opcoes.contas || lerContas(opcoes.controle), clientes: opcoes.clientes, manifesto: opcoes.manifesto || indiceDoManifesto(opcoes.manifestoAntigo || MANIFESTO_ANTIGO), reservados: new Map(), existe: new Map(), hashes: new Map(),
    conteudos: opcoes.conteudos || null,
    chaves: opcoes.chaves || K.carregar({ controle: opcoes.controle, manifestoAntigo: opcoes.manifestoAntigo || MANIFESTO_ANTIGO, raiz: opcoes.clientes }),
    // a decisão do admin no nads (23/10/2026, arquivador-manual.js): { [rel]: { codigo, tipoDoc, competencia, por } ou { descartar, por } }
    manual: opcoes.manual || null };
  const arquivos = opcoes.arquivos || varrer(opcoes.origem, opcoes);   // o modo contínuo passa o lote pronto
  const itens = [];
  const log = opcoes.log || (() => {});
  log(id + ': ' + arquivos.length + ' arquivo(s) na origem');

  // a leitura em paralelo (23/10/2026: no G: em streaming, ler é baixar; ~1 s por arquivo um de cada vez, 5 a 8 por
  // segundo com 8 juntos): até opcoes.leiturasJuntas (8) adiantadas, na ordem do lote. Desde 26/10/2026 a extração
  // (o texto do PDF, o OCR, a planilha) também vem adiantada, junto com a leitura; só a decisão, que reserva os nomes
  // no destino, segue uma de cada vez e na ordem (o mesmo resultado de antes)
  const tempos = { leituraMs: 0, decisaoMs: 0, gravacaoMs: 0 };
  const juntas = Math.max(1, +opcoes.leiturasJuntas || 8);
  const leituras = new Map();
  const preparar = async (rel, b) => {
    if (/\.(zip|rar|7z)$/i.test(rel) && !ehTedSintegra(b)) return { b };
    try { return { b, entrada: await montarEntrada(path.basename(rel), rel, b, { adiarOcr: !!opcoes.adiarOcr }) }; } catch (e) { return { b, erroEntrada: e }; }
  };
  const adiantar = i => { if (i < arquivos.length && !leituras.has(i)) leituras.set(i, fs.promises.readFile(path.join(opcoes.origem, arquivos[i])).then(b => preparar(arquivos[i], b), e => ({ e }))); };
  for (let i = 0; i < arquivos.length; i++) {
    const rel = arquivos[i];
    const caminho = path.join(opcoes.origem, rel);
    if ((i + 1) % 500 === 0) log('  ' + (i + 1) + '/' + arquivos.length);
    for (let j = i; j < i + juntas; j++) adiantar(j);
    const t0 = Date.now();
    const lido = await leituras.get(i); leituras.delete(i);
    tempos.leituraMs += Date.now() - t0;
    // erro de leitura (o arquivo ainda subindo de outro PC, preso por outro programa): fica e tenta depois
    if (lido.e) { itens.push({ rel, acao: 'FICA', motivo: 'ARQUIVO_INACESSIVEL', temporario: true, confianca: 0, evidencias: [lido.e.message] }); continue; }
    const buffer = lido.b;
    const t1 = Date.now();
    const pai = { rel, hash: sha(buffer), tamanho: buffer.length };
    if (/\.(zip|rar|7z)$/i.test(rel) && !ehTedSintegra(buffer)) {
      let lista;
      try { lista = membros(path.basename(rel), buffer, caminho); }
      catch (e) { itens.push(Object.assign(pai, { acao: 'NAO_IDENTIFICADO', motivo: /FERRAMENTA/.test(e.message) ? 'FERRAMENTA_EXTRACAO_AUSENTE' : 'ARQUIVO_COMPACTADO_CORROMPIDO', confianca: 0, evidencias: [e.message] })); continue; }
      const filhos = [];
      for (const m of lista) filhos.push(await decidirUm(path.basename(m.nome.replace(/\\/g, '/')), rel + '\\' + m.nome, m.buffer, ctx));
      itens.push(Object.assign(pai, { acao: 'CONTEINER', filhos, confianca: filhos.length ? Math.min(...filhos.map(f => f.confianca || 0)) : 0 }));
      continue;
    }
    // o conteúdo pequeno fica com o item até o fim (a quarentena do "já arquivado" grava dele, sem ler o G: de novo)
    if (lido.erroEntrada) throw lido.erroEntrada;
    itens.push(Object.assign(await decidirUm(path.basename(rel), rel, buffer, ctx, lido.entrada), { tamanho: buffer.length }, producao && buffer.length <= 1024 * 1024 ? { _buf: buffer } : {}));
    tempos.decisaoMs += Date.now() - t1;
  }

  await resolverEsperas(itens, opcoes, ctx);
  for (const it of itens) { delete it._buffer; for (const f of it.filhos || []) delete f._buffer; }
  const resultado = { id, modo: opcoes.modo, em: agora.toISOString(), origem: opcoes.origem, itens, tempos };
  const t2 = Date.now();
  try { if (producao) await aplicar(resultado, opcoes, ctx); } finally { for (const it of itens) delete it._buf; }
  tempos.gravacaoMs = Date.now() - t2;
  if (opcoes.registrar !== false) gravarRegistros(resultado, opcoes);   // o modo contínuo tem o diário dele
  if (opcoes.publicar) await publicar(resultado, opcoes);
  if (!opcoes.manterOcr) await encerrarOcr();   // o contínuo mantém os trabalhadores do OCR entre os lotes
  return resultado;
}

async function decidirUm(nome, rel, buffer, ctx, pronta) {
  const entrada = pronta || await montarEntrada(nome, rel, buffer);
  // o escaneado que o contínuo mandou para a fila do OCR: nada decidido agora (volta no lote do OCR)
  if (entrada.precisaOcr) return { rel, nome, hash: entrada.hash, acao: 'AGUARDANDO_OCR', motivo: 'ESCANEADO_NA_FILA_DO_OCR', confianca: 0, evidencias: [], copias: [] };
  let d = ctx.manual && ctx.manual[rel] ? require('./arquivador-manual').decidirManual(entrada, ctx, ctx.manual[rel]) : R.decidir(entrada, ctx);
  // a migração (23/10/2026): o que o conteúdo não decidiu, a pasta de origem pode decidir (o mapa da migração)
  if (!(ctx.manual && ctx.manual[rel]) && d.acao === 'NAO_IDENTIFICADO') { try { const m = require('./arquivador-migracao').decidir(entrada, ctx, d); if (m) d = m; } catch (e) { d.evidencias = (d.evidencias || []).concat('mapa da migração: ' + e.message); } }
  if (d.acao === 'ARQUIVAR') { d.raiz = raizDoAno(ctx.clientes, d.anoRaiz); for (const cp of d.copias || []) cp.raiz = raizDoAno(ctx.clientes, cp.anoRaiz || d.anoRaiz); }
  const item = { rel, nome, hash: entrada.hash, decididoPor: d.decididoPor || null, acao: d.acao, motivo: d.motivo || null, codigo: d.codigo || null, confianca: d.confianca, tipo: d.tipo || null, setor: d.setor || null,
    cliente: d.cliente || null, clienteNome: d.clienteNome || null, destinoRelativo: d.destinoRelativo || null, nomeFinal: d.nomeFinal || null, destinoSugerido: d.destinoSugerido || null,
    criarPastaCliente: !!d.criarPastaCliente, pastaCliente: d.pastaCliente || null, evidencias: d.evidencias || [], fonte: d.fonte || null, ocr: entrada.ocr || null, copias: [], chave: d.chave || null,
    anoRaiz: d.anoRaiz || null, raiz: d.raiz || null, pelaMigracao: d.pelaMigracao || null };
  if (d.acao === 'AGUARDANDO_ORIGINAL') item._buffer = buffer;   // para decidir de novo quando o original aparecer
  if (entrada.erroLeitura) item.evidencias.push('leitura do PDF: ' + entrada.erroLeitura);
  if (d.acao === 'ARQUIVAR') {
    const hx = /\.xml$/i.test(nome) && buffer ? conteudoXml(buffer) : null;
    if (hx) item.conteudoXml = hx;
    const c = conferirDestino(d, entrada.hash, ctx, false, hx);
    item.situacaoDestino = c.situacao;
    item.nomeFinal = c.nomeFinal;
    item.onde = c.onde;
    if (c.nomeFinal !== d.nomeFinal && c.situacao === 'NOVO') item.evidencias.push('nome ocupado por outro conteúdo: numerado (Dicionário §2, E402)');
    // a mesma peça em outro cliente (NFS-e de honorários da Nilma: também no tomador)
    for (const cp of d.copias || []) {
      const cc = conferirDestino({ destinoRelativo: cp.destinoRelativo, nomeFinal: cp.nomeFinal, raiz: cp.raiz }, entrada.hash, ctx, true, hx);
      item.copias.push(Object.assign({}, cp, { situacao: cc.situacao, nomeFinal: cc.nomeFinal, onde: cc.onde }));
    }
    const faltaAlgo = c.situacao === 'NOVO' || item.copias.some(cp => cp.situacao === 'NOVO');
    if (!faltaAlgo) { item.acao = 'JA_ARQUIVADO'; item.motivo = 'IDENTICO_JA_ARQUIVADO'; item.codigo = 'E401'; }
    // o índice de chaves cresce na hora (em memória; em PRODUCAO o aplicar grava em chaves.jsonl): um evento do mesmo
    // lote, decidido depois, já acha o original
    // (as cópias também: a nota das duas clientes leva os eventos para as duas)
    if (item.chave && ctx.chaves) for (const o of [item.onde].concat(item.copias.map(cp => cp.onde))) if (o) ctx.chaves.anotar(item.chave, { onde: String(o).replace(/ \(neste lote\)$/, ''), raiz: ctx.clientes, fonte: 'decisão' }, false);
  }
  return item;
}

/**
 * Os eventos AGUARDANDO_ORIGINAL (23/10/2026): primeiro, o original pode ter vindo neste mesmo lote (decidido depois do
 * evento): decide de novo pelo índice. Depois, os que já esperaram o bastante (opcoes.esperaVencida(rel do arquivo na
 * origem); sem a função, todos — execução avulsa, reprocessamento de NÃO IDENTIFICADOS) vão ao SIEG pela chave
 * (opcoes.buscaSieg, com limite por dia). O SIEG achou: o cliente do original decide o do evento. Não achou (ou o SIEG
 * está desligado): NAO_IDENTIFICADO "evento sem o documento original", com a chave. Ficou sem resposta (limite do dia):
 * continua esperando.
 */
async function resolverEsperas(itens, opcoes, ctx) {
  const esperando = [];
  const juntar = (lista, i, top) => { const it = lista[i]; if (it.acao === 'AGUARDANDO_ORIGINAL') esperando.push({ lista, i, top }); };
  itens.forEach((it, i) => { juntar(itens, i, it.rel); (it.filhos || []).forEach((f, j) => juntar(it.filhos, j, it.rel)); });
  if (!esperando.length) return;
  const redecidir = async (e, extra) => {
    const velho = e.lista[e.i];
    const novo = await decidirUm(velho.nome, velho.rel, velho._buffer, ctx);
    if (extra) novo.evidencias.push(extra);
    if (velho.tamanho) novo.tamanho = velho.tamanho;
    e.lista[e.i] = novo;
    return novo;
  };
  const vencidas = [];
  for (const e of esperando) {
    const it = e.lista[e.i];
    // o original pode ter vindo neste lote (decidido depois do evento): decide de novo; se ainda espera, segue abaixo
    if (ctx.chaves && ctx.chaves.achar(it.chave).length && (await redecidir(e, 'o índice de chaves mudou neste lote: decidido de novo')).acao !== 'AGUARDANDO_ORIGINAL') continue;
    if (!opcoes.esperaVencida || opcoes.esperaVencida(e.top)) vencidas.push(e);
  }
  if (!vencidas.length) return;
  const busca = opcoes.buscaSieg || null;
  let achados = new Map();
  if (busca && busca.ligado) {
    try { achados = await busca.buscar(vencidas.map(e => e.lista[e.i].chave)); }
    catch (err) { (opcoes.log || (() => {}))('SIEG por chave: ' + err.message); }
  }
  for (const e of vencidas) {
    const it = e.lista[e.i];
    const xml = achados.get(it.chave);
    if (xml) {
      // o original veio do SIEG: decide o original (com a mesma subpasta de origem do evento) para achar o cliente
      const orig = R.decidir({ nome: it.chave + '.xml', rel: it.rel, xml, hash: '' }, ctx);
      if (orig.acao === 'ARQUIVAR' && orig.cliente != null) {
        // o original pode ir para mais de um cliente (regra das duas clientes): o evento segue todos
        for (const c of [orig.cliente].concat((orig.copias || []).map(x => x.cliente))) ctx.chaves.anotar(it.chave, { cliente: c, de: 'outro', fonte: 'SIEG' }, false);
        const novo = await redecidir(e, 'documento original baixado do SIEG pela chave ' + it.chave + ' (cliente ' + orig.cliente + ')');
        novo.viaSieg = true;
        continue;
      }
      // o original também é ambíguo (ex.: nota entre a matriz e a filial, as duas clientes): o motivo é o dele
      const ambiguo = orig.motivo === 'CLIENTE_AMBIGUO';
      Object.assign(it, { acao: 'NAO_IDENTIFICADO', motivo: ambiguo ? 'CLIENTE_AMBIGUO' : 'EVENTO_SEM_ORIGINAL', codigo: ambiguo ? 'E102' : 'E103', evidencias: it.evidencias.concat('o SIEG tem o original (chave ' + it.chave + '), mas ele também não identifica o cliente: ' + (orig.motivo || orig.acao) + ((orig.evidencias || []).length ? ' (' + orig.evidencias[orig.evidencias.length - 1] + ')' : '')) });
      continue;
    }
    if (achados.has(it.chave) || !busca || !busca.ligado) {
      Object.assign(it, { acao: 'NAO_IDENTIFICADO', motivo: 'EVENTO_SEM_ORIGINAL', codigo: 'E103', evidencias: it.evidencias.concat(!K.chaveValida(it.chave) ? 'chave da NFS-e nacional (50 dígitos): o SIEG por chave não vale para ela' : busca && busca.ligado ? 'o SIEG não tem o documento original desta chave' : 'SIEG por chave desligado' + (busca && busca.motivo ? ' (' + busca.motivo + ')' : '')) });
      continue;
    }
    it.evidencias.push('o SIEG não respondeu por esta chave hoje (limite do dia ou erro): tenta de novo');
    if (!opcoes.esperaVencida) Object.assign(it, { acao: 'NAO_IDENTIFICADO', motivo: 'EVENTO_SEM_ORIGINAL', codigo: 'E103', semRespostaDoSieg: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// PRODUCAO: copiar, conferir, registrar, tirar da origem (quarentena própria, nunca apaga)
// ---------------------------------------------------------------------------------------------------------------------
/**
 * opcoes.tiposProducao: só os itens desses tipos são aplicados (prefixo do tipo: 'XML' pega todos os XML; 'NFC-e PDF'…);
 *   os outros ficam na origem, intocados, para a rotina antiga (produção por etapas). Sem a lista: todos.
 * opcoes.moverNaoIdentificados: false (padrão enquanto a rotina antiga roda) deixa o não identificado na origem.
 * opcoes.painel: o módulo painel.js (atividade "Arquivou X em Y", pasta de cliente criada).
 */
async function aplicar(res, opcoes, ctx) {
  const dia = dois(new Date().getDate()) + '-' + dois(new Date().getMonth() + 1) + '-' + new Date().getFullYear();
  const quarentena = path.join(opcoes.controle, 'QUARENTENA', dia);
  // a subpasta de NÃO IDENTIFICADOS: a da execução, ou a que o modo contínuo passa (uma por dia, não uma por lote)
  // a entrada local (origensExtras) manda os não identificados para o NÃO IDENTIFICADOS do G: (opcoes.raizNaoIdentificados)
  const ni = path.join(opcoes.raizNaoIdentificados || opcoes.origem, NAO_IDENTIFICADOS, opcoes.pastaNaoIdentificados || res.id.replace(/^EXEC-/, ''));
  const manifesto = path.join(opcoes.controle, 'MANIFESTO', 'manifesto.jsonl');
  const painel = opcoes.painel || null;
  const permitido = it => !opcoes.tiposProducao || opcoes.tiposProducao.includes('todos') || opcoes.tiposProducao.some(t => String(it.tipo || '').startsWith(t));
  fs.mkdirSync(path.dirname(manifesto), { recursive: true });
  const linha = (arq, o, varias) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.appendFileSync(arq, (varias || [o]).map(x => JSON.stringify(x)).join('\n') + '\n'); };
  const existeJa = async p => { try { await fs.promises.access(p); return true; } catch (e) { return false; } };
  const semSobrescrever = async (alvo) => { const ext = path.extname(alvo), base = alvo.slice(0, alvo.length - ext.length); let k = 0, p = alvo; while (await existeJa(p)) p = base + ' (' + (++k) + ')' + ext; return p; };
  // o mesmo disco (o G: para o G:): mover é trocar de pasta; entre discos, gravar o conteúdo
  const raizDe = p => path.parse(path.resolve(p)).root.toLowerCase();
  const mesmoDisco = (a, b) => raizDe(a) === raizDe(b);
  /** Move sem sobrescrever: o rename no mesmo disco; entre discos, copia, confere o hash e só então tira o original. */
  const moverSeguro = async (de, para) => {
    if (mesmoDisco(de, para)) { if (await existeJa(para)) throw new Error('o destino já existe: ' + para); await fs.promises.rename(de, para); return; }
    const buf = await fs.promises.readFile(de);
    await fs.promises.writeFile(para, buf, { flag: 'wx' });
    if (sha(await fs.promises.readFile(para)) !== sha(buf)) { try { await fs.promises.unlink(para); } catch (x) { /* fica a cópia ruim */ } throw new Error('a cópia para ' + para + ' não conferiu; o original ficou'); }
    await fs.promises.unlink(de);
  };
  const linhasNi = [];
  const moverParaNi = async (it, buffer) => {
    const alvo = await semSobrescrever(path.join(ni, it.rel));
    linhasNi.push(Object.assign({ arquivo: path.basename(alvo), caminho_relativo: path.dirname(it.rel), status: 'NAO_IDENTIFICADO', motivo: it.motivo, cliente_tentativa: it.cliente, confianca: it.confianca, id_execucao: res.id, timestamp: new Date().toISOString() }, it.chave ? { chave: it.chave } : {}));
    await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
    if (buffer) await fs.promises.writeFile(alvo, buffer, { flag: 'wx' }); else await moverSeguro(path.join(opcoes.origem, it.rel), alvo);
    it.movidoPara = alvo;
  };
  /** A linha do manifesto, o índice de chaves, o índice de conteúdo e o painel de um arquivo que chegou ao destino. */
  const registrarNoDestino = (it, alvo, cliente, pastaCliente, novaPasta, movido) => {
    linha(manifesto, Object.assign({ hash_origem: it.hash, hash_original: it.hashPai || it.hash, nome_original: it.nome, destino_final: path.dirname(alvo), nome_final: path.basename(alvo), id_execucao: res.id, timestamp: new Date().toISOString(), pai_completo: !it.hashPai, confianca: it.confianca, tipo: it.tipo, cliente, pasta_cliente_criada: novaPasta }, it.chave ? { chave: it.chave } : {}, it.conteudoXml ? { conteudo_xml: it.conteudoXml } : {}, movido ? { movido: true, origem: it.rel } : {}, it.decididoPor ? { decidido_por: it.decididoPor } : {}));
    if (it.chave && ctx.chaves) ctx.chaves.anotar(it.chave, { onde: alvo, raiz: opcoes.clientes, fonte: 'arquivou' }, true);
    if (ctx.conteudos) ctx.conteudos.anotar([it.hash, it.conteudoXml], alvo);
    if (novaPasta && painel) painel.atividade('arquivamento', 'Criou a pasta do cliente ' + pastaCliente, 'CNPJ do documento conferido com o cadastro · ' + it.nome);
    if (painel) painel.atividade('arquivamento', 'Arquivou ' + it.nome + ' em ' + (pastaCliente || ''), path.dirname(alvo).replace(path.dirname(opcoes.clientes), '').replace(/^\\/, '') + '\\' + path.basename(alvo));
  };
  // a pasta do cliente que nasce (na raiz do ano do destino: G:\Meu Drive\<AAAA>\<cód> - <nome>)
  const pastaNova = async (alvo, pastaCliente, criar) => {
    if (!criar || !pastaCliente) return false;
    const a = String(alvo), i = a.toLowerCase().indexOf('\\' + pastaCliente.toLowerCase() + '\\');
    const raiz = i >= 0 ? a.slice(0, i + 1 + pastaCliente.length) : path.join(opcoes.clientes, pastaCliente);
    return !(await existeJa(raiz));
  };
  /** Grava uma cópia num destino (uma das cópias, o de dentro de um .zip, a origem em outro disco): confere o hash. */
  const gravar = async (it, buffer, alvo, cliente, pastaCliente, criar) => {
    const novaPasta = await pastaNova(alvo, pastaCliente, criar);
    await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
    await fs.promises.writeFile(alvo, buffer, { flag: 'wx' });              // 'wx': falha se já existir — nunca sobrescreve
    if (sha(await fs.promises.readFile(alvo)) !== it.hash) throw new Error('hash não confere depois da cópia: ' + alvo);
    registrarNoDestino(it, alvo, cliente, pastaCliente, novaPasta, false);
  };
  /** O original ainda é o que foi lido (o tamanho e a data da varredura; sem reler o conteúdo). */
  const igualAoLido = async (it, de) => {
    const st = await fs.promises.stat(de);
    const m = opcoes.marcas && opcoes.marcas.get ? opcoes.marcas.get(it.rel) : null;
    if ((it.tamanho != null && st.size !== it.tamanho) || (m && (st.size !== m.tam || Math.round(st.mtimeMs) !== Math.round(m.mtime)))) throw new Error('o original mudou durante a execução: ' + it.rel);
  };
  /** O original vai para o destino principal por rename (o G: do Drive: sem baixar nem subir de novo). Nunca sobrescreve. */
  const moverParaODestino = async (it) => {
    const de = path.join(opcoes.origem, it.rel), alvo = it.onde;
    await igualAoLido(it, de);
    const novaPasta = await pastaNova(alvo, it.pastaCliente, it.criarPastaCliente);
    await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
    if (await existeJa(alvo)) throw new Error('o destino apareceu no meio da execução: ' + alvo + ' (o original ficou)');
    await fs.promises.rename(de, alvo);
    it.gravadoEm = alvo; it.movido = true;
    registrarNoDestino(it, alvo, it.cliente, it.pastaCliente, novaPasta, true);
  };
  const paraQuarentena = async (it, buf) => {
    const de = path.join(opcoes.origem, it.rel);
    // o conteúdo lido na decisão (ou relido): o hash confere e o arquivo na origem continua o mesmo
    const b = buf || it._buf || await fs.promises.readFile(de);
    if (sha(b) !== it.hash) throw new Error('o original mudou durante a execução: ' + it.rel);
    await igualAoLido(it, de);
    const alvo = await semSobrescrever(path.join(quarentena, it.rel));
    linha(path.join(quarentena, '_quarentena.jsonl'), { hash_original: it.hash, arquivo_original_caminho: it.rel, destino_final: it.gravadoEm || it.onde || null, id_execucao: res.id, timestamp: new Date().toISOString() });
    await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
    if (mesmoDisco(de, alvo)) { await moverSeguro(de, alvo); return; }
    // G: → C:: grava a cópia do conteúdo já lido, confere e só então tira o original (sem baixar de novo)
    await fs.promises.writeFile(alvo, b, { flag: 'wx' });
    if (sha(await fs.promises.readFile(alvo)) !== it.hash) { try { await fs.promises.unlink(alvo); } catch (x) { /* fica a cópia ruim */ } throw new Error('a cópia para ' + alvo + ' não conferiu; o original ficou'); }
    await fs.promises.unlink(de);
  };
  // 23/10/2026: vários destinos ao mesmo tempo (opcoes.destinosJuntos; o contínuo dá menos quando o Drive está lento). Os
  // destinos já foram reservados na decisão (nenhum par de arquivos disputa o mesmo nome)
  const juntos = Math.max(1, +opcoes.destinosJuntos || 6);
  let proximo = 0;
  const porAcao = {};
  await Promise.all(Array.from({ length: Math.min(juntos, res.itens.length) }, async () => {
    while (proximo < res.itens.length) {
      const it = res.itens[proximo++];
      const t0 = Date.now();
      await aplicarUm(it);
      const k = it.acao === 'ARQUIVAR' ? (it.movido ? 'mover' : 'gravar') : it.acao === 'CONTEINER' ? 'compactado' : it.acao === 'NAO_IDENTIFICADO' ? 'naoIdentificado' : it.acao === 'JA_ARQUIVADO' || it.acao === 'DESCARTAR' ? 'quarentena' : 'outro';
      const e = porAcao[k] || (porAcao[k] = { n: 0, ms: 0 }); e.n++; e.ms += Date.now() - t0;
    }
  }));
  if (linhasNi.length) { try { linha(path.join(ni, '_nao_identificados.jsonl'), null, linhasNi); } catch (e) { (opcoes.log || (() => {}))('não anotei o índice de NÃO IDENTIFICADOS: ' + e.message); } }
  if (res.tempos) { res.tempos.porAcao = porAcao; res.tempos.destinosJuntos = juntos; }
  async function aplicarUm(it) {
    await new Promise(r => setImmediate(r));   // o resto do robô (o ponto, o painel, os ouvintes) não espera o lote
    try {
      if (it.acao === 'CONTEINER') {
        // compactado: só quando todos os de dentro são de tipo liberado (senão fica inteiro para a rotina antiga)
        if (!it.filhos.every(f => permitido(f) || f.acao === 'JA_ARQUIVADO')) { it.naoAplicado = 'compactado com tipo ainda em simulação'; return; }
        if (it.filhos.some(f => f.acao === 'AGUARDANDO_ORIGINAL')) { it.naoAplicado = 'compactado com evento esperando o documento original'; return; }
        if (!opcoes.moverNaoIdentificados && it.filhos.some(f => f.acao === 'NAO_IDENTIFICADO' || f.acao === 'FICA')) { it.naoAplicado = 'compactado com não identificado (fica para a rotina antiga)'; return; }
        const buf = await fs.promises.readFile(path.join(opcoes.origem, it.rel));
        const lista = membros(path.basename(it.rel), buf, path.join(opcoes.origem, it.rel));
        const porNome = new Map(lista.map(m => [it.rel + '\\' + m.nome, m.buffer]));
        for (const f of it.filhos) {
          f.hashPai = it.hash;
          const b = porNome.get(f.rel);
          if (f.acao === 'ARQUIVAR') {
            if (f.situacaoDestino === 'NOVO') { await gravar(f, b, f.onde, f.cliente, f.pastaCliente, f.criarPastaCliente); f.gravadoEm = f.onde; }
            for (const cp of f.copias || []) if (cp.situacao === 'NOVO') { await gravar(f, b, cp.onde, cp.cliente, cp.pastaCliente, cp.criarPastaCliente); cp.gravadoEm = cp.onde; }
          }
          else if (f.acao === 'NAO_IDENTIFICADO' || f.acao === 'FICA') await moverParaNi(f, b);   // 01 Fase 4b (09/10/2026)
        }
        await paraQuarentena(it, buf);
        return;
      }
      if (!permitido(it)) { it.naoAplicado = 'tipo ainda em simulação'; return; }
      if (it.acao === 'ARQUIVAR') {
        const de = path.join(opcoes.origem, it.rel);
        // 23/10/2026: o principal vai por rename quando é o mesmo disco (o G: em streaming: troca de pasta no servidor);
        // as cópias (outro cliente) gravam o conteúdo; a origem em outro disco grava e manda o original para a quarentena
        const renomear = it.situacaoDestino === 'NOVO' && mesmoDisco(de, it.onde);
        const copias = (it.copias || []).filter(cp => cp.situacao === 'NOVO');
        const buf = copias.length || !renomear ? (it._buf || await fs.promises.readFile(de)) : null;
        if (buf && sha(buf) !== it.hash) throw new Error('o original mudou durante a execução: ' + it.rel);
        for (const cp of copias) { await gravar(it, buf, cp.onde, cp.cliente, cp.pastaCliente, cp.criarPastaCliente); cp.gravadoEm = cp.onde; }
        if (renomear) await moverParaODestino(it);
        else {
          if (it.situacaoDestino === 'NOVO') { await gravar(it, buf, it.onde, it.cliente, it.pastaCliente, it.criarPastaCliente); it.gravadoEm = it.onde; }
          await paraQuarentena(it, buf);
        }
      }
      else if (it.acao === 'DESCARTAR') {
        // descarte confirmado (23/10/2026): para a quarentena, nunca apagado; a linha no manifesto diz para onde foi
        await paraQuarentena(it);
        linha(manifesto, { hash_origem: it.hash, hash_original: it.hashPai || it.hash, nome_original: it.nome, destino_final: path.join(quarentena, path.dirname(it.rel)), nome_final: path.basename(it.rel), id_execucao: res.id, timestamp: new Date().toISOString(), pai_completo: !it.hashPai, confianca: 1, tipo: 'DESCARTE', cliente: null, descarte: true, motivo: (it.evidencias || [])[0] || null, decidido_por: it.decididoPor || undefined });
        if (painel) painel.atividade('arquivamento', 'Descartou ' + it.nome + ' (quarentena)', (it.evidencias || [])[0] || '');
      }
      else if (it.acao === 'JA_ARQUIVADO') { await paraQuarentena(it); if (it.chave && ctx.chaves && it.onde) ctx.chaves.anotar(it.chave, { onde: it.onde, raiz: opcoes.clientes, fonte: 'já arquivado' }, true); }
      else if (it.acao === 'NAO_IDENTIFICADO' && opcoes.moverNaoIdentificados) await moverParaNi(it);
    } catch (e) { it.erro = e.message; if (painel) painel.erro('arquivamento', 'Não consegui arquivar ' + (it.nome || it.rel), e.message); }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// relatório, plano e publicação
// ---------------------------------------------------------------------------------------------------------------------
function planos(res) {
  const out = [];
  for (const it of res.itens) { if (it.acao === 'CONTEINER') { const resumo = {}; it.filhos.forEach(f => { resumo[f.acao] = (resumo[f.acao] || 0) + 1; });
      out.push(Object.assign({}, it, { filhos: undefined, nFilhos: it.filhos.length, resumoFilhos: resumo })); it.filhos.forEach(f => out.push(Object.assign({ dentroDe: it.rel }, f))); } else out.push(it); }
  return out;
}
function relatorioTexto(res) {
  const todos = planos(res).filter(x => x.acao !== 'CONTEINER');
  const conta = {};
  todos.forEach(x => { conta[x.acao] = (conta[x.acao] || 0) + 1; });
  const L = [];
  L.push('ARQUIVADOR NOVO (determinístico, sem o Claude) — ' + res.id);
  L.push('modo: ' + res.modo + (res.modo === 'SIMULACAO' ? '   (nada foi copiado, movido nem renomeado)' : ''));
  L.push('origem: ' + res.origem + '   itens de origem: ' + res.itens.length + '   documentos (com os de dentro dos compactados): ' + todos.length);
  L.push('');
  for (const [k, v] of Object.entries(conta).sort((a, b) => b[1] - a[1])) L.push('  ' + k + ': ' + v);
  L.push('');
  L.push('=== O QUE FARIA, ARQUIVO A ARQUIVO ===');
  for (const x of planos(res)) {
    if (x.acao === 'CONTEINER') { const r = x.resumoFilhos || {}; const pendentes = (r.NAO_IDENTIFICADO || 0) + (r.FICA || 0);
      L.push('CONTEINER: ' + x.rel + ' -> ' + x.nFilhos + ' arquivo(s) dentro ' + JSON.stringify(r) + (pendentes ? ' — sairia da origem com os ' + pendentes + ' não resolvido(s) copiados para NÃO IDENTIFICADOS (01 Fase 4b)' : ' — todos resolvidos: sairia da origem para a quarentena')); continue; }
    const conf = x.confianca != null ? ' [' + Math.round(x.confianca * 100) + '%]' : '';
    if (x.acao === 'ARQUIVAR') { L.push('ARQUIVAR: ' + x.rel + ' -> ' + (x.situacaoDestino === 'NOVO' ? x.onde : '(já está em ' + x.onde + ')') + conf + (x.criarPastaCliente ? ' [pasta de cliente nova]' : '')); (x.copias || []).forEach(cp => L.push('   + cópia: ' + (cp.situacao === 'NOVO' ? cp.onde : '(já está em ' + cp.onde + ')') + (cp.criarPastaCliente ? ' [pasta de cliente nova]' : ''))); }
    else if (x.acao === 'JA_ARQUIVADO') L.push('JA_ARQUIVADO_ANTERIORMENTE: ' + x.rel + ' -> ' + x.onde);
    else if (x.acao === 'NAO_IDENTIFICADO') L.push('NAO_IDENTIFICADO: ' + x.rel + ' -> (' + x.motivo + ')' + conf + (x.destinoSugerido ? ' sugestão: ' + x.destinoSugerido : ''));
    else L.push(x.acao + ': ' + x.rel + ' -> (' + x.motivo + ')');
  }
  return L.join('\n') + '\n';
}
function gravarRegistros(res, opcoes) {
  const d = new Date(res.em);
  const pasta = path.join(opcoes.controle, 'LOGS', d.getFullYear() + '-' + dois(d.getMonth() + 1), dois(d.getDate()));
  fs.mkdirSync(pasta, { recursive: true });
  res.relatorio = path.join(pasta, res.id + '.txt');
  res.plano = path.join(pasta, res.id + '.jsonl');
  fs.writeFileSync(res.relatorio, relatorioTexto(res));
  fs.writeFileSync(res.plano, planos(res).map(x => JSON.stringify(Object.assign({}, x, { filhos: undefined }))).join('\n') + '\n');
}
/** Mesmo formato que o arquivador.js publica (arquivo-manifesto.montarExecucao): a aba Arquivo do nads lê sem mudar nada. */
async function publicar(res, opcoes) {
  const man = require('./arquivo-manifesto');
  const arquivos = planos(res).filter(x => x.acao === 'ARQUIVAR').map(x => {
    const p = man.destinoPorPartes(path.dirname(x.onde));
    return { original: x.nome, final: x.nomeFinal, codigo: p.codigo, cliente: p.cliente, subpasta: p.subpasta };
  });
  const qual = { naoIdentificados: planos(res).filter(x => x.acao === 'NAO_IDENTIFICADO').length, alerta: null, pais: res.itens.length };
  const { resumo, detalhe } = man.montarExecucao(res.id, arquivos, qual, fs.readFileSync(res.relatorio, 'utf8'), Date.now());
  resumo.publicadoEm = new Date().toISOString();
  resumo.origemRobo = 'arquivador-novo';
  const db = require('./firestore-client').getDb('entregas-2e5e2');
  const ref = db.collection('arquivamentos').doc(res.id);
  await ref.set(resumo, { merge: true });
  await ref.collection('detalhe').doc('tudo').set(detalhe, { merge: true });
}

// ---------------------------------------------------------------------------------------------------------------------
// reprocessar NÃO IDENTIFICADOS (23/10/2026: índice de chaves, SIEG pela chave, HELLO 545 no cadastro)
// ---------------------------------------------------------------------------------------------------------------------
const HELLO = new Set([544, 545, 564]);
/** Os arquivos de NÃO IDENTIFICADOS (todas as subpastas), sem os índices "_nao_identificados.jsonl". */
function arquivosDosNaoIdentificados(pastaNi) {
  const out = [];
  (function andar(d, rel) {
    let lista = [];
    try { lista = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of lista) {
      const r = rel ? rel + '\\' + e.name : e.name;
      if (e.isDirectory()) andar(path.join(d, e.name), r);
      else if (!/^_/.test(e.name) && !/^~\$|\.tmp$/i.test(e.name)) out.push(r);
    }
  })(pastaNi, '');
  return out.sort();
}
/** Por onde cada documento sairia: chave (índice), sieg, hello (544/545/564), outros, ja, ou o motivo de ficar. */
function rotaDoReprocesso(x) {
  if (x.erro) return 'erro';
  if (x.acao === 'JA_ARQUIVADO') return 'ja arquivado';
  if (x.acao === 'DESCARTAR') return 'descarte';
  if (x.acao === 'ARQUIVAR') return x.viaSieg ? 'sieg' : /índice de chaves/.test(x.fonte || '') ? 'chave' : HELLO.has(+x.cliente) ? 'hello' : 'outros';
  return 'fica: ' + (x.motivo || x.acao);
}
/**
 * Reprocessa G:\Meu Drive\Claudio Secretario\NÃO IDENTIFICADOS (que a varredura normal deixa de fora). SIMULACAO por
 * padrão (nada muda; o SIEG é consultado, com o limite do dia, e a resposta fica guardada). Em PRODUCAO: o que se
 * resolveu vai para o cliente (o original para a quarentena, como sempre); o que fica, fica onde está, e quem mudou de
 * motivo (ex.: EVENTO_SEM_ORIGINAL, com a chave) ganha uma linha nova no _nao_identificados.jsonl da subpasta.
 */
async function reprocessarNaoIdentificados(opcoes) {
  opcoes = Object.assign({ modo: 'SIMULACAO', controle: CONTROLE, clientes: CLIENTES }, opcoes);
  const pastaNi = opcoes.pastaNi || path.join(opcoes.origem || ORIGEM, NAO_IDENTIFICADOS);
  const arquivos = opcoes.arquivos || arquivosDosNaoIdentificados(pastaNi);
  // o motivo de antes de cada arquivo (a última linha do índice da subpasta)
  const antes = new Map();
  for (const sub of new Set(arquivos.map(r => r.split('\\')[0]))) {
    let texto = '';
    try { texto = fs.readFileSync(path.join(pastaNi, sub, '_nao_identificados.jsonl'), 'utf8'); } catch (e) { continue; }
    for (const l of texto.split(/\r?\n/)) { try { const j = JSON.parse(l); antes.set(sub + '\\' + (j.caminho_relativo && j.caminho_relativo !== '.' ? j.caminho_relativo + '\\' : '') + j.arquivo, j.motivo); } catch (e) { /* linha ruim */ } }
  }
  const res = await executar(Object.assign({}, opcoes, { origem: pastaNi, arquivos, moverNaoIdentificados: false, tiposProducao: ['todos'], esperaVencida: undefined, registrar: opcoes.registrar !== false }));
  const docs = planos(res).filter(x => x.acao !== 'CONTEINER');
  const porRota = {};
  for (const x of docs) { x.rota = rotaDoReprocesso(x); x.motivoAntes = antes.get(x.dentroDe || x.rel) || null; porRota[x.rota] = (porRota[x.rota] || 0) + 1; }
  if (res.modo === 'PRODUCAO') {
    for (const x of docs) {
      if (x.dentroDe || x.acao !== 'NAO_IDENTIFICADO' || (x.motivo === x.motivoAntes && !x.chave)) continue;
      const sub = x.rel.split('\\')[0], resto = x.rel.split('\\').slice(1);
      const linha = { arquivo: resto[resto.length - 1], caminho_relativo: resto.slice(0, -1).join('\\') || '.', status: 'NAO_IDENTIFICADO', motivo: x.motivo, cliente_tentativa: x.cliente, confianca: x.confianca, id_execucao: res.id, timestamp: new Date().toISOString(), reprocessado: true, motivo_anterior: x.motivoAntes };
      if (x.chave) linha.chave = x.chave;
      try { fs.appendFileSync(path.join(pastaNi, sub, '_nao_identificados.jsonl'), JSON.stringify(linha) + '\n'); } catch (e) { x.erro = 'não gravei o índice de NÃO IDENTIFICADOS: ' + e.message; }
    }
  }
  res.porRota = porRota;
  return res;
}

/** O trabalhador do Tesseract segura o processo vivo: fecha no fim de cada execução (se o OCR foi usado). */
async function encerrarOcr() { const k = require.resolve('./arquivador-ocr'); if (require.cache[k]) await require('./arquivador-ocr').encerrar(); }

module.exports = { ehTedSintegra, reprocessarNaoIdentificados, arquivosDosNaoIdentificados, rotaDoReprocesso, atualizarCadastro, encerrarOcr, executar, aprenderContas, lerContas, varrer, abrirZip, membros, montarEntrada, textoDoPdf, carregarCadastro, indiceDoManifesto, caminhoArquivado, conferirDestino, conteudoXml, raizDoAno, relatorioTexto, planos, CONTROLE };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const opcoes = {
    modo: a.includes('--producao') ? 'PRODUCAO' : 'SIMULACAO', confirmo: a.includes('--confirmo'), publicar: a.includes('--publicar'),
    incluirNaoIdentificados: a.includes('--incluir-nao-identificados'), pasta: valor('--pasta'), log: m => console.log(new Date().toLocaleTimeString('pt-BR'), m),
  };
  if (a.includes('--reprocessar-nao-identificados')) {
    // node arquivador-novo.js --reprocessar-nao-identificados [--producao --confirmo] [--sieg-por-dia 200] [--sem-sieg]
    (async () => {
      const db = require('./firestore-client').getDb('entregas-2e5e2');
      await atualizarCadastro({ db, log: opcoes.log });   // a HELLO 545 (e o resto) do Cadastro do nads
      let sieg = null;
      if (!a.includes('--sem-sieg')) { try { sieg = require('./sieg'); } catch (e) { opcoes.log('SIEG: ' + e.message); } }
      const buscaSieg = K.criarBuscaSieg({ controle: CONTROLE, sieg, limiteDia: +(valor('--sieg-por-dia') || 200), log: opcoes.log });
      opcoes.log('SIEG por chave: ' + (buscaSieg.ligado ? 'ligado, ' + buscaSieg.restantesHoje() + ' chamada(s) restantes hoje' : 'desligado (' + buscaSieg.motivo + ')'));
      const r = await reprocessarNaoIdentificados(Object.assign({}, opcoes, { buscaSieg }));
      console.log(r.id, JSON.stringify(r.porRota));
      console.log('chamadas ao SIEG hoje:', buscaSieg.chamadasHoje());
      console.log('relatório:', r.relatorio, '· plano:', r.plano);
      await encerrarOcr();
      process.exit(0);
    })().catch(e => { console.error('erro:', e.stack); process.exit(1); });
    return;
  }
  if (a.includes('--aprender-contas')) {
    aprenderContas({ log: opcoes.log }).then(idx => console.log('contas aprendidas:', Object.keys(idx).length)).catch(e => { console.error('erro:', e.message); process.exit(1); });
    return;
  }
  executar(opcoes).then(r => {
    const t = planos(r).filter(x => x.acao !== 'CONTEINER');
    const c = {}; t.forEach(x => { c[x.acao] = (c[x.acao] || 0) + 1; });
    console.log(r.id, JSON.stringify(c));
    console.log('relatório:', r.relatorio);
    console.log('plano:', r.plano);
  }).catch(e => { console.error('erro:', e.message); process.exit(1); });
}
