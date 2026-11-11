// Backup completo do banco, fora do Firebase.
//
// Por que existe: o projeto esta no plano gratuito do Firebase, e tanto o
// backup agendado quanto a recuperacao a ponto no tempo do Firestore so
// existem no plano pago. Sem isso, um delete errado ou uma regra mal
// publicada apaga registro de entrega -- que e prova de entrega -- sem
// volta.
//
// REGRA DO DONO: protocolo e pra sempre. Este script nunca apaga nada.
//
// COMO ELE GUARDA (e por que assim):
// Medindo o primeiro backup, 96% do arquivo (12,06 de 12,57 MB) eram as
// assinaturas e fotos em base64; todo o resto -- as 172 entregas, os 320
// clientes, cargos, auditoria -- dava 0,37 MB. E imagem de entrega
// assinada nao muda nunca mais. Regravar tudo isso todo dia enchia o
// Drive em ~4,6 GB por ano sem guardar nada novo.
//
// Entao:
//   provas/AAAA-MM/{entregaId}_assinatura.png  -- gravada UMA vez, nunca
//   provas/AAAA-MM/{entregaId}_foto.jpg           reescrita, nunca apagada
//   banco-AAAA-MM-DD.json                       -- retrato do dia, leve
//
// Como imagem de verdade (nao base64 dentro de JSON), a prova abre em
// qualquer computador sem precisar deste script -- que e o que se espera
// de um documento que vale numa discussao com cliente. E ocupa 1/3 menos.
//
// Uso:  node backup-firestore.js [pasta-destino]
// Padrao: G:\Meu Drive\NILMA-PROTOCOLO-BACKUPS\banco
//
// So le o Firestore. Nao escreve nada la.
const fs = require('fs');
const path = require('path');
const { getDb } = require('./firestore-client');
const { FieldPath } = require('firebase-admin/firestore');

// BACKUP_PASTA: na nuvem não há G:, e o backup vai pro disco da máquina (ver backup-diario.js).
const DESTINO_PADRAO = process.env.BACKUP_PASTA || 'G:\\Meu Drive\\NILMA-PROTOCOLO-BACKUPS\\banco';
const CAMPOS_DE_PROVA = ['assinatura', 'foto'];

// O que fica fora do backup (10/11/2026, consumo do banco: o backup lia 34.721 documentos por dia e gravava um retrato de
// 384 MB). Só o que o robô refaz sozinho ou que é registro passageiro, nunca dado de cliente nem prova:
//   roboAtividade      o registro dos robôs (já se apaga em 7 dias)
//   robosRegistros     o espelho das últimas linhas do log de cada robô
//   driveIndice        o mapa do Drive (o robô da nuvem refaz toda madrugada; os arquivos estão no próprio Drive)
//   siegNotas          os .zip de XMLs em pedaços para baixar (os XMLs estão no Drive do cliente)
//   siegContagens      as contagens do SIEG (refeitas na contagem da madrugada)
//   uso                os contadores do Uso do sistema
//   aberturasDrive     as cópias de arquivo do Drive pedidas pela tela (duram 30 min)
//   pedidosMapaDrive   os pedidos de releitura do mapa do Drive (duram 1 dia)
//   pedidosSieg/*/xmls os XMLs que o cliente subiu para o robô (vão para o Drive do cliente)
const COLECOES_FORA = new Set(['roboAtividade', 'robosRegistros', 'driveIndice', 'siegNotas', 'siegContagens', 'uso', 'aberturasDrive', 'pedidosMapaDrive']);
const SUBCOLECOES_FORA = new Set(['pedidosSieg/xmls']);
/** A coleção (de cima, ou a subcoleção dentro dela: colecaoDeCima/sub) entra no backup? */
function entraNoBackup(colecao, sub) {
  return sub ? !SUBCOLECOES_FORA.has(colecao + '/' + sub) : !COLECOES_FORA.has(colecao);
}

