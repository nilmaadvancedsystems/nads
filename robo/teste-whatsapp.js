// Testes do WhatsApp do robô pronto para o chip (whatsapp.js, 27/11/2026). Rode antes de publicar:  node teste-whatsapp.js
// Não conecta nada: um banco em memória, um "socket" que só anota o que mandaria (no formato da Baileys) e um Drive de
// mentira. As mensagens que chegam são exemplos do messages.upsert da Baileys 7 (texto, PDF, LID, grupo).
const fs = require('fs');
const os = require('os');
const path = require('path');
const Z = require('./whatsapp');
const W = require('./gerado/whatsapp');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
function verdade(nome, v) { igual(nome, !!v, true); }

// ---------- o banco em memória (só o que o whatsapp.js usa) ----------
function bancoFalso(inicial) {
  const docs = new Map(Object.entries(inicial || {}));
  let seq = 0;
  const snapDoc = (p) => {
    const d = docs.get(p);
    return { id: p.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))), get: k => (d ? d[k] : undefined), ref: refDoc(p) };
  };
  const juntar = (a, b) => {
    const r = Object.assign({}, a);
    for (const [k, v] of Object.entries(b)) r[k] = v && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v) && r[k] && typeof r[k] === 'object' ? juntar(r[k], v) : v;
    return r;
  };
  function refDoc(p) {
    return {
      id: p.split('/').pop(), path: p,
      get: async () => snapDoc(p),
      set: async (d, o) => { docs.set(p, o && o.merge ? juntar(docs.get(p) || {}, d) : d); },
      update: async d => {
        const atual = Object.assign({}, docs.get(p) || {});
        for (const [k, v] of Object.entries(d)) {
          const partes = k.split('.');
          let alvo = atual;
          for (const x of partes.slice(0, -1)) { alvo[x] = Object.assign({}, alvo[x] || {}); alvo = alvo[x]; }
          alvo[partes[partes.length - 1]] = v;
        }
        docs.set(p, atual);
      },
      collection: n => colecao(p + '/' + n),
    };
  }
  function colecao(c, filtros) {
    const f = filtros || [];
    return {
      doc: id => refDoc(c + '/' + id),
      add: async d => { const id = 'novo' + (++seq); docs.set(c + '/' + id, d); return refDoc(c + '/' + id); },
      where: (campo, op, valor) => colecao(c, f.concat([[campo, valor]])),
      get: async () => {
        const lista = [...docs.keys()].filter(k => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/'))
          .filter(k => f.every(([campo, valor]) => docs.get(k)[campo] === valor)).sort().map(snapDoc);
        return { docs: lista, size: lista.length, forEach: fn => lista.forEach(fn) };
      },
    };
  }
  return { collection: colecao, doc: refDoc, _docs: docs };
}

// ---------- o socket e o Drive de mentira ----------
function socketFalso(semWhatsapp) {
  const mandadas = [];
  return {
    mandadas,
    onWhatsApp: async jid => [{ exists: !(semWhatsapp || []).includes(jid.split('@')[0]), jid }],
    sendMessage: async (jid, conteudo) => { mandadas.push({ para: jid.split('@')[0], ...conteudo }); return { key: { id: 'MSG' + mandadas.length } }; },
  };
}
const driveFalso = {
  files: {
    get: async (q) => (q.alt === 'media'
      ? { data: Buffer.from('%PDF-guia-' + q.fileId) }
      : { data: { name: 'Guia ' + q.fileId + '.pdf', mimeType: 'application/pdf', size: '20' } }),
  },
};

// a mensagem que chega, como a Baileys entrega
const chega = (numero, message, extra) => ({
  key: Object.assign({ remoteJid: numero + '@s.whatsapp.net', fromMe: false, id: 'IN' + Math.random().toString(36).slice(2) }, extra || {}),
  messageTimestamp: Math.floor(Date.now() / 1000), message,
});
const texto = (numero, t) => chega(numero, { conversation: t });

const ESCRITORIO = '553891383638';
const CELULAR_DO_TESTE = '553899197340';
const CLIENTE_FONE = '5538999991234';
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nads-whatsapp-'));
const BOLETO_PDF = Buffer.from('%PDF-boleto');

