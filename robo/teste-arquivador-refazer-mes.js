// Testes do "refazer o mês" (arquivador-refazer-mes.js) com o executor de sempre (arquivador-correcao.js), numa pasta
// temporária no lugar do G:. Os textos são os reais (a DAE da taxa da CND do IEF, o extrato do BB da 444), encurtados.
// Rode: node robo/teste-arquivador-refazer-mes.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const W = path.win32;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'refazer-mes-'));
const DRIVE = path.join(TMP, 'Meu Drive');
process.env.ARQ_NOVO_CONTROLE = path.join(TMP, 'controle');
process.env.ARQ_CORRECAO_DRIVE = DRIVE;
fs.mkdirSync(path.join(process.env.ARQ_NOVO_CONTROLE, 'MANIFESTO'), { recursive: true });

const F = require('./arquivador-refazer-mes');
const C = require('./arquivador-correcao');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
const escrever = (rel, conteudo) => { const p = path.join(DRIVE, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, conteudo); return p; };
const existe = rel => fs.existsSync(path.join(DRIVE, rel));

const DAE = em => 'SECRETARIA DE ESTADO DE FAZENDA DE MINAS GERAIS\nINSTITUTO ESTADUAL DE FLORESTAS - IEF Serviço:\nEMISSAO CERTIDAO DEBITOS FLORESTAIS\nTAXA DE EXPEDIENTE - IEF 40,53 0,00 0,00 TOTAL 40,53\n'
  + (em ? 'Emitido em: ' + em + ' 10:25:19\n' : '') + 'DOCUMENTO DE ARRECADAÇÃO ESTADUAL - DAE\nValidade 30/12/2026\nMês Ano de Referência\n30 a 30/12/2026';
const EXT444 = 'Extrato de Conta Corrente\nCliente: GALPAO V LOCADORA EIRELI\nAgência: 2705-7 Conta: 29560-4\nLançamentos Dia Histórico Valor 14.396,95 (+) 30/09/2026 Saldo Anterior 1.567,00 (-) 01/10/2026 Pix - Enviado\n'
  + '01/10 17:43 GILMAR PEREIRA SOUZA 9.000,00 (-) 02/10/2026 Pix - Enviado\n02/10 09:26 ALECIO 3.763,40 (-) 05/10/2026 BB GIRO FGO PRONAMPE 5.000,00 (+) 06/10/2026 Pix - Recebido\n'
  + '3.000,00 (-) 06/10/2026 Cheque Compensado 175,01 (-) 08/10/2026 Pix - Enviado\n300,00 (-) 13/10/2026 Pagamento de Boleto\n18.000,00 (+) 14/10/2026 Pix - Recebido\n'
  + '20.000,00 (+) 15/10/2026 Pix - Recebido\n55.000,00 (+) 19/10/2026 Pix - Recebido\n172,80 (-) 26/10/2026 Tarifa Pacote de Serviços\nCobrança referente 26/10/2026 1.184,19 (-) 28/10/2026 Pagamento de Boleto\n'
  + '30/10/2026 Pix - Enviado\n2.485,28 (-) 31/10/2026 S A L D O 11.176,76 (+)';

