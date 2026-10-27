// O arquivador novo POR EVENTO (Vitor, 21/10/2026: "eu quero que quando cair na pasta ele já arquive").
//
// Vigia G:\Meu Drive\Claudio Secretario e trata cada arquivo assim que ele fica ESTÁVEL:
//   - fs.watch recursivo acorda o ciclo na hora; uma varredura a cada INTERVALO (1 min) garante o resto, porque o Google
//     Drive sincroniza aos poucos e nem sempre avisa;
//   - estável = tamanho e data sem mudar há ESTAVEL_MS (45 s) e a data mais velha que isso; fora os temporários do Drive
//     e do Office (~$…, .tmp, .crdownload, .part, desktop.ini) e arquivo de 0 byte; .zip só com o diretório central
//     inteiro (zip ainda chegando não abre);
//   - lotes (LOTE arquivos; menos com o Drive lento, mais com ele rápido), um de cada vez, com a trava própria (continuo.lock) e
//     NUNCA junto com a rotina antiga (a das 9h ou um pedido do botão "Arquivar agora": _CONTROLE\_execucao.lock, sinal
//     recente em _CONTROLE ou robo/arquivador "rodando") nem com outro processo deste arquivador.
//
// O que ele faz com o lote depende do CONFIG (arquivo config.json no controle, ou o documento robo/arquivadorNovo):
//   { "modo": "desligado" | "simulacao" | "producao", "tiposProducao": ["XML", "NFC-e PDF"], "moverNaoIdentificados": false }
//   - simulacao (o padrão da semana lado a lado): registra "arquivaria X em Y" e não move nada;
//   - producao: aplica só os tipos de tiposProducao (prefixo do tipo: "XML" = todos os XML); o resto continua simulado
//     e fica na origem para a rotina antiga. Sem tiposProducao, producao não aplica nada (chave por tipo, de propósito).
//
// Cada decisão vai para o diário (continuo\decisoes-AAAA-MM.jsonl), para o painel (atividade "Arquivou/Arquivaria X em
// Y" e a contagem do mês) e, uma vez por dia depois da rotina das 9h, vira o relatório LADO A LADO: o que a rotina
// antiga arquivou hoje × o que o novo decidiu para os mesmos arquivos (pelo hash).
//
// Uso:  node arquivador-continuo.js              fica vigiando (com o banco: painel e config do banco)
//       node arquivador-continuo.js --uma-vez    um ciclo só e sai
//       node arquivador-continuo.js --comparar 2026-10-21   só o relatório lado a lado daquele dia
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const A = require('./arquivador-novo');
const C_ehTemporario = rel => ehTemporario(path.basename(rel));

const ORIGEM = process.env.ARQ_NOVO_ORIGEM || 'G:\\Meu Drive\\Claudio Secretario';
const ROTINA = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const CONTROLE_ANTIGO = path.join(ROTINA, '_CONTROLE');
const INTERVALO_MS = 60 * 1000;
const ESTAVEL_MS = 45 * 1000;
const LOTE = 40;
const COMPARAR_DEPOIS_DAS = [11, 30];   // a das 9h terminou (JANELA_DAS_9H do arquivador.js vai até 11h)
// o evento sem o original no índice de chaves espera o original (23/10/2026, "24–48 h"): 48 h; depois, o SIEG pela chave
// (até siegPorDia chamadas por dia) e só então NÃO IDENTIFICADOS
// origensExtras: pastas LOCAIS de entrada (23/10/2026: cargas grandes copiadas direto no PC, sem passar duas vezes pela
// sincronização do Drive); as mesmas regras, o mesmo manifesto e a mesma quarentena; os não identificados vão para o
// NÃO IDENTIFICADOS do G:
const PADRAO = { modo: 'simulacao', tiposProducao: [], moverNaoIdentificados: false, intervaloMs: INTERVALO_MS, estavelMs: ESTAVEL_MS, lote: LOTE, esperaOriginalHoras: 48, siegPorDia: 200, origensExtras: [] };
const K = require('./arquivador-chaves');

// ---------------------------------------------------------------------------------------------------------------------
// puras (teste-arquivador-continuo.js)
// ---------------------------------------------------------------------------------------------------------------------
/** Temporário do Drive/Office/navegador: nunca é tratado. */
function ehTemporario(nome) {
  const n = String(nome || '');
  return /^~\$|^\.~|^\.|\.(tmp|temp|crdownload|part|partial|download|gdownload)$/i.test(n) || /^desktop\.ini$|^thumbs\.db$/i.test(n) || /\.lock$/i.test(n);
}

/**
 * Acompanha o tamanho e a data de cada arquivo entre as varreduras. mapa: Map(rel → { tam, mtime, desde }).
 * vistos: [{ rel, tam, mtime }] desta varredura. Devolve os rel estáveis (sem mudar há estavelMs e data mais velha que isso).
 */
function estaveis(mapa, vistos, agora, estavelMs) {
  const presentes = new Set();
  const prontos = [];
  for (const v of vistos) {
    presentes.add(v.rel);
    if (ehTemporario(path.basename(v.rel)) || !v.tam) { mapa.delete(v.rel); continue; }
    const a = mapa.get(v.rel);
    if (!a || a.tam !== v.tam || a.mtime !== v.mtime) { mapa.set(v.rel, { tam: v.tam, mtime: v.mtime, desde: agora }); continue; }
    if (agora - a.desde >= estavelMs && agora - v.mtime >= estavelMs) prontos.push(v.rel);
  }
  for (const rel of [...mapa.keys()]) if (!presentes.has(rel)) mapa.delete(rel);   // sumiu (foi arquivado ou movido)
  return prontos;
}

