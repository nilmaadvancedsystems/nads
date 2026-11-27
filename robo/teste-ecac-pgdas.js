// Testes do robô do PGDAS-D no e-CAC (ecac-pgdas.js) sem banco e sem portal: um portal de mentira, pedidos de mentira e o
// relógio na mão. Confere a janela das 23h às 8h, os 35 s entre trocas de perfil, a verificação de robô que para o lote,
// o CNPJ que não bate, o ensaio que não grava nada e o caminho inteiro. Todos os dados são inventados.
//   node teste-ecac-pgdas.js
'use strict';
const path = require('path');
const R = require('./ecac-pgdas');
const catalogo = require('../packages/core/src/robos/catalogo.json');
const central = require('./central');
const painel = require('./painel');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const verdade = (nome, v) => igual(nome, !!v, true);

const CNPJ = '99888777000166';
const extratoFicticio = (pa, cnpj = '99.888.777/0001-66', rpa = '46.678,90') => 'Extrato do Simples Nacional Período de Apuração (PA): ' + pa +
  ' Número da Declaração: 99888777' + pa.slice(3) + pa.slice(0, 2) + '001 Data/hora da transmissão: 18/11/2026 14:05:31 CNPJ Matriz: ' + cnpj +
  ' Nome empresarial: PADARIA FICTICIA LTDA Data de abertura no CNPJ: 02/03/2015 2) Discriminativo de Receitas' +
  ' Receita Bruta do PA (RPA) - Competência ' + rpa + ' 0,00 ' + rpa +
  ' Receita bruta acumulada nos doze meses anteriores ao PA (RBT12) 512.345,67 0,00 512.345,67' +
  ' 2.2) Receitas Brutas Anteriores (R$) 2.2.1) Mercado Interno 08/2026 09/2026 40.000,00 41.000,00 2.2.2) Mercado Externo 08/2026 09/2026 0,00 0,00 2.3) Folha';
const PDF = Buffer.from('%PDF-1.4 de mentira');

function pedido(id, dados) {
  const ref = { id, atualizacoes: [], update: async o => { ref.atualizacoes.push(o); Object.assign(ref.estado, o); } };
  ref.estado = Object.assign({ status: 'pendente' }, dados);
  return { ref, dados };
}
const base = (extra = {}) => Object.assign({ status: 'pendente', modo: 'extrato', cnpj: CNPJ, codigo: 9001, empresa: 'PADARIA FICTICIA', competencia: '2026-10', criadoEm: '2026-11-25T10:00:00Z' }, extra);

function portalDeMentira(o = {}) {
  const chamadas = [];
  return {
    chamadas,
    entrar: async () => { chamadas.push('entrar'); return o.entrada || ''; },
    trocarPerfil: async cnpj => { chamadas.push('perfil ' + cnpj); return (o.perfil && o.perfil(cnpj)) || ''; },
    baixarExtrato: async c => { chamadas.push('extrato ' + c); return o.baixar ? o.baixar(c) : { bytes: PDF }; },
    ensaio: async c => { chamadas.push('ensaio ' + c); return { achouOMes: true, passos: [{ em: 'x', texto: 'lista do ano' }] }; },
  };
}

/** o lote com o relógio na mão: `relogio.t` anda com o dormir */
function contexto(pedidos, portal, extra = {}) {
  const relogio = { t: Date.parse('2026-11-25T23:30:00-03:00'), dormiu: [] };
  const banco = new Map();
  const pdfs = [];
  const o = Object.assign({
    pedidos, portal, log: () => {},
    agora: () => relogio.t,
    dormir: async ms => { relogio.dormiu.push(ms); relogio.t += ms; },
    lerPgdas: async codigo => banco.get(codigo) || null,
    gravarPgdas: async (codigo, doc) => { banco.set(codigo, doc); },
    textoDoPdf: async () => extratoFicticio('10/2026'),
    gravarPdf: async (p, bytes) => { pdfs.push([p.codigo, bytes.length]); return '2026-10/9001 - PADARIA FICTICIA/x.pdf'; },
  }, extra);
  return { o, relogio, banco, pdfs };
}

