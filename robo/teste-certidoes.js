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
  const ref = { id, update: async o => { Object.assign(ref.estado, o); } };
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
  verdade('pedido de órgão que o robô ainda não emite', /ainda não emite/.test(R.motivoDoPedidoRuim(base({ orgao: 'estadual' }))));
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

  verdade('o lote não começa antes da primeira certidão boa', /nenhuma certidão/.test(R.motivoParaNaoPedir({ algumaPronta: false, ontem: null })));
  igual('o lote começa depois dela', R.motivoParaNaoPedir({ algumaPronta: true, ontem: null }), '');
  verdade('o lote para se ontem só deu erro', /só deu erro/.test(R.motivoParaNaoPedir({ algumaPronta: true, ontem: { total: 15, prontos: 0, erros: 15 } })));
  igual('o lote por dia é de 15', R.POR_DIA, 15);

  const doCatalogo = catalogo.robos.find(r => r.id === 'certidoes');
  verdade('o catálogo tem o robô das certidões, no servidor', doCatalogo && doCatalogo.maquina === 'servidor');
  igual('o catálogo e o robô usam a mesma coleção', doCatalogo && doCatalogo.itens.colecao, R.COLECAO);
  igual('os pedidos do catálogo são os que a central sabe fazer', (doCatalogo ? doCatalogo.pedidos : []).map(p => p.id),
    Object.keys(central.PEDIDOS_POR_CLIENTE).filter(k => k.startsWith('certidoes:')).map(k => k.slice(10)));
  igual('o pedido da central sai no formato do robô', R.motivoDoPedidoRuim(central.PEDIDOS_POR_CLIENTE['certidoes:municipal'].modelo({ codigo: '9001', nome: 'X', documento: CNPJ }, {})), '');
  verdade('a fila do painel é a do catálogo', painel.FILAS.pc.some(f => f.id === 'certidoes' && f.colecao === R.COLECAO));

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'ok: ' + total + ' testes do robô das certidões'));
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
