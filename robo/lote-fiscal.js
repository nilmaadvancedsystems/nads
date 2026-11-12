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
//   5. impresso (04/11/2026: "preciso que quando eu va em enviar guias tenha a opção de impresso ou gmail, impresso cria na
//      rotina do entregas a entrega"): o cliente com a via 'impresso' (lotesFiscal/{lote}.vias, gravada pela tela) não
//      recebe e-mail: o robô põe a entrega na rota do Entregas (entregas/{id}, status 'pendente', os mesmos campos do
//      dadosDaEntregaNova do nads), com cada guia anexada (anexos/guia-<tipo>, o PDF se couber e o id no Drive), grava no
//      Drive como o e-mail e preenche o Relatório com Entregue = Impresso (a data fica para quando a entrega for confirmada).
const { ouvir } = require('./ouvinte');
const R = require('./arquivador-regras');
const dp = require('./envios-do-dp');
const L = require('./lote-dp');
const EC = require('./econtador');
const painel = require('./painel');

const COLECAO = 'lotesFiscal';
const MAX_ARQUIVOS = 150;
// lote esquecido (a pessoa fechou a tela no meio, ou não disparou): some do banco, com os pedaços, como o do DP
const ESQUECIDO_MS = 3 * 24 * 36e5;
const COMPETENCIA = /^20\d{2}-(0[1-9]|1[0-2])$/;
const GUIAS = ['DAS', 'DARF', 'DAE', 'DAM'];
// o PDF da guia vai no anexo da entrega até este tamanho (o mesmo LIMITE_PDF_ANEXO do Entregas); maior, só o id no Drive
const LIMITE_PDF_ANEXO = 700000;
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
function colunaDaGuia(grupo, tipo, tributo, parcelamento, receita) {
  if (parcelamento) return '';
  const t = String(tributo || '').toUpperCase();
  const coluna = tipo === 'DAS' ? 'das'
    : tipo === 'DARF' && ['PIS', 'COFINS', 'IRPJ', 'CSLL'].includes(t) ? t.toLowerCase()
    : tipo === 'DAE' && t === 'ICMS' ? (grupo === 'sn' ? colunaDoIcmsDoSimples(receita) : 'icms')
    : tipo === 'DAM' && t === 'ISS' ? 'iss' : '';
  return coluna && (COLUNAS[grupo] || []).includes(coluna) ? coluna : '';
}

/**
 * A coluna do ICMS do Simples pela receita escrita no DAE (04/11/2026: "preciso que coloque a opção econtador do alterdata como envio e tambem preciso que preencha dae e icms na planilha la, enviei 2 dae via impresso e não preencheu"). O mesmo de packages/core
 * (colunaDoIcmsDoSimples): antecipação → icms-ant, diferencial de alíquota → icms-dif (do ativo: icms-dif-ativo), arroz →
 * icms-arroz, ST → st-ent (de saída: st-sai); sem receita reconhecida, '' (a pessoa escolhe na revisão).
 */
