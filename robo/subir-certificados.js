// Sobe para o cofre do nads os certificados digitais (.pfx/.p12) soltos nas pastas dos clientes (Vitor, 29/10/2026).
//
// Onde o nads guarda: o Firestore do entregas-2e5e2, coleção `cofre`, um documento por empresa (id = slug do nome da empresa
// da lista do nads, o mesmo de Senhas › Certificados). NÃO usa o Storage: o .pfx vai dentro do documento, em base64, e o
// documento inteiro (o .pfx, a senha dele, a senha gov.br e o código do Simples) é embaralhado no cofre com AES-GCM 256 (a
// chave do cofre; WebCrypto, igual ao @nads/core/cofre). Ficam às claras só `temGov`, `temCertificado` e `validade`.
// Cada empresa tem UM certificado: subir outro troca o anterior (como "Trocar arquivo" na tela) e preserva o resto do cofre.
//
// A chave do cofre não está com o robô (cada pessoa tem a sua cópia, trancada para o navegador dela). Para GRAVAR, este
// script abre a chave do cofre pelo CÓDIGO DE RECUPERAÇÃO (o mesmo que a tela aceita em "Recuperar"), que vem da variável
// de ambiente NADS_CODIGO_COFRE (nunca por argumento, nunca em arquivo, nunca no log). A simulação não precisa dele: lê só
// o que está às claras.
//
//   node subir-certificados.js --lista reprocesso.jsonl            simula (padrão) e grava o csv; não escreve no banco
//   node subir-certificados.js --pasta "G:\...\NÃO IDENTIFICADOS"  varre a pasta no lugar da lista
//   NADS_CODIGO_COFRE=... node subir-certificados.js --lista ... --aplicar   grava no cofre os que estão como "subir"
//
// Opções: --origem <pasta> (raiz dos "rel" da lista; padrão G:\Meu Drive\Claudio Secretario\NÃO IDENTIFICADOS)
//         --saida <csv> · --com-vencidos (sobe também os vencidos, se a empresa não tem outro mais novo) · --so <código>
//
// Não move nem apaga nenhum arquivo. Senhas nunca vão para o csv nem para o log.
'use strict';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'entregas-2e5e2';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const forge = require('node-forge');
const { getDb } = require('./firestore-client');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : padrao; };
const APLICAR = process.argv.includes('--aplicar');
const COM_VENCIDOS = process.argv.includes('--com-vencidos');
const ORIGEM = arg('--origem', 'G:\\Meu Drive\\Claudio Secretario\\NÃO IDENTIFICADOS');
const FONTE_EMPRESAS = process.env.NADS_FONTE_EMPRESAS || 'C:/claudio/nads/packages/core/src/empresas';
const SO = arg('--so', null);
const POR = 'Robô (subir-certificados)';

const pad2 = n => String(n).padStart(2, '0');
const dataLocal = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const hoje = dataLocal(new Date());
const so = s => String(s == null ? '' : s).replace(/\D/g, '');
// o Entregas perdeu o zero à esquerda de alguns CPF/CNPJ (igual ao arquivador-cadastro)
const doc = s => { const d = so(s); return d.length === 10 || d.length === 13 ? '0' + d : d; };
// o mesmo slug do @nads/core/formatos
const slug = nome => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'empresa';

// ---------------------------------------------------------------- o certificado (igual a lerCertificado do @nads/core)
class SenhaErrada extends Error {}
class NaoLe extends Error {}

function abrirComForge(der, senha) {
  try { return forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha); } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw /password|mac|decrypt/i.test(m) ? new SenhaErrada(m) : new NaoLe(m);
  }
}

/** { validade (aaaa-mm-dd), titular, documento } do certificado do titular (o que não é de autoridade e vence primeiro). */
function lerDosCertificados(certs) {
  if (!certs.length) throw new NaoLe('o arquivo não tem certificado');
  const daPessoa = certs.filter(x => !(x.getExtension('basicConstraints') || {}).cA);
  const cert = (daPessoa.length ? daPessoa : certs).sort((a, b) => a.validity.notAfter.getTime() - b.validity.notAfter.getTime())[0];
  const cn = String((cert.subject.getField('CN') || {}).value || '');
  const [nome, d] = cn.includes(':') ? [cn.slice(0, cn.lastIndexOf(':')), cn.slice(cn.lastIndexOf(':') + 1)] : [cn, ''];
  return { validade: dataLocal(cert.validity.notAfter), titular: nome.trim(), documento: so(d) };
}