// Converte tipos do Firestore (Timestamp, GeoPoint, referencia) em algo que
// sobrevive ao JSON e ainda diz o que era, pra restauracao nao virar
// adivinhacao.
function serializar(valor) {
  if (valor === null || valor === undefined) return null;
  // bytes (os anexos em pedacos do nads, desde 27/10/2026) viram base64: tratados como objeto, cada byte virava uma
  // chave (900 mil por pedaco) e o backup estourava a memoria ("JavaScript heap out of memory", 29/10/2026)
  if (Buffer.isBuffer(valor) || valor instanceof Uint8Array) return { __tipo: 'bytes', base64: Buffer.from(valor).toString('base64') };
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === 'object') {
    if (typeof valor.toDate === 'function') return { __tipo: 'timestamp', valor: valor.toDate().toISOString() };
    if (typeof valor.latitude === 'number' && typeof valor.longitude === 'number') {
      return { __tipo: 'geopoint', lat: valor.latitude, lng: valor.longitude };
    }
    if (valor._path && typeof valor.path === 'string') return { __tipo: 'referencia', caminho: valor.path };
    const saida = {};
    Object.keys(valor).forEach(k => { saida[k] = serializar(valor[k]); });
    return saida;
  }
  return valor;
}

// "data:image/png;base64,iVBORw0..." -> { ext, bytes }. Tambem aceita
// base64 solto, sem cabecalho.
function decodificarImagem(valor) {
  if (typeof valor !== 'string' || !valor) return null;
  const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(valor);
  const ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'bin';
  const base64 = m ? m[2] : valor;
  try {
    const bytes = Buffer.from(base64, 'base64');
    return bytes.length ? { ext: ext, bytes: bytes } : null;
  } catch (e) {
    return null;
  }
}

// Guarda as provas de uma entrega em arquivo proprio. Se ja existe, nao
// reescreve: a imagem e imutavel, e regravar so gastaria espaco e tempo.
function salvarProvas(destino, entregaId, competencia, anexos, resumo) {
  const salvos = [];
  Object.keys(anexos || {}).forEach(function (nomeDoc) {
    const dados = (anexos[nomeDoc] && anexos[nomeDoc].dados) || {};
    CAMPOS_DE_PROVA.forEach(function (campo) {
      const img = decodificarImagem(dados[campo]);
      if (!img) return;
      const pasta = path.join(destino, 'provas', competencia || 'sem-competencia');
      const arquivo = entregaId + '_' + campo + '.' + img.ext;
      const caminho = path.join(pasta, arquivo);
      const relativo = path.join('provas', competencia || 'sem-competencia', arquivo);
      salvos.push(relativo);
      if (fs.existsSync(caminho)) { resumo.jaExistiam++; return; }
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(caminho, img.bytes);
      resumo.novas++;
      resumo.bytesNovos += img.bytes.length;
    });
  });
  return salvos;
}

// Cada documento, e as subcolecoes dele, vai direto para o arquivo, em paginas de 100: nada de colecao inteira na
// memoria (a maquina da nuvem e uma e2-micro, 1 GB). O get() da colecao inteira estourava a memoria ("JavaScript heap
// out of memory", 02/11/2026, sem backup desde 26/10); o pior era robo/arquivadorNovo/dias (721 dias do arquivador,
// montados num registro so). Mesmas leituras e o mesmo JSON de antes: { "id": { dados, provas?, subcolecoes? } }.
const POR_PAGINA = 100;
async function* paginas(ref) {
  let ultimo = null;
  for (;;) {
    let q = ref.orderBy(FieldPath.documentId()).limit(POR_PAGINA);
    if (ultimo) q = q.startAfter(ultimo);
    const pagina = (await q.get()).docs;
    if (!pagina.length) return;
    yield pagina;
    if (pagina.length < POR_PAGINA) return;
    ultimo = pagina[pagina.length - 1];
  }
}

// os anexos de uma entrega sao poucos e viram arquivo de prova: esses ainda vem inteiros
async function lerAnexos(ref, contador) {
  const docs = {};
  for (const doc of (await ref.get()).docs) { contador.docs++; docs[doc.id] = { dados: serializar(doc.data()) }; }
  return docs;
}

