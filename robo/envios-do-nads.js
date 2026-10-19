// Arquivo mandado pelo nads (Tarefas › Drive › "Enviar para o Claudio Secretário") para a pasta
// Claudio Secretario, de onde a rotina de arquivamento (a do PC, /organizar) tira na próxima rodada.
//
// A tela cria enviosSecretario/{id} ({ status: 'enviando', nome, tamanho, partes, competencia, cliente,
// codigo, criadoPor, criadoPorUid }), sobe o arquivo em pedaços (partes/{n} { dados: bytes }) e passa
// o envio para 'pendente'. Este módulo, no vigia:
//   1. junta os pedaços e confere o tamanho;
//   2. grava em Claudio Secretario/<competencia>/<cliente> — o nome do cliente vem do cadastro pelo
//      código ("58" -> clientes.codigoOrigem), senão o que a tela mandou, senão "Enviados pelo nads" —,
//      na mesma pasta onde o robô do Gmail guarda (pela API na nuvem, em disco no PC);
//   3. apaga os pedaços (o arquivo não fica no banco) e responde no envio ('pronto', pasta, nomeFinal).
// Nunca apaga nem sobrescreve nada no Drive: nome repetido com conteúdo diferente vira "nome (2).pdf" e
// o mesmo arquivo de novo não é gravado duas vezes (salvarArquivo).
// O extrato do mês que a Importação manda ("Extrato SICOOB 06-2026.pdf", com o código da empresa) não espera o
// arquivamento: vai direto para CONTÁBIL/EXTRATOS/AAAA/MM/BANCÁRIOS/<BANCO> na pasta da empresa, na frente da fila
// (Vitor, 19/10/2026: "após eu pesquisar no e-mail, upe imediatamente na pasta… em até 2 minutos, priorize eles acima
// de todos"). Sem a empresa no mapa do Drive (ou sem a API do Drive), cai no Claudio Secretario como antes.
const fs = require('fs');
const path = require('path');
const { ouvir } = require('./ouvinte');
const baixar = require('./download-attachments');
const USAR_DRIVE_API = process.env.USAR_DRIVE_API === '1';
const driveArquivos = USAR_DRIVE_API ? require('./drive-arquivos.js') : null;

const PASTA_SEM_CLIENTE = 'Enviados pelo nads';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PARTES = 30;
// envio que ficou pela metade (a pessoa fechou a tela no meio) e resposta velha: some do banco
const ABANDONADO_MS = 2 * 36e5;
// a resposta (sem os pedaços, que já foram apagados) fica 30 dias: a tela mostra onde o arquivo foi parar
const RESPOSTA_DURA_MS = 30 * 24 * 36e5;
const ESPERA_MS = 15 * 60 * 1000;
// o PDF da guia no espelho da Área do Cliente: pedaços de até 700 KB (em base64), cabem folgados num documento
const PEDACO_PDF_CLIENTE = 700 * 1024;

// Confere o envio e junta os pedaços. Devolve { erro } ou { buffer, nome, competencia }.
function montarEnvio(envio, pedacos) {
  if (!envio || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(envio.competencia || '')) return { erro: 'competência inválida' };
  const n = Number(envio.partes);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTES) return { erro: 'quantidade de partes inválida' };
  if (pedacos.length !== n) return { erro: 'faltam partes do arquivo (' + pedacos.length + ' de ' + n + ')' };
  const ordenados = pedacos.slice().sort((a, b) => a.n - b.n);
  if (ordenados.some((p, i) => p.n !== i)) return { erro: 'partes fora de ordem' };
  const buffer = Buffer.concat(ordenados.map(p => Buffer.from(p.dados || [])));
  if (!buffer.length || buffer.length > MAX_BYTES) return { erro: 'tamanho fora do limite' };
  if (buffer.length !== Number(envio.tamanho)) return { erro: 'o arquivo chegou incompleto' };
  const nome = String(envio.nome || '').split(/[\\/]/).pop().trim() || 'arquivo';
  return { buffer, nome, competencia: envio.competencia };
}

