// As guias do Fiscal já arquivadas no Drive viram envio sem subir de novo (plano do Acessórias, 17/11/2026, ficha
// E15-lote-a-partir-da-pasta; frase do dono: "Seguir"). Roda no robô da nuvem (drive-indice.js, com USAR_DRIVE_API=1),
// no molde do DP › Envios (envios-do-dp.js):
//
//   1. a lista: a cada releitura da pasta de um cliente, as guias do Fiscal de cada mês vão para fiscalArquivos/{AAAA-MM}
//      (clientes.<código>: { arquivos: [{ i, n, c, s }], em }), o mesmo formato do dpArquivos. São guia do Fiscal os PDFs
//      nas pastas de guia da árvore do Fiscal do arquivador (FISCAL/<regime>/<DAS|DARF|DAE|DAM>, os nomes da ARVORE de
//      arquivador-regras.js) com o nome que o arquivador dá: "MM-AAAA.pdf" (o DAS) ou "MM-AAAA - DARF INSS - VALOR … .pdf".
//      O mês é o do nome (a competência da apuração). As declarações do PGDAS-D, na mesma pasta do DAS, ficam de fora.
//   2. o envio: a tela (Fiscal › Enviar guias › Já na pasta) cria o lote do Fiscal com os arquivos { driveId, origem:
//      { codigo, competencia } } em vez dos pedaços. O lote lê e dispara como sempre (lote-fiscal.js); o PDF vem do Drive
//      só se o id estiver nesta lista, daquele cliente e daquele mês (bufferDoDrive): nunca um id qualquer do Drive.
// Nada sai sem alguém revisar e disparar (o envio direto arriscaria mandar a guia de uma empresa para outra).
const { FieldValue } = require('firebase-admin/firestore');
const R = require('./arquivador-regras');

const COLECAO = 'fiscalArquivos';
// um cliente com mais que isso num mês é pasta bagunçada: a lista fica nas primeiras (o documento tem teto de 1 MB)
const MAX_ARQUIVOS = 40;
const GUIAS = ['DAS', 'DARF', 'DAE', 'DAM'];

// ---------- funções puras (testadas sem rede) ----------

/** As pastas de guia de cada regime, pela chave do nome (sem acento, maiúsculas): Map(regime -> Set(pasta)). */
function pastasDeGuia(chaveDeNome) {
  const m = new Map();
  for (const [regime, arv] of Object.entries(R.ARVORE)) m.set(chaveDeNome(regime), new Set(GUIAS.filter(g => arv[g]).map(g => chaveDeNome(arv[g]))));
  return m;
}

/** O mês da guia pelo nome do arquivo ("10-2026.pdf", "10-2026 - DARF INSS - …"): 'AAAA-MM', ou null. */
function competenciaDoNome(nome) {
  const n = String(nome || '').trim();
  if (!/\.pdf$/i.test(n) || /PGDAS/i.test(n)) return null;
  const m = /^(0[1-9]|1[0-2])-(20\d{2})(\.pdf$|\s+-\s+)/i.exec(n);
  return m ? m[2] + '-' + m[1] : null;
}

/**
 * As guias do Fiscal na pasta de um cliente, por mês: Map('2026-10' -> [{ i, n, c, s }]); c é a pasta onde está
 * ("FISCAL/SIMPLES NACIONAL/16. DARF"), s o tamanho. Só arquivo de verdade, direto na pasta de guia do regime.
 */
