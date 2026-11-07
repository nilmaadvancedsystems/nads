// Lista de clientes guardada no PC do robô, pra não reler o cadastro inteiro a
// cada leitura do Gmail.
//
// O robô roda de 2 em 2 horas e lia os ~320 clientes toda vez: perto de 4 mil
// leituras por dia, uns 8% do limite gratuito do banco, pra um cadastro que
// quase não muda. O vigia fica ligado o dia todo, então ele mantém um ouvinte
// (que só cobra o que MUDA) e grava a lista num arquivo local. A leitura do
// Gmail usa o arquivo quando ele está fresco; se o vigia não estiver rodando,
// lê do banco como sempre.
//
// O arquivo tem dado de cliente: fica fora do git (.gitignore).
const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, 'clientes-cache.json');
const VALIDADE_MS = 20 * 60 * 1000;   // o vigia regrava a cada 10 min enquanto o ouvinte está vivo

// formato que o resto do robô espera: forEach(d => d.id, d.data())
function comoSnap(lista) {
  return { size: lista.length, forEach: fn => lista.forEach(c => fn({ id: c.id, data: () => c.dados })) };
}

function lerDoArquivo(agora) {
  try {
    const j = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    if (!j || !Array.isArray(j.clientes) || !j.em) return null;
    if ((agora || Date.now()) - new Date(j.em).getTime() > VALIDADE_MS) return null;
    return j.clientes;
  } catch (e) { return null; }
}

// Sem o arquivo do vigia (no NILMA-SERVER ele não existe: o vigia roda na nuvem), a leitura do banco vale 10 min neste
// processo (07/11/2026: o SIEG relia os ~400 clientes a cada pedido, duas vezes no "Baixar XMLs").
const MEMORIA_VALE_MS = 10 * 60 * 1000;
let memoria = { db: null, em: 0, snap: null };

// Clientes ativos: do arquivo se estiver fresco, senão do banco (guardado em memória por MEMORIA_VALE_MS).
async function clientesAtivos(db, log) {
  const doArquivo = lerDoArquivo();
  if (doArquivo) { if (log) log('clientes: ' + doArquivo.length + ' do arquivo local (sem ler o banco)'); return comoSnap(doArquivo); }
  if (memoria.snap && memoria.db === db && Date.now() - memoria.em < MEMORIA_VALE_MS) return memoria.snap;
  const snap = await db.collection('clientes').where('ativo', '==', true).get();
  memoria = { db, em: Date.now(), snap };
  return snap;
}

// No vigia: mantém o arquivo em dia.
function manterArquivo(db, log) {
  let lista = null;
  const gravar = () => {
    if (!lista) return;
    try { fs.writeFileSync(ARQUIVO + '.tmp', JSON.stringify({ em: new Date().toISOString(), clientes: lista })); fs.renameSync(ARQUIVO + '.tmp', ARQUIVO); }
    catch (e) { log('clientes: não consegui gravar o arquivo local -', e.message); }
  };
  require('./ouvinte').ouvir('clientes', () => {
    // enquanto o ouvinte não voltar não há garantia de que a lista está em dia:
    // para de renovar e o arquivo vence sozinho em 20 minutos
    lista = null;
    return db.collection('clientes').where('ativo', '==', true);
  }, snap => {
    lista = snap.docs.map(d => ({ id: d.id, dados: JSON.parse(JSON.stringify(d.data())) }));
    gravar();
  }, log);
  setInterval(gravar, 10 * 60 * 1000);
  log('lista de clientes mantida em arquivo local (a leitura do Gmail deixa de reler o cadastro)');
}

module.exports = { clientesAtivos, manterArquivo, lerDoArquivo, comoSnap, ARQUIVO, VALIDADE_MS, MEMORIA_VALE_MS };
