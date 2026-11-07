// Testes da ponte com o eContador (econtador.js e econtador-api.js, 07/11/2026): a configuração desligada por padrão, a
// entrega do DP (a planilha e o Cadastro), a fila, a gravação na pasta do UpDocs e o cliente da API do ePlugin.
// Rode:  node teste-econtador.js   (sem rede: banco, Drive e fetch falsos; a pasta é uma temporária)
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('./econtador');
const A = require('./econtador-api');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + a + '\n        esperado: ' + b); }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'econtador-'));

// ---- um Firestore de mentira (só o que os módulos usam) ----
function bancoFalso(inicial = {}) {
  const dados = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  let seq = 0;
  const mesclar = (a, b) => {
    const r = Object.assign({}, a);
    for (const [k, v] of Object.entries(b)) r[k] = v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' ? mesclar(r[k], v) : v;
    return r;
  };
  function docRef(col, id) {
    const chave = col + '/' + id;
    return {
      id,
      async get() { const d = dados.get(chave); return { exists: !!d, id, data: () => (d ? JSON.parse(JSON.stringify(d)) : undefined), get: k => (d || {})[k] }; },
      async set(v, op) { dados.set(chave, op && op.merge ? mesclar(dados.get(chave) || {}, v) : JSON.parse(JSON.stringify(v))); },
      async update(v) { if (!dados.has(chave)) throw new Error('não existe ' + chave); dados.set(chave, Object.assign({}, dados.get(chave), JSON.parse(JSON.stringify(v)))); },
    };
  }
  function consulta(col, filtros) {
    return {
      where(campo, op, valor) { return consulta(col, filtros.concat([[campo, op, valor]])); },
      limit() { return this; },
      async get() {
        const docs = [...dados.entries()].filter(([k]) => k.startsWith(col + '/') && k.split('/').length === 2)
          .filter(([, v]) => filtros.every(([c, op, x]) => (op === '==' ? v[c] === x : op === 'in' ? x.includes(v[c]) : true)))
          .map(([k, v]) => { const id = k.split('/')[1]; return { id, ref: docRef(col, id), data: () => JSON.parse(JSON.stringify(v)), get: c => v[c] }; });
        return { docs, size: docs.length, empty: !docs.length };
      },
    };
  }
  return {
    dados,
    collection(col) {
      return Object.assign(consulta(col, []), {
        doc: id => docRef(col, id),
        async add(v) { const id = 'id' + (++seq); dados.set(col + '/' + id, JSON.parse(JSON.stringify(v))); return docRef(col, id); },
      });
    },
  };
}
const ativosFalsos = lista => ({ forEach: f => lista.forEach(c => f({ data: () => c })) });

