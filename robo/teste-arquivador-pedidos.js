// Testes da decisão do admin (arquivador-manual.js) e dos pedidos do site (arquivador-pedidos.js). Rode:
//   node teste-arquivador-pedidos.js
// Sem Drive e sem banco: a pasta de origem, a dos clientes e o controle são temporários; um banco de mentira guarda o que
// seria gravado. O arquivar passa pelo executor de verdade (arquivador-novo.executar em PRODUCAO).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const M = require('./arquivador-manual');
const P = require('./arquivador-pedidos');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const sha1 = t => crypto.createHash('sha1').update(t).digest('hex');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// ---------- puras ----------
igual('competência mês', M.lerCompetencia('2026-01'), { mes: 1, ano: 2026 });
igual('competência ano', M.lerCompetencia('2025'), { ano: 2025 });
igual('competência ruim', [M.lerCompetencia('2026-13'), M.lerCompetencia('26-01'), M.lerCompetencia('')], [null, null, null]);
igual('os tipos do formulário começam pelo automático', M.tiposDoFormulario()[0].id, 'AUTO');
igual('cada tipo diz se precisa do mês ou do ano', M.tiposDoFormulario().find(t => t.id === 'DAS').precisa, 'mes');
const ORIG = 'G:\\Meu Drive\\Claudio Secretario';
igual('caminho em NÃO IDENTIFICADOS', P.caminhoDoPedido(ORIG, 'NÃO IDENTIFICADOS\\20261022-NOVO\\a.pdf').ni, '20261022-NOVO\\a.pdf');
igual('caminho na origem', [P.caminhoDoPedido(ORIG, '2026-10\\b.pdf').rel, P.caminhoDoPedido(ORIG, '2026-10\\b.pdf').ni], ['2026-10\\b.pdf', null]);
igual('barra normal vira a do Windows', P.caminhoDoPedido(ORIG, '2026-10/b.pdf').rel, '2026-10\\b.pdf');
igual('".." não sai da pasta', !!P.caminhoDoPedido(ORIG, 'NÃO IDENTIFICADOS\\..\\..\\Windows\\x').erro, true);
igual('caminho absoluto não vale', !!P.caminhoDoPedido(ORIG, 'C:\\Windows\\win.ini').erro, true);
igual('caminho vazio não vale', !!P.caminhoDoPedido(ORIG, '').erro, true);
igual('hash da lista (o do caminho)', P.hashConfere(sha1('X\\a.pdf'), 'X\\a.pdf', null), true);
igual('hash do conteúdo', P.hashConfere(sha256(Buffer.from('oi')), null, Buffer.from('oi')), true);
igual('hash que não confere', P.hashConfere('abc', 'X\\a.pdf', Buffer.from('oi')), false);
igual('sem hash não vale', P.hashConfere('', 'X\\a.pdf', Buffer.from('oi')), false);
igual('partes de 512 KB', P.emPartes(Buffer.alloc(1200 * 1024)).length, 3);
igual('cada parte cabe no documento (< 700 KB)', P.emPartes(Buffer.alloc(1200 * 1024))[0].length < 700 * 1024, true);
igual('arquivo vazio: uma parte vazia', P.emPartes(Buffer.alloc(0)), ['']);
igual('mime', [P.mimeDe('a.PDF'), P.mimeDe('b.xml'), P.mimeDe('c.jpeg'), P.mimeDe('d.bin')], ['application/pdf', 'text/xml', 'image/jpeg', 'application/octet-stream']);
igual('escolha do descarte', P.escolhaDoPedido({ tipo: 'descartar', pedidoPor: 'Vitor' }), { descartar: true, por: 'Vitor' });
igual('escolha do arquivar', P.escolhaDoPedido({ tipo: 'arquivar', codigo: '568', tipoDoc: 'DAS', competencia: '2026-01', pedidoPor: 'Vitor' }), { codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', por: 'Vitor' });

// ---------- a decisão do admin, pelas regras e pela árvore ----------
const LINHAS = [
  { codigo: 568, razao: 'BRAZILIAN EXEMPLO LTDA', doc: '11.222.333/0001-81', regime: 'Simples' },
  { codigo: 413, razao: 'BRAZILIAN FORESTRY EXEMPLO LTDA', doc: '22.333.444/0001-05', regime: 'Lucro Presumido' },
  { codigo: 77, razao: 'SEM PASTA EXEMPLO ME', doc: '33.444.555/0001-90', regime: 'Simples' },
];
const PASTAS = ['568 - BRAZILIAN EXEMPLO LTDA', '413 - BRAZILIAN FORESTRY EXEMPLO LTDA'];
const cad = R.montarCadastro(LINHAS, PASTAS);
const ctx = { cadastro: cad, hoje: new Date(), reservados: new Map(), existe: new Map(), hashes: new Map(), manifesto: new Map() };
const entrada = (nome, extra) => Object.assign({ nome, rel: 'NÃO IDENTIFICADOS\\X\\' + nome, hash: sha256(Buffer.from(nome)), texto: ['documento sem nada que as regras reconheçam'] }, extra || {});
let d = M.decidirManual(entrada('2026-2151 BRAZILIAN.pdf'), ctx, { codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', por: 'Vitor' });
igual('DAS do Simples: a pasta do regime e o nome da regra', [d.acao, d.destinoRelativo, d.nomeFinal, d.decididoPor], ['ARQUIVAR', '568 - BRAZILIAN EXEMPLO LTDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS', '01-2026.pdf', 'Vitor']);
d = M.decidirManual(entrada('guia.pdf'), ctx, { codigo: 413, tipoDoc: 'DARF', competencia: '2026-09', por: 'Vitor' });
igual('DARF do Presumido: a pasta do regime dele', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '413 - BRAZILIAN FORESTRY EXEMPLO LTDA\\FISCAL\\LUCRO PRESUMIDO\\05. DARF', '09-2026 - DARF - guia.pdf']);
d = M.decidirManual(entrada('guia.pdf'), ctx, { codigo: 413, tipoDoc: 'DAS', competencia: '2026-09', por: 'Vitor' });
igual('DAS em cliente do Presumido: a árvore não tem (as regras recusam)', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'TIPO_INCOMPATIVEL_COM_REGIME']);
d = M.decidirManual(entrada('extrato.pdf'), ctx, { codigo: 568, tipoDoc: 'EXTRATO', competencia: '2026-09', por: 'Vitor' });
igual('extrato sem o banco: pede o banco', [d.acao, /banco/.test(d.evidencias[0])], ['NAO_IDENTIFICADO', true]);
d = M.decidirManual(entrada('extrato sicoob.pdf'), ctx, { codigo: 568, tipoDoc: 'EXTRATO', competencia: '2026-09', por: 'Vitor' });
igual('extrato com o banco no nome', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '568 - BRAZILIAN EXEMPLO LTDA\\CONTÁBIL\\EXTRATOS\\2026\\09\\BANCÁRIOS\\SICOOB', '09-2026.pdf']);
d = M.decidirManual(entrada('Relatorio.xlsx'), ctx, { codigo: 568, tipoDoc: 'OUTROS', competencia: '2026', por: 'Vitor' });
igual('outros documentos pelo ano, o nome original', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '568 - BRAZILIAN EXEMPLO LTDA\\CONTÁBIL\\OUTROS DOCUMENTOS\\2026', 'Relatorio.xlsx']);
d = M.decidirManual(entrada('a.pdf'), ctx, { codigo: 568, tipoDoc: 'DAS', por: 'Vitor' });
igual('sem o mês: não arquiva', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'COMPETENCIA_AUSENTE']);
d = M.decidirManual(entrada('a.pdf'), ctx, { codigo: 999, tipoDoc: 'DAS', competencia: '2026-01', por: 'Vitor' });
igual('código fora do cadastro', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'CLIENTE_NAO_LOCALIZADO']);
d = M.decidirManual(entrada('a.pdf'), ctx, { codigo: 568, tipoDoc: 'XYZ', por: 'Vitor' });
igual('tipo fora da lista', d.motivo, 'TIPO_NAO_RECONHECIDO');
d = M.decidirManual(entrada('a.pdf'), ctx, { codigo: 568, tipoDoc: 'AUTO', por: 'Vitor' });
igual('automático sem as regras chegarem: pede o tipo', [d.acao, /escolha o tipo/.test(d.evidencias[0])], ['NAO_IDENTIFICADO', true]);
d = M.decidirManual(entrada('contrato.pdf'), ctx, { codigo: 77, tipoDoc: 'DOC_CONSTITUTIVO', por: 'Vitor' });
igual('cliente sem pasta: o admin decidiu, a pasta nasce', [d.acao, d.criarPastaCliente, d.pastaCliente], ['ARQUIVAR', true, '77 - SEM PASTA EXEMPLO ME']);
d = M.decidirManual(entrada('lixo.pdf'), ctx, { descartar: true, por: 'Vitor' });
igual('descartar', [d.acao, d.decididoPor], ['DESCARTAR', 'Vitor']);
// as regras com o cliente confirmado pelo admin: a planilha que as regras já sabem arquivar pelo hash confirmado
const plan = entrada('Planilha_Set_26.xlsx', { planilha: [['qualquer']] });
d = M.decidirManual(plan, ctx, { codigo: 568, tipoDoc: 'OUTROS', competencia: '2026', por: 'Vitor' });
igual('planilha: as regras com o hash confirmado dão o destino (OUTROS DOCUMENTOS)', [d.acao, /OUTROS DOCUMENTOS/.test(d.destinoRelativo), /as regras|árvore/.test(d.evidencias[d.evidencias.length - 1])], ['ARQUIVAR', true, true]);

