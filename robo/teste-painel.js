// Testes do painel do robô (painel.js): as funções puras e o caminho inteiro num banco de mentira (nada vai para o
// Firestore de verdade). Rode antes de publicar qualquer mudança no painel:  node teste-painel.js
const painel = require('./painel');
const man = require('./arquivo-manifesto');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const verdade = (nome, v) => igual(nome, !!v, true);

// ---------- cortar e datas ----------
igual('cortar: uma linha só', painel.cortar('  a\n  b  ', 10), 'a b');
igual('cortar: com reticências', painel.cortar('abcdefghij', 5), 'abcd…');
igual('cortar: nulo vira vazio', painel.cortar(null, 5), '');
igual('isoDe: texto', painel.isoDe('2026-10-21T10:00:00.000Z'), '2026-10-21T10:00:00.000Z');
igual('isoDe: Timestamp do Firestore', painel.isoDe({ toDate: () => new Date('2026-10-21T10:00:00Z') }), '2026-10-21T10:00:00.000Z');
igual('isoDe: lixo', painel.isoDe('ontem'), '');

// ---------- as filas ----------
const fgts = painel.FILAS.pc.find(f => f.id === 'fgts');
igual('fila: esperando, em andamento e o mais antigo', painel.contarFila([
  { status: 'pendente', criadoEm: '2026-10-21T10:00:00.000Z' },
  { status: 'pendente', criadoEm: '2026-10-21T09:00:00.000Z' },
  { status: 'trabalhando', criadoEm: '2026-10-21T11:00:00.000Z' },
  { status: 'pronto', criadoEm: '2026-10-20T08:00:00.000Z' },
], fgts), { esperando: 2, andamento: 1, maisAntigoEm: '2026-10-21T09:00:00.000Z' });
igual('fila vazia', painel.contarFila([], fgts), { esperando: 0, andamento: 0, maisAntigoEm: '' });
const caixa = painel.FILAS.pc.find(f => f.id === 'area-chamados');
igual('caixa de entrada (sem status): tudo esperando', painel.contarFila([{ criadoEm: '2026-10-21T10:00:00Z' }, { criadoEm: '2026-10-21T08:00:00Z' }], caixa),
  { esperando: 2, andamento: 0, maisAntigoEm: '2026-10-21T08:00:00.000Z' });
const nfse = painel.FILAS.vm.find(f => f.id === 'nfse');
igual('NFS-e: a data do pedido é pedidoEm', painel.contarFila([{ status: 'pedida', pedidoEm: '2026-10-21T07:00:00Z' }], nfse).maisAntigoEm, '2026-10-21T07:00:00.000Z');
verdade('todas as filas têm id, nome e coleção', [...painel.FILAS.pc, ...painel.FILAS.vm].every(f => f.id && f.nome && f.colecao));
verdade('extratosRecebidos não é fila do robô (o Extrator importa ao abrir)', ![...painel.FILAS.pc, ...painel.FILAS.vm].some(f => f.colecao === 'extratosRecebidos'));

// ---------- o freio ----------
const f = painel.criarFreio(3, 1000, 100);
igual('freio: a primeira passa', f.pode('a', 0), true);
igual('freio: a mesma logo depois não', f.pode('a', 50), false);
igual('freio: a mesma depois do prazo passa', f.pode('a', 200), true);
igual('freio: a terceira na janela passa', f.pode('b', 300), true);
igual('freio: a quarta na janela não', f.pode('c', 400), false);
igual('freio: passada a janela, volta', f.pode('c', 1300), true);
igual('freio: conta as descartadas', f.descartadas(), 2);

// ---------- o batimento ----------
const b = painel.montarBatimento({ robo: 'pc', maquina: 'PC-1', versao: 'abc1234', ligadoEm: 'L', extra: { arquivados: { hoje: 3 } },
  agora: [{ chave: 'fgts', texto: 'Emitindo FGTS 1/2', desde: 'D' }], modulos: [], filas: [] }, 'E');
igual('batimento: o nome do robô, a hora e o extra', [b.nome, b.em, b.desligadoEm, b.arquivados.hoje], ['Robô do PC', 'E', null, 3]);
verdade('a versão do código sai do git (ou "desconhecida")', typeof painel.versaoDoCodigo() === 'string' && painel.versaoDoCodigo().length > 0);

// ---------- o que foi arquivado no mês ----------
const porExec = new Map([
  ['EXEC-20261021-091500', [{ codigo: '58' }, { codigo: '58' }, { codigo: '292' }]],
  ['EXEC-20261003-090000', [{ codigo: '10' }]],
  ['SIM-20261021-100000', [{ codigo: '1' }]],
  ['EXEC-20260930-090000', [{ codigo: '2' }]],
]);
const relatorios = new Map([['EXEC-20261021-091500', { id: 'EXEC-20261021-091500', mtime: new Date(2026, 9, 21, 9, 40).getTime() }]]);
const qual = new Map([['EXEC-20261021-091500', { naoIdentificados: 2 }]]);
const r = man.resumoDoMes(porExec, relatorios, qual, new Date(2026, 9, 21, 15, 0));
igual('arquivados: hoje, no mês e as execuções (só produção, só o mês)', [r.mes, r.hoje, r.noMes, r.execucoesNoMes, r.naoIdentificadosNoMes], ['2026-10', 3, 4, 2, 2]);
igual('arquivados: a mais nova primeiro, com os clientes', r.execucoes.map(e => [e.id, e.arquivados, e.clientes]), [['EXEC-20261021-091500', 3, 2], ['EXEC-20261003-090000', 1, 1]]);

