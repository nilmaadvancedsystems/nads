// Testes das guias dos lotes na Área do Cliente (plano do Acessórias, 17/11/2026, ficha todas-as-guias; frase do dono:
// "Todas as guias (robô)"). Rode antes de publicar:  node teste-guias-dos-lotes.js
// Não acessa o banco nem o Drive: um banco de mentira em memória. As dependências de fora (pdf-parse, firebase-admin…)
// que faltarem nesta máquina viram um módulo vazio só aqui, porque estas funções não as usam.
const Module = require('module');
const fs = require('fs');
const path = require('path');
const carregar = Module._load;
Module._load = function (pedido, pai, ...resto) {
  try { return carregar.call(this, pedido, pai, ...resto); } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND' && !pedido.startsWith('.')) return new Proxy({}, { get: () => () => ({}) });
    throw e;
  }
};
const N = require('./envios-do-nads');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// um banco de mentira: areasClientePorEmpresa/{codigo} e areasCliente/{token}/guias/{id}/pdf/{n}
function bancoDeMentira(links) {
  const docs = new Map(); // caminho -> dados
  const colecao = (base) => ({
    doc: id => {
      const caminho = base + '/' + id;
      return {
        caminho,
        get: async () => ({ exists: docs.has(caminho), data: () => docs.get(caminho) }),
        set: async d => { docs.set(caminho, d); },
        collection: nome => colecao(caminho + '/' + nome),
      };
    },
    get: async () => ({ docs: [...docs.keys()].filter(k => k.startsWith(base + '/') && !k.slice(base.length + 1).includes('/')).map(k => ({ id: k.split('/').pop(), ref: { delete: async () => docs.delete(k) } })) }),
  });
  for (const [codigo, tokens] of Object.entries(links)) docs.set('areasClientePorEmpresa/' + codigo, { tokens });
  return { collection: nome => colecao(nome), docs };
}

const nada = () => {};
const pdf = Buffer.from('%PDF-1.4 guia');