function guiasDoFiscalNaPasta(itens, raizId, caminhos, chaveDeNome) {
  const cam = caminhos(itens, raizId);
  const pastas = pastasDeGuia(chaveDeNome);
  const porMes = new Map();
  itens.forEach(it => {
    if (it.t !== 'f') return;
    const original = cam.get(it.i);
    if (!original || original.length !== 4) return;   // FISCAL / <regime> / <pasta da guia> / <arquivo>
    const [setor, regime, pasta] = original.map(chaveDeNome);
    if (setor !== 'FISCAL' || !(pastas.get(regime) || new Set()).has(pasta)) return;
    const comp = competenciaDoNome(it.n);
    if (!comp) return;
    if (!porMes.has(comp)) porMes.set(comp, []);
    porMes.get(comp).push({ i: it.i, n: it.n, c: original.slice(0, -1).join('/'), s: it.s || 0 });
  });
  porMes.forEach((lista, comp) => porMes.set(comp, lista.sort((a, b) => a.c.localeCompare(b.c, 'pt-BR') || a.n.localeCompare(b.n, 'pt-BR')).slice(0, MAX_ARQUIVOS)));
  return porMes;
}

/** O id do Drive está na lista do cliente naquele mês? (a trava: nunca um id qualquer) */
function idNaLista(docDoMes, codigo, driveId) {
  const cli = docDoMes && docDoMes.clientes && docDoMes.clientes[String(codigo)];
  return !!cli && Array.isArray(cli.arquivos) && cli.arquivos.some(a => a && a.i === driveId);
}

// ---------- a lista no banco ----------

// o que já está em fiscalArquivos, por mês: Map(código -> assinatura), lido uma vez por mês
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
// os três últimos meses sempre são conferidos: a guia que saiu da pasta sai da lista
function mesesRecentes(agora) {
  const r = [];
  for (let k = 0; k < 3; k++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - k, 1));
    r.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
  }
  return r;
}

/** Grava a lista do cliente em cada mês que mudou (só os três últimos meses e os que a pasta trouxe). Devolve quantos. */
async function gravarGuiasDoFiscal(db, codigo, porMes) {
  if (!codigo) return 0;
  const recentes = mesesRecentes(new Date());
  const meses = new Set([...[...porMes.keys()].filter(c => c >= recentes[recentes.length - 1]), ...recentes]);
  let gravados = 0;
  for (const comp of meses) {
    const antes = await doMes(db, comp);
    const lista = porMes.get(comp) || [];
    const agora = JSON.stringify(lista);
    if ((antes.get(String(codigo)) || '[]') === agora) continue;
    await db.collection(COLECAO).doc(comp).set({ clientes: { [codigo]: lista.length ? { arquivos: lista, em: new Date().toISOString() } : FieldValue.delete() }, atualizadoEm: new Date().toISOString() }, { merge: true });
    if (lista.length) antes.set(String(codigo), agora); else antes.delete(String(codigo));
    gravados++;
  }
  return gravados;
}

// ---------- o PDF pelo Drive (o lote do Fiscal) ----------

/**
 * O PDF do arquivo do lote que veio da pasta ({ driveId, origem: { codigo, competencia } }): confere que o id está na
 * lista do mês daquele cliente e baixa pela API do Drive (só leitura). Joga erro se não estiver.
 */
async function bufferDoDrive(db, getDrive, a) {
  const o = (a && a.origem) || {};
  const comp = String(o.competencia || '');
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(comp) || !o.codigo || typeof a.driveId !== 'string' || !a.driveId) throw new Error('a guia da pasta veio sem o cliente, o mês ou o id do Drive');
  const s = await db.collection(COLECAO).doc(comp).get();
  if (!idNaLista(s.exists ? s.data() : null, o.codigo, a.driveId)) throw new Error('a guia não está na lista do Fiscal do cliente ' + o.codigo + ' em ' + comp.slice(5) + '/' + comp.slice(0, 4));
  if (typeof getDrive !== 'function') throw new Error('o robô está sem o Drive');
  const r = await getDrive().files.get({ fileId: a.driveId, alt: 'media' }, { responseType: 'arraybuffer', timeout: 120000 });
  return Buffer.from(r.data);
}

module.exports = { COLECAO, MAX_ARQUIVOS, pastasDeGuia, competenciaDoNome, guiasDoFiscalNaPasta, idNaLista, gravarGuiasDoFiscal, bufferDoDrive };
