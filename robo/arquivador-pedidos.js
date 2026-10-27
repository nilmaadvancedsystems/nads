// Os pedidos do site do admin ao arquivador do PC (Admin › Arquivador › Para resolver, 23/10/2026; Vitor: "coloca um botão
// para abrir o arquivo direto daqui e selecionar para onde vai também").
//
//   pedidosArquivador/{id}   o admin cria (só ele: firestore.rules) { tipo, rel, hash, codigo?, tipoDoc?, competencia?,
//                            pedidoPor, pedidoPorUid, criadoEm (a hora do servidor), status: 'pendente' }:
//     abrir       o robô confere o arquivo e grava o conteúdo em partes/{n} (base64, até ~700 KB cada) → status 'pronto'
//                 com { nome, mime, tamanho, partes }; o site junta e mostra. Até LIMITE_ABRIR.
//     previa      o destino que ficaria (as mesmas regras, em simulação: nada muda) → 'pronto' com a resposta.
//     arquivar    pelo MESMO executor (arquivador-novo.executar em PRODUCAO, com a decisão do admin): copia, confere o
//                 hash, nunca sobrescreve, manifesto com decidido_por, o original para a quarentena → 'feito' ou 'erro'.
//     descartar   para a quarentena (nunca apagado), com a linha no manifesto → 'feito' ou 'erro'.
//   O robô confere sempre: o caminho fica dentro da pasta Claudio Secretario (em NÃO IDENTIFICADOS ou na origem), o
//   arquivo existe, e o hash do pedido é o da lista (o do caminho em NÃO IDENTIFICADOS) ou o do conteúdo.
//   Quem arquiva ou descarta espera a volta do arquivador terminar (a mesma trava: nunca dois mexendo na pasta).
//   Depois de ~30 min o robô apaga o pedido e as partes.
//
//   robo/arquivadorNovoCadastro   os clientes do cadastro do arquivador (código, nome, se a pasta existe) e os tipos do
//                                 formulário "Arquivar em…", regravado só quando muda.
//
// Regra deste módulo: NUNCA derrubar o arquivador. Cada pedido engole o próprio erro e responde "erro" com o motivo.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('./arquivador-manual');

