// Gravar anexo na pasta "Claudio Secretario", quando não existe um G:\.
//
// No PC do escritório o Drive é uma letra de unidade: o robô faz mkdir e
// writeFile como em qualquer pasta, e o aplicativo do Google sincroniza. Na
// nuvem não há unidade montada, então o mesmo destino é alcançado pela API.
//
// As funções daqui têm de propósito a MESMA forma das de disco em
// download-attachments.js (sanitizar / copiaJaNaOrigem / salvarArquivo), pra
// quem for ler os dois não precisar aprender dois vocabulários.
//
// O que este arquivo NÃO faz, e é de propósito: apagar, mover pra lixeira,
// renomear ou sobrescrever arquivo que já existe. Um anexo repetido é
// reconhecido e ignorado; um nome repetido com conteúdo diferente vira
// "nome (2).pdf", como no disco. Nenhum caminho deste módulo remove nada.
const crypto = require('crypto');
const { Readable } = require('stream');
const { google } = require('googleapis');
const { getAuth } = require('./gmail-client');

const PASTA_RAIZ = 'Claudio Secretario';
const MIME_PASTA = 'application/vnd.google-apps.folder';

// Nome de arquivo no Drive aceita quase tudo (não existe a restrição de
// caracteres do Windows), mas os dois lados precisam gerar o MESMO nome: é
// assim que o robô reconhece "já baixei isso" indo de um pro outro.
function sanitizar(nome) {
  return (nome || 'desconhecido').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80);
}

