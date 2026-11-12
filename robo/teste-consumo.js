// O freio de consumo do banco (consumo.js, 07/11/2026). Sem Firestore: o contador é puro e o SDK é imitado por classes
// com os mesmos nomes de método (_get, getAll, _commit, onSnapshot). No fim, as correções do mesmo dia (mapa do Drive, clientes
// ativos em memória, a volta dos satélites). node teste-consumo.js
const C = require('./consumo');
let ok = 0, falha = 0;
const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const MIN = 60000;
const dormir = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---------- o contador ----------
  let t = 1000 * MIN;
  let disparos = [];
  const c = C.criarContador({ agora: () => t, aoDisparar: ev => disparos.push(ev) });
  c.contar('mapa-do-drive', 15000, 0);
  c.contar('sieg', 4000, 100);
  igual('abaixo do teto não dispara', disparos.length, 0);
  t += 3 * MIN;
  c.contar('mapa-do-drive', 1500, 0);   // 20.500 no processo
  igual('passou de 20 mil leituras em 10 min: dispara uma vez', disparos.length, 1);
  igual('a culpada é a que mais leu', disparos[0].tarefa, 'mapa-do-drive');
  igual('pausada por 15 min', [disparos[0].pausada, disparos[0].ate - t], [true, 15 * MIN]);
  igual('o primeiro aviso sai', disparos[0].avisar, true);
  igual('o total da janela vai no aviso', disparos[0].total, { leituras: 20500, gravacoes: 100 });
  igual('a pausada está pausada', c.pausadaAte('mapa-do-drive') > 0, true);
  igual('a outra não', c.pausadaAte('sieg'), 0);
  c.contar('sieg', 1, 0);
  igual('depois do disparo, a culpada sai da conta (não dispara de novo)', disparos.length, 1);
  t += 15 * MIN + 1;
  igual('15 min depois volta', c.pausadaAte('mapa-do-drive'), 0);

  // a janela anda: o que tem mais de 10 min sai
  t = 5000 * MIN; disparos = [];
  const j = C.criarContador({ agora: () => t, aoDisparar: ev => disparos.push(ev) });
  for (let i = 0; i < 30; i++) { j.contar('area-cliente', 1500, 0); t += MIN; }   // 1.500 por minuto: 15 mil por janela
  igual('ritmo constante abaixo do teto nunca dispara', disparos.length, 0);
  igual('porMinuto mostra só a janela', j.porMinuto().length <= 10, true);

  // gravações: 5 mil em 10 min
  t = 9000 * MIN; disparos = [];
  const g = C.criarContador({ agora: () => t, aoDisparar: ev => disparos.push(ev) });
  for (let i = 0; i < 6; i++) { g.contar('central', 0, 900); t += MIN; }
  igual('5.400 gravações em 6 min disparam', [disparos.length, disparos[0] && disparos[0].tarefa], [1, 'central']);

  // 'geral' (o processo principal, fora de uma tarefa) só avisa; e o aviso sai no máximo 1 por hora
  t = 20000 * MIN; disparos = [];
  const h = C.criarContador({ agora: () => t, aoDisparar: ev => disparos.push(ev) });
  h.contar(C.GERAL, 21000, 0);
  igual('geral não é pausada', [disparos[0].pausada, h.pausadaAte(C.GERAL)], [false, 0]);
  t += 20 * MIN; h.contar('lote-dp', 0, 6000);
  igual('outro disparo em menos de 1 h não avisa de novo', [disparos.length, disparos[1].avisar, disparos[1].pausada], [2, false, true]);
  t += 61 * MIN; h.contar('lote-dp', 0, 6000);
  igual('passada 1 h avisa de novo', disparos[2].avisar, true);

  // teto próprio (o backup lê o banco inteiro de propósito): sai da soma do processo e só dispara no teto dele
  t = 30000 * MIN; disparos = [];
  const b = C.criarContador({ agora: () => t, aoDisparar: ev => disparos.push(ev) });
  b.definirTeto('backup', { tetoLeituras: 400000 });
  b.contar('backup', 150000, 0);
  b.contar('sieg', 100, 0);
  igual('o backup grande não dispara nem pausa os outros', disparos.length, 0);
  b.contar('backup', 260000, 0);
  igual('mas passa do teto dele', [disparos.length, disparos[0].tarefa], [1, 'backup']);

  // resumo da hora
  const r = b.resumoDaHora();
  igual('resumo da hora do maior para o menor', r.map(x => x.tarefa), ['backup', 'sieg']);
  igual('resumo zera', b.resumoDaHora().length, 0);

  // o texto do aviso
  const txt = C.textoDoAviso({ tarefa: 'mapa-do-drive', leituras: 20500, gravacoes: 10, pausada: true, ate: Date.UTC(2026, 10, 7, 15, 30) }, 'vigia-robo', 'robo-nilma');
  igual('título do aviso', txt.titulo, 'Robô gastando demais o banco: mapa-do-drive');
  igual('corpo diz quanto e até quando', [/20\.500 leituras/.test(txt.corpo), /pausada até/.test(txt.corpo), /vigia-robo \(robo-nilma\)/.test(txt.corpo)], [true, true, true]);
  igual('sem pausa diz que nada foi pausado', /Nada foi pausado/.test(C.textoDoAviso({ tarefa: 'geral', leituras: 1, gravacoes: 1, pausada: false }, 'x').corpo), true);

  // quantas leituras um resultado custou
  igual('consulta conta os documentos', C.leiturasDe({ result: { size: 37 } }), 37);
  igual('consulta vazia conta 1', C.leiturasDe({ size: 0 }), 1);
  igual('contagem: 1 a cada mil', C.leiturasDe({ result: { data: () => ({ count: 2600000 }) } }), 2600);

  // ---------- o SDK imitado ----------
  class Query {
    constructor(n) { this.n = n; }
    async _get() { return { result: { size: this.n, docs: [] } }; }
    async get() { return (await this._get()).result; }
    onSnapshot(aoChegar, aoErro) { this.ultimo = { aoChegar, aoErro }; return () => { this.parou = true; }; }
  }
  class DocumentReference {
    get() { return db.getAll(this).then(([x]) => x); }
    set() { const l = new WriteBatch(); l._ops.push(1); return l.commit(); }
    onSnapshot(aoChegar) { aoChegar({ exists: true }); return () => {}; }
  }
  class Firestore { async getAll(...refs) { return refs.map(() => ({ exists: true })); } }
  class WriteBatch {
    constructor() { this._ops = []; }
    set() { this._ops.push(1); return this; }
    async _commit() { return this._ops.map(() => ({})); }
    commit() { return this._commit(); }
  }
  const db = new Firestore();
  let agora = 50000 * MIN;
  const avisos = [], linhas = [];
  C._reiniciar();
  const st = C.instalar(db, {
    classes: { Query, DocumentReference, Firestore, WriteBatch }, semRelogio: true, agora: () => agora, esperaDoErroMs: 5,
    log: (...m) => linhas.push(m.join(' ')), avisar: (titulo) => { avisos.push(titulo); return Promise.resolve(1); }, processo: 'teste',
  });
  igual('embrulhou os pontos do SDK', st.embrulhados.sort(), ['DocumentReference.onSnapshot', 'Query.onSnapshot', 'WriteBatch._commit', '_get', 'getAll'].sort());
  igual('instalar de novo devolve o mesmo', C.instalar(db, {}) === st, true);
  const porTarefa = () => { const p = {}; for (const m of st.contador.porMinuto(agora)) for (const [k, v] of Object.entries(m.porTarefa)) { p[k] = p[k] || { leituras: 0, gravacoes: 0 }; p[k].leituras += v.leituras; p[k].gravacoes += v.gravacoes; } return p; };

  await new Query(120).get();
  await new DocumentReference().get();
  await new DocumentReference().set({});
  igual('fora de tarefa conta para geral', porTarefa().geral, { leituras: 121, gravacoes: 1 });

  // a tarefa passa pelos relógios e pelas promessas que ela criou
  await C.tarefa('mapa-do-drive', () => new Promise(resolve => setTimeout(async () => { await new Query(300).get(); await new WriteBatch().set().set()._commit(); resolve(); }, 1)));
  igual('o relógio da tarefa conta para ela', porTarefa()['mapa-do-drive'], { leituras: 300, gravacoes: 2 });

  // o ouvinte: a 1ª resposta conta tudo, as outras só o que mudou; a resposta roda na tarefa de quem ouviu
  const q = new Query(0);
  let tarefaNaResposta = '';
  C.tarefa('area-cliente', () => q.onSnapshot(() => { tarefaNaResposta = C.tarefaAtual(); }));
  q.ultimo.aoChegar({ size: 50, docChanges: () => new Array(50) });
  q.ultimo.aoChegar({ size: 51, docChanges: () => new Array(1) });
  igual('ouvinte: 50 + 1', porTarefa()['area-cliente'], { leituras: 51, gravacoes: 0 });
  igual('a resposta do ouvinte roda na tarefa dele', tarefaNaResposta, 'area-cliente');

  // passou do teto: pausa a tarefa, avisa uma vez, e a tarefa pausada recebe erro (as outras seguem)
  await C.tarefa('sieg', () => new Query(20000).get());
  await dormir(5);
  igual('disparou e avisou uma vez', [avisos.length, avisos[0]], [1, 'Robô gastando demais o banco: sieg']);
  igual('o log diz o freio', linhas.some(l => /FREIO DE CONSUMO/.test(l)), true);
  let erro = null;
  await C.tarefa('sieg', () => new Query(1).get()).catch(e => { erro = e; });
  igual('a leitura da pausada falha com o erro do freio', erro && erro.code, 'consumo-pausada');
  erro = null;
  await C.tarefa('sieg', () => new DocumentReference().set({})).catch(e => { erro = e; });
  igual('a gravação da pausada também', erro && erro.code, 'consumo-pausada');
  let erroDoOuvinte = null;
  C.tarefa('sieg', () => new Query(1).onSnapshot(() => {}, e => { erroDoOuvinte = e; }));
  await dormir(20);
  igual('o ouvinte novo da pausada recebe o erro (o ouvinte.js tenta depois)', erroDoOuvinte && erroDoOuvinte.code, 'consumo-pausada');
  igual('as outras tarefas seguem', (await C.tarefa('area-cliente', () => new Query(3).get())).size, 3);
  agora += 16 * MIN;
  igual('16 min depois a pausada volta', (await C.tarefa('sieg', () => new Query(2).get())).size, 2);

  // o satélite: a tarefa padrão do processo é o módulo dele (pausável)
  C._reiniciar();
  const st2 = C.instalar(db, { classes: { Query, DocumentReference, Firestore, WriteBatch }, semRelogio: true, agora: () => agora, tarefa: 'alterdata', esperaDoErroMs: 5, log: () => {}, avisar: () => Promise.resolve(0) });
  await new Query(7).get();
  igual('no satélite, fora de tarefa conta para o módulo', st2.contador.porMinuto(agora).reduce((s, m) => s + ((m.porTarefa.alterdata || {}).leituras || 0), 0), 7);

  // ---------- as correções de 07/11/2026 ----------
  // o mapa do Drive: a lista dos clientes em memória; o cliente da pasta que mudou vem do banco (1 leitura), o código novo
  // é procurado uma vez
  const di = require('./drive-indice');
  const clientesNoBanco = { a1: { codigoOrigem: '58', nome: 'TORNEARIA', ativo: true, bancos: ['ITAU'] }, b2: { codigoOrigem: 77, nome: 'NOVA', ativo: true } };
  let leiturasDoMapa = 0;
  const dbMapa = { collection: () => ({
    doc: id => ({ get: async () => { leiturasDoMapa++; const x = clientesNoBanco[id]; return { exists: !!x, id, data: () => x }; } }),
    where: (campo, op, valores) => ({ limit: () => ({ get: async () => { leiturasDoMapa++; return { docs: Object.entries(clientesNoBanco).filter(([, x]) => valores.includes(x.codigoOrigem)).map(([id, x]) => ({ id, data: () => x })) }; } }) }),
  }) };
  const lista = di.guardarClientesDoMapa(new Map([['58', { id: 'a1', codigoOrigem: '58', nome: 'TORNEARIA', bancos: [] }]]));
  clientesNoBanco.a1.bancos = ['ITAU', 'BB'];   // mudou depois da lista
  const c58 = await di.clienteDaPasta(dbMapa, '58', lista);
  igual('o cliente da pasta vem do banco, com o dado de agora', [c58.id, c58.bancos, leiturasDoMapa], ['a1', ['ITAU', 'BB'], 1]);
  const c77 = await di.clienteDaPasta(dbMapa, '77', lista);
  igual('código fora da lista: procurado no banco (o cliente novo entra)', [c77 && c77.id, leiturasDoMapa], ['b2', 2]);
  await di.clienteDaPasta(dbMapa, '999', lista); await di.clienteDaPasta(dbMapa, '999', lista);
  igual('código sem cliente: procurado uma vez só', leiturasDoMapa, 3);
  clientesNoBanco.a1.ativo = false;
  igual('cliente que ficou inativo sai', await di.clienteDaPasta(dbMapa, '58', lista), null);
  igual('a lista lida agora (madrugada) não relê nada', [(await di.clienteDaPasta(dbMapa, '58', new Map([['58', { id: 'a1' }]]))).id, leiturasDoMapa], ['a1', 4]);

  // o marcador de mudanças do Drive fora da raiz (10/11/2026): a raiz, que as telas escutam, não é regravada só porque o
  // Drive andou; o marcador fica na memória e vai para o banco no máximo a cada 10 min
  {
    const docs = { raiz: { pastaId: 'ano', pageToken: 'velho', clientes: [] } };
    const gravados = [];
    let lidos = 0;
    const dbM = { collection: () => ({ doc: id => ({
      get: async () => { lidos++; const x = docs[id]; return { exists: !!x, data: () => x }; },
      set: async d => { gravados.push(id); docs[id] = d; },
    }) }) };
    const est = {};
    igual('sem o documento do marcador, vale o antigo da raiz', [await di.lerMarcador(dbM, est), est.pastaId], ['velho', 'ano']);
    await di.lerMarcador(dbM, est);
    igual('depois, da memória (sem ler o banco a cada minuto)', lidos, 2);
    await di.gravarMarcador(dbM, est, 't1', true);
    await di.gravarMarcador(dbM, est, 't2', false);
    await di.gravarMarcador(dbM, est, 't3', false);
    igual('o marcador vai para o documento dele, e não toda hora', [gravados, docs.marcador.pageToken, est.token], [['marcador'], 't1', 't3']);
    igual('a raiz não foi regravada', docs.raiz.pageToken, 'velho');
    igual('ao religar, o marcador do documento vale mais que o da raiz', await di.lerMarcador(dbM, {}), 't1');
    igual('a raiz sem a lista de anos: o robô grava a lista uma vez', est.semAnos, true);
    docs.raiz.anos = [];
    const est2 = {};
    await di.lerMarcador(dbM, est2);
    igual('a raiz com a lista (mesmo vazia): não grava de novo', est2.semAnos, false);
  }

  // o seletor de ano do Drive (12/11/2026): um ano anterior é mapeado só a pedido, só o mapa (nada de Pendências,
  // cadastro, contas, fila ou DP), e o custo é por pasta de cliente: 1 leitura e 2 gravações, mais a raiz do ano
  {
    const arvore = {
      A25: [{ id: 'c1', name: '58 - TORNEARIA', mimeType: 'application/vnd.google-apps.folder' }, { id: 'c2', name: '77 - NOVA', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'solto', name: 'leia-me.pdf', mimeType: 'application/pdf', size: '5' }],
      c1: [{ id: 's1', name: 'CONTÁBIL', mimeType: 'application/vnd.google-apps.folder' }, { id: 'f1', name: 'balanco-2025.pdf', mimeType: 'application/pdf', size: '100' }],
      s1: [{ id: 'f2', name: 'extrato.pdf', mimeType: 'application/pdf', size: '50' }],
      c2: [{ id: 'f3', name: 'nota.xml', mimeType: 'text/xml', size: '7' }],
    };
    di.usarDriveDeTeste({ files: { list: async ({ q }) => {
      const pais = [...q.matchAll(/'([^']+)' in parents/g)].map(m => m[1]);
      return { data: { files: [].concat(...pais.map(p => (arvore[p] || []).map(f => Object.assign({ parents: [p] }, f)))) } };
    } } });
    const docs = { raiz: { pastaId: 'A26', pastaNome: '2026', clientes: [{ id: 'k26', nomePasta: '58 - TORNEARIA' }], anos: [{ nome: '2025', id: 'A25' }] } };
    const leu = [], gravou = [];
    const ref = caminho => ({
      get: async () => { leu.push(caminho); const x = docs[caminho]; return { exists: !!x, data: () => x }; },
      set: async (d, op) => { gravou.push(caminho); docs[caminho] = op && op.merge ? Object.assign({}, docs[caminho], d) : d; },
      delete: async () => { gravou.push(caminho + ' (apagado)'); delete docs[caminho]; },
      collection: sub => ({ doc: id => ref(caminho + '/' + sub + '/' + id) }),
    });
    const dbA = { collection: nome => ({ doc: id => ref(nome === 'driveIndice' ? id : nome + '/' + id) }) };
    const r = await di.atenderPedidoDoMapa(dbA, () => {}, { dono: new Map() }, { pastaId: 'A25', criadoPor: 'teste' });
    igual('ano anterior: as pastas de cliente e os arquivos dentro delas', r, { pastas: 2, arquivos: 3 });
    igual('ano anterior: 1 leitura da raiz + 1 por pasta de cliente', leu.length, 3);
    igual('ano anterior: 2 gravações por pasta de cliente + a raiz do ano, e só no índice', gravou.sort(), ['c1', 'c1/partes/0', 'c2', 'c2/partes/0', 'raiz-2025']);
    igual('a raiz do ano anterior no formato da raiz', [docs['raiz-2025'].pastaId, docs['raiz-2025'].pastaNome, docs['raiz-2025'].clientes.map(c => c.codigo)], ['A25', '2025', ['58', '77']]);
    igual('a raiz do ano corrente não muda', docs.raiz.clientes.length, 1);
    leu.length = 0; gravou.length = 0;
    const r2 = await di.atenderPedidoDoMapa(dbA, () => {}, { dono: new Map() }, { pastaId: 'c2', criadoPor: 'teste' });
    igual('o ⟳ numa pasta de cliente de um ano anterior relê só ela', [r2, gravou.sort()], [{ pastas: 1, arquivos: 1 }, ['c2', 'c2/partes/0', 'raiz-2025']]);
    let erro = '';
    await di.atenderPedidoDoMapa(dbA, () => {}, { dono: new Map() }, { pastaId: 'nenhuma' }).catch(e => { erro = e.message; });
    igual('pasta fora do mapa: recusa', erro, 'essa pasta de cliente não está no mapa');
    di.usarDriveDeTeste(null);
  }

  // o cadastro do arquivador por ouvinte (10/11/2026): lido uma vez, depois só o que muda; o cache com os mesmos campos
  {
    const CAD = require('./arquivador-cadastro');
    const os = require('os'), path = require('path');
    const arq = path.join(os.tmpdir(), 'nads-teste-cadastro-' + process.pid + '.json');
    const ouvintes = {};
    const docs = { clientes: [{ codigoOrigem: '58', nome: 'TORNEARIA', ativo: true, segredo: 'x' }], cadastro: [{ codigo: 58, nome: 'TORNEARIA', regime: 'simples' }] };
    const foto = nome => ({ docs: docs[nome].map(d => ({ data: () => d })) });
    const dbC = { collection: nome => ({ onSnapshot: (cb) => { ouvintes[nome] = cb; setTimeout(() => cb(foto(nome)), 0); return () => {}; } }) };
    const dados = await CAD.ouvir(dbC, arq, () => {});
    igual('cadastro por ouvinte: os campos de antes, nada a mais', [dados.entregas, dados.nads], [[{ codigoOrigem: '58', nome: 'TORNEARIA', ativo: true }], [{ codigo: 58, nome: 'TORNEARIA', regime: 'simples' }]]);
    igual('a segunda chamada não liga outro ouvinte', (await CAD.ouvir(dbC, arq)) === dados, true);
    docs.cadastro = [{ codigo: 58, nome: 'TORNEARIA', regime: 'presumido' }];
    ouvintes.cadastro(foto('cadastro'));
    igual('a mudança chega ao cache sem ler de novo', CAD.lerCache(arq).nads[0].regime, 'presumido');
    try { fs.unlinkSync(arq); } catch (e) { /* segue */ }
  }

  // o mapa do Drive lembra o que já gravou em documentosMensal (12/11/2026): a pasta que muda sem arquivo novo não lê nada
  {
    let leituras = 0, gravacoes = 0; const docs = {};
    const dbM = { collection: () => ({ doc: id => ({
      get: async () => { leituras++; return { exists: !!docs[id], data: () => docs[id] }; },
      set: async p => { gravacoes++; docs[id] = Object.assign({}, docs[id], p, { pasta: Object.assign({}, (docs[id] || {}).pasta, p.pasta) }); },
    }) }) };
    const hoje = new Date(); const comp = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    const achados = new Map([[comp + '|extrato', [{ id: 'a1', nome: 'x.pdf' }]], [comp + '|comprovante', [{ id: 'b1', nome: 'y.pdf' }]]]);
    const cli = { id: 'c1', nome: 'C' };
    await di.marcarPeloIndice(dbM, cli, achados, () => {}, false);
    igual('documentosMensal: um por mês, não um por tipo', [leituras, gravacoes], [1, 2]);
    await di.marcarPeloIndice(dbM, cli, achados, () => {}, false);
    igual('a pasta mudou sem arquivo novo: não lê nem grava', [leituras, gravacoes], [1, 2]);
    achados.get(comp + '|extrato').push({ id: 'a2', nome: 'z.pdf' });
    await di.marcarPeloIndice(dbM, cli, achados, () => {}, false);
    igual('arquivo novo: lê o mês e grava', [leituras, gravacoes, docs['c1_' + comp].pasta.extrato], [2, 3, ['a1', 'a2']]);
  }

  // os clientes ativos sem o arquivo do vigia: a leitura vale 10 min no processo
  const cache = require('./clientes-cache');
  if (!cache.lerDoArquivo()) {
    let lidas = 0;
    const dbC = { collection: () => ({ where: () => ({ get: async () => { lidas++; return { size: 1, forEach: () => {} }; } }) }) };
    await cache.clientesAtivos(dbC); await cache.clientesAtivos(dbC); await cache.clientesAtivos(dbC);
    igual('clientes ativos: o banco uma vez só em 10 min', lidas, 1);
    await cache.clientesAtivos({ collection: () => ({ where: () => ({ get: async () => { lidas++; return {}; } }) }) });
    igual('outro banco (outro teste) não usa a memória do primeiro', lidas, 2);
  }

  // os satélites: a queda logo depois de ligar volta cada vez mais devagar
  const sat = require('./satelites');
  igual('satélite: 30 s, 1, 2, 4, 8, 10, 10 min', [0, 1, 2, 3, 4, 5, 9].map(n => sat.esperaDaVolta(n) / 1000), [30, 60, 120, 240, 480, 600, 600]);

  console.log(falha ? '\n' + falha + ' falha(s), ' + ok + ' ok' : 'consumo: ' + ok + ' ok');
  process.exit(falha ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(1); });