// A pasta do cliente dentro do mês: o nome do cadastro (pelo código), o que veio, ou "Enviados pelo nads".
function nomeDaPastaDoCliente(envio, porCodigo) {
  const doCadastro = envio.codigo ? porCodigo.get(String(envio.codigo).trim()) : null;
  return (doCadastro && doCadastro.nome) || String(envio.cliente || '').trim() || PASTA_SEM_CLIENTE;
}

async function clientesPorCodigo(db) {
  const m = new Map();
  try {
    (await require('./clientes-cache').clientesAtivos(db)).forEach(d => {
      const c = d.data();
      if (c.codigoOrigem != null) m.set(String(c.codigoOrigem).trim(), Object.assign({ id: d.id }, c));
    });
  } catch (e) { /* sem o cadastro: fica o nome que veio da tela */ }
  return m;
}

// ---------- a guia (DAS/DAE) na Área do Cliente (16/10/2026) ----------
// Quando o envio traz guia/vencimento/valor (lidos do PDF pela tela), além de gravar no Drive o robô põe a guia no espelho
// de cada link da empresa: areasCliente/{token}/guias/{das|dae}-{AAAA-MM}-{codigo} (a GuiaDoCliente do core) e o PDF em
// pedaços em guias/{id}/pdf/{n} ({ base64, n, total }, n de 0). Sem link (areasClientePorEmpresa/{codigo}), não faz nada.

/** O que a tela leu da guia, conferido (ou null: o envio é um arquivo comum). */
function guiaDoEnvio(envio) {
  if (!envio || envio.criadoPorUid === 'mandei') return null;   // o cliente do link nunca põe guia na Área do Cliente
  const tipo = envio.guia === 'DAS' || envio.guia === 'DAE' ? envio.guia : null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(envio.vencimento || ''));
  const data = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  if (!tipo || !data || data.getDate() !== Number(m[1]) || data.getMonth() !== Number(m[2]) - 1) return null;
  const texto = String(envio.valor || '').trim();
  const valor = /^(\d{1,3}(\.\d{3})*|\d+),\d{2}$/.test(texto) ? Number(texto.replace(/\./g, '').replace(',', '.')) : NaN;
  const codigo = String(envio.codigo == null ? '' : envio.codigo).trim();
  if (!Number.isFinite(valor) || !codigo || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(envio.competencia || '')) return null;
  return { tipo, vencimento: String(envio.vencimento), valor, valorTexto: texto, codigo, competencia: envio.competencia };
}

/** "dae-2026-09-58": o mesmo mês e empresa sobrescreve a guia (a nova substitui a velha). */
function idDaGuiaDoCliente(g) { return g.tipo.toLowerCase() + '-' + g.competencia + '-' + g.codigo; }

/** 'a vencer' | 'vence hoje' | 'vencida' pela data de hoje (quem mostra recalcula). */
function situacaoDaGuia(vencimento, hoje) {
  const [d, m, a] = vencimento.split('/').map(Number);
  const v = new Date(a, m - 1, d).getTime();
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return v > h ? 'a vencer' : v === h ? 'vence hoje' : 'vencida';
}

/** O documento guias/{id}: só os campos da GuiaDoCliente (lista branca). */
function docDaGuiaDoCliente(g, hoje) {
  return { id: idDaGuiaDoCliente(g), tipo: g.tipo, competencia: g.competencia, vencimento: g.vencimento, valor: g.valor,
    situacao: situacaoDaGuia(g.vencimento, hoje || new Date()), temPdf: true };
}

/** O PDF em pedaços de base64: [{ base64, n, total }]. */
function pedacosDoPdfCliente(buffer, tamanho) {
  const b64 = Buffer.from(buffer).toString('base64');
  const t = Math.max(4, Math.floor((tamanho || PEDACO_PDF_CLIENTE) / 4) * 4);   // múltiplo de 4: cada pedaço é base64 inteiro
  const total = Math.max(1, Math.ceil(b64.length / t));
  return Array.from({ length: total }, (_, n) => ({ base64: b64.slice(n * t, (n + 1) * t), n, total }));
}

