// Testes do envio dos boletos de honorários (boletos-financeiro.js). Rode antes de publicar:  node teste-boletos-financeiro.js
// Não acessa o banco nem o Gmail: um banco de mentira em memória e um "enviar" que só anota o que mandaria.
const fs = require('fs');
const path = require('path');
const B = require('./boletos-financeiro');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- 1. puras ----------
igual('destinatários: limpa, tira repetido e inválido', B.destinatariosValidos([' A@x.com ', 'a@x.com', 'ruim', '', 'b@y.com.br']), ['a@x.com', 'b@y.com.br']);
igual('destinatários: no máximo 10', B.destinatariosValidos(Array.from({ length: 12 }, (_, i) => 'p' + i + '@x.com')).length, 10);
igual('reais', B.reais(1234.5), 'R$ 1.234,50');
igual('reais: sem valor', B.reais(null), '');
igual('data', B.dataBr('2026-11-28'), '28/11/2026');
igual('mês', B.mesDe('2026-10'), 'outubro de 2026');
igual('anexo', B.nomeDoAnexo('ETA: Comércio / Ltda'), 'Boleto de honorários - ETA Comércio Ltda.pdf');
igual('modelo: campos', B.camposDoModelo({ competencia: '2026-10', valor: 780, vencimento: '2026-11-20' }, 'ETA'),
  { cliente: 'ETA', competencia: '10/2026', mes: 'outubro de 2026', valor: 'R$ 780,00', vencimento: '20/11/2026' });
igual('modelo: sem valor lido', B.camposDoModelo({ competencia: '2026-10', valor: null, vencimento: null }, '').valor, 'indicado no boleto');
igual('freio: 59 na hora passa', B.dentroDoFreio(Array(59).fill(1000), 2000), true);
igual('freio: 60 na hora para', B.dentroDoFreio(Array(60).fill(1000), 2000), false);
igual('freio: os de mais de 1h não contam', B.dentroDoFreio(Array(60).fill(0), 36e5 + 1), true);

const naFila = (para, extra) => Object.assign({ contratoId: 'h7', envio: { status: 'fila', para, porUid: 'u1' } }, extra || {});
const trava = { diretor: true, liberado: false, internos: ['nilmacontabilidade@gmail.com'] };
igual('trava: interno passa', B.motivoParaNaoMandar(naFila(['nilmacontabilidade@gmail.com']), trava), '');
igual('trava: cliente não passa', /ainda não foi liberado.*cliente@empresa\.com/.test(B.motivoParaNaoMandar(naFila(['nilmacontabilidade@gmail.com', 'cliente@empresa.com']), trava)), true);
igual('liberado: cliente passa', B.motivoParaNaoMandar(naFila(['cliente@empresa.com']), Object.assign({}, trava, { liberado: true })), '');
igual('liberado para os clientes (10/11/2026)', B.LIBERADO_PARA_CLIENTES, true);
igual('não Diretor', B.motivoParaNaoMandar(naFila(['nilmacontabilidade@gmail.com']), Object.assign({}, trava, { diretor: false })), 'só o Diretor dispara os boletos');
igual('fora do lote', B.motivoParaNaoMandar(naFila(['nilmacontabilidade@gmail.com'], { fora: true }), trava), 'o boleto foi tirado do lote');
igual('sem cliente', B.motivoParaNaoMandar(naFila(['nilmacontabilidade@gmail.com'], { contratoId: '' }), trava), 'o boleto está sem cliente');
igual('sem e-mail', B.motivoParaNaoMandar(naFila(['ruim']), trava), 'sem e-mail válido para mandar');
igual('já enviado', B.motivoParaNaoMandar({ contratoId: 'h7', envio: { status: 'enviado', para: ['nilmacontabilidade@gmail.com'] } }, trava), 'o boleto não está na fila');

