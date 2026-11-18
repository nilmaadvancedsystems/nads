'use strict';
// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"). A cada 15 min monta os números do
// escritório e grava nadsInsights/atual (só números e nomes da equipe; nenhum nome de cliente). A tela e a TV ouvem só
// esse documento. As contas são do core (tarefas/regras/insights.ts, pelo robo/gerado/danfse.js).
//
// Vem DESLIGADO: liga em Robôs › Ajustes › "Tela de Insights" (config/insights.ligado). Desligado, não lê nada além do
// próprio ajuste (um ouvinte).
//
// As leituras (o cuidado principal; memória "Leituras do banco 17/11"):
//   - reaproveita o que o robô da Área do Cliente já ouve (rotinas, cadastro, chamados, tickets): zero leitura a mais;
//   - dois ouvintes só quando ligado: as tarefas delegadas em aberto e o documentosMensal do mês (a leitura inicial e
//     depois só o que muda);
//   - as contagens (guias enviadas e abertas, entregas) com count(): cerca de uma leitura por contagem, 7 por volta,
//     ~700 por dia;
//   - grava só quando algum número muda (no máximo 96 por dia).

const A_CADA_MS = 15 * 60 * 1000;
const STATUS_EM_ABERTO = ['pendente', 'andamento', 'pausada'];
const diaIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mesAnterior = d => { const x = new Date(d.getFullYear(), d.getMonth() - 1, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };

/**
 * deps: { db, log, ouvir, core: () => o pacote gerado, fontes: { execucoes, cadastroPorCodigo, chamados, ticketsAbertos,
 *   guiasPagas: (comp) => número, clientesAtivos: () => Promise<[{ id, documentosNaoAplicaveis }]> } }
 */
function iniciarInsights({ db, log, ouvir, core, fontes, agora = () => new Date() }) {
  let ligado = false;
  let parar = [];
  const delegadas = new Map();
  const documentosDoMes = new Map();
  let compDocs = '';
  let ultimo = '';
  let rodando = false;

  function ligarOuvintes() {
    if (parar.length) return;
    parar.push(ouvir('Insights: tarefas delegadas', () => db.collection('nadsTarefasDelegadas').where('status', 'in', STATUS_EM_ABERTO), snap => {
      delegadas.clear();
      for (const d of snap.docs) delegadas.set(d.id, d.data());
    }, log));
    ouvirDocumentos();
  }
  function ouvirDocumentos() {
    const comp = mesAnterior(agora());
    if (comp === compDocs) return;
    compDocs = comp;
    const i = parar.findIndex(p => p.documentos);
    if (i >= 0) { parar[i](); parar.splice(i, 1); }
    documentosDoMes.clear();
    const p = ouvir('Insights: documentos do mês', () => db.collection('documentosMensal').where('competencia', '==', comp), snap => {
      documentosDoMes.clear();
      for (const d of snap.docs) documentosDoMes.set(String(d.get('clienteId') || ''), d.data());
    }, log);
    p.documentos = true;
    parar.push(p);
  }
  function desligarOuvintes() {
    for (const p of parar) { try { p(); } catch (e) { /* já parado */ } }
    parar = []; compDocs = ''; delegadas.clear(); documentosDoMes.clear();
  }

  const contar = async q => { try { return (await q.count().get()).data().count || 0; } catch (e) { log('Insights: uma contagem falhou -', e.message); return 0; } };

  async function montar() {
    const P = core();
    const hoje = agora();
    const compAnterior = mesAnterior(hoje);
    const compDp = P.competenciaDeTrabalhoDoDp(hoje);
    const execs = [...fontes.execucoes.values()];
    const doSetor = (dep, comp) => execs.filter(e => e.departamento === dep && e.competencia === comp);

    // 1. as rotinas do Fiscal e do Contábil (a competência anterior), por responsável do Cadastro
    const rotinas = ['fiscal', 'contabil'].map(setor => {
      const lista = doSetor(setor, compAnterior);
      const codigos = new Set(lista.map(e => Number(e.codigo)).filter(Boolean));
      for (const [codigo, cad] of fontes.cadastroPorCodigo) if (cad && cad.responsaveis && cad.responsaveis[setor]) codigos.add(codigo);
      const empresas = [...codigos].map(codigo => ({ codigo, responsavel: String(((fontes.cadastroPorCodigo.get(codigo) || {}).responsaveis || {})[setor] || '') }));
      return { setor, competencia: compAnterior, pessoas: P.rotinasPorPessoa(empresas, lista, codigo => P.rotinaDaEmpresa(setor, codigo)) };
    });

    // 2. a tabela do DP (a competência de trabalho), a mesma conta do Painel do DP
    const doDp = new Map(doSetor('dp', compDp).map(e => [Number(e.codigo), e]));
    const situacoes = P.CLIENTES_DO_DP.map(base => {
      const c = P.clienteDoDpNoCadastro(base, fontes.cadastroPorCodigo.get(base.codigo) || null, compDp);
      return P.situacaoDoClienteDp(c, doDp.get(base.codigo) || null, compDp, hoje);
    });
    const dp = Object.assign({ competencia: compDp }, P.contarDp(situacoes));

    // 3. as guias da competência anterior: enviadas (os envios do Fiscal e do DP), abertas pelo cliente e pagas pelo extrato
    const enviadas = (await contar(db.collection('solicitacoesEmail').where('tipo', '==', 'envioFiscal').where('competencia', '==', compAnterior).where('status', '==', 'enviado')))
      + (await contar(db.collection('solicitacoesEmail').where('tipo', '==', 'envioDp').where('competencia', '==', compAnterior).where('status', '==', 'enviado')));
    const abertas = await contar(db.collection('areaClienteLeituras').where('competencia', '==', compAnterior));
    const guias = { competencia: compAnterior, enviadas, abertas, pagas: fontes.guiasPagas(compAnterior) };

    // 4. os clientes: as solicitações (as 400 mais recentes, o que o robô já ouve), a nota do mês, quem deve documento e o Mandei
    const ch = P.contarChamados([...fontes.chamados.values()], diaIso(hoje).slice(0, 7));
    let documentosFaltando = 0;
    try {
      for (const c of await fontes.clientesAtivos()) {
        const dado = documentosDoMes.get(String(c.id));
        if (!dado || dado.semMovimento) continue;
        const na = Array.isArray(c.documentosNaoAplicaveis) ? c.documentosNaoAplicaveis : [];
        if (['extrato', 'comprovante', 'aplicacao'].some(t => !na.includes(t) && !dado[t])) documentosFaltando++;
      }
    } catch (e) { log('Insights: os clientes não abriram -', e.message); }
    const mandeiAbertos = [...fontes.ticketsAbertos.values()].filter(t => P.situacaoDoTicket(t, hoje) !== 'resolvido').length;
    const clientes = Object.assign({}, ch, { documentosFaltando, mandeiAbertos });

    // 5. as entregas físicas: as em aberto de qualquer mês e as entregues do mês anterior
    const entregas = {
      aEntregar: await contar(db.collection('entregas').where('status', '==', 'pendente')),
      noLink: await contar(db.collection('entregas').where('status', '==', 'link')),
      confirmadas: await contar(db.collection('entregas').where('status', '==', 'confirmada').where('competencia', '==', compAnterior)),
      falhas: await contar(db.collection('entregas').where('status', '==', 'falha')),
    };

    // 6. as tarefas delegadas atrasadas, por responsável
    const hh = String(hoje.getHours()).padStart(2, '0') + ':' + String(hoje.getMinutes()).padStart(2, '0');
    const equipe = P.delegadasAtrasadas([...delegadas.values()], diaIso(hoje), hh);

    return { rotinas, dp, guias, clientes, entregas, equipe };
  }

  async function talvez() {
    if (!ligado || rodando) return;
    rodando = true;
    try {
      ouvirDocumentos();
      const numeros = await montar();
      const chave = JSON.stringify(numeros);
      if (chave === ultimo) return;
      await db.collection('nadsInsights').doc('atual').set(Object.assign({ atualizadoEm: agora().toISOString() }, numeros));
      ultimo = chave;
    } catch (e) { log('Insights: a volta falhou -', e.message); } finally { rodando = false; }
  }

  const pararAjuste = ouvir('Insights: ajuste', () => db.collection('config').doc('insights'), snap => {
    const agoraLigado = !!(snap && snap.exists && snap.get('ligado') === true);
    if (agoraLigado === ligado) return;
    ligado = agoraLigado;
    log('Insights: ' + (ligado ? 'ligado' : 'desligado'));
    if (ligado) { ligarOuvintes(); ultimo = ''; setTimeout(talvez, 30 * 1000); } else desligarOuvintes();
  }, log);
  const relogio = setInterval(talvez, A_CADA_MS);
  return { talvez, montar, parar: () => { clearInterval(relogio); desligarOuvintes(); if (typeof pararAjuste === 'function') pararAjuste(); } };
}

module.exports = { iniciarInsights, A_CADA_MS };