// ---------- ponta a ponta: o executor de verdade, numa pasta temporária ----------
(async () => {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-pedidos-'));
  try {
    const origem = path.join(sb, 'origem'), clientes = path.join(sb, 'clientes'), controle = path.join(sb, 'controle');
    const ni = path.join(origem, 'NÃO IDENTIFICADOS', '20261022-NOVO', '2026-10');
    fs.mkdirSync(ni, { recursive: true }); fs.mkdirSync(path.join(clientes, '568 - BRAZILIAN EXEMPLO LTDA'), { recursive: true }); fs.mkdirSync(controle, { recursive: true });
    const conteudo = Buffer.from('guia do simples (exemplo de teste)');
    fs.writeFileSync(path.join(ni, '2026-2151 BRAZILIAN.txt'), conteudo);
    fs.writeFileSync(path.join(ni, 'lixo.txt'), 'registro de envio');
    fs.writeFileSync(path.join(origem, 'NÃO IDENTIFICADOS', '20261022-NOVO', '_nao_identificados.jsonl'), JSON.stringify({ arquivo: '2026-2151 BRAZILIAN.txt', caminho_relativo: '2026-10', status: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE' }) + '\n');
    const executar = async (rel, escolha, modo) => {
      const res = await A.executar({ modo, confirmo: true, origem, controle, clientes, arquivos: [rel], manual: { [rel]: escolha }, cadastro: cad, contas: new Map(), manifesto: new Map(), tiposProducao: ['todos'],
        moverNaoIdentificados: false, travaAntiga: path.join(sb, 'sem-trava.lock'), manifestoAntigo: path.join(sb, 'sem-manifesto.jsonl'), registrar: false, log: () => {} });
      return A.planos(res).find(x => x.rel === rel) || null;
    };
    // o banco de mentira
    const docs = new Map();
    const docRef = (caminho) => ({
      set: async (dados, op) => { docs.set(caminho, op && op.merge ? Object.assign({}, docs.get(caminho) || {}, dados) : dados); },
      collection: (n) => ({ doc: (id) => docRef(caminho + '/' + n + '/' + id) }),
    });
    const db = { collection: (n) => ({ doc: (id) => docRef(n + '/' + id), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }) };
    let mudou = 0, exclusivos = 0;
    // o banco de mentira não tem onSnapshot: o ouvinte não liga, e os pedidos vão direto pelo tratar()
    const P2 = P.criar({ db, origem, clientes, executar, exclusivo: async fn => { exclusivos++; return fn(); }, aposMudar: () => { mudou++; } });
    P2.parar();
    const relNi = 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\2026-2151 BRAZILIAN.txt';
    const hashLista = sha1('20261022-NOVO\\2026-10\\2026-2151 BRAZILIAN.txt');

    await P2.tratar('a1', { tipo: 'abrir', rel: relNi, hash: hashLista, pedidoPor: 'Vitor' });
    const a1 = docs.get('pedidosArquivador/a1');
    igual('abrir: pronto, com o nome, o mime e as partes', [a1.status, a1.arquivo.nome, a1.arquivo.mime, a1.arquivo.partes, a1.arquivo.tamanho], ['pronto', '2026-2151 BRAZILIAN.txt', 'text/plain', 1, conteudo.length]);
    igual('abrir: a parte 0 traz o conteúdo', Buffer.from(docs.get('pedidosArquivador/a1/partes/0').dados, 'base64').toString(), conteudo.toString());
    await P2.tratar('a2', { tipo: 'abrir', rel: relNi, hash: 'outro', pedidoPor: 'Vitor' });
    igual('abrir com o hash errado: erro', [docs.get('pedidosArquivador/a2').status, /mudou/.test(docs.get('pedidosArquivador/a2').erro)], ['erro', true]);
    await P2.tratar('a3', { tipo: 'abrir', rel: 'NÃO IDENTIFICADOS\\..\\..\\fora.txt', hash: 'x', pedidoPor: 'Vitor' });
    igual('abrir fora da pasta: erro', [docs.get('pedidosArquivador/a3').status, /fora da pasta/.test(docs.get('pedidosArquivador/a3').erro)], ['erro', true]);
    await P2.tratar('a4', { tipo: 'apagar', rel: relNi, hash: hashLista });
    igual('tipo desconhecido: erro', docs.get('pedidosArquivador/a4').status, 'erro');

    await P2.tratar('p1', { tipo: 'previa', rel: relNi, hash: hashLista, codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', pedidoPor: 'Vitor' });
    const p1 = docs.get('pedidosArquivador/p1');
    igual('prévia: o destino, sem mexer em nada', [p1.status, p1.resposta.destino, fs.existsSync(path.join(ni, '2026-2151 BRAZILIAN.txt'))], ['pronto', '568 - BRAZILIAN EXEMPLO LTDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS\\01-2026.txt', true]);
    await P2.tratar('p2', { tipo: 'previa', rel: relNi, hash: hashLista, codigo: 568, tipoDoc: 'DAS', pedidoPor: 'Vitor' });
    igual('prévia sem o mês: erro com o motivo', [docs.get('pedidosArquivador/p2').status, /mês/.test(docs.get('pedidosArquivador/p2').erro)], ['erro', true]);

    await P2.tratar('r1', { tipo: 'arquivar', rel: relNi, hash: hashLista, codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', pedidoPor: 'Vitor' });
    const r1 = docs.get('pedidosArquivador/r1');
    const alvo = path.join(clientes, '568 - BRAZILIAN EXEMPLO LTDA', 'FISCAL', 'SIMPLES NACIONAL', '01. DAS', '01-2026.txt');
    igual('arquivar: feito, pela trava', [r1.status, exclusivos >= 1], ['feito', true]);
    igual('arquivar: a cópia no cliente, igual ao original', fs.existsSync(alvo) && fs.readFileSync(alvo).equals(conteudo), true);
    igual('arquivar: o original saiu de NÃO IDENTIFICADOS (quarentena)', fs.existsSync(path.join(ni, '2026-2151 BRAZILIAN.txt')), false);
    const man = fs.readFileSync(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    igual('arquivar: o manifesto diz quem decidiu', [man[0].decidido_por, man[0].cliente], ['Vitor', 568]);
    const idx = fs.readFileSync(path.join(origem, 'NÃO IDENTIFICADOS', '20261022-NOVO', '_nao_identificados.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    igual('arquivar: o índice de NÃO IDENTIFICADOS anota a saída', [idx[idx.length - 1].status, idx[idx.length - 1].decidido_por], ['ARQUIVADO_PELO_ADMIN', 'Vitor']);
    igual('arquivar: a lista "Para resolver" é conferida de novo', mudou >= 1, true);

    // o mesmo conteúdo de novo: nunca sobrescreve (já arquivado)
    fs.writeFileSync(path.join(ni, 'copia.txt'), conteudo);
    await P2.tratar('r2', { tipo: 'arquivar', rel: 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\copia.txt', hash: sha1('20261022-NOVO\\2026-10\\copia.txt'), codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', pedidoPor: 'Vitor' });
    igual('o mesmo conteúdo: "já estava arquivado", nada sobrescrito', [docs.get('pedidosArquivador/r2').status, docs.get('pedidosArquivador/r2').resposta.acao, fs.readdirSync(path.dirname(alvo)).length], ['feito', 'JA_ARQUIVADO', 1]);
    // outro conteúdo com o mesmo nome: numerado
    fs.writeFileSync(path.join(ni, 'outra.txt'), 'outra guia');
    await P2.tratar('r3', { tipo: 'arquivar', rel: 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\outra.txt', hash: sha1('20261022-NOVO\\2026-10\\outra.txt'), codigo: 568, tipoDoc: 'DAS', competencia: '2026-01', pedidoPor: 'Vitor' });
    igual('outro conteúdo, mesmo nome: " (1)"', docs.get('pedidosArquivador/r3').resposta.nomeFinal, '01-2026 (1).txt');

    await P2.tratar('d1', { tipo: 'descartar', rel: 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\lixo.txt', hash: sha1('20261022-NOVO\\2026-10\\lixo.txt'), pedidoPor: 'Vitor' });
    igual('descartar: feito, o arquivo foi para a quarentena', [docs.get('pedidosArquivador/d1').status, fs.existsSync(path.join(ni, 'lixo.txt')), fs.readdirSync(path.join(controle, 'QUARENTENA')).length > 0], ['feito', false, true]);
    const man2 = fs.readFileSync(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    igual('descartar: o manifesto marca o descarte e quem decidiu', [man2[man2.length - 1].descarte, man2[man2.length - 1].decidido_por], [true, 'Vitor']);
    await P2.tratar('d2', { tipo: 'descartar', rel: 'NÃO IDENTIFICADOS\\20261022-NOVO\\2026-10\\lixo.txt', hash: 'x', pedidoPor: 'Vitor' });
    igual('o arquivo que já saiu: erro claro', [docs.get('pedidosArquivador/d2').status, /não está mais/.test(docs.get('pedidosArquivador/d2').erro)], ['erro', true]);

    // o cadastro do formulário: só grava quando muda
    igual('cadastro do formulário: grava a 1ª vez', await P2.publicarCadastro(cad), true);
    igual('cadastro do formulário: igual, não grava', await P2.publicarCadastro(cad), false);
    igual('cadastro do formulário: os clientes e se a pasta existe', docs.get('robo/arquivadorNovoCadastro').clientes, [{ c: 77, n: 'SEM PASTA EXEMPLO ME', p: false }, { c: 413, n: 'BRAZILIAN FORESTRY EXEMPLO LTDA', p: true }, { c: 568, n: 'BRAZILIAN EXEMPLO LTDA', p: true }]);
  } catch (e) { falhas++; console.log('ERRO', e.stack); }
  finally { try { fs.rmSync(sb, { recursive: true, force: true }); } catch (e) { /* temporário */ } }
  console.log(falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
