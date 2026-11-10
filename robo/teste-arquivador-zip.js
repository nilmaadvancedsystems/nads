// Teste do compactado em produção (04/11/2026): os de dentro de um .zip gravam vários ao mesmo tempo e o .zip só vai para
// a quarentena depois de todos gravados. Tudo numa pasta temporária. node teste-arquivador-zip.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');

let falhas = 0, total = 0;
const igual = (nome, obtido, esperado) => { total++; const ok = JSON.stringify(obtido) === JSON.stringify(esperado); if (!ok) { falhas++; console.log('FALHOU:', nome, '\n  obtido:  ', JSON.stringify(obtido), '\n  esperado:', JSON.stringify(esperado)); } };
function chave(uf, aamm, cnpj, modelo, numero) {
  const base = uf + aamm + cnpj + modelo + '001' + String(numero).padStart(9, '0') + '1' + '12345678';
  let soma = 0, peso = 2;
  for (let i = base.length - 1; i >= 0; i--) { soma += +base[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return base + (r < 2 ? 0 : 11 - r);
}
const TRANSP = '05201107000111';
const cte = (ch, n, dest) => '<cteProc><CTe><infCte Id="CTe' + ch + '"><ide><nCT>' + n + '</nCT><dhEmi>2026-10-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>' + TRANSP + '</CNPJ></emit><rem><CNPJ>' + TRANSP + '</CNPJ></rem><dest><CNPJ>' + dest + '</CNPJ></dest></infCte></CTe></cteProc>';
const LINHAS = [{ codigo: 152, razao: 'JANIO JOSE DE ALMEIDA', doc: '06.934.601/0001-58', regime: 'Simples' }];
const PASTAS = ['152 - JANIO JOSE DE ALMEIDA'];

(async () => {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'teste-zip-'));
  try {
    const origem = path.join(tmp, 'origem'), clientes = path.join(tmp, '2026'), ctl = path.join(tmp, 'controle'), monta = path.join(tmp, 'monta');
    fs.mkdirSync(path.join(clientes, PASTAS[0]), { recursive: true });
    fs.mkdirSync(path.join(origem, '2026-10'), { recursive: true });
    fs.mkdirSync(monta, { recursive: true });
    const N = 9;
    const nomes = [];
    for (let i = 0; i < N; i++) { const n = 5000 + i, ch = chave('31', '2610', TRANSP, '57', n); const nome = ch + '-cte.xml'; fs.writeFileSync(path.join(monta, nome), cte(ch, n, '06934601000158')); nomes.push(n); }
    // (10/11/2026: "o arquivador vai IGNORAR fotos") uma foto dentro do .zip e outra solta na pasta
    fs.writeFileSync(path.join(monta, 'foto do caminhão.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]));
    fs.writeFileSync(path.join(origem, '2026-10', 'solta.jpeg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    const rel = '2026-10\SIEG lote.zip';
    execFileSync(path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', path.join(origem, rel), ...fs.readdirSync(monta)], { cwd: monta });
    const base = { modo: 'PRODUCAO', confirmo: true, origem, clientes, controle: ctl, cadastro: R.montarCadastro(LINHAS, PASTAS), manifestoAntigo: path.join(tmp, 'x.jsonl'), travaAntiga: path.join(tmp, 'x.lock'), tiposProducao: ['todos'], moverNaoIdentificados: true, pastaNaoIdentificados: 'HOJE', log: () => {} };
    // conta quantas gravações ficam abertas ao mesmo tempo
    let abertas = 0, maxAbertas = 0;
    const original = fs.promises.writeFile;
    fs.promises.writeFile = async (...a) => { abertas++; maxAbertas = Math.max(maxAbertas, abertas); await new Promise(r => setTimeout(r, 40)); try { return await original.apply(fs.promises, a); } finally { abertas--; } };
    let res;
    try { res = await A.executar(Object.assign({}, base, { arquivos: [rel] })); } finally { fs.promises.writeFile = original; }
    const pastaCte = path.join(clientes, PASTAS[0], 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e');
    igual('o .zip é um compactado', res.itens[0].acao, 'CONTEINER');
    igual('todos os de dentro gravados no cliente', nomes.map(n => fs.existsSync(path.join(pastaCte, '10-2026_CT-e_' + n + '.xml'))), nomes.map(() => true));
    igual('nenhum erro', res.itens.flatMap(i => [i.erro, ...(i.filhos || []).map(f => f.erro)]).filter(Boolean), []);
    igual('o .zip saiu da origem (quarentena)', fs.existsSync(path.join(origem, rel)), false);
    igual('gravou mais de um ao mesmo tempo (até 4)', [maxAbertas > 1, maxAbertas <= 4], [true, true]);
    const man = fs.readFileSync(path.join(ctl, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n');
    igual('uma linha do manifesto por XML', man.length, N);
    // a foto: a de dentro do .zip fica de fora (IGNORAR, não é gravada em lugar nenhum e não segura o .zip); a solta nem entra na varredura
    const foto = res.itens[0].filhos.find(f => /foto do caminh/.test(f.rel));
    igual('10/11: a foto de dentro do .zip é ignorada (sem OCR, sem regra)', foto && [foto.acao, foto.motivo], ['IGNORAR', 'FOTO']);
    const fotosEm = d => { let n = 0; let l = []; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return 0; } for (const e of l) n += e.isDirectory() ? fotosEm(path.join(d, e.name)) : /\.jpe?g$/i.test(e.name) ? 1 : 0; return n; };
    igual('10/11: ... e não foi gravada no cliente nem em NÃO IDENTIFICADOS', [fotosEm(clientes), fotosEm(path.join(origem, 'NÃO IDENTIFICADOS'))], [0, 0]);
    igual('10/11: a foto solta fica na origem e a varredura nem a lista', [fs.existsSync(path.join(origem, '2026-10', 'solta.jpeg')), A.varrer(origem, {}).some(r => /solta/.test(r))], [true, false]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
