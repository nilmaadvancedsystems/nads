// O robô da Área do Cliente (16/10/2026; contrato em docs/area-do-cliente/contrato.md). Roda no arquivador do PC.
//
// O cliente abre cliente.nilmacontabilidade.com/{token} e só lê o ESPELHO areasCliente/{token}/..., que só este robô
// grava (Admin SDK), com lista branca de campos (area-cliente-regras.js, porte das projeções do core). Ele faz:
//   1. o espelho de cada link: resumo/atual (empresas e o contato do escritório), guias/{id} do FGTS (pedidosFgts prontos
//      e de emitir; com aviso, só liberadoCliente == true; o PDF em guias/{id}/pdf/{n}, n de 0) e agenda/{AAAA-MM} (as
//      rotinas da competência atual e da anterior pela tabela de vencimentos). Grava só o que mudou (hash). Roda ao ligar,
//      a cada 30 min e quando muda o link, um pedido do FGTS, uma rotina ou o cadastro (ouvintes).
//   2. a caixa areaClienteChamados: confere, cria/atualiza chamados/{id} (o interno da equipe), copia a visão do cliente
//      para o espelho e apaga o pedido. Até 20 por link por dia.
//   3. ouve chamados/{id}: a resposta da equipe vai para o espelho na hora.
//   4. a caixa areaClienteEnvios: confere (o tipo pelos primeiros bytes), guarda no Drive do cliente
//      (G:\Meu Drive\<ano>\<cód> - <nome>\ÁREA DO CLIENTE\<MM>), registra em areaClienteRecebidos/{id}, devolve o recibo
//      em areasCliente/{token}/envios/{id} e apaga o pedido. Até 50 por link por dia. Drive fora do ar: o envio espera.
//   5. uma vez por dia apaga os espelhos órfãos (subcoleções de um token que não existe mais).
//
// As guias de DAS/DAE do espelho são do envios-do-nads.js (ids das-/dae-…): este robô nunca as apaga nem regrava; só
// mexe nas guias com tipo 'FGTS'.
const fs = require('fs');
const path = require('path');
const { ouvir } = require('./ouvinte');
const R = require('./area-cliente-regras');
// o painel do robô (21/10/2026): os chamados abertos e os arquivos recebidos pela Área do Cliente
const painel = require('./painel');

// O contato do escritório que aparece para o cliente (o WhatsApp é o mesmo do e-mail de pedir extratos do nads).
// O telefone fixo ainda não foi informado: quando houver, entra aqui.
const ESCRITORIO = { whatsapp: '(38) 9138-3638', email: 'nilmacontabilidade@gmail.com' };

const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const PASTA_DOS_RECEBIDOS = 'ÁREA DO CLIENTE';
const A_CADA_MS = 30 * 60 * 1000;
const ESPERA_ENTRE_EMPRESAS_MS = 1000;
const ESPERA_ENTRE_LINKS_MS = 2000;
const CLIENTES_VALEM_MS = 6 * 36e5;
const MESES_DE_GUIAS = 12;
const CORE = path.join(__dirname, '..', 'packages', 'core', 'src');

const dormir = ms => new Promise(r => setTimeout(r, ms));
const hojeIso = () => R.isoDaData(new Date());

/** A pasta do cliente no Drive (a mesma regra do fgts-claude.js): a que começa com "<cód> - "; senão cria "<cód> - <nome>". */
function pastaDoCliente(ano, codigo, empresa) {
  const raiz = path.join(DRIVE, ano);
  fs.mkdirSync(raiz, { recursive: true });
  const achada = fs.readdirSync(raiz, { withFileTypes: true }).find(d => d.isDirectory() && d.name.startsWith(codigo + ' - '));
  return path.join(raiz, achada ? achada.name : (codigo + ' - ' + empresa).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim());
}