function colunaDoIcmsDoSimples(receita) {
  const r = String(receita || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!r) return '';
  if (/ARROZ/.test(r)) return 'icms-arroz';
  if (/DIFERENCA DE ALIQ|DIF\.? ?(DE )?ALIQ|DIFAL/.test(r)) return /ATIVO|IMOBILIZ/.test(r) ? 'icms-dif-ativo' : 'icms-dif';
  if (/ANTECIPA/.test(r)) return 'icms-ant';
  if (/SUBST|\bS\.? ?T\b/.test(r)) return /SAIDA/.test(r) ? 'st-sai' : 'st-ent';
  return '';
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
  return { tributo: tipo === 'DAS' ? '' : String(c.tributo || ''), valor: c.valor || '', vencimento: c.vencimento || '', competencia: c.competencia || null, parcelamento: !!c.parcelamento, receita: String(c.receita || ''), partes: Array.isArray(c.partes) ? c.partes : null };
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
  // o DARF com mais de um tributo (05/11/2026): cada parte na coluna dela; sem coluna para alguma, vale o total numa coluna só
  const partes = (guia.partes || []).map(p => ({ tributo: p.tributo, valor: p.valor, coluna: colunaDaGuia(grupo, d.tipo, p.tributo, guia.parcelamento, '') }));
  const divide = partes.length > 1 && partes.every(p => p.coluna);
  return Object.assign(l, { tributo: guia.tributo, valor: guia.valor, vencimento: guia.vencimento, competencia, receita: guia.receita || '', coluna: colunaDaGuia(grupo, d.tipo, guia.tributo, guia.parcelamento, guia.receita), partes: divide ? partes : [] });
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
  // as partes do DARF de mais de um tributo, quando a pessoa não escolheu uma coluna só
  const partes = !(e && typeof e.coluna === 'string') && Array.isArray(l.partes) && l.partes.length > 1
    ? l.partes.filter(p => (COLUNAS[grupo] || []).includes(p.coluna)).map(p => ({ coluna: p.coluna, valor: L.valorNumero(p.valor) })) : [];
  return { codigo, competencia, tipo, tributo: mudou ? '' : l.tributo || '', coluna, nome, destino, valor: L.valorNumero(l.valor), partes };
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
    const lista = x.partes && x.partes.length ? x.partes : [{ coluna: x.coluna, valor: x.valor }];
    for (const p of lista) {
      if (!p.coluna || p.valor == null) continue;
      v[p.coluna] = Math.round(((v[p.coluna] || 0) + p.valor) * 100) / 100;
    }
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
 * cada coluna, a data (o dia do envio) e o Entregue (o.entregue: 'email', o padrão, ou 'impresso', que vai sem o dia: a
 * data é a da entrega confirmada). atual: o documento no banco (null = não existe: nasce com o grupo do lote; existindo, o
 * grupo dela fica). Devolve { linha, preenchidos: [colunas], mudou }.
 */
function linhaDepoisDoEnvio(atual, o) {
  const a = atual && typeof atual === 'object' ? atual : null;
  const antes = { valores: (a && a.valores) || {}, data: (a && typeof a.data === 'string' && a.data) || '', marcas: (a && a.marcas) || {}, entregue: (a && typeof a.entregue === 'string' && a.entregue) || '' };
  const valores = Object.assign({}, antes.valores);
  const preenchidos = [];
  for (const [coluna, n] of Object.entries(o.valores || {})) {
    // o "0" (sem imposto) não segura: se veio guia, vale o valor dela (05/11/2026); o resto que já tem valor fica
    const tinha = String(valores[coluna] || '').trim();
    if (typeof n !== 'number' || !Number.isFinite(n) || (tinha && !/^0(,00)?$/.test(tinha))) continue;
    valores[coluna] = textoDoValor(n);
    preenchidos.push(coluna);
  }
  const data = antes.data || o.dia || '';
  const entregue = antes.entregue || o.entregue || 'email';
  const grupo = a && (a.grupo === 'sn' || a.grupo === 'lp') ? a.grupo : o.grupo;
  const mudou = !a || preenchidos.length > 0 || data !== antes.data || entregue !== antes.entregue;
  return {
    linha: { competencia: o.competencia, codigo: Number(o.codigo), grupo, valores, data, marcas: antes.marcas, entregue, atualizadoEm: o.agora, atualizadoPor: String(o.quem || 'robô').slice(0, 100) },
    preenchidos, mudou,
  };
}

/** '20/10/2026', '20-10-2026' ou '2026-10-20' -> '2026-10-20'; '' sem data */
function diaIso(v) {
  const t = String(v || '');
  let m = /(\d{2})[/.-](\d{2})[/.-](\d{4})/.exec(t);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = /(20\d{2})-(\d{2})-(\d{2})/.exec(t);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/**
 * A entrega do impresso, campo a campo como o dadosDaEntregaNova do nads (packages/core, entregas) grava na Nova entrega
 * (Preparar rota): status 'pendente', na zona do cliente, um item por guia (o tipo e o valor) e o vencimento mais cedo.
 * cliente: { id, codigoOrigem, nome, zona }; itens: [{ tipo, valor, vencimento }]; quem: { email, nome }.
 */
function entregaDoImpresso(cliente, competencia, itens, quem, agora) {
  const vencimentos = itens.map(i => diaIso(i.vencimento)).filter(Boolean).sort();
  return {
    clienteId: cliente.id,
    clienteNome: (cliente.codigoOrigem ? cliente.codigoOrigem + ' - ' : '') + String(cliente.nome || '').trim(),
    avulso: false, banco: null, competencia, vencimento: vencimentos[0] || '', codigoPagamento: null, temGuia: false,
    itens: itens.map(i => ({ tipo: i.tipo || 'Guia', valor: typeof i.valor === 'number' && Number.isFinite(i.valor) ? i.valor : null })),
    recebedor: '', temAssinatura: false, temFoto: false, falha: false, motivoFalha: '', zona: String(cliente.zona || ''), canal: '',
    geo: null, localDivergente: false, entregadoPor: quem.email || '', entregadoPorNome: quem.nome || quem.email || 'robô',
    status: 'pendente', criadoEm: agora, confirmadoEm: null,
  };
}

// O documento para comparar, como o chaveDoDocumento do nads: sem acento, sem caixa e sem espaço sobrando
const chaveDoDocumento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/**
 * Quais guias do impresso já estão na rota (11/11/2026: "quero que o modulo não deixe eu colocar algo rota sendo que ja esteja
 * em rota"), a mesma regra do jaNaRota do nads: o mesmo documento ("DAE ICMS") numa parada do cliente, da mesma competência,
 * que ainda não foi entregue (na rota ou no link). rotulos: o documento de cada guia; -> [true/false] na mesma ordem.
 */
function jaNaRota(rotulos, entregasDoCliente, competencia) {
  const na = new Set((entregasDoCliente || [])
    .filter(e => e && e.competencia === competencia && (e.status === 'pendente' || e.status === 'link'))
    .reduce((l, e) => l.concat((Array.isArray(e.itens) ? e.itens : []).map(i => chaveDoDocumento(i && i.tipo))), []));
  return rotulos.map(r => na.has(chaveDoDocumento(r)));
}

/** Os ids dos anexos das guias na entrega: 'guia-das', 'guia-darf-pis', e '-2' quando repete */
function idsDosAnexos(itens) {
  const usados = new Set();
  return itens.map(i => {
    const base = 'guia-' + ([i.tipo, i.tributo].filter(Boolean).join('-').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outra');
    let id = base;
    for (let n = 2; usados.has(id); n++) id = base + '-' + n;
    usados.add(id);
    return id;
  });
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
  // mais guias no mesmo lote (05/11/2026): as já lidas ficam como estão e contam no andamento; só as pendentes são lidas
  let lidos = docs.filter(x => x.get('status') === 'lido' || x.get('status') === 'erro').length;
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

// 5. o impresso: o Drive, a entrega na rota do Entregas com as guias anexadas, o registro e o Relatório (Entregue = Impresso)
async function impresso(db, ref, lote, { codigo, competencia, itens, ativos, grupo, salvarNoDrive }) {
  let doc = null;
  ativos.forEach(d => { if (!doc && String(d.data().codigoOrigem || '').trim() === String(codigo)) doc = d; });
  if (!doc) throw new Error('o cliente ' + codigo + ' não está no cadastro do Entregas (ou está inativo)');
  const cliente = Object.assign({ id: doc.id }, doc.data());
  const buffers = [];
  for (const i of itens) buffers.push(await L.bufferDoArquivo(i.ref, i));
  const salvos = await salvarNoDrive(itens, buffers);
  const u = lote.disparadoPorUid ? ((await db.collection('usuarios').doc(String(lote.disparadoPorUid)).get()).data() || {}) : {};
  const quem = { email: String(u.email || ''), nome: String(lote.disparadoPor || u.nome || '') };
  const agora = new Date().toISOString();
  const doGuia = itens.map(i => ({ tipo: i.vai.tipo === 'OUTRO' ? '' : i.vai.tipo, tributo: i.vai.tributo, valor: i.vai.valor, vencimento: (i.leitura && i.leitura.vencimento) || '' }));
  const rotulos = doGuia.map(g => [g.tipo, g.tributo].filter(Boolean).join(' ') || 'Guia');
  // o que já está na rota desse cliente nessa competência não vai de novo (a guia fica no Drive e no Relatório como sempre)
  const doCliente = (await db.collection('entregas').where('clienteId', '==', cliente.id).where('competencia', '==', competencia).get())
    .docs.map(d => Object.assign({ id: d.id }, d.data()));
  const ja = jaNaRota(rotulos, doCliente, competencia);
  const vao = doGuia.map((g, k) => k).filter(k => !ja[k]);
  const jaEstavam = rotulos.filter((r, k) => ja[k]);
  let entregaId = '';
  if (vao.length) {
    const entregaRef = db.collection('entregas').doc();
    entregaId = entregaRef.id;
    const batch = db.batch();
    batch.set(entregaRef, entregaDoImpresso(cliente, competencia, vao.map(k => ({ tipo: rotulos[k], valor: doGuia[k].valor, vencimento: doGuia[k].vencimento })), quem, agora));
    // cada guia anexada (o Entregas lê todo anexo guia-*): o PDF se couber no documento, e o id no Drive sempre que houver
    idsDosAnexos(vao.map(k => doGuia[k])).forEach((id, j) => {
      const k = vao[j];
      const pdf = buffers[k].length <= LIMITE_PDF_ANEXO ? buffers[k].toString('base64') : null;
      const g = { tipo: (doGuia[k].tipo || 'guia').toLowerCase(), nome: (salvos[k] && salvos[k].nome) || itens[k].vai.nome, driveId: (salvos[k] && salvos[k].id) || '', tamanho: buffers[k].length, em: agora };
      if (pdf && pdf.length <= LIMITE_PDF_ANEXO) g.pdf = pdf;
      batch.set(entregaRef.collection('anexos').doc(id), g);
    });
    await batch.commit();
    // o cliente passa a ser do Entregas (o app marca na primeira entrega)
    if (cliente.entrega !== true) await db.collection('clientes').doc(cliente.id).update({ entrega: true }).catch(() => {});
  } else {
    // tudo já estava na rota: o registro aponta a parada que já está lá
    const la = doCliente.find(e => (e.status === 'pendente' || e.status === 'link') && (e.itens || []).some(i => rotulos.some(r => chaveDoDocumento(r) === chaveDoDocumento(i && i.tipo))));
    entregaId = la ? la.id : '';
  }
  const resultado = { status: 'enviado', para: [], enviadoEm: agora, salvos, entregaId, jaNaRota: jaEstavam, preenchidos: [], erroNoRelatorio: '' };
  // o registro (a aba "Enviados"), com a via
  const guiasDrive = salvos.filter(x => x.id).map(x => ({ nome: x.nome, id: x.id }));
  await db.collection('solicitacoesEmail').add({
    tipo: 'envioFiscal', via: 'impresso', origem: 'lote', lote: ref.id, grupo, status: 'enviado', competencia, codigo: String(codigo),
    empresa: String(cliente.nome || '').trim(), arquivos: [], para: [], enviados: itens.map(i => i.vai.nome), entregaId, ...(jaEstavam.length ? { jaNaRota: jaEstavam } : {}),
    enviadoEm: agora, criadoEm: agora, criadoPor: lote.disparadoPor || '', criadoPorUid: lote.disparadoPorUid || '', ...(guiasDrive.length ? { guiasDrive } : {}),
  }).catch(() => {});
  try {
    resultado.preenchidos = await gravarNoRelatorio(db, { competencia, codigo, grupo, valores: valoresPorColuna(itens), dia: '', entregue: 'impresso', agora, quem: 'robô (impresso de ' + (lote.disparadoPor || 'guias') + ')' });
  } catch (err) { resultado.erroNoRelatorio = String(err.message || err).slice(0, 200); }
  return resultado;
}

// 6. o eContador do Alterdata (04/11/2026: "preciso que coloque a opção econtador do alterdata como envio e tambem preciso que preencha dae e icms na planilha la, enviei 2 dae via impresso e não preencheu"): as guias no Drive, o registro (a aba "Enviados", via 'econtador') e o
// Relatório com o valor de cada coluna, a data do disparo e Entregue = eContador; sem e-mail e sem entrega na rota
// e o SCI Report (06/11/2026: "quero que coloque la em envio o sci report"): o mesmo, com via e Entregue = 'scireport'
// e o WhatsApp (12/11/2026, ticket 1ORUBY: "Inserir tipo de envio 'Whastapp'"): o mesmo, com via e Entregue = 'zap'; quem manda
// é a pessoa, pela tela (o wa.me com a mensagem do modelo e as guias baixadas para anexar)
async function econtador(db, ref, lote, { codigo, competencia, itens, ativos, grupo, salvarNoDrive, via = 'econtador' }) {
  let doc = null;
  ativos.forEach(d => { if (!doc && String(d.data().codigoOrigem || '').trim() === String(codigo)) doc = d; });
  const nome = doc ? String(doc.data().nome || '').trim() : '';
  const buffers = [];
  for (const i of itens) buffers.push(await L.bufferDoArquivo(i.ref, i));
  const salvos = await salvarNoDrive(itens, buffers);
  const agora = new Date().toISOString();
  const resultado = { status: 'enviado', para: [], enviadoEm: agora, salvos, entregaId: '', preenchidos: [], erroNoRelatorio: '' };
  const guiasDrive = salvos.filter(x => x.id).map(x => ({ nome: x.nome, id: x.id }));
  const registro = await db.collection('solicitacoesEmail').add({
    tipo: 'envioFiscal', via, origem: 'lote', lote: ref.id, grupo, status: 'enviado', competencia, codigo: String(codigo),
    empresa: nome, arquivos: [], para: [], enviados: itens.map(i => i.vai.nome),
    enviadoEm: agora, criadoEm: agora, criadoPor: lote.disparadoPor || '', criadoPorUid: lote.disparadoPorUid || '', ...(guiasDrive.length ? { guiasDrive } : {}),
  }).catch(() => null);
  // a via eContador com a pasta do UpDocs ligada (07/11/2026, econtador.js; desligada por padrão): as guias, já no Drive,
  // entram na fila da pasta que o UpDocs vigia no NILMA-SERVER; o registro ganha econtadorSaida (e, gravadas, econtador)
  if (via === 'econtador' && await EC.pastaLigada(db)) {
    const arquivos = salvos.map((s, k) => ({ driveId: s.id || '', nome: s.nome, rotulo: [itens[k].vai.tipo === 'OUTRO' ? '' : itens[k].vai.tipo, itens[k].vai.tributo].filter(Boolean).join(' ') }));
    resultado.econtadorSaida = await EC.anotarSaida(db, { origem: 'lote-fiscal', codigo, competencia, empresa: nome, registro: registro ? registro.id : '', arquivos })
      .catch(err => { resultado.erroNoEcontador = String(err.message || err).slice(0, 200); return ''; });
  }
  try {
    resultado.preenchidos = await gravarNoRelatorio(db, { competencia, codigo, grupo, valores: valoresPorColuna(itens), dia: diaEmBrasilia(new Date(agora)), entregue: via, agora, quem: 'robô (' + (via === 'scireport' ? 'SCI Report' : via === 'zap' ? 'WhatsApp' : 'eContador') + ' de ' + (lote.disparadoPor || 'guias') + ')' });
  } catch (err) { resultado.erroNoRelatorio = String(err.message || err).slice(0, 200); }
  return resultado;
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
  const vias = lote.vias && typeof lote.vias === 'object' ? lote.vias : {};
  // cada guia na pasta FISCAL do cliente no Drive (sem sobrescrever: o mesmo arquivo de novo não duplica)
  async function salvarNoDrive(itens, buffers) {
    const salvos = [];
    for (let k = 0; k < itens.length; k++) {
      const v = itens[k].vai;
      if (!v.destino.length) { salvos.push({ nome: v.nome, erro: 'sem a pasta no Drive (o tipo da guia não tem pasta na árvore do Fiscal ou o cadastro não deu o destino)' }); continue; }
      try {
        const pastaId = await DA.garantirCaminho(drive, v.destino.map(p => String(p).normalize('NFC')));
        const salvo = await DA.salvarArquivoComId(drive, pastaId, v.nome, buffers[k]);
        salvos.push({ nome: salvo.nome || v.nome, pasta: v.destino.join('/'), jaEstava: salvo.jaEstava, id: salvo.id || '' });
      } catch (err) { salvos.push({ nome: v.nome, erro: String(err.message || err).slice(0, 200) }); }
    }
    return salvos;
  }
  let enviados = 0;
  let erros = 0;
  for (const [chave, itens] of porChave) {
    // disparar de novo (depois de corrigir o e-mail de quem deu erro) não manda outra vez para quem já recebeu
    if (lote.resultados && lote.resultados[chave] && lote.resultados[chave].status === 'enviado') { enviados++; continue; }
    const { codigo, competencia } = itens[0].vai;
    const via = ['impresso', 'econtador', 'scireport', 'zap'].includes(vias[String(codigo)]) ? vias[String(codigo)] : 'email';
    const resultado = { codigo, competencia, via, arquivos: itens.map(i => i.vai.nome), valores: valoresPorColuna(itens), preenchidos: [], erroNoRelatorio: '' };
    try {
      if (via !== 'email') {
        Object.assign(resultado, await (via === 'impresso' ? impresso : econtador)(db, ref, lote, { codigo, competencia, itens, ativos, grupo, salvarNoDrive, via }));
        for (const i of itens) await L.apagarPartes(i.ref).catch(() => {});
        enviados++;
        await ref.update({ ['resultados.' + chave]: resultado });
        continue;
      }
      const { cliente, para } = await dp.destinatarios(db, codigo, ativos);
      const nome = String(cliente.nome || '').trim();
      const anexos = [];
      for (const i of itens) anexos.push({ nome: i.vai.nome, mime: dp.mimeDe(i.vai.nome), buffer: await L.bufferDoArquivo(i.ref, i), rotulo: [i.vai.tipo === 'OUTRO' ? '' : i.vai.tipo, i.vai.tributo].filter(Boolean).join(' '), valor: i.vai.valor, vencimento: ((i.leitura || {}).vencimento) || '' });
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
      const salvos = await salvarNoDrive(itens, anexos.map(a => a.buffer));
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
  const impressos = Object.values(vias).filter(v => v === 'impresso').length;
  log('lote do Fiscal: disparado para', enviados, 'cliente(s)' + (impressos ? ' (até ' + impressos + ' impresso(s), na rota do Entregas)' : '') + (erros ? ', ' + erros + ' com erro' : ''));
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
    require('./ocupado').marcar('lote-fiscal', 'Lote do Fiscal');   // sair com calma espera o lote (07/11/2026)
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
    } catch (err) { log('lote do Fiscal: não li a fila:', err.message); } finally { ocupado = false; require('./ocupado').marcar('lote-fiscal', null); }
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
  colunaDaGuia, colunaDoIcmsDoSimples, camposDaGuiaFiscal, leituraDaGuia, doGuia, gruposFiscais, valoresPorColuna, textoDoValor, diaEmBrasilia, linhaDepoisDoEnvio,
  diaIso, entregaDoImpresso, idsDosAnexos, jaNaRota,
  MODELO_PADRAO, COLUNAS, COLECAO,
};