(async () => {
  try {
    // ---------- puras ----------
    igual('a marca do erro: o mês do nome igual ao do vencimento', ['12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf', '12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026 (3).pdf',
      '11-2025 - DAE TAXA - VALOR R$625,00 - VENCIMENTO 26-12-2025.pdf', '12-2026 - DAE ICMS - VALOR R$10,00 - VENCIMENTO 30-12-2026.pdf', '06-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf'].map(n => !!F.daeTaxaSuspeita(n)),
      [true, true, false, false, false]);
    igual('o "Emitido em" da guia', [F.emissaoDoTexto(DAE('25/06/2026')), F.emissaoDoTexto(DAE(null))], [{ mes: 6, ano: 2026 }, null]);
    igual('o nome com o mês novo, sem o " (N)"', F.nomeComMes('12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026 (3).pdf', { mes: 6, ano: 2026 }), '06-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf');

    // ---------- a árvore de mentira ----------
    const D414 = '2026\\414 - BRAZILIAN FORESTRY EMPREENDIMENTOS FLORESTAIS LTDA\\FISCAL\\LUCRO REAL\\05. DAE\\';
    const D416 = '2025\\416 - LAVICA EMPREENDIMENTOS FLORESTAIS LTDA\\FISCAL\\LUCRO PRESUMIDO\\05. DAE\\';
    const D411 = '2025\\411 - MINAS FORESTRY LTDA\\FISCAL\\LUCRO PRESUMIDO\\05. DAE\\';
    const B444 = '2026\\444 - GALPAO VEICULOS E LOCADORA LTDA\\CONTÁBIL\\EXTRATOS\\2026\\';
    const textos = new Map();
    const pdf = (rel, texto) => { const p = escrever(rel, texto); textos.set(p, texto); return p; };
    pdf(D414 + '12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf', DAE('25/06/2026'));
    pdf(D414 + '12-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026.pdf', DAE('25/06/2026').replace('40,53', '69,48'));
    pdf(D414 + '06-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026.pdf', 'outra guia que já estava em 06');                // o destino ocupado: " (1)"
    pdf(D416 + '12-2025 - DAE TAXA - VALOR R$77095,92 - VENCIMENTO 30-12-2025.pdf', DAE('13/01/2025').replace('30/12/2026', '30/12/2025'));
    pdf(D416 + '12-2025 - DAE TAXA - VALOR R$575,49 - VENCIMENTO 30-12-2025.pdf', DAE('11/12/2025').replace('30/12/2026', '30/12/2025')); // emitida em 12: fica
    pdf(D411 + '12-2025 - DAE TAXA - VALOR R$719,18 - VENCIMENTO 30-12-2025.pdf', DAE('20/11/2024').replace('30/12/2026', '30/12/2025')); // outro ano: revisar
    pdf(D411 + '12-2025 - DAE TAXA - VALOR R$497,79 - VENCIMENTO 30-12-2025.pdf', DAE(null));                                        // sem "Emitido em": fica
    pdf(D411 + '04-2025 - DAE - DAE IPVA E TAXA DE LICENC KOMBI R$248,06.pdf', 'ipva');                                                 // não é suspeita
    const e1 = pdf(B444 + '11\\BANCÁRIOS\\BANCO DO BRASIL\\11-2026.pdf', EXT444);
    const e2 = pdf(B444 + '11\\BANCÁRIOS\\BANCO DO BRASIL\\11-2026 (1).pdf', EXT444.replace(/\/10\/2026/g, '/09/2026').replace('30/09/2026 Saldo', '31/08/2026 Saldo'));
    pdf(B444 + '10\\BANCÁRIOS\\BANCO DO BRASIL\\10-2026.pdf', 'o de outubro de outra conta');                                       // ocupado: " (1)"

    const raizes = [2025, 2026].map(ano => ({ ano, raiz: W.join(DRIVE, String(ano)) }));
    const lerTexto = async c => { if (!textos.has(c)) throw new Error('sem texto'); return textos.get(c); };
    const r = await F.planejar({ drive: DRIVE, raizes, ler: F.lerDoDisco, lerTexto, extratos: [e1, e2], tamanho: c => fs.statSync(c).size });
    const rel = p => W.relative(DRIVE, p);
    igual('as suspeitas: só as DAE de taxa com o mês do vencimento (6 das 7 da pasta DAE; o IPVA não)', r.daes, 6);
    igual('o plano: a DAE para o mês do "Emitido em", o extrato para o mês dos lançamentos',
      r.plano.map(p => [rel(p.de).split('\\').pop(), rel(p.para), p.automatico]).sort(),
      [['11-2026 (1).pdf', B444 + '09\\BANCÁRIOS\\BANCO DO BRASIL\\09-2026.pdf', true],
        ['11-2026.pdf', B444 + '10\\BANCÁRIOS\\BANCO DO BRASIL\\10-2026.pdf', true],
        ['12-2025 - DAE TAXA - VALOR R$719,18 - VENCIMENTO 30-12-2025.pdf', '2024\\411 - MINAS FORESTRY LTDA\\FISCAL\\LUCRO PRESUMIDO\\05. DAE\\11-2024 - DAE TAXA - VALOR R$719,18 - VENCIMENTO 30-12-2025.pdf', false],
        ['12-2025 - DAE TAXA - VALOR R$77095,92 - VENCIMENTO 30-12-2025.pdf', D416 + '01-2025 - DAE TAXA - VALOR R$77095,92 - VENCIMENTO 30-12-2025.pdf', true],
        ['12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf', D414 + '06-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf', true],
        ['12-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026.pdf', D414 + '06-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026.pdf', true]].sort());
    igual('o que fica: a emitida no mês do vencimento e a sem "Emitido em"', r.ficam.map(f => f.motivo).sort(), ['emitida no mesmo mês do vencimento: já está certa', 'o "Emitido em" não foi lido']);

    // ---------- o executor: simulação e produção ----------
    const sim = new C.Correcao({ producao: false, log: () => {} });
    const rs = C.etapaDoPlano(sim, r.plano, 'pasta');
    igual('simulação: 5 automáticos e 1 para revisar (o que troca o ano da raiz); nada mexido', [rs.automaticos, rs.revisar, existe(D414 + '12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf')], [5, 1, true]);
    const pro = new C.Correcao({ producao: true, log: () => {} });
    C.etapaDoPlano(pro, r.plano, 'pasta');
    igual('produção: a DAE em 06-2026, a de 2025 em 01-2025; o nome ocupado vira " (1)"',
      [existe(D414 + '06-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf'), existe(D414 + '06-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026 (1).pdf'),
        fs.readFileSync(path.join(DRIVE, D414 + '06-2026 - DAE TAXA - VALOR R$69,48 - VENCIMENTO 30-12-2026.pdf'), 'utf8'), existe(D416 + '01-2025 - DAE TAXA - VALOR R$77095,92 - VENCIMENTO 30-12-2025.pdf'),
        existe(D414 + '12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf')],
      [true, true, 'outra guia que já estava em 06', true, false]);
    igual('produção: o extrato da 444 em 10 (com " (1)", o 10-2026 já existia) e o de setembro em 09',
      [existe(B444 + '10\\BANCÁRIOS\\BANCO DO BRASIL\\10-2026 (1).pdf'), existe(B444 + '09\\BANCÁRIOS\\BANCO DO BRASIL\\09-2026.pdf'), existe(B444 + '11\\BANCÁRIOS\\BANCO DO BRASIL\\11-2026.pdf')],
      [true, true, false]);
    igual('produção: o que troca o ano da raiz não foi mexido', existe(D411 + '12-2025 - DAE TAXA - VALOR R$719,18 - VENCIMENTO 30-12-2025.pdf'), true);
    const des = new C.Correcao({ producao: true, log: () => {} });
    C.desfazer(des, pro.diario);
    igual('o --desfazer devolve tudo', [existe(D414 + '12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf'), existe(B444 + '11\\BANCÁRIOS\\BANCO DO BRASIL\\11-2026.pdf'), existe(D414 + '06-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf')], [true, true, false]);
  } catch (e) {
    falhas++;
    console.log('FALHOU com erro:', e.stack);
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* o temporário fica */ }
  }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
