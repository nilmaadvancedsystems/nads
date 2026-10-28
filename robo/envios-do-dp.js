// DP › Envios (27/10/2026: "uma aba de envios, onde vai ser enviado para o gmail do cliente arquivos que já foram
// arquivados nas pastas dos clientes, coisas como folha de pagamento, fgts, darf… com um clique de botão num formato
// padrão via VM"). Roda no robô da nuvem (vigia-robo.js, com USAR_DRIVE_API=1):
//
//   1. a lista: a cada releitura da pasta de um cliente (drive-indice.js), os arquivos do DP de cada mês vão para
//      dpArquivos/{AAAA-MM} (clientes.<código>: { arquivos: [{ i, n, c, s }], em }). A tela lê um documento por
//      competência, sem abrir o mapa inteiro do Drive. Contam como do DP no mês (Vitor, 27/10/2026: "tudo do DP no mês"):
//        DEPARTAMENTO PESSOAL/<MM>/...                  o FGTS e o resto do mês (FUNCIONÁRIOS fica de fora: não é do mês)
//        SOCIETÁRIO/FOLHA DE PAGAMENTO/<AAAA>/<MM>/...  a folha, os holerites, o pró-labore
//        FISCAL/.../MM-AAAA - DARF INSS ...             a DARF do INSS (DCTFWeb), onde o arquivador guarda
//        CONTÁBIL/PAGAMENTOS DE FORNECEDORES/<AAAA>/<MM>/<pasta da Nilma>/  o boleto do escritório (28/10/2026: "o boleto do
//          escritório fica na do contábil"): só o que tem BOLETO no nome ou começa com Fatura_ (o comprovante do que o cliente
//          já pagou e a NFS-e ficam de fora), no mês ANTERIOR ao da pasta (a fatura de 11 vai com o DP de 10)
//   2. o envio: o pedido solicitacoesEmail { tipo: 'envioDp', competencia, codigo, arquivos: [ids] } (só o admin e o DP,
//      nas regras do banco e aqui de novo pelo cadastro de quem pediu). Só vão os arquivos que estão na lista do mês
//      desse cliente (nunca um id qualquer do Drive); o robô baixa pela API do Drive (só leitura) e manda pela caixa do
//      robô (nilmacontabilidade) para os e-mails do cadastro do cliente, no modelo padrão (email-html.htmlDoEnvioDp).
//      O assunto e o texto vêm de config/envioDp ({ assunto, texto }, editados em DP › Envios › Modelo do e-mail, com
//      {cliente}, {competencia} e {mes}; vazio = o padrão), como o e-mail da NFS-e. A Entrega das Obrigações a tela marca
//      quando vê o envio feito (useEnviosDoDp).
const { FieldValue } = require('firebase-admin/firestore');

const COLECAO = 'dpArquivos';
const MES = /^(0[1-9]|1[0-2])$/;
// um cliente com mais que isso num mês é pasta bagunçada: a lista fica nos primeiros (o documento tem teto de 1 MB)
const MAX_ARQUIVOS = 80;
// o Gmail aceita 25 MB por mensagem, e o anexo vai em base64 (+37%)
const MAX_BYTES = 18 * 1024 * 1024;
// o freio do envio do DP é dele (o "Enviar todos" passa de 100 clientes); a cota do Gmail é 500 destinatários por dia
const MAX_ENVIOS_POR_HORA = 200;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ---------- funções puras (testadas sem rede) ----------