/** Abre com a senha; se o forge não entende o algoritmo (RC2/AES novo), tenta o openssl (senha pelo ambiente, não pela linha de comando). */
function abrir(buf, senha) {
  try {
    const p12 = abrirComForge(buf.toString('binary'), senha);
    return lerDosCertificados((p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean));
  } catch (e) {
    if (e instanceof SenhaErrada || !/unsupported|unknown|oid|algorithm|cipher/i.test(e.message)) throw e;
  }
  let pem;
  try {
    pem = execFileSync('openssl', ['pkcs12', '-in', '-', '-nokeys', '-legacy', '-passin', 'env:PFX_SENHA'], { input: buf, env: { ...process.env, PFX_SENHA: senha }, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch (e) {
    throw /mac verify|invalid password|decrypt/i.test(String(e.stderr || e.message)) ? new SenhaErrada('openssl: senha') : new NaoLe('algoritmo não suportado');
  }
  return lerDosCertificados((pem.match(/-----BEGIN CERTIFICATE-----[sS]*?-----END CERTIFICATE-----/g) || []).map(c => forge.pki.certificateFromPem(c)));
}

// ---------------------------------------------------------------- a senha (no nome do arquivo ou num .txt ao lado)
function candidatasDe(arquivo, irmaos) {
  const base = path.basename(arquivo).replace(/\.(pfx|p12)$/i, '');
  const c = new Set(['']);
  const m = base.match(/senha\s*[:\-]?\s*(\S+)/i);
  if (m) c.add(m[1]);
  for (const t of base.split(/[\s_]+/)) { if (t.length >= 3 && t.length <= 40) { c.add(t); c.add(t.replace(/[.,;)]+$/, '')); } }
  for (const t of base.split(/\s+-\s+|\s+/).slice(-2)) c.add(t.trim());
  for (const txt of irmaos) {
    let s = '';
    try { s = fs.readFileSync(txt, 'utf8').slice(0, 4000); } catch (e) { continue; }
    for (const l of s.split(/\r?\n/)) {
      const k = l.match(/senha\s*[:=\-]?\s*(\S+)/i);
      if (k) c.add(k[1]);
      for (const t of l.split(/[\s:;=]+/)) if (t.length >= 3 && t.length <= 40) c.add(t);
    }
  }
  return [...c];
}

// ---------------------------------------------------------------- a lista de empresas do nads (código → nome, como a tela)
function nomesDaLista() {
  const nomes = new Map();
  const um = s => JSON.parse('"' + s + '"');
  try {
    const lista = fs.readFileSync(path.join(FONTE_EMPRESAS, 'lista.ts'), 'utf8');
    for (const m of lista.matchAll(/codigo:\s*(\d+),\s*nome:\s*"((?:[^"\\]|\\.)*)"/g)) nomes.set(+m[1], um(m[2]));
    const dp = fs.readFileSync(path.join(FONTE_EMPRESAS, 'dp.ts'), 'utf8');
    const ini = dp.indexOf('const LINHAS');
    for (const m of dp.slice(ini).matchAll(/^\s*\[(\d+),"((?:[^"\\]|\\.)*)",/gm)) if (!nomes.has(+m[1])) nomes.set(+m[1], um(m[2]));
  } catch (e) { console.error('Não li a lista de empresas do nads em ' + FONTE_EMPRESAS + ': ' + e.message); }
  return nomes;
}

// ---------------------------------------------------------------- o cofre (igual ao @nads/core/cofre/cripto)
const sutil = () => globalThis.crypto.subtle;
const b64 = b => Buffer.from(b instanceof ArrayBuffer ? new Uint8Array(b) : b).toString('base64');
const deB64 = s => new Uint8Array(Buffer.from(s, 'base64'));
const normalizarCodigo = c => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');

async function chaveDoCofrePeloCodigo(rec, codigo) {
  const base = await sutil().importKey('raw', new TextEncoder().encode(normalizarCodigo(codigo)), 'PBKDF2', false, ['deriveKey']);
  const k = await sutil().deriveKey({ name: 'PBKDF2', salt: deB64(rec.sal), iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
  return sutil().unwrapKey('raw', deB64(rec.dados), k, { name: 'AES-GCM', iv: deB64(rec.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function cifrar(chave, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await sutil().encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), dados: b64(dados) };
}
async function decifrar(chave, c) {
  const bytes = await sutil().decrypt({ name: 'AES-GCM', iv: deB64(c.iv) }, chave, deB64(c.dados));
  return JSON.parse(new TextDecoder().decode(bytes));
}
/** O que fica às claras (igual a metaDosSegredos). */
function metaDosSegredos(s) {
  const temGov = !!(s.gov && (s.gov.login || s.gov.senha));
  const temCertificado = !!(s.certificado && s.certificado.arquivo);
  return { temGov, temCertificado, ...(temCertificado && s.certificado.validade ? { validade: s.certificado.validade } : {}) };
}
const limpo = o => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- os arquivos
function lerLista(arq) {
  return fs.readFileSync(arq, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l).rel).filter(r => /\.(pfx|p12)$/i.test(r))
    .map(rel => ({ rel, abs: path.join(ORIGEM, rel) }));
}
function varrer(pasta, rel = '') {
  const fora = [];
  let itens = [];
  try { itens = fs.readdirSync(path.join(pasta, rel), { withFileTypes: true }); } catch (e) { return fora; }
  for (const d of itens) {
    const r = rel ? path.join(rel, d.name) : d.name;
    if (d.isDirectory()) fora.push(...varrer(pasta, r));
    else if (/\.(pfx|p12)$/i.test(d.name)) fora.push({ rel: r, abs: path.join(pasta, r) });
  }
  return fora;
}
const codigoDaPasta = rel => { for (const p of rel.split(/[\\/]/)) { const m = p.match(/^0*(\d{1,4})\s+-\s+/); if (m && +m[1] > 1) return +m[1]; } return null; };

// o nome do arquivo costuma trazer a senha ("... Senha 1234.pfx"): no csv ela vira ***
function semSenha(i) {
  let r = i.rel;
  if (i.senha && i.senha.length >= 3) r = r.split(i.senha).join('***');
  // o que vem depois de "senha" no nome (o certificado que não abriu, ou a senha de outro lugar)
  return r.replace(/(senha\s*[:-]?\s*)([^\s\\/]+?)(\.(?:pfx|p12))$/i, (m, a, b, c) => a + '***' + c);
}
const csvCel = v => { const s = String(v == null ? '' : v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dataBr = iso => (iso ? iso.split('-').reverse().join('/') : '');
const docFmt = d => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : d);

async function main() {
  const lista = arg('--lista', null);
  const pasta = arg('--pasta', null);
  if (!lista && !pasta) { console.error('Use --lista <reprocesso.jsonl> ou --pasta <pasta>.'); process.exit(2); }
  let arquivos = lista ? lerLista(lista) : varrer(pasta);
  if (pasta) for (const a of arquivos) a.abs = path.join(pasta, a.rel);
  console.log('Certificados na lista: ' + arquivos.length + ' · ' + (APLICAR ? 'APLICANDO' : 'SIMULAÇÃO (nada é gravado)'));

  const db = getDb();
  // os clientes: documento → códigos (Entregas `clientes.documento` e nads `cadastro.cnpj`)
  const [cli, cad, cofreSnap, configSnap] = await Promise.all([
    db.collection('clientes').select('codigoOrigem', 'nome', 'documento', 'ativo').get(),
    db.collection('cadastro').select('codigo', 'nome', 'cnpj').get(),
    db.collection('cofre').get(),
    db.collection('cofreConfig').doc('atual').get(),
  ]);
  const nomesNads = nomesDaLista();
  const porDoc = new Map();
  const nomeDoCodigo = new Map();
  const poe = (d, cod, nome) => { if (!d || !cod) return; if (!porDoc.has(d)) porDoc.set(d, new Set()); porDoc.get(d).add(cod); if (nome && !nomeDoCodigo.has(cod)) nomeDoCodigo.set(cod, nome); };
  for (const d of cli.docs) { const x = d.data(); poe(doc(x.documento), +x.codigoOrigem, x.nome); }
  for (const d of cad.docs) { const x = d.data(); poe(doc(x.cnpj), +x.codigo, x.nome); }
  for (const [cod, nome] of nomesNads) nomeDoCodigo.set(cod, nome);
  const config = configSnap.data() || null;
  const cofrePorCodigo = new Map();
  const cofrePorId = new Map();
  for (const d of cofreSnap.docs) { const x = d.data(); if (x.tipo === 'gov') continue; cofrePorId.set(d.id, x); if (x.codigo != null) cofrePorCodigo.set(+x.codigo, { id: d.id, ...x }); }

  // 1. abrir cada certificado (a senha sai do nome do arquivo ou do .txt ao lado; as que já abriram valem de palpite para os outros)
  const itens = [];
  const aprendidas = new Set();
  for (const a of arquivos) {
    const it = { rel: a.rel, abs: a.abs, nome: path.basename(a.abs), pastaCodigo: codigoDaPasta(a.rel) };
    itens.push(it);
    try { it.buf = fs.readFileSync(a.abs); } catch (e) { it.situacao = 'ilegível'; it.motivo = 'arquivo não encontrado (já foi movido?)'; continue; }
    it.hash = crypto.createHash('sha1').update(it.buf).digest('hex');
    let irmaos = [];
    try { irmaos = fs.readdirSync(path.dirname(a.abs)).filter(n => /\.txt$/i.test(n)).map(n => path.join(path.dirname(a.abs), n)); } catch (e) { /* sem pasta */ }
    it.candidatas = candidatasDe(a.abs, irmaos);
  }
  const tentar = it => {
    for (const s of [...it.candidatas, ...aprendidas]) {
      try { Object.assign(it, abrir(it.buf, s)); it.senha = s; if (s) aprendidas.add(s); return true; } catch (e) {
        if (e instanceof NaoLe) { it.situacao = 'ilegível'; it.motivo = 'não abre como certificado (.pfx): ' + e.message.slice(0, 80); return true; }
      }
    }
    return false;
  };
  const pendentes = itens.filter(i => i.buf && !i.situacao);
  for (const it of pendentes) tentar(it);
  // segunda volta: as senhas que abriram outros certificados valem de palpite (a do escritório se repete)
  for (const it of pendentes.filter(i => !i.situacao && !i.senha)) tentar(it);
  for (const it of itens.filter(i => i.buf && !i.situacao && !i.senha)) { it.situacao = 'senha errada'; it.motivo = 'nenhuma senha do nome do arquivo, do .txt ao lado ou dos outros certificados abriu'; }

  // 2. o cliente pelo CNPJ/CPF do certificado, conferido com a pasta
  for (const it of itens.filter(i => i.senha !== undefined && !i.situacao)) {
    if (!it.documento) { it.situacao = 'sem cliente'; it.motivo = 'o certificado não traz CNPJ/CPF no nome do titular'; continue; }
    const codigos = [...(porDoc.get(it.documento) || [])];
    if (!codigos.length) { it.situacao = 'sem cliente'; it.motivo = 'o ' + (it.documento.length === 14 ? 'CNPJ' : 'CPF') + ' do certificado não está no cadastro (Entregas nem nads)'; continue; }
    if (codigos.length > 1) {
      if (it.pastaCodigo && codigos.includes(it.pastaCodigo)) codigos.splice(0, codigos.length, it.pastaCodigo);
      else { it.situacao = 'divergente'; it.motivo = 'o documento do certificado está em mais de um cadastro: ' + codigos.join(', '); continue; }
    }
    it.codigo = codigos[0];
    if (it.pastaCodigo && it.pastaCodigo !== it.codigo) {
      const mesmaRaiz = it.documento.length === 14 && so((nomeDoCodigo.get(it.pastaCodigo) && [...porDoc].find(([, s]) => s.has(it.pastaCodigo)) || [''])[0]).slice(0, 8) === it.documento.slice(0, 8);
      it.situacao = 'divergente';
      it.motivo = 'a pasta é do cliente ' + it.pastaCodigo + ' e o certificado é do ' + it.codigo + ' (' + (nomeDoCodigo.get(it.codigo) || '?') + ')' + (mesmaRaiz ? '; mesmo CNPJ-raiz (matriz/filial)' : '');
      continue;
    }
        it.empresa = nomesNads.get(it.codigo) || (cofrePorCodigo.get(it.codigo) || {}).empresa || null;
    if (!it.empresa) { it.situacao = 'fora da lista'; it.motivo = 'o cliente ' + it.codigo + ' (' + nomeDoCodigo.get(it.codigo) + ') está no cadastro mas não na lista de empresas do nads (Senhas › Certificados não o mostra)'; continue; }
    if (it.validade < hoje && !COM_VENCIDOS) { it.situacao = 'vencido'; it.motivo = 'venceu em ' + dataBr(it.validade) + ' (use --com-vencidos para subir mesmo assim)'; }
  }

  // 3. por empresa: o mais novo ganha; o que já está no cofre com a mesma validade ou mais nova, ou outro arquivo do mesmo cliente igual/mais velho, é duplicado
  const porEmpresa = new Map();
  for (const it of itens.filter(i => i.codigo && !i.situacao)) { if (!porEmpresa.has(it.codigo)) porEmpresa.set(it.codigo, []); porEmpresa.get(it.codigo).push(it); }
  for (const [codigo, lista] of porEmpresa) {
    const noCofre = cofrePorCodigo.get(codigo) || cofrePorId.get(slug(lista[0].empresa));
    lista.sort((a, b) => b.validade.localeCompare(a.validade) || b.buf.length - a.buf.length);
    lista.forEach((it, i) => {
      if (noCofre && noCofre.temCertificado && noCofre.validade && noCofre.validade >= it.validade) { it.situacao = 'duplicado'; it.motivo = 'o nads já tem certificado deste cliente com validade ' + dataBr(noCofre.validade) + ' (igual ou mais nova)'; return; }
      if (i > 0) { it.situacao = 'duplicado'; it.motivo = lista[0].hash === it.hash ? 'o mesmo arquivo de outra pasta' : 'outro arquivo do mesmo cliente tem validade ' + dataBr(lista[0].validade) + ' (igual ou mais nova)'; return; }
      it.situacao = 'subir';
      it.motivo = noCofre && noCofre.temCertificado ? 'troca o do cofre (validade ' + dataBr(noCofre.validade) + ')' : 'o cliente ainda não tem certificado no nads';
      it.docId = noCofre ? noCofre.id || slug(it.empresa) : slug(it.empresa);
    });
  }

  // 4. o csv e os totais (sem senha: só "senha ok" ou "senha errada")
  const saida = arg('--saida', path.join(process.cwd(), 'subir-certificados-' + hoje.replace(/-/g, '') + '.csv'));
  const ordem = { subir: 0, vencido: 1, duplicado: 2, divergente: 3, 'senha errada': 4, 'sem cliente': 5, 'fora da lista': 6, 'ilegível': 7 };
  const cab = ['cliente', 'arquivo', 'titular', 'cnpj_cpf', 'validade', 'senha', 'situacao', 'motivo'];
  const linhas = itens.filter(i => !SO || i.codigo === +SO || i.pastaCodigo === +SO)
    .sort((a, b) => (ordem[a.situacao] - ordem[b.situacao]) || String(a.codigo || 9999).localeCompare(String(b.codigo || 9999), 'pt', { numeric: true }) || a.rel.localeCompare(b.rel))
    .map(i => [i.codigo ? i.codigo + ' - ' + (i.empresa || nomeDoCodigo.get(i.codigo) || '') : (i.pastaCodigo ? 'pasta ' + i.pastaCodigo + ' - ' + (nomeDoCodigo.get(i.pastaCodigo) || '') : ''),
      semSenha(i), i.titular || '', docFmt(i.documento || ''), dataBr(i.validade || ''), i.senha !== undefined ? 'senha ok' : i.situacao === 'senha errada' ? 'senha errada' : '', i.situacao, i.motivo]);
  fs.writeFileSync(saida, '\uFEFF' + [cab, ...linhas].map(l => l.map(csvCel).join(';')).join('\r\n') + '\r\n', 'utf8');
  const totais = {};
  for (const i of itens) totais[i.situacao] = (totais[i.situacao] || 0) + 1;
  console.log('csv: ' + saida);
  console.log('totais: ' + Object.entries(totais).sort((a, b) => ordem[a[0]] - ordem[b[0]]).map(([k, v]) => k + ' ' + v).join(' · ') + ' · total ' + itens.length);
  if (!APLICAR) { console.log('Simulação: nada foi gravado no banco. Para gravar: NADS_CODIGO_COFRE=... node subir-certificados.js ... --aplicar'); return; }

  // 5. gravar no cofre (igual à tela: useSegredos.salvarCert + useCofre.salvar)
  const codigo = process.env.NADS_CODIGO_COFRE;
  if (!codigo) { console.error('Falta o código de recuperação do cofre na variável de ambiente NADS_CODIGO_COFRE.'); process.exit(3); }
  if (!config || !config.recuperacao) { console.error('O cofre não foi criado (cofreConfig/atual vazio).'); process.exit(3); }
  let chave;
  try { chave = await chaveDoCofrePeloCodigo(config.recuperacao, codigo); } catch (e) { console.error('Código de recuperação errado.'); process.exit(3); }
  let gravados = 0, falhas = 0;
  for (const it of itens.filter(i => i.situacao === 'subir')) {
    try {
      const ref = db.collection('cofre').doc(it.docId);
      await db.runTransaction(async t => {
        const s = await t.get(ref);
        const atual = s.exists ? s.data() : null;
        if (atual && atual.versao !== config.versao) throw new Error('o documento está na chave versão ' + atual.versao + ' e o cofre na ' + config.versao);
        const segredos = atual && atual.iv && atual.dados ? await decifrar(chave, atual) : {};
        if (segredos.certificado && segredos.certificado.validade && segredos.certificado.validade >= it.validade) throw new Error('já tem certificado igual ou mais novo (mudou desde a simulação)');
        const novo = { ...segredos, certificado: {
          nomeArquivo: it.nome, arquivo: it.buf.toString('base64'), senha: it.senha, validade: it.validade,
          ...(it.titular ? { titular: it.titular + (it.documento ? ':' + it.documento : '') } : {}),
          obs: 'Veio da pasta do cliente no Drive em ' + dataBr(hoje),
        } };
        t.set(ref, limpo({ ...(atual || {}), empresa: it.empresa, codigo: it.codigo, versao: config.versao, ...(await cifrar(chave, novo)), ...metaDosSegredos(novo), atualizadoEm: new Date().toISOString(), atualizadoPor: POR }));
      });
      // confere: lê de volta, abre e compara o arquivo
      const volta = (await db.collection('cofre').doc(it.docId).get()).data();
      const ok = (await decifrar(chave, volta)).certificado.arquivo === it.buf.toString('base64') && volta.validade === it.validade;
      if (!ok) throw new Error('a conferência da gravação falhou');
      gravados++;
      console.log('gravado: ' + it.codigo + ' ' + it.empresa + ' (validade ' + dataBr(it.validade) + ')');
    } catch (e) { falhas++; console.error('FALHOU ' + it.codigo + ' ' + it.empresa + ': ' + e.message); }
  }
  console.log('Aplicado: ' + gravados + ' gravados, ' + falhas + ' falhas.');
}

if (require.main === module) main().then(() => process.exit(0)).catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
module.exports = { chaveDoCofrePeloCodigo, cifrar, decifrar, metaDosSegredos, slug, abrir, candidatasDe };
