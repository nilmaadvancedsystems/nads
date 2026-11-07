// Avisos de falha (07/11/2026): o login do Claude do PC vencido e o pedido do FGTS com erro. Sem Firestore nem celular.
const { vigiaDeLogin, avisoDoPedidoFgts, avisarPedidoFgts } = require('./aviso-de-falha');
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

  console.log((falha ? 'FALHA ' : 'ok: ') + ok + ' testes');
  process.exit(falha ? 1 : 0);
})();
