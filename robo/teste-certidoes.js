// Testes do robô das certidões (certidoes.js) sem banco e sem portal: um portal de mentira e pedidos de mentira. Confere o
// caminho inteiro, a empresa que a prefeitura não conhece, o CNPJ trocado, o PDF que não sai, a trava do lote do dia e o
// encaixe na Central dos robôs. Dados inventados.
//   node teste-certidoes.js
'use strict';
const R = require('./certidoes');
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
const certidao = (cnpj = '99.888.777/0001-66') => 'PREFEITURA MUNICIPAL DE TAIOBEIRAS SECRETARIA DA FAZENDA CERTIDÃO NEGATIVA DE DÉBITOS Nº 1234/2026 '
  + 'Certifico, para os devido fins que: PADARIA FICTICIA LTDA CPF/CNPJ: ' + cnpj + ' não existe nesta repartição qualquer dívida '
  + 'Chave de Validação WEB: ab12cd34 Prefeitura Municipal de Taiobeiras, sexta-feira, 27 de novembro de 2026 VALIDADE: 90 dias';
const PDF = Buffer.from('%PDF-1.4 de mentira');

function pedido(id, dados) {
  const ref = { id, update: async o => { Object.assign(ref.estado, o); }, get: async () => ({ get: k => ref.estado[k] }) };
  ref.estado = Object.assign({ status: 'pendente' }, dados);
  return { ref, dados };
}
const base = (extra = {}) => Object.assign({ status: 'pendente', orgao: 'municipal', cnpj: CNPJ, codigo: 9001, empresa: 'PADARIA FICTICIA' }, extra);
function contexto(pedidos, emitir) {
  const resumos = new Map(), pdfs = [], dormiu = [];
  const o = {
    pedidos, log: () => {}, agora: () => Date.parse('2026-11-27T10:00:00-03:00'), dormir: async ms => { dormiu.push(ms); },
    portal: { emitir },
    gravarResumo: async (codigo, parcial) => { resumos.set(codigo, Object.assign(resumos.get(codigo) || {}, parcial)); },
    gravarPdf: async (p, nome, bytes) => { pdfs.push([p.codigo, nome, bytes.length]); return '2026-11/9001 - PADARIA FICTICIA/' + nome; },
  };
  return { o, resumos, pdfs, dormiu };
}