/** Os links da empresa (areasClientePorEmpresa/{codigo}: { token }, ou { tokens: [] }); vazio = sem Área do Cliente. */
async function tokensDaEmpresa(db, codigo) {
  const d = await db.collection('areasClientePorEmpresa').doc(String(codigo)).get();
  if (!d.exists) return [];
  const x = d.data() || {};
  return [...new Set([].concat(x.token || [], x.tokens || []).filter(t => typeof t === 'string' && t))];
}

async function guiaNaAreaDoCliente(db, envio, buffer, log) {
  const g = guiaDoEnvio(envio);
  if (!g) return 0;
  const tokens = await tokensDaEmpresa(db, g.codigo);
  const doc = docDaGuiaDoCliente(g);
  const pedacos = pedacosDoPdfCliente(buffer);
  for (const token of tokens) {
    const ref = db.collection('areasCliente').doc(token).collection('guias').doc(doc.id);
    // o PDF antes da guia (a guia diz temPdf); pedaços velhos de uma guia anterior saem
    const velhos = await ref.collection('pdf').get();
    for (const p of pedacos) await ref.collection('pdf').doc(String(p.n)).set(p);
    await Promise.all(velhos.docs.filter(d => Number(d.id) >= pedacos.length).map(d => d.ref.delete()));
    await ref.set(doc);
    log('guia ' + g.tipo + ' na Área do Cliente:', doc.id, '(' + pedacos.length + ' pedaço' + (pedacos.length > 1 ? 's' : '') + ')');
  }
  return tokens.length;
}

// ---------- o extrato direto na pasta do banco (19/10/2026) ----------

/** "Extrato SICOOB 06-2026.pdf" (o nome que a Importação dá: nomeDoExtratoDoMes) → { banco, mes, ano, ext }; null = não é. */
function extratoDoNome(nome) {
  const m = /^Extrato (.+) (0[1-9]|1[0-2])-(20\d{2})(\.[A-Za-z0-9]{2,5})$/.exec(String(nome || '').trim());
  return m ? { banco: m[1].trim(), mes: m[2], ano: m[3], ext: m[4].toLowerCase() } : null;
}

/**
 * Onde o extrato vai na pasta da empresa, pelo mapa do Drive (os itens do driveIndice): o nome da pasta do banco é o que a
 * empresa já usa para ele (em qualquer mês); senão, o nome do arquivo. Devolve a pasta mais funda que já existe no caminho,
 * as que faltam criar (com o nome certo, acentuado) e o nome final ("06-2026.pdf", como a rotina de arquivamento deixa).
 */
function caminhoDoExtratoNoIndice(itens, clienteId, ex) {
  const indice = require('./drive-indice');
  const k = indice.chaveDeNome;
  const idBanco = indice.bancoDaPasta(ex.banco);
  const cam = indice.caminhos(itens, clienteId);
  const usados = new Map();
  for (const it of itens) {
    if (it.t !== 'd') continue;
    const c = cam.get(it.i);
    if (!c || c.length !== 6) continue;
    const ck = c.map(k);
    if (ck[0] !== 'CONTABIL' || ck[1] !== 'EXTRATOS' || ck[4] !== 'BANCARIOS') continue;
    if ((idBanco && indice.bancoDaPasta(c[5]) === idBanco) || ck[5] === k(ex.banco)) usados.set(c[5], (usados.get(c[5]) || 0) + 1);
  }
  const nomeDoBanco = [...usados].sort((a, b) => b[1] - a[1])[0]?.[0] || ex.banco.toUpperCase();
  const alvo = ['CONTÁBIL', 'EXTRATOS', ex.ano, ex.mes, 'BANCÁRIOS', nomeDoBanco];
  let pai = clienteId;
  let i = 0;
  for (; i < alvo.length; i++) {
    const filho = itens.find(it => it.t === 'd' && it.p === pai && k(it.n) === k(alvo[i]));
    if (!filho) break;
    pai = filho.i;
  }
  return { existente: pai, faltam: alvo.slice(i), caminho: alvo.join('/'), nomeFinal: ex.mes + '-' + ex.ano + ex.ext };
}