// Nome com aspas simples quebra a sintaxe de busca do Drive.
function paraConsulta(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// Ids de pasta não mudam; guardar poupa duas chamadas por anexo.
const cacheDePastas = new Map();

async function filhoChamado(drive, paiId, nome, apenasPasta) {
  const q = [
    `'${paraConsulta(paiId)}' in parents`,
    `name = '${paraConsulta(nome)}'`,
    'trashed = false',
  ];
  if (apenasPasta) q.push(`mimeType = '${MIME_PASTA}'`);
  const r = await drive.files.list({
    q: q.join(' and '),
    fields: 'files(id, name, size, md5Checksum)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (r.data.files || [])[0] || null;
}

async function garantirPasta(drive, paiId, nome) {
  const chave = paiId + '/' + nome;
  if (cacheDePastas.has(chave)) return cacheDePastas.get(chave);
  let pasta = await filhoChamado(drive, paiId, nome, true);
  if (!pasta) {
    const r = await drive.files.create({
      requestBody: { name: nome, mimeType: MIME_PASTA, parents: [paiId] },
      fields: 'id',
      supportsAllDrives: true,
    });
    pasta = { id: r.data.id };
  }
  cacheDePastas.set(chave, pasta.id);
  return pasta.id;
}

// A raiz pode vir pronta por variável de ambiente (DRIVE_PASTA_ID). Vale a
// pena: além de poupar a busca, é o que permite trabalhar com permissão
// restrita, onde o robô conhece a pasta pelo id sem poder vasculhar o Drive.
let raizId = null;
async function pastaRaiz(drive) {
  if (raizId) return raizId;
  if (process.env.DRIVE_PASTA_ID) return (raizId = process.env.DRIVE_PASTA_ID);
  const achada = await filhoChamado(drive, 'root', PASTA_RAIZ, true);
  if (!achada) {
    throw new Error(
      `Não achei a pasta "${PASTA_RAIZ}" no Drive desta conta. ` +
      'Se ela estiver em outro lugar, informe o id dela em DRIVE_PASTA_ID.'
    );
  }
  return (raizId = achada.id);
}

async function pastaDoCliente(drive, mes, nomeCliente) {
  const raiz = await pastaRaiz(drive);
  const doMes = await garantirPasta(drive, raiz, mes);
  return garantirPasta(drive, doMes, sanitizar(nomeCliente));
}

// Mesmo conteúdo = mesmo md5. O Drive já calcula e devolve na listagem, então
// dá pra comparar sem baixar o arquivo de volta.
function mesmoConteudo(arquivo, buffer) {
  if (!arquivo) return false;
  if (arquivo.md5Checksum) return arquivo.md5Checksum === md5(buffer);
  return Number(arquivo.size) === buffer.length;   // Documento Google não tem md5
}

// Espelha salvarArquivo do disco: devolve null quando o anexo já está lá
// (releitura do mesmo e-mail), e nunca sobrescreve.
async function salvarArquivo(drive, pastaId, nome, buffer) {
  const r = await salvarArquivoComId(drive, pastaId, nome, buffer);
  return r.jaEstava ? null : r.nome;
}

// O mesmo, devolvendo também o id do arquivo no Drive (o novo, ou o que já
// estava lá com o mesmo conteúdo): { id, nome, jaEstava }. O Fiscal › Enviar
// guias guarda o id para abrir a guia depois pelo abrir-do-drive (04/11/2026).
async function salvarArquivoComId(drive, pastaId, nome, buffer) {
  const limpo = sanitizar(nome);
  const ponto = limpo.lastIndexOf('.');
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  const ext = ponto > 0 ? limpo.slice(ponto) : '';

  let candidato = limpo;
  let n = 1;
  for (;;) {
    const existente = await filhoChamado(drive, pastaId, candidato, false);
    if (!existente) break;
    if (mesmoConteudo(existente, buffer)) return { id: existente.id, nome: existente.name || candidato, jaEstava: true };
    candidato = base + ' (' + (++n) + ')' + ext;
  }

  const r = await drive.files.create({
    requestBody: { name: candidato, parents: [pastaId] },
    media: { body: Readable.from(buffer) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return { id: r.data.id, nome: r.data.name, jaEstava: false };
}

// A rotina de arquivamento lê a pasta inteira, em qualquer mês: o mesmo anexo
// gravado em dois meses vira documento em dobro no layout. Antes de gravar,
// procura o arquivo nas outras pastas de mês deste cliente. Devolve onde achou
// (ex.: "2026-08/FULANO LTDA") ou null.
async function copiaJaNaOrigem(drive, nomeCliente, nome, buffer) {
  const raiz = await pastaRaiz(drive);
  const meses = await drive.files.list({
    q: `'${paraConsulta(raiz)}' in parents and mimeType = '${MIME_PASTA}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const limpo = sanitizar(nome);
  const ponto = limpo.lastIndexOf('.');
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  const ext = ponto > 0 ? limpo.slice(ponto) : '';
  const daConta = md5(buffer);

  for (const mes of meses.data.files || []) {
    if (!/^\d{4}-\d{2}$/.test(mes.name)) continue;
    const doCliente = await filhoChamado(drive, mes.id, sanitizar(nomeCliente), true);
    if (!doCliente) continue;
    const arquivos = await drive.files.list({
      q: `'${paraConsulta(doCliente.id)}' in parents and trashed = false`,
      fields: 'files(id, name, size, md5Checksum)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const a of arquivos.data.files || []) {
      const mesmoNome = a.name === limpo || (a.name.startsWith(base + ' (') && a.name.endsWith(ext));
      if (!mesmoNome) continue;
      if (a.md5Checksum ? a.md5Checksum === daConta : Number(a.size) === buffer.length) {
        return mes.name + '/' + sanitizar(nomeCliente);
      }
    }
  }
  return null;
}

// Um caminho de pastas a partir da raiz do Meu Drive, criando o que faltar.
// Ex.: ['NILMA-PROTOCOLO-BACKUPS', 'banco'].
async function garantirCaminho(drive, partes) {
  let pai = 'root';
  for (const parte of partes) pai = await garantirPasta(drive, pai, parte);
  return pai;
}

// Tudo que está dentro de uma pasta do Drive, pelo nome (uma listagem por
// pasta, em vez de uma consulta por arquivo).
async function nomesNaPasta(drive, pastaId) {
  const nomes = new Map();
  let pageToken;
  do {
    const r = await drive.files.list({
      q: `'${paraConsulta(pastaId)}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    (r.data.files || []).forEach(f => nomes.set(f.name, f));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return nomes;
}


// ---- Envio em partes, retomável (upload resumable da API do Drive) ----
// Um pedido só com 334 MB estourava com "write EPIPE". Aqui o arquivo sobe em
// partes de 8 MB lidas do disco (a memória não cresce com o arquivo), e o
// endereço da sessão fica anotado num arquivo local: se a rede cair, ou o
// robô reiniciar, a próxima chamada pergunta ao Drive até onde chegou e
// continua dali. O Drive só cria o arquivo quando o último pedaço chega, então
// um envio pela metade nunca aparece como arquivo no Drive.
const LIMITE_PEDIDO_UNICO = 5 * 1024 * 1024;
const TAMANHO_PARTE = 8 * 1024 * 1024;   // múltiplo de 256 KB, como a API exige
const SESSOES_PADRAO = require('path').join(__dirname, 'backup-drive-sessoes.json');

function lerSessoes(arq) { try { return JSON.parse(require('fs').readFileSync(arq, 'utf8')) || {}; } catch (e) { return {}; } }
function gravarSessoes(arq, obj) { try { require('fs').writeFileSync(arq, JSON.stringify(obj)); } catch (e) { /* sem o arquivo só perde a retomada entre reinícios */ } }

// cliente: algo com .request({url, method, headers, data, validateStatus}) -> { status, headers, data }
// (o OAuth2Client do googleapis; nos testes, um falso)
async function enviarArquivoRetomavel(o) {
  const fs = require('fs');
  const cliente = o.cliente || getAuth('robo');
  const sessoesArq = o.sessoesArquivo || SESSOES_PADRAO;
  const parte = o.tamanhoParte || TAMANHO_PARTE;
  const tentativasPorParte = o.tentativasPorParte || 5;
  const espera = o.espera || (ms => new Promise(r => setTimeout(r, ms)));
  const total = fs.statSync(o.caminho).size;
  const chave = o.pastaId + '/' + o.nome + '/' + total + '/' + Math.floor(fs.statSync(o.caminho).mtimeMs);
  const aceita = s => (s >= 200 && s < 300) || s === 308 || s === 404;
  const pedir = req => cliente.request(Object.assign({ validateStatus: aceita }, req));

  async function abrirSessao() {
    const r = await pedir({
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',
      method: 'POST',
      headers: { 'X-Upload-Content-Length': String(total), 'Content-Type': 'application/json; charset=UTF-8' },
      data: { name: o.nome, parents: [o.pastaId] },
    });
    const uri = r.headers && (r.headers.location || r.headers.Location);
    if (!uri) throw new Error('o Drive não devolveu o endereço do envio retomável');
    const s = lerSessoes(sessoesArq); s[chave] = uri; gravarSessoes(sessoesArq, s);
    return uri;
  }
  // até onde o Drive já tem: -1 = sessão perdida, total = terminou
  async function ondeParou(uri) {
    const r = await pedir({ url: uri, method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': 'bytes */' + total } });
    if (r.status === 404) return -1;
    if (r.status >= 200 && r.status < 300) return total;
    const m = /bytes=0-(\d+)/.exec((r.headers && (r.headers.range || r.headers.Range)) || '');
    return m ? Number(m[1]) + 1 : 0;
  }

  let uri = lerSessoes(sessoesArq)[chave];
  let enviado = 0;
  if (uri) { enviado = await ondeParou(uri); if (enviado < 0) { uri = null; enviado = 0; } }
  if (!uri) uri = await abrirSessao();
  if (enviado >= total && total > 0) return { retomou: true, bytes: total };

  const fd = fs.openSync(o.caminho, 'r');
  try {
    while (enviado < total) {
      const n = Math.min(parte, total - enviado);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, enviado);
      let ok = false, ultimoErro;
      for (let t = 1; t <= tentativasPorParte && !ok; t++) {
        try {
          const r = await pedir({
            url: uri, method: 'PUT',
            headers: { 'Content-Length': String(n), 'Content-Range': 'bytes ' + enviado + '-' + (enviado + n - 1) + '/' + total },
            data: buf,
          });
          if (r.status === 404) { uri = await abrirSessao(); enviado = 0; }   // sessão expirou: recomeça este arquivo
          else if (r.status === 308) {
            const m = /bytes=0-(\d+)/.exec((r.headers && (r.headers.range || r.headers.Range)) || '');
            enviado = m ? Number(m[1]) + 1 : enviado;
          } else enviado = total;
          ok = true;
        } catch (err) {
          ultimoErro = err;
          await espera(Math.min(30000, 1000 * Math.pow(2, t)));
          try {
            const w = await ondeParou(uri);   // a parte pode ter chegado antes do erro
            if (w < 0) { uri = await abrirSessao(); enviado = 0; ok = true; }
            else if (w > enviado) { enviado = w; ok = true; }   // chegou: segue; senão tenta a mesma parte de novo
          } catch (e) { /* sem resposta ainda: tenta a mesma parte de novo */ }
        }
      }
      // sem sucesso: a sessão continua anotada e a próxima chamada retoma dali
      if (!ok) throw new Error('envio ao Drive parou em ' + enviado + '/' + total + ' bytes (' + (ultimoErro && ultimoErro.message || ultimoErro) + ')');
    }
  } finally { fs.closeSync(fd); }
  const s = lerSessoes(sessoesArq); delete s[chave]; gravarSessoes(sessoesArq, s);
  return { retomou: false, bytes: total };
}

// Copia pro Drive o que existe numa pasta do disco e ainda não existe lá,
// subpasta por subpasta. É como o backup chega ao Drive quando o robô roda na
// nuvem: ele grava no disco da máquina (como sempre gravou no G:) e esta
// função leva o que for novo. Arquivo que já está lá com o mesmo nome fica
// como está: nada é sobrescrito nem apagado.
async function espelharPasta(drive, pastaLocal, pastaId, resumo, enviarRetomavel) {
  enviarRetomavel = enviarRetomavel || ((l, p, n) => enviarArquivoRetomavel({ caminho: l, pastaId: p, nome: n }));
  resumo = resumo || { enviados: 0, jaEstavam: 0, bytes: 0 };
  const fs = require('fs');
  const path = require('path');
  const noDrive = await nomesNaPasta(drive, pastaId);
  for (const item of fs.readdirSync(pastaLocal, { withFileTypes: true })) {
    const local = path.join(pastaLocal, item.name);
    if (item.isDirectory()) {
      const sub = noDrive.get(item.name);
      const subId = sub && sub.mimeType === MIME_PASTA ? sub.id : await garantirPasta(drive, pastaId, item.name);
      await espelharPasta(drive, local, subId, resumo, enviarRetomavel);
      continue;
    }
    if (noDrive.has(item.name)) { resumo.jaEstavam++; continue; }
    const tamanho = fs.statSync(local).size;
    if (tamanho > LIMITE_PEDIDO_UNICO) {
      // arquivo grande (o retrato do banco passa de 300 MB): em partes, retomando de onde parou
      await enviarRetomavel(local, pastaId, item.name);
      resumo.enviados++;
      resumo.bytes += tamanho;
      continue;
    }
    const buffer = fs.readFileSync(local);
    await drive.files.create({
      requestBody: { name: item.name, parents: [pastaId] },
      media: { body: Readable.from(buffer) },
      fields: 'id',
      supportsAllDrives: true,
    });
    resumo.enviados++;
    resumo.bytes += buffer.length;
  }
  return resumo;
}

// Mesma conta, mesmo token do Gmail — ver gmail-client.js.
let drive = null;
function getDrive() {
  if (!drive) drive = google.drive({ version: 'v3', auth: getAuth('robo') });
  return drive;
}

module.exports = {
  PASTA_RAIZ, sanitizar, getDrive, pastaDoCliente, salvarArquivo, salvarArquivoComId, copiaJaNaOrigem, pastaRaiz, mesmoConteudo,
  garantirCaminho, garantirPasta, espelharPasta, enviarArquivoRetomavel,
};