// As subcoleções pelo mapa (11/11/2026, consumo do banco): perguntar a cada documento "que subcoleções você tem?"
// (listCollections) custa uma leitura por documento, e dobrava o backup (31.020 documentos, ~65 mil leituras). Agora a
// pergunta vai a todos os documentos só uma vez por semana (a descoberta), que grava o mapa (subcolecoes.json, junto dos
// backups): de cada coleção, os nomes das subcoleções que algum documento dela tem. Nos outros dias, cada documento das
// coleções do mapa lê direto as subcoleções conhecidas (a vazia custa 1 leitura e não entra no retrato); as coleções sem
// subcoleção no mapa não perguntam nada. Uma subcoleção de tipo novo entra na descoberta seguinte (no máximo 7 dias).
const DESCOBRIR_A_CADA_MS = 7 * 24 * 36e5;
const MAPA_DAS_SUBCOLECOES = 'subcolecoes.json';

/** O mapa de antes vale (existe, tem menos de 7 dias e não pediram --descobrir)? */
function mapaValido(mapa, agora, forcarDescoberta) {
  return !forcarDescoberta && !!mapa && typeof mapa.porColecao === 'object' && !!mapa.porColecao
    && agora - Date.parse(mapa.descobertoEm || '') < DESCOBRIR_A_CADA_MS;
}

/** As subcoleções de um documento: na descoberta, as que o banco diz (e anota no mapa novo); senão, as do mapa. */
async function subcolecoesDo(doc, ctx, padrao) {
  if (ctx.descobrindo) {
    const subs = await doc.ref.listCollections();
    const nomes = ctx.mapaNovo[padrao] || (ctx.mapaNovo[padrao] = []);
    for (const sub of subs) if (!nomes.includes(sub.id)) nomes.push(sub.id);
    return subs;
  }
  return ((ctx.mapa && ctx.mapa[padrao]) || []).map(nome => doc.ref.collection(nome));
}

// abrir(): escreve o cabeçalho da coleção antes do primeiro documento (a subcoleção vazia não aparece no retrato)
async function escreverColecao(ref, ctx, ehEntregas, w, recuo, deCima, padraoDaColecao, abrir) {
  const colecaoDeCima = deCima || ref.id;
  const padrao = padraoDaColecao || ref.id;
  let n = 0;
  for await (const pagina of paginas(ref)) {
    for (const doc of pagina) {
      if (!n && abrir) abrir();
      ctx.contador.docs++;
      const dados = serializar(doc.data());
      w((n++ ? ',' : '') + '\n' + recuo + JSON.stringify(doc.id) + ': {"dados":' + JSON.stringify(dados));
      let subs = (await subcolecoesDo(doc, ctx, padrao)).filter(s => entraNoBackup(colecaoDeCima, s.id));
      const anexos = ehEntregas && subs.find(s => s.id === 'anexos');
      if (anexos) {
        // as imagens saem do JSON e viram arquivo; fica so o caminho delas
        subs = subs.filter(s => s !== anexos);
        const lidos = await lerAnexos(anexos, ctx.contador);
        if (Object.keys(lidos).length) w(',"provas":' + JSON.stringify(salvarProvas(ctx.destino, doc.id, dados.competencia, lidos, ctx.resumoProvas)));
      }
      let abriuSubs = false;
      let i = 0;
      for (const sub of subs) {
        const abrirSub = () => {
          if (!abriuSubs) { w(',"subcolecoes":{'); abriuSubs = true; }
          w((i++ ? ',' : '') + JSON.stringify(sub.id) + ':{');
        };
        if (await escreverColecao(sub, ctx, false, w, recuo + ' ', colecaoDeCima, padrao + '/' + sub.id, abrirSub)) w('}');
      }
      if (abriuSubs) w('}');
      w('}');
    }
  }
  return n;
}

