// O arquivador novo POR EVENTO (Vitor, 21/10/2026: "eu quero que quando cair na pasta ele já arquive").
//
// Vigia G:\Meu Drive\Claudio Secretario e trata cada arquivo assim que ele fica ESTÁVEL:
//   - fs.watch recursivo acorda o ciclo na hora; uma varredura a cada INTERVALO (1 min) garante o resto, porque o Google
//     Drive sincroniza aos poucos e nem sempre avisa;
//   - estável = tamanho e data sem mudar há ESTAVEL_MS (45 s) e a data mais velha que isso; fora os temporários do Drive
//     e do Office (~$…, .tmp, .crdownload, .part, desktop.ini) e arquivo de 0 byte; .zip só com o diretório central
//     inteiro (zip ainda chegando não abre);
//   - lotes pequenos (até LOTE arquivos ou LOTE_MS de trabalho), um de cada vez, com a trava própria (continuo.lock) e
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

const ORIGEM = process.env.ARQ_NOVO_ORIGEM || 'G:\\Meu Drive\\Claudio Secretario';
const ROTINA = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const CONTROLE_ANTIGO = path.join(ROTINA, '_CONTROLE');
const INTERVALO_MS = 60 * 1000;
const ESTAVEL_MS = 45 * 1000;
const LOTE = 40;
const LOTE_MS = 50 * 1000;
const COMPARAR_DEPOIS_DAS = [11, 30];   // a das 9h terminou (JANELA_DAS_9H do arquivador.js vai até 11h)
const PADRAO = { modo: 'simulacao', tiposProducao: [], moverNaoIdentificados: false, intervaloMs: INTERVALO_MS, estavelMs: ESTAVEL_MS, lote: LOTE };

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
function lerConfig(arquivo, doBanco) {
  let doArquivo = {};
  try { doArquivo = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch (e) { /* sem arquivo: o do banco ou o padrão */ }
  const c = Object.assign({}, PADRAO, doBanco || {}, doArquivo);
  if (!['desligado', 'simulacao', 'producao'].includes(c.modo)) c.modo = 'simulacao';
  c.tiposProducao = Array.isArray(c.tiposProducao) ? c.tiposProducao.map(String).filter(Boolean) : [];
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
  const mapa = new Map();
  let configBanco = null, parado = false, rodando = false, acordar = null, observador = null, avisouSemDrive = false, tentouVigiarEm = 0;
  let cache = { em: 0 };
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
  // o config no banco (robo/arquivadorNovo): ouvinte, só cobra quando muda
  if (o.db) {
    try { require('./ouvinte').ouvir('arquivador novo: config', () => o.db.collection('robo').doc('arquivadorNovo'), snap => { configBanco = snap.exists ? (snap.data().config || null) : null; }, o.log); } catch (e) { o.log('config do banco não ligou:', e.message); }
  }

  /** A rotina antiga ou um pedido do botão rodando agora? */
  function outraExecucao() {
    if (o.ocupado && o.ocupado()) return 'o pedido do botão "Arquivar agora" está rodando';
    try { const st = fs.statSync(path.join(o.controleAntigo, '_execucao.lock')); if (Date.now() - st.mtimeMs < 4 * 36e5) return 'a rotina antiga está rodando (_execucao.lock)'; } catch (e) { /* sem trava */ }
    const recente = d => { try { for (const n of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, n)); if (Date.now() - st.mtimeMs < 10 * 60000) return true; } } catch (e) { /* sem pasta */ } return false; };
    if (recente(path.join(o.controleAntigo, 'MANIFESTO')) || recente(path.join(o.controleAntigo, '_tmp_exec')) || recente(path.join(o.controleAntigo, 'STAGING'))) return 'a rotina antiga mexeu no _CONTROLE há menos de 10 min';
    return null;
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
  const soltarTrava = () => { try { if (JSON.parse(fs.readFileSync(TRAVA, 'utf8')).pid === process.pid) fs.unlinkSync(TRAVA); } catch (e) { /* já foi */ } };

  /** Varredura leve: só o nome, o tamanho e a data de cada arquivo. */
  function varrer() {
    const out = [];
    for (const rel of A.varrer(o.origem, {})) {
      try { const st = fs.statSync(path.join(o.origem, rel)); out.push({ rel, tam: st.size, mtime: st.mtimeMs }); } catch (e) { /* sumiu no meio */ }
    }
    return out;
  }
  const chave = (rel, v) => rel + '|' + v.tam + '|' + Math.round(v.mtime);
  /** zip ainda chegando: o diretório central não está lá. */
  function zipInteiro(rel) {
    if (!/\.zip$/i.test(rel)) return true;
    try { A.abrirZip(fs.readFileSync(path.join(o.origem, rel))); return true; } catch (e) { return false; }
  }

  async function ciclo() {
    if (rodando || parado) return;
    const cfg = lerConfig(CONFIG, configBanco);
    if (cfg.modo === 'desligado') return;
    // o G: some quando o Google Drive desconecta: espera voltar (sem concluir que os arquivos "sumiram")
    if (!fs.existsSync(o.origem)) {
      if (!avisouSemDrive) { o.log('a pasta de origem não está acessível (' + o.origem + '): espero o Google Drive voltar'); avisouSemDrive = true; }
      if (o.painel) o.painel.fazendo('arquivador-novo', 'Esperando o Google Drive (G:) voltar');
      return;
    }
    if (avisouSemDrive) { o.log('a pasta de origem voltou'); avisouSemDrive = false; if (o.painel) o.painel.fazendo('arquivador-novo', null); }
    if (!observador) vigiar();
    const motivo = outraExecucao();
    if (motivo) { if (o.painel) o.painel.fazendo('arquivador-novo', 'Esperando: ' + motivo); return; }
    if (o.painel) o.painel.fazendo('arquivador-novo', null);
    rodando = true;
    try {
      const vistos = varrer();
      const porRel = new Map(vistos.map(v => [v.rel, v]));
      const estaveisAgora = estaveis(mapa, vistos, Date.now(), cfg.estavelMs);
      // o zip só é aberto (para ver se chegou inteiro) quando vai entrar no lote, não a cada varredura
      const prontos = estaveisAgora.filter(rel => !estado.decididos[chave(rel, porRel.get(rel))]).slice(0, cfg.lote * 3).filter(zipInteiro);
      if (o.depurar) o.log('varredura: ' + vistos.length + ' arquivo(s), ' + estaveisAgora.length + ' estável(is), ' + prontos.length + ' para decidir');
      if (!prontos.length) return;
      if (!pegarTrava()) { o.log('outro processo do arquivador novo está trabalhando'); return; }
      try {
        // contexto caro (cadastro, manifesto antigo, contas) refeito a cada 30 min
        if (Date.now() - cache.em > 30 * 60000) {
          if (o.db) await A.atualizarCadastro({ db: o.db, controle: o.controle, log: o.log });
          cache = { em: Date.now(), cadastro: o.cadastro || A.carregarCadastro({ controle: o.controle }) };
        }
        const inicio = Date.now();
        let feitos = 0;
        while (prontos.length && feitos < cfg.lote && Date.now() - inicio < LOTE_MS) {
          const lote = prontos.splice(0, Math.min(10, cfg.lote - feitos));
          feitos += lote.length;
          if (o.painel) o.painel.fazendo('arquivador-novo', (cfg.modo === 'producao' ? 'Arquivando ' : 'Simulando ') + lote.length + ' arquivo(s) da Claudio Secretario');
          const res = await A.executar({
            modo: cfg.modo === 'producao' && cfg.tiposProducao.length ? 'PRODUCAO' : 'SIMULACAO', confirmo: true, origem: o.origem, controle: o.controle,
            arquivos: lote, cadastro: cache.cadastro, tiposProducao: cfg.tiposProducao, moverNaoIdentificados: !!cfg.moverNaoIdentificados,
            painel: cfg.modo === 'producao' ? { atividade: (t, x, d) => atividade(x, d), erro: (t, x, d) => atividade(x, d, true) } : null,
            registrar: false, log: () => {},
          });
          registrar(res, lote, porRel, cfg);
        }
      } finally { soltarTrava(); if (o.painel) o.painel.fazendo('arquivador-novo', null); }
    } catch (err) { o.log('erro no ciclo:', err.message); atividade('O arquivador novo deu erro', err.message, true); }
    finally { rodando = false; await compararSeForHora(); }
  }

  /** Diário, contagem do mês e painel. */
  function registrar(res, lote, porRel, cfg) {
    const mes = new Date().toISOString().slice(0, 7);
    const diario = path.join(pasta, 'decisoes-' + mes + '.jsonl');
    const m = estado.mes[mes] || (estado.mes[mes] = { arquivou: 0, arquivaria: 0, jaArquivado: 0, naoIdentificado: 0, pastasNovas: 0 });
    const linhas = [];
    const planos = A.planos(res).filter(x => x.acao !== 'CONTEINER');
    const simulados = [];
    for (const x of planos) {
      const aplicado = res.modo === 'PRODUCAO' && !x.naoAplicado && !x.erro && (x.acao === 'ARQUIVAR' || x.acao === 'JA_ARQUIVADO');
      linhas.push(JSON.stringify({ em: new Date().toISOString(), modo: aplicado ? 'PRODUCAO' : 'SIMULACAO', rel: x.rel, hash: x.hash, acao: x.acao, motivo: x.motivo, tipo: x.tipo, confianca: x.confianca, onde: x.onde || null, destinoSugerido: x.destinoSugerido || null, copias: (x.copias || []).map(c => c.onde), pastaNova: !!x.criarPastaCliente, erro: x.erro || null }));
      if (x.acao === 'ARQUIVAR') { if (aplicado) m.arquivou++; else { m.arquivaria++; simulados.push(x); } if (x.criarPastaCliente) m.pastasNovas++; }
      else if (x.acao === 'JA_ARQUIVADO') m.jaArquivado++;
      else if (x.acao === 'NAO_IDENTIFICADO') m.naoIdentificado++;
    }
    fs.appendFileSync(diario, linhas.join('\n') + (linhas.length ? '\n' : ''));
    for (const rel of lote) { const v = porRel.get(rel); if (v) estado.decididos[chave(rel, v)] = Date.now(); }
    // "arquivaria" no painel: um a um quando é pouco; resumo quando é a pilha antiga
    if (simulados.length && simulados.length <= 5) simulados.forEach(x => atividade('Arquivaria ' + x.nome + ' em ' + (x.onde || '').replace(/^G:\\Meu Drive\\2026\\/, '').split('\\')[0], 'simulação · ' + (x.onde || '') + ' · ' + Math.round((x.confianca || 0) * 100) + '%'));
    else if (simulados.length) atividade('Arquivaria ' + simulados.length + ' arquivo(s) da Claudio Secretario (simulação)', simulados.slice(0, 5).map(x => x.nome).join(', ') + (simulados.length > 5 ? '…' : ''));
    publicarEstado({ mes, contagem: m, modo: cfg.modo, tiposProducao: cfg.tiposProducao, ultimaEm: new Date().toISOString() });
    // limpa o "já decidido" de mais de 40 dias (o arquivo some da pasta quando é arquivado)
    const limite = Date.now() - 40 * 864e5;
    for (const [k, t] of Object.entries(estado.decididos)) if (t < limite) delete estado.decididos[k];
    salvar();
  }

  /** Uma vez por dia, depois da rotina das 9h: o lado a lado (publicado no painel e gravado no controle). */
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
    return r;
  }

  // fs.watch recursivo acorda o ciclo (com folga para o arquivo terminar de chegar); a varredura de minuto faz o resto.
  // Sem a pasta (Drive desconectado) ou se o watch cair, tenta de novo no máximo a cada 10 min.
  function vigiar() {
    if (observador || parado || Date.now() - tentouVigiarEm < 10 * 60000) return;
    tentouVigiarEm = Date.now();
    try {
      observador = fs.watch(o.origem, { recursive: true }, () => { clearTimeout(acordar); acordar = setTimeout(() => { void ciclo(); }, 5000); });
      observador.on('error', e => { o.log('fs.watch caiu (segue a varredura de minuto):', e.message); try { observador.close(); } catch (x) { /* já fechou */ } observador = null; });
    } catch (e) { observador = null; o.log('fs.watch não ligou (segue a varredura de minuto):', e.message); }
  }
  vigiar();
  const timer = o.umaVez ? null : setInterval(() => { void ciclo(); }, (lerConfig(CONFIG, configBanco).intervaloMs) || INTERVALO_MS);
  if (o.painel) o.painel.modulo('arquivador-novo', 'Arquivador novo (por evento)', true, lerConfig(CONFIG, configBanco).modo);
  o.log('vigiando ' + o.origem + ' (modo ' + lerConfig(CONFIG, configBanco).modo + ')');
  return {
    ciclo, comparar,
    parar: () => { parado = true; if (timer) clearInterval(timer); clearTimeout(acordar); if (observador) observador.close(); soltarTrava(); },
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