// ---------- o caminho inteiro, num banco de mentira ----------
function bancoDeMentira() {
  const gravados = [];
  const docs = new Map();
  const colecao = nome => ({
    doc: id => ({ set: (d, o) => { docs.set(nome + '/' + id, o && o.merge ? Object.assign({}, docs.get(nome + '/' + id), d) : d); return Promise.resolve(); } }),
    add: d => { gravados.push(Object.assign({ colecao: nome }, d)); return Promise.resolve({ id: 'x' + gravados.length }); },
    where: () => ({ limit: () => ({ onSnapshot: (ok) => { ok({ docs: [{ data: () => ({ status: 'pendente', criadoEm: '2026-10-21T10:00:00Z' }) }] }); return () => {}; },
      get: () => Promise.resolve({ empty: true, docs: [] }) }) }),
    limit: () => ({ select: () => ({ get: () => Promise.resolve({ docs: [{ data: () => ({ criadoEm: '2026-10-21T09:00:00Z' }) }] }) }) }),
  });
  return { db: { collection: colecao, batch: () => ({ delete() {}, commit: () => Promise.resolve() }) }, gravados, docs };
}

(async () => {
  const banco = bancoDeMentira();
  const linhas = [];
  painel.atividade('fgts', 'antes de iniciar', 'espera na fila');
  painel.fazendo('fgts', 'Emitindo FGTS 1/2 — EMPRESA EXEMPLO');
  painel.fazendoPor('sieg', () => 'SIEG: contando 58');
  painel.modulo('fgts', 'FGTS Digital', true);
  painel.estado({ arquivados: { mes: '2026-10', hoje: 1, noMes: 9, execucoes: [] } });
  painel.iniciar(banco.db, { robo: 'pc', log: m => linhas.push(m), versao: 'teste', filas: [fgts, caixa] });
  await new Promise(res => setTimeout(res, 20));
  const doc = banco.docs.get('robo/painelPC');
  verdade('o batimento foi para robo/painelPC', !!doc);
  igual('batimento: a versão e a máquina', [doc.versao, typeof doc.maquina], ['teste', 'string']);
  igual('batimento: o que está fazendo (o fazendo e o fazendoPor)', doc.agora.map(a => a.texto), ['Emitindo FGTS 1/2 — EMPRESA EXEMPLO', 'SIEG: contando 58']);
  igual('batimento: os módulos', doc.modulos, [{ id: 'fgts', nome: 'FGTS Digital', ligado: true, motivo: '' }]);
  igual('batimento: o estado extra (arquivados)', doc.arquivados.noMes, 9);
  painel.batimento();
  await new Promise(res => setTimeout(res, 20));
  const doc2 = banco.docs.get('robo/painelPC');
  igual('batimento: as filas ouvidas e consultadas', doc2.filas.map(x => [x.id, x.esperando, x.andamento]), [['fgts', 1, 0], ['area-chamados', 1, 0]]);
  igual('atividade de antes do iniciar saiu, e a de ligar também', banco.gravados.map(g => g.texto), ['antes de iniciar', 'Robô do PC ligou em ' + require('os').hostname()]);
  verdade('atividade: guarda expiraEm (7 dias)', banco.gravados.every(g => g.expiraEm instanceof Date && g.expiraEm - Date.parse(g.em) === 7 * 24 * 36e5));
  painel.erro('sieg', 'O SIEG deu erro', 'a API recusou');
  painel.erro('sieg', 'O SIEG deu erro', 'a API recusou');
  igual('erro: marcado e sem repetir em seguida', banco.gravados.filter(g => g.erro).length, 1);
  painel.atividade('inventado', 'tipo fora da lista');
  igual('tipo fora da lista vira robo', banco.gravados.slice(-1)[0].tipo, 'robo');
  painel.fazendo('fgts', null);
  painel.batimento();
  await new Promise(res => setTimeout(res, 20));
  igual('fazendo(null) tira da lista', banco.docs.get('robo/painelPC').agora.map(a => a.chave), ['sieg']);
  await painel.desligar();
  igual('desligar: marca no painel e registra', [!!banco.docs.get('robo/painelPC').desligadoEm, banco.gravados.slice(-1)[0].texto], [true, 'Robô do PC desligou']);
  igual('nenhuma linha de erro no log', linhas.filter(l => /não consegui/.test(String(l))), []);

  console.log((falhas ? falhas + ' de ' + total + ' FALHARAM' : 'todos os ' + total + ' passaram') + ' (painel do robô)');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
