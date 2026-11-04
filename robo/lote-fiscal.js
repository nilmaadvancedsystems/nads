// Fiscal › Relatório › Enviar guias (03/11/2026: "A parte de gmail tem que funcionar assim como o envios do dp, ele sobe o
// arquivo e envia direto via gmail para o cliente, ao enviar o arquivo ele lê e ja coloca os valores na tabela"). O lote do
// DP › Envios (lote-dp.js) para as guias do Fiscal, numa coleção própria (lotesFiscal: as regras do DP ficam como estão).
// Roda no robô da nuvem (vigia-robo.js, com USAR_DRIVE_API=1), ao lado do lote do DP:
//
//   1. a tela (o botão "Enviar guias" do Relatório Simples ou do Presumido; só o Fiscal e o admin) cria
//      lotesFiscal/{lote} { status: 'enviando', grupo: 'sn'|'lp', criadoEm, criadoPor, criadoPorUid, total } e cada guia em
//      lotesFiscal/{lote}/arquivos/{k}, com os pedaços em .../partes/{n}, como o lote do DP;
//   2. a leitura: cada guia pelo leitor do arquivador (montarEntrada + decidir, e os campos da regra da guia: o tributo, o
//      valor, o vencimento e o período de apuração). Vai no arquivo a leitura do DP mais a coluna do Relatório
//      (colunaDaGuia: o DAS no Simples; a DARF do PIS, da COFINS, do IRPJ e da CSLL, o DAE do ICMS e o DAM do ISS no
//      Presumido; o resto sem coluna). A competência é a da APURAÇÃO (a guia de setembro paga em outubro é de 2026-09);
//   3. a tela revisa (o cliente, a coluna e a competência; tirar do lote) e pede o disparo. O robô manda um e-mail por
//      cliente e competência no modelo do Fiscal (config/envioFiscal; vazio = MODELO_PADRAO), para o e-mail do Cadastro do
//      nads (senão o do Entregas), grava cada guia na pasta FISCAL do cliente no Drive (a do arquivador; a escolhida à mão,
//      pela árvore do regime) e registra o envio em solicitacoesEmail (tipo envioFiscal, origem lote);
//   4. depois de cada e-mail enviado, a linha do Relatório (controleTributos/{AAAA-MM}_{código}): o valor de cada coluna
//      que está em branco, a data do envio e Entregue = e-mail, também só se estiverem em branco ("sem trocar o que já
//      estava escrito à mão", a mesma regra do t.preencherComSugestao do nads). Cria a linha se não existir.
const { ouvir } = require('./ouvinte');
const R = require('./arquivador-regras');
const dp = require('./envios-do-dp');
const L = require('./lote-dp');
const painel = require('./painel');

