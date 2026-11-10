// Testes da Central dos robôs do lado do robô (central.js): a lista fechada, o comando velho e o repetido, a resposta no
// próprio documento, o espelho do log (ritmo, tamanho, segredos) e o caminho inteiro num banco de mentira (nada vai para o
// Firestore de verdade).  node teste-central.js
'use strict';
const central = require('./central');
const catalogo = require('../packages/core/src/robos/catalogo.json');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const verdade = (nome, v) => igual(nome, !!v, true);

// ---------- a lista fechada ----------
igual('a lista do robô é a mesma do catálogo do site', [...central.ACOES].sort(), catalogo.acoes.map(a => a.id).sort());
igual('as ações da máquina são as do catálogo', [...central.ACOES_DA_MAQUINA].sort(), catalogo.acoes.filter(a => a.alvo === 'maquina').map(a => a.id).sort());
verdade('a lista não muda em tempo de execução', Object.isFrozen(central.ACOES));

const AGORA = Date.parse('2026-11-07T14:00:00.000Z');
const ctx = (extra = {}) => Object.assign({ maquina: 'escritorio', agora: AGORA, vistos: new Set(), recentes: new Map(), tarefas: new Set(Object.keys(central.TAREFAS)), pausaveis: new Set(['ia']) }, extra);
const cmd = (extra = {}) => Object.assign({ maquina: 'escritorio', robo: 'ia', acao: 'pausar', tarefa: '', por: 'uid-1', porNome: 'Vitor', em: new Date(AGORA - 10000).toISOString(), status: 'pendente' }, extra);

