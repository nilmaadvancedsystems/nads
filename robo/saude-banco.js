// O resumo diário da saúde do banco, para o site do admin (Vitor, 21/10/2026: "quero um site específico só para quem é
// admin, para ter acesso a desempenho do robô, uso de sistema, saúde do banco de dados e coisas assim").
//
// Uma vez por dia o robô da nuvem grava robo/saudeBanco (só o admin lê; firestore.rules do Entregas) com:
//   colecoes    o tamanho de cada coleção de cima (count(), 1 leitura a cada 1.000 documentos) e o de 7 dias atrás
//               (guardado no próprio documento, em historico), para achar a que cresce demais;
//   orfaos      as subcoleções que ficaram sem o documento de cima (o espelho da Área do Cliente sem o link, as partes de
//               um feedback ou de um extrato que já saiu): listDocuments() mostra o documento "fantasma" que só tem
//               subcoleção. Só nas coleções da lista ORFAOS e só até MAX_POR_COLECAO documentos (a maior fica para outro
//               dia, com o aviso) — é a parte que gasta leitura;
//   usoPorDia   leituras, gravações e exclusões de cada um dos últimos 30 dias (o dia da cota: da meia-noite à meia-noite
//               da Califórnia), perguntadas ao Cloud Monitoring (só leitura de métrica, grátis). Só os dias que faltam: no
//               primeiro dia, 30; depois, 1 por dia;
//   armazenamento  o tamanho do banco (dados + índices), a métrica firestore storage/data_and_index_storage_bytes;
//   hospedagem  o espaço usado e o limite da hospedagem de cada projeto (firebasehosting storage/total_bytes e
//               storage/limit; e o tráfego do mês, network/monthly_sent). O robô só enxerga o projeto em que tiver
//               permissão de ler métricas: sem ela, fica o erro (nenhum número inventado).
//
// Nada aqui cria recurso pago: só lê métricas e conta documentos. Regra do módulo: NUNCA derrubar o robô (todo erro vira
// uma linha em `erros` e no log).
require('./fuso.js');
const { GoogleAuth } = require('google-auth-library');
const { inicioDoDiaDaCota, somaDaResposta } = require('./uso-banco');

const PROJETO = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'entregas-2e5e2';
// os projetos com sites do nads (a hospedagem); SAUDE_HOSPEDAGEM=proj1,proj2 troca a lista
const PROJETOS_DA_HOSPEDAGEM = (process.env.SAUDE_HOSPEDAGEM || 'conferencia-nilma,entregas-2e5e2').split(',').map(s => s.trim()).filter(Boolean);
const DOC = ['robo', 'saudeBanco'];
const DIAS_DE_USO = 30;
const DIAS_DO_HISTORICO = 8;
const UM_DIA_MS = 24 * 36e5;
// quando roda: confere de hora em hora; faz se o último resumo tem mais de 23 h
const CONFERE_A_CADA_MS = 36e5;
const VALIDADE_MS = 23 * 36e5;
const PRIMEIRA_ESPERA_MS = 5 * 60 * 1000;
const MAX_POR_COLECAO = 2000;
const MAX_ORFAOS_NO_TOTAL = 6000;

/** As coleções com subcoleção pesada (as partes de arquivo, o espelho do cliente): onde um órfão ocupa espaço. */
const ORFAOS = [
  { colecao: 'areasCliente', rotulo: 'Espelhos da Área do Cliente sem link' },
  { colecao: 'feedbacks', rotulo: 'Partes de feedback sem o feedback' },
  { colecao: 'extratosRecebidos', rotulo: 'Partes de extrato sem o extrato' },
  { colecao: 'enviosSecretario', rotulo: 'Partes de envio do nads sem o envio' },
  { colecao: 'anexosTarefas', rotulo: 'Partes de anexo de tarefa sem o anexo' },
  { colecao: 'anexosIA', rotulo: 'Partes de anexo da IA sem o anexo' },
  { colecao: 'buscasEmail', rotulo: 'Partes de busca no e-mail sem a busca' },
  { colecao: 'aberturasDrive', rotulo: 'Partes de arquivo do Drive sem o pedido' },
  { colecao: 'solicitacoesEmail', rotulo: 'Partes de pedido de e-mail sem o pedido' },
  { colecao: 'pedidosFgts', rotulo: 'Guias do FGTS sem o pedido' },
  { colecao: 'pedidosAlterdata', rotulo: 'Balancetes do Alterdata sem o pedido' },
  { colecao: 'pedidosSieg', rotulo: 'XMLs do SIEG sem o pedido' },
];