const COLECAO = 'lotesFiscal';
const MAX_ARQUIVOS = 150;
// lote esquecido (a pessoa fechou a tela no meio, ou não disparou): some do banco, com os pedaços, como o do DP
const ESQUECIDO_MS = 3 * 24 * 36e5;
const COMPETENCIA = /^20\d{2}-(0[1-9]|1[0-2])$/;
const GUIAS = ['DAS', 'DARF', 'DAE', 'DAM'];
// as colunas de cada grupo do Relatório (packages/core, GRUPOS_DO_CONTROLE)
const COLUNAS = {
  sn: ['das', 'icms-ant', 'icms-arroz', 'icms-dif', 'icms-dif-ativo', 'st-ent', 'st-sai', 'parc'],
  lp: ['pis', 'cofins', 'irpj', 'csll', 'icms', 'iss', 'ibs', 'cbs', 'parc'],
};
// o e-mail do Fiscal (config/envioFiscal; vazio = este), com {cliente}, {competencia} e {mes} como o do DP
const MODELO_PADRAO = {
  assunto: 'Guias de impostos · {competencia} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSeguem em anexo as guias de impostos referentes a {mes}. Confira os vencimentos em cada guia.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};
const MODELO = { config: 'envioFiscal', padrao: MODELO_PADRAO, chip: 'Fiscal', rotulo: 'do DP e do Fiscal', rodape: 'Mensagem enviada pelo sistema do escritório com as guias do mês.' };

// ---------- funções puras (testadas sem rede) ----------

/**
 * A coluna do Relatório da guia, conforme o grupo do lote ('' = sem coluna: vai no e-mail e não preenche valor). O mesmo de
 * packages/core (tarefas, colunaDaGuia): o DAS no Simples; a DARF do PIS, da COFINS, do IRPJ e da CSLL, o DAE do ICMS e o
 * DAM do ISS no Presumido; o parcelamento, sem coluna (o período da parcela não é o da apuração).
 */
function colunaDaGuia(grupo, tipo, tributo, parcelamento) {
  if (parcelamento) return '';
  const t = String(tributo || '').toUpperCase();
  const coluna = tipo === 'DAS' ? 'das'
    : tipo === 'DARF' && ['PIS', 'COFINS', 'IRPJ', 'CSLL'].includes(t) ? t.toLowerCase()
    : tipo === 'DAE' && t === 'ICMS' ? 'icms'
    : tipo === 'DAM' && t === 'ISS' ? 'iss' : '';
  return coluna && (COLUNAS[grupo] || []).includes(coluna) ? coluna : '';
}

/**
 * Os campos da guia pela regra do arquivador do tipo decidido (DAS, DARF, DAE, DAM): o tributo, o valor, o vencimento, o
 * período de apuração e se é parcelamento; null quando o arquivo não é guia. u: o texto normalizado (R.norm) das 3
 * primeiras páginas, o mesmo da decisão.
 */
function camposDaGuiaFiscal(tipo, u) {
  if (!GUIAS.includes(tipo)) return null;
  const regra = R.REGRAS_PDF.find(r => r.tipo === tipo);
  const c = (regra && regra.campos(u)) || {};
  return { tributo: tipo === 'DAS' ? '' : String(c.tributo || ''), valor: c.valor || '', vencimento: c.vencimento || '', competencia: c.competencia || null, parcelamento: !!c.parcelamento };
}

/**
 * A leitura da guia: a do lote do DP (o cliente, o tipo, a pasta e o nome do arquivador) com o tributo, o valor e a
 * competência da APURAÇÃO lidos na guia, e a coluna do Relatório. O DAM sem o período escrito fica sem competência (a do
 * arquivador, nele, é a do vencimento): a pessoa escolhe na revisão.
 */
function leituraDaGuia(d, guia, entrada, grupo) {
  const l = L.leituraDe(d, guia, entrada);
  if (!guia) return Object.assign(l, { tributo: '', coluna: '', competencia: d.tipo === 'DAM' ? '' : l.competencia });
  const competencia = L.competenciaIso(guia.competencia) || (d.tipo === 'DAM' ? '' : L.competenciaIso(d.competencia));
  return Object.assign(l, { tributo: guia.tributo, valor: guia.valor, vencimento: guia.vencimento, competencia, coluna: colunaDaGuia(grupo, d.tipo, guia.tributo, guia.parcelamento) });
}

/**
 * O que a pessoa decidiu na revisão vale sobre o que o leitor achou. Devolve { codigo, competencia, tipo, tributo, coluna,
 * nome, destino, valor } da guia, ou null quando ela fica fora do lote (marcada fora, ou sem cliente ou competência).
 * A coluna escolhida ('' = sem coluna) vale sobre a do leitor; o valor é sempre o lido na guia (é da guia, não do cliente).
 * destinoManual(codigo, tipo, competencia, nome) -> { destino, nome } ou null: a pasta da guia escolhida à mão (a árvore do
 * regime do cliente); sem ela, a guia vai no e-mail e não é gravada no Drive.
 */
function doGuia(a, grupo, destinoManual) {
  if (!a || a.fora) return null;
  const l = a.leitura || {};
  const e = a.escolha || null;
  // cliente 0 = ainda não escolhido na revisão
  const codigo = e && Number.isInteger(e.cliente) && e.cliente > 0 ? e.cliente : l.cliente;
  const competencia = (e && e.competencia) || l.competencia;
  if (!Number.isInteger(codigo) || !COMPETENCIA.test(competencia || '')) return null;
  const tipo = (e && e.tipo) || l.tipo || 'OUTRO';
  const coluna = e && typeof e.coluna === 'string' ? (COLUNAS[grupo] || []).includes(e.coluna) ? e.coluna : '' : l.coluna || '';
  // mudou o cliente, o tipo ou a competência: a pasta pela árvore do regime, com o nome original; senão, a do arquivador
  const mudou = !!e && (codigo !== l.cliente || tipo !== (l.tipo || 'OUTRO') || competencia !== l.competencia);
  let destino = l.destino || [];
  let nome = l.nomeFinal || a.nome;
  if (mudou || !destino.length) {
    const m = destinoManual(codigo, tipo, competencia, a.nome);
    destino = m ? m.destino : [];
    nome = (m && m.nome) || a.nome;
  }
  return { codigo, competencia, tipo, tributo: mudou ? '' : l.tributo || '', coluna, nome, destino, valor: L.valorNumero(l.valor) };
}

/** As guias do lote por cliente e competência ('58_2026-09' -> [arquivo + vai]), e as que ficam de fora. */
function gruposFiscais(arquivos, grupo, destinoManual) {
  const porChave = new Map();
  const fora = [];
  for (const a of arquivos) {
    const x = doGuia(a, grupo, destinoManual);
    if (!x) { fora.push(a); continue; }
    const chave = x.codigo + '_' + x.competencia;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(Object.assign({}, a, { vai: x }));
  }
  return { porChave, fora };
}

/** Os valores do grupo por coluna do Relatório (somados, se vier mais de uma guia da mesma coluna) */
function valoresPorColuna(itens) {
  const v = {};
  for (const i of itens) {
    const x = i.vai;
    if (!x.coluna || x.valor == null) continue;
    v[x.coluna] = Math.round(((v[x.coluna] || 0) + x.valor) * 100) / 100;
  }
  return v;
}

/** 1234.5 -> '1.234,50' (o texto do valor no Relatório, como o t.valorDoControle do nads) */
function textoDoValor(n) {
  const [inteiro, centavos] = (Math.round(Number(n) * 100) / 100).toFixed(2).split('.');
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + centavos;
}

/** O dia em Brasília (AAAA-MM-DD) de um instante: depois das 21h o ISO (UTC) já é o dia seguinte */
function diaEmBrasilia(quando) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(quando);
}

