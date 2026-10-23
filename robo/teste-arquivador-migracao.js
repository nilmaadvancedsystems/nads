// Testes da migração e da raiz pelo ano (Vitor, 23/10/2026). Rode:  node teste-arquivador-migracao.js
// Sem Drive e sem banco: as raízes de ano e a origem são temporárias.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const K = require('./arquivador-chaves');
const MIG = require('./arquivador-migracao');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

const LINHAS = [
  { codigo: 10, razao: 'DORNAS HAVANA LTDA', doc: '36.462.778/0001-60', regime: 'Simples' },
  { codigo: 66, razao: 'ADERLEI DOS SANTOS & CIA LTDA', doc: '03.149.551/0001-00', regime: 'Presumido' },
  { codigo: 161, razao: 'FERNANDO EXEMPLO DA SILVA', doc: '11.426.314/0001-77', regime: 'Simples' },
  { codigo: 413, razao: 'BRAZILIAN FLORESTAL LTDA', doc: '11.536.337/0001-70', regime: 'Presumido' },
  { codigo: 3, razao: 'TRES COMERCIO LTDA', doc: '27.872.981/0001-13', regime: 'Simples' },
];
const PASTAS = ['10 - DORNAS HAVANA LTDA', '66 - ADERLEI DOS SANTOS E CIA', '161 - FERNANDO EXEMPLO', '413 - BRAZILIAN', '3 - TRES'];
const mapa = MIG.carregar({});   // o versionado (sem o do controle)
const montar = porAno => R.comAnosEMapa(R.montarCadastro(LINHAS, PASTAS), porAno || {}, mapa);

// ---------- 1. o ano pelas pastas de origem ----------
igual('ano: pasta "2024"', R.anoDaPasta('0010 - DORNAS\\DEPARTAMENTO FISCAL\\DESTDA\\2024\\04-2024.pdf'), { ano: 2024 });
igual('ano: "2025\\03.2025" (a mais funda, com o mês)', R.anoDaPasta('FERNANDO\\411 MINAS\\2025\\03.2025\\Comprovantes\\x.pdf'), { ano: 2025, mes: 3 });
igual('ano: "2026\\03\\Importados" (o mês na pasta seguinte)', R.anoDaPasta('IMPORTAÇÃO\\0066 - ADERLEI\\2026\\03\\Importados\\x.xml'), { ano: 2026, mes: 3 });
igual('ano: sem pasta de ano', R.anoDaPasta('0049 - POSTO\\DOCUMENTO CONSTITUTIVOS\\CNH.pdf'), null);
igual('ano: o "2021" no meio de outro nome não vale', R.anoDaPasta('0291 - GAS\\LICITAÇÃO\\PREF. DIVISA ALEGRE CRED. 001-2021\\x.pdf'), null);

// ---------- 2. o cliente pela pasta de origem ----------
const cad = montar();
const cp = rel => { const r = R.clienteDaPasta(rel, cad); return r ? [r.codigo, !!r.forte] : null; };
igual('cliente: "0010 - DORNAS HAVANA LTDA - ME" = 10, código E nome conferem (forte)', cp('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DESTDA\\2024\\04-2024.pdf'), [10, true]);
igual('cliente: a pasta de mês "03" não é o cliente 3', cp('IMPORTAÇÃO\\0066 - ADERLEI DOS SANTOS & CIA LTDA - EPP\\2026\\03\\Importados\\x.xml'), [66, true]);
igual('cliente: a pasta FERNANDO (da equipe) não dá a 161', cp('FERNANDO\\RATEIO.xlsx'), null);
igual('cliente: a pasta da matriz com as filiais não dá o cliente (mapa)', cp('FERNANDO\\413 BRAZILIAN filiais 414.  418. 453\\2025\\03.2025\\x.pdf'), null);
igual('cliente: o código sem o nome do cadastro é pista fraca', cp('0010 - OUTRO NOME QUALQUER\\x.pdf'), [10, false]);

