// Testes (07/11/2026) do que corta o desperdício do arquivador novo: o retrato dos índices (arquivador-retrato.js), a leitura do
// .jsonl a partir de um byte, os "já decididos" do reprocesso (reprocesso-decididos.js) e o arquivo que sumiu da origem
// ("saiu da pasta", não erro). Tudo em pastas temporárias. Uso: node teste-arquivador-retrato.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const K = require('./arquivador-chaves');
const T = require('./arquivador-conteudos');
const D = require('./reprocesso-decididos');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) { falhas++; console.log('FALHOU:', nome, '\n  obtido:  ', JSON.stringify(obtido), '\n  esperado:', JSON.stringify(esperado)); }
}
function chave(uf, aamm, cnpj, modelo, numero) {
  const base = uf + aamm + cnpj + modelo + '001' + String(numero).padStart(9, '0') + '1' + '12345678';
  let soma = 0, peso = 2;
  for (let i = base.length - 1; i >= 0; i--) { soma += +base[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return base + (r < 2 ? 0 : 11 - r);
}
const jl = (arq, linhas) => fs.appendFileSync(arq, linhas.map(l => JSON.stringify(l)).join('\n') + '\n');

(async () => {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'teste-retrato-'));
  try {
    // ---------- 1. cadaLinha a partir de um byte ----------
    {
      const arq = path.join(tmp, 'a.jsonl');
      fs.writeFileSync(arq, '{"n":1,"t":"ação"}\n{"n":2}\n{"n":3');   // a última linha ainda sem quebra (sendo escrita, JSON incompleto: não conta)
      const vistos = [], meta = {};
      T.cadaLinha(arq, r => vistos.push(r.n), 0, meta);
      igual('cadaLinha: lê tudo, o fim é depois da última linha COMPLETA', [vistos, meta.fim], [[1, 2], Buffer.byteLength('{"n":1,"t":"ação"}\n{"n":2}\n')]);
      fs.appendFileSync(arq, '}\n{"n":4}\n');
      const v2 = [], m2 = {};
      T.cadaLinha(arq, r => v2.push(r.n), meta.fim, m2);
      igual('cadaLinha: a partir do fim anterior pega a linha que estava pela metade e as novas', [v2, m2.fim], [[3, 4], fs.statSync(arq).size]);
      const m3 = {};
      igual('cadaLinha: arquivo que não existe é vazio (fim 0)', [T.cadaLinha(path.join(tmp, 'nao-existe.jsonl'), () => {}, 0, m3), m3.fim], [0, 0]);
    }

    // ---------- 2. o retrato do índice de chaves ----------
    const raiz = path.join(tmp, 'Meu Drive', '2026');
    const ctl = path.join(tmp, 'controle');
    fs.mkdirSync(path.join(ctl, 'MANIFESTO'), { recursive: true }); fs.mkdirSync(path.join(ctl, 'continuo'), { recursive: true });
    const TRANSP = '05201107000111';
    const CH = [1, 2, 3, 4, 5].map(n => chave('31', '2610', TRANSP, '57', 1000 + n));
    const pastaCte = c => path.join(raiz, c + ' - CLIENTE ' + c, 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'CT-e');
    const man = path.join(ctl, 'MANIFESTO', 'manifesto.jsonl');
    jl(man, [{ chave: CH[0], destino_final: pastaCte(152), nome_final: '10-2026_CT-e_1001.xml' }, { chave: CH[1], destino_final: pastaCte(380), nome_final: '10-2026_CT-e_1002.xml' }]);
    const diario = path.join(ctl, 'continuo', 'decisoes-2026-11.jsonl');
    jl(diario, [{ modo: 'PRODUCAO', acao: 'ARQUIVAR', chave: CH[2], onde: path.join(pastaCte(152), '10-2026_CT-e_1003.xml') }]);
    const opc = { controle: ctl, manifestoAntigo: path.join(tmp, 'sem-manifesto.jsonl'), raiz };
    // (a ordem entre clientes de mesmo peso pode mudar quando o final vem depois do retrato: compara sem a ordem)
    const resumo = i => CH.map(c => i.achar(c).map(x => x.cliente + ':' + x.de + ':' + (x.sub || []).join('/')).sort());

    const i1 = K.carregar(opc);
    igual('retrato: a 1ª leitura é inteira e grava o retrato', [i1.estatistica.retrato, fs.existsSync(path.join(ctl, 'retrato-chaves.bin')), i1.tamanho], [false, true, 3]);
    const i2 = K.carregar(opc);
    igual('retrato: a 2ª leitura usa o retrato, sem linha nova, com o mesmo índice', [i2.estatistica.retrato, i2.estatistica.linhas, i2.tamanho, resumo(i2)], [true, 0, 3, resumo(i1)]);
    igual('retrato: o conjunto "já gravado" volta (anotar não regrava o que já está nos arquivos)', i2.salvas.has(CH[0] + '|152'), true);

    // o que foi acrescentado depois do retrato (chaves.jsonl, o diário, o manifesto) entra só pelo final
    jl(path.join(ctl, 'chaves.jsonl'), [{ ch: CH[3], cliente: 380, sub: ['FISCAL'], de: 'doc', fonte: 'teste' }]);
    jl(diario, [{ modo: 'PRODUCAO', acao: 'ARQUIVAR', chave: CH[4], onde: path.join(pastaCte(380), '10-2026_CT-e_1005.xml') }]);
    jl(man, [{ chave: CH[2], destino_final: pastaCte(380), nome_final: '10-2026_CT-e_1003.xml' }]);
    const i3 = K.carregar(opc);
    const cheio = K.carregar(Object.assign({}, opc, { retrato: false }));
    igual('retrato: lê só o final dos .jsonl (3 linhas) e fica igual à leitura inteira', [i3.estatistica.retrato, i3.estatistica.linhas, i3.tamanho, resumo(i3)], [true, 3, 5, resumo(cheio)]);
    // o retrato novo já tem tudo: a leitura seguinte não lê linha nenhuma
    igual('retrato: regravado depois do final, a leitura seguinte não lê nada', K.carregar(opc).estatistica.linhas, 0);

    // não bate: o começo do diário mudou (reescrito) → relê tudo
    const lido = fs.readFileSync(diario, 'utf8');
    fs.writeFileSync(diario, lido.replace('PRODUCAO', 'PRODUCAX'));
    const i4 = K.carregar(opc);
    igual('retrato: o diário reescrito (o começo não bate) → leitura inteira', [i4.estatistica.retrato, i4.estatistica.linhas > 3], [false, true]);
    fs.writeFileSync(diario, lido);
    K.carregar(opc);   // refaz o retrato
    // um diário que sumiu → relê tudo
    const lixo = path.join(ctl, 'continuo', 'decisoes-2026-10.jsonl');
    jl(lixo, [{ modo: 'PRODUCAO', acao: 'ARQUIVAR', chave: CH[0], onde: path.join(pastaCte(152), 'x.xml') }]);
    K.carregar(opc);
    fs.unlinkSync(lixo);
    igual('retrato: uma origem que sumiu → leitura inteira', K.carregar(opc).estatistica.retrato, false);
    // o arquivo encolheu
    K.carregar(opc);
    fs.writeFileSync(man, fs.readFileSync(man, 'utf8').split('\n').slice(0, 1).join('\n') + '\n');
    igual('retrato: o manifesto encolheu → leitura inteira', K.carregar(opc).estatistica.retrato, false);
    // outra raiz de clientes: o retrato não vale
    K.carregar(opc);
    igual('retrato: outra raiz de clientes → leitura inteira', K.carregar(Object.assign({}, opc, { raiz: path.join(tmp, 'Meu Drive', '2027') })).estatistica.retrato, false);
    // retrato estragado → leitura inteira, sem erro
    fs.writeFileSync(path.join(ctl, 'retrato-chaves.bin'), 'lixo');
    igual('retrato: arquivo estragado → leitura inteira, sem erro', K.carregar(opc).estatistica.retrato, false);

    // ---------- 3. o retrato do índice de conteúdo ----------
    const ctl2 = path.join(tmp, 'controle2');
    fs.mkdirSync(path.join(ctl2, 'MANIFESTO'), { recursive: true }); fs.mkdirSync(path.join(ctl2, 'continuo'), { recursive: true });
    const man2 = path.join(ctl2, 'MANIFESTO', 'manifesto.jsonl');
    const dest = path.join(tmp, '2026', '152 - A', 'DOC');
    const H = n => String(n).repeat(64).slice(0, 64);
    jl(man2, [{ hash_origem: H(1), destino_final: dest, nome_final: 'a.pdf' }, { hash_origem: H(2), hash_destino: H(3), destino_final: dest, nome_final: 'b.pdf' }]);
    const o2 = { controle: ctl2, manifestoAntigo: path.join(tmp, 'sem.jsonl') };
    const c1 = T.carregar(o2);
    const c2 = T.carregar(o2);
    igual('conteúdos: 1ª inteira; 2ª do retrato, igual', [c1.estatistica.retrato, c2.estatistica.retrato, c2.estatistica.linhas, c2.tamanho, c2.achar(H(2)), c2.achar(H(3))], [false, true, 0, c1.tamanho, c1.achar(H(2)), c1.achar(H(3))]);
    // o que o arquivador anota depois (conteudos.jsonl) e um manifesto que cresceu
    const c3a = T.carregar(o2); c3a.anotar([H(4)], path.join(dest, 'c.pdf'));
    jl(man2, [{ hash_origem: H(5), destino_final: dest, nome_final: 'd.pdf' }]);
    const c3 = T.carregar(o2);
    const c3cheio = T.carregar(Object.assign({}, o2, { retrato: false }));
    igual('conteúdos: pega só o final (a anotação e a linha nova) e fica igual à inteira', [c3.estatistica.retrato, c3.estatistica.linhas, c3.tamanho, c3.achar(H(4)), c3.achar(H(5))], [true, 2, c3cheio.tamanho, c3cheio.achar(H(4)), c3cheio.achar(H(5))]);
    igual('conteúdos: a pasta do destino continua guardada uma vez só depois do retrato', [c3.pastas.length, c3.achar(H(1))[0].toLowerCase().endsWith('a.pdf')], [1, true]);

    // ---------- 4. os já decididos do reprocesso ----------
    {
      const reg = D.ler(path.join(tmp, 'dec.json'), 'v1');
      const st = { size: 100, mtimeMs: 1700000000000.4 };
      const docs = [
        { rel: 'N1\\a.pdf', acao: 'NAO_IDENTIFICADO', motivo: 'TIPO_NAO_RECONHECIDO' },
        { rel: 'N1\\b.pdf', acao: 'NAO_IDENTIFICADO', motivo: 'CLIENTE_NAO_LOCALIZADO' },
        { rel: 'N1\\z.zip\\x.pdf', dentroDe: 'N1\\z.zip', acao: 'NAO_IDENTIFICADO', motivo: 'FORMATO_SEM_REGRA' },
        { rel: 'N1\\z.zip\\y.pdf', dentroDe: 'N1\\z.zip', acao: 'ARQUIVAR' },
        { rel: 'N1\\e.pdf', acao: 'NAO_IDENTIFICADO', motivo: 'VOCABULARIO_AUSENTE', erro: 'x' },
      ];
      const stats = new Map(['N1\\a.pdf', 'N1\\b.pdf', 'N1\\z.zip', 'N1\\e.pdf'].map(r => [r, st]));
      igual('decididos: só entra o de motivo fixo, sem erro e com todos os de dentro assim', [D.anotar(reg, docs, stats, 1000), Object.keys(reg.itens)], [1, ['N1\\a.pdf']]);
      igual('decididos: mesmo arquivo, mesma versão → pula', D.jaDecidido(reg, 'N1\\a.pdf', st, 2000), 'TIPO_NAO_RECONHECIDO');
      igual('decididos: o arquivo mudou (tamanho) → reprocessa', D.jaDecidido(reg, 'N1\\a.pdf', { size: 101, mtimeMs: st.mtimeMs }, 2000), null);
      igual('decididos: o arquivo mudou (data) → reprocessa', D.jaDecidido(reg, 'N1\\a.pdf', { size: 100, mtimeMs: st.mtimeMs + 5000 }, 2000), null);
      igual('decididos: passou de 7 dias → reprocessa', D.jaDecidido(reg, 'N1\\a.pdf', st, 1000 + 8 * 864e5), null);
      igual('decididos: o motivo que depende do cadastro nunca é pulado', D.jaDecidido(Object.assign({}, reg, { itens: { 'N1\\b.pdf': { m: 'CLIENTE_NAO_LOCALIZADO', em: 1000, t: 100, mt: Math.round(st.mtimeMs) } } }), 'N1\\b.pdf', st, 2000), null);
      D.gravar(path.join(tmp, 'dec.json'), reg);
      igual('decididos: outra versão das regras → registro vazio', [Object.keys(D.ler(path.join(tmp, 'dec.json'), 'v1').itens), Object.keys(D.ler(path.join(tmp, 'dec.json'), 'v2').itens)], [['N1\\a.pdf'], []]);
      // depois: resolveu (virou ARQUIVAR) → sai do registro; e a poda tira o que sumiu da pasta
      D.anotar(reg, [{ rel: 'N1\\a.pdf', acao: 'ARQUIVAR' }], stats, 3000);
      igual('decididos: o que se resolveu sai do registro', Object.keys(reg.itens), []);
      reg.itens['N1\\sumiu.pdf'] = { m: 'TIPO_NAO_RECONHECIDO', em: 1, t: 1, mt: 1 };
      igual('decididos: a poda tira o que já não está na pasta', [D.podar(reg, ['N1\\outro.pdf']), Object.keys(reg.itens)], [1, []]);
      igual('decididos: a versão das regras é um hash estável de 16 hex', [/^[0-9a-f]{16}$/.test(A.versaoDasRegras()), A.versaoDasRegras() === A.versaoDasRegras()], [true, true]);
    }

    // ---------- 5. o arquivo que sumiu da origem: "saiu da pasta", não erro ----------
    {
      const sb = path.join(tmp, 'prod');
      const origem = path.join(sb, 'origem'), clientes = path.join(sb, '2026'), ctlP = path.join(sb, 'controle');
      const LINHAS = [{ codigo: 152, razao: 'JANIO JOSE DE ALMEIDA', doc: '06.934.601/0001-58', regime: 'Simples' }];
      const PASTAS = ['152 - JANIO JOSE DE ALMEIDA'];
      for (const p of PASTAS) fs.mkdirSync(path.join(clientes, p), { recursive: true });
      fs.mkdirSync(path.join(origem, '2026-10'), { recursive: true });
      const cte = (ch, n) => '<cteProc><CTe><infCte Id="CTe' + ch + '"><ide><nCT>' + n + '</nCT><dhEmi>2026-10-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>' + TRANSP + '</CNPJ></emit><rem><CNPJ>' + TRANSP + '</CNPJ></rem><dest><CNPJ>06934601000158</CNPJ></dest></infCte></CTe></cteProc>';
      const base = { modo: 'PRODUCAO', confirmo: true, origem, clientes, controle: ctlP, cadastro: R.montarCadastro(LINHAS, PASTAS), manifestoAntigo: path.join(sb, 'nao-existe.jsonl'), travaAntiga: path.join(sb, 'nao-existe.lock'), tiposProducao: ['todos'], moverNaoIdentificados: true, pastaNaoIdentificados: 'HOJE', log: () => {} };
      // (a) sumiu antes da leitura
      const r1 = await A.executar(Object.assign({}, base, { arquivos: [path.join('2026-10', 'fantasma.xml')] }));
      igual('saiu da pasta: o que sumiu antes da leitura não é erro nem temporário', [r1.itens[0].motivo, !!r1.itens[0].sumiu, !!r1.itens[0].erro, !!r1.itens[0].temporario], ['SAIU_DA_PASTA', true, false, false]);
      // (b) leu, decidiu e sumiu na hora de mover (o rename/unlink dá ENOENT)
      const rel = path.join('2026-10', chave('31', '2610', TRANSP, '57', 77) + '-cte.xml');
      fs.writeFileSync(path.join(origem, rel), cte(chave('31', '2610', TRANSP, '57', 77), 77));
      const renomeia = fs.promises.rename;
      fs.promises.rename = async (de, para) => { try { fs.unlinkSync(de); } catch (e) { /* já foi */ } const e = new Error("ENOENT: no such file or directory, rename '" + de + "' -> '" + para + "'"); e.code = 'ENOENT'; throw e; };
      let r2;
      try { r2 = await A.executar(Object.assign({}, base, { arquivos: [rel] })); } finally { fs.promises.rename = renomeia; }
      igual('saiu da pasta: o ENOENT na hora de mover (o arquivo sumiu da origem) não é erro', [!!r2.itens[0].erro, !!r2.itens[0].sumiu, r2.itens[0].motivo], [false, true, 'SAIU_DA_PASTA']);
      // (c) ENOENT com o arquivo ainda lá (ex.: pasta do destino) continua sendo erro
      fs.writeFileSync(path.join(origem, rel), cte(chave('31', '2610', TRANSP, '57', 77), 77));
      fs.promises.rename = async () => { const e = new Error('ENOENT: destino'); e.code = 'ENOENT'; throw e; };
      let r3;
      try { r3 = await A.executar(Object.assign({}, base, { arquivos: [rel] })); } finally { fs.promises.rename = renomeia; }
      igual('saiu da pasta: ENOENT com o arquivo ainda na origem continua sendo erro', [!!r3.itens[0].erro, !!r3.itens[0].sumiu], [true, false]);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU com erro:', e.stack); process.exit(1); });