// De que mês do DP é o arquivo, pelo caminho na pasta do cliente (chaves sem acento, em maiúsculas, com o nome do
// arquivo no fim); null quando não é do DP. ano: o da pasta do ano no Drive (DEPARTAMENTO PESSOAL/<MM> não diz o ano).
function competenciaDoDp(c, ano) {
  if (c[0] === 'DEPARTAMENTO PESSOAL' && c.length >= 3 && MES.test(c[1])) return ano + '-' + c[1];
  if (c[0] === 'SOCIETARIO' && c[1] === 'FOLHA DE PAGAMENTO' && c.length >= 5 && /^20\d{2}$/.test(c[2]) && MES.test(c[3])) return c[2] + '-' + c[3];
  if (c[0] === 'FISCAL') {
    const m = /^(0[1-9]|1[0-2])-(20\d{2}) - DARF INSS\b/.exec(c[c.length - 1]);
    if (m) return m[2] + '-' + m[1];
  }
  if (c[0] === 'CONTABIL' && c[1] === 'PAGAMENTOS DE FORNECEDORES' && c.length >= 6 && /^20\d{2}$/.test(c[2]) && MES.test(c[3]) && /NILMA/.test(c[4])) {
    const nome = c[c.length - 1];
    if (/BOLETO/.test(nome) || /^FATURA_/.test(nome)) return mesAnterior(c[2] + '-' + c[3]);
  }
  return null;
}

