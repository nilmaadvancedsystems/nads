// Testes do índice de chaves do arquivador novo (23/10/2026): a chave, o índice, o evento na pasta do original, a espera
// pelo original, o SIEG pela chave (falso) e o modo contínuo. Tudo em pastas temporárias; nada no Drive, nada no SIEG.
// Uso: node teste-arquivador-chaves.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const K = require('./arquivador-chaves');
const C = require('./arquivador-continuo');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU:', nome, '\n  obtido:  ', JSON.stringify(obtido), '\n  esperado:', JSON.stringify(esperado)); }
}

// uma chave de verdade (dígito verificador módulo 11)
function chave(uf, aamm, cnpj, modelo, numero) {
  const base = uf + aamm + cnpj + modelo + '001' + String(numero).padStart(9, '0') + '1' + '12345678';
  let soma = 0, peso = 2;
  for (let i = base.length - 1; i >= 0; i--) { soma += +base[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return base + (r < 2 ? 0 : 11 - r);
}
const TRANSP = '05201107000111';              // a transportadora: não é cliente
const CH1 = chave('31', '2610', TRANSP, '57', 1234);
const CH2 = chave('31', '2610', TRANSP, '57', 1235);
const CH3 = chave('31', '2610', TRANSP, '57', 1236);
const CHM = chave('31', '2610', TRANSP, '58', 77);
const cte = (ch, n, dest) => '<cteProc><CTe><infCte Id="CTe' + ch + '"><ide><nCT>' + n + '</nCT><dhEmi>2026-10-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>' + TRANSP + '</CNPJ></emit><rem><CNPJ>' + TRANSP + '</CNPJ></rem><dest><CNPJ>' + dest + '</CNPJ></dest></infCte></CTe></cteProc>';
const evCte = (ch, desc, tp) => '<procEventoCTe><eventoCTe><infEvento><CNPJ>' + TRANSP + '</CNPJ><chCTe>' + ch + '</chCTe><dhEvento>2026-10-06T10:00:00-03:00</dhEvento><tpEvento>' + (tp || '310610') + '</tpEvento><detEvento><evMDFeAutCTe><descEvento>' + (desc || 'MDF-e Autorizado') + '</descEvento></evMDFeAutCTe></detEvento></infEvento></eventoCTe></procEventoCTe>';
const evMdfe = ch => '<procEventoMDFe><eventoMDFe><infEvento><CNPJ>' + TRANSP + '</CNPJ><chMDFe>' + ch + '</chMDFe><dhEvento>2026-10-07T10:00:00-03:00</dhEvento><detEvento><evEncMDFe><descEvento>Encerramento</descEvento></evEncMDFe></detEvento></infEvento></eventoMDFe></procEventoMDFe>';

const LINHAS = [
  { codigo: 152, razao: 'JANIO JOSE DE ALMEIDA', doc: '06.934.601/0001-58', regime: 'Simples' },
  { codigo: 380, razao: 'LEONARDO MENDES MARQUES', doc: '11.426.314/0001-77', regime: 'Presumido' },
];
const PASTAS = ['152 - JANIO JOSE DE ALMEIDA', '380 - LEONARDO MENDES MARQUES'];
const cad = R.montarCadastro(LINHAS, PASTAS);

// ---------- 1. a chave ----------
igual('chave: dígito verificador confere', K.chaveValida(CH1), true);
igual('chave: dígito errado não é chave', K.chaveValida(CH1.slice(0, 43) + ((+CH1[43] + 1) % 10)), false);
igual('chave: do nome do arquivo do SIEG', K.chavesDoTexto(CH1 + '-evento-310610-001.xml'), [CH1]);
igual('chave: número qualquer de 44 dígitos não vale', K.chavesDoTexto('1'.repeat(44) + '.xml'), []);
igual('chave: a do CT-e (Id) e a do evento (chCTe)', [R.classificarXml(cte(CH1, 1234, '06934601000158')).chave, R.classificarXml(evCte(CH1)).chave], [CH1, CH1]);
igual('evento do MDF-e: tipo MDF-e', [R.classificarXml(evMdfe(CHM)).tipo, R.classificarXml(evMdfe(CHM)).nome], ['MDF-e', '07-10-2026 - ENCERRAMENTO MDF-e 77.xml']);

// ---------- 2. onde o original está ----------
igual('destino: cliente, pasta do documento e de onde veio', K.lerDestino('G:\\Meu Drive\\2026\\152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\CT-e\\10-2026_CT-e_1234.xml'), { cliente: 152, sub: ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e'], de: 'doc' });
igual('destino: o evento já arquivado aponta a pasta do documento', K.lerDestino('G:\\Meu Drive\\2026\\152 - JANIO\\FISCAL\\SIMPLES NACIONAL\\12. XML\\CT-e\\EVENTOS\\06-10-2026 - X.xml').sub, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e']);
igual('destino: fora da raiz de clientes não vale', K.lerDestino('C:\\outro\\152 - X\\a.xml'), null);

// ---------- 3. o índice montado dos manifestos (sem abrir nada do G:) ----------
(async () => {
// o caminho longo (o fs.watch do Windows derruba o processo com o caminho curto "DPTOFI~1" do tmp)
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'teste-chaves-'));
try {
  const controle = path.join(tmp, 'controle');
  fs.mkdirSync(path.join(controle, 'MANIFESTO'), { recursive: true });
  const antigo = path.join(tmp, 'manifesto-antigo.jsonl');
  fs.writeFileSync(antigo, JSON.stringify({ nome_original: CH1 + '-cte.xml', destino_final: 'G:\\Meu Drive\\2026\\152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\CT-e', nome_final: '10-2026_CT-e_1234.xml' }) + '\n' + 'linha quebrada\n');
  fs.writeFileSync(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), JSON.stringify({ nome_original: 'qualquer.xml', destino_final: 'G:\\Meu Drive\\2026\\380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\CT-e', nome_final: '10-2026_CT-e_1235.xml', chave: CH2, cliente: 380 }) + '\n');
  const idx = K.carregar({ controle, manifestoAntigo: antigo });
  igual('índice: duas chaves (nome do arquivo e campo chave)', [idx.tamanho, idx.achar(CH1).map(x => x.cliente), idx.achar(CH2).map(x => x.cliente)], [2, [152], [380]]);
  idx.anotar(CH3, { onde: 'G:\\Meu Drive\\2026\\152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\CT-e\\10-2026_CT-e_1236.xml' }, true);
  igual('índice: anotar grava na hora em chaves.jsonl e volta no próximo carregar', K.carregar({ controle, manifestoAntigo: antigo }).achar(CH3).map(x => x.cliente), [152]);

  // ---------- 4. as regras: o evento na pasta do original; sem o original, espera ----------
  const ctx = { cadastro: cad, hoje: new Date(2026, 9, 20), chaves: idx };
  const d1 = R.decidir({ nome: CH1 + '-evento-310610-001.xml', rel: '2026-10\\QUALQUER\\' + CH1 + '-evento-310610-001.xml', xml: evCte(CH1) }, ctx);
  igual('evento com o original no índice: mesma pasta, em EVENTOS', [d1.acao, d1.cliente, d1.destinoRelativo, d1.nomeFinal, d1.comoCliente], ['ARQUIVAR', 152, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\CT-e\\EVENTOS', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml', 'chave']);
  const d4 = R.decidir({ nome: 'ev.xml', rel: 'ev.xml', xml: evCte(chave('31', '2610', TRANSP, '57', 9999)) }, ctx);
  igual('evento sem o original: espera, com a chave', [d4.acao, d4.motivo, K.chaveValida(d4.chave)], ['AGUARDANDO_ORIGINAL', 'EVENTO_SEM_ORIGINAL', true]);
  const idx2 = new K.Indice();
  idx2.juntar(CH1, 152, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e'], 'doc');
  idx2.juntar(CH1, 380, null, 'outro');
  const d5 = R.decidir({ nome: 'ev.xml', rel: 'ev.xml', xml: evCte(CH1) }, Object.assign({}, ctx, { chaves: idx2 }));
  igual('original em dois clientes: o evento nos dois (o outro pela árvore do regime dele)', [d5.cliente, d5.copias.map(c => c.destinoRelativo)], [152, ['380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\CT-e\\EVENTOS']]);
  const nfeDoCliente = '<procEventoNFe><evento><infEvento><CNPJ>06934601000158</CNPJ><chNFe>' + chave('31', '2610', TRANSP, '55', 5) + '</chNFe><dhEvento>2026-10-01T10:00:00-03:00</dhEvento><detEvento><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento></procEventoNFe>';
  igual('evento com o CNPJ do cliente: segue pelo CNPJ (o índice não muda isso)', R.decidir({ nome: 'c.xml', rel: 'c.xml', xml: nfeDoCliente }, ctx).cliente, 152);

  // ---------- 5. o SIEG pela chave (falso): agrupa por emitente/mês/modelo, guarda a resposta, limite do dia ----------
  let chamadas = 0;
  const siegFalso = (tem) => ({
    lerCredenciais: () => ({ c: { apiKey: 'x', clientId: 'y', secretKey: 'z' }, faltam: [] }),
    periodo: comp => ({ DataEmissaoInicio: comp + '-01', DataEmissaoFim: comp + '-31' }),
    xmlsDaResposta: r => r,
    chamar: async (c, rota, corpo) => { chamadas++; return corpo.Skip === 0 ? tem.filter(x => x.includes(corpo.CnpjEmit)) : []; },
  });
  const ctlSieg = path.join(tmp, 'sieg');
  const CH8 = chave('31', '2610', TRANSP, '57', 8), CH9 = chave('31', '2610', TRANSP, '57', 9);
  const b1 = K.criarBuscaSieg({ controle: ctlSieg, sieg: siegFalso([cte(CH8, 8, '11426314000177')]), limiteDia: 5 });
  const r1 = await b1.buscar([CH8, CH9]);
  igual('SIEG: uma chamada para as duas chaves do mesmo emitente/mês; achou uma, a outra não tem', [chamadas, !!r1.get(CH8), r1.get(CH9)], [1, true, null]);
  const b2 = K.criarBuscaSieg({ controle: ctlSieg, sieg: siegFalso([]), limiteDia: 5 });
  const r2 = await b2.buscar([CH8, CH9]);
  igual('SIEG: a resposta fica guardada (não pergunta de novo)', [chamadas, !!r2.get(CH8), r2.get(CH9)], [1, true, null]);
  const b3 = K.criarBuscaSieg({ controle: path.join(tmp, 'sieg2'), sieg: siegFalso([]), limiteDia: 0 });
  const r3 = await b3.buscar([CH8]);
  igual('SIEG: sem chamada no dia, a chave fica sem resposta (tenta outro dia)', [chamadas, r3.has(CH8)], [1, false]);
  igual('SIEG: sem credenciais fica desligado', K.criarBuscaSieg({ controle: tmp, sieg: null }).ligado, false);

  // ---------- 6. o executor em PRODUCAO numa pasta temporária ----------
  const sb = path.join(tmp, 'prod');
  const origem = path.join(sb, 'origem'), clientes = path.join(sb, '2026'), ctl = path.join(sb, 'controle');
  for (const p of PASTAS) fs.mkdirSync(path.join(clientes, p), { recursive: true });
  fs.mkdirSync(path.join(origem, '2026-10', 'X'), { recursive: true });
  const evRel = '2026-10\\X\\' + CH1 + '-evento-310610-001.xml', orRel = '2026-10\\X\\' + CH1 + '-cte.xml';
  fs.writeFileSync(path.join(origem, evRel), evCte(CH1));
  fs.writeFileSync(path.join(origem, orRel), cte(CH1, 1234, '06934601000158'));
  const base = { modo: 'PRODUCAO', confirmo: true, origem, clientes, controle: ctl, cadastro: R.montarCadastro(LINHAS, PASTAS), manifestoAntigo: path.join(sb, 'nao-existe.jsonl'), travaAntiga: path.join(sb, 'nao-existe.lock'), tiposProducao: ['todos'], moverNaoIdentificados: true, pastaNaoIdentificados: 'HOJE', log: () => {} };
  // o evento vem ANTES do original no mesmo lote
  const res = await A.executar(Object.assign({}, base, { arquivos: [evRel, orRel] }));
  const pastaCte = path.join(clientes, '152 - JANIO JOSE DE ALMEIDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e');
  igual('lote: o original e o evento (que veio antes) arquivados juntos', [res.itens.map(i => i.acao), fs.existsSync(path.join(pastaCte, '10-2026_CT-e_1234.xml')), fs.existsSync(path.join(pastaCte, 'EVENTOS', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml'))], [['ARQUIVAR', 'ARQUIVAR'], true, true]);
  const man = fs.readFileSync(path.join(ctl, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  igual('lote: o manifesto com a chave nas duas linhas', man.map(m => m.chave), [CH1, CH1]);
  igual('lote: a chave gravada na hora em chaves.jsonl', fs.readFileSync(path.join(ctl, 'chaves.jsonl'), 'utf8').includes(CH1), true);
  // evento sem original: dentro da espera, fica na origem
  const ev2 = CH2 + '-evento-310610-001.xml';
  fs.writeFileSync(path.join(origem, ev2), evCte(CH2));
  const e1 = await A.executar(Object.assign({}, base, { arquivos: [ev2], esperaVencida: () => false }));
  igual('espera: o evento sem o original fica na origem', [e1.itens[0].acao, fs.existsSync(path.join(origem, ev2))], ['AGUARDANDO_ORIGINAL', true]);
  // espera vencida: o SIEG (falso) tem o original, destinatário 380 → o evento vai para a 380 pela árvore do regime
  const busca = K.criarBuscaSieg({ controle: path.join(sb, 'sieg'), sieg: siegFalso([cte(CH2, 1235, '11426314000177')]), limiteDia: 10 });
  const e2 = await A.executar(Object.assign({}, base, { arquivos: [ev2], esperaVencida: () => true, buscaSieg: busca }));
  const no380 = path.join(clientes, '380 - LEONARDO MENDES MARQUES', 'FISCAL', 'LUCRO PRESUMIDO', '14. XML', 'CT-e', 'EVENTOS', '06-10-2026 - MDF-E AUTORIZADO CT-e 1235.xml');
  igual('espera vencida + SIEG achou o original: arquivado no cliente do original', [e2.itens[0].acao, !!e2.itens[0].viaSieg, fs.existsSync(no380), fs.existsSync(path.join(origem, ev2))], ['ARQUIVAR', true, true, false]);
  // espera vencida e o SIEG não tem: NÃO IDENTIFICADOS com o motivo e a chave
  const ev3 = chave('31', '2610', TRANSP, '57', 4321);
  const ev3Nome = ev3 + '-evento-110111-1.xml';
  fs.writeFileSync(path.join(origem, ev3Nome), evCte(ev3, 'Cancelamento', '110111'));
  const e3 = await A.executar(Object.assign({}, base, { arquivos: [ev3Nome], esperaVencida: () => true, buscaSieg: busca }));
  const indiceNi = fs.readFileSync(path.join(origem, 'NÃO IDENTIFICADOS', 'HOJE', '_nao_identificados.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  igual('sem o original nem no SIEG: NÃO IDENTIFICADOS com o motivo e a chave', [e3.itens[0].acao, e3.itens[0].motivo, indiceNi[0].motivo, indiceNi[0].chave, fs.existsSync(path.join(origem, 'NÃO IDENTIFICADOS', 'HOJE', ev3Nome))], ['NAO_IDENTIFICADO', 'EVENTO_SEM_ORIGINAL', 'EVENTO_SEM_ORIGINAL', ev3, true]);

  // ---------- 7. o modo contínuo: o evento espera o original e vai quando ele chega ----------
  const sc = path.join(tmp, 'continuo');
  const oC = path.join(sc, 'origem'), cC = path.join(sc, '2026'), kC = path.join(sc, 'controle');
  for (const p of PASTAS) fs.mkdirSync(path.join(cC, p), { recursive: true });
  fs.mkdirSync(oC, { recursive: true }); fs.mkdirSync(kC, { recursive: true });
  fs.writeFileSync(path.join(kC, 'config.json'), JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0, esperaOriginalHoras: 48 }));
  const passado = new Date(Date.now() - 120000);
  const escrever = (nome, xml) => { const p = path.join(oC, nome); fs.writeFileSync(p, xml); fs.utimesSync(p, passado, passado); };
  escrever(CH1 + '-evento-310610-001.xml', evCte(CH1));
  const baseC = { origem: oC, controle: kC, controleAntigo: path.join(sc, 'sem-rotina'), clientes: cC, cadastro: R.montarCadastro(LINHAS, PASTAS), sieg: null, painel: { atividade: () => {}, erro: () => {}, estado: () => {}, fazendo: () => {}, modulo: () => {} }, umaVez: true, log: () => {} };
  const v = C.iniciar(baseC);
  await v.ciclo(); await v.ciclo(); await v.ciclo();
  v.parar();
  igual('contínuo: o evento sem o original espera na origem (não vai para NÃO IDENTIFICADOS)', [fs.existsSync(path.join(oC, CH1 + '-evento-310610-001.xml')), fs.existsSync(path.join(oC, 'NÃO IDENTIFICADOS'))], [true, false]);
  const acomp = JSON.parse(fs.readFileSync(path.join(kC, 'continuo', 'acompanhamento.json'), 'utf8'));
  escrever(CH1 + '-cte.xml', cte(CH1, 1234, '06934601000158'));
  const v1 = C.iniciar(baseC);
  await v1.ciclo(); await v1.ciclo(); await v1.ciclo(); await v1.ciclo();
  v1.parar();
  const pastaC = path.join(cC, '152 - JANIO JOSE DE ALMEIDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e');
  igual('contínuo: chegou o original, os dois arquivados (o evento na pasta do original)', [fs.existsSync(path.join(pastaC, '10-2026_CT-e_1234.xml')), fs.existsSync(path.join(pastaC, 'EVENTOS', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml')), fs.readdirSync(oC)], [true, true, []]);
  const acomp2 = JSON.parse(fs.readFileSync(path.join(kC, 'continuo', 'acompanhamento.json'), 'utf8'));
  igual('contínuo: na aba Chegando, "esperando o documento original" enquanto esperou', [acomp.pasta && acomp.pasta.esperandoOriginal, acomp2.pasta && acomp2.pasta.esperandoOriginal], [1, 0]);
  const diario = fs.readdirSync(path.join(kC, 'continuo')).filter(f => /^decisoes-/.test(f)).flatMap(f => fs.readFileSync(path.join(kC, 'continuo', f), 'utf8').trim().split('\n').map(JSON.parse));
  igual('contínuo: o diário só tem as decisões finais, com a chave', diario.map(l => [l.acao, l.chave]), [['ARQUIVAR', CH1], ['ARQUIVAR', CH1]]);
  // espera vencida (quase zero) e o SIEG desligado: NÃO IDENTIFICADOS com a chave
  fs.writeFileSync(path.join(kC, 'config.json'), JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0, esperaOriginalHoras: 0.000001 }));
  escrever(ev3Nome, evCte(ev3, 'Cancelamento', '110111'));
  const v2 = C.iniciar(baseC);
  for (let i = 0; i < 4; i++) { await v2.ciclo(); await new Promise(r => setTimeout(r, 20)); }
  v2.parar();
  const niDir = fs.existsSync(path.join(oC, 'NÃO IDENTIFICADOS')) ? fs.readdirSync(path.join(oC, 'NÃO IDENTIFICADOS')) : [];
  const ni = niDir.length ? fs.readFileSync(path.join(oC, 'NÃO IDENTIFICADOS', niDir[0], '_nao_identificados.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
  igual('contínuo: passada a espera, sem SIEG, vai para NÃO IDENTIFICADOS com a chave', [fs.existsSync(path.join(oC, ev3Nome)), ni.map(l => [l.motivo, l.chave])], [false, [['EVENTO_SEM_ORIGINAL', ev3]]]);

  // ---------- 8. reprocessar NÃO IDENTIFICADOS: simulação não mexe; produção tira o que se resolveu e anota o que fica ----------
  const sr = path.join(tmp, 'reproc');
  const niR = path.join(sr, 'origem', 'NÃO IDENTIFICADOS'), cR = path.join(sr, '2026'), kR = path.join(sr, 'controle');
  for (const p of PASTAS) fs.mkdirSync(path.join(cR, p), { recursive: true });
  const subR = path.join(niR, '20261022-NOVO', '2026-10', 'HELLO');
  fs.mkdirSync(subR, { recursive: true });
  const chSem = chave('31', '2610', TRANSP, '57', 5555);
  fs.writeFileSync(path.join(subR, CH1 + '-evento-310610-001.xml'), evCte(CH1));
  fs.writeFileSync(path.join(subR, chSem + '-evento-310610-001.xml'), evCte(chSem));
  fs.writeFileSync(path.join(niR, '20261022-NOVO', '_nao_identificados.jsonl'), [CH1, chSem].map(ch => JSON.stringify({ arquivo: ch + '-evento-310610-001.xml', caminho_relativo: '2026-10\\HELLO', status: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO' })).join('\n') + '\n');
  const idxR = new K.Indice(path.join(kR, 'chaves.jsonl'));
  idxR.juntar(CH1, 152, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e'], 'doc');
  const baseR = { pastaNi: niR, clientes: cR, controle: kR, cadastro: R.montarCadastro(LINHAS, PASTAS), chaves: idxR, manifestoAntigo: path.join(sr, 'nao-existe.jsonl'), travaAntiga: path.join(sr, 'nao-existe.lock'), buscaSieg: K.criarBuscaSieg({ controle: kR, sieg: siegFalso([]), limiteDia: 10 }), log: () => {} };
  igual('reprocessar: os arquivos de NÃO IDENTIFICADOS, sem o índice', A.arquivosDosNaoIdentificados(niR).length, 2);
  const sim = await A.reprocessarNaoIdentificados(Object.assign({}, baseR, { modo: 'SIMULACAO' }));
  igual('reprocessar (simulação): um pela chave, um fica sem o original; nada mudou', [sim.porRota, fs.readdirSync(subR).length], [{ chave: 1, 'fica: EVENTO_SEM_ORIGINAL': 1 }, 2]);
  const prod = await A.reprocessarNaoIdentificados(Object.assign({}, baseR, { modo: 'PRODUCAO', confirmo: true }));
  const linhasR = fs.readFileSync(path.join(niR, '20261022-NOVO', '_nao_identificados.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  igual('reprocessar (produção): o da chave foi para o cliente; o outro ficou, com o motivo novo e a chave', [prod.porRota, fs.readdirSync(subR), fs.existsSync(path.join(cR, '152 - JANIO JOSE DE ALMEIDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e', 'EVENTOS', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml')), linhasR.slice(2).map(l => [l.motivo, l.chave, l.motivo_anterior, l.caminho_relativo])],
    [{ chave: 1, 'fica: EVENTO_SEM_ORIGINAL': 1 }, [chSem + '-evento-310610-001.xml'], true, [['EVENTO_SEM_ORIGINAL', chSem, 'CLIENTE_NAO_LOCALIZADO', '2026-10\\HELLO']]]);

  // um evento anterior da mesma nota (o original não arquivado) não desempata dois clientes possíveis
  const chG = chave('31', '2610', '11426314000177', '55', 31);
  const idxG = new K.Indice(); idxG.juntar(chG, 380, ['FISCAL', 'LUCRO PRESUMIDO', '14. XML', 'NF-e'], 'evento');
  const evG = '<procEventoNFe><evento><infEvento><CNPJ>06934601000158</CNPJ><chNFe>' + chG + '</chNFe><dhEvento>2026-10-03T10:00:00-03:00</dhEvento><detEvento><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento></procEventoNFe>';
  igual('índice só com evento anterior + dois clientes no evento: espera o original (não decide pelo evento)', R.decidir({ nome: 'g.xml', rel: 'g.xml', xml: evG }, Object.assign({}, ctx, { chaves: idxG })).acao, 'AGUARDANDO_ORIGINAL');

  // ---------- 9. os outros XML que ficavam em NÃO IDENTIFICADOS ----------
  const chNfse = '3157005' + '2' + '2' + '06934601000158' + '0000000000009' + '2609' + '118215150' + '5';
  const evNfse = '﻿<?xml version="1.0"?><evento xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento Id="EVT1"><dhProc>2026-09-03T10:50:30-03:00</dhProc><pedRegEvento><infPedReg Id="PRE1"><dhEvento>2026-09-03T10:50:30-03:00</dhEvento><CNPJAutor>06934601000158</CNPJAutor><chNFSe>' + chNfse + '</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc></e101101></infPedReg></pedRegEvento></infEvento></evento>';
  const dN = R.decidir({ nome: 'xml-1.xml', rel: 'xml-1.xml', xml: evNfse }, ctx);
  igual('evento da NFS-e nacional: cancelamento na pasta de eventos da NFS-e do prestador', [dN.acao, dN.destinoRelativo, dN.nomeFinal], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e\\EVENTOS', '03-09-2026 - CANCELAMENTO DE NFS-E NFS-e 9.xml']);
  const cteOs = '<cteOSProc><CTeOS><infCte Id="CTe' + chave('31', '2609', TRANSP, '67', 9151) + '"><ide><nCT>9151</nCT><dhEmi>2026-09-29T00:00:00+00:00</dhEmi></ide><emit><CNPJ>' + TRANSP + '</CNPJ></emit><toma><CNPJ>06934601000158</CNPJ></toma></infCte></CTeOS></cteOSProc>';
  const dO = R.decidir({ nome: 'os.xml', rel: 'os.xml', xml: cteOs }, ctx);
  igual('CT-e OS: o tomador, na pasta do CT-e', [dO.acao, dO.cliente, dO.nomeFinal, dO.destinoRelativo.split('\\').slice(-1)[0]], ['ARQUIVAR', 152, '09-2026_CT-e OS_9151.xml', 'CT-e']);
  // o mesmo evento solto e de dentro do .zip, um com BOM: o segundo é "já arquivado", não um " (1)"
  const sbB = path.join(tmp, 'bom'); const oB = path.join(sbB, 'origem'), cB = path.join(sbB, '2026');
  for (const p of PASTAS) fs.mkdirSync(path.join(cB, p), { recursive: true });
  fs.mkdirSync(path.join(oB, 'zip'), { recursive: true });
  fs.writeFileSync(path.join(oB, 'a.xml'), '﻿' + evCte(CH1)); fs.writeFileSync(path.join(oB, 'zip', 'a.xml'), evCte(CH1));
  const rB = await A.executar({ modo: 'SIMULACAO', origem: oB, clientes: cB, controle: path.join(sbB, 'ctl'), cadastro: R.montarCadastro(LINHAS, PASTAS), chaves: idx2, manifestoAntigo: path.join(sbB, 'x.jsonl'), arquivos: ['a.xml', 'zip\\a.xml'], log: () => {} });
  igual('o mesmo XML com e sem BOM: o segundo é já arquivado', rB.itens.map(i => [i.acao, path.basename(i.onde || '')]), [['ARQUIVAR', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml'], ['JA_ARQUIVADO', '06-10-2026 - MDF-E AUTORIZADO CT-e 1234.xml (neste lote)']]);
  // o SIEG tem o original, mas o original é entre dois clientes: o evento fica com o motivo do original (ambíguo)
  const nfeEntre = ch => '<nfeProc><NFe><infNFe Id="NFe' + ch + '"><ide><mod>55</mod><nNF>7</nNF><dhEmi>2026-10-02T10:00:00-03:00</dhEmi></ide><emit><CNPJ>06934601000158</CNPJ></emit><dest><CNPJ>11426314000177</CNPJ></dest></infNFe></NFe></nfeProc>';
  const chE = chave('31', '2610', '06934601000158', '55', 7);
  const evE = '<procEventoNFe><evento><infEvento><CNPJ>' + TRANSP + '</CNPJ><chNFe>' + chE + '</chNFe><dhEvento>2026-10-03T10:00:00-03:00</dhEvento><detEvento><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento></procEventoNFe>';
  // a chave de um cliente vira candidato pelo emitente (posições 6–20): o evento é dele, sem precisar do SIEG
  igual('evento: o emitente que está na chave é cliente → segue por ele', R.decidir({ nome: 'e.xml', rel: 'e.xml', xml: evE }, ctx).cliente, 152);
  const chF = chave('31', '2610', TRANSP, '55', 8);
  const evF = evE.replace(chE, chF);
  fs.writeFileSync(path.join(oB, 'f.xml'), evF);
  const bF = K.criarBuscaSieg({ controle: path.join(sbB, 'sieg'), sieg: siegFalso([nfeEntre(chF).replace('<emit>', '<x>' + TRANSP + '</x><emit>')]), limiteDia: 5 });
  const rF = await A.executar({ modo: 'SIMULACAO', origem: oB, clientes: cB, controle: path.join(sbB, 'ctl'), cadastro: R.montarCadastro(LINHAS, PASTAS), chaves: new K.Indice(), manifestoAntigo: path.join(sbB, 'x.jsonl'), arquivos: ['f.xml'], buscaSieg: bF, log: () => {} });
  igual('SIEG achou o original entre dois clientes: o evento vai para os dois (regra das duas clientes)', [rF.itens[0].acao, rF.itens[0].cliente, rF.itens[0].copias.map(c => c.cliente), !!rF.itens[0].viaSieg], ['ARQUIVAR', 152, [380], true]);

  // ---------- 10. a regra das duas clientes (23/10/2026) ----------
  const LINHAS2 = LINHAS.concat({ codigo: 700, razao: 'DUPLICADA UM LTDA', doc: '45.997.418/0001-53', regime: 'Simples' }, { codigo: 701, razao: 'DUPLICADA DOIS LTDA', doc: '45.997.418/0001-53', regime: 'Simples' },
    { codigo: 702, razao: 'INATIVA SEM PASTA LTDA', doc: '36.462.778/0001-60', regime: 'Simples', ativo: false });
  const cad2 = R.montarCadastro(LINHAS2, PASTAS);
  const ctx2 = { cadastro: cad2, hoje: new Date(2026, 9, 20), chaves: new K.Indice() };
  const nf = (emit, dest) => '<nfeProc><NFe><infNFe Id="NFe' + chave('31', '2610', emit, '55', 70) + '"><ide><mod>55</mod><nNF>70</nNF><dhEmi>2026-10-02T10:00:00-03:00</dhEmi></ide><emit><CNPJ>' + emit + '</CNPJ></emit><dest><CNPJ>' + dest + '</CNPJ></dest></infNFe></NFe></nfeProc>';
  const dd = R.decidir({ nome: 'n.xml', rel: 'n.xml', xml: nf('11426314000177', '06934601000158') }, ctx2);
  igual('duas clientes: saída no emitente (380, Presumido) e entrada no destinatário (152, Simples)', [dd.acao, dd.destinoRelativo, dd.copias.map(c => c.destinoRelativo)], ['ARQUIVAR', '380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\NF-e', ['152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e']]);
  igual('duas clientes: um CNPJ em dois códigos continua ambíguo', R.decidir({ nome: 'n.xml', rel: 'n.xml', xml: nf('45997418000153', '06934601000158') }, ctx2).motivo, 'CLIENTE_AMBIGUO');
  const di = R.decidir({ nome: 'n.xml', rel: 'n.xml', xml: nf('36462778000160', '06934601000158') }, ctx2);
  igual('duas clientes: a inativa sem pasta fica de fora (só o destinatário)', [di.acao, di.cliente, di.copias.length], ['ARQUIVAR', 152, 0]);
  const cteEntre = '<cteProc><CTe><infCte Id="CTe' + chave('35', '2609', TRANSP, '57', 11) + '"><ide><nCT>11</nCT><dhEmi>2026-09-05T10:00:00-03:00</dhEmi><toma3><toma>3</toma></toma3></ide><emit><CNPJ>' + TRANSP + '</CNPJ></emit><rem><CNPJ>06934601000158</CNPJ></rem><dest><CNPJ>11426314000177</CNPJ></dest></infCte></CTe></cteProc>';
  const dc = R.decidir({ nome: 'c.xml', rel: 'c.xml', xml: cteEntre }, ctx2);
  igual('CT-e entre duas clientes (transportadora de fora): o tomador primeiro, o remetente com cópia', [dc.acao, dc.cliente, dc.copias.map(c => c.cliente)], ['ARQUIVAR', 380, [152]]);
  // o evento da nota que foi para as duas segue as duas cópias
  const idxD = new K.Indice();
  idxD.juntar(chave('31', '2610', '11426314000177', '55', 70), 380, ['FISCAL', 'LUCRO PRESUMIDO', '14. XML', 'NF-e'], 'doc');
  idxD.juntar(chave('31', '2610', '11426314000177', '55', 70), 152, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e'], 'doc');
  const evD = '<procEventoNFe><evento><infEvento><CNPJ>06934601000158</CNPJ><chNFe>' + chave('31', '2610', '11426314000177', '55', 70) + '</chNFe><dhEvento>2026-10-03T10:00:00-03:00</dhEvento><detEvento><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento></procEventoNFe>';
  const de = R.decidir({ nome: 'e.xml', rel: 'e.xml', xml: evD }, Object.assign({}, ctx2, { chaves: idxD }));
  igual('o evento da nota das duas clientes vai para as duas', [de.acao, [de.cliente].concat(de.copias.map(c => c.cliente)).sort()], ['ARQUIVAR', [152, 380]]);

  // ---------- 11. NFS-e nacional: o original pelo prestador e o número (nome do SIEG no manifesto) ----------
  igual('chave da NFS-e pelo nome do SIEG', K.chavesDoTexto('nfse-11414965000147-2600000001992.xml'), ['NFSE:11414965000147:2600000001992']);
  const idxN = new K.Indice(); idxN.juntar('NFSE:11414965000147:2600000001992', 152, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NFS-e'], 'doc');
  const chN = '3168002' + '1' + '2' + '11414965000147' + '2600000001992' + '2609' + '000270796' + '2';
  const evN = '<evento><infEvento Id="E"><pedRegEvento><infPedReg Id="P"><dhEvento>2026-09-08T10:31:37-03:00</dhEvento><CNPJAutor>11414965000147</CNPJAutor><chNFSe>' + chN + '</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc></e101101></infPedReg></pedRegEvento></infEvento></evento>';
  const dn = R.decidir({ nome: 'x.xml', rel: 'x.xml', xml: evN }, Object.assign({}, ctx2, { chaves: idxN }));
  igual('evento da NFS-e nacional acha a NFS-e arquivada pelo prestador e número', [dn.acao, dn.destinoRelativo], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e\\EVENTOS']);

  // ---------- 12. os outros que sobravam ----------
  const ofxL = '<OFX><BANKACCTFROM><BANKID>001<ACCTID>173266</BANKACCTFROM><BANKTRANLIST><DTSTART>20260901<DTEND>20260930</BANKTRANLIST></OFX>';
  const ctxC = Object.assign({}, ctx2, { contas: new Map([['BANCO DO BRASIL:173266', new Map([[380, new Set(['outro-hash'])]])]]) });
  igual('OFX pela conta já arquivada (contas.json)', R.decidir({ nome: 'e.ofx', rel: 'e.ofx', ofx: ofxL, hash: 'h' }, ctxC).cliente, 380);
  const raicms = ' LIVRO REGISTRO DE APURACAO DO ICMS - RAICMS - MODELO P9\n| EMPRESA..: JANIO JOSE DE ALMEIDA |\n| INSC.EST.: 0029504300073 CGC: 06.934.601/0001-58 |\n| FOLHA....: 00001 MES OU PERIODO/ANO: 01/09/2026 A 30/09/2026 |';
  const dt = R.decidir({ nome: 'RELATORIO 04 SET.txt', rel: 'r.txt', txt: raicms }, ctx2);
  igual('TXT do livro de apuração do ICMS: LIVROS FISCAIS do ano, .txt', [dt.acao, dt.destinoRelativo, dt.nomeFinal], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\13. LIVROS FISCAIS\\2026', '09-2026 - APURACAO ICMS.txt']);
  const rel = ['Notas Fiscais Saída 09/10/2026 14:22 Data: Hora Período : 01/09/2026 a 30/09/2026 CFOP JANIO JOSE DE ALMEIDA CNPJ 06.934.601/0001-58 XML SAIDA MG01/09/2026 2328 5.102'];
  const dr = R.decidir({ nome: 'RELATORIO 01 SET.PDF', rel: 'r.pdf', texto: rel }, ctx2);
  igual('relatório de notas de saída: EMITIDOS\\RELATÓRIO MENSAL do ano', [dr.acao, dr.destinoRelativo, dr.nomeFinal], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\EMITIDOS\\RELATÓRIO MENSAL\\2026', '09-2026 - RELATORIO NOTAS EMITIDAS - JANIO JOSE DE ALMEIDA.pdf']);
  const drE = R.decidir({ nome: 'RELATORIO 02 SET.PDF', rel: 'r.pdf', texto: [rel[0].replace('Notas Fiscais Saída', 'Notas Fiscais Entrada')] }, ctx2);
  igual('relatório de notas de entrada: RECEBIDOS', [drE.acao, drE.nomeFinal], ['ARQUIVAR', '09-2026 - RELATORIO NOTAS RECEBIDAS - JANIO JOSE DE ALMEIDA.pdf']);

  // ---------- 13. as respostas do Vitor (23/10/2026) ----------
  const LINHAS3 = LINHAS.concat(
    { codigo: 298, razao: 'TEOBALDO MENDES DE OLIVEIRA LTDA', doc: '07.061.814/0001-85', regime: 'Simples', nomeEntregas: 'TEOBALDO MENDES DE OLIVEIRA - EIRELI' },
    { codigo: 299, razao: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 02', outrosNomes: ['TEOBALDO MENDES DE OLIVEIRA LTDA'], doc: '07.061.814/0002-66', regime: 'Simples', nomeEntregas: 'TEOBALDO MENDES DE OLIVEIRA LTDA' },
    { codigo: 300, razao: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 03', doc: '07.061.814/0003-47', regime: 'Simples', nomeEntregas: 'TEOBALDO MENDES DE OLIVEIRA - EIRELI' },
    { codigo: 292, razao: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', doc: '19.449.248/0001-62', regime: 'Presumido' },
    { codigo: 294, razao: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', doc: '19.449.248/0003-24', regime: 'Simples', ativo: false },
    { codigo: 309, razao: 'FITO ALIMENTOS LTDA', doc: '26.124.295/0001-00', regime: 'Simples' },
    { codigo: 485, razao: 'XTREME ACADEMIA ESPECIALIZADA LTDA', doc: '49.032.922/0001-70', regime: 'Simples' },
    { codigo: 409, razao: 'OURO VERDE MINERACAO LTDA - FILIAL 02', doc: '27.119.416/0002-60', regime: 'Presumido' });
  const cad3 = R.montarCadastro(LINHAS3, PASTAS.concat('298 - TEOBALDO MENDES DE OLIVEIRA LTDA', '299 - TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 02', '300 - TEOBALDO', '292 - FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', '309 - FITO ALIMENTOS LTDA', '485 - XTREME ACADEMIA ESPECIALIZADA LTDA', '409 - OURO VERDE MINERACAO LTDA - FILIAL 02'));
  const ctx3 = { cadastro: cad3, hoje: new Date(2026, 9, 23), chaves: new K.Indice() };
  // o lote do SIEG pelo nome do cliente no Entregas
  igual('lote do SIEG: "TEOBALDO MENDES DE OLIVEIRA LTDA" é o nome da 299 no Entregas', R.clienteDaPasta('2026-09\\TEOBALDO MENDES DE OLIVEIRA LTDA\\SIEG 2026-09 - TEOBALDO MENDES DE OLIVEIRA LTDA.zip\\x.xml', cad3).codigo, 299);
  igual('lote do SIEG: "… - EIRELI" é de três códigos: não decide', R.clienteDaPasta('2026-09\\TEOBALDO MENDES DE OLIVEIRA - EIRELI\\x.xml', cad3), null);
  const evT = evCte(chave('31', '2609', TRANSP, '57', 2582285));
  const dT = R.decidir({ nome: 'e.xml', rel: '2026-09\\TEOBALDO MENDES DE OLIVEIRA LTDA\\SIEG 2026-09 - TEOBALDO MENDES DE OLIVEIRA LTDA.zip\\e.xml', xml: evT }, ctx3);
  igual('evento de CT-e sem CNPJ de cliente, no lote do SIEG da 299: vai para a 299', [dT.acao, dT.cliente], ['ARQUIVAR', 299]);
  // DARF 0289 = INSS
  const darf = '1ªVia MINISTÉRIODAFAZENDA DocumentodeArrecadaçãodeReceitasFederais DARF 02PeríododeApuração15/10/2026 03NúmerodoCPFouCNPJ27.119.416/0002-60 04CódigodaReceita0289 01Nome/RazãoSocial OUROVERDEMINERACAOLTDA 06DatadeVencimento29/10/2026 07ValordoPrincipal631,38 10ValorTotal631,38';
  const dD = R.decidir({ nome: 'g.pdf', rel: 'g.pdf', texto: [darf] }, ctx3);
  igual('DARF 0289 com o texto colado: INSS', [dD.acao, dD.nomeFinal, dD.destinoRelativo], ['ARQUIVAR', '10-2026 - DARF INSS - VALOR R$631,38 - VENCIMENTO 29-10-2026.pdf', '409 - OURO VERDE MINERACAO LTDA - FILIAL 02\\FISCAL\\LUCRO PRESUMIDO\\05. DARF']);
  // FITO pelo nome escrito
  igual('"FITO IND. E COM." é a 292 (não a 294, mesmo nome)', R.clientesPeloNomeNoTexto('FITO IND. E COM. DE ALIMENTOS LTDA RELATÓRIO PERIÓDICO FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA', cad3), [292]);
  igual('"FITO A" é a 309', R.clientesPeloNomeNoTexto('PAGADOR FITO A', cad3), [309]);
  // informe trimestral
  const inf = 'Informe de Rendimentos Financeiro Terceiro trimestre 2026 Imposto de Renda - Pessoa Jurídica Pessoa jurídica beneficiária dos rendimentos CNPJ XTREME ACADEMIA ESPECIALIZADA LTDA 49.032.922/0001-70 Fonte pagadora: Nu Pagamentos S.A. - Instituição de Pagamento';
  const dI = R.decidir({ nome: 'v1.pdf', rel: 'v1.pdf', texto: [inf] }, ctx3);
  igual('informe trimestral: com o período no nome', [dI.acao, dI.nomeFinal], ['ARQUIVAR', '3º TRIMESTRE 2026 - INFORME DE RENDIMENTOS NUBANK.pdf']);
  // documento por funcionário
  const aso = 'Medicina e Segurança do Trabalho - CNPJ: 58.026.242/0001-34\nAtestado de Saúde Ocupacional\nEXAME\nEmpresa\nXTREME ACADEMIA ESPECIALIZADA LTDA - GRAU DE RISCO 2 - 49.032.922/0001-70\nSetor Função Data de Admissão\nADMINISTRATIVO INSTRUTOR | 02/06/2025\nFuncionário CPF Data de Nasc.\nTAMIRES DE SOUSA FERREIRA 187.654.226-86 02/05/2006\nExames Complementares\nO trabalhador acima identificado submeteu-se aos procedimentos\n| 0295 | Clinico ocupacional 17/10/2026 |';
  const dA = R.decidir({ nome: 'ASO-X.pdf', rel: 'ASO-X.pdf', texto: [aso] }, ctx3);
  igual('ASO: DEPARTAMENTO PESSOAL\\FUNCIONÁRIOS\\<nome>\\ASO <data do exame>.pdf', [dA.acao, dA.destinoRelativo, dA.nomeFinal], ['ARQUIVAR', '485 - XTREME ACADEMIA ESPECIALIZADA LTDA\\DEPARTAMENTO PESSOAL\\FUNCIONÁRIOS\\TAMIRES DE SOUSA FERREIRA', 'ASO 17-10-2026.pdf']);
  igual('ASO sem o nome legível: NÃO IDENTIFICADO', R.decidir({ nome: 'ASO-Y.pdf', rel: 'ASO-Y.pdf', texto: [aso.replace('TAMIRES DE SOUSA FERREIRA 187.654.226-86', '???')] }, ctx3).acao, 'NAO_IDENTIFICADO');
  // descarte confirmado e a planilha confirmada pelo hash
  igual('descarte confirmado pelo hash', R.decidir({ nome: 'x', rel: 'x', hash: '028a68a74d8caa4c0f467fc6acf818019496a492326c26c055b4e2be648f48bc' }, ctx3).acao, 'DESCARTAR');
  const cad4 = R.montarCadastro(LINHAS.concat({ codigo: 413, razao: 'BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA', doc: '33.117.361/0001-71', regime: 'Real' }), PASTAS.concat('413 - BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA'));
  const dP = R.decidir({ nome: 'Relatório_Set_26.xlsx', rel: '2026-10\\BC SAUDE LTDA\\Relatório_Set_26.xlsx', hash: 'd378ba6934daa35ef03df5c440a8d3319356924ff51f81318f2cb4e9109b6a1e', planilha: [['Relatório - Financeiro']] }, { cadastro: cad4, hoje: new Date(2026, 9, 23) });
  igual('planilha confirmada pelo hash, sem sub-regra: CONTÁBIL\\OUTROS DOCUMENTOS\\ano (04)', [dP.acao, dP.destinoRelativo, dP.nomeFinal], ['ARQUIVAR', '413 - BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA\\CONTÁBIL\\OUTROS DOCUMENTOS\\2026', 'Relatório_Set_26.xlsx']);

  // ---------- 14. "Para resolver" = o que está hoje em NÃO IDENTIFICADOS ----------
  const sp = path.join(tmp, 'resolver');
  const oP = path.join(sp, 'origem'), kP = path.join(sp, 'controle');
  fs.mkdirSync(path.join(oP, 'NÃO IDENTIFICADOS', '20261022-NOVO', '2026-09', 'X'), { recursive: true });
  fs.mkdirSync(kP, { recursive: true });
  fs.writeFileSync(path.join(kP, 'config.json'), JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0 }));
  fs.writeFileSync(path.join(oP, 'NÃO IDENTIFICADOS', '20261022-NOVO', '2026-09', 'X', 'fica.xml'), '<a/>');
  fs.writeFileSync(path.join(oP, 'NÃO IDENTIFICADOS', '20261022-NOVO', '_nao_identificados.jsonl'), [
    { arquivo: 'fica.xml', caminho_relativo: '2026-09\\X', motivo: 'CLIENTE_AMBIGUO', timestamp: '2026-10-22T19:00:00Z' },
    { arquivo: 'saiu.xml', caminho_relativo: '2026-09\\X', motivo: 'CLIENTE_NAO_LOCALIZADO', timestamp: '2026-10-22T19:00:01Z' },
    { arquivo: 'fica.xml', caminho_relativo: '2026-09\\X', motivo: 'EVENTO_SEM_ORIGINAL', chave: 'k', timestamp: '2026-10-22T21:00:00Z' }].map(x => JSON.stringify(x)).join('\n') + '\n');
  fs.writeFileSync(path.join(oP, 'NÃO IDENTIFICADOS', '20261022-NOVO', '2026-09', 'X', 'orfao.pdf'), 'pdf');
  const vP = C.iniciar(Object.assign({}, baseC, { origem: oP, controle: kP }));
  await vP.ciclo(); vP.parar();
  const acP = JSON.parse(fs.readFileSync(path.join(kP, 'continuo', 'acompanhamento.json'), 'utf8'));
  igual('Para resolver: o que está na pasta (com o motivo mais novo; sem linha no índice, entra assim mesmo)', [acP.pendentes.map(x => [x.nome, x.motivo]), acP.pendentesTotal], [[['orfao.pdf', 'SEM_MOTIVO_REGISTRADO'], ['fica.xml', 'EVENTO_SEM_ORIGINAL']], 2]);

  // ---------- 15. o ritmo pelo Google Drive e a varredura pela lista anterior + fs.watch (23/10/2026) ----------
  {
    const sr = path.join(tmp, 'ritmo'); const oR = path.join(sr, 'origem'), kR = path.join(sr, 'controle');
    fs.mkdirSync(path.join(oR, '2026-10'), { recursive: true }); fs.mkdirSync(kR, { recursive: true });
    fs.writeFileSync(path.join(kR, 'config.json'), JSON.stringify({ modo: 'simulacao', estavelMs: 0 }));
    fs.writeFileSync(path.join(oR, '2026-10', 'a.xml'), '<a/>'); fs.writeFileSync(path.join(oR, '2026-10', 'b.xml'), '<b/>');
    const vR = C.iniciar(Object.assign({}, baseC, { origem: oR, controle: kR, arvoreGrande: 0, umaVez: false }));
    vR._medirRitmo(70000, null);
    igual('ritmo: varredura de 70 s → lote de 10 e ciclo a cada 2 min', [vR._ritmo().nivel, vR._ritmo().proximoCicloEm > Date.now() + 100000], [1, true]);
    vR._medirRitmo(5000, 12000);
    igual('ritmo: 12 s por arquivo → lote de 5', vR._ritmo().nivel, 2);
    vR._medirRitmo(1000, 500); vR._medirRitmo(1000, 500);
    igual('ritmo: dois ciclos rápidos ainda não voltam', vR._ritmo().nivel, 2);
    vR._medirRitmo(1000, 500);
    igual('ritmo: o terceiro rápido volta um degrau', vR._ritmo().nivel, 1);
    const r1 = await vR.ciclo();
    igual('ritmo: ciclo antes da hora espera', /Google Drive lento/.test(r1.esperando || ''), true);
    // a varredura: a primeira inteira; depois, só o que o fs.watch avisou (o novo entra, o que saiu some)
    const nomes = l => l.map(x => x.rel).sort();
    igual('varredura: a primeira lista tudo', nomes(vR._varrer()), ['2026-10\\a.xml', '2026-10\\b.xml']);
    fs.writeFileSync(path.join(oR, '2026-10', 'c.xml'), '<c/>'); fs.unlinkSync(path.join(oR, '2026-10', 'a.xml'));
    await new Promise(r => setTimeout(r, 600));
    igual('varredura: pela lista anterior + fs.watch', nomes(vR._varrer()), ['2026-10\\b.xml', '2026-10\\c.xml']);
    vR.parar();
  }
} catch (e) { falhas++; console.log('FALHOU com erro:', e.stack); }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
process.exit(falhas ? 1 : 0);
})();