const NAO_IDENTIFICADOS = 'NÃO IDENTIFICADOS';
const LIMITE_ABRIR = 15 * 1024 * 1024;
const BYTES_POR_PARTE = 512 * 1024;          // em base64: ~683 KB por documento
const VIDA_MS = 30 * 60 * 1000;
const LIMPAR_A_CADA_MS = 5 * 60 * 1000;
// grupoPrevia / grupo (23/10/2026, a migração: "Para resolver" em grupos pela causa e pela pasta de origem): o mesmo
// cliente e tipo para o GRUPO inteiro; a competência de cada arquivo pelo nome ou pelas pastas de origem (ou a do pedido)
const TIPOS = ['abrir', 'previa', 'arquivar', 'descartar', 'grupoPrevia', 'grupo'];
const EXEMPLOS_DA_PREVIA = 3;
const MIME = { pdf: 'application/pdf', xml: 'text/xml', txt: 'text/plain', ofx: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', zip: 'application/zip' };

const sha1 = t => crypto.createHash('sha1').update(t).digest('hex');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const corta = (t, n) => { const s = String(t == null ? '' : t); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// ---------------------------------------------------------------------------------------------------------------------
// puras (teste-arquivador-pedidos.js)
// ---------------------------------------------------------------------------------------------------------------------
/**
 * O caminho do pedido, conferido: relativo à origem, sem "..", dentro da pasta. Devolve { rel, abs, ni (o caminho dentro
 * de NÃO IDENTIFICADOS, ou null) } ou { erro }.
 */
function caminhoDoPedido(origem, rel) {
  const r = String(rel || '').replace(/\//g, '\\').replace(/^\\+/, '').trim();
  if (!r || r.length > 400) return { erro: 'caminho vazio ou comprido demais' };
  if (/^[a-z]:/i.test(r) || r.split('\\').some(p => p === '..' || p === '.')) return { erro: 'caminho fora da pasta Claudio Secretario' };
  const abs = path.win32.join(origem, r);
  const dentro = path.win32.relative(origem, abs);
  if (!dentro || dentro.startsWith('..') || path.win32.isAbsolute(dentro)) return { erro: 'caminho fora da pasta Claudio Secretario' };
  const partes = dentro.split('\\');
  const ni = partes[0].toUpperCase() === NAO_IDENTIFICADOS ? partes.slice(1).join('\\') : null;
  return { rel: dentro, abs, ni };
}

/** O hash do pedido confere? O da lista (sha1 do caminho dentro de NÃO IDENTIFICADOS) ou o sha256 do conteúdo. */
function hashConfere(pedidoHash, ni, buffer) {
  const h = String(pedidoHash || '').toLowerCase();
  if (!h) return false;
  if (ni != null && h === sha1(ni)) return true;
  return !!buffer && h === sha256(buffer);
}

/** O conteúdo em partes de até BYTES_POR_PARTE (base64). */
function emPartes(buffer, tamanho) {
  const t = tamanho || BYTES_POR_PARTE;
  const out = [];
  for (let i = 0; i < buffer.length; i += t) out.push(buffer.subarray(i, i + t).toString('base64'));
  return out.length ? out : [''];
}

const mimeDe = nome => MIME[((/\.([a-z0-9]+)$/i.exec(nome || '') || [])[1] || '').toLowerCase()] || 'application/octet-stream';

/** A escolha do admin para a decisão manual (arquivar, prévia, descartar). */
/** A competência de um arquivo do grupo: a do pedido, senão o nome do arquivo, senão as pastas de origem ("AAAA-MM" ou "AAAA"). */
function competenciaDoArquivo(pedida, rel) {
  if (pedida) return String(pedida);
  const R = require('./arquivador-regras');
  const nome = path.win32.basename(String(rel || ''));
  const c = R.competenciaDoNome(nome) || R.anoDaPasta(rel);
  return c ? c.ano + (c.mes ? '-' + String(c.mes).padStart(2, '0') : '') : null;
}
function escolhaDoPedido(p) {
  if (p.tipo === 'descartar') return { descartar: true, por: corta(p.pedidoPor || 'admin', 80) };
  return { codigo: Number(p.codigo), tipoDoc: String(p.tipoDoc || 'AUTO'), competencia: p.competencia ? String(p.competencia) : null, por: corta(p.pedidoPor || 'admin', 80) };
}

/** O item do executor (arquivador-novo.planos) na resposta do pedido. */
function respostaDoItem(it, clientes) {
  const raiz = clientes ? String(clientes).replace(/\\+$/, '') + '\\' : null;
  const curto = p => {
    let t = String(p || '').replace(/ \(neste lote\)$/, '');
    if (raiz && t.toLowerCase().startsWith(raiz.toLowerCase())) return t.slice(raiz.length);
    // outra raiz de ano (23/10/2026): fica o ano na frente ("2024\10 - DORNAS…\…")
    const base = raiz ? path.win32.dirname(raiz.replace(/\\+$/, '')) + '\\' : null;
    if (base && t.toLowerCase().startsWith(base.toLowerCase())) return t.slice(base.length);
    return t.replace(/^[A-Z]:\\Meu Drive\\/i, '');
  };
  return {
    acao: it.acao, erro: it.erro ? corta(it.erro, 300) : null, naoAplicado: it.naoAplicado ? corta(it.naoAplicado, 200) : null,
    destino: it.onde ? corta(curto(it.onde), 300) : it.destinoRelativo ? corta(it.destinoRelativo + '\\' + (it.nomeFinal || ''), 300) : null,
    nomeFinal: it.nomeFinal ? corta(it.nomeFinal, 200) : null, situacao: it.situacaoDestino || null,
    pastaNova: it.criarPastaCliente && it.pastaCliente ? corta(it.pastaCliente, 120) : null,
    copias: (it.copias || []).map(c => corta(curto(c.onde || c.destinoRelativo), 300)).filter(Boolean).slice(0, 4),
    motivo: it.motivo || null, evidencias: (it.evidencias || []).slice(-6).map(e => corta(e, 200)),
    cliente: it.cliente != null ? String(it.cliente) : null, clienteNome: it.clienteNome ? corta(it.clienteNome, 80) : null, tipo: it.tipo || null,
  };
}

/** Os clientes do cadastro para o formulário: [{ c, n, p (a pasta já existe) }], pelo código. */
function clientesDoCadastro(cad) {
  const out = [];
  for (const [codigo, c] of (cad && cad.porCod) || []) out.push({ c: Number(codigo), n: corta(c.razao || '', 90), p: !!(cad.pastas && cad.pastas.get(codigo)) });
  return out.filter(x => Number.isFinite(x.c)).sort((a, b) => a.c - b.c);
}

// ---------------------------------------------------------------------------------------------------------------------
// a fila
// ---------------------------------------------------------------------------------------------------------------------
/**
 * opcoes: { db, origem, clientes, log, agora?,
 *   exclusivo(fn): roda fn com a trava do arquivador (espera a volta terminar),
 *   executar(rel, escolha, modo): o item do executor (modo 'PRODUCAO' ou 'SIMULACAO'),
 *   aposMudar(): o arquivo saiu (a lista "Para resolver" é conferida de novo) }.
 */
function criar(opcoes) {
  const o = Object.assign({ log: () => {}, agora: () => Date.now(), exclusivo: fn => fn(), aposMudar: () => {} }, opcoes);
  const fila = [];
  const vistos = new Set();
  let trabalhando = false, parar = null, relogio = null, ultimoCadastro = '';
  const col = () => o.db.collection('pedidosArquivador');
  const responder = (id, dados) => col().doc(id).set(Object.assign({ respondidoEm: new Date(o.agora()).toISOString() }, dados), { merge: true });

  async function abrir(id, p, c) {
    const st = fs.statSync(c.abs);
    if (!st.isFile()) throw new Error('não é um arquivo');
    if (st.size > LIMITE_ABRIR) throw new Error('o arquivo tem ' + Math.round(st.size / 1048576) + ' MB: o limite para abrir pelo site é ' + Math.round(LIMITE_ABRIR / 1048576) + ' MB');
    const buf = fs.readFileSync(c.abs);
    if (!hashConfere(p.hash, c.ni, buf)) throw new Error('o arquivo mudou desde que a lista foi feita: atualize a página');
    const partes = emPartes(buf);
    for (let n = 0; n < partes.length; n++) await col().doc(id).collection('partes').doc(String(n)).set({ n, dados: partes[n] });
    const nome = path.win32.basename(c.rel);
    return { status: 'pronto', arquivo: { nome, mime: mimeDe(nome), tamanho: buf.length, partes: partes.length } };
  }

  async function decidir(id, p, c, producao) {
    if (/\.(zip|rar|7z)$/i.test(c.rel)) throw new Error('compactado: abra e ponha os arquivos soltos na pasta (cada um é decidido sozinho)');
    if (!fs.statSync(c.abs).isFile()) throw new Error('não é um arquivo');
    // o hash: o da lista (barato) ou o do conteúdo
    if (!hashConfere(p.hash, c.ni, null) && !hashConfere(p.hash, c.ni, fs.readFileSync(c.abs))) throw new Error('o arquivo mudou desde que a lista foi feita: atualize a página');
    const escolha = escolhaDoPedido(p);
    const rodar = () => o.executar(c.rel, escolha, producao ? 'PRODUCAO' : 'SIMULACAO');
    const it = producao ? await o.exclusivo(rodar) : await rodar();
    if (!it) throw new Error('o executor não devolveu o arquivo');
    const r = respostaDoItem(it, o.clientes);
    if (!producao) return { status: it.acao === 'ARQUIVAR' || it.acao === 'JA_ARQUIVADO' || it.acao === 'DESCARTAR' ? 'pronto' : 'erro', resposta: r, erro: it.acao === 'NAO_IDENTIFICADO' ? (r.evidencias[r.evidencias.length - 1] || r.motivo) : null };
    if (it.erro) return { status: 'erro', resposta: r, erro: corta(it.erro, 300) };
    if (it.naoAplicado) return { status: 'erro', resposta: r, erro: 'não aplicado: ' + it.naoAplicado };
    if (!['ARQUIVAR', 'JA_ARQUIVADO', 'DESCARTAR'].includes(it.acao)) return { status: 'erro', resposta: r, erro: r.evidencias[r.evidencias.length - 1] || r.motivo || 'as regras não chegaram a um destino' };
    // tirado de NÃO IDENTIFICADOS: a linha no índice da subpasta (o arquivo já saiu; a lista é conferida de novo)
    if (c.ni != null) {
      const [sub, ...resto] = c.ni.split('\\');
      const linha = { arquivo: resto[resto.length - 1], caminho_relativo: resto.slice(0, -1).join('\\') || '.', status: p.tipo === 'descartar' ? 'DESCARTADO_PELO_ADMIN' : 'ARQUIVADO_PELO_ADMIN', destino: r.destino, decidido_por: escolha.por, pedido: id, timestamp: new Date(o.agora()).toISOString() };
      try { fs.appendFileSync(path.join(o.origem, NAO_IDENTIFICADOS, sub, '_nao_identificados.jsonl'), JSON.stringify(linha) + '\n'); } catch (e) { o.log('pedido ' + id + ': não anotei no índice de NÃO IDENTIFICADOS:', e.message); }
    }
    try { o.aposMudar(); } catch (e) { /* a lista se confere sozinha em 10 min */ }
    return { status: 'feito', resposta: r };
  }

  /**
   * O grupo (Para resolver em grupos): grupoPrevia = os primeiros arquivos em simulação; grupo = todos, um por um, pelo
   * mesmo executor (com a trava), e, com "lembrar", a decisão vira regra do mapa da migração para os próximos da pasta.
   */
  async function tratarGrupo(id, p) {
    const g = o.grupo ? o.grupo(String(p.hash || '')) : null;
    if (!g || !g.arquivos.length) return { status: 'erro', erro: 'o grupo não está mais em NÃO IDENTIFICADOS (atualize a página)' };
    const previa = p.tipo === 'grupoPrevia';
    const lista = previa ? g.arquivos.slice(0, EXEMPLOS_DA_PREVIA) : g.arquivos.slice();
    const exemplos = [];
    let feitos = 0, erros = 0, primeiroErro = null;
    for (const a of lista) {
      const c = caminhoDoPedido(o.origem, a.rel);
      if (c.erro || !fs.existsSync(c.abs)) { erros++; if (!primeiroErro) primeiroErro = a.nome + ': saiu da pasta'; continue; }
      const pp = Object.assign({}, p, { tipo: previa ? 'previa' : 'arquivar', rel: a.rel, hash: a.hash, competencia: competenciaDoArquivo(p.competencia, c.ni || a.rel) });
      let r;
      try { r = await decidir(id, pp, c, !previa); } catch (e) { r = { status: 'erro', erro: e.message }; }
      if (previa) exemplos.push(Object.assign({ nome: corta(a.nome, 200), competencia: pp.competencia || null, erro: r.erro || null }, r.resposta || {}));
      else if (r.status === 'feito') feitos++;
      else { erros++; if (!primeiroErro) primeiroErro = corta(a.nome + ': ' + (r.erro || 'erro'), 300); }
    }
    if (previa) return { status: exemplos.some(x => !x.erro) ? 'pronto' : 'erro', erro: exemplos.every(x => x.erro) ? (exemplos[0] && exemplos[0].erro) || 'as regras não chegaram a um destino' : null, resposta: { total: g.arquivos.length, exemplos } };
    // lembrar: a pasta de origem do grupo vira regra (o cliente pela pasta do cliente; o tipo pela pasta do grupo)
    let lembrou = false;
    if (p.lembrar === true && feitos > 0 && o.lembrar) { try { lembrou = !!o.lembrar({ pasta: g.pasta, cliente: Number(p.codigo), tipoDoc: String(p.tipoDoc || ''), por: corta(p.pedidoPor || 'admin', 80) }); } catch (e) { o.log('pedido ' + id + ': não lembrei a decisão do grupo:', e.message); } }
    return { status: feitos ? 'feito' : 'erro', erro: feitos ? null : primeiroErro || 'nenhum arquivo do grupo foi arquivado', resposta: { total: lista.length, feitos, erros, primeiroErro, lembrou } };
  }

  async function tratar(id, p) {
    try {
      if (!p || !TIPOS.includes(p.tipo)) { await responder(id, { status: 'erro', erro: 'tipo de pedido desconhecido' }); return; }
      await responder(id, { status: 'trabalhando' });
      if (p.tipo === 'grupo' || p.tipo === 'grupoPrevia') {
        const r = await tratarGrupo(id, p);
        await responder(id, r);
        o.log('pedido ' + id + ' (' + p.tipo + ', ' + (p.pedidoPor || '?') + '): ' + r.status + (r.resposta ? ' ' + JSON.stringify({ total: r.resposta.total, feitos: r.resposta.feitos, erros: r.resposta.erros }) : '') + (r.erro ? ' — ' + r.erro : ''));
        return;
      }
      const c = caminhoDoPedido(o.origem, p.rel);
      if (c.erro) { await responder(id, { status: 'erro', erro: c.erro }); return; }
      if (!fs.existsSync(c.abs)) { await responder(id, { status: 'erro', erro: 'o arquivo não está mais em ' + c.rel + ' (já saiu da pasta?)' }); return; }
      const r = p.tipo === 'abrir' ? await abrir(id, p, c) : await decidir(id, p, c, p.tipo === 'arquivar' || p.tipo === 'descartar');
      await responder(id, r);
      o.log('pedido ' + id + ' (' + p.tipo + ', ' + (p.pedidoPor || '?') + '): ' + r.status + (r.resposta && r.resposta.destino ? ' → ' + r.resposta.destino : '') + (r.erro ? ' — ' + r.erro : ''));
    } catch (e) {
      o.log('pedido ' + id + ' (' + (p && p.tipo) + '): erro', e.message);
      try { await responder(id, { status: 'erro', erro: corta(e.message, 300) }); } catch (x) { /* o pedido some em 30 min */ }
    }
  }

  async function andar() {
    if (trabalhando) return;
    trabalhando = true;
    try { while (fila.length) { const [id, p] = fila.shift(); await tratar(id, p); } }
    finally { trabalhando = false; }
  }

  /** Apaga os pedidos de mais de 30 min (e as partes). */
  async function limpar() {
    if (!o.db) return 0;
    let n = 0;
    try {
      const snap = await col().where('criadoEm', '<', new Date(o.agora() - VIDA_MS)).limit(50).get();
      for (const d of snap.docs) {
        try { const ps = await d.ref.collection('partes').get(); for (const x of ps.docs) await x.ref.delete(); } catch (e) { /* segue */ }
        await d.ref.delete(); vistos.delete(d.id); n++;
      }
    } catch (e) { o.log('pedidos do arquivador: não limpei os antigos:', e.message); }
    return n;
  }

  if (o.db) {
    try {
      parar = require('./ouvinte').ouvir('pedidos do arquivador', () => col().where('status', '==', 'pendente'), snap => {
        for (const d of snap.docs) if (!vistos.has(d.id)) { vistos.add(d.id); fila.push([d.id, d.data()]); }
        void andar();
      }, o.log);
    } catch (e) { o.log('pedidos do arquivador não ligaram:', e.message); }
    relogio = setInterval(() => { void limpar(); }, LIMPAR_A_CADA_MS);
    if (relogio.unref) relogio.unref();
    void limpar();
  }

  return {
    tratar,
    limpar,
    /** os clientes e os tipos do formulário (robo/arquivadorNovoCadastro), só quando mudam */
    async publicarCadastro(cad) {
      if (!o.db || !cad) return false;
      try {
        const dados = { clientes: clientesDoCadastro(cad), tipos: M.tiposDoFormulario() };
        const assinatura = sha1(JSON.stringify(dados));
        if (assinatura === ultimoCadastro) return false;
        await o.db.collection('robo').doc('arquivadorNovoCadastro').set(Object.assign({ em: new Date(o.agora()).toISOString() }, dados));
        ultimoCadastro = assinatura;
        return true;
      } catch (e) { o.log('não publiquei o cadastro do formulário:', e.message); return false; }
    },
    parar: () => { if (parar) parar(); if (relogio) clearInterval(relogio); },
  };
}

module.exports = { criar, caminhoDoPedido, hashConfere, emPartes, mimeDe, escolhaDoPedido, respostaDoItem, clientesDoCadastro, competenciaDoArquivo, LIMITE_ABRIR, BYTES_POR_PARTE, VIDA_MS, TIPOS };
