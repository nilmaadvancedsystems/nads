// Testes da separação dos PDFs já arquivados em RECEBIDOS (arquivador-separar-recebidos.js) com o executor de sempre
// (arquivador-correcao.js), numa pasta temporária no lugar do G:. Rode: node robo/teste-arquivador-separar-recebidos.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const W = path.win32;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'separar-recebidos-'));
const DRIVE = path.join(TMP, 'Meu Drive');
// antes de carregar o executor: o controle e o "G:" de mentira
process.env.ARQ_NOVO_CONTROLE = path.join(TMP, 'controle');
process.env.ARQ_CORRECAO_DRIVE = DRIVE;
fs.mkdirSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'MANIFESTO'), { recursive: true });

const S = require('./arquivador-separar-recebidos');
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
  // ---------- a árvore de mentira ----------
  const REC = '2026\\55 - TORRA TORRA LTDA\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\RECEBIDOS\\';
  const REC25 = '2025\\411 - MINAS LTDA\\FISCAL\\LUCRO PRESUMIDO\\03. DOCUMENTOS FISCAIS\\RECEBIDOS\\';
  const ISENTA = '2026\\90 - ASSOCIACAO\\FISCAL\\ISENTA\\01. DOCUMENTOS FISCAIS\\RECEBIDOS\\';
  escrever(REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf', 'nfe 9250');
  escrever(REC + '23-02-2026 - NFS-e 609891 - ECUSTOMIZE.pdf', 'nfse 609891');
  escrever(REC + '11-09-2026 - NF-e 9251 - CENTRO.pdf', 'nfe 9251 igual');                 // já está igual no destino: quarentena
  escrever(REC + 'NF-e\\11-09-2026 - NF-e 9251 - CENTRO.pdf', 'nfe 9251 igual');
  escrever(REC + '12-09-2026 - NF-e 9252 - CENTRO.pdf', 'nfe 9252 nova');                  // outro conteúdo com o mesmo nome: " (1)"
  escrever(REC + 'NF-e\\12-09-2026 - NF-e 9252 - CENTRO.pdf', 'nfe 9252 velha');
  escrever(REC + 'PIVOT NF7148 DA FUTURA NF.6951.pdf', 'pivo');                            // nome fora do padrão: fica
  escrever(REC + '10-09-2026 - CANCELAMENTO NF-e 12 - X.pdf', 'canc');                     // fica
  escrever(REC + 'CANCELADAS\\10-09-2026 - CANCELAMENTO NF-e 13 - X.pdf', 'canc 13');      // subpasta: não é olhada
  escrever(REC25 + '03-02-2025 - NFS-e 760 - PROGEO.pdf', 'nfse 760');
  escrever(ISENTA + '01-03-2026 - NF-e 5 - FORNECEDOR.pdf', 'nfe 5');
  escrever('2026\\55 - TORRA TORRA LTDA\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\EMITIDOS\\10-09-2026 - NF-e 1 - TORRA.pdf', 'emitida');   // EMITIDOS: não mexe
  escrever('2026\\NÃO É CLIENTE\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\RECEBIDOS\\10-09-2026 - NF-e 9 - X.pdf', 'x');                  // pasta sem código: não mexe

  // ---------- o plano (só leitura) ----------
  const raizes = [2025, 2026, 2027].map(ano => ({ ano, raiz: W.join(DRIVE, String(ano)) })).filter(r => fs.existsSync(r.raiz));
  const r = S.planejar(S.lerDoDisco, raizes);
  const rel = p => W.relative(DRIVE, p);
  igual('o plano: só os PDFs de NF-e e NFS-e soltos em RECEBIDOS, cada um para a sua subpasta',
    r.plano.map(p => [rel(p.de), rel(p.para)]).sort(),
    [[REC25 + '03-02-2025 - NFS-e 760 - PROGEO.pdf', REC25 + 'NFS-e TOMADAS\\03-02-2025 - NFS-e 760 - PROGEO.pdf'],
      [REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf', REC + 'NF-e\\10-09-2026 - NF-e 9250 - CENTRO.pdf'],
      [REC + '11-09-2026 - NF-e 9251 - CENTRO.pdf', REC + 'NF-e\\11-09-2026 - NF-e 9251 - CENTRO.pdf'],
      [REC + '12-09-2026 - NF-e 9252 - CENTRO.pdf', REC + 'NF-e\\12-09-2026 - NF-e 9252 - CENTRO.pdf'],
      [REC + '23-02-2026 - NFS-e 609891 - ECUSTOMIZE.pdf', REC + 'NFS-e TOMADAS\\23-02-2026 - NFS-e 609891 - ECUSTOMIZE.pdf'],
      [ISENTA + '01-03-2026 - NF-e 5 - FORNECEDOR.pdf', ISENTA + 'NF-e\\01-03-2026 - NF-e 5 - FORNECEDOR.pdf']].sort());
  igual('cada passo no formato do plano da auditoria (etapa "pasta", automático, com o tamanho)', r.plano.every(p => p.etapa === 'pasta' && p.gravidade === 'ERRADO-PASTA' && p.acao === 'MOVER' && p.automatico && p.confianca >= 0.9 && p.tamanho > 0), true);
  igual('o que fica, listado (nome fora do padrão e cancelamento)', r.ficam.map(f => f.nome).sort(), ['10-09-2026 - CANCELAMENTO NF-e 12 - X.pdf', 'PIVOT NF7148 DA FUTURA NF.6951.pdf']);
  igual('o resumo (3 pastas RECEBIDOS: a pasta sem o código do cliente não conta)', (x => [x.pastasRecebidos, x.mover, x.porSubpasta['NF-e'], x.porSubpasta['NFS-e TOMADAS'], x.porAno, x.clientes, x.ficam])(S.resumir(r)), [3, 6, 4, 2, { 2025: 1, 2026: 5 }, 3, 2]);
  igual('montar o plano não mexeu em nada', [existe(REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + 'NFS-e TOMADAS')], [true, false]);

  // ---------- o executor em simulação: nada muda ----------
  const sim = new C.Correcao({ producao: false, log: () => {} });
  const rs = C.etapaDoPlano(sim, r.plano, 'pasta');
  igual('simulação: os 6 automáticos, nada para revisar', [rs.total, rs.automaticos, rs.revisar], [6, 6, 0]);
  igual('simulação: nada saiu do lugar', [existe(REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + 'NF-e\\10-09-2026 - NF-e 9250 - CENTRO.pdf')], [true, false]);

  // ---------- o executor em produção (na pasta temporária) ----------
  const pro = new C.Correcao({ producao: true, log: () => {} });
  C.etapaDoPlano(pro, r.plano, 'pasta');
  igual('produção: a NF-e e a NFS-e foram para as subpastas e saíram de RECEBIDOS',
    [existe(REC + 'NF-e\\10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + 'NFS-e TOMADAS\\23-02-2026 - NFS-e 609891 - ECUSTOMIZE.pdf'), existe(REC25 + 'NFS-e TOMADAS\\03-02-2025 - NFS-e 760 - PROGEO.pdf'), existe(ISENTA + 'NF-e\\01-03-2026 - NF-e 5 - FORNECEDOR.pdf')],
    [true, false, true, true, true]);
  igual('produção: o mesmo conteúdo já no destino → a origem vai para a quarentena (nada apagado)',
    [existe(REC + '11-09-2026 - NF-e 9251 - CENTRO.pdf'), fs.readdirSync(path.join(DRIVE, '_QUARENTENA ARQUIVADOR')).length === 1],
    [false, true]);
  igual('produção: outro conteúdo com o mesmo nome → " (1)", o de antes intacto',
    [fs.readFileSync(path.join(DRIVE, REC + 'NF-e\\12-09-2026 - NF-e 9252 - CENTRO (1).pdf'), 'utf8'), fs.readFileSync(path.join(DRIVE, REC + 'NF-e\\12-09-2026 - NF-e 9252 - CENTRO.pdf'), 'utf8')],
    ['nfe 9252 nova', 'nfe 9252 velha']);
  igual('produção: o que não é do plano ficou', [existe(REC + 'PIVOT NF7148 DA FUTURA NF.6951.pdf'), existe(REC + 'CANCELADAS\\10-09-2026 - CANCELAMENTO NF-e 13 - X.pdf'), existe('2026\\55 - TORRA TORRA LTDA\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\EMITIDOS\\10-09-2026 - NF-e 1 - TORRA.pdf')], [true, true, true]);
  const manifesto = fs.readFileSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  igual('produção: cada passo no manifesto (o "já arquivado" acha o lugar novo)', manifesto.length, 6);
  igual('de novo, o plano sai vazio (o que tinha de mover já foi)', S.planejar(S.lerDoDisco, raizes).plano.length, 0);

  // ---------- desfazer ----------
  const des = new C.Correcao({ producao: true, log: () => {} });
  C.desfazer(des, pro.diario);
  igual('o --desfazer devolve tudo para RECEBIDOS', [existe(REC + '10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + 'NF-e\\10-09-2026 - NF-e 9250 - CENTRO.pdf'), existe(REC + '11-09-2026 - NF-e 9251 - CENTRO.pdf'), existe(REC + '12-09-2026 - NF-e 9252 - CENTRO.pdf')], [true, false, true, true]);
} catch (e) {
  falhas++;
  console.log('FALHOU com erro:', e.stack);
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* o temporário fica */ }
}
console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
process.exit(falhas ? 1 : 0);
