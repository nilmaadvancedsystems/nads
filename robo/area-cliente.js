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
//   6. o Registro (12/11/2026, junto do espelho de cada link): resumo/pessoal (os funcionários pelas guias do FGTS, o CPF
//      mascarado) e os documentos do DP dos últimos meses (a lista dpArquivos; o arquivo lido da pasta do cliente no Drive
//      deste PC) em documentos/{id} (tipo 'dp') com os bytes em documentos/{id}~{n}. As regras são do core
//      (areaCliente/pessoal.ts, pelo robo/gerado/danfse.js).
//   7. o Faturamento (12/11/2026): resumo/faturamento, os meses de cada empresa pelas notas emitidas no SIEG
//      (siegSaidas, a mesma fonte da relação de faturamento do Fiscal; ouvidas a partir de janeiro do ano passado, para
//      o acumulado do ano comparar com o ano passado) e o regime (o limite do Simples/MEI); e o painel do mês, pelo
//      resumo das notas (siegNotas) das empresas com link: a venda por dia, os maiores clientes e as operações.
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
// o Registro: os documentos do DP do mês atual e dos dois anteriores; os funcionários pelas guias de seis meses
const MESES_DO_DP = 3;
const MESES_DO_REGISTRO = 6;
const MAIOR_ARQUIVO_DP = 5 * 1024 * 1024;
const DP_VALE_MS = 10 * 60 * 1000;
let geradoDoCore = null;
const doCore = () => geradoDoCore || (geradoDoCore = require('./gerado/danfse'));
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
  const saidasSieg = new Map();       // '<código>_<AAAA-MM>' → as saídas do SIEG do mês (o Faturamento)
  const notasDoMesSieg = new Map();   // '<código>_<AAAA-MM>' → o resumo das notas do mês (o painel do mês; a nota não fica)
  const listaDeNotasSieg = new Map(); // '<código>_<AAAA-MM>' → as notas do mês em lista enxuta (o relatório do dia)
  const logosDasEmpresas = new Map(); // código → a logo (data URL) que o gestor pôs no nads (logosDasEmpresas/{código})
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
    dpNoEspelho.delete(token);
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

  // ---------- 6. o Registro ----------
  const dpNoEspelho = new Map();      // token → Set(ids dos documentos do DP no espelho)
  const dpDoMes = new Map();          // 'AAAA-MM' → { em, clientes } (a lista dpArquivos do mês)
  const guiasLidas = new Map();       // 'origem|id|tamanho' → as guias do FGTS lidas daquele PDF
  const folhasLidas = new Map();      // 'folha|id|tamanho' → { holerites, ferias } lidos daquele PDF (13/11/2026)

  /**
   * Os holerites e a previsão de férias de um PDF do DP (folhaLida.ts), lidos uma vez por arquivo. O CPF do holerite só
   * fica nesta memória (serve para achar a pessoa); para o espelho vai o que a lista branca deixa.
   */
  async function folhaDoPdf(chave, bytes) {
    if (folhasLidas.has(chave)) return folhasLidas.get(chave);
    let lido = { holerites: [], ferias: null };
    try {
      const P = doCore();
      const paginas = await P.itensDoPdf(new Uint8Array(bytes));
      lido = { holerites: P.holeritesDasPaginas(paginas), ferias: P.feriasDasPaginas(paginas) };
    } catch (e) { log('Registro: não li a folha ' + chave + ' -', e.message); }
    folhasLidas.set(chave, lido);
    return lido;
  }

  async function arquivosDoDp(mes) {
    const c = dpDoMes.get(mes);
    if (c && Date.now() - c.em < DP_VALE_MS) return c.clientes;
    let clientesDoMes = {};
    try { const s = await db.collection('dpArquivos').doc(mes).get(); clientesDoMes = (s.exists && s.get('clientes')) || {}; } catch (e) { log('Registro: dpArquivos/' + mes + ' não veio -', e.message); }
    dpDoMes.set(mes, { em: Date.now(), clientes: clientesDoMes });
    return clientesDoMes;
  }

  /** As guias do FGTS de um PDF (o "Detalhe da Guia Emitida"), lidas uma vez por arquivo. */
  async function guiasDoPdf(chave, bytes) {
    if (guiasLidas.has(chave)) return guiasLidas.get(chave);
    let guias = [];
    try {
      const P = doCore();
      guias = P.guiasDoFgtsDasLinhas(P.linhasDaGuiaDoFgts(await P.itensDoPdf(new Uint8Array(bytes))));
    } catch (e) { log('Registro: não li a guia do FGTS ' + chave + ' -', e.message); }
    guiasLidas.set(chave, guias);
    return guias;
  }

  /** O id do documento no espelho, a partir do id do arquivo no Drive (só letras, números, - e _). */
  const idDoDocumentoDp = i => 'dp-' + String(i).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  /** Quantos pedaços de base64 (como os do PDF da guia) o arquivo de tantos bytes dá. */
  const pedacosDe = bytes => { const t = Math.floor(R.PEDACO_PDF / 4) * 4; return Math.max(1, Math.ceil((4 * Math.ceil(bytes / 3)) / t)); };

  async function apagarDocumentoDp(token, id) {
    const col = espelhoDe(token).collection('documentos');
    const pedacos = await col.where('de', '==', id).select().get();
    await Promise.all(pedacos.docs.map(d => d.ref.delete()));
    await col.doc(id).delete();
    hashes.delete(token + '/documentos/' + id);
  }

  /**
   * O Registro do link: os funcionários pelas guias do FGTS (as do robô do FGTS e as da pasta FGTS do Drive) e os
   * documentos do DP dos últimos meses. Grava só o que mudou; o arquivo só é lido do Drive quando muda (o tamanho).
   */
  async function espelharPessoal(token, link, empresas, hoje) {
    const P = doCore();
    let gravados = 0;
    // os funcionários: as guias do robô do FGTS (pedidosFgts, com o PDF no banco)
    const guias = [];
    for (const g of R.guiasDoFgtsDoLink([...pedidosFgts.values()], link.codigos, hoje, MESES_DO_REGISTRO).filter(x => x.temPdf)) {
      const chave = 'fgts|' + g.id + '|' + R.assinaturaDoPdf(g);
      if (!guiasLidas.has(chave)) {
        const arq = await db.collection('pedidosFgts').doc(g.id).collection('arquivo').doc('pdf').get().catch(() => null);
        const b64 = arq && arq.exists ? arq.get('base64') : '';
        if (!b64) { guiasLidas.set(chave, []); continue; }
        await guiasDoPdf(chave, Buffer.from(b64, 'base64'));
      }
      guias.push(...guiasLidas.get(chave));
    }
    // os documentos do DP dos últimos meses, de cada empresa do link
    const meses = Array.from({ length: MESES_DO_DP }, (_, k) => R.competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - k, 1)));
    const docs = [];
    for (const mes of meses) {
      const clientesDoMes = await arquivosDoDp(mes);
      for (const e of empresas) {
        const lista = (clientesDoMes[String(e.codigo)] || {}).arquivos || [];
        for (const a of lista) {
          if (!a || !a.i || !a.n || !P.ehDoDp(String(a.c || ''))) continue;
          const pasta = pastaDoCliente(mes.slice(0, 4), e.codigo, e.nome);
          docs.push({ id: idDoDocumentoDp(a.i), nome: String(a.n).slice(0, 200), pasta: String(a.c), categoria: P.categoriaDoArquivoDp(String(a.n), String(a.c)), competencia: mes,
            tamanho: Number(a.s) || 0, arquivo: path.join(pasta, ...String(a.c).split('/'), String(a.n)) });
        }
      }
    }
    // as guias da pasta FGTS do Drive (o Detalhe da Guia, quando o DP salvou lá)
    for (const d of docs.filter(x => x.categoria === 'fgts' && /\.pdf$/i.test(x.nome) && x.tamanho <= MAIOR_ARQUIVO_DP)) {
      const chave = 'drive|' + d.id + '|' + d.tamanho;
      if (!guiasLidas.has(chave)) {
        try { await guiasDoPdf(chave, fs.readFileSync(d.arquivo)); } catch (e) { guiasLidas.set(chave, []); }
      }
      guias.push(...guiasLidas.get(chave));
    }
    // (13/11/2026) a folha de verdade: os holerites (a folha e os recibos de salário) e a previsão de férias do DP
    // completam o que as guias dão; sem eles, fica a estimativa pelas guias
    const holerites = [];
    const feriasDaFolha = [];
    for (const d of docs.filter(x => ['folha', 'recibo', 'ferias'].includes(x.categoria) && /\.pdf$/i.test(x.nome) && x.tamanho <= MAIOR_ARQUIVO_DP)) {
      const chave = 'folha|' + d.id + '|' + d.tamanho;
      if (!folhasLidas.has(chave)) {
        let bytes;
        try { bytes = fs.readFileSync(d.arquivo); } catch (e) { continue; } // ainda não sincronizou neste PC
        await folhaDoPdf(chave, bytes);
      }
      const lido = folhasLidas.get(chave);
      if (d.categoria !== 'ferias') holerites.push(...lido.holerites);
      if (lido.ferias) feriasDaFolha.push(lido.ferias);
    }
    const reg = P.registroComAFolha(P.registroDasGuias(guias), holerites, feriasDaFolha);
    const vivos = new Set();
    for (const d of docs) {
      if (vivos.has(d.id)) continue;
      const doc = { tipo: 'dp', id: d.id, nome: d.nome, categoria: d.categoria, competencia: d.competencia, tamanho: d.tamanho,
        funcionario: P.donoDoArquivo(d.nome, reg.funcionarios), partes: d.tamanho > MAIOR_ARQUIVO_DP ? 0 : pedacosDe(d.tamanho) };
      const ref = espelhoDe(token).collection('documentos').doc(d.id);
      const chave = token + '/documentos/' + d.id;
      if (await hashAtual(ref, chave) === R.hashDoEspelho(doc)) { vivos.add(d.id); continue; }
      if (doc.partes) {
        let bytes;
        try { bytes = fs.readFileSync(d.arquivo); } catch (e) { continue; } // ainda não sincronizou neste PC: tenta na próxima volta
        doc.tamanho = bytes.length;
        if (bytes.length > MAIOR_ARQUIVO_DP) doc.partes = 0;
        else {
          const pedacos = R.pedacosDoPdf(bytes.toString('base64'));
          doc.partes = pedacos.length;
          const col = espelhoDe(token).collection('documentos');
          for (const pd of pedacos) await col.doc(d.id + '~' + pd.n).set(R.conferirListaBranca('pedacoDp', { base64: pd.base64, n: pd.n, total: pd.total, de: d.id }));
          const velhos = await col.where('de', '==', d.id).select().get();
          await Promise.all(velhos.docs.filter(x => Number(x.id.split('~')[1]) >= pedacos.length).map(x => x.ref.delete()));
        }
      }
      if (await gravar(token, 'documentos/' + d.id, doc, 'documentoDp')) gravados++;
      vivos.add(d.id);
    }
    // os que saíram (o mês ficou velho, o arquivo foi tirado da pasta)
    let antes = dpNoEspelho.get(token);
    if (!antes) antes = new Set((await espelhoDe(token).collection('documentos').where('tipo', '==', 'dp').select().get()).docs.map(x => x.id));
    for (const id of antes) if (!vivos.has(id)) await apagarDocumentoDp(token, id);
    dpNoEspelho.set(token, vivos);
    // o resumo do pessoal: só quando tem funcionário ou documento (sem nada, a aba nem aparece para o cliente)
    if (reg.funcionarios.length || vivos.size) {
      // (13/11/2026) e a folha mês a mês pelas mesmas guias: o custo da folha no Registro
      if (await gravar(token, 'resumo/pessoal', { funcionarios: reg.funcionarios, competencia: reg.competencia, total: reg.total, historico: P.historicoComAFolha(P.historicoDaFolha(guias), holerites), atualizadoEm: hoje.toISOString() }, 'pessoal')) gravados++;
    } else if (await hashAtual(espelhoDe(token).collection('resumo').doc('pessoal'), token + '/resumo/pessoal')) {
      await espelhoDe(token).collection('resumo').doc('pessoal').delete();
      hashes.set(token + '/resumo/pessoal', '');
    }
    return gravados;
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

    // o Registro (os funcionários e os documentos do DP): um erro aqui não para o resto do espelho
    try { gravados += await espelharPessoal(token, link, empresas, hoje); } catch (e) { log('Registro: ' + (link.nome || token.slice(0, 6)) + ' falhou -', e.message); }
    // o Faturamento: os 12 meses de cada empresa pelas notas emitidas no SIEG; sem nenhum mês, o resumo sai
    try {
      const P = doCore();
      const fat = P.faturamentoDoCliente(empresas.map(e => ({ codigo: e.codigo, nome: e.nome, regime: e.regime || '' })), P.competenciasDoFaturamento(hoje),
        (c, m) => saidasSieg.get(c + '_' + m), hoje, (c, m) => notasDoMesSieg.get(c + '_' + m));
      const ref = espelhoDe(token).collection('resumo').doc('faturamento');
      // o que entrou no banco em cada mês, pelos extratos que o escritório leu (13/11/2026); sem acesso, o faturamento segue sem
      const banco = fat ? await entradasDoBanco(empresas) : new Map();
      const fatComBanco = fat && banco.size ? P.comOBanco(fat, c => banco.get(c) || null) : fat;
      if (fatComBanco) { if (await gravar(token, 'resumo/faturamento', fatComBanco, 'faturamento')) gravados++; }
      else if (await hashAtual(ref, token + '/resumo/faturamento')) { await ref.delete(); hashes.set(token + '/resumo/faturamento', ''); }
      // os lançamentos de cada mês com extrato (os últimos 6), um documento por empresa e mês (13/11/2026)
      for (const emp of empresas) {
        const lancs = lancamentosEmCache.get(emp.codigo);
        if (!lancs) continue;
        for (const [mes, l] of lancs) {
          if (await gravar(token, 'resumo/extrato-' + emp.codigo + '-' + mes, { codigo: emp.codigo, competencia: mes, lancamentos: l.lancamentos, cortados: l.cortados, atualizadoEm: agora }, 'extratoLista')) gravados++;
        }
      }
      // o relatório do dia: a lista das notas de cada mês, um documento por empresa e mês (resumo/notas-{código}-{mês})
      for (const emp of empresas) {
        for (const [k, l] of listaDeNotasSieg) {
          if (!k.startsWith(emp.codigo + '_')) continue;
          const mes = k.slice(k.indexOf('_') + 1);
          if (await gravar(token, 'resumo/notas-' + emp.codigo + '-' + mes, { codigo: emp.codigo, competencia: mes, notas: l.notas, cortadas: l.cortadas, atualizadoEm: agora }, 'notasLista')) gravados++;
        }
      }
    } catch (e) { log('Faturamento: ' + (link.nome || token.slice(0, 6)) + ' falhou -', e.message); }

    // a logo da empresa (12/11/2026): a primeira empresa do link que tem logo no nads; sem nenhuma, a marca sai
    try {
      const comLogo = empresas.map(e => logosDasEmpresas.get(e.codigo)).find(Boolean);
      const ref = espelhoDe(token).collection('resumo').doc('marca');
      if (comLogo) { if (await gravar(token, 'resumo/marca', { logo: comLogo, atualizadoEm: agora }, 'marca')) gravados++; }
      else if (await hashAtual(ref, token + '/resumo/marca')) { await ref.delete(); hashes.set(token + '/resumo/marca', ''); }
    } catch (e) { log('Logo: ' + (link.nome || token.slice(0, 6)) + ' falhou -', e.message); }

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
    ouvirNotas();
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

  // as notas do mês (siegNotas, o "Baixar XMLs do SIEG") só das empresas com link (12/11/2026, o painel do mês do
  // Faturamento): cada documento vira o resumo (por dia, os clientes, as operações) e só ele fica na memória. O ouvinte
  // troca quando as empresas dos links mudam; o "in" do Firestore aceita até 30 códigos.
  let codigosDasNotas = null, pararNotas = null, primeirasNotas = true;
  // ---------------------------------------------------------------------------------------------------------------
  // Os extratos (13/11/2026: "no faturamento quero comparação com os extratos bancários"): ficam no projeto da Conferência
  // (conferencia-nilma, extrator/{nome da empresa}/arquivos), não no do Entregas. Um app do firebase-admin com nome
  // próprio para ele (o padrão é o do Entregas); as entradas de cada empresa guardadas por 6 horas (cada leitura traz os
  // arquivos inteiros). Sem permissão nesse projeto, avisa uma vez e o faturamento segue sem o banco.
  const EXTRATOS_A_CADA_MS = 6 * 36e5;
  const entradasEmCache = new Map(); // codigo -> { em, porMes }
  const lancamentosEmCache = new Map(); // codigo -> Map(mês -> { lancamentos, cortados }), os últimos 6 meses com extrato
  let dbConferencia = null, semConferencia = false;
  function conferencia() {
    if (dbConferencia || semConferencia) return dbConferencia;
    try {
      const admin = require('firebase-admin');
      const app = admin.apps.find(a => a && a.name === 'conferencia') || admin.initializeApp({ projectId: 'conferencia-nilma' }, 'conferencia');
      dbConferencia = admin.firestore(app);
    } catch (e) { semConferencia = true; log('Área do Cliente: os extratos da Conferência não abriram -', e.message); }
    return dbConferencia;
  }
  async function entradasDoBanco(empresas) {
    const porCodigo = new Map();
    const dbc = conferencia();
    if (!dbc) return porCodigo;
    for (const e of empresas) {
      const guardado = entradasEmCache.get(e.codigo);
      if (guardado && Date.now() - guardado.em < EXTRATOS_A_CADA_MS) { if (guardado.porMes) porCodigo.set(e.codigo, guardado.porMes); continue; }
      try {
        const doc = dbc.collection('extrator').doc(R.slug(e.nome));
        const snap = await doc.collection('arquivos').where('lado', '==', 'banco').get();
        // os bancos da empresa no Extrator (o nome e a marca de cada conta, para a escolha do banco no Faturamento)
        const bancos = snap.empty ? [] : ((await doc.get()).data()?.bancos || []).map(b => ({ id: String(b.id || ''), nome: String(b.nome || ''), marca: b.marca ? String(b.marca) : undefined })).filter(b => b.id);
        const arquivos = snap.docs.map(d => d.data());
        const porMes = snap.empty ? null : doCore().entradasDosExtratos(arquivos, bancos);
        // os lançamentos dos últimos 6 meses com extrato (a lista do mês na aba Banco do Faturamento)
        if (porMes) {
          const meses = Object.keys(porMes).sort().slice(-6);
          lancamentosEmCache.set(e.codigo, new Map(meses.map(m => [m, doCore().lancamentosDoMes(arquivos, m, bancos)])));
        } else lancamentosEmCache.delete(e.codigo);
        entradasEmCache.set(e.codigo, { em: Date.now(), porMes: porMes && Object.keys(porMes).length ? porMes : null });
        if (porMes && Object.keys(porMes).length) porCodigo.set(e.codigo, porMes);
      } catch (x) {
        if (/permission|PERMISSION_DENIED|7 /i.test(String(x.message))) { semConferencia = true; log('Área do Cliente: sem permissão nos extratos da Conferência; o faturamento segue sem o banco -', x.message); break; }
        log('Área do Cliente: extratos de ' + e.nome + ' falharam -', x.message);
      }
    }
    return porCodigo;
  }

  function ouvirNotas() {
    const codigos = [...new Set([...links.values()].flatMap(l => l.codigos))].sort((a, b) => a - b);
    if (codigos.length > 30) log('Área do Cliente: mais de 30 empresas com link; o painel do mês só das 30 primeiras');
    const chave = codigos.slice(0, 30).join();
    if (chave === codigosDasNotas) return;
    if (pararNotas) { pararNotas(); pararNotas = null; }
    codigosDasNotas = chave;
    notasDoMesSieg.clear();
    primeirasNotas = true;
    if (!codigos.length) return;
    const desde = (new Date().getFullYear() - 1) + '-01';
    pararNotas = ouvir('Área do Cliente: notas do SIEG', () => db.collection('siegNotas').where('codigo', 'in', codigos.slice(0, 30).map(String)), snap => {
      const P = doCore();
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data();
        const k = Number(d.codigo) + '_' + d.competencia;
        if (ch.type === 'removed' || !(String(d.competencia || '') >= desde)) { notasDoMesSieg.delete(k); listaDeNotasSieg.delete(k); continue; }
        try {
          const r = P.notasDoMes(d); if (r) notasDoMesSieg.set(k, r); else notasDoMesSieg.delete(k);
          const l = P.listaDeNotasDoMes(d); if (l) listaDeNotasSieg.set(k, l); else listaDeNotasSieg.delete(k);
        } catch (e) { log('Área do Cliente: notas de', ch.doc.id, 'falharam -', e.message); }
        if (!primeirasNotas) tokensDaEmpresa(d.codigo).forEach(t => fila.add(t));
      }
      primeirasNotas = false;
      agendar();
    }, log);
  }

  // as logos das empresas (12/11/2026): o gestor põe no nads (logosDasEmpresas/{código}); só a que passa no erroDaLogo
  // (PNG, JPG ou WebP em data URL, dentro do tamanho) vai para o espelho
  ouvir('Área do Cliente: logos', () => db.collection('logosDasEmpresas'), snap => {
    const P = doCore();
    for (const ch of snap.docChanges()) {
      const cod = Number(ch.doc.id);
      const logo = ch.doc.get('logo');
      if (ch.type === 'removed' || P.erroDaLogo(logo)) logosDasEmpresas.delete(cod); else logosDasEmpresas.set(cod, logo);
      tokensDaEmpresa(cod).forEach(t => fila.add(t));
    }
    agendar();
  }, log);

  // as saídas do SIEG dos últimos 12 meses (o Faturamento): lidas uma vez ao ligar; depois, só o mês que muda
  let primeirasSaidas = true;
  ouvir('Área do Cliente: saídas do SIEG', () => db.collection('siegSaidas').where('competencia', '>=', (new Date().getFullYear() - 1) + '-01'), snap => {
    for (const ch of snap.docChanges()) {
      const s = ch.doc.data();
      if (ch.type === 'removed') saidasSieg.delete(ch.doc.id); else saidasSieg.set(ch.doc.id, s);
      if (!primeirasSaidas) tokensDaEmpresa(s.codigo).forEach(t => fila.add(t));
    }
    primeirasSaidas = false;
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
      // o pedido de DANFE do relatório do dia (12/11/2026) vem pela mesma caixa, marcado: não vira chamado
      const chaveDanfe = doCore().chaveDoPedidoDeDanfe(atual.data());
      if (chaveDanfe) { await tratarDanfe(doc, atual.data(), chaveDanfe); return; }
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
  // ---------- a DANFE pedida pelo relatório do dia (12/11/2026: "quero poder clicar e ver a danfe da nota") ----------
  // O cliente pede pela caixa dos chamados (título "DANFE", texto "danfe:<chave>"). Só a nota de uma empresa do link (o
  // CNPJ do emitente na chave); o XML vem do Drive pela mesma busca do robô do SIEG (a pasta arquivada do cliente e a do
  // Claudio Secretario); a DANFE é o desenho do nads (desenharDanfe). Sem o XML, o documento sai com o erro (a tela diz).
  const LIMITE_DANFES_POR_DIA = 200;
  const danfesHoje = { dia: '', porToken: {} };
  let xmlsGuardados = { chave: '', em: 0, xmls: [] };   // os XMLs do último mês lido (10 min): várias DANFEs do mesmo mês
  async function xmlDaNota(codigo, competencia, chave) {
    const k = codigo + '_' + competencia;
    if (xmlsGuardados.chave !== k || Date.now() - xmlsGuardados.em > 10 * 60_000) {
      const n = await db.collection('siegNotas').doc(k).get();
      const pasta = n.exists ? path.basename(String(n.get('pasta') || '').replace(/\\/g, '/')) : '';
      const r = await require('./sieg').xmlsJaNoDrive(codigo, pasta || String(codigo), competencia, db);
      xmlsGuardados = { chave: k, em: Date.now(), xmls: r.xmls };
    }
    return xmlsGuardados.xmls.find(x => x.includes('Id="NFe' + chave + '"')) || null;
  }
  async function tratarDanfe(doc, p, chave) {
    const P = doCore();
    const token = R.tokenValido(p.token) ? p.token : '';
    const linkSnap = token ? await espelhoDe(token).get() : null;
    if (!linkSnap || !linkSnap.exists) { log('Área do Cliente: pedido de DANFE descartado (o link não existe)'); await doc.ref.delete(); return; }
    const dia = hojeIso();
    if (danfesHoje.dia !== dia) { danfesHoje.dia = dia; danfesHoje.porToken = {}; }
    if ((danfesHoje.porToken[token] || 0) >= LIMITE_DANFES_POR_DIA) { log('Área do Cliente: pedido de DANFE descartado (passou de ' + LIMITE_DANFES_POR_DIA + ' hoje)'); await doc.ref.delete(); return; }
    danfesHoje.porToken[token] = (danfesHoje.porToken[token] || 0) + 1;
    const id = P.idDaDanfe(chave);
    const col = espelhoDe(token).collection('documentos');
    const ja = await col.doc(id).get();
    if (ja.exists && !ja.get('erro')) { await doc.ref.delete(); return; }
    const link = Object.assign({ codigos: [] }, linkSnap.data());
    const partes = P.partesDaChave(chave);
    const nome = 'DANFE ' + partes.numero + '.pdf';
    const mapa = await clientesDoEntregas();
    const emp = (link.codigos || []).map(Number).map(c => empresaDoCodigo(c, mapa, link)).find(e => e.cnpj === partes.cnpj);
    const gravarMeta = extra => col.doc(id).set(R.conferirListaBranca('documentoDanfe', Object.assign({ tipo: 'danfe', id, nome, chave, partes: 0, atualizadoEm: new Date().toISOString() }, extra)));
    if (!emp) { await gravarMeta({ erro: 'Esta nota não é de uma empresa deste link.' }); await doc.ref.delete(); return; }
    const xml = await xmlDaNota(emp.codigo, partes.competencia, chave);
    if (!xml) {
      await gravarMeta({ erro: 'O XML desta nota ainda não chegou ao Drive do escritório. Tente de novo mais tarde.' });
      await doc.ref.delete();
      log('Área do Cliente: DANFE sem o XML no Drive -', emp.nome, chave);
      return;
    }
    const bytes = Buffer.from(await require('./gerado/danfse').desenharDanfe(xml));
    const pedacos = R.pedacosDoPdf(bytes.toString('base64'));
    // os pedaços primeiro; o documento por último (a tela espera por ele)
    for (const pd of pedacos) await col.doc(id + '~' + pd.n).set(R.conferirListaBranca('pedacoDp', { base64: pd.base64, n: pd.n, total: pd.total, de: id }));
    await gravarMeta({ partes: pedacos.length });
    await doc.ref.delete();
    log('Área do Cliente: DANFE no espelho -', emp.nome, '· nota', partes.numero);
    painel.atividade('area-cliente', 'DANFE pedida pelo cliente' + (link.nome ? ' — ' + link.nome : ''), 'nota ' + partes.numero);
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