/**
 * A linha do Relatório depois do envio (controleTributos/{AAAA-MM}_{código}): só o que está em branco muda — o valor de
 * cada coluna, a data (o dia do envio) e o Entregue (e-mail). atual: o documento no banco (null = não existe: nasce com o
 * grupo do lote; existindo, o grupo dela fica). Devolve { linha, preenchidos: [colunas], mudou }.
 */
function linhaDepoisDoEnvio(atual, o) {
  const a = atual && typeof atual === 'object' ? atual : null;
  const antes = { valores: (a && a.valores) || {}, data: (a && typeof a.data === 'string' && a.data) || '', marcas: (a && a.marcas) || {}, entregue: (a && typeof a.entregue === 'string' && a.entregue) || '' };
  const valores = Object.assign({}, antes.valores);
  const preenchidos = [];
  for (const [coluna, n] of Object.entries(o.valores || {})) {
    if (typeof n !== 'number' || !Number.isFinite(n) || String(valores[coluna] || '').trim()) continue;
    valores[coluna] = textoDoValor(n);
    preenchidos.push(coluna);
  }
  const data = antes.data || o.dia;
  const entregue = antes.entregue || 'email';
  const grupo = a && (a.grupo === 'sn' || a.grupo === 'lp') ? a.grupo : o.grupo;
  const mudou = !a || preenchidos.length > 0 || data !== antes.data || entregue !== antes.entregue;
  return {
    linha: { competencia: o.competencia, codigo: Number(o.codigo), grupo, valores, data, marcas: antes.marcas, entregue, atualizadoEm: o.agora, atualizadoPor: String(o.quem || 'robô').slice(0, 100) },
    preenchidos, mudou,
  };
}