let esperas = [];
// o Claude do escritório de mentira: anota as perguntas e devolve a saída combinada (uma função da pergunta; null = calado)
let perguntasAoClaude = [];
let saidaDoClaude = () => null;
const claudeFalso = async pergunta => { perguntasAoClaude.push(pergunta); return saidaDoClaude(pergunta); };
function cenario(chaves) {
  esperas = [];
  perguntasAoClaude = [];
  saidaDoClaude = () => null;
  const db = bancoFalso({
    'clientes/c1': { ativo: true, codigoOrigem: '123', nome: 'Padaria Boa', telefone: '(38) 99999-1234' },
    'clientes/c2': { ativo: true, codigoOrigem: '456', nome: 'Mercado Bom', telefone: '(38) 3221-0000' },
    'financeiroHonorarios/h1': { codigo: '123', nome: 'Padaria Boa', clienteId: 'c1' },
    'financeiroBoletos/b1': { contratoId: 'h1', competencia: '2026-11', valor: 850, vencimento: '2026-12-10', partes: 1, tamanho: BOLETO_PDF.length, envio: { status: 'enviado', enviadoEm: '2026-11-20T12:00:00.000Z' } },
    'financeiroBoletos/b1/partes/0': { dados: BOLETO_PDF },
    'solicitacoesEmail/f1': { tipo: 'envioFiscal', codigo: '123', status: 'enviado', competencia: '2026-10', enviadoEm: '2026-11-05T12:00:00.000Z', guiasDrive: [{ nome: 'DAS 10-2026.pdf', id: 'drv1' }] },
    'solicitacoesEmail/f0': { tipo: 'envioFiscal', codigo: '123', status: 'enviado', competencia: '2026-09', enviadoEm: '2026-10-05T12:00:00.000Z', guiasDrive: [{ nome: 'DAS 09-2026.pdf', id: 'drv0' }] },
    'tickets/t1': { para: { email: 'a@b.com', whatsapp: '38999991234' }, empresa: { nome: 'Padaria Boa' } },
  });
  const sock = socketFalso();
  for (const f of fs.readdirSync(pasta)) fs.rmSync(path.join(pasta, f));
  Z.prepararParaOTeste({ db, sockFalso: sock, driveFalso, chavesDoTeste: chaves, pasta, esperarFalso: async ms => { esperas.push(ms); }, claudeFalso,
    leitorFalso: async (id, baixar) => { const arq = await baixar(); return { valor: 'R$' + arq.buffer.length + ',00', vencimento: '20/12/2026' }; } });
  return { db, sock };
}
const pendentes = db => [...db._docs.entries()].filter(([k, v]) => k.startsWith('solicitacoesEmail/') && v.tipo === 'whatsapp');

