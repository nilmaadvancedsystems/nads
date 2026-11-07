// Testes da atualização sem matar o trabalho no meio (07/11/2026): o "estou ocupado" (ocupado.js), a partida sem rede
// (partida.js), a decisão e o fluxo do atualizador (atualizar-robo.js) num mundo de mentira (git, processos, relógio e
// disco falsos: nada roda no servidor), o pai esperando um robô em processo próprio terminar o trabalho (processos de
// verdade) e o interruptor da nuvem com comandos falsos (se houver bash).   node teste-reinicio.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork, spawnSync } = require('child_process');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const verdade = (nome, v) => igual(nome, !!v, true);

if (process.argv[2] === 'pai') {
  // ---------- o pai de verdade: um robô em processo próprio trabalhando quando chega o pedido para sair ----------
  const ocupado = require('./ocupado');
  const sat = require('./satelites');
  sat.NOMES.eco = 'Eco';
  const linhas = [];
  const t0 = Date.now();
  let filho = 0;
  ocupado.iniciar({
    nome: 'teste-pai', log: (...m) => linhas.push(m.join(' ')), filhosVivos: () => sat.vivos(),
    sair: r => { process.stdout.write(JSON.stringify({ livre: r.livre, esperouMs: r.esperouMs, total: Date.now() - t0, filho, vivosNoFim: sat.vivos(), linhas }) + '\n'); setTimeout(() => process.exit(0), 100); },
  });
  ocupado.aoParar(m => sat.pedirSaida(m));
  process.stdout.write = (orig => (s, ...r) => (/tique/.test(String(s)) ? true : orig(s, ...r)))(process.stdout.write.bind(process.stdout));
  sat.ligar(['eco'], () => {});
  // o pedido chega com o filho já ligado e trabalhando (a trava dele existe)
  const esperarFilho = setInterval(() => {
    try { filho = parseInt(fs.readFileSync(path.join(__dirname, 'robo-eco.lock'), 'utf8'), 10); } catch (e) { return; }
    clearInterval(esperarFilho);
    setTimeout(() => void ocupado.pedirParada('teste'), 300);
  }, 100);
  setTimeout(() => { process.stdout.write(JSON.stringify({ erro: 'o pai não saiu em 20 s', linhas }) + '\n'); process.exit(1); }, 20000).unref();
  return;
}

const ocupado = require('./ocupado');
const partida = require('./partida');
const A = require('./atualizar-robo');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-reinicio-'));

