// Arquivador NOVO da pasta "Claudio Secretario": determinístico, sem o Claude (Vitor, 20/10/2026).
//
// As regras moram em arquivador-regras.js (puro, testado). Aqui fica o que mexe em disco: varrer a origem, ler cada
// arquivo (texto do PDF, XML, OFX, TXT, planilha; abre .zip/.rar/.7z), pedir a decisão às regras, conferir o destino
// (nunca sobrescreve: mesmo conteúdo = já arquivado; mesmo nome com conteúdo diferente = sufixo " (N)", Dicionário §2) e,
// só em PRODUCAO, copiar, conferir o hash, registrar e tirar o original da origem para a quarentena.
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
const TRAVA_ANTIGA = path.join(ROTINA, '_CONTROLE', '_execucao.lock');
const CONTROLE = process.env.ARQ_NOVO_CONTROLE || path.join(process.env.LOCALAPPDATA || os.homedir(), 'nads', 'arquivador-novo');
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
function carregarCadastro(opcoes) {
  const XLSX = require('xlsx');
  const ws = XLSX.readFile(opcoes.planilha || PLANILHA).Sheets;
  const linhas = XLSX.utils.sheet_to_json(ws[Object.keys(ws)[0]], { header: 1 });
  const cab = linhas[0].map(c => R.chaveNome(c));
  const col = n => cab.indexOf(R.chaveNome(n));
  const regs = linhas.slice(1).filter(l => l && l[col('Código')] != null).map(l => ({
    codigo: l[col('Código')], razao: l[col('Razão Social')], fantasia: l[col('Nome Fantasia')], doc: l[col('CNPJ')], ie: l[col('Insc.Estadual')], regime: l[col('Enquadramento')],
  }));
  let pastas = [];
  try { pastas = fs.readdirSync(opcoes.clientes || CLIENTES, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { /* sem Drive: só a planilha */ }
  return R.montarCadastro(regs, pastas);
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
/** O que as regras precisam de cada formato. */
async function montarEntrada(nome, rel, buffer) {
  const e = { nome, rel, hash: sha(buffer), tamanho: buffer.length };
  const ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1];
  switch ((ext || '').toLowerCase()) {
    case 'pdf': {
      const t = await textoDoPdf(buffer);
      e.texto = t.paginas; e.paginas = t.total;
      if (t.erro) e.erroLeitura = t.erro;
      // escaneado (sem camada de texto, ou quase nada): OCR das primeiras páginas (arquivador-ocr.js)
      if (OCR_LIGADO && e.texto.join('').replace(/\s/g, '').length < 40) {
        const o = await require('./arquivador-ocr').ocrDoPdf(buffer);
        e.ocr = { confianca: o.confianca, ms: o.ms, erro: o.erro || null };
        if (o.paginas.length && o.paginas.join('').replace(/\s/g, '').length >= 40) { e.texto = o.paginas; e.paginas = e.paginas || o.total; }
      }
      break;
    }
    case 'xml': e.xml = textoDoXml(buffer); break;
    case 'ofx': e.ofx = buffer.toString('latin1'); break;
    case 'txt': e.txt = buffer.slice(0, 64 * 1024).toString('latin1'); break;
    case 'xlsx': case 'xls': case 'csv': e.planilha = linhasDaPlanilha(buffer, nome); break;
    default: break;
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
function conferirDestino(d, hash, ctx) {
  const pasta = path.join(ctx.clientes, d.destinoRelativo);
  const anterior = ctx.manifesto.get(hash);
  if (anterior && existe(anterior, ctx)) return { situacao: 'JA_ARQUIVADO', nomeFinal: path.basename(anterior), onde: anterior };
  const ext = path.extname(d.nomeFinal), base = d.nomeFinal.slice(0, d.nomeFinal.length - ext.length);
  for (let k = 0; k < 500; k++) {
    const nome = k === 0 ? d.nomeFinal : base + ' (' + k + ')' + ext;
    const alvo = path.join(pasta, nome);
    const chave = alvo.toLowerCase();
    if (ctx.reservados.has(chave)) { if (ctx.reservados.get(chave) === hash) return { situacao: 'JA_ARQUIVADO', nomeFinal: nome, onde: alvo + ' (neste lote)' }; continue; }
    if (!existe(alvo, ctx)) { ctx.reservados.set(chave, hash); return { situacao: 'NOVO', nomeFinal: nome, onde: alvo }; }
    if (hashDe(alvo, ctx) === hash) return { situacao: 'JA_ARQUIVADO', nomeFinal: nome, onde: alvo };
  }
  throw new Error('nomes esgotados em ' + pasta);
}
function existe(p, ctx) { if (!ctx.existe.has(p)) { let ok = false; try { ok = fs.statSync(p).isFile(); } catch (e) {} ctx.existe.set(p, ok); } return ctx.existe.get(p); }
function hashDe(p, ctx) { if (!ctx.hashes.has(p)) ctx.hashes.set(p, sha(fs.readFileSync(p))); return ctx.hashes.get(p); }

// ---------------------------------------------------------------------------------------------------------------------
// a execução
// ---------------------------------------------------------------------------------------------------------------------
async function executar(opcoes) {
  opcoes = Object.assign({ modo: 'SIMULACAO', origem: ORIGEM, clientes: CLIENTES, controle: CONTROLE }, opcoes);
  const producao = opcoes.modo === 'PRODUCAO';
  if (producao) {
    if (!opcoes.confirmo) throw new Error('PRODUCAO exige --confirmo');
    try { const st = fs.statSync(TRAVA_ANTIGA); if (Date.now() - st.mtimeMs < 4 * 36e5) throw new Error('a rotina antiga está rodando (_execucao.lock): não arquivo ao mesmo tempo'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const agora = new Date();
  const id = (producao ? 'EXEC-' : 'SIM-') + carimbo(agora) + '-NOVO';
  const cadastro = carregarCadastro(opcoes);
  const ctx = { cadastro, hoje: agora, contas: lerContas(opcoes.controle), clientes: opcoes.clientes, manifesto: indiceDoManifesto(opcoes.manifestoAntigo || MANIFESTO_ANTIGO), reservados: new Map(), existe: new Map(), hashes: new Map() };
  const arquivos = varrer(opcoes.origem, opcoes);
  const itens = [];
  const log = opcoes.log || (() => {});
  log(id + ': ' + arquivos.length + ' arquivo(s) na origem');

  for (let i = 0; i < arquivos.length; i++) {
    const rel = arquivos[i];
    const caminho = path.join(opcoes.origem, rel);
    if ((i + 1) % 500 === 0) log('  ' + (i + 1) + '/' + arquivos.length);
    let buffer;
    try { buffer = fs.readFileSync(caminho); } catch (e) { itens.push({ rel, acao: 'FICA', motivo: 'ARQUIVO_INACESSIVEL', confianca: 0, evidencias: [e.message] }); continue; }
    const pai = { rel, hash: sha(buffer), tamanho: buffer.length };
    if (/\.(zip|rar|7z)$/i.test(rel)) {
      let lista;
      try { lista = membros(path.basename(rel), buffer, caminho); }
      catch (e) { itens.push(Object.assign(pai, { acao: 'NAO_IDENTIFICADO', motivo: /FERRAMENTA/.test(e.message) ? 'FERRAMENTA_EXTRACAO_AUSENTE' : 'ARQUIVO_COMPACTADO_CORROMPIDO', confianca: 0, evidencias: [e.message] })); continue; }
      const filhos = [];
      for (const m of lista) filhos.push(await decidirUm(path.basename(m.nome.replace(/\\/g, '/')), rel + '\\' + m.nome, m.buffer, ctx));
      itens.push(Object.assign(pai, { acao: 'CONTEINER', filhos, confianca: filhos.length ? Math.min(...filhos.map(f => f.confianca || 0)) : 0 }));
      continue;
    }
    itens.push(Object.assign(await decidirUm(path.basename(rel), rel, buffer, ctx), { tamanho: buffer.length }));
  }

  const resultado = { id, modo: opcoes.modo, em: agora.toISOString(), origem: opcoes.origem, itens };
  if (producao) aplicar(resultado, opcoes, ctx);
  gravarRegistros(resultado, opcoes);
  if (opcoes.publicar) await publicar(resultado, opcoes);
  await encerrarOcr();
  return resultado;
}

async function decidirUm(nome, rel, buffer, ctx) {
  const entrada = await montarEntrada(nome, rel, buffer);
  const d = R.decidir(entrada, ctx);
  const item = { rel, nome, hash: entrada.hash, acao: d.acao, motivo: d.motivo || null, codigo: d.codigo || null, confianca: d.confianca, tipo: d.tipo || null, setor: d.setor || null,
    cliente: d.cliente || null, clienteNome: d.clienteNome || null, destinoRelativo: d.destinoRelativo || null, nomeFinal: d.nomeFinal || null, destinoSugerido: d.destinoSugerido || null,
    criarPastaCliente: !!d.criarPastaCliente, evidencias: d.evidencias || [], fonte: d.fonte || null };
  if (entrada.erroLeitura) item.evidencias.push('leitura do PDF: ' + entrada.erroLeitura);
  if (d.acao === 'ARQUIVAR') {
    const c = conferirDestino(d, entrada.hash, ctx);
    item.situacaoDestino = c.situacao;
    item.nomeFinal = c.nomeFinal;
    item.onde = c.onde;
    if (c.situacao === 'JA_ARQUIVADO') { item.acao = 'JA_ARQUIVADO'; item.motivo = 'IDENTICO_JA_ARQUIVADO'; item.codigo = 'E401'; }
    else if (c.nomeFinal !== d.nomeFinal) item.evidencias.push('nome ocupado por outro conteúdo: numerado (Dicionário §2, E402)');
  }
  return item;
}

// ---------------------------------------------------------------------------------------------------------------------
// PRODUCAO: copiar, conferir, registrar, tirar da origem (quarentena própria, nunca apaga)
// ---------------------------------------------------------------------------------------------------------------------
function aplicar(res, opcoes, ctx) {
  const dia = dois(new Date().getDate()) + '-' + dois(new Date().getMonth() + 1) + '-' + new Date().getFullYear();
  const quarentena = path.join(opcoes.controle, 'QUARENTENA', dia);
  const ni = path.join(opcoes.origem, NAO_IDENTIFICADOS, res.id.replace(/^EXEC-/, ''));
  const manifesto = path.join(opcoes.controle, 'MANIFESTO', 'manifesto.jsonl');
  fs.mkdirSync(path.dirname(manifesto), { recursive: true });
  const linha = (arq, o) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.appendFileSync(arq, JSON.stringify(o) + '\n'); };
  const semSobrescrever = (alvo) => { const ext = path.extname(alvo), base = alvo.slice(0, alvo.length - ext.length); let k = 0, p = alvo; while (fs.existsSync(p)) p = base + ' (' + (++k) + ')' + ext; return p; };
  const moverParaNi = (it, buffer) => {
    const alvo = semSobrescrever(path.join(ni, it.rel));
    linha(path.join(ni, '_nao_identificados.jsonl'), { arquivo: path.basename(alvo), caminho_relativo: path.dirname(it.rel), status: 'NAO_IDENTIFICADO', motivo: it.motivo, cliente_tentativa: it.cliente, confianca: it.confianca, id_execucao: res.id, timestamp: new Date().toISOString() });
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    if (buffer) fs.writeFileSync(alvo, buffer, { flag: 'wx' }); else fs.renameSync(path.join(opcoes.origem, it.rel), alvo);
    it.movidoPara = alvo;
  };
  const copiar = (it, buffer) => {
    const alvo = it.onde;
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, buffer, { flag: 'wx' });                         // 'wx': falha se já existir — nunca sobrescreve
    if (sha(fs.readFileSync(alvo)) !== it.hash) throw new Error('hash não confere depois da cópia: ' + alvo);
    linha(manifesto, { hash_origem: it.hash, hash_original: it.hashPai || it.hash, nome_original: it.nome, destino_final: path.dirname(alvo), nome_final: path.basename(alvo), id_execucao: res.id, timestamp: new Date().toISOString(), pai_completo: !it.hashPai, confianca: it.confianca, tipo: it.tipo });
    it.gravadoEm = alvo;
  };
  const paraQuarentena = (it) => {
    const de = path.join(opcoes.origem, it.rel);
    if (sha(fs.readFileSync(de)) !== it.hash) throw new Error('o original mudou durante a execução: ' + it.rel);
    const alvo = semSobrescrever(path.join(quarentena, it.rel));
    linha(path.join(quarentena, '_quarentena.jsonl'), { hash_original: it.hash, arquivo_original_caminho: it.rel, destino_final: it.gravadoEm || it.onde || null, id_execucao: res.id, timestamp: new Date().toISOString() });
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.renameSync(de, alvo);
  };
  for (const it of res.itens) {
    try {
      if (it.acao === 'ARQUIVAR') { copiar(it, fs.readFileSync(path.join(opcoes.origem, it.rel))); paraQuarentena(it); }
      else if (it.acao === 'JA_ARQUIVADO') paraQuarentena(it);
      else if (it.acao === 'NAO_IDENTIFICADO') moverParaNi(it);
      else if (it.acao === 'CONTEINER') {
        const buf = fs.readFileSync(path.join(opcoes.origem, it.rel));
        const lista = membros(path.basename(it.rel), buf, path.join(opcoes.origem, it.rel));
        const porNome = new Map(lista.map(m => [it.rel + '\\' + m.nome, m.buffer]));
        for (const f of it.filhos) {
          f.hashPai = it.hash;
          const b = porNome.get(f.rel);
          if (f.acao === 'ARQUIVAR') copiar(f, b);
          else if (f.acao === 'NAO_IDENTIFICADO' || f.acao === 'FICA') moverParaNi(f, b);   // 01 Fase 4b (09/10/2026)
        }
        paraQuarentena(it);
      }
    } catch (e) { it.erro = e.message; }
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
    if (x.acao === 'ARQUIVAR') L.push('ARQUIVAR: ' + x.rel + ' -> ' + x.onde + conf);
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

/** O trabalhador do Tesseract segura o processo vivo: fecha no fim de cada execução (se o OCR foi usado). */
async function encerrarOcr() { const k = require.resolve('./arquivador-ocr'); if (require.cache[k]) await require('./arquivador-ocr').encerrar(); }

module.exports = { encerrarOcr, executar, aprenderContas, lerContas, varrer, abrirZip, membros, montarEntrada, textoDoPdf, carregarCadastro, indiceDoManifesto, caminhoArquivado, conferirDestino, relatorioTexto, planos, CONTROLE };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const opcoes = {
    modo: a.includes('--producao') ? 'PRODUCAO' : 'SIMULACAO', confirmo: a.includes('--confirmo'), publicar: a.includes('--publicar'),
    incluirNaoIdentificados: a.includes('--incluir-nao-identificados'), pasta: valor('--pasta'), log: m => console.log(new Date().toLocaleTimeString('pt-BR'), m),
  };
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