// "2026-01" -> "2025-12"
function mesAnterior(comp) {
  const d = new Date(Date.UTC(Number(comp.slice(0, 4)), Number(comp.slice(5, 7)) - 2, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

// O modelo do e-mail (config/envioDp), como o da NFS-e: vazio = o padrão; {cliente}, {competencia} ("10/2026") e {mes}
// ("outubro de 2026") trocados pelos dados (o que não conhece fica como está).
const MODELO_PADRAO = {
  assunto: 'Documentos do Departamento Pessoal · {competencia} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSeguem em anexo os documentos do Departamento Pessoal referentes a {mes}.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};
function mensagemDoEnvio(cfg, campos) {
  const t = x => (typeof x === 'string' ? x.trim() : '');
  const encher = modelo => modelo.replace(/\{(\w+)\}/g, (tudo, nome) => (Object.prototype.hasOwnProperty.call(campos, nome) ? campos[nome] : tudo));
  return {
    assunto: encher(t(cfg && cfg.assunto) || MODELO_PADRAO.assunto).replace(/\s+/g, ' ').trim().slice(0, 200),
    texto: encher(t(cfg && cfg.texto) || MODELO_PADRAO.texto).replace(/\r\n?/g, '\n').trim().slice(0, 5000),
  };
}

// Os arquivos do DP na pasta de um cliente, por mês: Map('2026-10' -> [{ i, n, c, s }]) — c é a pasta onde está
// ("DEPARTAMENTO PESSOAL/10/FGTS"), para a tela mostrar; s o tamanho. Só arquivo de verdade (não pasta nem Google Docs).
function arquivosDoDpNaPasta(itens, raizId, ano, caminhos, chaveDeNome) {
  const cam = caminhos(itens, raizId);
  const porMes = new Map();
  itens.forEach(it => {
    if (it.t !== 'f') return;
    const original = cam.get(it.i);
    if (!original || original.length < 2) return;
    const comp = competenciaDoDp(original.map(chaveDeNome), ano);
    if (!comp) return;
    if (!porMes.has(comp)) porMes.set(comp, []);
    porMes.get(comp).push({ i: it.i, n: it.n, c: original.slice(0, -1).join('/'), s: it.s || 0 });
  });
  porMes.forEach((lista, comp) => porMes.set(comp, lista.sort((a, b) => a.c.localeCompare(b.c, 'pt-BR') || a.n.localeCompare(b.n, 'pt-BR')).slice(0, MAX_ARQUIVOS)));
  return porMes;
}

// Os arquivos que vão no e-mail: os pedidos que estão na lista do mês (todos, se o pedido não escolheu nenhum).
function escolhidos(lista, pedidos) {
  const ids = new Set((Array.isArray(pedidos) ? pedidos : []).map(String));
  return ids.size ? lista.filter(a => ids.has(a.i)) : lista.slice();
}

// Para quem vai: o e-mail do Cadastro do nads (cadastro/{empresa}.contato.email; com mais de um documento do mesmo código,
// o primeiro que tiver), senão os do Entregas (clientes: email + emails). Em minúsculas, sem repetir.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function paraQuem(cadastrosDoNads, clienteDoEntregas) {
  const limpo = e => String(e || '').trim().toLowerCase();
  const doNads = (cadastrosDoNads || []).map(c => limpo(c && c.contato && c.contato.email)).find(e => EMAIL.test(e));
  if (doNads) return [doNads];
  const c = clienteDoEntregas || {};
  return [...new Set([c.email].concat(Array.isArray(c.emails) ? c.emails : []).map(limpo).filter(e => EMAIL.test(e)))];
}

// "2026-10" -> "outubro de 2026"
function mesPorExtenso(comp) {
  return MESES[Number(comp.slice(5, 7)) - 1] + ' de ' + comp.slice(0, 4);
}

// ---------- a lista no banco ----------

// o que já está em dpArquivos, por mês: Map(código -> assinatura), lido uma vez por mês (as releituras correm em paralelo)
const memoria = new Map();
function doMes(db, comp) {
  if (!memoria.has(comp)) {
    memoria.set(comp, db.collection(COLECAO).doc(comp).get().then(s => {
      const clientes = (s.exists && s.data().clientes) || {};
      return new Map(Object.keys(clientes).map(k => [k, JSON.stringify((clientes[k] && clientes[k].arquivos) || [])]));
    }).catch(err => { memoria.delete(comp); throw err; }));
  }
  return memoria.get(comp);
}
// os três últimos meses sempre são conferidos: o arquivo que saiu da pasta sai da lista
function mesesRecentes(agora) {
  const r = [];
  for (let k = 0; k < 3; k++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - k, 1));
    r.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
  }
  return r;
}

// Grava a lista do cliente em cada mês que mudou. Devolve quantos meses gravou.
async function gravarArquivosDoDp(db, codigo, porMes) {
  if (!codigo) return 0;
  const meses = new Set([...porMes.keys(), ...mesesRecentes(new Date())]);
  let gravados = 0;
  for (const comp of meses) {
    const antes = await doMes(db, comp);
    const lista = porMes.get(comp) || [];
    const agora = JSON.stringify(lista);
    if ((antes.get(codigo) || '[]') === agora) continue;
    const ref = db.collection(COLECAO).doc(comp);
    await ref.set({ clientes: { [codigo]: lista.length ? { arquivos: lista, em: new Date().toISOString() } : FieldValue.delete() }, atualizadoEm: new Date().toISOString() }, { merge: true });
    if (lista.length) antes.set(codigo, agora); else antes.delete(codigo);
    gravados++;
  }
  return gravados;
}

// ---------- o envio ----------

const enviosRecentes = [];
function dentroDoLimite() {
  const umaHoraAtras = Date.now() - 36e5;
  while (enviosRecentes.length && enviosRecentes[0] < umaHoraAtras) enviosRecentes.shift();
  return enviosRecentes.length < MAX_ENVIOS_POR_HORA;
}

const MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

// ctx: { db, getDrive, enviar(dados), clientesAtivos(), assinatura, caixa, log }. Devolve o que vai no pedido.
async function atenderEnvioDp(p, ctx) {
  const { db } = ctx;
  const quem = p.criadoPorUid ? ((await db.collection('usuarios').doc(String(p.criadoPorUid)).get()).data() || {}) : {};
  const papeis = Array.isArray(quem.roles) ? quem.roles : (quem.role ? [quem.role] : []);
  if (!papeis.includes('admin') && !papeis.includes('dp') && quem.departamento !== 'dp') throw new Error('só o DP e o administrador mandam os documentos do DP');
  const comp = String(p.competencia || '');
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(comp)) throw new Error('competência inválida');
  const codigo = String(p.codigo || '').trim();
  if (!/^\d+$/.test(codigo)) throw new Error('o pedido veio sem o código do cliente');

  const doc = (await db.collection(COLECAO).doc(comp).get()).data() || {};
  const lista = ((doc.clientes || {})[codigo] || {}).arquivos || [];
  const vao = escolhidos(lista, p.arquivos);
  if (!vao.length) throw new Error('nenhum arquivo do DP de ' + comp.slice(5) + '/' + comp.slice(0, 4) + ' na pasta do cliente');
  const total = vao.reduce((s, a) => s + (a.s || 0), 0);
  if (total > MAX_BYTES) throw new Error('os arquivos passam de 18 MB juntos (' + (total / 1048576).toFixed(1).replace('.', ',') + ' MB); desmarque alguns');

  const ativos = await ctx.clientesAtivos();
  const { cliente, para } = await destinatarios(db, codigo, ativos);
  if (!dentroDoLimite()) throw new Error('limite de ' + MAX_ENVIOS_POR_HORA + ' envios do DP por hora atingido; tente mais tarde');

  const anexos = [];
  for (const a of vao) {
    const r = await ctx.getDrive().files.get({ fileId: a.i, alt: 'media' }, { responseType: 'arraybuffer', timeout: 120000 });
    anexos.push({ nome: a.n, mime: mimeDe(a.n), buffer: Buffer.from(r.data) });
  }
  const nome = String(cliente.nome || p.empresa || '').trim();
  const { gmailId, assunto } = await mandarEmailDoDp(db, { comp, nome, para, anexos }, ctx);
  ctx.log('DP: documentos de', comp, 'enviados a', codigo, nome, '(' + anexos.length + ' arquivo(s), para ' + para.join(', ') + ')');
  return {
    status: 'enviado', enviadoEm: new Date().toISOString(), gmailId, para, assunto,
    enviados: anexos.map(a => a.nome), resumo: anexos.length + ' arquivo(s) para ' + para.join(', '),
  };
}

