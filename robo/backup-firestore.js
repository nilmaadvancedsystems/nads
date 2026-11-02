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

// BACKUP_PASTA: na nuvem não há G:, e o backup vai pro disco da máquina (ver backup-diario.js).
const DESTINO_PADRAO = process.env.BACKUP_PASTA || 'G:\\Meu Drive\\NILMA-PROTOCOLO-BACKUPS\\banco';
const CAMPOS_DE_PROVA = ['assinatura', 'foto'];

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

// escrever(id, registro): cada documento vai direto para o arquivo, sem guardar a colecao inteira na memoria (a
// maquina da nuvem e uma e2-micro, 1 GB); sem ele, a colecao volta inteira (as subcolecoes de um documento)
async function lerColecao(ref, contador, destino, resumoProvas, ehEntregas, escrever) {
  const snap = await ref.get();
  const docs = {};
  for (const doc of snap.docs) {
    contador.docs++;
    const dados = serializar(doc.data());
    const registro = { dados: dados };

    const subs = await doc.ref.listCollections();
    if (subs.length) {
      const subcolecoes = {};
      for (const sub of subs) {
        subcolecoes[sub.id] = await lerColecao(sub, contador, destino, resumoProvas, false);
      }
      if (ehEntregas && subcolecoes.anexos) {
        // as imagens saem do JSON e viram arquivo; fica so o caminho delas
        registro.provas = salvarProvas(destino, doc.id, dados.competencia, subcolecoes.anexos, resumoProvas);
        delete subcolecoes.anexos;
      }
      if (Object.keys(subcolecoes).length) registro.subcolecoes = subcolecoes;
    }
    if (escrever) escrever(doc.id, registro); else docs[doc.id] = registro;
  }
  return escrever ? snap.size : docs;
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

  const colecoes = await db.listCollections();
  // o mesmo JSON de antes ({ projeto, feitoEm, colecoes: { id: { docId: registro } }, totalDeDocumentos }), escrito aos
  // poucos num arquivo temporario: so com tudo lido ele vira o do dia (um backup pela metade nao conta como feito)
  const temporario = caminho + '.parcial';
  const fd = fs.openSync(temporario, 'w');
  const w = t => fs.writeSync(fd, t);
  try {
    w('{\n "projeto": "entregas-2e5e2",\n "feitoEm": ' + JSON.stringify(new Date().toISOString()) + ',\n "colecoes": {');
    let primeiraCol = true;
    for (const col of colecoes) {
      process.stderr.write('lendo ' + col.id + '... ');
      w((primeiraCol ? '' : ',') + '\n  ' + JSON.stringify(col.id) + ': {');
      primeiraCol = false;
      let primeiroDoc = true;
      const n = await lerColecao(col, contador, destino, resumoProvas, col.id === 'entregas', (id, registro) => {
        w((primeiroDoc ? '' : ',') + '\n   ' + JSON.stringify(id) + ': ' + JSON.stringify(registro));
        primeiroDoc = false;
      });
      w('\n  }');
      process.stderr.write(n + ' documentos\n');
    }
    w('\n },\n "totalDeDocumentos": ' + contador.docs + '\n}\n');
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporario, caminho);

  const kb = (fs.statSync(caminho).size / 1024).toFixed(0);
  console.log('OK:', caminho);
  console.log('colecoes:', colecoes.length, '| documentos:', contador.docs, '| retrato do dia:', kb, 'KB');
  console.log('provas: ' + resumoProvas.novas + ' novas (' + (resumoProvas.bytesNovos / 1024 / 1024).toFixed(2) + ' MB), '
    + resumoProvas.jaExistiam + ' ja guardadas de antes');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