const METRICAS_DO_USO = {
  leituras: 'firestore.googleapis.com/document/read_ops_count',
  gravacoes: 'firestore.googleapis.com/document/write_ops_count',
  exclusoes: 'firestore.googleapis.com/document/delete_ops_count',
};
const ARMAZENAMENTO = 'firestore.googleapis.com/storage/data_and_index_storage_bytes';
const HOSPEDAGEM = {
  bytes: 'firebasehosting.googleapis.com/storage/total_bytes',
  limite: 'firebasehosting.googleapis.com/storage/limit',
  enviadoNoMes: 'firebasehosting.googleapis.com/network/monthly_sent',
  limiteDeEnvio: 'firebasehosting.googleapis.com/network/monthly_sent_limit',
};

// ---------- funções puras (o teste-saude-banco.js roda sem banco e sem Google) ----------

/** O dia da cota (AAAA-MM-DD na Califórnia) de um instante. */
function diaDaCota(instante) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

/**
 * A meia-noite (Califórnia) do dia de `instante`. O inicioDoDiaDaCota do uso-banco subtrai a hora do relógio, que erra
 * por 1 h no dia em que o relógio muda (horário de verão); aqui o resultado é conferido e acertado.
 */
function inicioDoDia(instante) {
  const dia = diaDaCota(instante);
  let t = inicioDoDiaDaCota(instante).getTime();
  if (diaDaCota(new Date(t)) !== dia) t += 36e5;
  else if (diaDaCota(new Date(t - 1)) === dia) t -= 36e5;
  return new Date(t);
}

/**
 * Os últimos `n` dias completos da cota, do mais novo ao mais antigo: { dia, desde, ate } (desde/ate em Date). O dia de
 * hoje fica de fora (está incompleto; o robo/uso mostra). Vale com horário de verão (o dia pode ter 23 ou 25 h).
 */
function diasCompletos(agora, n) {
  const dias = [];
  let ate = inicioDoDia(agora);
  for (let i = 0; i < n; i++) {
    const desde = inicioDoDia(new Date(ate.getTime() - 36e5));
    dias.push({ dia: diaDaCota(desde), desde, ate });
    ate = desde;
  }
  return dias;
}

/** O valor mais novo de cada série (GAUGE) — as séries vêm do mais novo para o mais antigo. */
function ultimosDaResposta(dados) {
  const valores = [];
  for (const serie of (dados && dados.timeSeries) || []) {
    const ponto = (serie.points || [])[0];
    if (!ponto) continue;
    const v = ponto.value || {};
    const rotulos = Object.assign({}, serie.resource && serie.resource.labels, serie.metric && serie.metric.labels);
    valores.push({ valor: Number(v.int64Value || v.doubleValue || 0), rotulos });
  }
  return valores;
}

/** O tamanho de 7 dias atrás de cada coleção, pelo histórico guardado ({ dia: { coleção: total } }). */
function haSeteDias(historico, hoje) {
  const alvo = new Date(Date.parse(hoje + 'T12:00:00Z') - 7 * UM_DIA_MS).toISOString().slice(0, 10);
  // o dia exato; se o robô não rodou nesse dia, o mais perto antes dele (até 2 dias)
  const dias = Object.keys(historico || {}).filter(d => d <= alvo).sort().reverse();
  const dia = dias.find(d => Date.parse(alvo) - Date.parse(d) <= 2 * UM_DIA_MS);
  return dia ? historico[dia] : null;
}

/** O histórico novo: os últimos DIAS_DO_HISTORICO dias, com o de hoje. */
function historicoNovo(historico, hoje, totais) {
  const h = Object.assign({}, historico || {}, { [hoje]: totais });
  const dias = Object.keys(h).sort().slice(-DIAS_DO_HISTORICO);
  return Object.fromEntries(dias.map(d => [d, h[d]]));
}

/** O uso por dia novo: o que já tinha + o que mediu agora, só os últimos DIAS_DE_USO, do mais antigo ao mais novo. */
function juntarUsoPorDia(antes, novos, hoje) {
  const por = new Map();
  for (const u of antes || []) if (u && u.dia && u.dia < hoje) por.set(u.dia, u);
  for (const u of novos || []) por.set(u.dia, u);
  return [...por.values()].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-DIAS_DE_USO);
}

/** A mensagem de erro do Google (ou do Firestore) numa linha curta. */
function mensagem(err) {
  const m = (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) || (err && err.message) || String(err);
  return String(m).replace(/\s+/g, ' ').slice(0, 200);
}

// ---------- o que fala com o banco e com o Google ----------