/** Grava o extrato direto na pasta do banco (pela API do Drive). null = não dá (não é extrato, empresa fora do mapa, outro ano). */
async function gravarNaPastaDoBanco(db, drive, envio, c) {
  const ex = extratoDoNome(c.nome);
  const codigo = String(envio.codigo == null ? '' : envio.codigo).trim();
  if (!ex || !codigo) return null;
  const raiz = (await db.collection('driveIndice').doc('raiz').get()).data() || {};
  // a pasta do ano do mapa (2026): o extrato de outro ano fica para o arquivamento
  if (String(raiz.pastaNome || '') !== ex.ano) return null;
  const cli = (raiz.clientes || []).find(x => String(x.codigo == null ? '' : x.codigo).trim() === codigo);
  if (!cli) return null;
  const ref = db.collection('driveIndice').doc(cli.id);
  const partes = Number(((await ref.get()).data() || {}).partes || 0);
  const itens = [];
  for (let n = 0; n < partes; n++) itens.push(...((((await ref.collection('partes').doc(String(n)).get()).data()) || {}).itens || []));
  const cam = caminhoDoExtratoNoIndice(itens, cli.id, ex);
  let pastaId = cam.existente;
  for (const nome of cam.faltam) pastaId = await driveArquivos.garantirPasta(drive, pastaId, nome);
  const salvo = await driveArquivos.salvarArquivo(drive, pastaId, cam.nomeFinal, c.buffer);
  return { pasta: cli.nomePasta + '/' + cam.caminho, nomeFinal: salvo || cam.nomeFinal, jaEstava: !salvo, codigo, cliente: String(cli.nome || cli.nomePasta || ''), subpasta: cam.caminho };
}