const mimeDe = nome => MIME[(String(nome).match(/\.([a-z0-9]{2,5})$/i) || [, ''])[1].toLowerCase()] || 'application/octet-stream';

// O cliente do Entregas (ativo, pelo código) e para quem vai: o e-mail do Cadastro do nads manda (28/10/2026: "quando eu
// altero no cadastro da empresa o gmail não altera lá no envios"), como o regime; o do Entregas só quando o nads não tem.
// ativos: o snapshot dos clientes ativos (clientes-cache). Também o lote do DP (lote-dp.js).
async function destinatarios(db, codigo, ativos) {
  let cliente = null;
  ativos.forEach(d => { if (!cliente && String(d.data().codigoOrigem || '').trim() === String(codigo)) cliente = d.data(); });
  if (!cliente) throw new Error('o cliente ' + codigo + ' não está no cadastro (ou está inativo)');
  const doNads = (await db.collection('cadastro').where('codigo', '==', Number(codigo)).limit(2).get()).docs.map(d => d.data());
  const para = paraQuem(doNads, cliente);
  if (!para.length) throw new Error('o cliente não tem e-mail no cadastro');
  return { cliente, para };
}

// O e-mail do DP no modelo (config/envioDp) com os anexos já em memória, pela caixa do robô. ctx: { enviar, assinatura,
// caixa }. Conta no freio por hora. Também o lote do DP (lote-dp.js).
async function mandarEmailDoDp(db, { comp, nome, para, anexos }, ctx) {
  if (!dentroDoLimite()) throw new Error('limite de ' + MAX_ENVIOS_POR_HORA + ' envios do DP por hora atingido; tente mais tarde');
  const competencia = comp.slice(5) + '/' + comp.slice(0, 4);
  const modelo = (await db.collection('config').doc('envioDp').get()).data() || {};
  const { assunto, texto } = mensagemDoEnvio(modelo, { cliente: nome, competencia, mes: mesPorExtenso(comp) });
  const visual = require('./email-html').htmlDoEnvioDp({ assunto, texto, cliente: nome, competencia, anexos: anexos.map(a => ({ nome: a.nome, tamanho: a.buffer.length })), assinatura: ctx.assinatura, caixa: ctx.caixa });
  const gmailId = await ctx.enviar({ para: para.join(', '), assunto, corpo: texto + '\n\n' + anexos.map(a => '- ' + a.nome).join('\n'), html: visual.html, imagens: visual.imagens, anexos });
  enviosRecentes.push(Date.now());
  return { gmailId, assunto };
}

module.exports = {
  gravarArquivosDoDp, atenderEnvioDp, destinatarios, mandarEmailDoDp, mimeDe, MAX_BYTES,
  // puras, pro teste
  competenciaDoDp, arquivosDoDpNaPasta, escolhidos, paraQuem, mesPorExtenso, mesesRecentes, mesAnterior, mensagemDoEnvio, MODELO_PADRAO, COLECAO,
};
