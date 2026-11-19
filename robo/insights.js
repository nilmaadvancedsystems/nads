'use strict';
// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu
// quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"). A cada 15 min monta os números do
// escritório e grava nadsInsights/atual (os números; os nomes da equipe; e, na visão de cada pessoa, as empresas dela e o
// título das tarefas atrasadas: só Diretor e admin leem). A tela ouve só esse documento. As contas são do core (tarefas/regras/insights.ts, pelo robo/gerado/danfse.js).
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
  // o tabelão do Fiscal do mês (controleTributos) e a equipe (usuarios, relida a cada hora) (19/11/2026; o dono: "dp e fiscal
  // sao tabelao nao rotina", "ta faltando felipe e gustavo aqui")
  const tabelaoFiscal = new Map();
  const equipe = { em: 0, time: [] };
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
    // o Relatório do Fiscal do mesmo mês (a leitura inicial e depois só o que muda)
    const i2 = parar.findIndex(x => x.fiscal);
    if (i2 >= 0) { parar[i2](); parar.splice(i2, 1); }
    tabelaoFiscal.clear();
    const f = ouvir('Insights: tabelão do Fiscal', () => db.collection('controleTributos').where('competencia', '==', comp), snap => {
      tabelaoFiscal.clear();
      for (const d of snap.docs) { const x = d.data() || {}; if (typeof x.codigo === 'number') tabelaoFiscal.set(x.codigo, x); }
    }, log);
    f.fiscal = true;
    parar.push(f);
  }
  // a equipe pelos usuários do nads (uma leitura por pessoa a cada hora: o documento muda a cada 3 min com o "visto no nads")
  async function timeDaEquipe(P) {
    if (Date.now() - equipe.em < 60 * 60 * 1000) return equipe.time;
    try {
      const snap = await db.collection('usuarios').get();
      equipe.time = snap.docs.map(d => d.data() || {}).map(u => ({ nome: String(u.nome || '').trim(), setor: P.setorDoUsuario(u) }))
        .filter(u => u.setor).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 40);
      equipe.em = Date.now();
    } catch (e) { log('Insights: a equipe não abriu -', e.message); }
    return equipe.time;
  }
  function desligarOuvintes() {
    for (const p of parar) { try { p(); } catch (e) { /* já parado */ } }
    parar = []; compDocs = ''; delegadas.clear(); documentosDoMes.clear(); tabelaoFiscal.clear();
  }

  const contar = async q => { try { return (await q.count().get()).data().count || 0; } catch (e) { log('Insights: uma contagem falhou -', e.message); return 0; } };

  async function montar() {
    const P = core();
    const hoje = agora();
    const compAnterior = mesAnterior(hoje);
    const compDp = P.competenciaDeTrabalhoDoDp(hoje);
    const execs = [...fontes.execucoes.values()];
    const doSetor = (dep, comp) => execs.filter(e => e.departamento === dep && e.competencia === comp);

    // 1. o Contábil pelas rotinas (a competência anterior), por responsável do Cadastro; o Fiscal pelo tabelão (o Relatório
    // do Fiscal: as empresas do Simples e do Presumido, concluída quando a entrega foi marcada), por responsável do Fiscal
    const fiscal = { setor: 'fiscal', competencia: compAnterior, pessoas: P.fiscalPorPessoa(
      P.empresasDoTabelaoFiscal(new Map([...fontes.cadastroPorCodigo].map(([c, cad]) => [Number(c), cad]))),
      codigo => { const l = tabelaoFiscal.get(codigo); return l ? P.situacaoDaLinha({ valores: l.valores || {}, marcas: l.marcas || {}, data: l.data || '', entregue: l.entregue || '' }) : 'branco'; },
    ) };
    const rotinas = [fiscal].concat(['contabil'].map(setor => {
      const lista = doSetor(setor, compAnterior);
      const codigos = new Set(lista.map(e => Number(e.codigo)).filter(Boolean));
      for (const [codigo, cad] of fontes.cadastroPorCodigo) if (cad && cad.responsaveis && cad.responsaveis[setor]) codigos.add(codigo);
      // o nome vai junto: a visão da pessoa mostra as empresas dela (18/11/2026: "abra uma visao do que a pessoa ta fazendo")
      const empresas = [...codigos].map(codigo => { const cad = fontes.cadastroPorCodigo.get(codigo) || {}; return { codigo, responsavel: String((cad.responsaveis || {})[setor] || ''), nome: String(cad.nome || '') }; });
      return { setor, competencia: compAnterior, pessoas: P.rotinasPorPessoa(empresas, lista, codigo => P.rotinaDaEmpresa(setor, codigo)) };
    }));

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
    const equipeAtrasada = P.delegadasAtrasadas([...delegadas.values()], diaIso(hoje), hh);

    // 7. a equipe toda (os usuários do nads com o setor): a tela conta cada um pelo tabelão do setor dele
    const time = await timeDaEquipe(P);

    return { rotinas, dp, guias, clientes, entregas, equipe: equipeAtrasada, time };
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