// ---------- 2. o envio, num banco de mentira ----------
function bancoDeMentira(dados) {
  const docs = new Map(Object.entries(dados));
  const aplicar = (id, mudar) => {
    const d = JSON.parse(JSON.stringify(docs.get(id) || {}));
    for (const [k, v] of Object.entries(mudar)) {
      const partes = k.split('.');
      let o = d;
      for (const p of partes.slice(0, -1)) o = o[p] = o[p] || {};
      o[partes[partes.length - 1]] = v;
    }
    docs.set(id, d);
  };
  const ref = id => ({
    id, get: async () => ({ data: () => docs.get(id) }), update: async m => aplicar(id, m),
    collection: sub => ({ get: async () => ({ docs: [...docs.entries()].filter(([k]) => k.startsWith(id + '/' + sub + '/')).map(([k, v]) => ({ id: k.split('/').pop(), get: c => v[c] })) }) }),
  });
  return {
    docs,
    collection: c => ({ doc: id => ref(c + '/' + id) }),
    runTransaction: async f => f({ get: r => r.get(), update: (r, m) => aplicar(r.id, m) }),
    ref,
  };
}
const pdf = Buffer.from('%PDF-1.4 boleto de teste');
function banco(para, usuario) {
  return bancoDeMentira({
    'financeiroBoletos/b1': { competencia: '2026-10', contratoId: 'h7', valor: 780, vencimento: '2026-11-20', partes: 1, tamanho: pdf.length, destinatarios: para, envio: { status: 'fila', para, porUid: 'u1', em: '2026-11-10T12:00:00Z' } },
    'financeiroBoletos/b1/partes/0': { dados: pdf },
    'financeiroHonorarios/h7': { nome: 'ETA Comércio', codigo: 7 },
    'usuarios/u1': usuario || { nivel: 'diretor' },
  });
}
(async () => {
  const mandados = [];
  const deps = { log: () => {}, caixa: 'nilmacontabilidade@gmail.com', enviar: async d => { mandados.push(d); return 'gmail-1'; } };

  let db = banco(['nilmacontabilidade@gmail.com']);
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), deps);
  let b = db.docs.get('financeiroBoletos/b1');
  igual('envio interno: enviado', b.envio.status, 'enviado');
  igual('envio interno: gmailId', b.envio.gmailId, 'gmail-1');
  igual('envio interno: um e-mail, para o interno', mandados.map(m => m.para), ['nilmacontabilidade@gmail.com']);
  igual('envio interno: o PDF inteiro no anexo', mandados[0].anexos.map(a => [a.nome, a.mime, a.buffer.equals(pdf)]), [['Boleto de honorários - ETA Comércio.pdf', 'application/pdf', true]]);
  igual('envio interno: assunto', mandados[0].assunto, 'Boleto de honorários · outubro de 2026 · ETA Comércio');
  igual('envio interno: o texto tem o valor e o vencimento', /R\$ 780,00.*20\/11\/2026/.test(mandados[0].corpo), true);
  igual('envio interno: html no desenho com o chip', /Financeiro/.test(mandados[0].html) && /Seu boleto de honorários de outubro chegou/.test(mandados[0].html), true);
  fs.writeFileSync(path.join(require('os').tmpdir(), 'boleto-email.html'), mandados[0].html);

  // de novo: já enviado, nada sai
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), deps);
  igual('disparo repetido não manda outra vez', mandados.length, 1);

  db = banco(['cliente@empresa.com']);
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), deps);
  b = db.docs.get('financeiroBoletos/b1');
  // liberado em 10/11/2026: o e-mail do cliente sai (a trava continua testada acima, pelo motivoParaNaoMandar)
  igual('cliente liberado: enviado', b.envio.status, 'enviado');
  igual('cliente liberado: sai para o cliente', [mandados.length, mandados[1] && mandados[1].para], [2, 'cliente@empresa.com']);

  db = banco(['nilmacontabilidade@gmail.com'], { nivel: 'colaborador', roles: ['admin'] });
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), deps);
  igual('quem não é Diretor: erro, nada sai', [db.docs.get('financeiroBoletos/b1').envio.erro, mandados.length], ['só o Diretor dispara os boletos', 2]);

  db = banco(['nilmacontabilidade@gmail.com']);
  db.docs.delete('financeiroBoletos/b1/partes/0');
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), deps);
  igual('PDF que não chegou inteiro: erro, nada sai', [db.docs.get('financeiroBoletos/b1').envio.status, mandados.length], ['erro', 2]);

  db = banco(['nilmacontabilidade@gmail.com']);
  await B.mandarUm(db, db.ref('financeiroBoletos/b1'), Object.assign({}, deps, { enviar: async () => { throw new Error('Gmail fora'); } }));
  igual('Gmail falhou: erro com a mensagem', [db.docs.get('financeiroBoletos/b1').envio.status, db.docs.get('financeiroBoletos/b1').envio.erro], ['erro', 'Gmail fora']);

  console.log((total - falhas) + ' de ' + total + ' passaram' + (falhas ? '  <<< ' + falhas + ' FALHARAM' : ''));
  process.exit(falhas ? 1 : 0);
})();
