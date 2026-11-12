// Os espelhos dos clientes e do cadastro (12/11/2026, consumo do banco).
//
// O medidor das leituras mostrou os navegadores lendo os clientes (~400 documentos) e o cadastro (~230) inteiros várias
// vezes por pessoa por dia, sem o cache do navegador segurar: quase metade das leituras dos navegadores. Aqui o robô da
// nuvem ouve as duas coleções (lê tudo uma vez ao ligar; depois só o documento que muda) e mantém cada uma inteira num
// documento só, que as telas leem no lugar da coleção: 1 leitura em vez de centenas.
//
//   cadastro/_espelhos/plano/clientes   { em, vivoEm, n, docs: { id: dados } }   (ou partes: n, em clientes-1, clientes-2…)
//   cadastro/_espelhos/plano/cadastro   { em, vivoEm, n, docs: { id: dados } }
//
// Por que aí: a regra do Entregas deixa ler cadastro/{id}/plano/{doc} quem está no nads (membroNoNads, o mesmo grupo que
// lê o cadastro; os clientes, que qualquer membro lê, ficam mais fechados, não mais abertos). O "documento" _espelhos não
// existe: não aparece na lista do cadastro, nem para o robô nem para a tela.
//
// O espelho vai ao banco ~10 s depois da última mudança (uma rajada de mudanças vira uma gravação) e, sem mudança, a cada
// 6 h (vivoEm), para a tela saber que o robô está de pé: espelho sem vivoEm há mais de 12 h, a tela volta a ler a coleção.
// Documento passa de 1 MB: o espelho vai em partes (as telas juntam).
'use strict';

const CAMINHO = ['cadastro', '_espelhos', 'plano'];
const ESPERA_MS = 10 * 1000;
const VIVO_A_CADA_MS = 6 * 36e5;
const MAX_BYTES_POR_PARTE = 800 * 1024;

/** Divide os documentos em partes de até maxBytes (pelo tamanho do JSON). [{ id: dados }, ...] */
function partir(docs, maxBytes = MAX_BYTES_POR_PARTE) {
  const partes = [];
  let atual = {};
  let tamanho = 0;
  for (const [id, dados] of Object.entries(docs)) {
    const t = Buffer.byteLength(JSON.stringify(dados)) + id.length + 16;
    if (tamanho && tamanho + t > maxBytes) { partes.push(atual); atual = {}; tamanho = 0; }
    atual[id] = dados;
    tamanho += t;
  }
  partes.push(atual);
  return partes;
}

/**
 * Um espelho: ouve `colecao` e grava em cadastro/_espelhos/plano/{nome}. o: { db, log, ouvir (o do ouvinte.js), agora,
 * agendar, cancelar } (os três últimos só para o teste). Devolve { parar, gravarAgora }.
 */
function criarEspelho(colecao, nome, o) {
  const agora = o.agora || Date.now;
  const agendar = o.agendar || ((f, ms) => setTimeout(f, ms));
  const cancelar = o.cancelar || (t => clearTimeout(t));
  const base = o.db.collection(CAMINHO[0]).doc(CAMINHO[1]).collection(CAMINHO[2]);
  let docs = null;
  let assinaturaGravada = '';
  let gravadoEm = 0;
  let partesGravadas = 0;
  let relogio = null;

  async function gravar(forcar) {
    relogio = null;
    if (!docs) return;
    const assinatura = JSON.stringify(docs);
    if (!forcar && assinatura === assinaturaGravada) return;
    const em = new Date(agora()).toISOString();
    const n = Object.keys(docs).length;
    const partes = partir(docs);
    try {
      if (partes.length === 1) {
        await base.doc(nome).set({ em, vivoEm: em, n, docs: partes[0] });
      } else {
        for (let i = 0; i < partes.length; i++) await base.doc(nome + '-' + (i + 1)).set({ em, docs: partes[i] });
        await base.doc(nome).set({ em, vivoEm: em, n, partes: partes.length });
      }
      // partes que sobraram de um espelho maior
      for (let i = partes.length > 1 ? partes.length + 1 : 1; i <= partesGravadas; i++) await base.doc(nome + '-' + i).delete().catch(() => {});
      partesGravadas = partes.length > 1 ? partes.length : 0;
      assinaturaGravada = assinatura;
      gravadoEm = agora();
    } catch (err) { o.log('espelho de ' + colecao + ': não gravei -', err.message); }
  }

  const parar = o.ouvir('espelho de ' + colecao, () => o.db.collection(colecao), snap => {
    const novo = {};
    snap.docs.forEach(d => { novo[d.id] = d.data(); });
    docs = novo;
    if (relogio !== null) cancelar(relogio);
    relogio = agendar(() => gravar(false), ESPERA_MS);
  }, o.log);

  // sem mudança, a cada 6 h: o sinal de que o robô está de pé (a tela confia no espelho até 12 h sem ele)
  const vivo = setInterval(() => { if (docs && agora() - gravadoEm >= VIVO_A_CADA_MS) void gravar(true); }, 15 * 60 * 1000);
  if (vivo.unref) vivo.unref();

  return { parar() { clearInterval(vivo); if (relogio !== null) cancelar(relogio); parar(); }, gravarAgora: () => gravar(false) };
}

function iniciarEspelhos(db, log) {
  const { ouvir } = require('./ouvinte');
  const clientes = criarEspelho('clientes', 'clientes', { db, log, ouvir });
  const cadastro = criarEspelho('cadastro', 'cadastro', { db, log, ouvir });
  log('espelhos dos clientes e do cadastro ligados (cadastro/_espelhos/plano)');
  return () => { clientes.parar(); cadastro.parar(); };
}

module.exports = { iniciarEspelhos, criarEspelho, partir, CAMINHO, ESPERA_MS, VIVO_A_CADA_MS };