(async () => {
  // ---------- 1. o id e a guia do item do lote ----------
  igual('o id do DAS é o mesmo do envio pelo nads', N.idDaGuiaDoCliente({ tipo: 'DAS', competencia: '2026-10', codigo: '58' }), 'das-2026-10-58');
  igual('o id da DARF leva o tributo', N.idDaGuiaDoCliente({ tipo: 'DARF', tributo: 'INSS', competencia: '2026-10', codigo: '58' }), 'darf-inss-2026-10-58');
  igual('o tributo com barra vira hífen', N.idDaGuiaDoCliente({ tipo: 'DARF', tributo: 'PIS/COFINS', competencia: '2026-10', codigo: 58 }), 'darf-pis-cofins-2026-10-58');
  const vai = (extra) => Object.assign({ tipo: 'DARF', tributo: 'irrf', valor: 120.5, competencia: '2026-10', codigo: 58, nome: '10-2026 - DARF IRRF.pdf' }, extra || {});
  igual('a DARF do lote', N.guiaDoLote(vai(), { vencimento: '19/11/2026' }),
    { tipo: 'DARF', tributo: 'IRRF', vencimento: '19/11/2026', valor: 120.5, competencia: '2026-10', codigo: '58' });
  igual('o DAS não leva tributo', N.guiaDoLote(vai({ tipo: 'DAS', tributo: 'x' }), { vencimento: '23/11/2026' }).tributo, undefined);
  igual('o valor em texto também serve', N.guiaDoLote(vai({ valor: 'R$ 1.234,56' }), { vencimento: '19/11/2026' }).valor, 1234.56);
  igual('sem vencimento lido: não vai', N.guiaDoLote(vai(), {}), null);
  igual('vencimento torto: não vai', N.guiaDoLote(vai(), { vencimento: '31/02/2026' }), null);
  igual('sem valor: não vai', N.guiaDoLote(vai({ valor: null }), { vencimento: '19/11/2026' }), null);
  igual('o FGTS não é guia do lote para a Área', N.guiaDoLote(vai({ tipo: 'FGTS' }), { vencimento: '19/11/2026' }), null);
  igual('holerite não é guia', N.guiaDoLote(vai({ tipo: 'HOLERITE' }), { vencimento: '19/11/2026' }), null);

  // ---------- 2. a gravação no espelho ----------
  const db = bancoDeMentira({ 58: ['tokenA', 'tokenB'] });
  const itens = [
    { vai: vai(), leitura: { vencimento: '19/11/2026' } },
    { vai: vai({ tributo: 'INSS', valor: 900 }), leitura: { vencimento: '19/11/2026' } },
    { vai: vai({ tipo: 'FGTS', nome: 'FGTS.pdf' }), leitura: { vencimento: '20/11/2026' } },
    { vai: vai({ tipo: 'DAS', nome: 'DAS.pdf' }), leitura: {} },
  ];
  const r = await N.guiasDoLoteNaArea(db, itens, itens.map(() => pdf), nada);
  igual('grava as duas DARFs, uma ao lado da outra', r.gravadas, 2);
  igual('o DAS sem vencimento fica anotado', r.semArea, ['DAS.pdf: sem vencimento ou valor lido']);
  igual('a guia nos dois links da empresa', ['tokenA', 'tokenB'].map(t => db.docs.has('areasCliente/' + t + '/guias/darf-irrf-2026-10-58')), [true, true]);
  igual('o documento da guia (lista branca, com o tributo)', db.docs.get('areasCliente/tokenA/guias/darf-inss-2026-10-58'),
    { id: 'darf-inss-2026-10-58', tipo: 'DARF', competencia: '2026-10', vencimento: '19/11/2026', valor: 900, tributo: 'INSS', situacao: db.docs.get('areasCliente/tokenA/guias/darf-inss-2026-10-58').situacao, temPdf: true });
  igual('o PDF em pedaços', db.docs.get('areasCliente/tokenA/guias/darf-inss-2026-10-58/pdf/0').total, 1);
  igual('o FGTS do lote não vai (já vem do pedidosFgts)', [...db.docs.keys()].some(k => k.includes('/guias/fgts')), false);

  // o lote do DP: só a DARF
  const db2 = bancoDeMentira({ 58: ['tokenC'] });
  const r2 = await N.guiasDoLoteNaArea(db2, [{ vai: vai({ tipo: 'DAS', nome: 'DAS.pdf' }), leitura: { vencimento: '23/11/2026' } }, ...itens.slice(0, 1)], [pdf, pdf], nada, ['DARF']);
  igual('o lote do DP só grava a DARF', [r2.gravadas, [...db2.docs.keys()].filter(k => /\/guias\/[^/]+$/.test(k))], [1, ['areasCliente/tokenC/guias/darf-irrf-2026-10-58']]);

  // sem link: nada grava e nada quebra
  const r3 = await N.guiasDoLoteNaArea(bancoDeMentira({}), itens.slice(0, 1), [pdf], nada);
  igual('empresa sem Área do Cliente: nada', r3, { gravadas: 0, semArea: [] });

  // erro no banco não derruba
  const quebrado = { collection: () => { throw new Error('banco fora'); } };
  const r4 = await N.guiasDoLoteNaArea(quebrado, itens.slice(0, 1), [pdf], nada);
  igual('erro no banco vira anotação, não exceção', r4.semArea, ['10-2026 - DARF IRRF.pdf: banco fora']);

  // ---------- 3. os lotes chamam antes de apagar os pedaços ----------
  const fiscal = fs.readFileSync(path.join(__dirname, 'lote-fiscal.js'), 'utf8');
  const dpTexto = fs.readFileSync(path.join(__dirname, 'lote-dp.js'), 'utf8');
  const antesDeApagar = (texto, chamada) => {
    const blocos = texto.split('apagarPartes(i.ref)');
    return blocos.slice(0, -1).every(b => b.lastIndexOf(chamada) > b.lastIndexOf('enviados++'));
  };
  igual('o lote do Fiscal grava a guia antes de apagar os pedaços, nas duas saídas', [fiscal.split('apagarPartes(i.ref)').length - 1, antesDeApagar(fiscal, 'naAreaDoCliente(itens')], [2, true]);
  igual('o lote do DP grava a DARF antes de apagar os pedaços', antesDeApagar(dpTexto, "guiasDoLoteNaArea(db, itens, anexos.map(a => a.buffer), log, ['DARF'])"), true);

  console.log(falhas ? falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
  process.exitCode = falhas ? 1 : 0;
})();