// ---------- o banco e o Drive ----------

async function quemPode(db, uid) {
  const u = uid ? ((await db.collection('usuarios').doc(String(uid)).get()).data() || {}) : {};
  const papeis = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
  return papeis.includes('admin') || papeis.includes('fiscal') || u.departamento === 'fiscal';
}

// a pasta da guia escolhida à mão: o último passo do arquivador (a árvore do regime do cliente, a pasta dele no ano)
function destinoPeloArquivador(ctx) {
  return (codigo, tipo, competencia, nome) => {
    if (!GUIAS.includes(tipo)) return null;
    const d = R.finalizar({
      acao: 'ARQUIVAR', cliente: codigo, comoCliente: 'hash', confianca: 1, tipo, setor: 'FISCAL', fiscal: [tipo],
      competencia: { mes: Number(competencia.slice(5)), ano: Number(competencia.slice(0, 4)) }, nomeFinal: nome, evidencias: [],
    }, { cadastro: ctx.cadastro, hoje: new Date() });
    if (d.acao !== 'ARQUIVAR' || !d.pastaCliente || !Array.isArray(d.caminho)) return null;
    return { destino: [String(d.anoRaiz || ''), d.pastaCliente, ...d.caminho].filter(Boolean), nome: d.nomeFinal || nome };
  };
}

// a linha do Relatório, numa transação (a pessoa pode estar escrevendo na mesma linha)
async function gravarNoRelatorio(db, o) {
  const ref = db.collection('controleTributos').doc(o.competencia + '_' + o.codigo);
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    const r = linhaDepoisDoEnvio(s.exists ? s.data() : null, o);
    if (r.mudou) tx.set(ref, r.linha);
    return r.preenchidos;
  });
}

// 2. a leitura
async function lerLote(db, ref, lote, log) {
  if (!(await quemPode(db, lote.criadoPorUid))) throw new Error('só o Fiscal e o administrador sobem lote de guias');
  const grupo = lote.grupo === 'lp' ? 'lp' : lote.grupo === 'sn' ? 'sn' : null;
  if (!grupo) throw new Error('o lote veio sem o grupo do Relatório (Simples ou Presumido)');
  await ref.update({ status: 'lendo', lendoEm: new Date().toISOString() });
  const ctx = await L.contextoDoArquivador(db);
  const novo = require('./arquivador-novo');
  const docs = (await ref.collection('arquivos').get()).docs.slice(0, MAX_ARQUIVOS);
  let lidos = 0;
  for (const doc of docs) {
    const a = doc.data();
    if (a.status !== 'pendente') continue;
    try {
      const buffer = await L.bufferDoArquivo(doc.ref, a);
      const entrada = await novo.montarEntrada(String(a.nome || 'arquivo.pdf'), String(a.nome || ''), buffer);
      const d = R.decidir(entrada, { cadastro: ctx.cadastro, hoje: new Date() });
      const u = R.norm((entrada.texto || []).slice(0, 3).join('\n'));
      await doc.ref.update({ status: 'lido', leitura: leituraDaGuia(d, camposDaGuiaFiscal(d.tipo, u), entrada, grupo), hash: entrada.hash || '' });
    } catch (err) {
      await doc.ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 300) });
    }
    lidos++;
    if (lidos % 5 === 0) await ref.update({ lidos }).catch(() => {});
  }
  await ref.update({ status: 'lido', lidos, lidoEm: new Date().toISOString() });
  log('lote do Fiscal:', lidos, 'guia(s) lida(s) (' + (lote.criadoPor || '?') + ')');
  painel.atividade('gmail', 'Leu o lote de guias do Fiscal (' + lidos + ' arquivos)', lote.criadoPor ? 'pedido de ' + lote.criadoPor : '');
}