/** Grava sem sobrescrever: o mesmo conteúdo de novo não duplica; nome repetido com outro conteúdo vira "nome (2).ext". */
function salvarSemRepetir(pasta, nome, buffer) {
  const ext = path.extname(nome);
  const base = path.basename(nome, ext);
  let destino = path.join(pasta, nome);
  for (let n = 2; fs.existsSync(destino); n++) {
    try { if (fs.readFileSync(destino).equals(buffer)) return destino; } catch (e) { /* segue para o próximo nome */ }
    destino = path.join(pasta, base + ' (' + n + ')' + ext);
  }
  fs.writeFileSync(destino, buffer);
  return destino;
}

/** Os dados do core (a lista de empresas e a planilha do DP), lidos do arquivo; sem eles, a agenda usa só o banco. */
function lerDadosDoCore(log) {
  const ler = (arq, f) => {
    try { return f(fs.readFileSync(path.join(CORE, arq), 'utf8')); } catch (e) { log('Área do Cliente: não li ' + arq + ' (' + e.message + ')'); return new Map(); }
  };
  return { lista: ler('empresas/lista.ts', R.lerListaDoCore), dp: ler('empresas/dp.ts', R.lerDpDoCore) };
}

/**
 * Apaga o espelho dos links que não existem mais: o nads revoga (e troca) apagando areasCliente/{token}, mas as
 * subcoleções (resumo, guias + pdf, agenda, envios, chamados, documentos) ficam. listDocuments() traz também esses
 * tokens sem documento ("missing"). Em lotes, com pausa entre eles, e confere de novo antes de apagar (um link criado
 * agora há pouco não é órfão). `vivos`: os tokens que o ouvinte conhece; `so`: só estes tokens (o link que acabou de
 * sumir). Devolve os tokens apagados.
 */
async function limparEspelhosOrfaos(db, vivos, log, { so = null, lote = 20, pausaMs = 1000 } = {}) {
  const col = db.collection('areasCliente');
  const refs = so ? so.map(t => col.doc(t)) : await col.listDocuments();
  const candidatos = refs.filter(r => R.tokenValido(r.id) && !vivos.has(r.id));
  const apagados = [];
  for (let i = 0; i < candidatos.length; i += lote) {
    for (const ref of candidatos.slice(i, i + lote)) {
      if ((await ref.get()).exists) continue;
      await db.recursiveDelete(ref);
      apagados.push(ref.id);
    }
    if (i + lote < candidatos.length) await dormir(pausaMs);
  }
  if (apagados.length) log('Área do Cliente: espelho de ' + apagados.length + ' link(s) revogado(s) apagado(s) (' + apagados.map(t => t.slice(0, 6) + '…').join(', ') + ')');
  return apagados;
}