(async () => {
  igual('pedido bom', R.motivoDoPedidoRuim(base()), '');
  verdade('pedido de órgão que o robô ainda não emite', /ainda não emite/.test(R.motivoDoPedidoRuim(base({ orgao: 'tjmg' }))));
  verdade('a prefeitura sem a empresa', R.semCadastroNaPrefeitura('a prefeitura respondeu: Contribuinte não encontrado!'));
  igual('o código de emissão não é "sem cadastro"', R.semCadastroNaPrefeitura('Código de emissão não informado!'), false);
  igual('o dia e a hora em Brasília', R.diaEHora(Date.parse('2026-11-27T02:30:00Z')), { dia: '2026-11-26', hora: 23 });

  {
    const p1 = pedido('a', base()), p2 = pedido('b', base({ codigo: 9002 }));
    const { o, resumos, pdfs, dormiu } = contexto([p1, p2], async () => ({ texto: certidao(), pdf: PDF }));
    const r = await R.atenderPedidos(o);
    igual('o caminho inteiro: duas certidões', r.feitos, 2);
    igual('o pedido pronto com o vencimento', [p1.ref.estado.status, p1.ref.estado.resultado.vence, p1.ref.estado.resultado.negativa], ['pronto', '2027-02-25', true]);
    igual('o PDF com o nome do padrão das certidões', pdfs[0], [9001, 'CND - MUNICIPAL - Venc. 25.02.2027.pdf', PDF.length]);
    igual('o resumo da empresa', [resumos.get(9001).municipal.vence, resumos.get(9001).municipalSemCadastro], ['2027-02-25', '']);
    igual('20 s entre uma certidão e outra', dormiu, [20000]);
  }
  {
    const p1 = pedido('a', base());
    const { o, resumos } = contexto([p1], async () => ({ erro: 'a prefeitura respondeu: Contribuinte não encontrado!' }));
    await R.atenderPedidos(o);
    igual('sem cadastro na prefeitura: erro sem tentar de novo, e marcada', [p1.ref.estado.status, resumos.get(9001).municipalSemCadastro], ['erro', '2026-11-27']);
  }
  {
    const p1 = pedido('a', base());
    const { o, pdfs } = contexto([p1], async () => ({ texto: certidao('11.222.333/0001-81'), pdf: PDF }));
    await R.atenderPedidos(o);
    igual('a certidão de outro CNPJ: erro, nada salvo', [p1.ref.estado.status, /outro CNPJ/.test(p1.ref.estado.erro), pdfs.length], ['erro', true, 0]);
  }
  {
    const p1 = pedido('a', base());
    const { o } = contexto([p1], async () => ({ erro: 'o portal não abriu a certidão' }));
    await R.atenderPedidos(o);
    igual('o portal que falha: volta para a fila (até 3 vezes)', p1.ref.estado.status, 'pendente');
    const p2 = pedido('b', base({ tentativas: 2 }));
    const c2 = contexto([p2], async () => ({ texto: certidao(), pdf: Buffer.from('<html>') }));
    await R.atenderPedidos(c2.o);
    igual('o PDF que não sai, na 3ª: erro', [p2.ref.estado.status, p2.ref.estado.erro], ['erro', 'o PDF da certidão não saiu']);
  }

  {
    // o CRF do FGTS (27/11/2026): o mesmo atendimento, com o portal da Caixa
    const crf = 'Certificado de Regularidade do FGTS - CRF Inscrição: 99.888.777/0001-66 Razão social: PADARIA FICTICIA LTDA Endereço: X A Caixa '
      + 'certifica que, nesta data, a empresa acima identificada encontra-se em situação regular Validade: 09/11/2026 a 08/12/2026 Certificado Número: 2026110900000000000001';
    const p1 = pedido('a', base({ orgao: 'fgts' }));
    const { o, resumos, pdfs } = contexto([p1], async () => { throw new Error('não era para usar o portal da prefeitura'); });
    o.portais = { fgts: { emitir: async () => ({ texto: crf, pdf: PDF }) } };
    await R.atenderPedidos(o);
    igual('o CRF: pronto, com o nome do padrão e o resumo no fgts', [p1.ref.estado.status, pdfs[0] && pdfs[0][1], resumos.get(9001).fgts.vence], ['pronto', 'CRF - FGTS - Venc. 08.12.2026.pdf', '2026-12-08']);
    const p2 = pedido('b', base({ orgao: 'fgts' }));
    const c2 = contexto([p2], null);
    c2.o.portais = { fgts: { emitir: async () => ({ erro: 'a Caixa não deu o CRF: A empresa abaixo identificada NÃO está regular', final: true }) } };
    await R.atenderPedidos(c2.o);
    igual('a empresa irregular: erro direto, com o texto da Caixa', [p2.ref.estado.status, /NÃO está regular/.test(p2.ref.estado.erro)], ['erro', true]);
  }

  {
    // a trabalhista (27/11/2026): o captcha vai para o pedido; alguém responde; o robô envia e lê a CNDT
    const cndt = 'CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS Nome: PADARIA FICTICIA LTDA (MATRIZ E FILIAIS) CNPJ: 99.888.777/0001-66 Certidão nº: 12345678/2026 '
      + 'Expedição: 27/11/2026, às 15:00:00 Validade: 26/05/2027 - 180 (cento e oitenta) dias';
    const p1 = pedido('a', base({ orgao: 'trabalhista' }));
    const c1 = contexto([p1], null);
    let viuCaptcha = '';
    c1.o.portais = { trabalhista: { emitir: async (cnpj, ajuda) => {
      setTimeout(() => { viuCaptcha = p1.ref.estado.status + ' ' + p1.ref.estado.captchaImagem; p1.ref.estado.captchaResposta = 'ab12c'; }, 0);
      const resposta = await ajuda.pedirCaptcha('data:image/jpeg;base64,QUJD');
      return resposta === 'ab12c' ? { texto: cndt, pdf: PDF } : { erro: 'resposta ' + resposta };
    } } };
    c1.o.dormir = async () => { await new Promise(r => setTimeout(r, 1)); };
    await R.atenderPedidos(c1.o);
    igual('o captcha foi para o pedido (status captcha, com a imagem)', viuCaptcha, 'captcha data:image/jpeg;base64,QUJD');
    igual('a CNDT: pronta, com o nome do padrão e o resumo', [p1.ref.estado.status, c1.pdfs[0] && c1.pdfs[0][1], c1.resumos.get(9001).trabalhista.vence, p1.ref.estado.captchaImagem], ['pronto', 'CNDT - TRABALHISTA - Venc. 26.05.2027.pdf', '2027-05-26', '']);
    // ninguém responde em 10 min: volta para a fila
    const p2 = pedido('b', base({ orgao: 'trabalhista' }));
    const c2 = contexto([p2], null);
    let relogio = Date.parse('2026-11-27T10:00:00-03:00');
    c2.o.agora = () => relogio;
    c2.o.dormir = async ms => { relogio += ms; };
    c2.o.portais = { trabalhista: R.criarPortalTrabalhista(() => {}, async url => ({ json: async () => (/captcha/.test(url) ? { token: 't1', imagem: 'QUJD' } : {}) })) };
    await R.atenderPedidos(c2.o);
    igual('ninguém digitou em 10 min: volta para a fila, sem a imagem', [p2.ref.estado.status, /ninguém digitou/.test(p2.ref.estado.erro), p2.ref.estado.captchaImagem], ['pendente', true, '']);
  }
  {
    // a API do TST: o captcha errado pede outro; o PDF volta
    const chamadas = [];
    let vez = 0;
    const buscar = async (url, op) => {
      chamadas.push(url.replace('https://cndt-certidao.tst.jus.br', '') + (op ? ' ' + JSON.parse(op.body).resposta : ''));
      if (/captcha/.test(url)) return { json: async () => ({ token: 't' + (++vez), imagem: 'QUJD' }) };
      if (JSON.parse(op.body).resposta === 'errado') return { ok: false, status: 422, headers: { get: () => 'application/json' }, json: async () => ({ erro: 'Os caracteres da imagem não conferem.' }) };
      return { ok: true, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => new Uint8Array(PDF).buffer };
    };
    const respostas = ['errado', 'certo'];
    const r = await R.criarPortalTrabalhista(() => {}, buscar).emitir(CNPJ, { pedirCaptcha: async () => respostas.shift() });
    igual('o TST: captcha errado pede outro e o PDF volta', [chamadas, !!r.pdf], [['/api/captcha', '/api/certidao errado', '/api/captcha', '/api/certidao certo'], true]);
  }

  verdade('o lote não começa antes da primeira certidão boa', /nenhuma certidão/.test(R.motivoParaNaoPedir({ algumaPronta: false, ontem: null })));
  igual('o lote começa depois dela', R.motivoParaNaoPedir({ algumaPronta: true, ontem: null }), '');
  verdade('o lote para se ontem só deu erro', /só deu erro/.test(R.motivoParaNaoPedir({ algumaPronta: true, ontem: { total: 15, prontos: 0, erros: 15 } })));
  igual('o lote por dia é de 15', R.POR_DIA, 15);

  const doCatalogo = catalogo.robos.find(r => r.id === 'certidoes');
  verdade('o catálogo tem o robô das certidões, no servidor', doCatalogo && doCatalogo.maquina === 'servidor');
  igual('o catálogo e o robô usam a mesma coleção', doCatalogo && doCatalogo.itens.colecao, R.COLECAO);
  igual('os pedidos do catálogo são os que a central sabe fazer', (doCatalogo ? doCatalogo.pedidos : []).map(p => p.id).sort(),
    Object.keys(central.PEDIDOS_POR_CLIENTE).filter(k => k.startsWith('certidoes:')).map(k => k.slice(10)).sort());
  igual('cada pedido da central é um órgão que o robô emite', Object.keys(central.PEDIDOS_POR_CLIENTE).filter(k => k.startsWith('certidoes:')).map(k => R.motivoDoPedidoRuim(central.PEDIDOS_POR_CLIENTE[k].modelo({ codigo: '9001', nome: 'X', documento: CNPJ }, {}))), ['', '', '', '']);

  // ---------- a regra do certificado da SEF-MG (27/11/2026) ----------
  {
    const C = require('./chrome-certificado');
    const govbr = '{"pattern":"https://[*.]acesso.gov.br","filter":{"ISSUER":{"CN":"AC FICTICIA"}}}';
    const saida = ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls', '    1    REG_SZ    ' + govbr,
      '    2    REG_SZ    {"pattern":"https://x.gov.br","filter":{}}', ''].join('\r\n');
    igual('lê as regras do registro', C.lerSaidaDoReg(saida).map(e => e.nome), ['1', '2']);
    igual('a regra nova copia o filtro do gov.br, com o próximo número', C.regraNova(C.lerSaidaDoReg(saida), 'https://[*.]fazenda.mg.gov.br', 'fazenda.mg.gov.br'),
      { nome: '3', valor: '{"pattern":"https://[*.]fazenda.mg.gov.br","filter":{"ISSUER":{"CN":"AC FICTICIA"}}}' });
    const feitos = [];
    const rodar = (cmd, args) => { feitos.push(args[0]); if (args[0] === 'query' && /^HKLM/.test(args[1])) return saida; if (args[0] === 'query') throw new Error('sem a chave'); return ''; };
    verdade('grava no HKLM, onde está a do gov.br', /gravada em HKLM \(número 3, o filtro da do gov\.br\)/.test(C.garantirRegra('https://[*.]fazenda.mg.gov.br', 'fazenda.mg.gov.br', rodar)));
    igual('lê as duas chaves e grava uma vez', feitos, ['query', 'query', 'add']);
    const jaTem = (cmd, args) => (args[0] === 'query' && /^HKLM/.test(args[1]) ? saida + '    3    REG_SZ    {"pattern":"https://[*.]fazenda.mg.gov.br","filter":{}}\r\n' : (() => { throw new Error('x'); })());
    verdade('a regra que já existe não é mexida', /já existe/.test(C.garantirRegra('https://[*.]fazenda.mg.gov.br', 'fazenda.mg.gov.br', jaTem)));
    verdade('sem a do gov.br para copiar, avisa', /não achei a regra/.test(C.garantirRegra('p', 'fazenda.mg.gov.br', () => { throw new Error('nada'); })));
    // 27/11/2026: no servidor a do gov.br não está no registro; a regra sai pelo certificado e-CNPJ instalado
    const certs = ['CN=PESSOA FISICA:12345678901, OU=x|CN=AC QUALQUER, O=ICP-Brasil|2027-05-01',
      'CN=ESCRITORIO FICTICIO LTDA:99888777000166, OU=RFB e-CNPJ A1, O=ICP-Brasil|CN=AC FICTICIA RFB v5, O=ICP-Brasil|2027-03-10',
      'CN=ESCRITORIO FICTICIO LTDA:99888777000166, OU=RFB e-CNPJ A1|CN=AC FICTICIA RFB v5|2026-12-01'].join('\r\n');
    igual('o certificado e-CNPJ: o titular com CNPJ, o que vence por último', C.certificadoECnpj(certs), { titular: 'ESCRITORIO FICTICIO LTDA:99888777000166', emissor: 'AC FICTICIA RFB v5', vence: '2027-03-10' });
    igual('sem e-CNPJ, nada', C.certificadoECnpj('CN=PESSOA:12345678901|CN=AC|2027-01-01'), null);
    const gravados = [];
    const semRegra = (cmd, args) => {
      if (cmd === 'reg' && args[0] === 'query') throw new Error('sem a chave');
      if (cmd === 'powershell') return certs;
      if (cmd === 'reg' && args[0] === 'add') { gravados.push([args[1].slice(0, 4), args[3], args[7]]); return ''; }
      return '';
    };
    verdade('sem regra nenhuma: grava pelo certificado, no HKCU', /gravada em HKCU \(número 1, pelo certificado ESCRITORIO FICTICIO LTDA/.test(C.garantirRegra('https://[*.]fazenda.mg.gov.br', 'fazenda.mg.gov.br', semRegra)));
    igual('a regra gravada pelo certificado', gravados, [['HKCU', '1', '{"pattern":"https://[*.]fazenda.mg.gov.br","filter":{"ISSUER":{"CN":"AC FICTICIA RFB v5"},"SUBJECT":{"CN":"ESCRITORIO FICTICIO LTDA:99888777000166"}}}']]);
  }
  igual('o pedido da central sai no formato do robô', R.motivoDoPedidoRuim(central.PEDIDOS_POR_CLIENTE['certidoes:municipal'].modelo({ codigo: '9001', nome: 'X', documento: CNPJ }, {})), '');
  verdade('a fila do painel é a do catálogo', painel.FILAS.pc.some(f => f.id === 'certidoes' && f.colecao === R.COLECAO));

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'ok: ' + total + ' testes do robô das certidões'));
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
