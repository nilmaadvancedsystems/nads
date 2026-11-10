// Testes dos horários (horarios.js) e dos alertas (alertas.js). Nenhum aviso de verdade: o envio é uma função de mentira e o
// banco é de mentira.  node teste-horarios-alertas.js
'use strict';
const h = require('./horarios');
const a = require('./alertas');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const base = { ativo: true, dias: [1, 2, 3, 4, 5], de: '08:00', ate: '18:00' };
// 2026-11-10 é terça. Brasília é UTC-3.
const em = (dia, hora) => Date.parse('2026-11-' + dia + 'T' + hora + ':00-03:00');

igual('sem configuração: nada', h.lerHorario('sieg', undefined), null);
igual('desligado: nada', h.lerHorario('sieg', Object.assign({}, base, { ativo: false })), null);
igual('robô que não aceita horário', h.lerHorario('arquivador', base), null);
igual('robô inventado', h.lerHorario('rm -rf', base), null);
igual('sem dia', h.lerHorario('sieg', Object.assign({}, base, { dias: [] })), null);
igual('dia inválido sai, os outros ficam', h.lerHorario('sieg', Object.assign({}, base, { dias: [9, 1] })).dias, [1]);
igual('hora que não é hora', h.lerHorario('sieg', Object.assign({}, base, { de: '25:00' })), null);
igual('comando na hora', h.lerHorario('sieg', Object.assign({}, base, { de: '08:00; del' })), null);
igual('janela menor que 1 h', h.lerHorario('sieg', Object.assign({}, base, { de: '08:00', ate: '08:30' })), null);
igual('de igual a até', h.lerHorario('sieg', Object.assign({}, base, { de: '08:00', ate: '08:00' })), null);
igual('intervalo só em quem aceita', h.lerHorario('sieg', Object.assign({}, base, { intervaloMin: 60 })).intervaloMin, undefined);
igual('intervalo válido', h.lerHorario('vigia', Object.assign({}, base, { intervaloMin: 60 })).intervaloMin, 60);
igual('intervalo abaixo do mínimo é ignorado', h.lerHorario('vigia', Object.assign({}, base, { intervaloMin: 5 })).intervaloMin, undefined);

const j = h.lerHorario('sieg', base);
igual('terça 12h: dentro', h.dentroDoHorario(j, em('10', '12:00')), true);
igual('terça 07:59: fora', h.dentroDoHorario(j, em('10', '07:59')), false);
igual('terça 18:00: fora (o fim não conta)', h.dentroDoHorario(j, em('10', '18:00')), false);
igual('domingo 12h: fora', h.dentroDoHorario(j, em('08', '12:00')), false);
igual('sem horário: sempre dentro', h.dentroDoHorario(null, em('08', '03:00')), true);
const noite = h.lerHorario('sieg', { ativo: true, dias: [1], de: '22:00', ate: '06:00' });
igual('vira a noite: segunda 23h dentro', h.dentroDoHorario(noite, em('09', '23:00')), true);
igual('vira a noite: terça 05h dentro (começou na segunda)', h.dentroDoHorario(noite, em('10', '05:00')), true);
igual('vira a noite: terça 23h fora', h.dentroDoHorario(noite, em('10', '23:00')), false);