igual('conferir: pausar o atendente de IA no PC', central.conferirComando('c1', cmd(), ctx()), { fazer: true });
igual('conferir: ação fora da lista', central.conferirComando('c1', cmd({ acao: 'shell' }), ctx()).fazer, false);
verdade('conferir: ação fora da lista diz o motivo', /lista fechada/.test(central.conferirComando('c1', cmd({ acao: 'rm -rf /' }), ctx()).motivo));
verdade('conferir: comando de sistema no campo tarefa não passa', /Tarefa desconhecida/.test(central.conferirComando('c1', cmd({ maquina: 'servidor', robo: 'arquivador', acao: 'rodar-agora', tarefa: 'cmd /c del *' }), ctx({ maquina: 'servidor' })).motivo));
verdade('conferir: comando velho (mais de 5 min)', /velho/.test(central.conferirComando('c1', cmd({ em: new Date(AGORA - 5 * 60000 - 1).toISOString() }), ctx()).motivo));
igual('conferir: 4 min ainda vale', central.conferirComando('c1', cmd({ em: new Date(AGORA - 4 * 60000).toISOString() }), ctx()), { fazer: true });
verdade('conferir: data no futuro', /futuro/.test(central.conferirComando('c1', cmd({ em: new Date(AGORA + 5 * 60000).toISOString() }), ctx()).motivo));
verdade('conferir: sem data', /sem data/.test(central.conferirComando('c1', cmd({ em: 'ontem' }), ctx()).motivo));
verdade('conferir: sem quem pediu', /quem pediu/.test(central.conferirComando('c1', cmd({ por: '' }), ctx()).motivo));
igual('conferir: comando de outra máquina é ignorado (nem responde)', central.conferirComando('c1', cmd({ maquina: 'nuvem' }), ctx()), { fazer: false, ignorar: true });
igual('conferir: já respondido é ignorado', central.conferirComando('c1', cmd({ status: 'feito' }), ctx()), { fazer: false, ignorar: true });
igual('conferir: o mesmo id de novo é ignorado', central.conferirComando('c1', cmd(), ctx({ vistos: new Set(['c1']) })), { fazer: false, ignorar: true });
verdade('conferir: robô de outra máquina', /desconhecido/.test(central.conferirComando('c1', cmd({ robo: 'sieg' }), ctx()).motivo));
verdade('conferir: pausar um robô que não sabe pausar', /não sabe pausar/.test(central.conferirComando('c1', cmd({ robo: 'suporte' }), ctx()).motivo));
verdade('conferir: pausável no catálogo mas sem gancho nesta máquina', /não sabe pausar/.test(central.conferirComando('c1', cmd(), ctx({ pausaveis: new Set() })).motivo));
verdade('conferir: repetido no último minuto', /Repetido/.test(central.conferirComando('c2', cmd(), ctx({ recentes: new Map([['pausar|ia|', AGORA - 30000]]) })).motivo));
igual('conferir: o mesmo depois de 1 min passa', central.conferirComando('c2', cmd(), ctx({ recentes: new Map([['pausar|ia|', AGORA - 61000]]) })), { fazer: true });
igual('conferir: assistir não conta como repetido', central.conferirComando('c2', cmd({ acao: 'assistir' }), ctx({ recentes: new Map([['assistir|ia|', AGORA - 1000]]) })), { fazer: true });
igual('conferir: reiniciar é da máquina (sem robô)', central.conferirComando('c3', cmd({ acao: 'reiniciar', robo: '' }), ctx()), { fazer: true });
verdade('conferir: limpar a fila da NFS-e não (emissão fiscal)', /não se limpa/.test(central.conferirComando('c4', cmd({ maquina: 'nuvem', robo: 'nfse', acao: 'limpar-fila' }), ctx({ maquina: 'nuvem' })).motivo));
igual('conferir: rodar agora o Ler o Gmail na nuvem', central.conferirComando('c5', cmd({ maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail' }), ctx({ maquina: 'nuvem' })), { fazer: true });

// ---------- os controles: formato do que vem junto ----------
{
  const srv = (extra = {}) => ctx(Object.assign({ maquina: 'servidor', pausaveis: new Set(['fgts', 'sieg', 'alterdata']) }, extra));
  const no = (extra = {}) => cmd(Object.assign({ maquina: 'servidor', robo: 'fgts', acao: 'refazer', item: 'abcDEF123_-' }, extra));
  igual('item: id do Firestore passa', central.conferirComando('i1', no(), srv()), { fazer: true });
  for (const ruim of ['', '../robosComandos/x', 'a b', 'a;del', 'a/b', '$(calc)', 'x'.repeat(129)]) {
    verdade('item: recusa "' + ruim.slice(0, 20) + '"', /formato/.test(central.conferirComando('i2', no({ item: ruim }), srv()).motivo));
  }
  verdade('item: fila só de ver não cancela', /não deixa/.test(central.conferirComando('i3', no({ robo: 'arquivador', acao: 'cancelar-item' }), srv()).motivo));
  verdade('item: robô sem fila de itens', /não deixa/.test(central.conferirComando('i4', cmd({ maquina: 'nuvem', robo: 'nfse', acao: 'na-frente', item: 'abc' }), ctx({ maquina: 'nuvem' })).motivo));
  verdade('item: robô de outra máquina', /desconhecido/.test(central.conferirComando('i5', no({ robo: 'ia' }), srv()).motivo));
  const pede = (extra = {}) => no(Object.assign({ robo: 'sieg', acao: 'pedir-cliente', tarefa: 'xmls', cliente: '292', competencia: '2026-10', item: undefined }, extra));
  igual('cliente: pedido válido', central.conferirComando('p1', pede(), srv()), { fazer: true });
  verdade('cliente: pedido fora da lista', /desconhecido/.test(central.conferirComando('p2', pede({ tarefa: 'cmd /c del *' }), srv()).motivo));
  verdade('cliente: pedido do outro robô', /desconhecido/.test(central.conferirComando('p3', pede({ tarefa: 'guia' }), srv()).motivo));
  for (const ruim of ['', '1;del', '1 2', 'abc', '1234567890']) verdade('cliente: recusa "' + ruim + '"', /código do cliente/.test(central.conferirComando('p4', pede({ cliente: ruim }), srv()).motivo));
  for (const ruim of ['', '10/2026', '2026-13', '2026-00', '1999-10', '2026-1']) verdade('competência: recusa "' + ruim + '"', /competência/i.test(central.conferirComando('p5', pede({ competencia: ruim }), srv()).motivo));
  verdade('competência: mês que não começou', /não começou/.test(central.conferirComando('p6', pede({ competencia: '2026-12' }), srv()).motivo));
  igual('competência: o mês corrente vale', central.conferirComando('p7', pede({ competencia: '2026-11' }), srv()), { fazer: true });
  const para = (extra = {}) => no(Object.assign({ robo: '', acao: 'parar-tudo', item: undefined }, extra));
  igual('parar tudo: sem hora', central.conferirComando('t1', para(), srv()), { fazer: true });
  igual('parar tudo: com hora', central.conferirComando('t2', para({ ate: new Date(AGORA + 36e5).toISOString() }), srv()), { fazer: true });
  verdade('parar tudo: hora que já passou', /já passou/.test(central.conferirComando('t3', para({ ate: new Date(AGORA - 1000).toISOString() }), srv()).motivo));
  verdade('parar tudo: mais de 7 dias', /7 dias/.test(central.conferirComando('t4', para({ ate: new Date(AGORA + 8 * 864e5).toISOString() }), srv()).motivo));
  verdade('parar tudo: hora que não é data', /data válida/.test(central.conferirComando('t5', para({ ate: 'amanhã; shutdown' }), srv()).motivo));
  verdade('parar tudo: máquina sem pausável', /sabe pausar/.test(central.conferirComando('t6', para({ maquina: 'nuvem' }), ctx({ maquina: 'nuvem' })).motivo));
  verdade('pausar: hora que já passou', /já passou/.test(central.conferirComando('t7', cmd({ ate: new Date(AGORA - 1).toISOString() }), ctx()).motivo));
  // o repetido olha o item: dois pedidos diferentes da fila não se atrapalham
  const chave = central.chaveDoComando(no({ item: 'um' }));
  verdade('repetido: o mesmo item', /Repetido/.test(central.conferirComando('r1', no({ item: 'um' }), srv({ recentes: new Map([[chave, AGORA - 1000]]) })).motivo));
  igual('repetido: outro item passa', central.conferirComando('r2', no({ item: 'dois' }), srv({ recentes: new Map([[chave, AGORA - 1000]]) })), { fazer: true });
  igual('repetido: a chave antiga não mudou', central.chaveDoComando(cmd()), 'pausar|ia|');
  igual('pausas vencidas', central.pausasVencidas({ a: { ate: new Date(AGORA - 1).toISOString() }, b: { ate: new Date(AGORA + 1000).toISOString() }, c: { por: 'x' } }, AGORA), ['a']);
  for (const r of catalogo.robos.filter(x => x.itens)) {
    igual('catálogo: pedidos de ' + r.id + ' são os do robô', (r.pedidos || []).map(p => r.id + ':' + p.id).sort(), Object.keys(central.PEDIDOS_POR_CLIENTE).filter(k => k.startsWith(r.id + ':')).sort());
  }
  const { FILAS } = require('./painel');
  for (const r of catalogo.robos.filter(x => x.itens)) {
    const f = [...FILAS.pc, ...FILAS.vm].find(x => x.colecao === r.itens.colecao) || {};
    igual('catálogo: os status da fila de ' + r.id + ' são os do painel', [r.itens.esperando, r.itens.andamento], [f.esperando, f.andamento]);
  }
  const { ordenarNaFrente } = require('./fgts-claude');
  const d = (id, naFrenteEm) => ({ id, data: () => (naFrenteEm ? { naFrenteEm } : {}) });
  const f = [d('a'), d('b', '2026-11-10T10:00:00Z'), d('c'), d('e', '2026-11-10T11:00:00Z')];
  ordenarNaFrente(f);
  igual('fgts: na frente, o mais recente primeiro, os outros na mesma ordem', f.map(x => x.id), ['e', 'b', 'a', 'c']);
}

// ---------- segredos e linhas ----------
igual('segredo: token=', central.limparSegredos('pedido ok token=abc123def456 fim'), 'pedido ok token=*** fim');
igual('segredo: senha:', central.limparSegredos('login {"senha": "minha-senha"}'), 'login {"senha": "***"}');
verdade('segredo: Bearer', !/ya29|a0AfH6/.test(central.limparSegredos('Authorization: Bearer ya29.a0AfH6SMBxxxxxxxx')) && !/a0AfH6/.test(central.limparSegredos('header bearer a0AfH6SMBxxxxxxxx')));
verdade('segredo: chave do Google', !/AIza/.test(central.limparSegredos('chave AIzaSyD-1234567890abcdefghijklmnop')));
verdade('segredo: base64 comprido', !/QUJD/.test(central.limparSegredos('dados QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9w')));
igual('segredo: texto comum fica', central.limparSegredos('Baixou 48 XMLs da 292 (10/2026) em G:/Meu Drive/292'), 'Baixou 48 XMLs da 292 (10/2026) em G:/Meu Drive/292');
igual('linha: sem cor e numa linha', central.linhaParaEspelho('\x1b[31merro\x1b[39m  no\nmeio'), 'erro no meio');
igual('linha: cortada em 300', central.linhaParaEspelho('x'.repeat(500).replace(/x{40}/g, 'x x ')).length <= 300, true);

igual('dono da linha: [sieg] no servidor', central.roboDaLinha('servidor', '07/11 10:00 [sieg] baixando'), 'sieg');
igual('dono da linha: [arquivo] [novo]', central.roboDaLinha('servidor', '07/11 [arquivo] [novo] leu a pasta'), 'arquivador');
igual('dono da linha: sem marca na nuvem é o vigia', central.roboDaLinha('nuvem', '07/11 lendo o Gmail'), 'vigia');
igual('dono da linha: [nfse] na nuvem', central.roboDaLinha('nuvem', '[nfse] DPS enviada'), 'nfse');
igual('dono da linha: [ia] no PC', central.roboDaLinha('escritorio', '[ia] respondeu'), 'ia');
igual('dono da linha: [pc] no PC é o suporte', central.roboDaLinha('escritorio', '[pc] ligado'), 'suporte');
igual('dono da linha: sem marca no servidor (sem robô da casa)', central.roboDaLinha('servidor', 'linha solta'), '');

// ---------- o espelho: ritmo e tamanho ----------
{
  const gravados = [];
  const e = central.criarEspelho({ maquina: 'servidor', gravar: (robo, doc) => { gravados.push({ robo, n: doc.linhas.length, bytes: Buffer.byteLength(JSON.stringify(doc)), aoVivoAte: doc.aoVivoAte }); return Promise.resolve(); } });
  const t0 = AGORA;
  e.linha('[sieg] um', t0);
  igual('espelho: grava a primeira vez', e.tique(t0), ['sieg']);
  e.linha('[sieg] dois', t0 + 1000);
  igual('espelho: fora do ao vivo, não grava antes de 2 min', e.tique(t0 + 60000), []);
  igual('espelho: depois de 2 min grava', e.tique(t0 + central.DEVAGAR_MS), ['sieg']);
  igual('espelho: sem linha nova, não grava', e.tique(t0 + 10 * central.DEVAGAR_MS), []);
  e.aoVivo('sieg', t0 + 10 * central.DEVAGAR_MS);
  e.linha('[sieg] três', t0 + 10 * central.DEVAGAR_MS);
  const t1 = t0 + 10 * central.DEVAGAR_MS + central.AO_VIVO_MS;
  igual('espelho: ao vivo, grava a cada 10 s', e.tique(t1), ['sieg']);
  e.linha('[sieg] quatro', t1 + 1000);
  igual('espelho: ao vivo, não antes de 10 s', e.tique(t1 + 5000), []);
  igual('espelho: ao vivo, depois de 10 s', e.tique(t1 + central.AO_VIVO_MS), ['sieg']);
  for (let i = 0; i < 400; i++) e.linha('[fgts] ' + ('linha ' + i + ' ').repeat(40), t1 + 20000 + i);
  e.tique(t1 + 20000 + central.DEVAGAR_MS);
  const ultimo = gravados.filter(g => g.robo === 'fgts').pop();
  verdade('espelho: no máximo 200 linhas', ultimo && ultimo.n <= central.LINHAS);
  verdade('espelho: documento até 60 KB', ultimo && ultimo.bytes <= central.MAX_BYTES);
  igual('espelho: guarda as últimas linhas', e.linhas('fgts').length, central.LINHAS);
}

// ---------- travado ----------
{
  const andamento = ['processando'];
  verdade('travado: processando há 31 min', central.travado({ status: 'processando', atualizadoEm: new Date(AGORA - 31 * 60000).toISOString() }, andamento, AGORA));
  igual('travado: processando há 5 min, não', central.travado({ status: 'processando', criadoEm: new Date(AGORA - 60 * 60000).toISOString(), atualizadoEm: new Date(AGORA - 5 * 60000).toISOString() }, andamento, AGORA), false);
  igual('travado: pendente nunca', central.travado({ status: 'pendente', criadoEm: new Date(AGORA - 99 * 60000).toISOString() }, andamento, AGORA), false);
  igual('travado: sem data, não mexe', central.travado({ status: 'processando' }, andamento, AGORA), false);
}

// ---------- o caminho inteiro num banco de mentira ----------
// como o Firestore: {merge:true} funde os mapas campo a campo (quem sumiu do mapa FICA no banco); mergeFields troca o campo inteiro
const eMapa = v => v && typeof v === 'object' && !Array.isArray(v);
const fundir = (a, b) => { const r = Object.assign({}, a); for (const [k, v] of Object.entries(b)) r[k] = eMapa(v) && eMapa(r[k]) ? fundir(r[k], v) : v; return r; };
function bancoDeMentira({ negar = false } = {}) {
  const colecoes = new Map();   // nome -> Map(id -> dados)
  const ouvintes = [];
  let seq = 0;
  const col = nome => { if (!colecoes.has(nome)) colecoes.set(nome, new Map()); return colecoes.get(nome); };
  const avisar = () => { for (const o of ouvintes) o(); };
  const negado = () => Promise.reject(Object.assign(new Error('7 PERMISSION_DENIED: Missing or insufficient permissions.'), { code: 7 }));
  function ref(nome, id) {
    return {
      id,
      get: () => Promise.resolve(snapDoc(nome, id)),
      set: (d, o) => { if (negar) return negado(); const atual = col(nome).get(id) || {}; col(nome).set(id, o && o.merge ? fundir(atual, d) : o && o.mergeFields ? Object.assign({}, atual, d) : Object.assign({}, d)); avisar(); return Promise.resolve(); },
      update: d => { if (negar) return negado(); col(nome).set(id, Object.assign({}, col(nome).get(id), d)); avisar(); return Promise.resolve(); },
      delete: () => { col(nome).delete(id); avisar(); return Promise.resolve(); },
    };
  }
  function snapDoc(nome, id) { const d = col(nome).get(id); return { id, exists: !!d, data: () => (d ? Object.assign({}, d) : undefined), ref: ref(nome, id) }; }
  function consulta(nome, filtros, lim) {
    const casa = d => filtros.every(([c, op, v]) => (op === '==' ? d[c] === v : op === 'in' ? v.includes(d[c]) : op === '<' ? d[c] < v : true));
    const rodar = () => { const docs = Array.from(col(nome).entries()).filter(([, d]) => casa(d)).slice(0, lim || 1e9).map(([id]) => snapDoc(nome, id)); return { docs, empty: !docs.length, size: docs.length, forEach: fn => docs.forEach(fn) }; };
    return {
      where: (c, op, v) => consulta(nome, [...filtros, [c, op, v]], lim),
      limit: n => consulta(nome, filtros, n),
      get: () => Promise.resolve(rodar()),
      onSnapshot: (prox) => { const f = () => prox(rodar()); ouvintes.push(f); setImmediate(f); return () => { ouvintes.splice(ouvintes.indexOf(f), 1); }; },
    };
  }
  return {
    dados: col,
    collection: nome => Object.assign(consulta(nome, []), {
      doc: id => ref(nome, id),
      add: d => { if (negar) return negado(); const id = 'auto' + (++seq); col(nome).set(id, Object.assign({}, d)); avisar(); return Promise.resolve(ref(nome, id)); },
    }),
    runTransaction: async fn => { if (negar) return negado(); const muda = []; const r = await fn({ get: x => x.get(), update: (x, d) => muda.push([x, d]) }); for (const [x, d] of muda) await x.update(d); return r; },
    batch: () => { const ops = []; return { update: (x, d) => ops.push(() => x.update(d)), delete: x => ops.push(() => x.delete()), commit: async () => { for (const o of ops) await o(); } }; },
  };
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
const statusDe = (db, id) => (db.dados('robosComandos').get(id) || {}).status;
const msgDe = (db, id) => (db.dados('robosComandos').get(id) || {}).mensagem || '';

(async () => {
  const linhasDoLog = [];
  const log = (...m) => linhasDoLog.push(m.join(' '));
  const recente = (extra) => Object.assign({ status: 'pendente', por: 'uid-1', porNome: 'Vitor', em: new Date().toISOString(), tarefa: '' }, extra);

  // --- o PC do escritório: pausar e retomar o atendente de IA ---
  {
    const db = bancoDeMentira();
    const chamadas = [];
    central.registrarPausa('ia', { pausar: async () => chamadas.push('pausar'), retomar: async () => chamadas.push('retomar') });
    central.iniciarCentral({ db, maquina: 'escritorio', log });
    db.dados('robosComandos').set('p1', recente({ maquina: 'escritorio', robo: 'ia', acao: 'pausar' }));
    db.dados('robosComandos').set('x1', recente({ maquina: 'escritorio', robo: 'ia', acao: 'executar', tarefa: 'powershell -c x' }));
    db.dados('robosComandos').set('v1', recente({ maquina: 'escritorio', robo: 'ia', acao: 'retomar', em: new Date(Date.now() - 10 * 60000).toISOString() }));
    db.dados('robosComandos').set('n1', recente({ maquina: 'nuvem', robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail' }));
    db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' }));
    await esperar(60);
    igual('pc: pausar → feito', statusDe(db, 'p1'), 'feito');
    igual('pc: o gancho de pausa foi chamado', chamadas, ['pausar']);
    igual('pc: ação fora da lista → recusado', statusDe(db, 'x1'), 'recusado');
    verdade('pc: a recusa diz por quê', /lista fechada/.test(msgDe(db, 'x1')));
    igual('pc: comando velho → recusado', statusDe(db, 'v1'), 'recusado');
    igual('pc: comando da nuvem fica para a nuvem', statusDe(db, 'n1'), 'pendente');
    db.dados('robosComandos').set('p2', recente({ maquina: 'escritorio', robo: 'ia', acao: 'pausar' }));
    db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' }));
    await esperar(40);
    igual('pc: o mesmo pedido logo em seguida → recusado (repetido)', statusDe(db, 'p2'), 'recusado');
    db.dados('robosComandos').set('r1', recente({ maquina: 'escritorio', robo: 'ia', acao: 'retomar' }));
    db.dados('robosComandos').set('a1', recente({ maquina: 'escritorio', robo: 'suporte', acao: 'assistir' }));
    db.dados('robosComandos').set('k1', recente({ maquina: 'escritorio', robo: '', acao: 'reiniciar' }));
    db.dados('robosComandos').set('u1', recente({ maquina: 'escritorio', robo: '', acao: 'atualizar' }));
    db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' }));
    await esperar(60);
    igual('pc: retomar → feito', statusDe(db, 'r1'), 'feito');
    igual('pc: retomar chamou o gancho', chamadas, ['pausar', 'retomar']);
    igual('pc: o assistir é apagado depois de atendido', db.dados('robosComandos').has('a1'), false);
    verdade('pc: reiniciar sem o reinício educado ligado → erro com motivo', ['erro'].includes(statusDe(db, 'k1')) && /reinício|reinicie/i.test(msgDe(db, 'k1')));
    igual('pc: atualizar no PC → erro (não se atualiza por aqui)', statusDe(db, 'u1'), 'erro');
    const est = db.dados('robosMaquinas').get('escritorio') || {};
    igual('pc: estado da máquina publicado', [est.maquina, typeof est.em, typeof (est.sinais || {}).memoria], ['escritorio', 'string', 'number']);
    verdade('pc: pausados no estado (vazio depois de retomar)', est.pausados && !est.pausados.ia);
    console.log('[pc] uma linha do suporte com token=segredo123456');
    await esperar(10);
    central._st().espelho.tique(Date.now() + 10 * central.DEVAGAR_MS);
    await esperar(20);
    const reg = db.dados('robosRegistros').get('suporte');
    verdade('pc: o log do processo vai para o espelho', reg && reg.linhas.some(l => /uma linha do suporte/.test(l.texto)));
    verdade('pc: sem o segredo no espelho', reg && !reg.linhas.some(l => /segredo123456/.test(l.texto)));
    await central.desligarCentral();
    igual('pc: ao desligar, marca a máquina', typeof (db.dados('robosMaquinas').get('escritorio') || {}).desligadoEm, 'string');
  }

  // --- o servidor: rodar agora e limpar a fila travada ---
  {
    const db = bancoDeMentira();
    central.iniciarCentral({ db, maquina: 'servidor', log });
    db.dados('pedidosSieg').set('s1', { status: 'processando', criadoEm: new Date(Date.now() - 3 * 36e5).toISOString() });
    db.dados('pedidosSieg').set('s2', { status: 'processando', criadoEm: new Date(Date.now() - 60000).toISOString() });
    db.dados('pedidosSieg').set('s3', { status: 'pendente', criadoEm: new Date(Date.now() - 3 * 36e5).toISOString() });
    db.dados('robosComandos').set('l1', recente({ maquina: 'servidor', robo: 'sieg', acao: 'limpar-fila' }));
    db.dados('robosComandos').set('q1', recente({ maquina: 'servidor', robo: 'arquivador', acao: 'rodar-agora', tarefa: 'arquivar-agora' }));
    db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' }));
    await esperar(80);
    igual('servidor: limpar a fila → feito', statusDe(db, 'l1'), 'feito');
    igual('servidor: só o travado há mais de 30 min virou erro', ['s1', 's2', 's3'].map(id => db.dados('pedidosSieg').get(id).status), ['erro', 'processando', 'pendente']);
    igual('servidor: rodar agora → feito', statusDe(db, 'q1'), 'feito');
    const pedido = Array.from(db.dados('solicitacoesArquivo').values())[0] || {};
    igual('servidor: o pedido foi para a fila do arquivamento', [pedido.status, pedido.modo, pedido.criadoPorUid], ['pendente', 'PRODUCAO', 'uid-1']);
    await central.desligarCentral();
  }

  // --- os controles, no servidor: a fila item a item, o pedido por cliente, parar tudo, e a pausa que sobrevive ao reinício ---
  {
    const db = bancoDeMentira();
    const chamadas = [];
    for (const robo of ['fgts', 'sieg', 'alterdata']) central.registrarPausa(robo, { pausar: async () => chamadas.push('pausar ' + robo), retomar: async () => chamadas.push('retomar ' + robo) });
    const FUTURO = new Date(Date.now() + 36e5).toISOString();
    const VENCIDA = new Date(Date.now() - 60000).toISOString();
    // o que a máquina tinha gravado antes de reiniciar
    db.dados('robosMaquinas').set('servidor', { pausados: { fgts: { por: 'Vitor', em: VENCIDA, ate: FUTURO }, sieg: { por: 'Ana', em: VENCIDA, ate: VENCIDA }, alterdata: { por: 'Ana', em: VENCIDA } } });
    central.iniciarCentral({ db, maquina: 'servidor', log });
    await esperar(40);
    igual('reinício: a pausa com hora futura e a sem hora voltam; a vencida não', chamadas.slice().sort(), ['pausar alterdata', 'pausar fgts']);
    await central._conferirPausas(Date.parse(FUTURO) + 1000);
    await esperar(20);
    igual('a hora chegou: volta sozinho', chamadas.filter(x => x.startsWith('retomar')), ['retomar fgts']);
    const pausadosAgora = () => Object.keys((db.dados('robosMaquinas').get('servidor') || {}).pausados || {}).sort();
    igual('a hora chegou: sai do estado gravado (troca o mapa inteiro, não funde)', pausadosAgora(), ['alterdata']);
    chamadas.length = 0;

    const bater = async (id, extra) => { db.dados('robosComandos').set(id, recente(Object.assign({ maquina: 'servidor', robo: 'fgts' }, extra))); db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' })); await esperar(40); };
    const fgts = db.dados('pedidosFgts');
    fgts.set('p1', { status: 'pendente', cnpj: '11', competencia: '2026-10', modo: 'emitir' });
    fgts.set('p2', { status: 'trabalhando', cnpj: '12', competencia: '2026-10', modo: 'emitir' });
    fgts.set('p3', { status: 'pronto', cnpj: '13', competencia: '2026-10', modo: 'emitir' });
    fgts.set('p4', { status: 'erro', cnpj: '14', competencia: '2026-10', modo: 'emitir', erro: 'login', tentativas: 1 });
    fgts.set('p5', { status: 'erro', cnpj: '15', competencia: '2026-10', modo: 'emitir', erro: 'login' });
    fgts.set('p6', { status: 'pendente', cnpj: '15', competencia: '2026-10', modo: 'emitir' });

    await bater('c1', { acao: 'cancelar-item', item: 'p1' });
    igual('cancelar: feito', statusDe(db, 'c1'), 'feito');
    verdade('cancelar: nada é apagado, fica marcado com quem', fgts.has('p1') && fgts.get('p1').status === 'cancelado' && fgts.get('p1').canceladoPor === 'Vitor' && fgts.get('p1').canceladoPorUid === 'uid-1' && !!fgts.get('p1').canceladoEm);
    await bater('c2', { acao: 'cancelar-item', item: 'p2' });
    igual('cancelar: em andamento → recusado', statusDe(db, 'c2'), 'recusado');
    verdade('cancelar: a mensagem diz', /em andamento/.test(msgDe(db, 'c2')));
    igual('cancelar: quem está em andamento não muda', fgts.get('p2').status, 'trabalhando');
    await bater('c3', { acao: 'cancelar-item', item: 'naoexiste' });
    igual('cancelar: inexistente → recusado, o robô segue', statusDe(db, 'c3'), 'recusado');
    verdade('cancelar: a mensagem diz que não existe', /não existe/.test(msgDe(db, 'c3')));
    await bater('c4', { acao: 'cancelar-item', item: 'p3' });
    verdade('cancelar: o que já terminou', statusDe(db, 'c4') === 'recusado' && /saiu da fila/.test(msgDe(db, 'c4')));
    await bater('f1', { acao: 'na-frente', item: 'p6' });
    igual('na frente: feito', statusDe(db, 'f1'), 'feito');
    verdade('na frente: marcado com quem', !!fgts.get('p6').naFrenteEm && fgts.get('p6').naFrentePor === 'Vitor' && fgts.get('p6').status === 'pendente');
    await bater('f2', { acao: 'na-frente', item: 'p2' });
    igual('na frente: em andamento → recusado', statusDe(db, 'f2'), 'recusado');

    await bater('r1', { acao: 'refazer', item: 'p4' });
    igual('refazer: feito', statusDe(db, 'r1'), 'feito');
    verdade('refazer: o mesmo pedido volta para a fila, com quem pediu', fgts.get('p4').status === 'pendente' && fgts.get('p4').refeitoPor === 'Vitor' && fgts.size === 6);
    await bater('r2', { acao: 'refazer', item: 'p5' });
    verdade('refazer: já tem um igual na fila → recusado', statusDe(db, 'r2') === 'recusado' && /igual na fila/.test(msgDe(db, 'r2')));
    igual('refazer: o recusado continua em erro', fgts.get('p5').status, 'erro');
    await bater('r3', { acao: 'refazer', item: 'p3' });
    verdade('refazer: o que não está com erro → recusado', statusDe(db, 'r3') === 'recusado' && /com erro/.test(msgDe(db, 'r3')));
    await bater('r4', { acao: 'refazer', item: 'sumiu' });
    verdade('refazer: inexistente → recusado', statusDe(db, 'r4') === 'recusado' && /não existe/.test(msgDe(db, 'r4')));
    db.dados('pedidosAlterdata').set('a1', { status: 'erro', tipo: 'importar', codigo: 5, competencia: '2026-10' });
    db.dados('pedidosSieg').set('s1', { status: 'erro', tipo: 'xmlsCliente', codigo: '5', competencia: '2026-10' });
    await bater('r5', { robo: 'alterdata', acao: 'refazer', item: 'a1' });
    verdade('refazer: importação não se refaz', statusDe(db, 'r5') === 'recusado' && /importação/.test(msgDe(db, 'r5')));
    await bater('r6', { robo: 'sieg', acao: 'refazer', item: 's1' });
    verdade('refazer: XMLs do cliente não se refazem', statusDe(db, 'r6') === 'recusado' && /não ficam guardados/.test(msgDe(db, 'r6')));

    db.dados('clientes').set('cli1', { ativo: true, codigoOrigem: '486', nome: 'VS MEDICINA', documento: '12.345.678/0001-90' });
    db.dados('clientes').set('cli2', { ativo: true, codigoOrigem: '487', nome: 'SEM DOC', documento: '' });
    const antes = fgts.size;
    await bater('q1', { acao: 'pedir-cliente', tarefa: 'guia', cliente: '486', competencia: '2026-10' });
    igual('pedir: feito', statusDe(db, 'q1'), 'feito');
    igual('pedir: entrou um na fila que já existe', fgts.size, antes + 1);
    const novo = Array.from(fgts.values()).pop();
    igual('pedir: o mesmo pedido da tela do DP, com o CNPJ do cadastro', [novo.status, novo.modo, novo.cnpj, novo.codigo, novo.empresa, novo.competencia, novo.criadoPorUid], ['pendente', 'emitir', '12345678000190', '486', 'VS MEDICINA', '2026-10', 'uid-1']);
    await esperar(1);
    await bater('q2', { acao: 'pedir-cliente', tarefa: 'ensaio', cliente: '486', competencia: '2026-10', porNome: 'outro' });
    igual('pedir: emitir e ensaio são pedidos diferentes', statusDe(db, 'q2'), 'feito');
    await bater('q3', { acao: 'pedir-cliente', tarefa: 'guia', cliente: '486', competencia: '2026-09' });
    igual('pedir: outra competência passa', statusDe(db, 'q3'), 'feito');
    db.dados('robosComandos').set('q4', recente({ maquina: 'servidor', robo: 'fgts', acao: 'pedir-cliente', tarefa: 'guia', cliente: '486', competencia: '2026-10' }));
    central._st().recentes.clear();
    db.collection('robosComandos').doc('gatilho').set(recente({ maquina: 'outra' }));
    await esperar(40);
    verdade('pedir: igual já na fila → recusado', statusDe(db, 'q4') === 'recusado' && /igual na fila/.test(msgDe(db, 'q4')));
    await bater('q5', { acao: 'pedir-cliente', tarefa: 'guia', cliente: '487', competencia: '2026-10' });
    verdade('pedir: FGTS sem CNPJ → recusado', statusDe(db, 'q5') === 'recusado' && /CNPJ/.test(msgDe(db, 'q5')));
    await bater('q6', { acao: 'pedir-cliente', tarefa: 'guia', cliente: '999', competencia: '2026-10' });
    verdade('pedir: cliente que não existe → recusado', statusDe(db, 'q6') === 'recusado' && /Não achei/.test(msgDe(db, 'q6')));
    await bater('q7', { robo: 'alterdata', acao: 'pedir-cliente', tarefa: 'mensal', cliente: '486', competencia: '2026-10' });
    const alt = Array.from(db.dados('pedidosAlterdata').values()).pop();
    igual('pedir: Alterdata com o código em número, como a tela', [statusDe(db, 'q7'), alt.tipo, alt.codigo], ['feito', 'mensal', 486]);
    await bater('q8', { robo: 'sieg', acao: 'pedir-cliente', tarefa: 'saidas', cliente: '486', competencia: '2026-10' });
    const sieg = Array.from(db.dados('pedidosSieg').values()).pop();
    igual('pedir: SIEG saídas sem tipo, como a tela', [statusDe(db, 'q8'), sieg.tipo, sieg.codigo], ['feito', undefined, '486']);

    chamadas.length = 0;
    const ate = new Date(Date.now() + 2 * 36e5).toISOString();
    await bater('t1', { robo: '', acao: 'parar-tudo', ate });
    igual('parar tudo: feito', statusDe(db, 't1'), 'feito');
    igual('parar tudo: chamou os três', chamadas.slice().sort(), ['pausar alterdata', 'pausar fgts', 'pausar sieg']);
    verdade('parar tudo: a resposta diz quem e quando', /FGTS/.test(msgDe(db, 't1')) && /voltam/.test(msgDe(db, 't1')));
    await esperar(20);
    igual('parar tudo: gravado com a hora de voltar', (db.dados('robosMaquinas').get('servidor').pausados.sieg || {}).ate, ate);
    chamadas.length = 0;
    await bater('t2', { robo: '', acao: 'retomar-tudo' });
    igual('retomar tudo: feito', statusDe(db, 't2'), 'feito');
    igual('retomar tudo: chamou os três', chamadas.slice().sort(), ['retomar alterdata', 'retomar fgts', 'retomar sieg']);
    await esperar(20);
    igual('retomar tudo: nenhum no estado gravado', pausadosAgora(), []);
    await central.desligarCentral();
  }

  // --- sem permissão no banco: não cai, loga uma vez ---
  {
    const db = bancoDeMentira({ negar: true });
    const antes = linhasDoLog.length;
    let caiu = false;
    try { central.iniciarCentral({ db, maquina: 'nuvem', log }); await esperar(60); } catch (e) { caiu = true; }
    igual('sem permissão: não derruba', caiu, false);
    const sobre = linhasDoLog.slice(antes).filter(l => /sem permissão/.test(l));
    verdade('sem permissão: avisa no log', sobre.length >= 1);
    await central.desligarCentral();
  }

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'ok: ' + total + ' testes da central'));
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
