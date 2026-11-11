// Testes do sieg-estado.js (07/11/2026): 404 do portal lembrado em arquivo, tentativas com espera crescente, pular o que o
// arquivador já arquivou. Rode:  node teste-sieg-estado.js   (sem rede, com fakes)
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('./sieg-estado');
const K = require('./arquivador-chaves');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + a + '\n        esperado: ' + b); }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sieg-estado-'));

(async () => {
  // ---- 404 do portal ----
  const arq = path.join(tmp, 'sub', 'p404.json');
  let t = Date.parse('2026-11-04T12:00:00Z');
  const a = E.criarPortal404(arq, { dias: 3, agora: () => t });
  igual('404: começa sem ninguém', a.recente('111'), false);
  a.anotar('111');
  igual('404: recém anotado', a.recente('111'), true);
  igual('404: outro cliente não', a.recente('222'), false);
  igual('404: guardado em arquivo (outra instância vê)', E.criarPortal404(arq, { dias: 3, agora: () => t }).recente('111'), true);
  t += 2 * 864e5;
  igual('404: 2 dias depois ainda vale', a.recente('111'), true);
  t += 2 * 864e5;
  igual('404: 4 dias depois volta a tentar o portal', a.recente('111'), false);
  a.anotar('333'); a.limpar('333');
  igual('404: limpar', a.recente('333'), false);
  igual('404: arquivo ilegível não quebra', E.criarPortal404(path.join(tmp, 'nao-existe.json')).recente('1'), false);
  igual('ehPortal404 sim', E.ehPortal404(new Error('o portal do SIEG respondeu 404')), true);
  igual('ehPortal404 não (403)', E.ehPortal404(new Error('o portal do SIEG respondeu 403')), false);
  igual('ehPortal404 não (4040)', E.ehPortal404(new Error('o portal do SIEG respondeu 4041')), false);

  // ---- tentativas ----
  const esperou = [];
  const dormir = ms => { esperou.push(ms); return Promise.resolve(); };
  let n = 0;
  const r1 = await E.comTentativas(() => { if (++n < 3) throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }); return 'ok'; }, { dormir });
  igual('tentativas: deu na 3ª', [r1, n, esperou], ['ok', 3, [5000, 15000]]);
  esperou.length = 0; n = 0;
  let erro = null;
  try { await E.comTentativas(() => { n++; throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }); }, { dormir }); } catch (e) { erro = e; }
  igual('tentativas: esgota (1 + 3) e o erro sobe', [n, esperou, !!erro], [4, [5000, 15000, 30000], true]);
  esperou.length = 0; n = 0; erro = null;
  try { await E.comTentativas(() => { n++; throw new Error('HTTP 400'); }, { dormir }); } catch (e) { erro = e; }
  igual('tentativas: erro que não é de rede não repete', [n, esperou.length], [1, 0]);
  n = 0;
  const r2 = await E.tentarDeNovo(() => { if (++n < 2) throw new Error('firestore fora'); return 'gravou'; }, { dormir });
  igual('tentarDeNovo: qualquer erro', [r2, n], ['gravou', 2]);
  igual('ehErroDeRede: timeout do http()', E.ehErroDeRede(Object.assign(new Error('t'), { tempo: true })), true);

  // ---- já arquivados ----
  // chaves reais de formato válido (DV de módulo 11)
  const base = '3526' + '10' + '11222333000181' + '55' + '001' + '000000123' + '1' + '12345678';
  const dv = b => { let s = 0, p = 2; for (let i = b.length - 1; i >= 0; i--) { s += +b[i] * p; p = p === 9 ? 2 : p + 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const chDoc = base + dv(base);
  const base2 = '3526' + '10' + '11222333000181' + '55' + '001' + '000000124' + '1' + '12345678';
  const chNova = base2 + dv(base2);
  igual('chave de teste é válida', [K.chaveValida(chDoc), K.chaveValida(chNova)], [true, true]);
  const idx = new K.Indice(null);
  idx.juntar(chDoc, 236, null, 'doc', 'teste');
  const logs = [];
  let lidos = 0;
  const f = E.criarFiltroDeArquivados(() => { lidos++; return idx; }, { log: m => logs.push(m) });
  igual('pula documento já arquivado', f.pular(236, chDoc + '-nfe.xml'), true);
  igual('não pula documento novo', f.pular(236, chNova + '-nfe.xml'), false);
  igual('não pula se arquivado em outro cliente', f.pular(999, chDoc + '-nfe.xml'), false);
  igual('não pula evento (só o original foi arquivado)', f.pular(236, chDoc + '-evento-110111-1.xml'), false);
  igual('não pula nome sem chave', f.pular(236, 'xml-abcdef.xml'), false);
  // o PDF da nota já arquivado (11/11/2026): o índice guarda o PDF como 'outro'
  idx.juntar(chNova, 236, null, 'outro', 'teste');
  igual('PDF: a nota com PDF arquivado neste cliente', f.pdfArquivado(236, chNova + '-nfe.xml'), true);
  igual('PDF: só o XML arquivado não é PDF', f.pdfArquivado(236, chDoc + '-nfe.xml'), false);
  igual('PDF: em outro cliente não vale', f.pdfArquivado(999, chNova + '-nfe.xml'), false);
  igual('índice lido uma vez só', lidos, 1);
  const g = E.criarFiltroDeArquivados(() => { throw new Error('G: fora do ar'); }, { log: m => logs.push(m) });
  igual('índice ilegível: não pula nada (como antes)', g.pular(236, chDoc + '-nfe.xml'), false);
  igual('índice ilegível: avisa no log', logs.some(m => /G: fora do ar/.test(m)), true);
  // validade: relê depois do prazo
  let agora = 0; lidos = 0;
  const h = E.criarFiltroDeArquivados(() => { lidos++; return idx; }, { validadeMs: 1000, agora: () => agora, log: () => {} });
  h.pular(236, chDoc + '-nfe.xml'); agora = 500; h.pular(236, chDoc + '-nfe.xml'); agora = 2000; h.pular(236, chDoc + '-nfe.xml');
  igual('relê o índice depois da validade', lidos, 2);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(falhas ? falhas + ' de ' + total + ' FALHARAM' : 'OK - ' + total + ' verificações');
  process.exit(falhas ? 1 : 0);
})();