// 3 e 4. o disparo: um e-mail por cliente e competência, o registro do envio, a linha do Relatório e o Drive
async function dispararLote(db, ref, lote, deps) {
  const { log } = deps;
  if (!(await quemPode(db, lote.disparadoPorUid))) throw new Error('só o Fiscal e o administrador disparam o lote de guias');
  const grupo = lote.grupo === 'lp' ? 'lp' : 'sn';
  await ref.update({ status: 'disparando', disparandoEm: new Date().toISOString() });
  const ctx = await L.contextoDoArquivador(db);
  const docs = (await ref.collection('arquivos').get()).docs;
  const arquivos = docs.map(d => Object.assign({ id: d.id, ref: d.ref }, d.data())).filter(a => a.status === 'lido' || a.escolha);
  const { porChave } = gruposFiscais(arquivos, grupo, destinoPeloArquivador(ctx));
  const ativos = await require('./clientes-cache').clientesAtivos(db, m => log(m));
  const drive = deps.getDrive();
  const DA = require('./drive-arquivos');
  let enviados = 0;
  let erros = 0;
  for (const [chave, itens] of porChave) {
    // disparar de novo (depois de corrigir o e-mail de quem deu erro) não manda outra vez para quem já recebeu
    if (lote.resultados && lote.resultados[chave] && lote.resultados[chave].status === 'enviado') { enviados++; continue; }
    const { codigo, competencia } = itens[0].vai;
    const resultado = { codigo, competencia, arquivos: itens.map(i => i.vai.nome), valores: valoresPorColuna(itens), preenchidos: [], erroNoRelatorio: '' };
    try {
      const { cliente, para } = await dp.destinatarios(db, codigo, ativos);
      const nome = String(cliente.nome || '').trim();
      const anexos = [];
      for (const i of itens) anexos.push({ nome: i.vai.nome, mime: dp.mimeDe(i.vai.nome), buffer: await L.bufferDoArquivo(i.ref, i) });
      if (anexos.reduce((s, a) => s + a.buffer.length, 0) > dp.MAX_BYTES) throw new Error('as guias do cliente passam de 18 MB juntas');
      const cfg = deps.config ? await deps.config().catch(() => ({})) : {};
      const { gmailId, assunto } = await dp.mandarEmailDoDp(db, { comp: competencia, nome, para, anexos }, { enviar: deps.enviar, caixa: deps.caixa, assinatura: cfg.assinatura || 'Nilma Contabilidade', modelo: MODELO });
      const agora = new Date().toISOString();
      // o envio no histórico do cliente, como o lote do DP
      const registro = await db.collection('solicitacoesEmail').add({
        tipo: 'envioFiscal', origem: 'lote', lote: ref.id, grupo, status: 'enviado', competencia, codigo: String(codigo), empresa: nome, arquivos: [],
        para, enviados: anexos.map(a => a.nome), assunto, gmailId, enviadoEm: agora, criadoEm: agora,
        criadoPor: lote.disparadoPor || '', criadoPorUid: lote.disparadoPorUid || '',
      });
      // a linha do Relatório: o e-mail já foi, então o erro aqui não vira erro do envio (fica no resultado, para conferir à mão)
      try {
        resultado.preenchidos = await gravarNoRelatorio(db, { competencia, codigo, grupo, valores: resultado.valores, dia: diaEmBrasilia(new Date(agora)), agora, quem: 'robô (envio de ' + (lote.disparadoPor || 'guias') + ')' });
      } catch (err) { resultado.erroNoRelatorio = String(err.message || err).slice(0, 200); }
      // e no Drive, na pasta FISCAL do cliente (sem sobrescrever: o mesmo arquivo de novo não duplica)
      const salvos = [];
      for (let k = 0; k < itens.length; k++) {
        const v = itens[k].vai;
        if (!v.destino.length) { salvos.push({ nome: v.nome, erro: 'sem a pasta no Drive (o tipo da guia não tem pasta na árvore do Fiscal ou o cadastro não deu o destino)' }); continue; }
        try {
          const pastaId = await DA.garantirCaminho(drive, v.destino.map(p => String(p).normalize('NFC')));
          const salvo = await DA.salvarArquivoComId(drive, pastaId, v.nome, anexos[k].buffer);
          salvos.push({ nome: salvo.nome || v.nome, pasta: v.destino.join('/'), jaEstava: salvo.jaEstava, id: salvo.id || '' });
        } catch (err) { salvos.push({ nome: v.nome, erro: String(err.message || err).slice(0, 200) }); }
      }
      // o id de cada guia no Drive, no registro do envio: a aba "Enviados" abre a guia por ele (o abrir-do-drive, sem
      // guardar o PDF no banco; 04/11/2026: "quando eu clicar no nome do enviado ou para enviar quero poder ver a guia")
      const guiasDrive = salvos.filter(x => x.id).map(x => ({ nome: x.nome, id: x.id }));
      if (guiasDrive.length) await registro.update({ guiasDrive }).catch(() => {});
      Object.assign(resultado, { status: 'enviado', para, enviadoEm: agora, salvos });
      for (const i of itens) await L.apagarPartes(i.ref).catch(() => {});
      enviados++;
    } catch (err) {
      Object.assign(resultado, { status: 'erro', erro: String(err.message || err).slice(0, 300) });
      erros++;
    }
    await ref.update({ ['resultados.' + chave]: resultado });
  }
  await ref.update({ status: 'disparado', disparadoEm: new Date().toISOString(), enviados, erros });
  log('lote do Fiscal: disparado para', enviados, 'cliente(s)' + (erros ? ', ' + erros + ' com erro' : ''));
  painel.atividade('gmail', 'Disparou as guias do Fiscal (' + enviados + ' clientes' + (erros ? ', ' + erros + ' com erro' : '') + ')', lote.disparadoPor ? 'pedido de ' + lote.disparadoPor : '');
}