(async () => {
  // ---------- 1. tudo desligado: nada sai, nada entra ----------
  {
    const { db, sock } = cenario({});
    igual('chave desligada: o boleto não vai para a fila', await Z.pedirPeloWhatsapp(db, 'boletos', { cliente: 'Padaria Boa', clienteId: 'c1', mensagem: () => 'x' }), null);
    await Z.receber(texto(CELULAR_DO_TESTE, 'oi'));
    igual('chaves desligadas: o "oi" não recebe menu', sock.mandadas.length, 0);
  }

  // ---------- 2. o boleto pela fila, com a trava fechada ----------
  {
    const { db, sock } = cenario({ boletos: true, respostas: true });
    const w = await Z.pedirPeloWhatsapp(db, 'boletos', {
      cliente: 'Padaria Boa', clienteId: 'c1', extra: { origem: 'boleto', boleto: 'b1' },
      mensagem: atende => W.mensagemDoBoleto({ cliente: 'Padaria Boa', competencia: '2026-11', valor: 850, vencimento: '2026-12-10' }, atende),
    });
    igual('trava fechada: o pedido vai ao escritório, como teste', [w.para, w.teste], [ESCRITORIO, true]);
    const [caminho, p] = pendentes(db)[0];
    verdade('o texto diz para quem iria', p.texto.startsWith('[TESTE: iria para Padaria Boa, (38) 99999-1234]'));
    igual('o pedido leva o cliente e o boleto', [p.clienteId, p.boleto, p.status], ['c1', 'b1', 'pendente']);
    const r = await Z.atenderPedido(p, db.doc(caminho), null);
    igual('mandou o PDF do boleto, com a mensagem de legenda', [sock.mandadas[0].para, sock.mandadas[0].mimetype, sock.mandadas[0].document.toString()], [ESCRITORIO, 'application/pdf', '%PDF-boleto']);
    igual('o nome do anexo', r.anexoEnviado, 'Boleto de honorários - Padaria Boa.pdf');

    // a resposta (do celular do escritório, no teste) vai para o pedido
    await Z.receber(chega(ESCRITORIO, { documentMessage: { fileName: 'comprovante.pdf', mimetype: 'application/pdf', caption: 'pago' } }));
    await Z.receber(texto(ESCRITORIO, 'obrigado'));
    const depois = db._docs.get(caminho);
    igual('as duas respostas no pedido, em ordem', Object.keys(depois.respostas).sort(), ['r1', 'r2']);
    igual('a primeira: o PDF com a legenda', [depois.respostas.r1.tipo, depois.respostas.r1.arquivo, depois.respostas.r1.texto], ['pdf', 'comprovante.pdf', 'pago']);
    igual('a última em poucas palavras', depois.ultimaResposta, 'obrigado');
    await Z.receber(texto('5511911112222', 'oi'));
    igual('número a quem nada foi mandado: não grava nada', Object.keys(db._docs.get(caminho).respostas).length, 2);
    await Z.receber(chega(ESCRITORIO, { conversation: 'oi' }, { remoteJid: '123-456@g.us' }));
    igual('mensagem de grupo: ignorada', Object.keys(db._docs.get(caminho).respostas).length, 2);
  }

  // ---------- 3. o boleto de outro cliente não vai ----------
  {
    const { db } = cenario({ boletos: true });
    let erro = '';
    try { await Z.atenderPedido({ tipo: 'whatsapp', para: ESCRITORIO, texto: 'x', clienteId: 'c2', boleto: 'b1', origem: 'boleto' }, db.doc('solicitacoesEmail/x'), null); } catch (e) { erro = e.message; }
    igual('boleto de outro cliente: recusa', erro, 'o boleto não é do cliente do pedido');
  }

  // ---------- 4. o Mandei com a trava aberta: só para o WhatsApp do ticket ----------
  {
    const { db, sock } = cenario({ mandei: true, liberado: true });
    const w = await Z.pedirPeloWhatsapp(db, 'mandei', { telefone: '38999991234', cliente: 'Padaria Boa', extra: { origem: 'mandei', ticket: 't1' }, mensagem: a => W.mensagemDoMandei({ cliente: 'Padaria Boa', numero: '#0003', link: 'https://l/ABC' }, a) });
    igual('liberado: vai ao cliente', [w.para, w.teste], [CLIENTE_FONE, false]);
    const [caminho, p] = pendentes(db)[0];
    await Z.atenderPedido(p, db.doc(caminho), null);
    igual('mandou ao telefone do ticket', sock.mandadas[0].para, CLIENTE_FONE);
    let erro = '';
    try { await Z.atenderPedido(Object.assign({}, p, { para: '38988887777' }), db.doc(caminho), null); } catch (e) { erro = e.message; }
    igual('outro número que não o do ticket: recusa', erro, '(38) 98888-7777 não é o telefone do cadastro deste cliente');
  }

  // ---------- 5. o autoatendimento com a trava fechada: só os números de teste, como a empresa de teste ----------
  {
    const { db, sock } = cenario({ autoatendimento: true, empresaDeTeste: '123' });
    await Z.receber(texto(CLIENTE_FONE, 'oi'));
    igual('trava fechada: cliente de verdade não recebe nada', sock.mandadas.length, 0);
    await Z.receber(texto(CELULAR_DO_TESTE, 'Bom dia'));
    verdade('o celular do teste recebe o menu da empresa de teste', sock.mandadas[0] && sock.mandadas[0].text.includes('atendimento de *Padaria Boa*') && sock.mandadas[0].text.includes('1️⃣ Guias do mês'));
    await Z.receber(texto(CELULAR_DO_TESTE, '1'));
    igual('1: a guia mais recente, do Drive, com a legenda', [sock.mandadas[1].fileName, sock.mandadas[1].document.toString(), sock.mandadas[1].caption],
      ['DAS 10-2026.pdf', '%PDF-guia-drv1', 'Segue a guia de Padaria Boa (outubro de 2026).\n\n' + W.TEXTO_DE_MAIS_ALGUMA]);
    await Z.receber(texto(CELULAR_DO_TESTE, 'menu'));
    await Z.receber(texto(CELULAR_DO_TESTE, '2'));
    igual('2: o boleto já enviado', [sock.mandadas[3].fileName, sock.mandadas[3].document.toString()], ['Boleto de honorários - Padaria Boa.pdf', '%PDF-boleto']);
    await Z.receber(texto(CELULAR_DO_TESTE, 'menu'));
    await Z.receber(texto(CELULAR_DO_TESTE, '3'));
    verdade('3: sem documento do DP enviado, avisa', sock.mandadas[5].text.startsWith('Não achamos os documentos do DP de Padaria Boa'));
    await Z.receber(texto(CELULAR_DO_TESTE, 'menu'));
    await Z.receber(texto(CELULAR_DO_TESTE, '4'));
    igual('4: responde com o WhatsApp do escritório', sock.mandadas[7].text, W.TEXTO_DO_ESCRITORIO);
    const recebida = [...db._docs.values()].find(d => d.tipo === 'whatsapp-recebida');
    igual('4: o pedido para falar com o escritório fica registrado', recebida && [recebida.status, recebida.codigo, recebida.pedeEscritorio], ['recebida', '123', true]);
    verdade('o autoatendimento responde em até 8 s (não 20 a 60)', esperas.length > 0 && esperas.every(ms => ms <= W.RESPOSTA_MAX_MS));
    await Z.receber(texto(CELULAR_DO_TESTE, 'valeu'));
    igual('texto solto logo depois: não repete o menu', sock.mandadas.length, 8);
    await Z.receber(chega(CELULAR_DO_TESTE, { imageMessage: { caption: 'foto' } }));
    igual('foto não puxa o menu', sock.mandadas.length, 8);
  }

  // ---------- 6. o autoatendimento liberado: a empresa pelo número do cadastro ----------
  {
    const { sock } = cenario({ autoatendimento: true, liberado: true });
    await Z.receber(texto('553899991234', 'oi'));   // o mesmo celular, sem o 9 (conta antiga)
    verdade('acha a empresa pelo telefone do cadastro, com ou sem o 9', sock.mandadas[0] && sock.mandadas[0].text.includes('atendimento de *Padaria Boa*'));
    await Z.receber(chega('', { conversation: 'oi' }, { remoteJid: '99887766@lid', remoteJidAlt: '5511911112222@s.whatsapp.net' }));
    igual('número fora do cadastro (contato novo em LID): o aviso', sock.mandadas[1] && sock.mandadas[1].text, W.TEXTO_FORA_DO_CADASTRO);
    await Z.receber(texto('5511911112222', 'oi de novo'));
    igual('o aviso só uma vez por dia', sock.mandadas.length, 2);
  }

  // ---------- 6b. um número de teste a mais (só nas chaves) com a empresa de teste ----------
  {
    const GERENTE = '5538988887777';
    const { db, sock } = cenario({ autoatendimento: true, guias: true, empresaDeTeste: '456', numerosDeTeste: ['(38) 98888-7777'] });
    db._docs.set('clientes/c2', Object.assign({}, db._docs.get('clientes/c2'), { telefone: '(38) 98888-7777' }));
    await Z.receber(texto(GERENTE, 'oi'));
    verdade('o número das chaves usa o menu, como a empresa de teste', sock.mandadas[0] && sock.mandadas[0].text.includes('atendimento de *Mercado Bom*'));
    const w = await Z.pedirPeloWhatsapp(db, 'guias', { cliente: 'Mercado Bom', clienteId: 'c2', mensagem: () => 'As guias' });
    igual('trava fechada, mas o telefone do cadastro é de teste: vai direto a ele', [w.para, w.teste], [GERENTE, true]);
    const [caminho, p] = pendentes(db)[0];
    await Z.atenderPedido(p, db.doc(caminho), null);
    igual('e o robô deixa sair', sock.mandadas[1].para, GERENTE);
  }

  // ---------- 6c. o envio do escritório segue com 20 a 60 s ----------
  {
    const { db } = cenario({});
    const p = { tipo: 'whatsapp', para: ESCRITORIO, texto: 'oi' };
    await Z.atenderPedido(p, db.doc('solicitacoesEmail/a'), null);
    await Z.atenderPedido(p, db.doc('solicitacoesEmail/b'), null);
    verdade('o segundo pedido da fila espera pelo menos 19 s', esperas.length === 1 && esperas[0] >= 19000);
  }

  // ---------- 6d. o console sem as chaves da criptografia ----------
  {
    const vistos = [];
    const antes = console.info;
    console.info = (...a) => vistos.push(a[0]);
    Z.filtrarConsole();
    console.info('Closing session:', { rootKey: Buffer.from('segredo') });
    console.info('whatsapp: conectado');
    console.info = antes;
    igual('a linha com as chaves some; a outra passa', vistos, ['whatsapp: conectado']);
  }

  // ---------- 6e. o Claude do escritório entendendo o cliente (chave ia) ----------
  {
    const { sock } = cenario({ autoatendimento: true, empresaDeTeste: '123' });
    await Z.receber(texto(CELULAR_DO_TESTE, 'me manda o DAS de outubro'));
    igual('chave ia desligada: o Claude não é perguntado', perguntasAoClaude.length, 0);
    verdade('e o cliente recebe o menu', sock.mandadas[0] && sock.mandadas[0].text.includes('Escolha uma opção'));
  }
  {
    const { db, sock } = cenario({ autoatendimento: true, ia: true, empresaDeTeste: '123' });
    // a pasta do Drive de novembro tem a guia que ninguém enviou ainda (fiscalArquivos), além das enviadas
    const nov = W.mesesParaProcurar(Date.now())[0];
    db._docs.set('fiscalArquivos/' + nov, { clientes: { '123': { arquivos: [{ i: 'drvNov', n: '11-2026.pdf' }] } } });
    // o Claude escolhe pelo código o arquivo cujo nome é o DAS de novembro e ainda inventa um código
    saidaDoClaude = p => {
      const linha = p.split('\n').find(l => l.includes('11-2026.pdf'));
      return '{"resposta": "Segue o DAS de novembro!", "documentos": ["' + (linha ? linha.split(' | ')[0] : '') + '", "D99"], "equipe": false}';
    };
    await Z.receber(texto(CELULAR_DO_TESTE, 'me manda o DAS de novembro'));
    const pergunta = perguntasAoClaude[0] || '';
    verdade('a pergunta leva a empresa, a lista (com a pasta do Drive) e a mensagem', pergunta.includes('Empresa: Padaria Boa') && pergunta.includes('Guia DAS') && pergunta.includes('11-2026.pdf') && pergunta.includes('me manda o DAS de novembro'));
    verdade('o Claude não vê o id do Drive nem o telefone', !pergunta.includes('drvNov') && !pergunta.includes(CELULAR_DO_TESTE));
    // o leitor de mentira devolve o tamanho do PDF de mentira ('%PDF-guia-drvNov' = 16 bytes) como valor
    verdade('a guia vai com o valor e o vencimento lidos no PDF', pergunta.includes('11-2026.pdf | valor R$16,00 | vence 20/12/2026'));
    igual('o texto do Claude e só o arquivo da lista', [sock.mandadas[0] && sock.mandadas[0].text, sock.mandadas[1] && sock.mandadas[1].fileName, sock.mandadas[1] && sock.mandadas[1].document.toString(), sock.mandadas.length],
      ['Segue o DAS de novembro!', '11-2026.pdf', '%PDF-guia-drvNov', 2]);
    await Z.receber(texto(CELULAR_DO_TESTE, '2'));
    igual('o número digitado não passa pelo Claude (a conversa ficou no menu)', perguntasAoClaude.length, 1);
    igual('e é atendido (o boleto)', sock.mandadas[2] && sock.mandadas[2].fileName, 'Boleto de honorários - Padaria Boa.pdf');
    // na próxima, o Claude recebe a conversa até aqui
    saidaDoClaude = () => '{"resposta": "A equipe vai verificar, tá?", "documentos": [], "equipe": true}';
    await Z.receber(texto(CELULAR_DO_TESTE, 'o valor do DAS está errado'));
    verdade('a conversa vai junto na 2ª pergunta', (perguntasAoClaude[1] || '').includes('Cliente: me manda o DAS de novembro') && (perguntasAoClaude[1] || '').includes('Atendimento: Segue o DAS de novembro!'));
    const recebida = [...db._docs.values()].find(d => d.tipo === 'whatsapp-recebida');
    verdade('o Claude chamou a equipe: fica o pedido para o escritório', !!recebida && recebida.pedeEscritorio && /o valor do DAS/.test(recebida.ultimaResposta));
  }
  {
    const { sock } = cenario({ autoatendimento: true, ia: true, empresaDeTeste: '123' });
    saidaDoClaude = () => null;
    await Z.receber(texto(CELULAR_DO_TESTE, 'blablabla qualquer coisa'));
    verdade('o Claude calado (o PC desligado): segue o menu de sempre', sock.mandadas[0] && sock.mandadas[0].text.includes('Escolha uma opção'));
  }
  {
    // o menu (sem o Claude) também acha na pasta do Drive: o mês mais novo ganha
    const { db, sock } = cenario({ autoatendimento: true, empresaDeTeste: '123' });
    const nov = W.mesesParaProcurar(Date.now())[0];
    db._docs.set('dpArquivos/' + nov, { clientes: { '123': { arquivos: [{ i: 'hol1', n: 'HOLERITE.pdf' }, { i: 'fgts1', n: 'FGTS.pdf' }] } } });
    db._docs.set('dpEnviosFora/' + nov, { clientes: { '123': { arquivos: ['fgts1'] } } });
    await Z.receber(texto(CELULAR_DO_TESTE, 'menu'));
    await Z.receber(texto(CELULAR_DO_TESTE, '3'));
    igual('3: o DP da pasta, sem o que o DP tirou do envio', [sock.mandadas[1] && sock.mandadas[1].fileName, sock.mandadas.length], ['HOLERITE.pdf', 2]);
  }

  // ---------- 6f. o lado do PC do escritório (whatsapp-claude.js) ----------
  {
    const C = require('./whatsapp-claude');
    const db = bancoFalso({ 'whatsappInterpretacoes/p1': { status: 'pendente', pergunta: 'Empresa: X\n<<<\nme manda o boleto\n>>>' } });
    db.runTransaction = async fn => fn({ get: r => r.get(), update: (r, d) => r.update(d) });
    let recebida = '';
    const opcao = await C.atender(db, db.doc('whatsappInterpretacoes/p1'), { rodar: async p => { recebida = p; return '{"opcao": 2}'; } });
    igual('o PC pergunta ao Claude e grava a opção', [opcao, db._docs.get('whatsappInterpretacoes/p1').status, db._docs.get('whatsappInterpretacoes/p1').opcao], [2, 'feito', 2]);
    verdade('o Claude recebe a pergunta da nuvem', recebida.includes('me manda o boleto'));
    igual('o mesmo pedido não é atendido duas vezes', await C.atender(db, db.doc('whatsappInterpretacoes/p1'), { rodar: async () => '{"opcao": 1}' }), null);
    const args = C.argumentos();
    verdade('o Claude roda sem nenhuma ferramenta e sem guardar sessão', args[args.indexOf('--tools') + 1] === '' && args.includes('--no-session-persistence'));
    db._docs.set('whatsappInterpretacoes/p2', { status: 'pendente', pergunta: 'x' });
    await C.atender(db, db.doc('whatsappInterpretacoes/p2'), { rodar: async () => { throw new Error('limite de uso'); } });
    igual('o Claude falhou: o pedido fica com o erro (a nuvem segue sem ele)', db._docs.get('whatsappInterpretacoes/p2').status, 'erro');
    db._docs.set('whatsappInterpretacoes/p3', { status: 'pendente', modo: 'escrever', pergunta: 'Empresa: X' });
    let modoVisto = '';
    await C.atender(db, db.doc('whatsappInterpretacoes/p3'), { rodar: async (p, modo) => { modoVisto = modo; return '{"resposta": "Oi!", "documentos": [], "equipe": false}'; } });
    igual('modo escrever: o PC devolve o texto do Claude para a nuvem conferir', [modoVisto, db._docs.get('whatsappInterpretacoes/p3').status, db._docs.get('whatsappInterpretacoes/p3').saida], ['escrever', 'feito', '{"resposta": "Oi!", "documentos": [], "equipe": false}']);
    const escrever = C.argumentos('escrever');
    verdade('o Claude que escreve também roda sem ferramenta, com as instruções de escrever', escrever[escrever.indexOf('--tools') + 1] === '' && escrever[escrever.indexOf('--system-prompt') + 1] === W.INSTRUCOES_DO_ESCRITOR);
  }

  // ---------- 7. o freio ----------
  {
    const { db } = cenario({ guias: true });
    const p = { tipo: 'whatsapp', para: ESCRITORIO, texto: 'oi' };
    for (let i = 0; i < W.MAX_RESPOSTAS_POR_PEDIDO + 10; i++) await Z.atenderPedido(p, db.doc('solicitacoesEmail/f' + i), null);
    let erro = '';
    try { await Z.atenderPedido(p, db.doc('solicitacoesEmail/fim'), null); } catch (e) { erro = e.message; }
    verdade('o 31º da hora é recusado', /por hora/.test(erro));
  }

  fs.rmSync(pasta, { recursive: true, force: true });
  console.log(falhas ? falhas + ' de ' + total + ' testes do WhatsApp FALHARAM' : 'todos os ' + total + ' testes do WhatsApp passaram');
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