async function main() {
  const destino = process.argv[2] || DESTINO_PADRAO;
  const db = getDb('entregas-2e5e2');
  const contador = { docs: 0 };
  const resumoProvas = { novas: 0, jaExistiam: 0, bytesNovos: 0 };

  fs.mkdirSync(destino, { recursive: true });

  // Trava contra rodar duas vezes no mesmo dia. Nao e zelo com disco: no
  // plano gratuito sao 50 mil leituras por dia pro projeto INTEIRO, e o
  // app sozinho ja usa a maior parte disso. Um backup gasta ~1000. Rodei
  // duas vezes seguidas uma vez e ajudei a estourar a cota do dia, o que
  // derruba o app pra equipe toda ate a meia-noite do Pacifico. Pra
  // refazer de proposito: apagar o arquivo do dia, ou passar --forcar.
  const nome = 'banco-' + new Date().toISOString().slice(0, 10) + '.json';
  const caminho = path.join(destino, nome);
  if (fs.existsSync(caminho) && !process.argv.includes('--forcar')) {
    console.log('O backup de hoje ja existe:', caminho);
    console.log('Nao vou ler o banco de novo pra nao gastar cota. Use --forcar se for mesmo pra refazer.');
    return;
  }

  const colecoes = (await db.listCollections()).filter(c => entraNoBackup(c.id));
  // o mapa das subcoleções: o de antes, se ainda vale; senão, esta vez descobre (e grava o novo no fim)
  const arqMapa = path.join(destino, MAPA_DAS_SUBCOLECOES);
  let mapaAntes = null;
  try { mapaAntes = JSON.parse(fs.readFileSync(arqMapa, 'utf8')); } catch (e) { /* sem mapa: descobre */ }
  const descobrindo = !mapaValido(mapaAntes, Date.now(), process.argv.includes('--descobrir'));
  const mapaNovo = {};
  const ctxBase = { contador, destino, resumoProvas, descobrindo, mapa: descobrindo ? null : mapaAntes.porColecao, mapaNovo };
  // o mesmo JSON de antes ({ projeto, feitoEm, colecoes: { id: { docId: registro } }, totalDeDocumentos }), escrito aos
  // poucos num arquivo temporario: so com tudo lido ele vira o do dia (um backup pela metade nao conta como feito)
  const temporario = caminho + '.parcial';
  const fd = fs.openSync(temporario, 'w');
  const w = t => fs.writeSync(fd, t);
  try {
    w('{\n "projeto": "entregas-2e5e2",\n "feitoEm": ' + JSON.stringify(new Date().toISOString()) + ',\n "foraDoBackup": ' + JSON.stringify([...COLECOES_FORA, ...SUBCOLECOES_FORA]) + ',\n "colecoes": {');
    let primeiraCol = true;
    for (const col of colecoes) {
      process.stderr.write('lendo ' + col.id + '... ');
      w((primeiraCol ? '' : ',') + '\n  ' + JSON.stringify(col.id) + ': {');
      primeiraCol = false;
      const n = await escreverColecao(col, ctxBase, col.id === 'entregas', w, '   ');
      w('\n  }');
      process.stderr.write(n + ' documentos\n');
    }
    w('\n },\n "totalDeDocumentos": ' + contador.docs + '\n}\n');
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporario, caminho);
  if (descobrindo) fs.writeFileSync(arqMapa, JSON.stringify({ descobertoEm: new Date().toISOString(), porColecao: mapaNovo }, null, 1));

  const kb = (fs.statSync(caminho).size / 1024).toFixed(0);
  console.log('OK:', caminho);
  console.log('colecoes:', colecoes.length, '| documentos:', contador.docs, '| retrato do dia:', kb, 'KB', '| subcolecoes:', descobrindo ? 'descobertas de documento em documento (semanal)' : 'pelo mapa de ' + String(mapaAntes.descobertoEm).slice(0, 10));
  console.log('provas: ' + resumoProvas.novas + ' novas (' + (resumoProvas.bytesNovos / 1024 / 1024).toFixed(2) + ' MB), '
    + resumoProvas.jaExistiam + ' ja guardadas de antes');
}

if (require.main === module) main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });

module.exports = { entraNoBackup, COLECOES_FORA, SUBCOLECOES_FORA, escreverColecao, mapaValido, DESCOBRIR_A_CADA_MS };