function criarSaudeDoBanco(db, log, opcoes = {}) {
  const auth = opcoes.auth || new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/monitoring.read'] });
  const ref = db.collection(DOC[0]).doc(DOC[1]);

  async function serie(cliente, projeto, metrica, desde, ate, somar) {
    const params = new URLSearchParams({
      filter: 'metric.type="' + metrica + '"',
      'interval.startTime': desde.toISOString(),
      'interval.endTime': ate.toISOString(),
    });
    if (somar) {
      params.set('aggregation.alignmentPeriod', Math.max(60, Math.ceil((ate - desde) / 1000)) + 's');
      params.set('aggregation.perSeriesAligner', 'ALIGN_SUM');
      params.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
    }
    const r = await cliente.request({ url: 'https://monitoring.googleapis.com/v3/projects/' + projeto + '/timeSeries?' + params });
    return r.data;
  }

  async function medirUsoPorDia(cliente, antes, agora, erros) {
    const ja = new Set((antes || []).map(u => u.dia));
    const faltam = diasCompletos(agora, DIAS_DE_USO).filter(d => !ja.has(d.dia));
    const novos = [];
    for (const d of faltam) {
      try {
        const u = { dia: d.dia };
        for (const [campo, metrica] of Object.entries(METRICAS_DO_USO)) u[campo] = somaDaResposta(await serie(cliente, PROJETO, metrica, d.desde, d.ate, true));
        novos.push(u);
      } catch (err) { erros.push('uso por dia: ' + mensagem(err)); break; }
    }
    return novos;
  }

  async function medirArmazenamento(cliente, agora) {
    try {
      const valores = ultimosDaResposta(await serie(cliente, PROJETO, ARMAZENAMENTO, new Date(agora.getTime() - 2 * 36e5), agora, false));
      if (!valores.length) return { bytes: null, erro: 'o Google ainda não tem a medição' };
      return { bytes: valores.reduce((s, v) => s + v.valor, 0), erro: '' };
    } catch (err) { return { bytes: null, erro: mensagem(err) }; }
  }

  async function medirHospedagem(cliente, projeto, agora) {
    const h = { projeto, bytes: null, limite: null, enviadoNoMes: null, limiteDeEnvio: null, sites: [], erro: '' };
    // as métricas da hospedagem saem a cada 8 h: a janela de 26 h sempre pega a última
    const desde = new Date(agora.getTime() - 26 * 36e5);
    try {
      for (const [campo, metrica] of Object.entries(HOSPEDAGEM)) {
        const valores = ultimosDaResposta(await serie(cliente, projeto, metrica, desde, agora, false));
        if (!valores.length) continue;
        if (campo === 'bytes') {
          h.bytes = valores.reduce((s, v) => s + v.valor, 0);
          h.sites = valores.map(v => ({ site: v.rotulos.site_name || v.rotulos.domain_name || v.rotulos.site || '?', bytes: v.valor })).sort((a, b) => b.bytes - a.bytes).slice(0, 40);
        } else if (campo === 'enviadoNoMes') h.enviadoNoMes = valores.reduce((s, v) => s + v.valor, 0);
        // o limite é do projeto: cada site repete o mesmo número
        else h[campo] = Math.max(...valores.map(v => v.valor));
      }
      if (h.bytes === null && h.limite === null) h.erro = 'o Google não devolveu a medição da hospedagem';
    } catch (err) { h.erro = mensagem(err); }
    return h;
  }

  async function contarColecoes(erros) {
    const totais = {};
    let leituras = 0;
    let colecoes = [];
    try { colecoes = await db.listCollections(); } catch (err) { erros.push('lista das coleções: ' + mensagem(err)); return { totais, leituras }; }
    for (const c of colecoes) {
      try {
        const n = (await c.count().get()).data().count;
        totais[c.id] = n;
        leituras += Math.max(1, Math.ceil(n / 1000));
      } catch (err) { erros.push('contar ' + c.id + ': ' + mensagem(err)); }
    }
    return { totais, leituras };
  }

  async function procurarOrfaos(totais) {
    const orfaos = [];
    let gastas = 0;
    let conferidos = 0;
    for (const o of ORFAOS) {
      const total = totais[o.colecao];
      if (total === undefined) continue; // a coleção nem existe (ou não deu para contar)
      if (total > MAX_POR_COLECAO || conferidos + total > MAX_ORFAOS_NO_TOTAL) {
        orfaos.push({ colecao: o.colecao, rotulo: o.rotulo, quantos: 0, exemplos: [], erro: 'grande demais para conferir hoje (' + total + ' documentos)' });
        continue;
      }
      try {
        // listDocuments traz também o documento "fantasma" (só com subcoleção); se o número bate com o count, não há órfão
        const refs = await db.collection(o.colecao).listDocuments();
        gastas += refs.length;
        conferidos += refs.length;
        let fantasmas = [];
        if (refs.length > total) {
          const existem = new Set((await db.collection(o.colecao).select().get()).docs.map(d => d.id));
          gastas += existem.size;
          fantasmas = refs.filter(r => !existem.has(r.id)).map(r => r.id);
        }
        orfaos.push({ colecao: o.colecao, rotulo: o.rotulo, quantos: fantasmas.length, exemplos: fantasmas.slice(0, 5).map(id => id.slice(0, 8)), erro: '' });
      } catch (err) { orfaos.push({ colecao: o.colecao, rotulo: o.rotulo, quantos: 0, exemplos: [], erro: mensagem(err) }); }
    }
    return { orfaos, gastas };
  }

  /** Faz o resumo e grava. Devolve o que gravou (sem o histórico). */
  async function resumir(agora = new Date()) {
    const comeco = Date.now();
    const erros = [];
    const antes = (await ref.get().catch(() => null));
    const anterior = antes && antes.exists ? antes.data() : {};
    const hoje = new Date(agora.getTime()).toLocaleDateString('en-CA');

    const { totais, leituras } = await contarColecoes(erros);
    const seteDias = haSeteDias(anterior.historico, hoje);
    const colecoes = Object.entries(totais).map(([nome, total]) => ({ nome, total, ha7dias: seteDias && Number.isFinite(seteDias[nome]) ? seteDias[nome] : null }))
      .sort((a, b) => b.total - a.total);
    const { orfaos, gastas } = await procurarOrfaos(totais);

    let usoPorDia = anterior.usoPorDia || [];
    let armazenamento = { bytes: null, erro: '' };
    let hospedagem = [];
    try {
      const cliente = await auth.getClient();
      usoPorDia = juntarUsoPorDia(anterior.usoPorDia, await medirUsoPorDia(cliente, anterior.usoPorDia, agora, erros), diaDaCota(agora));
      armazenamento = await medirArmazenamento(cliente, agora);
      for (const p of PROJETOS_DA_HOSPEDAGEM) hospedagem.push(await medirHospedagem(cliente, p, agora));
    } catch (err) {
      const m = mensagem(err);
      erros.push('Cloud Monitoring: ' + m);
      armazenamento = { bytes: null, erro: m };
      hospedagem = PROJETOS_DA_HOSPEDAGEM.map(projeto => ({ projeto, bytes: null, limite: null, enviadoNoMes: null, limiteDeEnvio: null, sites: [], erro: m }));
    }

    const resumo = {
      em: new Date().toISOString(), dia: hoje, versao: 1,
      leiturasGastas: leituras + gastas + 1, duracaoMs: Date.now() - comeco,
      colecoes, orfaos, usoPorDia, armazenamento, hospedagem, erros: erros.slice(0, 20),
    };
    await ref.set(Object.assign({}, resumo, { historico: historicoNovo(anterior.historico, hoje, totais) }));
    return resumo;
  }

  return { resumir };
}