/** Junta o config do arquivo com o do banco (o do arquivo manda) e normaliza. */
// o último config.json lido inteiro de cada arquivo: uma falha passageira de leitura (o arquivo preso por outro programa,
// gravado pela metade) não vira "simulação" (23/10/2026: o robô religou às 15:42 dizendo "modo simulacao" com o arquivo
// em produção)
const configBom = new Map();
const errosDoConfig = new Set();
function lerConfig(arquivo, doBanco) {
  let doArquivo = {};
  try { doArquivo = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')); configBom.set(arquivo, doArquivo); }
  catch (e) {
    if (e.code === 'ENOENT') configBom.delete(arquivo); else if (configBom.has(arquivo)) doArquivo = configBom.get(arquivo); /* sem arquivo: o do banco ou o padrão */
    // o erro da leitura vai para o log uma vez (por arquivo e tipo de erro), para não adivinhar de novo (26/10/2026)
    const chave = arquivo + '|' + (e.code || e.name);
    if (!errosDoConfig.has(chave)) { errosDoConfig.add(chave); console.log('[arquivador-novo] não li o config.json ' + arquivo + ': ' + (e.code || '') + ' ' + e.message); }
  }
  // de onde veio o modo (26/10/2026): o painel e o log dizem, para ninguém mais adivinhar
  let origem;
  if (configBom.has(arquivo) && configBom.get(arquivo) === doArquivo) {
    let quando = '';
    try { const d = new Date(fs.statSync(arquivo).mtimeMs); quando = ', gravado em ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { /* segue */ }
    origem = 'config.json (' + arquivo + quando + ')';
  } else if (doBanco && Object.keys(doBanco).length) origem = 'banco (robo/arquivadorNovo.config), sem config.json em ' + arquivo;
  else origem = 'padrão: sem config.json em ' + arquivo + ' e sem config no banco';
  const c = Object.assign({}, PADRAO, doBanco || {}, doArquivo);
  Object.defineProperty(c, 'origem', { value: origem, enumerable: false, writable: true });
  if (!['desligado', 'simulacao', 'producao'].includes(c.modo)) c.modo = 'simulacao';
  // "todos" (texto ou na lista) libera todos os tipos
  c.tiposProducao = c.tiposProducao === 'todos' ? ['todos'] : Array.isArray(c.tiposProducao) ? c.tiposProducao.map(String).filter(Boolean) : [];
  c.emProducao = c.modo === 'producao' && c.tiposProducao.length > 0;
  c.origensExtras = (Array.isArray(c.origensExtras) ? c.origensExtras : c.origensExtras ? [c.origensExtras] : []).map(String).filter(Boolean);
  c.lote = Math.max(1, Math.min(400, +c.lote || LOTE));
  return c;
}

/**
 * O relatório lado a lado de um dia: rotina antiga (linhas do manifesto dela naquele dia) × arquivador novo (as decisões
 * do diário para os mesmos hashes). Puro: recebe as linhas já lidas.
 */
function compararDia(dia, linhasAntigas, decisoesNovas) {
  const norm = p => String(p || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  const doDia = linhasAntigas.filter(l => String(l.timestamp || '').slice(0, 10) === dia || /^(EXEC-)?(\d{8})/.test(l.id_execucao || '') && (/(\d{8})/.exec(l.id_execucao)[1] === dia.replace(/-/g, '')));
  const novo = new Map();
  for (const d of decisoesNovas) if (d.hash) novo.set(d.hash, d);   // a última decisão de cada arquivo
  const r = { dia, rotinaArquivou: doDia.length, iguais: 0, pastaIgualNomeDiferente: 0, diferentes: 0, novoNaoIdentificou: 0, novoNaoViu: 0, exemplos: [] };
  for (const l of doDia) {
    const n = novo.get(l.hash_origem) || novo.get(l.hash_original);
    const antigo = A.caminhoArquivado(l.destino_final, l.nome_final);
    if (!n) { r.novoNaoViu++; continue; }
    if (n.acao !== 'ARQUIVAR' && n.acao !== 'JA_ARQUIVADO') { r.novoNaoIdentificou++; if (r.exemplos.length < 60) r.exemplos.push({ tipo: 'NI', nome: l.nome_original, antigo, novo: n.motivo + (n.destinoSugerido ? ' (sugestão ' + n.destinoSugerido + ')' : '') }); continue; }
    const onde = norm(n.onde).replace(/ \(neste lote\)$/, '');
    if (onde === norm(antigo)) r.iguais++;
    else if (path.dirname(onde) === path.dirname(norm(antigo))) r.pastaIgualNomeDiferente++;
    else { r.diferentes++; if (r.exemplos.length < 60) r.exemplos.push({ tipo: 'DIFERENTE', nome: l.nome_original, antigo, novo: n.onde }); }
  }
  return r;
}
function textoDoLadoALado(r) {
  const L = ['LADO A LADO ' + r.dia + ' — rotina antiga (Claude) × arquivador novo (simulação)', '',
    'a rotina antiga arquivou ' + r.rotinaArquivou + ' arquivo(s) hoje; para os mesmos arquivos (pelo conteúdo), o novo:',
    '  mesmo destino e nome: ' + r.iguais, '  mesma pasta, nome diferente: ' + r.pastaIgualNomeDiferente, '  OUTRO destino: ' + r.diferentes,
    '  não identificaria: ' + r.novoNaoIdentificou, '  não chegou a ver (arquivo saiu antes de ficar estável ou o novo estava parado): ' + r.novoNaoViu, ''];
  for (const e of r.exemplos) L.push(e.tipo + ': ' + e.nome + '\n   antiga: ' + e.antigo + '\n   novo:   ' + e.novo);
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------------------------------
// o vigia
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Liga o modo contínuo. opcoes: { db, painel, log, ocupado: () => bool (o arquivador.js diz se o botão está rodando),
 * origem, controle, umaVez }. Devolve { parar, ciclo }.
 */
function iniciar(opcoes) {
  const o = Object.assign({ origem: ORIGEM, controle: A.CONTROLE, controleAntigo: CONTROLE_ANTIGO, log: (...m) => console.log(new Date().toLocaleString('pt-BR'), '[arquivador novo]', ...m) }, opcoes);
  const pasta = path.join(o.controle, 'continuo');
  fs.mkdirSync(pasta, { recursive: true });
  const TRAVA = path.join(o.controle, 'continuo.lock');
  const CONFIG = path.join(o.controle, 'config.json');
  let configBanco = null, parado = false, rodando = false, acordar = null, observador = null, avisouSemDrive = false, tentouVigiarEm = 0;
  let cache = { em: 0 };
  // o SIEG pela chave: o módulo do robô (o.sieg; null desliga, nos testes); criado no primeiro uso
  let buscaSieg = null;
  const siegDoRobo = () => { if (o.sieg !== undefined) return o.sieg; try { return require('./sieg'); } catch (e) { o.log('SIEG por chave: não carreguei o robo/sieg.js (' + e.message + ')'); return null; } };
  const estadoArq = path.join(pasta, 'estado.json');
  let estado = (() => { try { return JSON.parse(fs.readFileSync(estadoArq, 'utf8')); } catch (e) { return { decididos: {}, mes: {}, comparado: null }; } })();
  const salvar = () => { try { fs.writeFileSync(estadoArq + '.tmp', JSON.stringify(estado)); fs.renameSync(estadoArq + '.tmp', estadoArq); } catch (e) { o.log('não gravei o estado:', e.message); } };

  // o painel: o do arquivador.js quando roda dentro dele; sozinho, grava a atividade direto (com freio)
  const freio = []; const MAX = 60, JANELA = 10 * 60 * 1000;
  const atividade = (texto, detalhe, erro) => {
    if (o.painel) return erro ? o.painel.erro('arquivamento', texto, detalhe) : o.painel.atividade('arquivamento', texto, detalhe);
    if (!o.db) return;
    const agora = Date.now(); while (freio.length && agora - freio[0] > JANELA) freio.shift();
    if (freio.length >= MAX) return; freio.push(agora);
    o.db.collection('roboAtividade').add({ em: new Date().toISOString(), tipo: 'arquivamento', texto: String(texto).slice(0, 200), detalhe: String(detalhe || '').slice(0, 500), erro: !!erro, robo: 'pc', maquina: os.hostname(), expiraEm: new Date(Date.now() + 7 * 864e5) }).catch(() => {});
  };
  const publicarEstado = (parcial) => {
    if (o.painel) return o.painel.estado({ arquivadorNovo: parcial });
    if (o.db) o.db.collection('robo').doc('arquivadorNovo').set({ estado: parcial }, { merge: true }).catch(() => {});
  };
  // o acompanhamento do site do admin (Admin › Arquivador, 22/10/2026): a pasta, a passada, o porquê de cada arquivo, os
  // não identificados e os erros, em robo/arquivadorNovo.painel (com freio; nunca derruba o ciclo)
  const acomp = require('./arquivador-acompanhamento').criar({ db: o.db, controle: pasta, origem: o.origem, log: o.log });
  // o config no banco (robo/arquivadorNovo): ouvinte, só cobra quando muda
  if (o.db) {
    try { require('./ouvinte').ouvir('arquivador novo: config', () => o.db.collection('robo').doc('arquivadorNovo'), snap => { configBanco = snap.exists ? (snap.data().config || null) : null; }, o.log); } catch (e) { o.log('config do banco não ligou:', e.message); }
  }

  /** A rotina antiga ou um pedido do botão rodando agora? */
  function outraExecucao(porPedido) {
    if (!porPedido && o.ocupado && o.ocupado()) return 'o pedido do botão "Arquivar agora" está rodando';
    try { const st = fs.statSync(path.join(o.controleAntigo, '_execucao.lock')); if (Date.now() - st.mtimeMs < 4 * 36e5) return 'a rotina antiga está rodando (_execucao.lock)'; } catch (e) { /* sem trava */ }
    const recente = d => { try { for (const n of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, n)); if (Date.now() - st.mtimeMs < 10 * 60000) return true; } } catch (e) { /* sem pasta */ } return false; };
    if (recente(path.join(o.controleAntigo, 'MANIFESTO')) || recente(path.join(o.controleAntigo, '_tmp_exec')) || recente(path.join(o.controleAntigo, 'STAGING'))) return 'a rotina antiga mexeu no _CONTROLE há menos de 10 min';
    return null;
  }
  /** O contexto caro (cadastro, manifesto antigo, contas, índice de chaves), refeito a cada 30 min. */
  // 23/10/2026: o cadastro do banco tem prazo (atualizarCadastro, 45 s); os índices (chaves, conteúdo, manifesto antigo)
  // crescem na hora em memória a cada decisão, então só são relidos do disco a cada 6 h (relê-los a cada 30 min, com o diário
  // do contínuo passando de 100 MB, segurava o robô)
  async function garantirContexto() {
    if (Date.now() - cache.em <= 30 * 60000) return cache;
    if (o.db) await A.atualizarCadastro({ db: o.db, controle: o.controle, log: o.log });
    const relerIndices = !cache.indicesEm || Date.now() - cache.indicesEm > 6 * 36e5;
    const manifestoAntigo = path.join(o.controleAntigo, 'MANIFESTO', 'manifesto.jsonl');
    const t0 = Date.now();
    const antes = cache;
    let novos = null;
    if (relerIndices) {
      // 26/10/2026: o índice de conteúdo caiu de 37.446 para 13.574 sem ninguém ver: a leitura que falha mantém o de antes,
      // e o índice que ENCOLHE mais de 10% (eles só crescem) também, com o aviso
      try {
        novos = { manifesto: A.indiceDoManifesto(manifestoAntigo), chaves: K.carregar({ controle: o.controle, manifestoAntigo, raiz: o.clientes }), conteudos: require('./arquivador-conteudos').carregar({ controle: o.controle, manifestoAntigo }) };
      } catch (e) { o.log('não reli os índices (' + e.message + '): fico com os de antes'); novos = null; }
      const encolheu = (a, b) => a && b && b.tamanho < a.tamanho * 0.9;
      if (novos && antes.conteudos && (encolheu(antes.conteudos, novos.conteudos) || encolheu(antes.chaves, novos.chaves))) {
        const aviso = 'os índices encolheram (conteúdos ' + antes.conteudos.tamanho + ' → ' + novos.conteudos.tamanho + ', chaves ' + antes.chaves.tamanho + ' → ' + novos.chaves.tamanho + '): fico com os de antes';
        o.log(aviso); atividade('Os índices do arquivador encolheram', aviso, true);
        novos = null;
      }
    }
    cache = { em: Date.now(), cadastro: o.cadastro || A.carregarCadastro({ controle: o.controle }), contas: A.lerContas(o.controle),
      indicesEm: novos ? Date.now() : (antes.indicesEm && antes.conteudos ? antes.indicesEm : null),
      manifesto: novos ? novos.manifesto : antes.manifesto || A.indiceDoManifesto(manifestoAntigo),
      chaves: novos ? novos.chaves : antes.chaves || K.carregar({ controle: o.controle, manifestoAntigo, raiz: o.clientes }),
      conteudos: novos ? novos.conteudos : antes.conteudos || require('./arquivador-conteudos').carregar({ controle: o.controle, manifestoAntigo }) };
    if (novos) o.log('índices relidos em ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s: ' + cache.chaves.tamanho + ' chaves, ' + cache.conteudos.tamanho + ' conteúdos já arquivados');
    if (o.depurar) o.log('índice de chaves: ' + JSON.stringify(cache.chaves.estatistica));
    if (pedidos) void pedidos.publicarCadastro(cache.cadastro);
    return cache;
  }
  /**
   * Os pedidos do site do admin que mexem na pasta (arquivar, descartar: arquivador-pedidos.js) rodam com a mesma trava
   * da volta: esperam a volta terminar (até 10 min) e nunca junto com a rotina antiga.
   */
  async function exclusivo(fn) {
    // a passada pode levar horas (a carga do SIEG): o pedido entra entre um lote e outro, com a trava que a passada já tem
    if (rodando) {
      return new Promise((ok, erro) => {
        const p = { fn: () => { const m = outraExecucao(true); if (m) throw new Error('espere: ' + m); return fn(); }, ok, erro };
        vez.push(p);
        setTimeout(() => { const i = vez.indexOf(p); if (i >= 0) { vez.splice(i, 1); erro(new Error('o arquivador está ocupado há 10 min: tente de novo')); } }, 10 * 60000);
      });
    }
    const motivo = outraExecucao(true);
    if (motivo) throw new Error('espere: ' + motivo);
    rodando = true;
    try {
      if (!pegarTrava()) throw new Error('outro processo do arquivador novo está trabalhando');
      try { return await fn(); } finally { soltarTrava(); }
    } finally { rodando = false; }
  }
  /** Um arquivo com a decisão do admin, pelo executor de sempre (PRODUCAO arquiva; SIMULACAO é a prévia). */
  async function executarDecisao(rel, escolha, modo) {
    await garantirContexto();
    const res = await A.executar({
      modo, confirmo: true, origem: o.origem, controle: o.controle, clientes: o.clientes, arquivos: [rel], manual: { [rel]: escolha },
      pastaNaoIdentificados: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-NOVO', travaAntiga: path.join(o.controleAntigo, '_execucao.lock'),
      cadastro: cache.cadastro, contas: cache.contas, manifesto: cache.manifesto, conteudos: cache.conteudos, tiposProducao: ['todos'], moverNaoIdentificados: false,
      chaves: cache.chaves, manifestoAntigo: path.join(o.controleAntigo, 'MANIFESTO', 'manifesto.jsonl'),
      painel: modo === 'PRODUCAO' ? { atividade: (t, x, d) => atividade(x, d), erro: (t, x, d) => atividade(x, d, true) } : null,
      registrar: false, log: () => {},
    });
    // a decisão à mão (arquivou, descartou) entra no histórico do dia, com quem decidiu (23/10/2026)
    if (modo === 'PRODUCAO') { try { acomp.decisoes(A.planos(res).filter(x => x.acao !== 'CONTEINER'), res.modo); } catch (e) { /* só o histórico */ } }
    return A.planos(res).find(x => x.acao !== 'CONTEINER' && x.rel === rel) || res.itens[0] || null;
  }

  /** A trava deste arquivador (dois processos nunca juntos). */
  function pegarTrava() {
    try {
      const t = JSON.parse(fs.readFileSync(TRAVA, 'utf8'));
      if (t.pid !== process.pid) { try { process.kill(t.pid, 0); if (Date.now() - t.em < 30 * 60000) return false; } catch (e) { /* processo morto: a trava é resto */ } }
    } catch (e) { /* sem trava */ }
    fs.writeFileSync(TRAVA, JSON.stringify({ pid: process.pid, em: Date.now() }));
    return true;
  }
  const tocarTrava = () => { try { fs.writeFileSync(TRAVA, JSON.stringify({ pid: process.pid, em: Date.now() })); } catch (e) { /* segue */ } };
  const soltarTrava = () => { try { if (JSON.parse(fs.readFileSync(TRAVA, 'utf8')).pid === process.pid) fs.unlinkSync(TRAVA); } catch (e) { /* já foi */ } };

  // ---------------------------------------------------------------------------------------------------------------------
  // a leitura da pasta EM FLUXO (23/10/2026: com ~11 mil arquivos o robô passou mais de 1 h só listando e conferindo o
  // tamanho de cada um — statSync, um por vez, ~40 ms cada no G: em streaming — com o laço do Node parado: sem ponto, sem
  // painel, sem banco; e a carga do SIEG vai a ~320 mil). Agora:
  //   - nunca espera a lista inteira: anda pasta por pasta (fs.opendir), confere o tamanho e a data em paralelo (16 juntos)
  //     e manda para o lote o que está pronto enquanto lê; entre um pedaço e outro o resto do robô roda;
  //   - entre as passadas inteiras (a cada 15 min, ou quando o fs.watch avisou sem o nome), só o que o fs.watch avisou;
  //   - nada da pasta fica inteiro na memória: os "já decididos" que saíram da pasta são esquecidos no fim de cada passada
  //     inteira; os que ainda estão chegando (mexidos há menos de 10 min) ficam num mapa pequeno;
  //   - o progresso vai ao painel ("Lendo a pasta: 37.000 de ~100.000 · N na fila (G:) + M (local) · X/min · faltam ~Y").
  // ---------------------------------------------------------------------------------------------------------------------
  const STAT_JUNTOS = 16, PEDACO = 64, RECENTE_MS = 10 * 60000, MAX_RECENTES = 50000, PASSADA_INTEIRA_MS = 15 * 60000;
  const incluir = (rel, ehPasta) => {
    const p = rel.split('\\');
    const pastas = ehPasta ? p : p.slice(0, -1);
    if (pastas.some(s => s.startsWith('_') || /^CLAUDE FAVOR N[ÃA]O MEXER$/i.test(s) || s === 'NÃO IDENTIFICADOS')) return false;
    const n = p[p.length - 1];
    return ehPasta || (!n.startsWith('_nao_identificados') && n !== 'desktop.ini');
  };
  /**
   * As pastas vazias da origem (27/10/2026, Vitor: "pq não apagou as pastas?"): o robô só move arquivos, então depois da
   * migração sobraram 59 das 67 pastas da Claudio Secretario só com subpastas. Remove, de baixo para cima, a pasta SEM
   * NENHUM arquivo (rmdir só apaga pasta vazia: nada de conteúdo se perde) e parada há mais de 1 dia; nunca a raiz nem as
   * de fora da leitura (NÃO IDENTIFICADOS, "_…", CLAUDE FAVOR NÃO MEXER). O desktop.ini sozinho conta como vazia.
   */
  async function limparPastasVazias(raiz) {
    const UM_DIA = 864e5, agora = Date.now();
    let removidas = 0;
    const limpar = async (rel) => {
      const abs = rel ? path.join(raiz, rel) : raiz;
      let es; try { es = await fs.promises.readdir(abs, { withFileTypes: true }); } catch (e) { return false; }
      // a data antes de limpar as de dentro (remover uma subpasta muda a data da mãe)
      let st; try { st = await fs.promises.stat(abs); } catch (e) { return false; }
      let vazia = true;
      for (const e of es) {
        const r = rel ? rel + '\\' + e.name : e.name;
        if (e.isDirectory()) { if (!incluir(r, true) || !(await limpar(r))) vazia = false; }
        else if (e.name.toLowerCase() !== 'desktop.ini') vazia = false;
      }
      if (!vazia || !rel) return false;
      if (agora - st.mtimeMs < UM_DIA) return false;
      try { const ini = path.join(abs, 'desktop.ini'); if (fs.existsSync(ini)) await fs.promises.unlink(ini); await fs.promises.rmdir(abs); removidas++; return true; } catch (e) { return false; }
    };
    await limpar('');
    if (removidas) { o.log('pastas vazias removidas da origem: ' + removidas); atividade('Removeu ' + removidas + ' pasta(s) vazia(s) da Claudio Secretario', 'só pastas sem nenhum arquivo, paradas há mais de 1 dia'); }
    return removidas;
  }
  /** As origens: a do Drive e as locais do config (origensExtras: a entrada local; o resto igual, NÃO IDENTIFICADOS no G:). */
  function origensDe(cfg) {
    const out = [{ id: 'G:', raiz: o.origem, principal: true }];
    for (const p of cfg.origensExtras || []) { const raiz = String(p || '').trim(); if (raiz && fs.existsSync(raiz) && path.resolve(raiz).toLowerCase() !== path.resolve(o.origem).toLowerCase()) out.push({ id: 'local:' + raiz, raiz, principal: false, nome: 'local' }); }
    return out;
  }
  // a chave do "já decidido": a do G: igual à de antes (o estado.json que já existe continua valendo)
  const chaveDe = (org, rel, v) => (org.principal ? '' : org.id + '|') + rel + '|' + v.tam + '|' + Math.round(v.mtime);
  const chave = (rel, v) => rel + '|' + v.tam + '|' + Math.round(v.mtime);   // (o G:; o lado a lado e os testes)
  /** Os arquivos de uma pasta e das de dentro, em pedaços de até PEDACO, sem esperar a árvore inteira. */
  async function* andarEmFluxo(raiz, desde) {
    const pilha = [desde || ''];
    while (pilha.length && !parado) {
      const rel = pilha.pop();
      let dir;
      try { dir = await fs.promises.opendir(rel ? path.join(raiz, rel) : raiz, { bufferSize: 256 }); } catch (e) { continue; }
      const subs = [];
      let pedaco = [];
      try {
        for await (const e of dir) {
          const r = rel ? rel + '\\' + e.name : e.name;
          if (e.isDirectory()) { if (incluir(r, true)) subs.push(r); continue; }
          if (!incluir(r, false)) continue;
          pedaco.push(r);
          if (pedaco.length >= PEDACO) { yield pedaco; pedaco = []; }
        }
      } catch (e) { /* a pasta sumiu ou mudou no meio: o resto vem na próxima passada */ }
      if (pedaco.length) yield pedaco;
      subs.sort((a, b) => b.localeCompare(a));
      pilha.push(...subs);   // a ordem alfabética, como antes
    }
  }
  /** O tamanho e a data de cada um, STAT_JUNTOS de cada vez (no G: em streaming, um por vez é ~40 ms). */
  async function conferirTamanhos(raiz, rels) {
    const out = new Array(rels.length).fill(null);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(STAT_JUNTOS, rels.length) }, async () => {
      while (i < rels.length) { const k = i++; try { const st = await fs.promises.stat(path.join(raiz, rels[k])); if (st.isFile()) out[k] = { rel: rels[k], tam: st.size, mtime: st.mtimeMs }; } catch (e) { /* sumiu */ } }
    }));
    return out;
  }

  // o que ainda está chegando (mexido há menos de RECENTE_MS): o tamanho e a data da primeira vez que foi visto
  const recentes = new Map();
  /**
   * Pronto para decidir? O arquivo mexido há mais de 10 min está parado (pronto já na primeira vez); o mais novo precisa ser
   * visto duas vezes com o mesmo tamanho e a mesma data, com estavelMs entre elas, e a data mais velha que estavelMs.
   */
  function situacaoDe(org, v, agora, estavelMs, porPedido) {
    if (C_ehTemporario(v.rel) || !v.tam) return 'ignorado';
    const idade = agora - v.mtime, k = org.id + '|' + v.rel;
    if (porPedido && idade >= 10000) { recentes.delete(k); return 'pronto'; }
    if (idade >= RECENTE_MS) { recentes.delete(k); return 'pronto'; }
    const a = recentes.get(k);
    if (!a || a.tam !== v.tam || a.mtime !== v.mtime) {
      if (recentes.size >= MAX_RECENTES) recentes.delete(recentes.keys().next().value);
      recentes.set(k, { org, rel: v.rel, tam: v.tam, mtime: v.mtime, desde: agora, visto: agora, pronto: false });
      return 'chegando';
    }
    a.visto = agora;
    // confirmado parado: fica marcado (o que continua na pasta — esperando o original, "fica" — não volta a "chegando")
    if (a.pronto || (agora - a.desde >= estavelMs && idade >= estavelMs)) { a.pronto = true; return 'pronto'; }
    return 'chegando';
  }

  // o ritmo pelo Google Drive (23/10/2026): um pedaço da leitura de mais de 60 s ou mais de 10 s por arquivo no lote, o lote
  // cai (40 → 10 → 5) e os lotes se espaçam (2 e 5 min); três lotes rápidos seguidos, volta um degrau. No ritmo normal, com
  // o Drive respondendo rápido (menos de 1,5 s por arquivo em três lotes seguidos), o lote sobe para LOTE_RAPIDO
  // 26/10/2026 (a migração de ~307 mil): sem pausa no primeiro degrau; só o Drive muito lento espaça os lotes (1 min)
  const RITMOS = [{ lote: null, esperaMs: 0 }, { lote: 20, esperaMs: 0 }, { lote: 10, esperaMs: 60000 }];
  const LOTE_RAPIDO = 100;
  const LOTE_OCR = +(process.env.ARQ_LOTE_OCR || 12);   // escaneados por lote do OCR (3 trabalhadores: 4 rodadas)
  let nivelRitmo = 0, rapidos = 0, proximoCicloEm = 0, folgados = 0;
  function medirRitmo(varreduraMs, porArquivoMs) {
    const antes = nivelRitmo;
    const lento = varreduraMs > 60000 || (porArquivoMs != null && porArquivoMs > 10000);
    const rapido = varreduraMs < 20000 && (porArquivoMs == null || porArquivoMs < 3000);
    if (lento) { nivelRitmo = Math.min(RITMOS.length - 1, nivelRitmo + 1); rapidos = 0; }
    else if (rapido && nivelRitmo) { if (++rapidos >= 3) { nivelRitmo--; rapidos = 0; } }
    else if (!rapido) rapidos = 0;
    folgados = !nivelRitmo && porArquivoMs != null && porArquivoMs < 1500 ? folgados + 1 : 0;
    const r = RITMOS[nivelRitmo];
    const texto = nivelRitmo ? 'Google Drive lento: indo devagar (lote de ' + r.lote + ', um lote a cada ' + Math.round(r.esperaMs / 60000) + ' min; ' + (varreduraMs > 60000 ? 'a leitura da pasta levou ' + Math.round(varreduraMs / 1000) + ' s' : 'leitura da pasta ok') + (porArquivoMs != null ? ', ' + (porArquivoMs / 1000).toFixed(1).replace('.', ',') + ' s por arquivo' : '') + ')' : null;
    if (nivelRitmo !== antes) o.log(texto || 'Google Drive rápido de novo: ritmo normal');
    if (o.painel) o.painel.fazendo('arquivador-novo-ritmo', texto);
    acomp.ritmo(texto);
    proximoCicloEm = Date.now() + r.esperaMs;
  }
  // os destinos ao mesmo tempo no G: (26/10/2026): até DESTINOS_MAX; o freio corta pela metade quando o Drive erra ou passa
  // de 4 s por arquivo, e três lotes bons seguidos sobem de 4 em 4
  const DESTINOS_MAX = 16, DESTINOS_MIN = 4;
  let destinosAgora = DESTINOS_MAX, destinosBons = 0;
  function freioDosDestinos(res) {
    const t = (res.tempos && res.tempos.porAcao) || {};
    const movidos = Object.values(t).reduce((s, v) => s + v.n, 0), ms = Object.values(t).reduce((s, v) => s + v.ms, 0);
    const erros = A.planos(res).filter(x => x.erro && !x.temporario).length;
    if (!movidos) return;
    const antes = destinosAgora;
    if (erros > Math.max(1, movidos * 0.05) || ms / movidos > 4000) { destinosAgora = Math.max(DESTINOS_MIN, Math.floor(destinosAgora / 2)); destinosBons = 0; }
    else if (++destinosBons >= 3) { destinosAgora = Math.min(DESTINOS_MAX, destinosAgora + 4); destinosBons = 0; }
    if (destinosAgora !== antes) o.log('destinos juntos no G: ' + antes + ' → ' + destinosAgora + ' (' + erros + ' erro(s), ' + (ms / movidos / 1000).toFixed(1) + ' s por arquivo)');
  }
  const destinosJuntos = () => (nivelRitmo === 0 ? destinosAgora : nivelRitmo === 1 ? Math.min(destinosAgora, 4) : 2);
  const loteAgora = (cfg, porPedido) => porPedido ? 400 : nivelRitmo ? Math.min(cfg.lote, RITMOS[nivelRitmo].lote) : folgados >= 3 ? Math.max(cfg.lote, LOTE_RAPIDO) : cfg.lote;

  /** zip ainda chegando: o diretório central não está lá. */
  function zipInteiro(raiz, rel) {
    if (!/\.zip$/i.test(rel)) return true;
    // o pacote de transmissão do Sintegra (TED) tem extensão .zip e nunca abre como zip: não está "chegando" (27/10/2026)
    try { const b = fs.readFileSync(path.join(raiz, rel)); if (A.ehTedSintegra(b)) return true; A.abrirZip(b); return true; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // a passada
  // ---------------------------------------------------------------------------------------------------------------------
  const mudados = new Set();
  let ultimaInteiraEm = 0;
  let modoDaInteira = '';        // 'P'/'S' da última passada inteira que chegou ao fim
  let vez = [];                  // os pedidos do site (exclusivo) que esperam o fim do lote
  const feitosEm = [];           // a hora de cada decisão (o ritmo por minuto e a previsão)
  let leitura = null;            // a passada de agora: { inicio, inteira, porOrigem: { id: { lidos, achados, feitos, total } } }
  let progressoEm = 0, salvoEm = 0;
  const mil = n => Math.round(n).toLocaleString('pt-BR');
  const porMinuto = () => { const agora = Date.now(); while (feitosEm.length && agora - feitosEm[0] > 10 * 60000) feitosEm.shift(); if (feitosEm.length < 2) return 0; return feitosEm.length / Math.max(1, (agora - feitosEm[0]) / 60000); };
  const duracao = min => min < 1 ? 'menos de 1 min' : min < 60 ? Math.round(min) + ' min' : min < 48 * 60 ? (Math.round(min / 6) / 10).toString().replace('.', ',') + ' h' : Math.round(min / 1440) + ' dias';
  /** A fila de cada origem: os achados prontos que ainda não foram feitos + a parte ainda não lida (pela proporção desta passada). */
  // ---------------------------------------------------------------------------------------------------------------------
  // a contagem da pasta (26/10/2026: o painel mostrava "1.229 na pasta" com ~307 mil lá dentro: a passada lê aos poucos e só
  // sabe o total no fim, que nunca chegava). Só a listagem (nada é aberto nem medido): ao ligar e a cada 2 h, gravada no
  // estado (sobrevive ao robô religado) e descontada a cada arquivo que sai da pasta.
  // ---------------------------------------------------------------------------------------------------------------------
  const CONTAR_A_CADA_MS = 2 * 36e5;
  let contando = false;
  const contados = id => { const c = (estado.contagem || {})[id]; return c ? Math.max(0, c.arquivos) : 0; };
  async function contarPasta() {
    if (contando || parado || !fs.existsSync(o.origem)) return;
    const c = (estado.contagem || {})['G:'];
    if (c && Date.now() - Date.parse(c.em) < CONTAR_A_CADA_MS) return;
    contando = true;
    const t0 = Date.now(), inicio = new Date().toISOString();
    let n = 0, falhou = false;
    try {
      const pilha = [''];
      while (pilha.length && !parado) {
        const rel = pilha.pop();
        let es;
        try { es = await fs.promises.readdir(rel ? path.join(o.origem, rel) : o.origem, { withFileTypes: true }); } catch (e) { if (!rel) falhou = true; continue; }
        for (const e of es) {
          const r = rel ? rel + '\\' + e.name : e.name;
          if (e.isDirectory()) { if (incluir(r, true)) pilha.push(r); }
          else if (incluir(r, false) && !C_ehTemporario(r)) n++;
        }
      }
      // o G: que sumiu no meio não vale (a contagem fica com a anterior)
      if (!falhou && !parado && fs.existsSync(o.origem)) {
        estado.contagem = Object.assign({}, estado.contagem, { 'G:': { arquivos: n, em: inicio, ms: Date.now() - t0 } });
        salvar();
        o.log('contei a pasta: ' + mil(n) + ' arquivo(s) em ' + Math.round((Date.now() - t0) / 1000) + ' s');
      }
    } catch (e) { o.log('não contei a pasta:', e.message); }
    finally { contando = false; }
  }
  function filas() {
    const out = {};
    for (const [id, p] of Object.entries((leitura && leitura.porOrigem) || {})) {
      const total = Math.max(p.total || 0, p.lidos);
      const proporcao = p.lidos ? p.achados / p.lidos : 1;
      out[id] = Math.max(0, p.achados - p.feitos) + (leitura.inteira ? Math.max(0, total - p.lidos) * proporcao : 0);
    }
    return out;
  }
  function textoDoProgresso() {
    if (!leitura) return null;
    const ps = Object.values(leitura.porOrigem);
    const lidos = ps.reduce((s, p) => s + p.lidos, 0), total = ps.reduce((s, p) => s + Math.max(p.total || 0, p.lidos), 0);
    const f = filas(), g = Math.round(f['G:'] || 0), local = Math.round(Object.entries(f).filter(([k]) => k !== 'G:').reduce((s, [, n]) => s + n, 0));
    const ritmo = porMinuto();
    const partes = [(leitura.inteira ? 'Lendo a pasta: ' + mil(lidos) + (total > lidos ? ' de ~' + mil(total) : '') + ' arquivos' : 'Conferindo o que chegou: ' + mil(lidos) + ' arquivo(s)'),
      mil(g) + ' na fila (G:)' + (ps.length > 1 ? ' + ' + mil(local) + ' na fila (local)' : '')];
    if (ritmo) partes.push(mil(ritmo) + '/min' + (g + local ? ' · faltam ~' + duracao((g + local) / ritmo) : ''));
    return partes.join(' · ');
  }
  function publicarProgresso(forcar) {
    if (!forcar && Date.now() - progressoEm < 5000) return;
    progressoEm = Date.now();
    const texto = textoDoProgresso();
    if (o.painel) o.painel.fazendo('arquivador-novo-leitura', texto);
    acomp.leitura(texto ? { texto, filas: filas(), porMinuto: Math.round(porMinuto()), em: new Date().toISOString() } : null);
  }
  const salvarDeVezEmQuando = () => { if (Date.now() - salvoEm >= 30000) { salvoEm = Date.now(); salvar(); } };
  /** A vez dos pedidos do site entre um lote e outro (a passada pode levar horas). */
  async function darAVez() {
    while (vez.length) { const p = vez.shift(); try { p.ok(await p.fn()); } catch (e) { p.erro(e); } }
  }
  const dormir = ms => new Promise(r => { const t = setTimeout(r, ms); const tic = setInterval(() => { if (parado || vez.length) { clearTimeout(t); clearInterval(tic); r(); } }, 1000); setTimeout(() => clearInterval(tic), ms + 10); });

  /**
   * Um ciclo. opcoes: { porPedido: true } = o botão "Arquivar agora" do nads (o arquivador.js já está "ocupado" com o
   * pedido: não espera por ele; arquivo parado há 10 s já vale). Devolve o resumo
   * { decididos, arquivou, arquivaria, jaArquivado, naoIdentificado, fica, erros, restantes, esperando }.
   */
  async function ciclo(op) {
    op = op || {};
    const resumo = { decididos: 0, arquivou: 0, arquivaria: 0, jaArquivado: 0, naoIdentificado: 0, fica: 0, erros: 0, restantes: 0, esperando: null };
    if (rodando || parado) { resumo.esperando = rodando ? 'um ciclo já está rodando' : 'parado'; return resumo; }
    const cfg = lerConfig(CONFIG, configBanco);
    anunciarModo(cfg);
    acomp.config(cfg);
    // desligado: não arquiva nada, mas a lista Para resolver (e os grupos) segue em dia — só lê NÃO IDENTIFICADOS
    if (cfg.modo === 'desligado') { resumo.esperando = 'o arquivador novo está desligado no config'; try { await conferirNaoIdentificados(); } catch (e) { /* só a lista */ } return resumo; }
    // o G: some quando o Google Drive desconecta: espera voltar (sem concluir que os arquivos "sumiram")
    if (!fs.existsSync(o.origem)) {
      if (!avisouSemDrive) { o.log('a pasta de origem não está acessível (' + o.origem + '): espero o Google Drive voltar'); avisouSemDrive = true; }
      if (o.painel) o.painel.fazendo('arquivador-novo', 'Esperando o Google Drive (G:) voltar');
      acomp.situacao('sem-drive');
      resumo.esperando = 'o Google Drive (G:) não está acessível';
      return resumo;
    }
    if (avisouSemDrive) { o.log('a pasta de origem voltou'); avisouSemDrive = false; if (o.painel) o.painel.fazendo('arquivador-novo', null); }
    if (!observador) vigiar();
    const motivo = outraExecucao(op.porPedido);
    acomp.situacao(motivo ? 'esperando' : 'ok', motivo);
    if (motivo) { if (o.painel) o.painel.fazendo('arquivador-novo', 'Esperando: ' + motivo); resumo.esperando = motivo; return resumo; }
    if (o.painel) o.painel.fazendo('arquivador-novo', null);
    // o Drive lento: os ciclos se espaçam (o botão do nads passa na frente)
    if (!op.porPedido && Date.now() < proximoCicloEm) { resumo.esperando = 'Google Drive lento: o próximo ciclo em ' + Math.ceil((proximoCicloEm - Date.now()) / 1000) + ' s'; return resumo; }
    rodando = true;
    let comTrava = false;
    try {
      const origens = origensDe(cfg);
      // o modo mudou desde a última passada inteira completa: a próxima é inteira, já (26/10/2026: a troca para produção
      // parou a passada no meio e, por 15 min, só os eventos do fs.watch entravam: lotes de 6 a 8, nada da pilha antiga)
      const modoAgora = cfg.emProducao ? 'P' : 'S';
      const inteira = !observador || mudados.has('*') || Date.now() - ultimaInteiraEm >= PASSADA_INTEIRA_MS || !ultimaInteiraEm || modoDaInteira !== modoAgora || op.porPedido || o.umaVez;
      if (inteira) { mudados.clear(); ultimaInteiraEm = Date.now(); }
      const totais = estado.totais || {};
      leitura = { inicio: Date.now(), inteira, porOrigem: Object.fromEntries(origens.map(g => [g.id, { lidos: 0, achados: 0, feitos: 0, total: inteira ? Math.max(totais[g.id] || 0, contados(g.id)) : 0 }])) };
      const estavelMs = op.porPedido ? Math.min(cfg.estavelMs, 10000) : cfg.estavelMs;
      const modoChave = cfg.emProducao ? 'P' : 'S';   // o que a simulação decidiu volta a ser avaliado em produção
      estado.aguardando = estado.aguardando || {};
      const esperaMs = Math.max(0, +cfg.esperaOriginalHoras || 0) * 36e5;
      const vistosDecididos = new Set();
      const amostra = { vistos: [], pendentes: [], aguardando: [] };
      const conta = { naPasta: 0, chegando: 0, naFila: 0, esperandoOriginal: 0, parados: 0 };
      let completa = true;
      // os pedaços: as origens se revezam (a carga do G: não segura a entrada local, e vice-versa)
      const fontes = origens.map(g => ({ org: g, it: inteira ? andarEmFluxo(g.raiz) : (g.principal ? doQueMudou(g) : andarEmFluxo(g.raiz)) }));
      const prontos = [];   // [{ org, v }]
      // os escaneados desta passada (26/10/2026): saem do lote comum e são lidos em lotes do OCR, vários ao mesmo tempo
      const filaOcr = [];   // [{ org, v }]
      const opLote = Object.assign({}, op, { filaOcr }), opOcr = Object.assign({}, op, { loteOcr: true });
      let listagemMs = 0;
      const tratarPedaco = async (org, rels) => {
        const t0 = Date.now();
        const vs = await conferirTamanhos(org.raiz, rels);
        listagemMs = Math.max(listagemMs, Date.now() - t0);
        const agora = Date.now();
        const p = leitura.porOrigem[org.id];
        for (const v of vs) {
          if (!v) continue;
          p.lidos++; conta.naPasta++;
          avaliar(org, v, situacaoDe(org, v, agora, estavelMs, op.porPedido));
        }
      };
      /** Onde o arquivo entra: parado (já decidido), chegando, esperando o original, ou na fila. */
      function avaliar(org, v, s) {
        if (s === 'ignorado') return;
        const k = chaveDe(org, v.rel, v);
        if (estado.decididos[k + '|' + modoChave]) { vistosDecididos.add(k + '|' + modoChave); conta.parados++; return; }
        if (s === 'chegando') { conta.chegando++; if (amostra.vistos.length < 300) amostra.vistos.push(v); return; }
        const e = estado.aguardando[k];
        // o evento esperando o original volta quando o índice mudou, a cada 10 min, ou logo que a espera vence
        const versaoIdx = cache.chaves ? cache.chaves.versao + ':' + cache.em : '';
        if (e && !(e.versao !== versaoIdx || Date.now() - e.tentativa >= 10 * 60000 || (Date.now() - e.desde >= esperaMs && e.tentativa - e.desde < esperaMs))) { conta.esperandoOriginal++; if (amostra.aguardando.length < 100) { amostra.aguardando.push(v.rel); amostra.vistos.push(v); } return; }
        leitura.porOrigem[org.id].achados++; conta.naFila++;
        if (amostra.pendentes.length < 200) { amostra.pendentes.push(v.rel); amostra.vistos.push(v); }
        prontos.push({ org, v });
      }
      /** Os que estavam chegando e já podem estar prontos: confere de novo só esses (sem esperar a próxima passada). */
      async function conferirRecentes() {
        const agora = Date.now();
        const vencidos = [...recentes.values()].filter(r => !r.pronto && agora - r.desde >= estavelMs && agora - r.mtime >= estavelMs).slice(0, 500);
        for (const r of vencidos) {
          if (!leitura.porOrigem[r.org.id]) continue;
          let st = null;
          try { st = await fs.promises.stat(path.join(r.org.raiz, r.rel)); } catch (e) { recentes.delete(r.org.id + '|' + r.rel); continue; }
          const v = { rel: r.rel, tam: st.size, mtime: st.mtimeMs };
          const s = situacaoDe(r.org, v, Date.now(), estavelMs, false);
          if (s !== 'pronto' || prontos.some(x => x.org.id === r.org.id && x.v.rel === v.rel)) continue;
          if (r.visto >= leitura.inicio) conta.chegando = Math.max(0, conta.chegando - 1);   // já contado como chegando nesta passada
          avaliar(r.org, v, s);
        }
      }
      // a pasta para o site: uma amostra da lista e os números de tudo; faltam = a fila estimada (abre e fecha a passada)
      let informadoEm = 0;
      const informarPasta = (fim) => {
        if (!fim && Date.now() - informadoEm < 5000 && informadoEm) return;
        informadoEm = Date.now();
        const f = filas();
        const faltam = fim ? prontos.length : Math.max(prontos.length, Math.round(Object.values(f).reduce((s, n) => s + n, 0)));
        // a amostra só com o que ainda está na fila, chegando ou esperando (o que já foi decidido sai)
        const naFila = new Set(prontos.map(x => x.v.rel)), esperando = new Set(amostra.aguardando);
        amostra.pendentes = amostra.pendentes.filter(r => naFila.has(r));
        amostra.vistos = amostra.vistos.filter(v => naFila.has(v.rel) || esperando.has(v.rel) || (recentes.get('G:|' + v.rel) || {}).pronto === false);
        // na pasta: o que esta passada já leu ou a contagem (a passada lê aos poucos; a contagem sabe o total)
        const contagem = Object.assign({}, conta, { naPasta: Math.max(conta.naPasta, contados('G:')) });
        acomp.varredura({ vistos: amostra.vistos, mapa: new Map([...recentes.values()].filter(r => r.org.principal && !r.pronto).slice(0, 300).map(r => [r.rel, r])), pendentes: amostra.pendentes, estavelMs, aguardando: amostra.aguardando, contagem, faltam });
      };
      /** Esvazia os lotes enquanto houver pelo menos "ate" prontos. Devolve false quando a passada tem de parar. */
      const drenar = async (ate) => {
        while (prontos.length && prontos.length >= ate && !parado) {
          // o config relido antes de CADA lote: mudou o modo, os tipos em produção ou o mover dos não identificados, a
          // passada para aqui e a próxima começa com o config novo (23/10/2026)
          const agoraCfg = lerConfig(CONFIG, configBanco);
          anunciarModo(agoraCfg);
          if (mudouOConfig(cfg, agoraCfg)) { o.log('o config mudou no meio da passada (' + resumoDoConfig(cfg) + ' → ' + resumoDoConfig(agoraCfg) + '): paro aqui; a próxima volta segue o config novo'); acomp.config(agoraCfg); resumo.esperando = 'o config mudou'; return false; }
          if (!comTrava) { if (!pegarTrava()) { o.log('outro processo do arquivador novo está trabalhando'); resumo.esperando = 'outro processo do arquivador novo está trabalhando'; return false; } comTrava = true; }
          informarPasta(false);
          const r2 = await processarLote(prontos.splice(0, loteAgora(cfg, op.porPedido)), cfg, opLote, resumo, modoChave, esperaMs, listagemMs);
          listagemMs = 0;
          tocarTrava();
          publicarProgresso(true);
          await darAVez();
          // a rotina antiga começou no meio: para aqui (o resto vem na próxima passada)
          const m2 = outraExecucao(op.porPedido);
          if (m2) { acomp.situacao('esperando', m2); resumo.esperando = m2; return false; }
          if (!op.porPedido && r2.esperaMs && (prontos.length || fontes.length)) await dormir(r2.esperaMs);
          // o lote do OCR sai com 3 lotes na fila: os 12 mais antigos já estão sendo lidos desde que foram separados
          if (!(await drenarOcr(LOTE_OCR * 3))) return false;
        }
        return !parado;
      };
      /** Os lotes do OCR, enquanto houver pelo menos "ate" escaneados na fila. */
      const drenarOcr = async (ate) => {
        while (filaOcr.length && filaOcr.length >= ate && !parado) {
          const agoraCfg = lerConfig(CONFIG, configBanco);
          if (mudouOConfig(cfg, agoraCfg)) { resumo.esperando = 'o config mudou'; return false; }
          await processarLote(filaOcr.splice(0, LOTE_OCR), cfg, opOcr, resumo, modoChave, esperaMs, 0);
          tocarTrava();
          publicarProgresso(true);
          await darAVez();
          const m2 = outraExecucao(op.porPedido);
          if (m2) { acomp.situacao('esperando', m2); resumo.esperando = m2; return false; }
        }
        return !parado;
      };
      let seguir = true;
      while (seguir && fontes.length && !parado) {
        for (let i = 0; seguir && i < fontes.length && !parado; i++) {
          const f = fontes[i];
          const r = await f.it.next();
          if (r.done) { fontes.splice(i--, 1); continue; }
          await tratarPedaco(f.org, r.value);
          publicarProgresso();
          seguir = await drenar(loteAgora(cfg, op.porPedido));
        }
        // o que estava chegando e já parou de mudar (sem esperar a próxima passada)
        if (seguir) await conferirRecentes();
      }
      if (seguir) { await conferirRecentes(); seguir = await drenar(1); }
      if (seguir) seguir = await drenarOcr(1);
      if (!seguir) { completa = false; for (const f of fontes) { try { await f.it.return(); } catch (e) { /* já fechou */ } } }
      if (parado) completa = false;
      // a passada inteira que parou no meio (o config mudou, a rotina antiga, o robô parando) não conta: a próxima é inteira
      if (inteira) { if (completa) modoDaInteira = modoChave; else ultimaInteiraEm = 0; }
      resumo.restantes = prontos.length;
      // a pasta agora (a lista do site mostra só uma amostra; os números são de tudo)
      informarPasta(true);
      if (o.depurar) o.log('leitura ' + (inteira ? 'inteira' : 'do que mudou') + ': ' + JSON.stringify(leitura.porOrigem) + ' · ' + JSON.stringify(conta));
      // a passada inteira terminou: o total de cada origem (a estimativa da próxima) e os "já decididos" que saíram da pasta
      if (inteira && completa) {
        estado.totais = Object.fromEntries(Object.entries(leitura.porOrigem).map(([id, p]) => [id, p.lidos]));
        // o que estava chegando e não foi visto nesta passada saiu da pasta
        for (const [k, r] of recentes) if (r.visto < leitura.inicio && origens.some(g => g.id === r.org.id)) recentes.delete(k);
        const ids = new Set(origens.map(g => g.id));
        for (const k of Object.keys(estado.decididos)) {
          if (vistosDecididos.has(k) || estado.decididos[k] >= leitura.inicio) continue;   // visto agora, ou decidido nesta passada
          const extra = /^local:/.test(k) ? k.slice(0, k.indexOf('|')) : 'G:';
          if (ids.has(extra)) delete estado.decididos[k];
        }
        salvar();
        // a passada inteira terminou: as pastas que ficaram vazias saem da Claudio Secretario (27/10/2026)
        if (cfg.emProducao) { try { await limparPastasVazias(o.origem); } catch (e) { o.log('não limpei as pastas vazias:', e.message); } }
      }
    } catch (err) { if (leitura && leitura.inteira) ultimaInteiraEm = 0; o.log('erro no ciclo:', err.message); atividade('O arquivador novo deu erro', err.message, true); acomp.erro(err.message); resumo.esperando = 'erro: ' + err.message; }
    finally {
      if (comTrava) soltarTrava();
      rodando = false;
      leitura = null;
      publicarProgresso(true);
      if (o.painel) o.painel.fazendo('arquivador-novo', null);
      await darAVez();
      try { await conferirNaoIdentificados(); } catch (e) { o.log('não conferi NÃO IDENTIFICADOS:', e.message); }
      await compararSeForHora();
    }
    return resumo;
  }
  /** O modo em vigor no painel e no log: "modo: produção, lido às 16:20" (a cada volta; no log quando muda). */
  let modoAnunciado = '';
  const resumoDoConfig = c => c.modo + (c.modo === 'producao' ? ' (' + (c.emProducao ? (c.tiposProducao || []).join(', ') : 'nenhum tipo') + (c.moverNaoIdentificados ? ', move os não identificados' : '') + ')' : '');
  const mudouOConfig = (a, b) => a.modo !== b.modo || a.emProducao !== b.emProducao || JSON.stringify(a.tiposProducao) !== JSON.stringify(b.tiposProducao) || !!a.moverNaoIdentificados !== !!b.moverNaoIdentificados;
  function anunciarModo(c) {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const r = resumoDoConfig(c);
    const de = c.origem ? ' de ' + c.origem : '';
    if (r + de !== modoAnunciado) { o.log('modo: ' + r + ', lido às ' + hora + de); modoAnunciado = r + de; }
    if (o.painel) o.painel.fazendo('arquivador-novo-modo', 'modo: ' + r + ', lido às ' + hora + de);
    publicarEstado({ modoEmVigor: { modo: c.modo, emProducao: !!c.emProducao, tiposProducao: c.tiposProducao || [], origem: c.origem || null, lidoEm: new Date().toISOString() } });
  }
  /** Entre as passadas inteiras: só o que o fs.watch avisou (o nome relativo à origem; pasta nova = a pasta inteira). */
  async function* doQueMudou(org) {
    const nomes = [...mudados]; mudados.clear();
    let pedaco = [];
    for (const nome of nomes) {
      const rel = String(nome).replace(/\//g, '\\');
      let st = null;
      try { st = await fs.promises.stat(path.join(org.raiz, rel)); } catch (e) { continue; /* saiu (arquivado, movido, apagado) */ }
      if (st.isDirectory()) { if (incluir(rel, true)) yield* andarEmFluxo(org.raiz, rel); continue; }
      if (!incluir(rel, false)) continue;
      pedaco.push(rel);
      if (pedaco.length >= PEDACO) { yield pedaco; pedaco = []; }
    }
    if (pedaco.length) yield pedaco;
  }
  /** Um lote: decide e (em produção) aplica, por origem. Devolve { esperaMs } (o ritmo pelo Drive). */
  async function processarLote(itens, cfg, op, resumo, modoChave, esperaMs, listagemMs) {
    await garantirContexto();
    if (!buscaSieg) buscaSieg = K.criarBuscaSieg({ controle: o.controle, sieg: siegDoRobo(), limiteDia: cfg.siegPorDia, log: m => o.log(m) });
    const versaoIdx = cache.chaves ? cache.chaves.versao + ':' + cache.em : '';
    let porArquivoMs = null;
    const porOrigem = new Map();
    for (const x of itens) { if (!porOrigem.has(x.org.id)) porOrigem.set(x.org.id, { org: x.org, vs: [] }); porOrigem.get(x.org.id).vs.push(x.v); }
    for (const { org, vs } of porOrigem.values()) {
      const lote = vs.filter(v => zipInteiro(org.raiz, v.rel)).map(v => v.rel);
      if (!lote.length) continue;
      const porRel = new Map(vs.map(v => [v.rel, v]));
      const esperaVencida = rel => { const v = porRel.get(rel); const e = v && estado.aguardando[chaveDe(org, rel, v)]; return !!e && Date.now() - e.desde >= esperaMs; };
      const tLote = Date.now();
      acomp.lendo(lote);
      if (o.painel) o.painel.fazendo('arquivador-novo', (cfg.modo === 'producao' ? 'Arquivando ' : 'Simulando ') + lote.length + ' arquivo(s) da ' + (org.principal ? 'Claudio Secretario' : 'entrada local'));
      const res = await A.executar({
        modo: cfg.emProducao ? 'PRODUCAO' : 'SIMULACAO', confirmo: true, origem: org.raiz, controle: o.controle, clientes: o.clientes,
        pastaNaoIdentificados: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-NOVO', raizNaoIdentificados: o.origem, travaAntiga: path.join(o.controleAntigo, '_execucao.lock'),
        // vários destinos ao mesmo tempo (23/10/2026): 6 no ritmo normal, 8 com o Drive folgado, 2 e 1 com ele lento
        destinosJuntos: destinosJuntos(),
        // o escaneado vai para a fila do OCR (o lote não espera a imagem); no lote do OCR, vários ao mesmo tempo
        adiarOcr: !op.loteOcr, manterOcr: true,
        arquivos: lote, marcas: porRel, cadastro: cache.cadastro, contas: cache.contas, manifesto: cache.manifesto, conteudos: cache.conteudos, tiposProducao: cfg.tiposProducao, moverNaoIdentificados: !!cfg.moverNaoIdentificados,
        chaves: cache.chaves, buscaSieg, esperaVencida, manifestoAntigo: path.join(o.controleAntigo, 'MANIFESTO', 'manifesto.jsonl'),
        painel: cfg.modo === 'producao' ? { atividade: (t, x, d) => atividade(x, d), erro: (t, x, d) => atividade(x, d, true) } : null,
        registrar: false, log: () => {},
      });
      registrar(res, lote, porRel, cfg, resumo, modoChave, versaoIdx, org);
      if (cfg.emProducao) freioDosDestinos(res);
      // os escaneados deste lote: para a fila do OCR da passada (não contam como feitos ainda)
      const adiados = res.itens.filter(x => x.acao === 'AGUARDANDO_OCR').map(x => porRel.get(x.rel)).filter(Boolean);
      if (op.filaOcr) for (const v of adiados) op.filaOcr.push({ org, v });
      const ms = Date.now() - tLote;
      for (let i = 0; i < lote.length - adiados.length; i++) feitosEm.push(Date.now());
      if (leitura && leitura.porOrigem[org.id]) leitura.porOrigem[org.id].feitos += lote.length - adiados.length;
      // o tempo por arquivo (ler, decidir, levar ao destino pelo Drive)
      porArquivoMs = Math.max(porArquivoMs || 0, ms / Math.max(1, lote.length));
      const t = res.tempos || {};
      o.log((op.loteOcr ? 'lote do OCR de ' : 'lote de ') + lote.length + (org.principal ? '' : ' (local)') + (adiados.length ? ' (' + adiados.length + ' escaneado(s) para a fila do OCR)' : '') + ' em ' + (ms / 1000).toFixed(1) + ' s: leitura ' + ((t.leituraMs || 0) / 1000).toFixed(1) + ' s, decisão ' + ((t.decisaoMs || 0) / 1000).toFixed(1) + ' s, destino ' + ((t.gravacaoMs || 0) / 1000).toFixed(1) + ' s (' + destinosJuntos() + ' juntos' + (t.porAcao ? ': ' + Object.entries(t.porAcao).map(([k, v]) => k + ' ' + v.n + ' × ' + (v.ms / v.n / 1000).toFixed(2) + ' s').join(', ') : '') + ') · listagem ' + (listagemMs / 1000).toFixed(1) + ' s');
    }
    if (o.painel) o.painel.fazendo('arquivador-novo', null);
    if (op.porPedido) return { esperaMs: 0 };
    // o lote do OCR é lento por natureza (a leitura da imagem): não conta como Drive lento
    if (op.loteOcr) return { esperaMs: 0 };
    medirRitmo(listagemMs, porArquivoMs);
    return { esperaMs: RITMOS[nivelRitmo].esperaMs };
  }

  /** Diário, contagem do mês e painel. */
  function registrar(res, lote, porRel, cfg, resumo, modoChave, versaoIdx, org) {
    org = org || { id: 'G:', principal: true };
    const mes = new Date().toISOString().slice(0, 7);
    const diario = path.join(pasta, 'decisoes-' + mes + '.jsonl');
    const m = estado.mes[mes] || (estado.mes[mes] = { arquivou: 0, arquivaria: 0, jaArquivado: 0, naoIdentificado: 0, pastasNovas: 0 });
    const linhas = [];
    const planos = A.planos(res).filter(x => x.acao !== 'CONTEINER' && x.acao !== 'AGUARDANDO_OCR');
    acomp.decisoes(planos, res.modo);
    const simulados = [];
    for (const x of planos) {
      // o não identificado movido para NÃO IDENTIFICADOS também foi aplicado (o diário dizia SIMULACAO; 26/10/2026)
      const aplicado = res.modo === 'PRODUCAO' && !x.naoAplicado && !x.erro && (x.acao === 'ARQUIVAR' || x.acao === 'JA_ARQUIVADO' || !!x.movidoPara);
      if (x.acao === 'AGUARDANDO_ORIGINAL') { resumo.aguardando = (resumo.aguardando || 0) + 1; continue; }   // volta no próximo ciclo; não conta nem vai ao diário
      linhas.push(JSON.stringify({ em: new Date().toISOString(), modo: aplicado ? 'PRODUCAO' : 'SIMULACAO', rel: x.rel, hash: x.hash, acao: x.acao, motivo: x.motivo, tipo: x.tipo, confianca: x.confianca, onde: x.onde || x.movidoPara || null, destinoSugerido: x.destinoSugerido || null, copias: (x.copias || []).map(c => c.onde), pastaNova: !!x.criarPastaCliente, erro: x.erro || null, chave: x.chave || null, viaSieg: x.viaSieg || undefined }));
      resumo.decididos++;
      if (x.erro) resumo.erros++;
      if (x.acao === 'ARQUIVAR') { if (aplicado) { m.arquivou++; resumo.arquivou++; } else { m.arquivaria++; resumo.arquivaria++; simulados.push(x); } if (x.criarPastaCliente) m.pastasNovas++; }
      else if (x.acao === 'JA_ARQUIVADO') { m.jaArquivado++; resumo.jaArquivado++; }
      else if (x.acao === 'NAO_IDENTIFICADO') { m.naoIdentificado++; resumo.naoIdentificado++; }
      else resumo.fica++;
    }
    fs.appendFileSync(diario, linhas.join('\n') + (linhas.length ? '\n' : ''));
    // o que saiu da pasta sai da contagem (o compactado conta uma vez, pelo de fora)
    if (org.principal && estado.contagem && estado.contagem['G:']) {
      const sairam = new Set(planos.filter(x => res.modo === 'PRODUCAO' && !x.naoAplicado && !x.erro && (x.acao === 'ARQUIVAR' || x.acao === 'JA_ARQUIVADO' || x.acao === 'DESCARTAR' || !!x.movidoPara)).map(x => x.dentroDe || x.rel));
      estado.contagem['G:'].arquivos = Math.max(0, estado.contagem['G:'].arquivos - sairam.size);
    }
    // em produção, o que deu erro (o Google Drive às vezes falha um rename/leitura no G:) volta no próximo ciclo, até 3 vezes;
    // o destino nunca é sobrescrito, então tentar de novo é seguro (o que já foi gravado vira "já arquivado")
    const comErro = new Set(res.modo === 'PRODUCAO' ? A.planos(res).filter(x => x.erro).map(x => x.dentroDe || x.rel) : []);
    // o erro de leitura temporário (o arquivo ainda subindo de outro PC, preso por outro programa; 23/10/2026): tenta de novo,
    // até 5 vezes, em qualquer modo
    const temporarios = new Set(res.itens.filter(x => x.temporario).map(x => x.rel));
    estado.tentativas = estado.tentativas || {};
    // o evento que espera o documento original: não fica decidido; anota desde quando espera (a espera vence em
    // esperaOriginalHoras) e com que versão do índice tentou (volta quando o índice muda, ou em 10 min)
    const esperam = new Set(A.planos(res).filter(x => x.acao === 'AGUARDANDO_ORIGINAL').map(x => x.dentroDe || x.rel));
    const naFilaDoOcr = new Set(res.itens.filter(x => x.acao === 'AGUARDANDO_OCR').map(x => x.rel));   // volta no lote do OCR
    estado.aguardando = estado.aguardando || {};
    for (const rel of lote) {
      const v = porRel.get(rel); if (!v) continue;
      const ka = chaveDe(org, rel, v);
      if (esperam.has(rel)) { estado.aguardando[ka] = { desde: (estado.aguardando[ka] && estado.aguardando[ka].desde) || Date.now(), tentativa: Date.now(), versao: versaoIdx }; continue; }
      delete estado.aguardando[ka];
      if (naFilaDoOcr.has(rel)) continue;
      const k = ka + '|' + modoChave;
      if (temporarios.has(rel) && (estado.tentativas[k] = (estado.tentativas[k] || 0) + 1) < 5) continue;
      if (comErro.has(rel) && (estado.tentativas[k] = (estado.tentativas[k] || 0) + 1) < 3) continue;
      delete estado.tentativas[k];
      estado.decididos[k] = Date.now();
    }
    // "arquivaria" no painel: um a um quando é pouco; resumo quando é a pilha antiga
    if (simulados.length && simulados.length <= 5) simulados.forEach(x => atividade('Arquivaria ' + x.nome + ' em ' + (x.onde || '').replace(/^G:\\Meu Drive\\2026\\/, '').split('\\')[0], 'simulação · ' + (x.onde || '') + ' · ' + Math.round((x.confianca || 0) * 100) + '%'));
    else if (simulados.length) atividade('Arquivaria ' + simulados.length + ' arquivo(s) da Claudio Secretario (simulação)', simulados.slice(0, 5).map(x => x.nome).join(', ') + (simulados.length > 5 ? '…' : ''));
    publicarEstado({ mes, contagem: m, modo: cfg.modo, tiposProducao: cfg.tiposProducao, ultimaEm: new Date().toISOString() });
    // limpa o "já decidido" de mais de 40 dias (o arquivo some da pasta quando é arquivado)
    const limite = Date.now() - 40 * 864e5;
    for (const [k, t] of Object.entries(estado.decididos)) if (t < limite) delete estado.decididos[k];
    for (const [k, e] of Object.entries(estado.aguardando || {})) if (e.tentativa < limite) delete estado.aguardando[k];
    salvarDeVezEmQuando();
  }

  /** Uma vez por dia, depois da rotina das 9h: o lado a lado (publicado no painel e gravado no controle). */
  /**
   * O que está HOJE em NÃO IDENTIFICADOS: a última linha de cada arquivo no _nao_identificados.jsonl de cada subpasta,
   * só dos que ainda estão lá. Vai para a lista "Para resolver" do acompanhamento (a cada 10 min e no começo).
   */
  let conferidoNiEm = 0;
  // 23/10/2026: assíncrona (com 1.600 não identificados, um stat por arquivo no G: segurava o robô um minuto)
  async function conferirNaoIdentificados(forcar) {
    if (!forcar && Date.now() - conferidoNiEm < 10 * 60000) return;
    conferidoNiEm = Date.now();
    const pastaNi = path.join(o.origem, 'NÃO IDENTIFICADOS');
    let subs = [];
    try { subs = (await fs.promises.readdir(pastaNi, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { return; }
    const ultimos = new Map();
    for (const sub of subs) {
      let texto = '';
      try { texto = await fs.promises.readFile(path.join(pastaNi, sub, '_nao_identificados.jsonl'), 'utf8'); } catch (e) { continue; }
      for (const l of texto.split(/\r?\n/)) {
        let j; try { j = JSON.parse(l); } catch (e) { continue; }
        if (!j || !j.arquivo) continue;
        const dir = j.caminho_relativo && j.caminho_relativo !== '.' ? j.caminho_relativo : '';
        ultimos.set(path.join(sub, dir, j.arquivo), Object.assign({ sub, dir }, j));
      }
    }
    // a varredura real (23/10/2026: "todo arquivo que está de fato em NÃO IDENTIFICADOS tem de aparecer"): o que está na
    // pasta sem linha no índice entra com o motivo SEM_MOTIVO_REGISTRADO
    const naPasta = [];
    await (async function andar(d, rel) {
      let l = []; try { l = await fs.promises.readdir(d, { withFileTypes: true }); } catch (e) { return; }
      for (const e of l) { const r = rel ? rel + '\\' + e.name : e.name; if (e.isDirectory()) await andar(path.join(d, e.name), r); else if (!/^_/.test(e.name)) naPasta.push(r); }
    })(pastaNi, '');
    const presentes = new Set(naPasta.map(k => k.toLowerCase()));
    const semMotivo = naPasta.filter(k => !ultimos.has(k));
    for (const k of semMotivo) {
      const partes = k.split('\\');
      let em = new Date().toISOString();
      if (semMotivo.length <= 200) { try { em = (await fs.promises.stat(path.join(pastaNi, k))).mtime.toISOString(); } catch (e) { /* fica a hora de agora */ } }
      ultimos.set(k, { sub: partes[0], dir: partes.slice(1, -1).join('\\'), arquivo: partes[partes.length - 1], motivo: 'SEM_MOTIVO_REGISTRADO', confianca: 0, timestamp: em });
    }
    const itens = [];
    for (const [k, j] of ultimos) {
      if (!presentes.has(k.toLowerCase())) continue;
      itens.push({ rel: (j.dir ? j.dir + '\\' : '') + j.arquivo, nome: j.arquivo, motivo: j.motivo, confianca: j.confianca, cliente: j.cliente_tentativa, chave: j.chave || null, em: j.timestamp, hash: require('crypto').createHash('sha1').update(k).digest('hex'), naPasta: 'NÃO IDENTIFICADOS\\' + k });
    }
    // os GRUPOS (23/10/2026, a migração: os não identificados podem virar milhares): pela causa e pela pasta de origem
    // ("312 de 0010 - DORNAS…\DEPARTAMENTO FISCAL\DESTDA sem regra"), com 3 exemplos e a sugestão do mapa/da pasta
    gruposNi = montarGrupos(itens);
    // a MESMA contagem em todo lugar que diz "para resolver" (23/10/2026): o painel do robô (robo/painelPC.paraResolver),
    // o ponto do arquivador (robo/arquivador.paraResolver, que a janela do Drive lê) e o acompanhamento (pendentesTotal)
    acomp.grupos([...gruposNi.values()].sort((a, b) => b.n - a.n).slice(0, 150).map(g => ({ id: g.id, motivo: g.motivo, pasta: g.pasta, n: g.n, exemplos: g.arquivos.slice(0, 3).map(a => ({ nome: a.nome, rel: a.rel, hash: a.hash })), sugestao: g.sugestao })));
    acomp.naoIdentificados(itens, rel => fs.existsSync(path.join(o.origem, rel)), total => {
      const p = { agora: total, em: new Date().toISOString() };
      if (o.painel) o.painel.estado({ paraResolver: p });
      if (o.aoContarPendentes) { try { o.aoContarPendentes(p); } catch (e) { /* só o aviso */ } }
    });
  }

  let gruposNi = new Map();
  /** Os grupos de NÃO IDENTIFICADOS: id → { id, motivo, pasta, n, arquivos: [{ rel (na origem), nome, hash }], sugestao } */
  function montarGrupos(itens) {
    const MIG = require('./arquivador-migracao');
    const R = require('./arquivador-regras');
    const out = new Map();
    const cad = cache.cadastro || o.cadastro || null;
    for (const x of itens) {
      const g = MIG.chaveDoGrupo(x.motivo, x.rel);
      const id = require('crypto').createHash('sha1').update(g.motivo + '|' + g.pasta.toUpperCase()).digest('hex').slice(0, 16);
      let e = out.get(id);
      if (!e) {
        // a sugestão: o cliente pela pasta de origem (código e nome conferidos) e o tipo pelo mapa da migração
        let sugestao = null;
        try {
          const cp = cad ? R.clienteDaPasta(x.rel, cad) : null;
          const tp = cad && cad.mapaMigracao ? cad.mapaMigracao.tipoDaOrigem(x.rel) : null;
          if ((cp && cp.forte) || tp) sugestao = { codigo: cp && cp.forte ? cp.codigo : null, tipoDoc: tp ? tp.tipoDoc : null };
        } catch (err) { sugestao = null; }
        e = { id, motivo: g.motivo, pasta: g.pasta, n: 0, arquivos: [], sugestao };
        out.set(id, e);
      }
      e.n++;
      e.arquivos.push({ rel: x.naPasta, nome: x.nome, hash: x.hash });
    }
    return out;
  }
  /** "Lembrar" a decisão de um grupo: o cliente pela pasta do cliente; o tipo pela pasta do grupo (o mapa do controle). */
  function lembrarGrupo(e) {
    const MIG = require('./arquivador-migracao');
    const partes = String(e.pasta || '').split('\\');
    const iCli = partes.findIndex(p => /^\d{1,4}\b/.test(p) && !/^\d{1,2}$|^(19|20)\d{2}/.test(p));
    const mapa = MIG.carregar({ controle: o.controle });
    const ok = mapa.anotar({ pasta: e.tipoDoc && e.tipoDoc !== 'AUTO' ? e.pasta : '', tipoDoc: e.tipoDoc && e.tipoDoc !== 'AUTO' ? e.tipoDoc : null, cliente: e.cliente, pastaDoCliente: iCli >= 0 ? partes[iCli] : null, por: e.por });
    // o cadastro em memória passa a usar o mapa novo já na próxima volta
    if (cache.cadastro) cache.cadastro.mapaMigracao = MIG.carregar({ controle: o.controle });
    o.log('mapa da migração: ' + e.pasta + ' = cliente ' + e.cliente + (e.tipoDoc ? ', tipo ' + e.tipoDoc : '') + ' (decidido por ' + e.por + ')');
    return ok;
  }

  async function compararSeForHora() {
    const agora = new Date();
    const dia = agora.toISOString().slice(0, 10);
    if (estado.comparado === dia || agora.getHours() * 60 + agora.getMinutes() < COMPARAR_DEPOIS_DAS[0] * 60 + COMPARAR_DEPOIS_DAS[1]) return;
    if (outraExecucao()) return;
    try { const r = comparar(dia); estado.comparado = dia; salvar(); return r; } catch (e) { o.log('lado a lado:', e.message); }
  }
  function comparar(dia) {
    const antigas = [];
    try { for (const l of fs.readFileSync(path.join(o.controleAntigo, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').split(/\r?\n/)) { if (!l.trim()) continue; try { antigas.push(JSON.parse(l)); } catch (e) { try { antigas.push(JSON.parse(l.replace(/\\/g, '/'))); } catch (e2) { /* linha ruim */ } } } } catch (e) { /* sem manifesto */ }
    const novas = [];
    for (const n of fs.readdirSync(pasta).filter(f => /^decisoes-.*\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(pasta, n), 'utf8').split('\n')) { if (l.trim()) try { novas.push(JSON.parse(l)); } catch (e) { /* segue */ } }
    const r = compararDia(dia, antigas, novas);
    const arq = path.join(pasta, 'lado-a-lado-' + dia + '.txt');
    fs.writeFileSync(arq, textoDoLadoALado(r));
    atividade('Lado a lado de ' + dia.split('-').reverse().slice(0, 2).join('/') + ': ' + r.iguais + ' iguais, ' + r.diferentes + ' em outro destino, ' + r.novoNaoIdentificou + ' não identificaria (de ' + r.rotinaArquivou + ')',
      'mesma pasta com outro nome: ' + r.pastaIgualNomeDiferente + ' · não viu: ' + r.novoNaoViu + ' · relatório: ' + arq, r.diferentes > 0);
    publicarEstado({ ladoALado: Object.assign({}, r, { exemplos: r.exemplos.slice(0, 20) }) });
    acomp.ladoALado(r);
    return r;
  }

  // fs.watch recursivo acorda o ciclo (com folga para o arquivo terminar de chegar); a varredura de minuto faz o resto.
  // Sem a pasta (Drive desconectado) ou se o watch cair, tenta de novo no máximo a cada 10 min.
  const realDe = p => { try { return fs.realpathSync.native(p); } catch (e) { return p; } };
  function vigiar() {
    if (observador || parado || Date.now() - tentouVigiarEm < 10 * 60000) return;
    tentouVigiarEm = Date.now();
    try {
      observador = fs.watch(realDe(o.origem), { recursive: true }, (ev, nome) => { mudados.add(nome ? String(nome) : '*'); if (mudados.size > 20000) mudados.add('*'); clearTimeout(acordar); acordar = setTimeout(() => { void ciclo(); }, 5000); });
      observador.on('error', e => { o.log('fs.watch caiu (segue a varredura de minuto):', e.message); try { observador.close(); } catch (x) { /* já fechou */ } observador = null; mudados.add('*'); });
    } catch (e) { observador = null; o.log('fs.watch não ligou (segue a varredura de minuto):', e.message); }
  }
  vigiar();
  // os pedidos do site do admin (Para resolver: abrir o arquivo, a prévia, arquivar em…, descartar; 23/10/2026)
  let pedidos = null;
  if (o.db && !o.umaVez) {
    try { pedidos = require('./arquivador-pedidos').criar({ db: o.db, origem: o.origem, clientes: o.clientes, log: o.log, exclusivo, executar: executarDecisao, aposMudar: () => { void conferirNaoIdentificados(true).catch(e => o.log('não conferi NÃO IDENTIFICADOS:', e.message)); },
      grupo: id => gruposNi.get(id) || null, lembrar: lembrarGrupo }); }
    catch (e) { o.log('pedidos do site não ligaram:', e.message); }
    void garantirContexto().catch(e => o.log('contexto:', e.message));
  }
  const timer = o.umaVez ? null : setInterval(() => { void ciclo(); }, (lerConfig(CONFIG, configBanco).intervaloMs) || INTERVALO_MS);
  const timerContagem = o.umaVez ? null : setInterval(() => { void contarPasta(); }, 10 * 60000);
  if (!o.umaVez) setTimeout(() => { void contarPasta(); }, 30000);
  if (o.painel) o.painel.modulo('arquivador-novo', 'Arquivador novo (por evento)', true, lerConfig(CONFIG, configBanco).modo);
  o.log('vigiando ' + o.origem + ' (modo ' + lerConfig(CONFIG, configBanco).modo + ') · controle em ' + o.controle);
  if (!fs.existsSync(CONFIG) && !fs.existsSync(path.join(o.controle, 'MANIFESTO', 'manifesto.jsonl'))) {
    const aviso = 'a pasta de controle (' + o.controle + ') não tem o config.json nem o manifesto: o arquivador segue em simulação. Rode node migrar-pastas-locais.js (os dados estavam no AppData)';
    o.log(aviso); atividade('O arquivador está sem a pasta de controle', aviso, true);
    if (o.painel) o.painel.fazendo('arquivador-novo-controle', 'Sem a pasta de controle: em simulação');
  }
  return {
    ciclo, comparar, config: () => lerConfig(CONFIG, configBanco),
    // para os testes: o ritmo e a varredura
    _medirRitmo: (v, a) => medirRitmo(v, a), _ritmo: () => ({ nivel: nivelRitmo, proximoCicloEm, folgados }),
    _listar: async (raiz) => { const out = []; for await (const p of andarEmFluxo(raiz || o.origem)) out.push(...p); return out; },
    _modoAnunciado: () => modoAnunciado, _limparPastasVazias: r => limparPastasVazias(r || o.origem), _contarPasta: () => { if (estado.contagem) delete estado.contagem['G:']; return contarPasta(); }, _contados: () => contados('G:'),
    _mudados: () => mudados, _decididos: () => estado.decididos, _recentes: () => recentes, _grupos: () => gruposNi, _conferirNaoIdentificados: f => conferirNaoIdentificados(f), _lembrar: e => lembrarGrupo(e),
    parar: () => { parado = true; if (pedidos) pedidos.parar(); if (timer) clearInterval(timer); if (timerContagem) clearInterval(timerContagem); clearTimeout(acordar); if (observador) observador.close(); soltarTrava(); void acomp.parar(); },
  };
}

module.exports = { iniciar, ehTemporario, estaveis, lerConfig, compararDia, textoDoLadoALado, PADRAO };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  let db = null;
  if (!a.includes('--sem-banco')) { try { db = require('./firestore-client').getDb('entregas-2e5e2'); } catch (e) { console.log('sem banco:', e.message); } }
  const v = iniciar({ db, depurar: a.includes('--depurar'), umaVez: a.includes('--uma-vez') || !!valor('--comparar') });
  if (valor('--comparar')) { const r = v.comparar(valor('--comparar')); console.log(textoDoLadoALado(r)); v.parar(); setTimeout(() => process.exit(0), 2000); }
  else if (a.includes('--uma-vez')) {
    // um ciclo: a 1ª varredura só anota; a 2ª, depois do tempo de estabilidade, trata
    v.ciclo().then(() => new Promise(r => setTimeout(r, ESTAVEL_MS + 2000))).then(() => v.ciclo()).then(() => { v.parar(); setTimeout(() => process.exit(0), 2000); });
  } else {
    const fim = () => { v.parar(); setTimeout(() => process.exit(0), 1000); };
    process.on('SIGINT', fim); process.on('SIGTERM', fim);
  }
}