(async () => {
  // o leitor: sem documento, o intervalo de sempre; relê no máximo a cada 5 min
  let leituras = 0, doc = null, erro = false;
  const db = { collection: () => ({ doc: () => ({ get: async () => { leituras++; if (erro) throw new Error('caiu'); return { data: () => doc }; } }) }) };
  const l = h.criarLeitor(db);
  const t0 = em('10', '12:00');
  await l.atualizar(t0);
  igual('leitor: sem documento, roda no intervalo de sempre', l.deveRodar('vigia', t0 - 120 * 60000, 120, t0), true);
  igual('leitor: antes do intervalo, não', l.deveRodar('vigia', t0 - 119 * 60000, 120, t0), false);
  doc = { robos: { vigia: Object.assign({}, base, { intervaloMin: 30 }) } };
  await l.atualizar(t0 + 1000);
  igual('leitor: não relê antes de 5 min', leituras, 1);
  await l.atualizar(t0 + h.LER_A_CADA_MS);
  igual('leitor: intervalo novo vale', l.deveRodar('vigia', t0 - 31 * 60000, 120, t0 + h.LER_A_CADA_MS), true);
  igual('leitor: fora da janela não roda', l.deveRodar('vigia', t0 - 999 * 60000, 120, em('10', '20:00')), false);
  erro = true;
  await l.atualizar(t0 + 2 * h.LER_A_CADA_MS);
  igual('leitor: falhou a leitura, fica o que tinha', l.intervalo('vigia', 120), 30);

  // alertas: o padrão é desligado
  igual('alertas: sem documento, desligado', a.lerAlertas(undefined).ligado, false);
  igual('alertas: ligado só com true', a.lerAlertas({ ligado: 'sim' }).ligado, false);
  igual('alertas: cada evento desligado', [a.lerAlertas({}).erro.ligado, a.lerAlertas({}).semSinal.ligado, a.lerAlertas({}).disco.ligado], [false, false, false]);
  igual('alertas: fora do limite volta ao padrão', [a.lerAlertas({ repetirMin: 1 }).repetirMin, a.lerAlertas({ maxPorHora: 999 }).maxPorHora, a.lerAlertas({ disco: { limite: 10 } }).disco.limite], [60, 6, 90]);
  igual('alertas: uid e robô que não existem saem', [a.lerAlertas({ pessoas: ['ok1', 'a/b'] }).pessoas, a.lerAlertas({ erro: { robos: ['sieg', 'x'] } }).erro.robos], [['ok1'], ['sieg']]);

  const AGORA = em('10', '12:00');
  const iso = (min) => new Date(AGORA - min * 60000).toISOString();
  const cfg = extra => a.lerAlertas(Object.assign({ ligado: true, pessoas: ['u1'], erro: { ligado: true }, semSinal: { ligado: true, minutos: 15, maquinas: ['servidor', 'nuvem', 'escritorio'] }, disco: { ligado: true, limite: 90, maquinas: ['servidor', 'nuvem', 'escritorio'] } }, extra));
  const evs = a.eventosDeErro([{ erro: true, tipo: 'fgts', texto: 'guia A' }, { erro: true, tipo: 'fgts', texto: 'guia B' }, { erro: false, tipo: 'sieg', texto: 'ok' }, { erro: true, tipo: 'sieg', texto: 'x' }], cfg());
  igual('erros: um aviso por robô, com a conta', evs.map(e => [e.chave, e.titulo]), [['erro-fgts', 'FGTS Digital: 2 erros'], ['erro-sieg', 'SIEG: erro']]);
  igual('erros: só os robôs escolhidos', a.eventosDeErro([{ erro: true, tipo: 'sieg', texto: 'x' }], cfg({ erro: { ligado: true, robos: ['fgts'] } })), []);
  const est = { servidor: { em: iso(20), sinais: { disco: 95 } }, escritorio: { em: iso(1), sinais: { disco: 95 } } };
  igual('máquinas: sem sinal, e o disco de quem está quieta não conta', a.eventosDeMaquinas(est, cfg(), AGORA, ['servidor', 'escritorio'], ['servidor', 'escritorio']).map(e => e.chave), ['sinal-servidor', 'disco-escritorio']);
  igual('máquinas: só as escolhidas', a.eventosDeMaquinas(est, cfg({ semSinal: { ligado: true, minutos: 15, maquinas: ['nuvem'] } }), AGORA, ['servidor'], []), []);
  const ev = c => ({ chave: c, titulo: c, corpo: '' });
  igual('repetição: o mesmo assunto espera', a.decidir(cfg({ repetirMin: 60 }), [ev('a')], { chaves: { a: iso(30) } }, AGORA), []);
  igual('repetição: passado o tempo, sai', a.decidir(cfg({ repetirMin: 60 }), [ev('a')], { chaves: { a: iso(61) } }, AGORA).length, 1);
  igual('máximo por hora, somando o que já saiu', a.decidir(cfg({ maxPorHora: 3 }), [ev('a'), ev('b'), ev('c')], { envios: [iso(5), iso(10)] }, AGORA).map(e => e.chave), ['a']);
  igual('máximo por hora: o de mais de 1 h não conta', a.decidir(cfg({ maxPorHora: 2 }), [ev('a'), ev('b')], { envios: [iso(61), iso(90)] }, AGORA).length, 2);
  const depois = a.estadoDepois({ chaves: { velho: iso(10 * 1440), novo: iso(10) }, envios: [iso(61), iso(5)] }, [ev('z')], AGORA, 'x');
  igual('estado: esquece o velho e guarda o novo', [Object.keys(depois.chaves).sort(), depois.envios.length], [['novo', 'z'], 2]);

  // o caminho inteiro, com banco e envio de mentira
  function banco(dados) {
    const lidos = [];
    const ref = (c, id) => ({ get: async () => { lidos.push(c + '/' + id); const d = (dados[c] || {})[id]; return { exists: !!d, data: () => d }; }, set: async d => { (dados[c] = dados[c] || {})[id] = d; } });
    return { lidos, collection: c => ({ doc: id => ref(c, id), where: (f, op, v) => ({ limit: () => ({ get: async () => { lidos.push(c + ' consulta'); return { docs: Object.values(dados[c] || {}).filter(d => d[f] > v).map(d => ({ data: () => d })) }; } }) }) }) };
  }
  const ligar = (dados, maquina) => { const enviados = []; const db = banco(dados); const v = a.iniciarAlertas({ db, maquina, enviarPara: async (...x) => { enviados.push(x); return 1; } }); v.parar(); return { db, enviados, v }; };
  const maquinas = { servidor: { em: iso(30), sinais: { disco: 50 } }, nuvem: { em: iso(30), sinais: { disco: 50 } } };
  const atividade = { x: { em: iso(1), erro: true, tipo: 'fgts', texto: 'A guia não saiu' }, velho: { em: iso(400), erro: true, tipo: 'sieg', texto: 'de ontem' } };
  {
    const { db, enviados, v } = ligar({ robosMaquinas: maquinas, roboAtividade: atividade }, 'nuvem');
    await v.tique(AGORA);
    igual('fim a fim: sem documento, nenhum aviso', enviados, []);
    igual('fim a fim: sem documento, só uma leitura', db.lidos, ['config/robosAlertas']);
  }
  {
    const { enviados, v } = ligar({ config: { robosAlertas: { ligado: true, pessoas: [], erro: { ligado: true } } }, roboAtividade: atividade }, 'nuvem');
    await v.tique(AGORA);
    igual('fim a fim: ligado sem ninguém, nenhum aviso', enviados, []);
  }
  {
    const cfgDoc = { ligado: true, pessoas: ['u1'], atualizadoEm: iso(60), erro: { ligado: true }, semSinal: { ligado: true, minutos: 15, maquinas: ['servidor', 'nuvem'] } };
    const dados = { config: { robosAlertas: cfgDoc }, robosMaquinas: maquinas, roboAtividade: atividade };
    const { enviados, v } = ligar(dados, 'nuvem');
    await v.tique(AGORA);
    igual('fim a fim: o erro novo e a máquina sem sinal saem', enviados.map(e => e[1]).sort(), ['FGTS Digital: erro', 'Servidor sem sinal']);
    igual('fim a fim: para quem foi escolhido', enviados[0][0], ['u1']);
    igual('fim a fim: o erro de ontem não sai', enviados.some(e => /SIEG/.test(e[1])), false);
    await v.tique(AGORA + 5 * 60000);
    igual('fim a fim: 5 min depois, o sem sinal não repete', enviados.length, 2);
    await v.tique(AGORA + 61 * 60000);
    igual('fim a fim: depois do tempo de repetir, avisa de novo', enviados.filter(e => /sem sinal/.test(e[1])).length, 2);
  }
  {
    const cfgDoc = { ligado: true, pessoas: ['u1'], erro: { ligado: true }, semSinal: { ligado: true, minutos: 15, maquinas: ['servidor', 'nuvem'] } };
    const { enviados, v } = ligar({ config: { robosAlertas: cfgDoc }, robosMaquinas: maquinas, roboAtividade: atividade }, 'servidor');
    await v.tique(AGORA);
    igual('servidor: só avisa da nuvem', enviados.map(e => e[1]), ['Nuvem sem sinal']);
  }
  {
    const { enviados, v } = ligar({ config: { robosAlertas: { ligado: true, pessoas: ['u1'], semSinal: { ligado: true, minutos: 15, maquinas: ['nuvem'] } } }, robosMaquinas: maquinas }, 'escritorio');
    await v.tique(AGORA);
    igual('PC do escritório: não vigia nada', enviados, []);
  }
  console.log(falhas ? falhas + ' de ' + total + ' FALHARAM' : 'ok: ' + total + ' testes de horários e alertas');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