function iniciarEnviosDoNads(db, log) {
  const envios = db.collection('enviosSecretario');
  const tratando = new Set();

  async function apagarPartes(ref) {
    const ps = await ref.collection('partes').get();
    await Promise.all(ps.docs.map(d => d.ref.delete()));
  }

  async function tratar(doc) {
    if (tratando.has(doc.id)) return;
    tratando.add(doc.id);
    const envio = doc.data();
    try {
      await doc.ref.update({ status: 'gravando', gravandoEm: new Date().toISOString() });
      const ps = await doc.ref.collection('partes').get();
      const c = montarEnvio(envio, ps.docs.map(d => ({ n: Number(d.id), dados: d.get('dados') })));
      if (c.erro) {
        await apagarPartes(doc.ref);
        await doc.ref.update({ status: 'erro', erro: c.erro, prontoEm: new Date().toISOString() });
        log('envio pelo nads recusado (' + c.erro + '):', envio.nome);
        return;
      }
      // o extrato do mês: direto na pasta do banco (sem esperar o arquivamento); não deu, segue para o Claudio Secretario
      if (USAR_DRIVE_API && extratoDoNome(c.nome)) {
        try {
          const direto = await gravarNaPastaDoBanco(db, driveArquivos.getDrive(), envio, c);
          if (direto) {
            await apagarPartes(doc.ref);
            const agora = new Date().toISOString();
            await doc.ref.update({
              status: 'pronto', pasta: direto.pasta, nomeFinal: direto.nomeFinal, jaEstava: direto.jaEstava, prontoEm: agora, direto: true,
              arquivamento: { situacao: 'arquivado', em: agora, execucao: 'direto', codigo: direto.codigo, cliente: direto.cliente, subpasta: direto.subpasta, final: direto.nomeFinal },
            });
            log('extrato pelo nads direto na pasta do banco (' + (envio.criadoPor || '?') + '):', c.nome, '->', direto.pasta + '/' + direto.nomeFinal + (direto.jaEstava ? ' (já estava lá)' : ''));
            return;
          }
        } catch (err) { log('extrato direto na pasta do banco não deu (vai para o Claudio Secretario):', err.message); }
      }
      const cliente = nomeDaPastaDoCliente(envio, await clientesPorCodigo(db));
      let nomeFinal;
      if (USAR_DRIVE_API) {
        const drive = driveArquivos.getDrive();
        const pastaId = await driveArquivos.pastaDoCliente(drive, c.competencia, cliente);
        nomeFinal = await driveArquivos.salvarArquivo(drive, pastaId, c.nome, c.buffer);
      } else {
        const pasta = path.join(baixar.PASTA_DESTINO, c.competencia, baixar.sanitizar(cliente));
        fs.mkdirSync(pasta, { recursive: true });           // G: fora do ar dá erro aqui e o envio espera
        const destino = baixar.salvarArquivo(pasta, c.nome, c.buffer);
        nomeFinal = destino ? path.basename(destino) : null;
      }
      const pasta = c.competencia + '/' + baixar.sanitizar(cliente);
      await apagarPartes(doc.ref);
      await doc.ref.update({
        status: 'pronto', pasta, nomeFinal: nomeFinal || c.nome, jaEstava: !nomeFinal, prontoEm: new Date().toISOString(),
      });
      // a guia lida pela tela (DAS/DAE) também vai para a Área do Cliente; se falhar, o Drive já está feito
      try { await guiaNaAreaDoCliente(db, envio, c.buffer, log); } catch (err) { log('guia na Área do Cliente falhou:', err.message); }
      log('enviado pelo nads (' + (envio.criadoPor || '?') + '):', c.nome, '->', 'Claudio Secretario/' + pasta + (nomeFinal ? '' : ' (já estava lá)'));
    } catch (err) {
      // Drive fora do ar: fica 'gravando' e a limpeza devolve para a fila (sem ficar tentando sem parar)
      log('envio pelo nads ficou esperando:', err.message);
      try { await doc.ref.update({ esperando: err.message, gravandoEm: new Date().toISOString() }); } catch (e) { /* a limpeza acha */ }
    } finally { tratando.delete(doc.id); }
  }

  // os extratos do mês na frente (19/10/2026: "priorize eles acima de todos"), depois os outros
  ouvir('envios do nads', () => envios.where('status', '==', 'pendente').limit(20), snap => {
    const ehExtrato = d => (extratoDoNome(d.get('nome')) ? 0 : 1);
    snap.docs.slice().sort((a, b) => ehExtrato(a) - ehExtrato(b)).forEach(d => { tratar(d); });
  }, log);

  // limpeza: envio abandonado no meio (com os pedaços) e respostas velhas
  async function limpar() {
    try {
      const agora = Date.now();
      const velhos = await envios.where('criadoEm', '<', new Date(agora - ABANDONADO_MS).toISOString()).limit(50).get();
      for (const d of velhos.docs) {
        const e = d.data();
        const fim = e.status === 'pronto' || e.status === 'erro';
        if (e.status === 'enviando' || (fim && Date.parse(e.prontoEm || e.criadoEm) < agora - RESPOSTA_DURA_MS)) {
          await apagarPartes(d.ref);
          await d.ref.delete();
        }
      }
      // o que ficou esperando (Drive fora do ar, robô reiniciou no meio) volta para a fila
      const parados = await envios.where('status', '==', 'gravando').limit(20).get();
      for (const d of parados.docs) {
        if (tratando.has(d.id) || Date.parse(d.get('gravandoEm') || 0) > agora - ESPERA_MS) continue;
        await d.ref.update({ status: 'pendente' });
      }
    } catch (e) { log('limpeza dos envios do nads:', e.message); }
  }
  setInterval(limpar, 15 * 60 * 1000);
  setTimeout(limpar, 60 * 1000);
  log('arquivos enviados pelo nads para o Claudio Secretario: ligado');
}