function iniciarSaudeDoBanco(db, log) {
  const s = criarSaudeDoBanco(db, log);
  const ref = db.collection(DOC[0]).doc(DOC[1]);
  let rodando = false;
  async function talvez() {
    if (rodando) return;
    rodando = true;
    try {
      const d = await ref.get();
      const em = d.exists ? Date.parse(d.data().em || '') : NaN;
      if (Number.isFinite(em) && Date.now() - em < VALIDADE_MS) return;
      const r = await s.resumir();
      log('saúde do banco: resumo do dia feito (' + r.colecoes.length + ' coleções, ' + r.orfaos.reduce((t, o) => t + o.quantos, 0) + ' órfão(s), ~' + r.leiturasGastas + ' leituras' + (r.erros.length ? '; ' + r.erros.length + ' medição(ões) com erro' : '') + ')');
    } catch (err) {
      log('saúde do banco: o resumo do dia falhou -', mensagem(err));
    } finally { rodando = false; }
  }
  setTimeout(talvez, PRIMEIRA_ESPERA_MS);
  setInterval(talvez, CONFERE_A_CADA_MS);
  log('saúde do banco ligada (um resumo por dia em robo/saudeBanco)');
}

module.exports = { iniciarSaudeDoBanco, criarSaudeDoBanco, diaDaCota, inicioDoDia, diasCompletos, ultimosDaResposta, haSeteDias, historicoNovo, juntarUsoPorDia, ORFAOS };