(async () => {
  // ================= ocupado.js =================
  const conta = (chave, texto) => ocupado.contaComoOcupado({ chave, texto });
  igual('conta: o SIEG baixando', conta('sieg', 'SIEG: XMLs de 236'), true);
  igual('conta: o arquivador novo arquivando', conta('arquivador-novo', 'Arquivando 39 arquivo(s) da Claudio Secretario'), true);
  igual('conta: o FGTS emitindo', conta('fgts', 'Emitindo FGTS 1/3 — EMPRESA'), true);
  igual('conta: o lote (marca)', conta('lote-dp', 'Lote do DP'), true);
  igual('não conta: o modo do arquivador novo', conta('arquivador-novo-modo', 'modo: producao, lido às 07:45'), false);
  igual('não conta: a leitura da pasta (recomeça na partida)', conta('arquivador-novo-leitura', 'Lendo a pasta: 1.000 arquivos'), false);
  igual('não conta: o Drive lento', conta('arquivador-novo-ritmo', 'Google Drive lento: indo devagar'), false);
  igual('não conta: esperando o G:', conta('arquivador-novo', 'Esperando o Google Drive (G:) voltar'), false);
  igual('não conta: pedido do botão esperando', conta('arquivo', 'Arquivamento esperando: a rotina das 9h'), false);
  igual('não conta: a rotina das 9h (outro processo)', conta('rotina', 'Organizando o Drive (rotina das 9h)'), false);
  igual('não conta: o G: fora', conta('drive', 'Google Drive (G:) fora há 12 min: reiniciando'), false);
  igual('não conta: sem texto', conta('sieg', null), false);

  // drenar com relógio falso
  {
    let agora = 0;
    const relogio = () => agora;
    const dormir = async ms => { agora += ms; };
    let fila = [{ chave: 'sieg', texto: 'SIEG: baixando' }];
    let r = await ocupado.drenar({ ocupados: () => [], limiteMs: 600000, relogio, dormir });
    igual('drenar: nada em andamento sai na hora', [r.livre, r.esperouMs], [true, 0]);
    agora = 0;
    r = await ocupado.drenar({ ocupados: () => (agora >= 7000 ? [] : fila), limiteMs: 600000, aCadaMs: 2000, relogio, dormir });
    igual('drenar: espera o SIEG terminar (8 s)', [r.livre, r.esperouMs], [true, 8000]);
    agora = 0;
    r = await ocupado.drenar({ ocupados: () => fila, limiteMs: 600000, aCadaMs: 2000, relogio, dormir });
    igual('drenar: trabalho que não termina: sai no limite (10 min)', [r.livre, r.esperouMs, r.pendentes], [false, 600000, ['SIEG: baixando']]);
    agora = 0;
    let filhos = 2;
    r = await ocupado.drenar({ ocupados: () => [], filhosVivos: () => (agora >= 4000 ? 0 : filhos), limiteMs: 600000, aCadaMs: 2000, relogio, dormir });
    igual('drenar: espera os robôs em processo próprio saírem', [r.livre, r.esperouMs], [true, 4000]);
    const avisos = [];
    agora = 0;
    await ocupado.drenar({ ocupados: () => fila, limiteMs: 180000, aCadaMs: 2000, relogio, dormir, log: m => avisos.push(m) });
    igual('drenar: avisa no log uma vez por minuto', avisos.length, 3);
    verdade('drenar: o aviso diz o que espera', /esperando SIEG: baixando/.test(avisos[0]));
  }

  // o pedido para sair (o arquivo)
  {
    const arq = path.join(tmp, 'sair.pedido');
    igual('pedido: sem arquivo, nada', ocupado.lerPedido(Date.now(), arq), null);
    fs.writeFileSync(arq, JSON.stringify({ motivo: 'atualização para abc' }));
    const p = ocupado.lerPedido(Date.now() - 60000, arq);
    igual('pedido: escrito depois que o robô ligou, vale', p && p.motivo, 'atualização para abc');
    igual('pedido: escrito ANTES do robô ligar (sobra), não vale', ocupado.lerPedido(Date.now() + 60000, arq), null);
    verdade('atualização em curso: sinal recente', ocupado.atualizacaoEmCurso(Date.now(), arq));
    igual('atualização em curso: sinal de mais de 30 min (o atualizador caiu) não segura', ocupado.atualizacaoEmCurso(Date.now() + 31 * 60000, arq), 0);
    // a partida espera o reset terminar
    let esperas = 0;
    const esperou = ocupado.esperarAtualizacao(() => {}, { arquivo: arq, dormirSync: () => { if (++esperas === 3) fs.unlinkSync(arq); } });
    igual('partida: com a atualização no meio, espera o sinal sumir (3 voltas) e avisa', [esperou, esperas], [true, 3]);
    igual('partida: sem atualização, segue na hora', ocupado.esperarAtualizacao(() => {}, { arquivo: arq, dormirSync: () => { throw new Error('não devia esperar'); } }), false);
  }

  // os módulos carregados (o que o atualizador compara)
  {
    const pasta = path.join(tmp, 'robo');
    const cache = { [path.join(pasta, 'sieg.js')]: 1, [path.join(pasta, 'fgts-extensao', 'x.js')]: 1, [path.join(pasta, 'node_modules', 'a', 'i.js')]: 1, [path.join(tmp, 'fora.js')]: 1 };
    igual('módulos: só os do robô, sem node_modules, com /', ocupado.modulosCarregados(cache, pasta), ['fgts-extensao/x.js', 'sieg.js']);
  }

  // ================= partida.js =================
  igual('partida: espera crescente até 10 min', [0, 1, 2, 3, 4, 5, 9].map(n => partida.esperaDaTentativa(n) / 1000), [30, 60, 120, 240, 480, 600, 600]);
  {
    const esperas = [];
    let tentativas = 0;
    const n = await partida.esperarOBanco(async () => { if (++tentativas <= 4) throw new Error('14 UNAVAILABLE: ETIMEDOUT'); }, { log: () => {}, dormir: async ms => { esperas.push(ms / 1000); } });
    igual('sem rede: tenta de novo sem sair, 30 s, 1, 2, 4 min', [n, esperas], [4, [30, 60, 120, 240]]);
    const linhas = [];
    await partida.esperarOBanco(() => new Promise(() => {}), { log: m => linhas.push(m), limiteMs: 50, dormir: async () => { throw new Error('parar'); } }).catch(() => {});
    verdade('sem rede: a leitura que não responde vence pelo tempo', /sem resposta em 0 s/.test(linhas[0] || ''));
    const arq = path.join(tmp, 'partidas.json');
    const t = Date.parse('2026-11-06T07:42:00-03:00');
    igual('partida que falha: 0, 30 s, 1 min, 2 min seguidas', [0, 1, 2, 3].map(i => partida.esperaDaFalha(arq, t + i * 90000) / 1000), [0, 30, 60, 120]);
    igual('partida que falha 20 min depois: conta do zero', partida.esperaDaFalha(arq, t + 3 * 90000 + 20 * 60000), 0);
    partida.partidaBoa(arq);
    verdade('partida boa: apaga a contagem', !fs.existsSync(arq));
  }

  // ================= atualizar-robo.js: o que importa e a decisão =================
  const usados = new Set(['arquivador.js', 'sieg.js', 'painel.js', 'fgts-extensao.js']);
  igual('importa: módulo que o robô usa', A.importa('robo/sieg.js', usados), true);
  igual('importa: módulo que só a outra máquina usa', A.importa('robo/nfse.js', usados), false);
  igual('importa: o app (fora do robô)', A.importa('apps/tarefas/index.html', usados), false);
  igual('importa: teste e documentação', [A.importa('robo/teste-robo.js', usados), A.importa('robo/LEIAME.md', usados)], [false, false]);
  igual('importa: o próprio atualizador e os instaladores', [A.importa('robo/atualizar-robo.js', usados), A.importa('robo/servidor/atualizar-robo.cmd', usados), A.importa('robo/nuvem/iniciar-maquina.sh', usados)], [false, false, false]);
  igual('importa: as dependências, sempre', A.importa('robo/package-lock.json', new Set()), true);
  igual('importa: a extensão do FGTS (montada na partida) se o FGTS roda aqui', [A.importa('robo/fgts-extensao/manifest.json', usados), A.importa('robo/fgts-extensao/manifest.json', new Set())], [true, false]);
  igual('importa: o .py do Alterdata (lido a cada pedido) não reinicia', A.importa('robo/alterdata_balancete.py', usados), false);
  igual('importa: sem saber o que o robô usa (robô antigo), tudo do robô conta', [A.importa('robo/nfse.js', null), A.importa('robo/alterdata_balancete.py', null), A.importa('robo/teste-x.js', null)], [true, true, false]);
  igual('urgente: [urgente] no commit', [A.temUrgente('Corrige o SIEG [URGENTE]'), A.temUrgente('urgente sem colchete')], [true, false]);

  const T = Date.parse('2026-11-07T14:00:00-03:00');
  const base = { carregados: usados, agoraMs: T, janelas: [], ocupados: [] };
  igual('decidir: nada novo', A.decidir(Object.assign({}, base, { arquivos: [] })).acao, 'nada');
  igual('decidir: só o app e teste mudaram: código sem reiniciar', A.decidir(Object.assign({}, base, { arquivos: ['apps/x.html', 'robo/teste-robo.js', 'robo/nfse.js'] })).acao, 'codigo');
  igual('decidir: mudou o SIEG: reinicia', A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'] })).acao, 'reiniciar');
  let d = A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], ultimoReinicioMs: T - 10 * 60000 }));
  igual('decidir: reiniciou há 10 min: espera até completar 30', [d.acao, (d.ateMs - T) / 60000], ['esperar', 20]);
  igual('decidir: urgente passa na frente dos 30 min', A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], ultimoReinicioMs: T - 60000, urgente: true })).acao, 'reiniciar');
  igual('decidir: urgente não reinicia se nada que importa mudou', A.decidir(Object.assign({}, base, { arquivos: ['robo/teste-robo.js'], urgente: true })).acao, 'codigo');
  igual('decidir: reiniciou há 31 min: reinicia', A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], ultimoReinicioMs: T - 31 * 60000 })).acao, 'reiniciar');
  d = A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], ocupados: ['Backup do dia'] }));
  igual('decidir: ocupado com o backup: espera', [d.acao, d.ocupado, /Backup do dia/.test(d.motivo)], ['esperar', true, true]);
  igual('decidir: ocupado há 30 min: pede para sair assim mesmo', A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], ocupados: ['Backup do dia'], esperandoOcupadoDesdeMs: T - 30 * 60000 })).acao, 'reiniciar');
  const tres = Date.parse('2026-11-07T03:05:00-03:00');
  d = A.decidir(Object.assign({}, base, { arquivos: ['robo/sieg.js'], agoraMs: tres, janelas: ['03:00-03:15'] }));
  igual('decidir: na janela das 3h: espera até 03:15', [d.acao, new Date(d.ateMs).getHours(), new Date(d.ateMs).getMinutes()], ['esperar', 3, 15]);
  igual('janela: virando a meia-noite', [!!A.dentroDaJanela(['23:30-00:30'], new Date(2026, 10, 7, 23, 45)), !!A.dentroDaJanela(['23:30-00:30'], new Date(2026, 10, 8, 0, 10)), !!A.dentroDaJanela(['23:30-00:30'], new Date(2026, 10, 8, 0, 31))], [true, true, false]);

  // ================= o atualizador do servidor num mundo de mentira =================
  const R = 'R', D = 'D';
  const VIVO = path.join(R, 'robo', 'robo-vivo-arquivador.json');
  const PED = path.join(R, 'robo', 'sair.pedido');
  const EST = path.join(D, 'atualizar-estado.json');
  function mundo(cfg) {
    const t = { agora: cfg.agora || T, arquivos: new Map(cfg.arquivos || []), eventos: [], linhas: [], fetches: 0 };
    const refs = { HEAD: cfg.de, origin: cfg.para };
    const vivos = new Set(cfg.vivos || []);
    const dep = {
      pid: 999,
      agora: () => t.agora,
      dormir: async ms => { t.agora += ms; if (cfg.aoDormir) cfg.aoDormir(t, vivos, refs); },
      log: (...m) => t.linhas.push(m.join(' ')),
      git: args => {
        const a = args.join(' ');
        if (args[0] === 'fetch') { t.fetches++; if (cfg.aoBuscar) cfg.aoBuscar(t.fetches, refs); return { ok: true, saida: '' }; }
        if (a === 'rev-parse HEAD') return { ok: true, saida: refs.HEAD + '\n' };
        if (a === 'rev-parse origin/desenvolvimento') return { ok: true, saida: refs.origin + '\n' };
        if (args[0] === 'diff') return { ok: true, saida: (cfg.diff[args[3] + '..' + args[4]] || []).join('\n') + '\n' };
        if (args[0] === 'log') return { ok: true, saida: cfg.mensagens || '' };
        if (args[0] === 'reset') { refs.HEAD = args[3]; t.eventos.push('reset ' + args[3] + (t.arquivos.has(PED) ? ' (com o sinal)' : '') + (vivos.has(4242) ? ' (robô vivo)' : '')); return { ok: true, saida: '' }; }
        return { ok: false, saida: '', erro: 'git falso: ' + a };
      },
      ler: f => { if (!t.arquivos.has(f)) throw new Error('ENOENT'); return t.arquivos.get(f); },
      escrever: (f, x) => { if (f === PED) t.eventos.push('pedido'); t.arquivos.set(f, x); },
      tocar: () => {},
      existe: f => t.arquivos.has(f),
      apagar: f => { if (t.arquivos.delete(f) && f === PED) t.eventos.push('tirou o pedido'); },
      listar: dir => [...t.arquivos.keys()].filter(f => path.dirname(f) === dir).map(f => path.basename(f)),
      vivo: pid => vivos.has(pid),
      matarArvore: pid => { vivos.delete(pid); t.eventos.push('forçou ' + pid); },
      processosArquivador: () => (cfg.processos || [4242]).filter(p => vivos.has(p)),
    };
    return { dep, t, refs, vivos };
  }
  const vivoNovo = (extra) => [VIVO, JSON.stringify(Object.assign({ nome: 'arquivador', pid: 4242, protocolo: 1, ocupado: [], modulos: ['arquivador.js', 'sieg.js', 'painel.js'] }, extra))];
  const roda = m => A.servidor({ repo: R, dados: D, janelas: [] }, m.dep);

  {
    const m = mundo({ de: 'aaa', para: 'aaa', diff: {}, vivos: [4242], arquivos: [vivoNovo()] });
    igual('servidor: em dia, não mexe em nada', [await roda(m), m.t.eventos], [0, []]);
  }
  {
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['apps/x.html', 'robo/teste-robo.js', 'robo/nfse.js'] }, vivos: [4242], arquivos: [vivoNovo()] });
    igual('servidor: nada que o robô usa: só o código, sem pedido e sem forçar', [await roda(m), m.t.eventos], [0, ['reset bbb (robô vivo)']]);
  }
  {
    let voltas = 0;
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'] }, vivos: [4242], arquivos: [vivoNovo()], aoDormir: (t, vivos) => { if (++voltas === 3) vivos.delete(4242); } });
    const c = await roda(m);
    igual('servidor: mudou o SIEG: pede, espera o robô sair sozinho, SÓ ENTÃO o reset, e tira o pedido', [c, m.t.eventos], [0, ['pedido', 'reset bbb (com o sinal)', 'tirou o pedido']]);
    verdade('servidor: registra a hora do reinício', JSON.parse(m.t.arquivos.get(EST)).ultimoReinicioEm);
    verdade('servidor: o log diz que saiu sozinho', m.t.linhas.some(l => /saiu sozinho em 15 s/.test(l)));
  }
  {
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'] }, vivos: [4242], arquivos: [vivoNovo()] });
    await roda(m);
    igual('servidor: robô que não sai em 12 min: força (o processo e os filhos) e depois o reset', m.t.eventos, ['pedido', 'forçou 4242', 'reset bbb (com o sinal)', 'tirou o pedido']);
    verdade('servidor: esperou os 12 min antes de forçar', m.t.agora - T >= 12 * 60000 && m.t.agora - T < 13 * 60000);
  }
  {
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/nfse.js'] }, vivos: [4242], arquivos: [] });
    await roda(m);
    igual('servidor: robô antigo (sem a prova de vida): como antes, o reset e reinicia na hora; tudo do robô conta', m.t.eventos, ['pedido', 'reset bbb (com o sinal) (robô vivo)', 'forçou 4242', 'tirou o pedido']);
  }
  {
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'] }, vivos: [], arquivos: [] });
    await roda(m);
    igual('servidor: nenhum robô rodando: só o código', m.t.eventos, ['pedido', 'reset bbb (com o sinal)', 'tirou o pedido']);
  }
  {
    // reiniciou há 10 min; durante a espera chega outra publicação: vai tudo junto, num reinício só
    let voltas = 0;
    const m = mundo({
      de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'], 'aaa..ccc': ['robo/sieg.js', 'robo/painel.js'] }, vivos: [4242],
      arquivos: [vivoNovo(), [EST, JSON.stringify({ ultimoReinicioEm: new Date(T - 10 * 60000).toISOString() })]],
      aoBuscar: (n, refs) => { if (n === 3) refs.origin = 'ccc'; },
      aoDormir: (t, vivos) => { if (t.arquivos.has(PED) && ++voltas === 2) vivos.delete(4242); },
    });
    await roda(m);
    igual('servidor: 30 min entre reinícios: espera e junta as publicações num reinício só', m.t.eventos, ['pedido', 'reset ccc (com o sinal)', 'tirou o pedido']);
    verdade('servidor: o reinício saiu depois dos 30 min do anterior', m.t.agora - T >= 20 * 60000);
    verdade('servidor: avisa a espera uma vez', m.t.linhas.filter(l => /espero; o último reinício/.test(l)).length === 1);
  }
  {
    let voltas = 0;
    const m = mundo({
      de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'] }, vivos: [4242], mensagens: 'Conserta o SIEG [urgente]\n',
      arquivos: [vivoNovo(), [EST, JSON.stringify({ ultimoReinicioEm: new Date(T - 2 * 60000).toISOString() })]],
      aoDormir: (t, vivos) => { if (++voltas === 1) vivos.delete(4242); },
    });
    await roda(m);
    igual('servidor: [urgente] no commit não espera os 30 min', [m.t.eventos, m.t.agora - T], [['pedido', 'reset bbb (com o sinal)', 'tirou o pedido'], 5000]);
  }
  {
    let voltas = 0;
    const m = mundo({
      de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/sieg.js'] }, vivos: [4242], arquivos: [vivoNovo({ ocupado: [{ chave: 'backup', texto: 'Backup do dia' }] })],
      aoDormir: (t, vivos) => {
        if (t.agora - T >= 6 * 60000 && !t.arquivos.has(PED)) t.arquivos.set(VIVO, vivoNovo()[1]);   // o backup terminou
        if (t.arquivos.has(PED) && ++voltas === 1) vivos.delete(4242);
      },
    });
    await roda(m);
    verdade('servidor: robô ocupado com o backup: espera terminar antes de pedir', m.t.eventos[0] === 'pedido' && m.t.agora - T >= 6 * 60000 && m.t.agora - T < 9 * 60000);
  }
  {
    const m = mundo({ de: 'aaa', para: 'bbb', diff: {}, vivos: [4242, 77], arquivos: [vivoNovo(), [path.join(D, 'atualizar.trava'), '77']] });
    igual('servidor: outro atualizador rodando: sai sem mexer', [await roda(m), m.t.eventos, m.t.fetches], [0, [], 0]);
  }

  // ================= a decisão da nuvem =================
  {
    const est = path.join(tmp, 'estado-nuvem.json');
    const m = mundo({ de: 'aaa', para: 'bbb', diff: { 'aaa..bbb': ['robo/vigia-robo.js'] }, vivos: [55], arquivos: [[path.join(R, 'robo', 'robo-vivo-vigia.json'), JSON.stringify({ nome: 'vigia', pid: 55, protocolo: 1, ocupado: [{ chave: 'backup', texto: 'Backup do dia' }], modulos: ['vigia-robo.js'] })]] });
    m.dep.ler = f => (f === est ? fs.readFileSync(f, 'utf8') : m.t.arquivos.get(f));
    m.dep.escrever = (f, x) => fs.writeFileSync(f, x);
    let linha = A.nuvemDecidir({ repo: R, estado: est, versao: '2026-11-07-a', janelas: [] }, m.dep);
    verdade('nuvem: vigia ocupado com o backup: esperar', /^esperar .*Backup do dia/.test(linha));
    verdade('nuvem: guarda desde quando espera', JSON.parse(fs.readFileSync(est, 'utf8')).esperandoOcupadoDesde);
    linha = A.nuvemDecidir({ repo: R, estado: est, versao: '2026-11-07-urgente', janelas: [] }, m.dep);
    verdade('nuvem: "urgente" no robo-versao: reiniciar', /^reiniciar /.test(linha));
    A.registrar(est, m.dep);
    linha = A.nuvemDecidir({ repo: R, estado: est, versao: '2026-11-07-b', janelas: [] }, m.dep);
    verdade('nuvem: logo depois de reiniciar: esperar os 30 min', /^esperar .*último reinício/.test(linha));
    m.refs.origin = 'aaa';
    verdade('nuvem: nada novo', /^nada /.test(A.nuvemDecidir({ repo: R, estado: est, versao: 'x', janelas: [] }, m.dep)));
  }

  // ================= o ouvinte não entrega depois do pedido para sair =================
  // (por último: o pedido vale para o processo inteiro)
  {
    const { ouvir } = require('./ouvinte');
    let entregue = 0;
    let cb = null;
    ouvir('teste', () => ({ onSnapshot: (ok) => { cb = ok; return () => {}; } }), () => { entregue++; }, () => {});
    cb({ empty: false });
    ocupado.marcar('teste', 'trabalhando');
    igual('marcar: entra no "estou ocupado"', ocupado.agora().map(x => x.chave), ['teste']);
    const saindo = ocupado.pedirParada('teste');
    cb({ empty: false });
    igual('ouvinte: antes do pedido entrega, depois não', [entregue, ocupado.parando()], [1, true]);
    ocupado.marcar('teste', null);
    const r = await saindo;
    igual('pedirParada: espera a marca sair e termina livre', r.livre, true);
  }

  // ================= o pai espera o robô em processo próprio terminar (processos de verdade) =================
  await new Promise(resolve => {
    const pai = fork(__filename, ['pai'], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'], env: Object.assign({}, process.env, { ECO_OCUPADO_MS: '2500' }) });
    let saida = '';
    pai.stdout.on('data', b => { saida += b; });
    pai.on('exit', () => {
      let r = {};
      try { r = JSON.parse(saida.trim().split('\n').pop()); } catch (e) { r = { erro: 'saída: ' + saida.slice(-300) }; }
      if (r.erro) { igual('pai: ' + r.erro, (r.linhas || []).join(' | '), ''); return resolve(); }
      verdade('pai: esperou o robô em processo próprio terminar o trabalho (' + r.esperouMs + ' ms)', r.livre && r.esperouMs >= 1000);
      igual('pai: o filho não foi ligado de novo', r.vivosNoFim, 0);
      const vivo = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
      setTimeout(() => {
        verdade('pai: o filho saiu (' + r.filho + ')', r.filho && !vivo(r.filho));
        igual('pai: as provas de vida somem quando os processos saem', ['teste-pai', 'eco'].filter(n => fs.existsSync(path.join(__dirname, 'robo-vivo-' + n + '.json'))), []);
        resolve();
      }, 800);
    });
  });

  // ================= o interruptor da nuvem com comandos falsos =================
  const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
  if (bash.status !== 0) console.log('(sem bash: o interruptor da nuvem não foi testado)');
  else {
    const sh = fs.readFileSync(path.join(__dirname, 'nuvem', 'iniciar-maquina.sh'), 'utf8');
    const corpo = /cat > \/usr\/local\/bin\/robo-interruptor <<'EOF'\n([\s\S]*?)\nEOF\n/.exec(sh)[1];
    const raiz = path.join(tmp, 'vm').replace(/\\/g, '/');
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(raiz + '/robo', { recursive: true });
    fs.mkdirSync(bin);
    const script = corpo.split('/opt/robo').join(raiz + '/robo').split('/dev/console').join(raiz + '/console');
    fs.writeFileSync(path.join(tmp, 'interruptor.sh'), script);
    const reg = raiz + '/comandos.log';
    const falso = (nome, corpoSh) => fs.writeFileSync(path.join(bin, nome), '#!/bin/bash\n' + corpoSh + '\n');
    falso('curl', 'case "$*" in *robo-ligado*) echo "$FAKE_LIGADO";; *robo-versao*) echo "$FAKE_VERSAO";; esac');
    falso('sudo', 'shift 2; exec "$@"');
    falso('systemctl', 'echo "systemctl $*" >> ' + reg + '; case "$1" in is-active) [ "$FAKE_ATIVO" = sim ];; esac');
    falso('npm', 'echo "npm $1" >> ' + reg);
    // o git: o show devolve um atualizar-robo.js que só responde a decisão de mentira
    falso('git', 'case "$*" in *" show "*) echo "const a=process.argv[2]; if(a===\'decidir\') console.log(process.env.FAKE_DECISAO);";; *) echo "git $3 $4" >> ' + reg + ';; esac');
    const rodar = (decisao, ativo) => {
      try { fs.unlinkSync(reg); } catch (e) { /* primeira */ }
      const posix = p => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (x, l) => '/' + l.toLowerCase());
      const r = spawnSync('bash', ['-c', 'export PATH="' + posix(bin) + ':$PATH"; bash "' + posix(path.join(tmp, 'interruptor.sh')) + '"'], {
        encoding: 'utf8', env: Object.assign({}, process.env, { FAKE_LIGADO: 'sim', FAKE_VERSAO: 'v2', FAKE_ATIVO: ativo, FAKE_DECISAO: decisao }),
      });
      let cmds = '';
      try { cmds = fs.readFileSync(reg, 'utf8').trim().split('\n').filter(Boolean); } catch (e) { cmds = []; }
      return { status: r.status, cmds, erro: r.stderr };
    };
    // ...com o bash do Git para Windows, os nomes sem extensão precisam ser executáveis
    for (const f of fs.readdirSync(bin)) fs.chmodSync(path.join(bin, f), 0o755);
    let r = rodar('esperar abc → def: o último reinício foi há 5 min', 'sim');
    igual('interruptor: esperar não para nem mexe no código', [r.status, r.cmds.filter(c => !/is-active/.test(c))], [0, ['git fetch -q']]);
    verdade('interruptor: esperar anota o motivo uma vez', fs.readFileSync(raiz + '/robo/atualizar-espera', 'utf8').includes('5 min'));
    r = rodar('codigo abc → def: nada que o vigia usa', 'sim');
    igual('interruptor: código sem reiniciar: merge, sem stop', r.cmds.filter(c => !/is-active/.test(c)), ['git fetch -q', 'git merge -q']);
    igual('interruptor: grava a versão', fs.readFileSync(raiz + '/robo/versao', 'utf8').trim(), 'v2');
    fs.unlinkSync(raiz + '/robo/versao');
    r = rodar('reiniciar abc → def: robo/vigia-robo.js', 'sim');
    igual('interruptor: reiniciar: stop (o vigia sai com calma) ANTES do merge, depois npm', r.cmds.filter(c => !/is-active/.test(c)), ['git fetch -q', 'systemctl stop robo', 'git merge -q', 'npm install']);
    fs.unlinkSync(raiz + '/robo/versao');
    r = rodar('', 'nao');
    igual('interruptor: sem a decisão (atualizar-robo.js quebrado): como antes, atualiza e liga', r.cmds.filter(c => !/is-active/.test(c)), ['git fetch -q', 'git merge -q', 'npm install', 'systemctl start robo']);
  }

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'todos os ' + total + ' passaram') + ' (atualização sem matar o trabalho)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* segue */ }
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