// ---------- onde o arquivo foi parar (01/10/2026) ----------
// Depois de cada rodada do arquivamento (arquivador.js publica arquivamentos/{EXEC-…} e detalhe/tudo), os envios
// prontos que ainda não sabem o destino são procurados pelo nome com que ficaram no Claudio Secretario (nomeFinal):
// em detalhe.arquivos (arquivado: código, cliente, subpasta e o nome final), em detalhe.naoIdentificados, ou como
// DUPLICADO no relatório. O manifesto não guarda a pasta de origem, então o casamento é pelo nome e pelo código.
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** O destino do envio numa rodada (ou null quando a rodada não fala dele). */
function destinoNoArquivamento(envio, run, detalhe) {
  const nome = semAcento(envio.nomeFinal);
  if (!nome || !detalhe) return null;
  const doCodigo = a => !envio.codigo || !a.codigo || String(a.codigo) === String(envio.codigo);
  const arq = (detalhe.arquivos || []).find(a => semAcento(a.original) === nome && doCodigo(a));
  if (arq) {
    return { situacao: 'arquivado', em: run.em || '', execucao: run.id || '', codigo: String(arq.codigo || ''), cliente: String(arq.cliente || ''),
      subpasta: String(arq.subpasta || ''), final: String(arq.final || arq.original || '') };
  }
  const nao = (detalhe.naoIdentificados || []).find(n => semAcento(n.nome).endsWith(nome));
  if (nao) return { situacao: 'nao_identificado', em: run.em || '', execucao: run.id || '', motivo: String(nao.motivo || '') };
  const linha = String(detalhe.relatorio || '').split(/\r?\n/).find(l => /^\s*DUPLICADO:/.test(l) && semAcento(l).includes(nome));
  if (linha) return { situacao: 'duplicado', em: run.em || '', execucao: run.id || '', motivo: linha.replace(/^\s*DUPLICADO:\s*/, '').slice(0, 300) };
  return null;
}

function iniciarDestinoDosEnvios(db, log) {
  const envios = db.collection('enviosSecretario');
  const vistos = new Map();   // rodada -> publicadoEm já conferido
  async function conferir(runs) {
    const prontos = (await envios.where('status', '==', 'pronto').limit(200).get()).docs.filter(d => !d.get('arquivamento'));
    if (!prontos.length) return;
    for (const run of runs.sort((a, b) => String(a.em).localeCompare(String(b.em)))) {
      const aguardando = prontos.filter(d => !d._resolvido && String(d.get('prontoEm') || '') < String(run.em || ''));
      if (!aguardando.length) continue;
      const det = (await db.collection('arquivamentos').doc(run.id).collection('detalhe').doc('tudo').get()).data();
      for (const d of aguardando) {
        const destino = destinoNoArquivamento(d.data(), run, det);
        if (!destino) continue;
        d._resolvido = true;
        await d.ref.update({ arquivamento: destino });
        log('envio pelo nads', destino.situacao + ':', d.get('nomeFinal'), destino.subpasta ? '-> ' + destino.codigo + ' - ' + destino.cliente + '/' + destino.subpasta : '');
      }
    }
  }
  ouvir('arquivamentos para os envios', () => db.collection('arquivamentos').orderBy('em', 'desc').limit(5), snap => {
    const runs = snap.docs.map(d => Object.assign({ id: d.id }, d.data()))
      .filter(r => r.modo === 'PRODUCAO' && vistos.get(r.id) !== r.publicadoEm);
    if (!runs.length) return;
    runs.forEach(r => vistos.set(r.id, r.publicadoEm));
    conferir(runs).catch(err => log('destino dos envios do nads:', err.message));
  }, log);
}

module.exports = { extratoDoNome, caminhoDoExtratoNoIndice, montarEnvio, nomeDaPastaDoCliente, PASTA_SEM_CLIENTE, iniciarEnviosDoNads, guiaDoEnvio, idDaGuiaDoCliente, docDaGuiaDoCliente, pedacosDoPdfCliente, guiaNaAreaDoCliente, destinoNoArquivamento, iniciarDestinoDosEnvios };