function iniciarAreaDoCliente(db, log) {
  const espelhoDe = token => db.collection('areasCliente').doc(token);
  const core = lerDadosDoCore(log);
  log('Área do Cliente: ' + core.lista.size + ' empresas e ' + core.dp.size + ' clientes do DP lidos do core');

  // ---------- o que os ouvintes guardam ----------
  const links = new Map();            // token → { codigos, nome }
  const pedidosFgts = new Map();      // id → pedido pronto
  const cadastroPorCodigo = new Map();
  const cadastroPorSlug = new Map();
  const execucoes = new Map();        // 'codigo|competencia|departamento' → execução
  const chamados = new Map();         // id → chamado interno
  const prontos = { links: false, fgts: false, cadastro: false, rotinas: false, chamados: false };
  const tudoPronto = () => Object.values(prontos).every(Boolean);
  let revogados = null;   // ligado lá embaixo (5): apaga o espelho do link que acabou de sumir
  const tokensDaEmpresa = codigo => [...links.entries()].filter(([, l]) => l.codigos.some(c => String(c) === String(codigo))).map(([t]) => t);

  // os clientes do Entregas (nome, CPF/CNPJ, enquadramento): lidos de vez em quando, não a cada volta
  let clientes = { em: 0, mapa: new Map() };
  async function clientesDoEntregas() {
    if (Date.now() - clientes.em < CLIENTES_VALEM_MS) return clientes.mapa;
    try {
      const mapa = new Map();
      (await require('./clientes-cache').clientesAtivos(db)).forEach(d => {
        const c = d.data();
        if (c.codigoOrigem != null && String(c.codigoOrigem).trim()) mapa.set(String(c.codigoOrigem).trim(), c);
      });
      clientes = { em: Date.now(), mapa };
    } catch (e) { log('Área do Cliente: clientes do Entregas não vieram -', e.message); }
    return clientes.mapa;
  }

  /** A empresa do código: nome e CNPJ (Entregas → cadastro do nads → lista), o regime que vale e o cliente do DP. */
  function empresaDoCodigo(codigo, mapaClientes, link) {
    const cod = Number(codigo);
    const cl = mapaClientes.get(String(cod)) || null;
    const li = core.lista.get(cod) || null;
    const cad = cadastroPorCodigo.get(cod) || (li ? cadastroPorSlug.get(R.slug(li.nome)) : null) || null;
    return {
      codigo: cod,
      nome: (cl && cl.nome) || (cad && cad.nome) || (li && li.nome) || (link && link.codigos.length === 1 && link.nome) || 'Empresa ' + cod,
      cnpj: String((cl && cl.documento) || (cad && cad.cnpj) || '').replace(/\D/g, ''),
      regime: R.regimeQueVale({ cadastro: cad, entregas: cl, lista: li }),
      dp: core.dp.get(cod) || null,
    };
  }

  // ---------- gravar só o que mudou ----------
  const hashes = new Map();           // 'token/caminho' → hash do que está no espelho
  const fgtsNoEspelho = new Map();    // token → Set(ids das guias do FGTS no espelho)
  const historicoLido = new Set();    // tokens cujos chamados antigos já foram lidos
  const chamadosAntigos = new Map();  // id → chamado fora dos 400 mais recentes
  const pdfsNoEspelho = new Map();    // 'token/guias/id' → hash da guia cujo PDF está lá

  /** O hash do que já está no espelho (da memória; depois de religar, lendo o documento uma vez). */
  async function hashAtual(ref, chave) {
    if (hashes.has(chave)) return hashes.get(chave);
    const s = await ref.get();
    const h = s.exists ? R.hashDoEspelho(s.data()) : '';
    hashes.set(chave, h);
    return h;
  }

  async function gravar(token, caminho, doc, tipo) {
    R.conferirListaBranca(tipo, doc);
    const ref = espelhoDe(token).collection(caminho.split('/')[0]).doc(caminho.split('/')[1]);
    const chave = token + '/' + caminho;
    const novo = R.hashDoEspelho(doc);
    if (await hashAtual(ref, chave) === novo) return false;
    await ref.set(doc);
    hashes.set(chave, novo);
    return true;
  }

  function esquecer(token) {
    for (const m of [hashes, pdfsNoEspelho]) for (const k of [...m.keys()]) if (k.startsWith(token + '/')) m.delete(k);
    fgtsNoEspelho.delete(token);
    historicoLido.delete(token);
  }

  // ---------- 1. o espelho de um link ----------
  async function espelharGuia(token, g) {
    const ref = espelhoDe(token).collection('guias').doc(g.id);
    const chave = token + '/guias/' + g.id;
    let guia = g;
    if (guia.temPdf) {
      const assinatura = R.assinaturaDoPdf(guia);
      let pdfOk = pdfsNoEspelho.get(chave) === assinatura;
      if (!pdfOk && !pdfsNoEspelho.has(chave)) {
        // depois de religar: se a guia do espelho é a mesma (número, valor, vencimento) e os pedaços estão todos lá, o
        // PDF é o mesmo — não baixa de novo
        const s = await ref.get();
        if (s.exists) {
          hashes.set(chave, R.hashDoEspelho(s.data()));
          if (s.get('temPdf') === true && R.assinaturaDoPdf(s.data()) === assinatura) {
            const ps = await ref.collection('pdf').select('n', 'total').get();
            pdfOk = ps.size > 0 && ps.docs.every(d => d.get('total') === ps.size);
          }
        }
      }
      if (!pdfOk) {
        const arq = await db.collection('pedidosFgts').doc(g.id).collection('arquivo').doc('pdf').get();
        const b64 = arq.exists ? arq.get('base64') : '';
        if (b64) {
          // o PDF antes da guia (a guia diz temPdf); pedaços velhos de uma guia anterior saem
          const pedacos = R.pedacosDoPdf(b64);
          const velhos = await ref.collection('pdf').select().get();
          for (const p of pedacos) await ref.collection('pdf').doc(String(p.n)).set(R.conferirListaBranca('pdf', p));
          await Promise.all(velhos.docs.filter(d => Number(d.id) >= pedacos.length).map(d => d.ref.delete()));
          pdfOk = true;
        } else guia = Object.assign({}, guia, { temPdf: false });
      }
      if (pdfOk) pdfsNoEspelho.set(chave, assinatura);
    }
    return gravar(token, 'guias/' + g.id, guia, 'guia');
  }

  /** Tira do espelho as guias do FGTS que saíram (só tipo FGTS: as de DAS/DAE são do envios-do-nads.js). */
  async function limparGuiasDoFgts(token, ids) {
    let antes = fgtsNoEspelho.get(token);
    if (!antes) antes = new Set((await espelhoDe(token).collection('guias').where('tipo', '==', 'FGTS').select().get()).docs.map(d => d.id));
    for (const id of antes) {
      if (ids.has(id)) continue;
      await db.recursiveDelete(espelhoDe(token).collection('guias').doc(id));
      hashes.delete(token + '/guias/' + id);
      pdfsNoEspelho.delete(token + '/guias/' + id);
    }
    fgtsNoEspelho.set(token, ids);
  }

  /** Um chamado no espelho de um link (se o link dele foi trocado, o chamado passa a ser do link novo). */
  async function espelharChamado(id, c, token) {
    if (c.token !== token) {
      await db.collection('chamados').doc(id).update({ token }).catch(e => log('Área do Cliente: chamado', id, 'não mudou de link -', e.message));
      c.token = token;
    }
    return gravar(token, 'chamados/' + id, R.chamadoDoCliente(R.chamadoInterno(id, c)), 'chamado');
  }

  async function espelhar(token) {
    const link = links.get(token);
    if (!link) return;
    const hoje = new Date();
    const agora = hoje.toISOString();
    const mapaClientes = await clientesDoEntregas();
    const comps = R.competenciasDaAgenda(hoje);
    const empresas = [];
    for (const codigo of link.codigos) {
      const e = empresaDoCodigo(codigo, mapaClientes, link);
      e.execucoes = {};
      for (const comp of comps) {
        e.execucoes[comp] = {};
        for (const dep of ['fiscal', 'dp']) e.execucoes[comp][dep] = execucoes.get(e.codigo + '|' + comp + '|' + dep) || null;
      }
      empresas.push(e);
    }
    let gravados = 0;
    if (await gravar(token, 'resumo/atual', R.resumoDoCliente(empresas, ESCRITORIO, agora), 'resumo')) gravados++;

    const guias = R.guiasDoFgtsDoLink([...pedidosFgts.values()], link.codigos, hoje, MESES_DE_GUIAS);
    for (const g of guias) {
      if (await espelharGuia(token, g)) gravados++;
      await dormir(ESPERA_ENTRE_EMPRESAS_MS / 4);
    }
    await limparGuiasDoFgts(token, new Set(guias.map(g => g.id)));

    for (const a of R.agendaDoLink(empresas, comps)) {
      if (await gravar(token, 'agenda/' + a.mes, { mes: a.mes, itens: a.itens, atualizadoEm: agora }, 'agenda')) gravados++;
    }

    // os chamados do link (e os de um link trocado com as mesmas empresas). O ouvinte só traz os 400 mais recentes do
    // escritório: os mais antigos da empresa são lidos uma vez por link (depois de religar) e não mudam mais.
    if (!historicoLido.has(token)) {
      const s = await db.collection('chamados').where('codigos', 'array-contains', link.codigos[0]).get();
      s.docs.forEach(d => { if (!chamados.has(d.id)) chamadosAntigos.set(d.id, d.data()); });
      historicoLido.add(token);
    }
    for (const [id, c] of [...chamadosAntigos, ...chamados]) {
      if (chamados.has(id) && chamados.get(id) !== c) continue;
      if (!R.linksDoChamado(c, links).includes(token)) continue;
      if (await espelharChamado(id, c, token)) gravados++;
    }
    if (gravados) log('Área do Cliente: espelho de ' + (link.nome || token.slice(0, 6)) + ' atualizado (' + gravados + ' documento' + (gravados > 1 ? 's' : '') + ')');
  }

  // a fila dos links a espelhar: um por vez, com espera entre eles
  const fila = new Set();
  let trabalhando = false;
  function agendar(token) { if (token) fila.add(token); setTimeout(trabalhar, 1500); }
  async function trabalhar() {
    if (trabalhando || !tudoPronto() || !fila.size) return;
    trabalhando = true;
    try {
      while (fila.size) {
        const token = fila.values().next().value;
        fila.delete(token);
        try { await espelhar(token); } catch (err) { log('Área do Cliente: espelho de', token.slice(0, 6) + '… falhou -', err.message); }
        await dormir(ESPERA_ENTRE_LINKS_MS);
      }
    } finally { trabalhando = false; }
  }
  const pronto = nome => { if (!prontos[nome]) { prontos[nome] = true; if (tudoPronto()) { log('Área do Cliente: dados carregados; espelhando ' + links.size + ' link(s)'); trabalhar(); } } };

  // ---------- os ouvintes ----------
  ouvir('Área do Cliente: links', () => db.collection('areasCliente'), snap => {
    const novos = new Map();
    for (const d of snap.docs) {
      const x = d.data();
      const codigos = (Array.isArray(x.codigos) ? x.codigos : []).map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (R.tokenValido(d.id) && codigos.length) novos.set(d.id, { codigos, nome: typeof x.nome === 'string' ? x.nome : '' });
    }
    for (const t of links.keys()) if (!novos.has(t)) esquecer(t);
    links.clear();
    for (const [t, l] of novos) links.set(t, l);
    for (const ch of snap.docChanges()) {
      if (ch.type !== 'removed' && links.has(ch.doc.id)) fila.add(ch.doc.id);
      // revogado ou trocado (o nads apaga o link e deixa o espelho): o espelho dele sai já
      if (ch.type === 'removed' && !links.has(ch.doc.id) && revogados) revogados(ch.doc.id);
    }
    pronto('links');
    agendar();
  }, log);

  let primeiraFgts = true;
  ouvir('Área do Cliente: guias do FGTS', () => db.collection('pedidosFgts').where('status', '==', 'pronto'), snap => {
    pedidosFgts.clear();
    for (const d of snap.docs) pedidosFgts.set(d.id, Object.assign({ id: d.id }, d.data()));
    if (!primeiraFgts) for (const ch of snap.docChanges()) tokensDaEmpresa(ch.doc.get('codigo')).forEach(t => fila.add(t));
    primeiraFgts = false;
    pronto('fgts');
    agendar();
  }, log);

  let primeiroCadastro = true;
  ouvir('Área do Cliente: cadastro', () => db.collection('cadastro'), snap => {
    cadastroPorCodigo.clear(); cadastroPorSlug.clear();
    for (const d of snap.docs) {
      const x = d.data();
      cadastroPorSlug.set(d.id, x);
      if (Number.isInteger(Number(x.codigo)) && x.codigo != null) cadastroPorCodigo.set(Number(x.codigo), x);
    }
    if (!primeiroCadastro) for (const ch of snap.docChanges()) tokensDaEmpresa(ch.doc.get('codigo')).forEach(t => fila.add(t));
    primeiroCadastro = false;
    pronto('cadastro');
    agendar();
  }, log);

  // as rotinas das duas competências da agenda; na virada do mês o ouvinte é refeito
  let pararRotinas = null, compsRotinas = '', primeiraRotina = true;
  function ouvirRotinas() {
    const comps = R.competenciasDaAgenda(new Date());
    if (comps.join() === compsRotinas) return;
    if (pararRotinas) pararRotinas();
    compsRotinas = comps.join();
    primeiraRotina = true;
    prontos.rotinas = false;
    pararRotinas = ouvir('Área do Cliente: rotinas', () => db.collection('rotinas').where('competencia', 'in', comps), snap => {
      execucoes.clear();
      for (const d of snap.docs) {
        const x = d.data();
        if (x.codigo != null) execucoes.set(Number(x.codigo) + '|' + x.competencia + '|' + x.departamento, x);
      }
      if (!primeiraRotina) for (const ch of snap.docChanges()) tokensDaEmpresa(ch.doc.get('codigo')).forEach(t => fila.add(t));
      if (primeiraRotina && links.size) links.forEach((_, t) => fila.add(t));   // virada do mês: a agenda muda para todos
      primeiraRotina = false;
      pronto('rotinas');
      agendar();
    }, log);
  }
  ouvirRotinas();
  setInterval(ouvirRotinas, 36e5);

  // 3. os chamados: a resposta da equipe vai para o espelho na hora
  let primeiroChamado = true;
  ouvir('Área do Cliente: chamados', () => db.collection('chamados').orderBy('atualizadoEm', 'desc').limit(400), snap => {
    chamados.clear();
    for (const d of snap.docs) chamados.set(d.id, d.data());
    if (!primeiroChamado && tudoPronto()) {
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed') continue;
        const c = chamados.get(ch.doc.id);
        for (const token of R.linksDoChamado(c, links)) {
          espelharChamado(ch.doc.id, c, token).catch(err => log('Área do Cliente: chamado', ch.doc.id, 'não foi para o espelho -', err.message));
        }
      }
    }
    primeiroChamado = false;
    pronto('chamados');
  }, log);

  // a volta completa a cada 30 min (a situação das guias muda com o dia; o que os ouvintes perderam entra aqui)
  setInterval(() => { links.forEach((_, t) => fila.add(t)); agendar(); }, A_CADA_MS);

  // ---------- os limites por link por dia (guardados no banco: religar o robô não zera) ----------
  const limitesRef = db.collection('robo').doc('areaCliente');
  const limites = { chamados: null, envios: null };
  const limitesProntos = limitesRef.get().then(s => {
    const x = s.exists ? s.data() : {};
    limites.chamados = { dia: x.dia || '', porToken: x.chamados || {} };
    limites.envios = { dia: x.dia || '', porToken: x.envios || {} };
  }).catch(e => { log('Área do Cliente: limites não vieram -', e.message); limites.chamados = { dia: '', porToken: {} }; limites.envios = { dia: '', porToken: {} }; });
  async function contar(qual, token) {
    const dia = hojeIso();
    const virou = limites[qual].dia !== dia;
    limites[qual] = R.contarNoLimite(limites[qual], dia, token);
    if (virou) {
      const outro = qual === 'chamados' ? 'envios' : 'chamados';
      if (limites[outro].dia !== dia) limites[outro] = { dia, porToken: {} };
      await limitesRef.set({ dia, chamados: limites.chamados.porToken, envios: limites.envios.porToken });
    } else await limitesRef.set({ dia, [qual]: { [token]: limites[qual].porToken[token] } }, { merge: true });
  }

  // ---------- 2. a caixa dos chamados ----------
  const tratandoChamados = new Set();
  async function tratarChamado(doc) {
    if (tratandoChamados.has(doc.id)) return;
    tratandoChamados.add(doc.id);
    try {
      await limitesProntos;
      // o snapshot pode ser de antes de o pedido ser tratado e apagado: relê (senão a resposta entraria duas vezes)
      const atual = await doc.ref.get();
      if (!atual.exists) return;
      const v = R.validarPedidoDeChamado(atual.data());
      const token = v.pedido ? v.pedido.token : '';
      const linkSnap = token ? await espelhoDe(token).get() : null;
      const ctx = { linkExiste: !!(linkSnap && linkSnap.exists), contagem: limites.chamados, dia: hojeIso(), espelhoExiste: false, chamado: null };
      if (ctx.linkExiste && v.pedido.chamadoId) {
        const [esp, ch] = await Promise.all([espelhoDe(token).collection('chamados').doc(v.pedido.chamadoId).get(), db.collection('chamados').doc(v.pedido.chamadoId).get()]);
        ctx.espelhoExiste = esp.exists;
        ctx.chamado = ch.exists ? ch.data() : null;
      }
      const d = R.decidirChamado(v, ctx);
      if (d.acao === 'descartar') {
        log('Área do Cliente: pedido de chamado descartado (' + d.motivo + ')');
        await doc.ref.delete();
        return;
      }
      const link = Object.assign({ codigos: [] }, linkSnap.data());
      link.codigos = (link.codigos || []).map(Number);
      const agora = new Date().toISOString();
      const id = d.acao === 'criar' ? doc.id : v.pedido.chamadoId;
      const ref = db.collection('chamados').doc(id);
      if (d.acao === 'criar') {
        const empresa = link.nome || empresaDoCodigo(link.codigos[0], await clientesDoEntregas(), link).nome;
        // o id do chamado é o do pedido (a tela do cliente já o conhece); pedido repetido não cria outro
        await ref.create(R.chamadoNovo(v.pedido, link, empresa, agora)).catch(err => { if (err.code !== 6) throw err; });
      } else {
        await ref.update({
          mensagens: require('firebase-admin/firestore').FieldValue.arrayUnion(R.mensagemDoCliente(v.pedido.texto, agora)),
          situacao: R.situacaoDepoisDoCliente(ctx.chamado.situacao),
          token,
          atualizadoEm: agora,
        });
      }
      const c = (await ref.get()).data();
      chamados.set(id, c);
      await espelharChamado(id, c, token);
      await contar('chamados', token);
      await doc.ref.delete();
      log('Área do Cliente: chamado ' + (d.acao === 'criar' ? 'aberto' : 'respondido pelo cliente') + ' -', (link.nome || ''), '·', c.titulo);
      painel.atividade('area-cliente', (d.acao === 'criar' ? 'Chamado aberto pelo cliente' : 'O cliente respondeu um chamado') + (link.nome ? ' — ' + link.nome : ''), c.titulo || '');
    } catch (err) {
      log('Área do Cliente: pedido de chamado ficou esperando -', err.message);
      painel.erro('area-cliente', 'Um chamado da Área do Cliente ficou esperando', err.message);
    } finally { tratandoChamados.delete(doc.id); }
  }
  let filaChamados = Promise.resolve();
  ouvir('Área do Cliente: caixa dos chamados', () => db.collection('areaClienteChamados').limit(20), snap => {
    snap.docs.forEach(d => { filaChamados = filaChamados.then(() => tratarChamado(d)); });
  }, log);

  // ---------- 4. a caixa dos envios ----------
  const tratandoEnvios = new Set();
  async function tratarEnvio(doc) {
    if (tratandoEnvios.has(doc.id)) return;
    tratandoEnvios.add(doc.id);
    try {
      await limitesProntos;
      const atual = await doc.ref.get();
      if (!atual.exists) return;
      const v = R.validarPedidoDeEnvio(atual.data());
      const token = v.envio ? v.envio.token : '';
      const linkSnap = token ? await espelhoDe(token).get() : null;
      const d = R.decidirEnvio(v, { linkExiste: !!(linkSnap && linkSnap.exists), contagem: limites.envios, dia: hojeIso() });
      if (d.acao === 'descartar') {
        log('Área do Cliente: envio descartado (' + d.motivo + ')');
        await doc.ref.delete();
        return;
      }
      const link = Object.assign({ codigos: [] }, linkSnap.data());
      // link de grupo: vai para a pasta da primeira empresa do link
      const empresa = empresaDoCodigo(Number((link.codigos || [])[0]), await clientesDoEntregas(), link);
      if (!fs.existsSync(DRIVE)) throw new Error('o Drive (' + DRIVE + ') não está no ar');
      const agora = new Date();
      const pasta = path.join(pastaDoCliente(String(agora.getFullYear()), String(empresa.codigo), empresa.nome), PASTA_DOS_RECEBIDOS, String(agora.getMonth() + 1).padStart(2, '0'));
      fs.mkdirSync(pasta, { recursive: true });
      const final = salvarSemRepetir(pasta, R.nomeNoDrive(v.envio, agora), v.envio.buffer);
      const recebidoEm = agora.toISOString();
      await db.collection('areaClienteRecebidos').doc(doc.id).set({
        token, codigo: empresa.codigo, empresa: empresa.nome, nome: v.envio.nome, tipo: v.envio.tipo, tamanho: v.envio.tamanho,
        pastaDrive: path.relative(DRIVE, pasta), arquivoDrive: path.basename(final), recebidoEm,
      });
      await gravar(token, 'envios/' + doc.id, R.reciboDoEnvio({ id: doc.id, nome: v.envio.nome, tipo: v.envio.tipo, tamanho: v.envio.tamanho, recebidoEm }), 'recibo');
      await contar('envios', token);
      await doc.ref.delete();
      log('Área do Cliente: arquivo recebido -', empresa.codigo + ' ' + empresa.nome, '->', path.relative(DRIVE, final));
      painel.atividade('area-cliente', 'Arquivou o que o cliente mandou — ' + empresa.codigo + ' ' + empresa.nome, v.envio.nome + ' → ' + path.relative(DRIVE, final));
    } catch (err) {
      log('Área do Cliente: envio ficou esperando -', err.message);
      painel.erro('area-cliente', 'Um arquivo da Área do Cliente ficou esperando', err.message);
    } finally { tratandoEnvios.delete(doc.id); }
  }
  let filaEnvios = Promise.resolve();
  const verEnvios = docs => docs.forEach(d => { filaEnvios = filaEnvios.then(() => tratarEnvio(d)); });
  ouvir('Área do Cliente: caixa dos envios', () => db.collection('areaClienteEnvios').limit(5), snap => verEnvios(snap.docs), log);
  // o que ficou esperando (Drive fora do ar) tenta de novo
  setInterval(() => { db.collection('areaClienteEnvios').limit(5).get().then(s => verEnvios(s.docs)).catch(() => {}); }, A_CADA_MS);

  // ---------- 5. os espelhos órfãos: na hora em que o link some e, por garantia, uma varredura por dia ----------
  let limpoEm = '';
  async function varrer() {
    if (limpoEm === hojeIso() || !prontos.links) return;
    limpoEm = hojeIso();
    const apagados = await limparEspelhosOrfaos(db, new Set(links.keys()), log);
    apagados.forEach(esquecer);
  }
  setTimeout(() => varrer().catch(e => log('Área do Cliente: limpeza dos órfãos falhou -', e.message)), 10 * 60 * 1000);
  setInterval(() => varrer().catch(e => log('Área do Cliente: limpeza dos órfãos falhou -', e.message)), 36e5);
  revogados = token => {
    limparEspelhosOrfaos(db, new Set(links.keys()), log, { so: [token] })
      .then(a => a.forEach(esquecer))
      .catch(e => log('Área do Cliente: o espelho do link revogado não foi apagado -', e.message));
  };

  log('Área do Cliente: ligado (espelho dos links, caixas de chamados e de envios)');
}

module.exports = { iniciarAreaDoCliente, limparEspelhosOrfaos, pastaDoCliente, salvarSemRepetir, ESCRITORIO };