// deps: { enviar(dados), getDrive(), config() (a assinatura: config/cobranca), caixa, log }, os mesmos do lote do DP
function iniciarLoteFiscal(db, deps) {
  const { log } = deps;
  let ocupado = false;
  let deNovo = false;
  async function atender() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('status', 'in', ['pendente', 'disparar', 'cancelado']).get();
        for (const doc of snap.docs.sort((a, b) => String(a.get('criadoEm')).localeCompare(String(b.get('criadoEm'))))) {
          const lote = doc.data();
          try {
            // excluído na tela (04/11/2026): some do banco, com as guias e os pedaços
            if (lote.status === 'cancelado') { await db.recursiveDelete(doc.ref); log('lote do Fiscal', doc.id, 'excluído por', lote.canceladoPor || '?'); }
            else if (lote.status === 'pendente') await lerLote(db, doc.ref, lote, log);
            else await dispararLote(db, doc.ref, lote, deps);
          } catch (err) {
            log('lote do Fiscal', doc.id, 'deu erro:', err.message);
            painel.erro('gmail', 'O lote de guias do Fiscal deu erro', err.message);
            await doc.ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 300), erroEm: new Date().toISOString() }).catch(() => {});
          }
        }
      } while (deNovo);
    } catch (err) { log('lote do Fiscal: não li a fila:', err.message); } finally { ocupado = false; }
  }
  ouvir('Lote do Fiscal', () => db.collection(COLECAO).where('status', 'in', ['pendente', 'disparar', 'cancelado']), () => { void atender(); }, log);
  // o lote esquecido some, com os arquivos e os pedaços
  setInterval(async () => {
    try {
      const velhos = await db.collection(COLECAO).where('criadoEm', '<', new Date(Date.now() - ESQUECIDO_MS).toISOString()).limit(10).get();
      for (const d of velhos.docs) await db.recursiveDelete(d.ref);
    } catch (e) { /* tenta de novo depois */ }
  }, 6 * 36e5);
  log('lote do Fiscal: ligado');
}

module.exports = {
  iniciarLoteFiscal,
  // puras, pro teste
  colunaDaGuia, camposDaGuiaFiscal, leituraDaGuia, doGuia, gruposFiscais, valoresPorColuna, textoDoValor, diaEmBrasilia, linhaDepoisDoEnvio,
  MODELO_PADRAO, COLUNAS, COLECAO,
};
