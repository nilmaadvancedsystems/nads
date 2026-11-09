// Avisos de falha (07/11/2026): o login do Claude do PC vencido e o pedido do FGTS com erro. Sem Firestore nem celular.
const { vigiaDeLogin, avisoDoPedidoFgts, avisarPedidoFgts, juntarAvisosFgts, agrupadorDeAvisosFgts, chaveDoMotivo } = require('./aviso-de-falha');
let ok = 0, falha = 0;
const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const MIN = 60000, H = 3600000;
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  // --- o login vencido ---
  let t = 1000000, avisos = [];
  const v = vigiaDeLogin({ agora: () => t, avisar: (titulo, corpo) => { avisos.push(titulo); } });
  igual('começa sem vencer', v.estaVencido(), false);
  igual('voltou sem ter vencido não avisa', v.voltou(), false);
  const esperas = [];
  for (let i = 0; i < 6; i++) { esperas.push(v.vencido() / MIN); t += 10 * MIN; }
  await tick();
  igual('espera cresce de 10 min até 1 h', esperas, [10, 20, 40, 60, 60, 60]);
  igual('avisou só na primeira vez', avisos.length, 1);
  igual('texto do primeiro aviso', /parado/.test(avisos[0]), true);
  t += 25 * H; v.vencido(); await tick();
  igual('depois de 1 dia avisa de novo', avisos.length, 2);
  t += 2 * H; v.vencido(); t += 2 * H; v.vencido(); await tick();
  igual('antes de outro dia não repete', avisos.length, 2);
  igual('está vencido', v.estaVencido(), true);
  igual('voltou avisa', v.voltou(), true); await tick();
  igual('aviso de voltou', [avisos.length, /voltou/.test(avisos[2])], [3, true]);
  igual('depois de voltar não está vencido', v.estaVencido(), false);
  igual('voltou de novo não repete', v.voltou(), false);
  // vencer outra vez depois de voltar: aviso imediato e a espera recomeça em 10 min
  t += MIN; igual('recomeça em 10 min', v.vencido() / MIN, 10); await tick();
  igual('novo vencimento avisa na hora', avisos.length, 4);
  // aviso que falha não derruba nada
  const logs = [];
  const v2 = vigiaDeLogin({ log: (...m) => logs.push(m.join(' ')), avisar: () => { throw new Error('sem rede'); } });
  igual('aviso que falha ainda devolve a espera', v2.vencido(), 10 * MIN); await tick();
  igual('e registra no log', logs.length, 1);

  // --- o pedido do FGTS ---
  const base = { status: 'erro', cnpj: '12345678000195', empresa: 'EMPRESA X', competencia: '2026-10', criadoPorUid: 'u1', erro: 'o gov.br pediu a verificação "não sou um robô" no Chrome do PC' };
  const a = avisoDoPedidoFgts(base);
  igual('aviso traz empresa, CNPJ, mês e motivo', [/EMPRESA X/.test(a.corpo), /12\.345\.678\/0001-95/.test(a.corpo), /10\/2026/.test(a.corpo), /não sou um robô/.test(a.corpo)], [true, true, true, true]);
  igual('vai para quem pediu', a.uid, 'u1');
  igual('pedido que não é erro: nada', avisoDoPedidoFgts({ status: 'pronto' }), null);
  igual('já avisado: nada', avisoDoPedidoFgts(Object.assign({}, base, { avisadoErroEm: 'x' })), null);
  igual('sem débito é resposta normal: nada', avisoDoPedidoFgts(Object.assign({}, base, { erro: 'sem débito em aberto na competência' })), null);
  igual('sem empresa usa o CNPJ', /^12\.345/.test(avisoDoPedidoFgts({ status: 'erro', cnpj: '12345678000195', erro: 'x' }).corpo), true);

  const chamadas = [];
  const envio = (chegaAoUsuario) => ({
    enviarPara: async (uids, ti, co, tag) => { chamadas.push(['para', uids.join(), tag]); return chegaAoUsuario ? 1 : 0; },
    enviar: async (papel, menos, ti, co, tag) => { chamadas.push([papel, tag]); return 2; },
  });
  await avisarPedidoFgts(envio(true), a, 'p1');
  igual('quem pediu recebeu: não chama o admin', chamadas, [['para', 'u1', 'fgts-erro-p1']]);
  chamadas.length = 0;
  await avisarPedidoFgts(envio(false), a, 'p2');
  igual('quem pediu sem aparelho: cai no admin', chamadas, [['para', 'u1', 'fgts-erro-p2'], ['admin', 'fgts-erro-p2']]);
  chamadas.length = 0;
  await avisarPedidoFgts(envio(true), Object.assign({}, a, { uid: '' }), 'p3');
  igual('sem responsável: vai direto ao admin', chamadas, [['admin', 'fgts-erro-p3']]);

  // --- os erros juntos (08/11/2026: 25 pedidos com o mesmo login = 25 notificações) ---
  const login = 'o robô não conseguiu entrar no gov.br com o certificado do escritório (Chrome do NILMA-SERVER)';
  const pedido = (i, extra = {}) => Object.assign({ status: 'erro', cnpj: String(10000000000100 + i).padStart(14, '0'), empresa: 'EMPRESA ' + i, competencia: '2026-10', criadoPorUid: 'savio', erro: login + ': ficou em sso.acesso.gov.br/login; cliquei ' + (1 + i % 3) + ' vez(es)' }, extra);
  const itens = [];
  for (let i = 1; i <= 25; i++) itens.push({ id: 'p' + i, aviso: avisoDoPedidoFgts(pedido(i)) });
  itens.push({ id: 'x1', aviso: avisoDoPedidoFgts(pedido(30, { erro: 'sem procuração no FGTS Digital para este CNPJ (o portal disse: x)' })) });
  itens.push({ id: 'y1', aviso: avisoDoPedidoFgts(pedido(31, { criadoPorUid: 'outra' })) });
  const grupos = juntarAvisosFgts(itens);
  igual('25 do mesmo motivo + 1 outro motivo + 1 outra pessoa = 3 avisos', grupos.map(g => g.ids.length), [25, 1, 1]);
  const g25 = grupos[0];
  igual('título com a contagem', g25.aviso.titulo, 'FGTS: 25 guias não saíram');
  igual('corpo: o motivo e as 3 primeiras empresas', [g25.aviso.corpo.startsWith(login), /EMPRESA 1, EMPRESA 2, EMPRESA 3 e mais 22$/.test(g25.aviso.corpo)], [true, true]);
  igual('vai para quem pediu', g25.aviso.uid, 'savio');
  igual('o detalhe que muda entre lotes não separa o aviso', g25.ids.slice(0, 3), ['p1', 'p2', 'p3']);
  igual('pedido sozinho fica com o aviso de um', [grupos[1].aviso.titulo, grupos[1].id], ['FGTS: a guia não saiu', 'x1']);
  igual('outra pessoa recebe o seu', grupos[2].aviso.uid, 'outra');
  igual('chave do motivo ignora o detalhe e o " · aviso"', chaveDoMotivo(login + ': a · b'), chaveDoMotivo(login + ': c'));

  // o agrupador com relógio falso: os lotes de 08/11 (1, 12, 12, 9 erros, um a cada ~95 s) viram um aviso só
  let agoraFalso = 0;
  const timers = [];
  const relogio = { setTimeout: (f, ms) => { const t = { f, em: agoraFalso + ms, vivo: true }; timers.push(t); return t; }, clearTimeout: t => { if (t) t.vivo = false; } };
  const andar = async ms => {
    const fim = agoraFalso + ms;
    for (;;) {
      const prox = timers.filter(t => t.vivo && t.em <= fim).sort((a, b) => a.em - b.em)[0];
      if (!prox) break;
      agoraFalso = prox.em; prox.vivo = false; prox.f(); await tick(); await tick();
    }
    agoraFalso = fim; await tick();
  };
  let filaOcupada = true;
  const enviados = [], marcados = [];
  const ag = agrupadorDeAvisosFgts({ agora: () => agoraFalso, relogio, ocupado: () => filaOcupada, enviar: async (av, id) => { enviados.push([av.titulo, id]); }, aoAvisar: async ids => { marcados.push(...ids); } });
  let n = 0;
  const lote = q => { for (let i = 0; i < q; i++) { n++; ag.adicionar('p' + n, avisoDoPedidoFgts(pedido(n))); } };
  lote(1); await andar(95000);
  igual('fila ainda trabalhando: segura', enviados.length, 0);
  lote(12); await andar(95000); lote(12); await andar(95000); lote(9);
  filaOcupada = false;
  await andar(59000);
  igual('antes de 1 min sem erro novo: segura', enviados.length, 0);
  await andar(2000);
  igual('fila parou e 1 min sem erro: um aviso só', enviados, [['FGTS: 34 guias não saíram', 'lote-p1']]);
  igual('todos os pedidos marcados (avisadoErroEm)', marcados.length, 34);
  // a fila que não para: solta no máximo em 10 min
  enviados.length = 0; filaOcupada = true;
  ag.adicionar('q1', avisoDoPedidoFgts(pedido(1)));
  await andar(9 * 60000);
  igual('fila ocupada por 9 min: ainda segura', enviados.length, 0);
  await andar(61000);
  igual('10 min: solta mesmo com a fila ocupada', enviados, [['FGTS: a guia não saiu', 'q1']]);
  // envio que falha não derruba e não marca
  const falhas = []; marcados.length = 0;
  const ag2 = agrupadorDeAvisosFgts({ agora: () => agoraFalso, relogio, enviar: async () => { throw new Error('sem rede'); }, aoAvisar: async ids => { marcados.push(...ids); }, aoFalhar: (e, ids) => falhas.push(ids.length) });
  ag2.adicionar('z1', avisoDoPedidoFgts(pedido(1))); ag2.adicionar('z2', avisoDoPedidoFgts(pedido(2)));
  await andar(61000);
  igual('falha no envio: registra e não marca', [falhas, marcados.length], [[2], 0]);

  console.log((falha ? 'FALHA ' : 'ok: ') + ok + ' testes');
  process.exit(falha ? 1 : 0);
})();