(async () => {
  // ---------- funções puras ----------
  igual('pedido bom', R.motivoDoPedidoRuim(base()), '');
  verdade('pedido sem CNPJ', /CNPJ/.test(R.motivoDoPedidoRuim(base({ cnpj: '123' }))));
  verdade('pedido com modo estranho', /modo/.test(R.motivoDoPedidoRuim(base({ modo: 'apagar' }))));
  verdade('pedido com competência ruim', /competência/.test(R.motivoDoPedidoRuim(base({ competencia: '2026-13' }))));
  igual('a fila: o "na frente" primeiro, depois o mais antigo',
    R.ordemDaFila([{ dados: { criadoEm: '2' } }, { dados: { criadoEm: '3', naFrente: true } }, { dados: { criadoEm: '1' } }]).map(x => x.dados.criadoEm), ['3', '1', '2']);
  igual('o nome do PDF', R.nomeDoPdf(58, '2026-10'), 'PGDAS-D EXTRATO 10-2026 58.pdf');
  igual('a pasta de entrada do arquivador', R.pastaDeEntrada('G:\\CS', '2026-10', 58, 'PADARIA: "X"'), path.join('G:\\CS', '2026-10', '58 - PADARIA X'));
  igual('depois da verificação de robô, só na próxima noite (23h do dia seguinte)', new Date(R.proximaNoite(Date.parse('2026-11-25T23:30:00-03:00'))).toISOString(), '2026-11-27T02:00:00.000Z');

  // ---------- o caminho inteiro ----------
  {
    const p1 = pedido('a', base());
    const portal = portalDeMentira();
    const { o, banco, pdfs } = contexto([p1], portal);
    const r = await R.atenderLote(o);
    igual('extrato: um feito', r.feitos, 1);
    igual('extrato: o portal entrou, trocou o perfil e baixou', portal.chamadas, ['entrar', 'perfil ' + CNPJ, 'extrato 2026-10']);
    igual('extrato: o pedido ficou pronto', p1.ref.estado.status, 'pronto');
    igual('extrato: o resultado traz a receita e a RBT12', [p1.ref.estado.resultado.receita, p1.ref.estado.resultado.rbt12, p1.ref.estado.resultado.meses], [46678.9, 512345.67, 3]);
    igual('extrato: o resumo da empresa tem o mês e os anteriores', Object.keys(banco.get(9001).meses), ['2026-08', '2026-09', '2026-10']);
    igual('extrato: o PDF foi para o arquivador', pdfs, [[9001, PDF.length]]);
  }

  // ---------- fora da janela: não entra no portal ----------
  {
    const p1 = pedido('a', base());
    const portal = portalDeMentira();
    const { o, relogio } = contexto([p1], portal);
    relogio.t = Date.parse('2026-11-25T14:00:00-03:00');
    const r = await R.atenderLote(o);
    igual('de dia: nem entra no e-CAC', portal.chamadas, []);
    igual('de dia: para pela janela', r.parouPor, 'janela');
    igual('de dia: espera até as 23h', new Date(r.esperarAte).toISOString(), '2026-11-26T02:00:00.000Z');
    igual('de dia: o pedido continua pendente', p1.ref.estado.status, 'pendente');
  }
  {
    // a janela fecha no meio do lote: o que falta espera
    const p1 = pedido('a', base()), p2 = pedido('b', base({ codigo: 9002 }));
    const portal = portalDeMentira();
    const { o, relogio } = contexto([p1, p2], portal);
    relogio.t = Date.parse('2026-11-26T07:59:40-03:00');
    const r = await R.atenderLote(o);
    igual('às 8h: o primeiro sai, o segundo espera', [p1.ref.estado.status, p2.ref.estado.status, r.parouPor], ['pronto', 'pendente', 'janela']);
  }

  // ---------- 35 s entre as trocas de perfil ----------
  {
    const ps = [pedido('a', base()), pedido('b', base({ codigo: 9002 })), pedido('c', base({ codigo: 9003 }))];
    const { o, relogio } = contexto(ps, portalDeMentira());
    await R.atenderLote(o);
    igual('35 s entre um perfil e outro', relogio.dormiu, [35000, 35000]);
  }

  // ---------- a verificação de robô para o lote ----------
  {
    const p1 = pedido('a', base());
    const portal = portalDeMentira({ entrada: 'captcha' });
    const { o } = contexto([p1], portal);
    const r = await R.atenderLote(o);
    igual('captcha: não troca perfil nem baixa', portal.chamadas, ['entrar']);
    igual('captcha: para e espera a próxima noite', [r.parouPor, new Date(r.esperarAte).toISOString()], ['captcha', '2026-11-27T02:00:00.000Z']);
    igual('captcha: o pedido continua pendente, com o aviso', [p1.ref.estado.status, /não sou um robô/.test(p1.ref.estado.aviso)], ['pendente', true]);
  }

  // ---------- o CNPJ que não bate: nada é gravado ----------
  {
    const p1 = pedido('a', base());
    const { o, banco, pdfs } = contexto([p1], portalDeMentira(), { textoDoPdf: async () => extratoFicticio('10/2026', '11.222.333/0001-81') });
    await R.atenderLote(o);
    igual('outro CNPJ: erro, sem tentar de novo', [p1.ref.estado.status, /outro CNPJ/.test(p1.ref.estado.erro)], ['erro', true]);
    igual('outro CNPJ: nada no banco nem no Drive', [banco.size, pdfs.length], [0, 0]);
  }

  // ---------- o extrato de outro mês, o arquivo que não é PDF, a falta de procuração ----------
  {
    const p1 = pedido('a', base());
    const { o } = contexto([p1], portalDeMentira(), { textoDoPdf: async () => extratoFicticio('09/2026') });
    await R.atenderLote(o);
    igual('outro mês: volta para a fila (até 3 tentativas)', [p1.ref.estado.status, /2026-09/.test(p1.ref.estado.erro)], ['pendente', true]);
  }
  {
    const p1 = pedido('a', base({ tentativas: 2 }));
    const { o } = contexto([p1], portalDeMentira({ baixar: () => ({ bytes: Buffer.from('<html>sessão expirada</html>') }) }));
    await R.atenderLote(o);
    igual('não é PDF, na 3ª tentativa: erro', [p1.ref.estado.status, p1.ref.estado.erro], ['erro', 'o arquivo baixado não é um PDF']);
  }
  {
    const p1 = pedido('a', base());
    const { o } = contexto([p1], portalDeMentira({ perfil: () => 'sem procuração no e-CAC para ' + CNPJ }));
    await R.atenderLote(o);
    igual('sem procuração: erro direto (tentar de novo não resolve)', p1.ref.estado.status, 'erro');
  }

  // ---------- a tela vai para o pedido quando algo não fecha (27/11/2026) ----------
  {
    const p1 = pedido('a', base());
    const portal = Object.assign(portalDeMentira({ perfil: () => 'não achei o "Alterar perfil de acesso" no e-CAC' }), { diagnostico: async () => 'https://cav.receita.fazenda.gov.br/ecac/ · Bem-vindo' });
    const { o } = contexto([p1], portal);
    await R.atenderLote(o);
    verdade('falhou: a tela de agora fica nos passos do pedido', p1.ref.estado.passos.some(s => /^tela: https:\/\/cav/.test(s.texto)));
  }
  {
    const p1 = pedido('a', base());
    const portal = Object.assign(portalDeMentira({ entrada: 'login' }), { diagnostico: async () => 'https://cav.receita.fazenda.gov.br/autenticacao/login · eCAC' });
    const { o } = contexto([p1], portal);
    const r = await R.atenderLote(o);
    igual('o login não fechou: para a noite e guarda a tela no pedido', [r.parouPor, /autenticacao/.test(p1.ref.estado.tela)], ['login', true]);
  }

  // ---------- o ensaio não grava nada ----------
  {
    const p1 = pedido('a', base({ modo: 'ensaio' }));
    const portal = portalDeMentira();
    const { o, banco, pdfs } = contexto([p1], portal);
    await R.atenderLote(o);
    igual('ensaio: troca o perfil e só olha', portal.chamadas, ['entrar', 'perfil ' + CNPJ, 'ensaio 2026-10']);
    igual('ensaio: pronto, sem banco e sem Drive', [p1.ref.estado.status, p1.ref.estado.resultado.ensaio, banco.size, pdfs.length], ['pronto', true, 0, 0]);
  }

  // ---------- o lote da noite (26/11/2026) ----------
  igual('a noite: às 23h30 é a do próprio dia', R.noiteDe(Date.parse('2026-11-26T23:30:00-03:00')), '2026-11-26');
  igual('a noite: às 3h é a do dia anterior', R.noiteDe(Date.parse('2026-11-27T03:00:00-03:00')), '2026-11-26');
  igual('a competência: depois do dia 20, o mês anterior', R.competenciaAlvo(Date.parse('2026-11-26T23:30:00-03:00')), '2026-10');
  igual('a competência: até o dia 20, o mês retrasado', R.competenciaAlvo(Date.parse('2026-11-20T23:30:00-03:00')), '2026-09');
  igual('a competência: em janeiro, volta o ano', R.competenciaAlvo(Date.parse('2027-01-10T23:30:00-03:00')), '2026-11');
  {
    const emp = (codigo, regime, cnpj = '99888777000' + String(100 + codigo).slice(-3)) => ({ codigo, nome: 'EMPRESA ' + codigo, cnpj, regime });
    const empresas = [emp(1, 'Simples'), emp(2, 'Presumido'), emp(3, 'MEI'), emp(4, 'Simples', '123'), emp(5, 'Simples'), emp(6, 'Simples'), emp(7, 'Simples'), emp(8, 'Simples')];
    const resumos = new Map([
      [5, { consultadoEm: '2026-11-01T02:00:00Z', meses: { '2026-09': { origem: 'extrato' } } }],
      [6, { consultadoEm: '2026-10-01T02:00:00Z', meses: { '2026-10': { origem: 'anteriores' } } }],
      [7, { consultadoEm: '2026-11-25T02:00:00Z', meses: { '2026-10': { origem: 'extrato' } } }],
    ]);
    const plano = R.planoDaNoite({ empresas, resumos, naFila: new Set([8]), competencia: '2026-10', limite: 10 });
    igual('o lote: só o Simples com CNPJ, sem quem já tem o extrato do mês nem quem está na fila; primeiro quem nunca foi consultado',
      plano.map(p => p.codigo), [1, 6, 5]);
    igual('o lote: o pedido no formato do robô', R.motivoDoPedidoRuim(plano[0]), '');
    igual('o lote: extrato da competência', [plano[0].modo, plano[0].competencia], ['extrato', '2026-10']);
    igual('o lote: no máximo o limite', R.planoDaNoite({ empresas, resumos, naFila: new Set(), competencia: '2026-10', limite: 2 }).length, 2);
    igual('o lote por noite é de 20', R.LOTE_POR_NOITE, 20);
  }
  verdade('o lote não começa antes do caminho do portal ser provado', /não foi provado/.test(R.motivoParaNaoPedir({ temResumo: false, ensaioAchou: false, ontem: null })));
  igual('o lote começa depois de um ensaio que achou o mês', R.motivoParaNaoPedir({ temResumo: false, ensaioAchou: true, ontem: null }), '');
  verdade('o lote para se a noite anterior só deu erro', /só deu erro/.test(R.motivoParaNaoPedir({ temResumo: true, ensaioAchou: true, ontem: { total: 20, prontos: 0, erros: 18 } })));
  igual('o lote segue se a noite anterior teve algum pronto', R.motivoParaNaoPedir({ temResumo: true, ensaioAchou: true, ontem: { total: 20, prontos: 5, erros: 15 } }), '');

  // ---------- o robô na Central dos robôs ----------
  const doCatalogo = catalogo.robos.find(r => r.id === 'pgdas');
  verdade('o catálogo tem o robô do PGDAS-D, no servidor', doCatalogo && doCatalogo.maquina === 'servidor');
  igual('o catálogo e o robô usam a mesma coleção', doCatalogo && doCatalogo.itens.colecao, R.COLECAO);
  igual('os pedidos do catálogo são os que a central sabe fazer', (doCatalogo ? doCatalogo.pedidos : []).map(p => p.id).sort(),
    Object.keys(central.PEDIDOS_POR_CLIENTE).filter(k => k.startsWith('pgdas:')).map(k => k.slice(6)).sort());
  igual('o pedido da central sai no formato do robô', R.motivoDoPedidoRuim(central.PEDIDOS_POR_CLIENTE['pgdas:extrato'].modelo({ codigo: '9001', nome: 'X', documento: CNPJ }, { competencia: '2026-10' })), '');
  verdade('a fila do painel é a do catálogo', painel.FILAS.pc.some(f => f.id === 'pgdas' && f.colecao === R.COLECAO));

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'ok: ' + total + ' testes do robô do PGDAS-D'));
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