(async () => {
  // ---- a configuração: tudo desligado por padrão ----
  igual('config: sem documento, tudo desligado', E.configDoEcontador(null, {}), { pasta: { ligado: false, raiz: '', porCliente: false, semEmail: false }, api: { ligado: false } });
  igual('config: semEmail sem a pasta ligada não vale', E.configDoEcontador({ pasta: { semEmail: true } }, {}).pasta.semEmail, false);
  igual('config: "true" em texto não liga', E.configDoEcontador({ pasta: { ligado: 'true' } }, {}).pasta.ligado, false);
  igual('config: a variável do servidor troca a raiz', E.configDoEcontador({ pasta: { ligado: true, raiz: 'D:\\x' } }, { ECONTADOR_PASTA: 'E:\\UpDocs' }).pasta.raiz, 'E:\\UpDocs');
  igual('config: ligada com semEmail', E.configDoEcontador({ pasta: { ligado: true, semEmail: true } }, {}).pasta, { ligado: true, raiz: '', porCliente: false, semEmail: true });

  // ---- a entrega do DP ----
  igual('eContador: grafias', ['eContador', 'econtador', 'E-Contador', ' ECONTADOR '].map(E.ehEcontador), [true, true, true, true]);
  igual('eContador: outras entregas não', ['E-mail', 'Office boy', '', null].map(E.ehEcontador), [false, false, false, false]);
  const planilha = E.entregasDoDpDoCore(fs.readFileSync(path.join(__dirname, '..', 'packages', 'core', 'src', 'empresas', 'dp.ts'), 'utf8'));
  igual('planilha do DP: as 232 linhas', planilha.size, 232);
  igual('planilha do DP: os do eContador', [...planilha.values()].filter(E.ehEcontador).length, 51);
  igual('planilha do DP: 58 recebe pelo eContador, 10 por office boy', [planilha.get(58), planilha.get(10)], ['eContador', 'Office boy']);
  igual('entrega: sem cadastro, a da planilha', E.entregaQueVale('eContador', [], '2026-10'), 'eContador');
  igual('entrega: o Cadastro do nads manda', E.entregaQueVale('eContador', [{ dp: { entrega: 'E-mail' } }], '2026-10'), 'E-mail');
  const porComp = [{ dp: { entrega: 'E-mail', porCompetencia: { '2026-11': { entrega: 'eContador' } } } }];
  igual('entrega: a da competência vale dela em diante', [E.entregaQueVale('', porComp, '2026-10'), E.entregaQueVale('', porComp, '2026-11'), E.entregaQueVale('', porComp, '2026-12')], ['E-mail', 'eContador', 'eContador']);
  igual('entrega: cadastro sem dp, a da planilha', E.entregaQueVale('Malote', [{ nome: 'x' }], '2026-10'), 'Malote');
  const ligado = E.configDoEcontador({ pasta: { ligado: true } }, {});
  igual('decisão: pasta desligada', E.decisao(E.configDoEcontador(null, {}), 'eContador'), E.DESLIGADO);
  igual('decisão: não é do eContador', E.decisao(ligado, 'E-mail'), E.DESLIGADO);
  igual('decisão: eContador com a pasta ligada (e-mail continua)', E.decisao(ligado, 'eContador'), { pasta: true, semEmail: false });

  // ---- os arquivos e os nomes ----
  igual('PDF: só .pdf', ['a.pdf', 'B.PDF', 'c.xlsx', 'd'].map(E.ehPdf), [true, true, false, false]);
  const saida = E.arquivosDaSaida([
    { driveId: 'd1', nome: 'FGTS-GUIA.pdf', tipo: 'FGTS' },
    { driveId: 'd2', nome: 'folha.xlsx', tipo: 'FOLHA' },
    { driveId: '', nome: 'sem-id.pdf' },
    { driveId: 'd3', nome: 'guia.pdf', rotulo: 'DAS' },
  ], { codigo: 58, competencia: '2026-10', empresa: 'TORNEARIA VOLPONI' });
  igual('saída: só PDF com id, com o código na frente', saida, [
    { driveId: 'd1', nome: 'FGTS-GUIA.pdf', destino: '58 - FGTS 10-2026 - TORNEARIA VOLPONI.pdf' },
    { driveId: 'd3', nome: 'guia.pdf', destino: '58 - DAS 10-2026 - TORNEARIA VOLPONI.pdf' },
  ]);
  igual('pasta: na raiz por padrão', E.pastaDoArquivo('R', { codigo: 58, empresa: 'X' }, false), 'R');
  igual('pasta: por cliente, sem caractere proibido', E.pastaDoArquivo('R', { codigo: 58, empresa: 'A/B: C.' }, true), path.join('R', '58 - A B C'));

  // ---- gravar sem sobrescrever ----
  const p1 = await E.gravarSemSobrescrever(tmp, 'g.pdf', Buffer.from('um'));
  igual('gravar: o primeiro', [path.basename(p1.caminho), p1.jaEstava, fs.readFileSync(p1.caminho, 'utf8')], ['g.pdf', false, 'um']);
  igual('gravar: o mesmo conteúdo não duplica', (await E.gravarSemSobrescrever(tmp, 'g.pdf', Buffer.from('um'))).jaEstava, true);
  igual('gravar: outro conteúdo, mesmo nome, vira (2)', path.basename((await E.gravarSemSobrescrever(tmp, 'g.pdf', Buffer.from('dois'))).caminho), 'g (2).pdf');
  igual('gravar: nada de .parcial sobrando', fs.readdirSync(tmp).filter(n => n.endsWith('.parcial')), []);

  let erro = '';
  try { await E.gravarPedido({ arquivos: [] }, { raiz: '', baixar: async () => Buffer.from('x') }); } catch (e) { erro = e.message; }
  igual('pedido: sem raiz configurada, erro claro', /não foi configurada/.test(erro), true);
  erro = '';
  try { await E.gravarPedido({ arquivos: [] }, { raiz: path.join(tmp, 'nao-existe'), baixar: async () => Buffer.from('x') }); } catch (e) { erro = e.message; }
  igual('pedido: a raiz tem de existir (não cria em disco errado)', /não existe/.test(erro), true);
  const raizCli = path.join(tmp, 'por-cliente');
  fs.mkdirSync(raizCli);
  const g = await E.gravarPedido({ codigo: '58', empresa: 'TORNEARIA', arquivos: [{ driveId: 'a', destino: '58 - FGTS 10-2026 - TORNEARIA.pdf' }, { driveId: 'falha', destino: 'x.pdf' }] },
    { raiz: raizCli, porCliente: true, baixar: async id => { if (id === 'falha') throw new Error('404'); return Buffer.from('pdf-' + id); } });
  igual('pedido: grava o que baixou e anota o que falhou', [g.gravados.map(x => x.nome), g.erros], [['58 - FGTS 10-2026 - TORNEARIA.pdf'], [{ nome: 'x.pdf', erro: '404' }]]);
  igual('pedido: na subpasta do cliente', fs.existsSync(path.join(raizCli, '58 - TORNEARIA', '58 - FGTS 10-2026 - TORNEARIA.pdf')), true);

  // ---- a nuvem: decisão e fila ----
  E._limparCache();
  igual('nuvem: sem config/econtador, desligado', await E.decisaoDoDp(bancoFalso(), 58, '2026-10'), E.DESLIGADO);
  E._limparCache();
  igual('nuvem: banco com erro não derruba o envio', await E.decisaoDoDp({ collection() { throw new Error('caiu'); } }, 58, '2026-10'), E.DESLIGADO);
  E._limparCache();
  const dbLigado = bancoFalso({ 'config/econtador': { pasta: { ligado: true, raiz: tmp } }, 'cadastro/x': { codigo: 10, dp: { entrega: 'eContador' } }, 'cadastro/y': { codigo: 58, dp: { entrega: 'E-mail' } } });
  igual('nuvem: 58 pelo eContador na planilha, mas o Cadastro diz e-mail', await E.decisaoDoDp(dbLigado, 58, '2026-10'), E.DESLIGADO);
  igual('nuvem: 10 por office boy na planilha, o Cadastro diz eContador', await E.decisaoDoDp(dbLigado, 10, '2026-10'), { pasta: true, semEmail: false });
  igual('nuvem: 81 (eContador na planilha, sem cadastro)', await E.decisaoDoDp(dbLigado, 81, '2026-10'), { pasta: true, semEmail: false });
  igual('nuvem: 15 (malote) fica de fora', await E.decisaoDoDp(dbLigado, 15, '2026-10'), E.DESLIGADO);
  await dbLigado.collection('solicitacoesEmail').doc('reg1').set({ tipo: 'envioDp' });
  const idFila = await E.anotarSaida(dbLigado, { origem: 'envio-dp', codigo: 81, competencia: '2026-10', empresa: 'CERAMICA', registro: 'reg1', arquivos: [{ driveId: 'd9', nome: 'fgts.pdf', pasta: 'DEPARTAMENTO PESSOAL/10/FGTS' }] });
  const fila = dbLigado.dados.get('econtadorSaida/' + idFila);
  igual('fila: o pedido pendente', [fila.status, fila.codigo, fila.registro, fila.arquivos[0].destino], ['pendente', '81', 'reg1', '81 - FGTS 10-2026 - CERAMICA.pdf']);
  igual('fila: o registro ligado a ela', dbLigado.dados.get('solicitacoesEmail/reg1').econtadorSaida, idFila);
  igual('fila: sem PDF, nada na fila', await E.anotarSaida(dbLigado, { codigo: 81, competencia: '2026-10', arquivos: [{ driveId: 'x', nome: 'a.xlsx' }] }), '');

  // ---- o servidor: a fila -> a pasta ----
  const logs = [];
  const log = (...m) => logs.push(m.join(' '));
  const pedido = dbLigado.dados.get('econtadorSaida/' + idFila);
  igual('servidor: grava e marca "enviado ao eContador (pasta)"', await E.atenderPedido(dbLigado, dbLigado.collection('econtadorSaida').doc(idFila), pedido, { baixar: async () => Buffer.from('%PDF fgts'), log, ambiente: {} }), 'gravado');
  igual('servidor: o arquivo na pasta', fs.readFileSync(path.join(tmp, '81 - FGTS 10-2026 - CERAMICA.pdf'), 'utf8'), '%PDF fgts');
  igual('servidor: a fila gravada', dbLigado.dados.get('econtadorSaida/' + idFila).status, 'gravado');
  igual('servidor: o registro marcado', [dbLigado.dados.get('solicitacoesEmail/reg1').econtador.status, dbLigado.dados.get('solicitacoesEmail/reg1').econtador.arquivos], ['pasta', ['81 - FGTS 10-2026 - CERAMICA.pdf']]);
  // o Drive falhando: tenta de novo até MAX_TENTATIVAS e então marca erro no registro
  await dbLigado.collection('solicitacoesEmail').doc('reg2').set({ tipo: 'envioDp' });
  const id2 = await E.anotarSaida(dbLigado, { codigo: 81, competencia: '2026-10', empresa: 'CERAMICA', registro: 'reg2', arquivos: [{ driveId: 'z', nome: 'b.pdf' }] });
  const ref2 = dbLigado.collection('econtadorSaida').doc(id2);
  for (let k = 0; k < E.MAX_TENTATIVAS; k++) await E.atenderPedido(dbLigado, ref2, dbLigado.dados.get('econtadorSaida/' + id2), { baixar: async () => { throw new Error('Drive fora'); }, log, ambiente: {} });
  igual('servidor: depois das tentativas, erro', [dbLigado.dados.get('econtadorSaida/' + id2).status, dbLigado.dados.get('econtadorSaida/' + id2).tentativas, dbLigado.dados.get('solicitacoesEmail/reg2').econtador.status], ['erro', E.MAX_TENTATIVAS, 'erro']);
  E._limparCache();
  const dbDesligado = bancoFalso({ 'econtadorSaida/p': { status: 'pendente', codigo: '1', arquivos: [{ driveId: 'a', destino: 'nao.pdf' }] } });
  igual('servidor: pasta desligada não grava nada', await E.atenderPedido(dbDesligado, dbDesligado.collection('econtadorSaida').doc('p'), dbDesligado.dados.get('econtadorSaida/p'), { baixar: async () => Buffer.from('x'), log, ambiente: {} }), 'desligado');
  igual('servidor: o pedido continua pendente', dbDesligado.dados.get('econtadorSaida/p').status, 'pendente');

  // ---- DP › Envios: semEmail não manda e-mail, só a fila ----
  E._limparCache();
  const dp = require('./envios-do-dp');
  const dbEnvio = bancoFalso({
    'config/econtador': { pasta: { ligado: true, semEmail: true, raiz: tmp } },
    'usuarios/u1': { roles: ['dp'] },
    'dpArquivos/2026-10': { clientes: { 81: { arquivos: [{ i: 'drv1', n: 'GUIA FGTS.pdf', c: 'DEPARTAMENTO PESSOAL/10/FGTS', s: 10 }] } } },
    'solicitacoesEmail/ped1': { tipo: 'envioDp' },
  });
  let mandou = 0;
  const r = await dp.atenderEnvioDp({ criadoPorUid: 'u1', competencia: '2026-10', codigo: '81' }, {
    db: dbEnvio, log: () => {}, pedidoId: 'ped1', enviar: async () => { mandou++; return 'x'; },
    clientesAtivos: async () => ativosFalsos([{ codigoOrigem: '81', nome: 'CERAMICA MINAS FORTE' }]),
    getDrive: () => { throw new Error('não baixa na nuvem com semEmail'); },
  });
  igual('envio DP semEmail: sem e-mail', mandou, 0);
  igual('envio DP semEmail: via eContador, na fila', [r.status, r.via, r.para, !!r.econtadorSaida], ['enviado', 'econtador', [], true]);
  igual('envio DP semEmail: a fila com o nome do UpDocs', dbEnvio.dados.get('econtadorSaida/' + r.econtadorSaida).arquivos[0].destino, '81 - FGTS 10-2026 - CERAMICA MINAS FORTE.pdf');

  // ---- a API do ePlugin ----
  igual('api: sem token no ambiente', A.tokenDoAmbiente({}), null);
  igual('api: desligada por padrão', A.clienteSeLigado(E.configDoEcontador(null, {}), { ambiente: { ECONTADOR_TOKEN: 'abc' } }).cliente, null);
  igual('api: ligada mas sem token', /ECONTADOR_TOKEN/.test(A.clienteSeLigado(E.configDoEcontador({ api: { ligado: true } }, {}), { ambiente: {} }).motivo), true);
  const pedidos = [];
  const fetchFalso = async (url, op) => {
    pedidos.push({ url, op });
    if (url.includes('/documentos')) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: '7', attributes: { titulo: 'DAS 10/2026', vencimento: '2026-11-20', valor: 1234.56 } }] }) };
    if (url.includes('integracaoAlterdata')) return { ok: true, status: 201, text: async () => JSON.stringify({ data: { id: '540' } }) };
    return { ok: false, status: 401, text: async () => 'token SEGREDO-123 inválido; Authorization: Bearer SEGREDO-123' };
  };
  const { cliente } = A.clienteSeLigado(E.configDoEcontador({ api: { ligado: true } }, {}), { ambiente: { ECONTADOR_TOKEN: 'SEGREDO-123' }, fetch: fetchFalso });
  const docs = await cliente.documentos(42, { limit: 10, filtros: { pago: false } });
  igual('api: a URL dos documentos (JSON:API, filtros codificados)', pedidos[0].url, A.BASE + '/api/v1/integracao/documentos?filter%5BempresaId%5D=42&filter%5Bpago%5D=false&page%5Blimit%5D=10');
  igual('api: o cabeçalho Bearer e o accept JSON:API, sem content-type no GET', [pedidos[0].op.headers.authorization, pedidos[0].op.headers.accept, pedidos[0].op.headers['content-type']], ['Bearer SEGREDO-123', 'application/vnd.api+json', undefined]);
  igual('api: acha a guia pelo vencimento e valor', A.documentoDaGuia(docs.data, { vencimento: '20/11/2026', valor: 1234.56, titulo: 'das' }).id, '7');
  igual('api: valor diferente não acha', A.documentoDaGuia(docs.data, { vencimento: '2026-11-20', valor: 1234.5 }), null);
  igual('api: sem critério não acha qualquer um', A.documentoDaGuia(docs.data, {}), null);
  await cliente.enviarLancamentosContabeis({ nomeArquivo: 'Lançamentos_contabeis_01_10_2026_a_31_10_2026.txt', cnpj: '12.345.678/0001-90', buffer: Buffer.from('1;2') });
  const corpo = JSON.parse(pedidos[1].op.body);
  igual('api: o POST da integração contábil (base64, CNPJ limpo, JSON:API)', [pedidos[1].op.method, pedidos[1].op.headers['content-type'], corpo.data.type, corpo.data.attributes.cnpjremetente, corpo.data.attributes.arquivoBase64, corpo.data.attributes.categoriaId],
    ['POST', 'application/vnd.api+json', 'integracao/integracaoAlterdata', '12345678000190', Buffer.from('1;2').toString('base64'), 1]);
  erro = '';
  try { cliente.enviarLancamentosContabeis({ nomeArquivo: 'guia.pdf', cnpj: '12345678000190', buffer: Buffer.from('x') }); } catch (e) { erro = e.message; }
  igual('api: guia em PDF não vai pela integração contábil', /só aceita o TXT/.test(erro), true);
  erro = '';
  try { await cliente.empresas(); } catch (e) { erro = e.message; }
  igual('api: o erro diz o motivo e nunca mostra o token', [/401/.test(erro), /Master/.test(erro), erro.includes('SEGREDO-123')], [true, true, false]);
  erro = '';
  try { A.criarCliente({ token: '' }); } catch (e) { erro = e.message; }
  igual('api: sem token não cria', /ECONTADOR_TOKEN/.test(erro), true);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(falhas ? '\n' + falhas + ' de ' + total + ' testes FALHARAM' : 'ok: ' + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