// ---------- 3. o índice de chaves lê o destino em qualquer raiz de ano ----------
igual('chaves: destino na raiz de 2024', K.lerDestino('G:\\Meu Drive\\2024\\10 - DORNAS\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e\\a.xml', 'G:\\Meu Drive\\2026'), { cliente: 10, sub: ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e'], de: 'doc' });
igual('chaves: fora das raízes de ano não vale', K.lerDestino('C:\\x\\10 - X\\a.pdf', 'G:\\Meu Drive\\2026'), null);

// ---------- 4. a raiz pelo ano da competência ----------
const ctx = { cadastro: montar(), hoje: new Date(2026, 9, 23) };
const nfe = (emit, dest, n, data) => '<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="x"><ide><mod>55</mod><nNF>' + n + '</nNF><dhEmi>' + data + '</dhEmi></ide><emit><CNPJ>' + emit + '</CNPJ><xNome>X</xNome></emit><dest><CNPJ>' + dest + '</CNPJ></dest></infNFe></NFe></nfeProc>';
let d = R.decidir({ nome: 'n.xml', rel: 'IMPORTAÇÃO\\0010 - DORNAS HAVANA LTDA - ME\\2024\\04\\n.xml', xml: nfe('36462778000160', '99999999000191', 5, '2024-04-10T10:00:00-03:00') }, ctx);
igual('XML de 2024: raiz 2024, pasta do cliente nasce com o CNPJ (o mesmo nome da de 2026)', [d.acao, d.anoRaiz, d.pastaCliente, d.criarPastaCliente], ['ARQUIVAR', 2024, '10 - DORNAS HAVANA LTDA', true]);
d = R.decidir({ nome: 'n2.xml', rel: 'n2.xml', xml: nfe('36462778000160', '99999999000191', 6, '2024-05-10T10:00:00-03:00') }, ctx);
igual('a pasta de 2024 que nasceu vale para o próximo (não nasce de novo)', [d.acao, d.anoRaiz, d.criarPastaCliente], ['ARQUIVAR', 2024, false]);
d = R.decidir({ nome: 'n3.xml', rel: 'n3.xml', xml: nfe('36462778000160', '99999999000191', 7, '2012-05-10T10:00:00-03:00') }, ctx);
igual('ano antes de 2015: NÃO IDENTIFICADOS', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'ANO_FORA_DA_FAIXA']);
d = R.decidir({ nome: 'contrato.pdf', rel: '0010 - DORNAS HAVANA LTDA - ME\\DOCUMENTO CONSTITUTIVOS\\contrato.pdf', texto: ['CONTRATO SOCIAL\nDORNAS HAVANA LTDA\nCNPJ 36.462.778/0001-60'] }, ctx);
igual('sem competência nem ano na pasta: NÃO IDENTIFICADOS (nunca 2026 por padrão)', [d.acao, d.motivo, d.cliente], ['NAO_IDENTIFICADO', 'ANO_INDETERMINADO', 10]);

// as declarações anuais na raiz do ano da ENTREGA (Vitor, 23/10/2026: "a DEFIS de 2025 entregue em 2026 vai para 2026")
const anual = (tipo, comp, anoEntrega) => R.finalizar({ acao: 'ARQUIVAR', cliente: 10, comoCliente: 'doc', confianca: 0.97, tipo, caminho: ['FISCAL', 'SIMPLES NACIONAL', '14. DEFIS'], nomeFinal: 'x.pdf', competencia: comp, anoEntrega, evidencias: [] }, { cadastro: montar(), hoje: new Date(2026, 9, 23) }).anoRaiz;
igual('DEFIS de 2025: raiz de 2026 (a entrega); a de 2021: 2022; com o recibo de 2023: 2023; a mensal fica no ano dela', [anual('DEFIS', { ano: 2025 }), anual('DEFIS', { ano: 2021 }), anual('DEFIS', { ano: 2021 }, 2023), anual('BALANCETE', { ano: 2024, mes: 9 })], [2026, 2022, 2023, 2024]);
igual('o recibo: a data da transmissão', R.anoDaEntrega({ texto: ['Recibo de entrega da DEFIS\nData e hora da transmissão: 27/03/2026 10:11'] }), 2026);

// ---------- 5. o tipo pela pasta de origem (o mapa da migração) ----------
const decidirMig = (rel, texto, c) => { const e = { nome: path.win32.basename(rel), rel, texto: [texto] }; const c2 = c || ctx; const d0 = R.decidir(e, c2); return MIG.decidir(e, c2, d0) || d0; };
d = decidirMig('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DESTDA\\2024\\04-2024.pdf', 'recibo de entrega sem titulo conhecido', { cadastro: montar({ 2024: ['10 - DORNAS HAVANA LTDA'] }), hoje: new Date(2026, 9, 23) });
igual('DESTDA pela pasta: 2024\\10 - DORNAS…\\FISCAL\\SIMPLES NACIONAL\\04. DeSTDA\\04-2024.pdf', [d.acao, d.anoRaiz, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', 2024, '10 - DORNAS HAVANA LTDA\\FISCAL\\SIMPLES NACIONAL\\04. DeSTDA', '04-2024.pdf']);
d = decidirMig('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DESTDA\\2023\\04-2023.pdf', 'recibo de entrega\nCNPJ 36.462.778/0001-60\nDORNAS HAVANA LTDA');
igual('com o CNPJ no conteúdo (o mesmo da pasta): a pasta do ano nasce', [d.acao, d.anoRaiz, d.criarPastaCliente], ['ARQUIVAR', 2023, true]);
// 23/10/2026 (Vitor): sem o CNPJ, o cliente da pasta de origem com o código E o nome conferidos também faz a pasta do ano nascer
d = decidirMig('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DESTDA\\2022\\04-2022.pdf', 'recibo de entrega sem titulo conhecido');
igual('sem o CNPJ, a pasta de origem conferida (código e nome) faz a pasta do ano nascer', [d.acao, d.anoRaiz, d.criarPastaCliente], ['ARQUIVAR', 2022, true]);
d = decidirMig('0010 - OUTRO NOME\\DEPARTAMENTO FISCAL\\DESTDA\\2021\\04-2021.pdf', 'recibo de entrega sem titulo conhecido');
igual('só o código na pasta (o nome não confere): a pasta do ano não nasce', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'CLIENTE_NAO_LOCALIZADO']);
// as mensagens da SEFAZ: quarentena; a inutilização: ao lado dos XML do cliente, em INUTILIZAÇÕES
d = R.decidir({ nome: '20260219080318-ped-sta-soap.xml', rel: 'IMPORTAÇÃO\\0010 - DORNAS HAVANA LTDA - ME\\Adicionados\\20260219080318-ped-sta-soap.xml', xml: '<soap:Envelope xmlns:soap="x"><soap:Body><nfeDadosMsg><consStatServ><tpAmb>1</tpAmb></consStatServ></nfeDadosMsg></soap:Body></soap:Envelope>' }, ctx);
igual('mensagem da SEFAZ (consulta do status): quarentena', [d.acao, d.motivo], ['DESCARTAR', 'MENSAGEM_DA_SEFAZ']);
d = R.decidir({ nome: '5358-pro-lot.xml', rel: 'x\\5358-pro-lot.xml', xml: '<retConsReciNFe><cStat>104</cStat></retConsReciNFe>' }, ctx);
igual('retorno do lote: quarentena', d.acao, 'DESCARTAR');
const inut = '<procInutNFe><inutNFe><infInut Id="ID3126"><tpAmb>1</tpAmb><xServ>INUTILIZAR</xServ><cUF>31</cUF><ano>26</ano><CNPJ>36462778000160</CNPJ><mod>65</mod><serie>1</serie><nNFIni>2130803</nNFIni><nNFFin>2130805</nNFFin><xJust>falha</xJust></infInut></inutNFe><retInutNFe><infInut><cStat>102</cStat><dhRecbto>2026-03-14T10:00:00-03:00</dhRecbto><nProt>131260000000001</nProt></infInut></retInutNFe></procInutNFe>';
d = R.decidir({ nome: 'x-InutNFe.xml', rel: 'IMPORTAÇÃO\\x-InutNFe.xml', xml: inut }, ctx);
igual('inutilização: XML\\NFC-e\\INUTILIZAÇÕES, o nome com a data e a faixa', [d.acao, d.cliente, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', 10, '10 - DORNAS HAVANA LTDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFC-e\\INUTILIZAÇÕES', '14-03-2026 - INUTILIZACAO NFC-e 2130803 A 2130805 SERIE 1.xml']);
d = decidirMig('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DESTDA\\2024\\04-2024.pdf', 'recibo de entrega\nCNPJ 03.149.551/0001-00');
igual('o conteúdo diz outro cliente que a pasta: NÃO IDENTIFICADOS', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'PISTA_DA_PASTA_DIVERGE']);
d = decidirMig('0066 - ADERLEI DOS SANTOS & CIA LTDA - EPP\\DEPARTAMENTO FISCAL\\DESTDA\\2026\\02-2026.pdf', 'recibo de entrega sem titulo conhecido');
igual('DESTDA num cliente do Presumido: a árvore do regime não tem a pasta', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'TIPO_INCOMPATIVEL_COM_REGIME']);
d = decidirMig('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH\\2023\\12-2023.pdf', 'recibo de entrega da declaracao municipal sem titulo conhecido pelas regras');
igual('pasta sem equivalente no mapa (DES - BH): fica como as regras deixaram', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'TIPO_NAO_RECONHECIDO']);
{
  const ctx24 = { cadastro: montar({ 2024: ['10 - DORNAS HAVANA LTDA'] }), hoje: new Date(2026, 9, 23) };
  const e = { nome: 'DAE ICMS ANTECIPADO REF. 10.2024.pdf', rel: '0010 - DORNAS HAVANA LTDA - ME\\ADIVANIA\\Impostos\\DAE ICMS ANTECIPADO REF. 10.2024.pdf', texto: ['x'] };
  d = MIG.decidir(e, ctx24, { acao: 'NAO_IDENTIFICADO', motivo: 'COMPETENCIA_AUSENTE', tipo: 'DAE', cliente: 10, comoCliente: 'doc', evidencias: [] });
  igual('o conteúdo disse DAE e faltou só a competência: o nome do arquivo dá (10.2024)', [d.acao, d.anoRaiz, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', 2024, '10 - DORNAS HAVANA LTDA\\FISCAL\\SIMPLES NACIONAL\\02. DAE', '10-2024 - DAE - DAE ICMS ANTECIPADO REF. 10.2024.pdf']);
}
igual('o grupo: o motivo e a pasta de origem sem as de data', MIG.chaveDoGrupo('TIPO_NAO_RECONHECIDO', '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH\\2023\\12-2023.pdf'), { motivo: 'TIPO_NAO_RECONHECIDO', pasta: '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH' });

// ---------- 6. o executor: o destino na raiz do ano (simulação e produção, numa pasta temporária) ----------
(async () => {
  const sb = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'teste-migracao-'));
  try {
    const origem = path.join(sb, 'Claudio Secretario'), clientes = path.join(sb, '2026'), controle = path.join(sb, 'controle');
    for (const p of PASTAS) fs.mkdirSync(path.join(clientes, p), { recursive: true });
    fs.mkdirSync(path.join(origem, 'IMPORTAÇÃO', '0010 - DORNAS HAVANA LTDA - ME', '2024', '04'), { recursive: true });
    fs.mkdirSync(controle, { recursive: true });
    const rel = 'IMPORTAÇÃO\\0010 - DORNAS HAVANA LTDA - ME\\2024\\04\\n.xml';
    fs.writeFileSync(path.join(origem, rel), nfe('36462778000160', '99999999000191', 5, '2024-04-10T10:00:00-03:00'));
    const cadE = A.carregarCadastro({ controle, clientes, planilha: path.join(sb, 'sem.xlsx') });
    const cad2 = R.comAnosEMapa(R.montarCadastro(LINHAS, PASTAS), cadE.pastasPorAno, mapa);
    const base = { origem, clientes, controle, cadastro: cad2, manifesto: new Map(), manifestoAntigo: path.join(sb, 'sem.jsonl'), arquivos: [rel], registrar: false, travaAntiga: path.join(sb, 'sem.lock') };
    const s = await A.executar(Object.assign({}, base, { modo: 'SIMULACAO' }));
    igual('executor: em simulação o destino é a raiz de 2024 (irmã da de 2026)', s.itens[0].onde, path.join(sb, '2024', '10 - DORNAS HAVANA LTDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e', '04-2024_NF-e_5.xml'));
    const p = await A.executar(Object.assign({}, base, { modo: 'PRODUCAO', confirmo: true, cadastro: R.comAnosEMapa(R.montarCadastro(LINHAS, PASTAS), cadE.pastasPorAno, mapa) }));
    igual('executor: em produção o original foi para 2024 por rename, a pasta do cliente em 2024 nasceu', [p.itens[0].acao, fs.existsSync(path.join(sb, '2024', '10 - DORNAS HAVANA LTDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e', '04-2024_NF-e_5.xml')), fs.existsSync(path.join(origem, rel))], ['ARQUIVAR', true, false]);
    const man = fs.readFileSync(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    igual('executor: o manifesto marca a pasta do cliente criada', [man[0].pasta_cliente_criada, man[0].movido], [true, true]);
    igual('cadastro: lê as pastas de cliente das raízes de ano que existem', [...A.carregarCadastro({ controle, clientes, planilha: path.join(sb, 'sem.xlsx') }).pastasPorAno.get(2024)], ['10 - DORNAS HAVANA LTDA']);
    // ---------- 6b. vários destinos ao mesmo tempo (23/10/2026): 20 notas e 4 repetidas, 8 juntos ----------
    {
      const op = path.join(sb, 'par', 'origem'), kp = path.join(sb, 'par', 'controle'), cp = path.join(sb, 'par', '2026');
      for (const p2 of PASTAS) fs.mkdirSync(path.join(cp, p2), { recursive: true });
      fs.mkdirSync(op, { recursive: true }); fs.mkdirSync(kp, { recursive: true });
      const rels = [];
      for (let i = 1; i <= 20; i++) { const r = 'n' + i + '.xml'; fs.writeFileSync(path.join(op, r), nfe('36462778000160', '99999999000191', i, '2026-0' + (1 + (i % 9)) + '-10T10:00:00-03:00')); rels.push(r); }
      for (let i = 1; i <= 4; i++) { const r = 'repetida' + i + '.xml'; fs.writeFileSync(path.join(op, r), nfe('36462778000160', '99999999000191', i, '2026-0' + (1 + (i % 9)) + '-10T10:00:00-03:00')); rels.push(r); }
      const cadP = R.comAnosEMapa(R.montarCadastro(LINHAS, PASTAS), {}, mapa);
      const resP = await A.executar({ modo: 'PRODUCAO', confirmo: true, origem: op, clientes: cp, controle: kp, cadastro: cadP, manifesto: new Map(), manifestoAntigo: path.join(sb, 'sem.jsonl'), arquivos: rels, registrar: false, travaAntiga: path.join(sb, 'sem.lock'), destinosJuntos: 8 });
      const acoes = {}; for (const x of resP.itens) acoes[x.acao + (x.erro ? ' erro' : '')] = (acoes[x.acao + (x.erro ? ' erro' : '')] || 0) + 1;
      const noDestino = fs.readdirSync(path.join(cp, '10 - DORNAS HAVANA LTDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e'));
      igual('8 juntos: as 20 notas no destino, as 4 repetidas para a quarentena, a origem vazia, sem erro', [acoes, noDestino.length, fs.readdirSync(op).length], [{ ARQUIVAR: 20, JA_ARQUIVADO: 4 }, 20, 0]);
    }
    // ---------- 7. Para resolver em grupos: o grupo, a prévia, arquivar o grupo e lembrar a pasta ----------
    {
      const C = require('./arquivador-continuo');
      const P = require('./arquivador-pedidos');
      const og = path.join(sb, 'g', 'Claudio Secretario'), kg = path.join(sb, 'g', 'controle'), cg = path.join(sb, 'g', '2026');
      for (const p2 of PASTAS) fs.mkdirSync(path.join(cg, p2), { recursive: true });
      fs.mkdirSync(path.join(cg, '..', '2024', '10 - DORNAS HAVANA LTDA'), { recursive: true });
      fs.mkdirSync(kg, { recursive: true });
      fs.writeFileSync(path.join(kg, 'config.json'), JSON.stringify({ modo: 'desligado' }));
      const dirNi = path.join(og, 'NÃO IDENTIFICADOS', '20261023-NOVO', '0010 - DORNAS HAVANA LTDA - ME', 'DEPARTAMENTO FISCAL', 'DES - BH', '2024');
      fs.mkdirSync(dirNi, { recursive: true });
      const linhasNi = [];
      for (const n of ['01-2024.pdf', '02-2024.pdf', '03-2024.pdf', '04-2024.pdf']) {
        fs.writeFileSync(path.join(dirNi, n), '%PDF-1.4 recibo ' + n);
        linhasNi.push(JSON.stringify({ arquivo: n, caminho_relativo: '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH\\2024', motivo: 'TIPO_NAO_RECONHECIDO', timestamp: new Date().toISOString() }));
      }
      fs.writeFileSync(path.join(og, 'NÃO IDENTIFICADOS', '20261023-NOVO', '_nao_identificados.jsonl'), linhasNi.join('\n') + '\n');
      const cadG = R.comAnosEMapa(R.montarCadastro(LINHAS, PASTAS), { 2024: ['10 - DORNAS HAVANA LTDA'] }, MIG.carregar({ controle: kg }));
      const vg = C.iniciar({ origem: og, controle: kg, clientes: cg, controleAntigo: path.join(sb, 'g', 'sem-rotina'), cadastro: cadG, umaVez: true, log: () => {} });
      await vg._conferirNaoIdentificados(true);
      const grupos = [...vg._grupos().values()];
      igual('grupos: os 4 recibos da mesma pasta e causa num grupo só', grupos.map(g => [g.n, g.motivo, g.pasta]), [[4, 'TIPO_NAO_RECONHECIDO', '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH']]);
      igual('grupos: a sugestão do cliente pela pasta (código e nome conferidos)', grupos[0].sugestao, { codigo: 10, tipoDoc: null });
      vg.parar();   // o acompanhamento grava o que falta ao desligar (os grupos, no painel)
      await new Promise(r => setTimeout(r, 100));
      const acG = JSON.parse(fs.readFileSync(path.join(kg, 'continuo', 'acompanhamento.json'), 'utf8'));
      igual('grupos: vão para o painel do site (com 3 exemplos)', [acG.grupos.length, acG.grupos[0].n, acG.grupos[0].exemplos.length, acG.grupos[0].motivoTexto], [1, 4, 3, 'Tipo de documento desconhecido']);
      // o pedido de grupo, pelo executor de verdade (o mesmo do contínuo), com um banco de mentira
      const docs = new Map();
      const docRef = c => ({ set: async (d, op) => { docs.set(c, Object.assign(op && op.merge ? (docs.get(c) || {}) : {}, d)); }, collection: n => ({ doc: id => docRef(c + '/' + n + '/' + id) }) });
      const db = { collection: n => ({ doc: id => docRef(n + '/' + id), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }) };
      const executar = async (rel, escolha, modo) => {
        const res = await A.executar({ modo, confirmo: true, origem: og, controle: kg, clientes: cg, arquivos: [rel], manual: { [rel]: escolha }, cadastro: cadG, manifesto: new Map(), manifestoAntigo: path.join(sb, 'sem.jsonl'), tiposProducao: ['todos'], registrar: false, travaAntiga: path.join(sb, 'sem.lock') });
        return A.planos(res).find(x => x.rel === rel) || res.itens[0];
      };
      const fila = P.criar({ db: null, origem: og, clientes: cg, executar, grupo: id => vg._grupos().get(id) || null, lembrar: e => vg._lembrar(e) });
      const pedido = (tipo, extra) => Object.assign({ tipo, rel: grupos[0].pasta, hash: grupos[0].id, codigo: 10, tipoDoc: 'OUTROS', pedidoPor: 'Vitor', status: 'pendente' }, extra || {});
      const filaDb = P.criar({ db, origem: og, clientes: cg, executar, grupo: id => vg._grupos().get(id) || null, lembrar: e => vg._lembrar(e) });
      await filaDb.tratar('p1', pedido('grupoPrevia'));
      const r1 = docs.get('pedidosArquivador/p1');
      igual('grupo: a prévia dos 3 primeiros (o ano de cada um pelo nome: raiz 2024)', [r1.status, r1.resposta.total, r1.resposta.exemplos.length, r1.resposta.exemplos[0].destino], ['pronto', 4, 3, '2024\\10 - DORNAS HAVANA LTDA\\CONTÁBIL\\OUTROS DOCUMENTOS\\2024\\01-2024.pdf']);
      await filaDb.tratar('p2', pedido('grupo', { lembrar: true }));
      const r2 = docs.get('pedidosArquivador/p2');
      igual('grupo: os 4 arquivados de uma vez e a decisão lembrada', [r2.status, r2.resposta.feitos, r2.resposta.erros, r2.resposta.lembrou, fs.readdirSync(dirNi).length], ['feito', 4, 0, true, 0]);
      const mapaLocal = JSON.parse(fs.readFileSync(path.join(kg, 'mapa-migracao.json'), 'utf8'));
      igual('grupo: o mapa do controle guarda a pasta do cliente e o tipo da pasta', [mapaLocal.clientes[0].pasta, mapaLocal.clientes[0].cliente, mapaLocal.tipos[0].pasta, mapaLocal.tipos[0].tipoDoc], ['0010 - DORNAS HAVANA LTDA - ME', 10, '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH', 'OUTROS']);
      const m2 = MIG.carregar({ controle: kg });
      igual('grupo: o próximo da mesma pasta já sai pelo mapa', m2.tipoDaOrigem('0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH\\2025\\05-2025.pdf'), { tipoDoc: 'OUTROS', pasta: '0010 - DORNAS HAVANA LTDA - ME\\DEPARTAMENTO FISCAL\\DES - BH', porque: mapaLocal.tipos[0].porque });
      fila.parar(); filaDb.parar();
    }
  } catch (e) { falhas++; console.log('FALHOU com erro:', e.stack); }
  finally { fs.rmSync(sb, { recursive: true, force: true }); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
