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
      set: (d, o) => { if (negar) return negado(); const atual = col(nome).get(id) || {}; col(nome).set(id, o && o.merge ? Object.assign({}, atual, d) : Object.assign({}, d)); avisar(); return Promise.resolve(); },
      update: d => { if (negar) return negado(); col(nome).set(id, Object.assign({}, col(nome).get(id), d)); avisar(); return Promise.resolve(); },
      delete: () => { col(nome).delete(id); avisar(); return Promise.resolve(); },
    };
  }
  function snapDoc(nome, id) { const d = col(nome).get(id); return { id, exists: !!d, data: () => (d ? Object.assign({}, d) : undefined), ref: ref(nome, id) }; }
  function consulta(nome, filtros, lim) {
    const casa = d => filtros.every(([c, op, v]) => (op === '==' ? d[c] === v : op === 'in' ? v.includes(d[c]) : op === '<' ? d[c] < v : true));
    const rodar = () => { const docs = Array.from(col(nome).entries()).filter(([, d]) => casa(d)).slice(0, lim || 1e9).map(([id]) => snapDoc(nome, id)); return { docs, empty: !docs.length, size: docs.length }; };
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
