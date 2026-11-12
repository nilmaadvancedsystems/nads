// Testes do fiscal por mês nos já arquivados (arquivador-fiscal-por-mes.js) com o executor de sempre (arquivador-correcao.js),
// numa pasta temporária no lugar do G:. Rode: node robo/teste-arquivador-fiscal-por-mes.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const W = path.win32;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fiscal-por-mes-'));
const DRIVE = path.join(TMP, 'Meu Drive');
// antes de carregar o executor: o controle e o "G:" de mentira
process.env.ARQ_NOVO_CONTROLE = path.join(TMP, 'controle');
process.env.ARQ_CORRECAO_DRIVE = DRIVE;
fs.mkdirSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'MANIFESTO'), { recursive: true });

const F = require('./arquivador-fiscal-por-mes');
const C = require('./arquivador-correcao');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const escrever = (rel, conteudo) => { const p = path.join(DRIVE, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, conteudo); return p; };
const existe = rel => fs.existsSync(path.join(DRIVE, rel));

try {
  // ---------- o mês pelo nome ----------
  igual('o mês do XML ("MM-AAAA_")', F.mesDoNome('10-2026_NF-e_254.xml'), { mes: '10', ano: 2026 });
  igual('o mês do evento e do PDF ("DD-MM-AAAA - ")', F.mesDoNome('05-10-2026 - NF-e 254 - X.pdf'), { mes: '10', ano: 2026 });
  igual('o mês do relatório ("MM-AAAA - ")', F.mesDoNome('09-2026 - RELATORIO NOTAS EMITIDAS - X.pdf'), { mes: '09', ano: 2026 });
  igual('o nome original não tem mês', F.mesDoNome('PIVOT NF7148.pdf'), null);
  igual('mês 13 não é mês', F.mesDoNome('13-2026_NF-e_1.xml'), null);

  // ---------- a árvore de mentira (2026, como as regras deixavam antes de 11/11/2026) ----------
  const REG = '2026\\289 - VOLPONI INDUSTRIA MECANICA LTDA\\FISCAL\\SIMPLES NACIONAL\\';
  const DOCS = REG + '03. DOCUMENTOS FISCAIS\\', XML = REG + '12. XML\\';
  escrever(XML + 'NF-e\\10-2026_NF-e_254.xml', 'xml 254');
  escrever(XML + 'NF-e\\EVENTOS\\08-10-2026 - CANCELAMENTO NF-e 254.xml', 'canc 254');
  escrever(XML + 'NFC-e\\INUTILIZAÇÕES\\14-03-2026 - INUTILIZACAO NFC-e 5 A 7 SERIE 1.xml', 'inut');
  escrever(XML + 'NFS-e\\09-2026_NFS-e_9.xml', 'nfse 9');
  escrever(XML + 'NF-e\\10-2025_NF-e_1.xml', 'de 2025');                                               // o ano não é o da raiz: fica
  escrever(XML + 'NF-e\\10\\10-2026_NF-e_300.xml', 'já no mês');                                         // já no lugar: não mexe
  escrever(DOCS + 'EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf', 'pdf 254');
  escrever(DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 799 - LUCIMAR.pdf', 'pdf 799');
  escrever(DOCS + 'RECEBIDOS\\NFS-e TOMADAS\\07-10-2026 - NFS-e 8 - PRESTADOR.pdf', 'pdf nfse 8');
  escrever(DOCS + 'EMITIDOS\\CANCELADAS\\08-10-2026 - CANCELAMENTO NF-e 254 - VOLPONI.pdf', 'pdf canc');
  escrever(DOCS + 'EMITIDOS\\NFC-e\\2026\\10\\05-10-2026 - NFC-e 31 - VOLPONI.pdf', 'nfce 31');
  escrever(DOCS + 'EMITIDOS\\RELATÓRIO MENSAL\\2026\\09-2026 - RELATORIO NOTAS EMITIDAS - VOLPONI.pdf', 'relatorio');
  escrever(DOCS + 'RECEBIDOS\\NFSE 3116288 - BYTEDANCE.pdf', 'nome original');                       // sem o mês no nome: fica
  escrever(DOCS + '10\\EMITIDOS\\05-10-2026 - NF-e 255 - VOLPONI.pdf', 'já no mês');                  // já no lugar: não mexe
  escrever(REG + '01. DAS\\10-2026.pdf', 'das');                                                        // outra pasta do regime: não mexe
  escrever(DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf', 'igual');                       // o mesmo conteúdo já no destino: quarentena
  escrever(DOCS + '10\\RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf', 'igual');

  // ---------- o plano (só leitura) ----------
  const raizes = [{ ano: 2026, raiz: W.join(DRIVE, '2026') }];
  const r = F.planejar(F.lerDoDisco, raizes);
  const rel = p => W.relative(DRIVE, p);
  igual('o plano: cada um para a pasta do mês, como as regras de hoje',
    r.plano.map(p => [rel(p.de), rel(p.para)]).sort(),
    [[XML + 'NF-e\\10-2026_NF-e_254.xml', XML + 'NF-e\\10\\10-2026_NF-e_254.xml'],
      [XML + 'NF-e\\EVENTOS\\08-10-2026 - CANCELAMENTO NF-e 254.xml', XML + 'NF-e\\EVENTOS\\10\\08-10-2026 - CANCELAMENTO NF-e 254.xml'],
      [XML + 'NFC-e\\INUTILIZAÇÕES\\14-03-2026 - INUTILIZACAO NFC-e 5 A 7 SERIE 1.xml', XML + 'NFC-e\\INUTILIZAÇÕES\\03\\14-03-2026 - INUTILIZACAO NFC-e 5 A 7 SERIE 1.xml'],
      [XML + 'NFS-e\\09-2026_NFS-e_9.xml', XML + 'NFS-e\\09\\09-2026_NFS-e_9.xml'],
      [DOCS + 'EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf', DOCS + '10\\EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf'],
      [DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 799 - LUCIMAR.pdf', DOCS + '10\\RECEBIDOS\\NF-e\\06-10-2026 - NF-e 799 - LUCIMAR.pdf'],
      [DOCS + 'RECEBIDOS\\NFS-e TOMADAS\\07-10-2026 - NFS-e 8 - PRESTADOR.pdf', DOCS + '10\\RECEBIDOS\\NFS-e TOMADAS\\07-10-2026 - NFS-e 8 - PRESTADOR.pdf'],
      [DOCS + 'EMITIDOS\\CANCELADAS\\08-10-2026 - CANCELAMENTO NF-e 254 - VOLPONI.pdf', DOCS + '10\\EMITIDOS\\CANCELADAS\\08-10-2026 - CANCELAMENTO NF-e 254 - VOLPONI.pdf'],
      [DOCS + 'EMITIDOS\\NFC-e\\2026\\10\\05-10-2026 - NFC-e 31 - VOLPONI.pdf', DOCS + '10\\EMITIDOS\\NFC-e\\05-10-2026 - NFC-e 31 - VOLPONI.pdf'],
      [DOCS + 'EMITIDOS\\RELATÓRIO MENSAL\\2026\\09-2026 - RELATORIO NOTAS EMITIDAS - VOLPONI.pdf', DOCS + '09\\EMITIDOS\\RELATÓRIO MENSAL\\09-2026 - RELATORIO NOTAS EMITIDAS - VOLPONI.pdf'],
      [DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf', DOCS + '10\\RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf']].sort());
  igual('cada passo no formato do plano da auditoria (etapa "pasta", automático, com o tamanho)', r.plano.every(p => p.etapa === 'pasta' && p.gravidade === 'ERRADO-PASTA' && p.acao === 'MOVER' && p.automatico && p.confianca >= 0.9 && p.tamanho > 0), true);
  igual('o que fica, listado com o porquê', r.ficam.map(f => [f.nome, f.porque]).sort(), [['10-2025_NF-e_1.xml', 'o ano do nome (2025) não é o da raiz (2026)'], ['NFSE 3116288 - BYTEDANCE.pdf', 'sem o mês no nome']]);
  igual('o resumo', (x => [x.regimes, x.mover, x.porPasta, x.clientes, x.ficam])(F.resumir(r)), [1, 11, { 'DOCUMENTOS FISCAIS': 7, XML: 4 }, 1, 2]);
  igual('montar o plano não mexeu em nada', [existe(XML + 'NF-e\\10-2026_NF-e_254.xml'), existe(XML + 'NF-e\\10\\10-2026_NF-e_254.xml')], [true, false]);

  // ---------- o executor em simulação: nada muda ----------
  const sim = new C.Correcao({ producao: false, log: () => {} });
  const rs = C.etapaDoPlano(sim, r.plano, 'pasta');
  igual('simulação: os 11 automáticos, nada para revisar', [rs.total, rs.automaticos, rs.revisar], [11, 11, 0]);
  igual('simulação: nada saiu do lugar', [existe(XML + 'NF-e\\10-2026_NF-e_254.xml'), existe(DOCS + '10\\EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf')], [true, false]);

  // ---------- o executor em produção (na pasta temporária) ----------
  const pro = new C.Correcao({ producao: true, log: () => {} });
  C.etapaDoPlano(pro, r.plano, 'pasta');
  igual('produção: cada um na pasta do mês e fora do lugar velho',
    [existe(XML + 'NF-e\\10\\10-2026_NF-e_254.xml'), existe(XML + 'NF-e\\10-2026_NF-e_254.xml'), existe(XML + 'NF-e\\EVENTOS\\10\\08-10-2026 - CANCELAMENTO NF-e 254.xml'),
      existe(DOCS + '10\\EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf'), existe(DOCS + '10\\RECEBIDOS\\NF-e\\06-10-2026 - NF-e 799 - LUCIMAR.pdf'),
      existe(DOCS + '10\\EMITIDOS\\NFC-e\\05-10-2026 - NFC-e 31 - VOLPONI.pdf'), existe(DOCS + '09\\EMITIDOS\\RELATÓRIO MENSAL\\09-2026 - RELATORIO NOTAS EMITIDAS - VOLPONI.pdf')],
    [true, false, true, true, true, true, true]);
  igual('produção: o mesmo conteúdo já no destino → a origem vai para a quarentena (nada apagado)',
    [existe(DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf'), fs.readdirSync(path.join(DRIVE, '_QUARENTENA ARQUIVADOR')).length === 1],
    [false, true]);
  igual('produção: o que não é do plano ficou', [existe(XML + 'NF-e\\10-2025_NF-e_1.xml'), existe(DOCS + 'RECEBIDOS\\NFSE 3116288 - BYTEDANCE.pdf'), existe(REG + '01. DAS\\10-2026.pdf'), existe(XML + 'NF-e\\10\\10-2026_NF-e_300.xml'), existe(DOCS + '10\\EMITIDOS\\05-10-2026 - NF-e 255 - VOLPONI.pdf')], [true, true, true, true, true]);
  const manifesto = fs.readFileSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  igual('produção: cada passo no manifesto (o "já arquivado" acha o lugar novo)', manifesto.length, 11);
  igual('de novo, o plano sai vazio (o que tinha de mover já foi)', F.planejar(F.lerDoDisco, raizes).plano.length, 0);

  // ---------- desfazer ----------
  const des = new C.Correcao({ producao: true, log: () => {} });
  C.desfazer(des, pro.diario);
  igual('o --desfazer devolve tudo para o lugar de antes', [existe(XML + 'NF-e\\10-2026_NF-e_254.xml'), existe(XML + 'NF-e\\10\\10-2026_NF-e_254.xml'), existe(DOCS + 'EMITIDOS\\05-10-2026 - NF-e 254 - VOLPONI.pdf'), existe(DOCS + 'RECEBIDOS\\NF-e\\06-10-2026 - NF-e 800 - IGUAL.pdf')], [true, false, true, true]);

  // ---------- sozinho, na madrugada (o "o robô faz sozinho") ----------
  (async () => {
    let hora = 14, ocupado = false;
    const marcas = [], avisos = [];
    const painelFalso = { fazendo: (k, t) => marcas.push(t ? 'fazendo' : 'livre'), atividade: (k, t, d) => avisos.push('ok: ' + t + ' / ' + d), erro: (k, t, d) => avisos.push('erro: ' + t + ' / ' + d) };
    const base = {
      log: () => {}, painel: painelFalso, controle: process.env.ARQ_NOVO_CONTROLE, drive: DRIVE, anos: [2026],
      agora: () => new Date(2026, 10, 12, hora, 0), ocupado: () => ocupado, ocupar: () => marcas.push('ocupou'), desocupar: () => marcas.push('desocupou'),
      rodarExecutor: arq => F.rodarExecutorNumProcesso(arq),
    };
    const m = F.criarMudancaDaMadrugada(base);
    igual('madrugada: às 14h não roda', await m.tique(), 'fora da hora');
    hora = 2; ocupado = true;
    igual('madrugada: com o arquivador ocupado, espera', await m.tique(), 'o arquivador está ocupado');
    ocupado = false;
    igual('madrugada: às 2h move tudo (o executor num processo à parte)', await m.tique(), 'feito');
    igual('madrugada: os arquivos estão nas pastas do mês', [existe(XML + 'NF-e\\10\\10-2026_NF-e_254.xml'), existe(XML + 'NF-e\\10-2026_NF-e_254.xml'), existe(DOCS + '10\\RECEBIDOS\\NF-e\\06-10-2026 - NF-e 799 - LUCIMAR.pdf'), existe(DOCS + '09\\EMITIDOS\\RELATÓRIO MENSAL\\09-2026 - RELATORIO NOTAS EMITIDAS - VOLPONI.pdf')], [true, false, true, true]);
    igual('madrugada: segurou o arquivador enquanto movia e avisou na Central', [marcas, avisos.length, /^ok: Fiscal de 2026 separado por mês/.test(avisos[0])], [['ocupou', 'fazendo', 'livre', 'desocupou'], 1, true]);
    igual('madrugada: o feito fica gravado (com o resumo do executor)', (x => [x.ano, x.mover, !!x.executor])(JSON.parse(fs.readFileSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'fiscal-por-mes', 'feito-2026.json'), 'utf8'))), [2026, 11, true]);
    igual('madrugada: na noite seguinte não faz de novo', await m.tique(), 'nada a fazer');
    // o executor que falha: avisa e não marca como feito (tenta na próxima madrugada)
    fs.mkdirSync(path.join(DRIVE, '2025', '1 - X', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e'), { recursive: true });
    fs.writeFileSync(path.join(DRIVE, '2025', '1 - X', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e', '01-2025_NF-e_1.xml'), 'x');
    // só de madrugada (12/11/2026): às 6h o executor para no fim de um lote e o resto fica para a noite seguinte
    avisos.length = 0;
    let ateRecebido = null;
    const parcial = F.criarMudancaDaMadrugada(Object.assign({}, base, { anos: [2025], rodarExecutor: (arq, ate) => { ateRecebido = ate; return F.rodarExecutorNumProcesso(arq, null, Date.now() - 1000); } }));
    igual('madrugada: passou das 6h → o executor para antes do lote e o resto fica para a próxima noite',
      [await parcial.tique(), existe('2025\\1 - X\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e\\01-2025_NF-e_1.xml'), fs.existsSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'fiscal-por-mes', 'feito-2025.json')), /parte movida/.test(avisos[0] || '')],
      ['continua', true, false, true]);
    igual('madrugada: a hora de parar é às 6h do dia', ateRecebido, new Date(2026, 10, 12, 6, 0, 0).getTime());
    const sim = new C.Correcao({ producao: true, ate: Date.now() - 1, log: () => {} });
    C.etapaDoPlano(sim, F.planejar(F.lerDoDisco, [{ ano: 2025, raiz: path.join(DRIVE, '2025') }]).plano, 'pasta');
    igual('executor com a hora vencida: nenhum passo, parouPelaHora', [sim.passos.length, sim.parouPelaHora], [0, true]);
    avisos.length = 0;
    const falha = F.criarMudancaDaMadrugada(Object.assign({}, base, { anos: [2025], rodarExecutor: async () => ({ ok: false, erro: 'PAREI: o lote não conferiu' }) }));
    igual('madrugada: o executor parou → erro na Central, sem o feito', [await falha.tique(), /^erro: /.test(avisos[0] || ''), fs.existsSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'fiscal-por-mes', 'feito-2025.json'))], ['erro', true, false]);
  })().then(fim, e => { falhas++; console.log('FALHOU com erro:', e.stack); fim(); });
} catch (e) {
  falhas++;
  console.log('FALHOU com erro:', e.stack);
  fim();
}
function fim() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* o temporário fica */ }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
}
