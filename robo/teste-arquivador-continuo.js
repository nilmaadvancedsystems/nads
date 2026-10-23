// Testes do modo contínuo do arquivador novo (arquivador-continuo.js). Rode:  node teste-arquivador-continuo.js
// Sem Drive e sem banco: a pasta de origem e o controle são temporários.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('./arquivador-continuo');
const R = require('./arquivador-regras');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- temporários e estabilidade ----------
igual('temporário do Office', C.ehTemporario('~$planilha.xlsx'), true);
igual('download do Chrome pela metade', C.ehTemporario('extrato.pdf.crdownload'), true);
igual('temporário do Drive', C.ehTemporario('.~arquivo.pdf'), true);
igual('desktop.ini', C.ehTemporario('desktop.ini'), true);
igual('arquivo normal', C.ehTemporario('Extrato 09-2026.pdf'), false);

const mapa = new Map();
const T0 = 1_000_000_000_000;
igual('1ª vez que vê: ainda não', C.estaveis(mapa, [{ rel: 'a.pdf', tam: 10, mtime: T0 - 120000 }], T0, 45000), []);
igual('mudou o tamanho: recomeça', C.estaveis(mapa, [{ rel: 'a.pdf', tam: 20, mtime: T0 - 120000 }], T0 + 30000, 45000), []);
igual('parado há 45 s: pronto', C.estaveis(mapa, [{ rel: 'a.pdf', tam: 20, mtime: T0 - 120000 }], T0 + 80000, 45000), ['a.pdf']);
igual('data de modificação recente (ainda gravando): não', C.estaveis(new Map([['b.pdf', { tam: 5, mtime: T0, desde: T0 - 60000 }]]), [{ rel: 'b.pdf', tam: 5, mtime: T0 }], T0 + 10000, 45000), []);
igual('arquivo de 0 byte: nunca', C.estaveis(new Map([['c.pdf', { tam: 0, mtime: 0, desde: 0 }]]), [{ rel: 'c.pdf', tam: 0, mtime: 0 }], T0, 45000), []);
const m2 = new Map([['sumiu.pdf', { tam: 1, mtime: 0, desde: 0 }]]);
C.estaveis(m2, [], T0, 45000);
igual('arquivo que sumiu sai do acompanhamento', m2.size, 0);

// ---------- config ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-continuo-'));
try {
  const cfgArq = path.join(tmp, 'config.json');
  igual('sem config: simulação, nenhum tipo em produção', [C.lerConfig(cfgArq, null).modo, C.lerConfig(cfgArq, null).tiposProducao], ['simulacao', []]);
  igual('config do banco vale sem o arquivo', C.lerConfig(cfgArq, { modo: 'producao', tiposProducao: ['XML'] }).tiposProducao, ['XML']);
  fs.writeFileSync(cfgArq, JSON.stringify({ modo: 'desligado' }));
  igual('o arquivo manda sobre o banco', C.lerConfig(cfgArq, { modo: 'producao' }).modo, 'desligado');
  fs.writeFileSync(cfgArq, JSON.stringify({ modo: 'qualquer' }));
  igual('modo inválido vira simulação', C.lerConfig(cfgArq, null).modo, 'simulacao');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---------- lado a lado ----------
const antigas = [
  { hash_origem: 'h1', nome_original: 'a.xml', destino_final: 'G:\\Meu Drive\\2026\\1 - X\\FISCAL', nome_final: 'a.xml', id_execucao: '20261021-090000', timestamp: '2026-10-21T09:10:00' },
  { hash_origem: 'h2', nome_original: 'b.pdf', destino_final: 'G:\\Meu Drive\\2026\\1 - X\\C', nome_final: 'b.pdf', id_execucao: '20261021-090000', timestamp: '2026-10-21T09:10:00' },
  { hash_origem: 'h3', nome_original: 'c.pdf', destino_final: 'G:\\Meu Drive\\2026\\1 - X\\C', nome_final: 'c.pdf', id_execucao: '20261021-090000', timestamp: '2026-10-21T09:10:00' },
  { hash_origem: 'h4', nome_original: 'd.pdf', destino_final: 'G:\\Meu Drive\\2026\\1 - X\\C', nome_final: 'd.pdf', id_execucao: '20261021-090000', timestamp: '2026-10-21T09:10:00' },
  { hash_origem: 'h9', nome_original: 'velho.pdf', destino_final: 'G:\\x', nome_final: 'v.pdf', id_execucao: '20261020-090000', timestamp: '2026-10-20T09:10:00' },
];
const novas = [
  { hash: 'h1', acao: 'ARQUIVAR', onde: 'G:\\Meu Drive\\2026\\1 - X\\FISCAL\\a.xml' },
  { hash: 'h2', acao: 'ARQUIVAR', onde: 'G:\\Meu Drive\\2026\\2 - Y\\C\\b.pdf' },
  { hash: 'h3', acao: 'NAO_IDENTIFICADO', motivo: 'CONTEUDO_SEM_TEXTO' },
];
const r = C.compararDia('2026-10-21', antigas, novas);
igual('lado a lado: iguais, diferentes, não identificaria, não viu (só o dia)', [r.rotinaArquivou, r.iguais, r.diferentes, r.novoNaoIdentificou, r.novoNaoViu], [4, 1, 1, 1, 1]);
igual('lado a lado: o texto cita o destino diferente', /2 - Y/.test(C.textoDoLadoALado(r)), true);

// ---------- um ciclo de verdade, em simulação, numa pasta temporária ----------
(async () => {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-continuo-ciclo-'));
  try {
    const origem = path.join(sb, 'origem'), controle = path.join(sb, 'controle');
    fs.mkdirSync(origem, { recursive: true });
    fs.mkdirSync(controle, { recursive: true });
    fs.writeFileSync(path.join(controle, 'config.json'), JSON.stringify({ modo: 'simulacao', estavelMs: 0 }));
    const xml = '<nfeProc><NFe><infNFe><ide><mod>55</mod><nNF>1</nNF><dhEmi>2026-09-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>99999999000191</CNPJ></emit><dest><CNPJ>88888888000191</CNPJ></dest></infNFe></NFe></nfeProc>';
    const arq = path.join(origem, 'nota.xml');
    fs.writeFileSync(arq, xml);
    const passado = new Date(Date.now() - 120000);
    fs.utimesSync(arq, passado, passado);
    fs.writeFileSync(path.join(origem, '~$aberto.xlsx'), 'temp');
    const atividades = [];
    const painel = { atividade: (t, x) => atividades.push(x), erro: (t, x) => atividades.push('ERRO ' + x), estado: () => {}, fazendo: () => {}, modulo: () => {} };
    const base = { origem, controle, controleAntigo: path.join(sb, 'sem-rotina'), cadastro: R.montarCadastro([], []), painel, umaVez: true, log: process.env.DEPURAR ? console.log : () => {} };
    const v = C.iniciar(base);
    await v.ciclo();          // 1ª varredura: só anota
    await v.ciclo();          // 2ª: estável (estavelMs 0) → decide
    v.parar();
    const diario = fs.readdirSync(path.join(controle, 'continuo')).filter(f => /^decisoes-/.test(f));
    const linhas = fs.readFileSync(path.join(controle, 'continuo', diario[0]), 'utf8').trim().split('\n').map(JSON.parse);
    igual('ciclo: decidiu só a nota (o temporário do Office ficou de fora)', linhas.map(l => [l.rel, l.modo]), [['nota.xml', 'SIMULACAO']]);
    igual('ciclo: simulação não moveu nada', fs.existsSync(arq), true);
    // o acompanhamento do site do admin (arquivador-acompanhamento.js) viu a varredura e a decisão
    const acomp = JSON.parse(fs.readFileSync(path.join(controle, 'continuo', 'acompanhamento.json'), 'utf8'));
    const nota = acomp.ultimos.concat(acomp.pendentes).find(x => x.nome === 'nota.xml');
    igual('acompanhamento: o config, a nota decidida e a passada', [acomp.config.modo, !!nota, acomp.passada && acomp.passada.feitos], ['simulacao', true, 1]);
    igual('acompanhamento: o histórico do dia no PC', fs.readdirSync(path.join(controle, 'continuo')).some(f => /^arquivados-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)), true);
    igual('ciclo: já decidido não volta no próximo ciclo', await (async () => { const v2 = C.iniciar(base); await v2.ciclo(); await v2.ciclo(); v2.parar(); return fs.readFileSync(path.join(controle, 'continuo', diario[0]), 'utf8').trim().split('\n').length; })(), 1);

    // produção com erro (o Google Drive falhou o rename): o arquivo volta no próximo ciclo, até 3 vezes, e fica na origem
    const origemP = path.join(sb, 'origem-p'), controleP = path.join(sb, 'controle-p');
    fs.mkdirSync(controleP, { recursive: true });
    fs.writeFileSync(path.join(controleP, 'config.json'), JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0 }));
    const dia = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-NOVO';
    fs.mkdirSync(path.join(origemP, 'NÃO IDENTIFICADOS'), { recursive: true });
    fs.writeFileSync(path.join(origemP, 'NÃO IDENTIFICADOS', dia), 'um arquivo no lugar da pasta do dia: o mkdir falha');
    const arqP = path.join(origemP, 'nota.xml');
    fs.writeFileSync(arqP, xml); fs.utimesSync(arqP, passado, passado);
    const vp = C.iniciar(Object.assign({}, base, { origem: origemP, controle: controleP }));
    const resumos = [];
    for (let i = 0; i < 6; i++) resumos.push(await vp.ciclo());
    vp.parar();
    const diarioP = fs.readdirSync(path.join(controleP, 'continuo')).filter(f => /^decisoes-/.test(f));
    const linhasP = fs.readFileSync(path.join(controleP, 'continuo', diarioP[0]), 'utf8').trim().split('\n').map(JSON.parse);
    igual('produção com erro: tentou 3 vezes e parou', [linhasP.length, linhasP.every(l => l.acao === 'NAO_IDENTIFICADO' && l.erro && l.modo === 'SIMULACAO')], [3, true]);
    igual('produção com erro: o original ficou na origem', fs.existsSync(arqP), true);

    // 23/10/2026: o config muda no meio da passada (produção → desligado): o lote seguinte já não sai
    {
      const oM = path.join(sb, 'origem-m'), kM = path.join(sb, 'controle-m');
      fs.mkdirSync(oM, { recursive: true }); fs.mkdirSync(kM, { recursive: true });
      const cfgM = path.join(kM, 'config.json');
      fs.writeFileSync(cfgM, JSON.stringify({ modo: 'simulacao', estavelMs: 0, lote: 1 }));
      const velho = new Date(Date.now() - 3600e3);
      for (let i = 0; i < 5; i++) { const f = path.join(oM, 'a' + i + '.txt'); fs.writeFileSync(f, 'x' + i); fs.utimesSync(f, velho, velho); }
      const logs = [];
      let lotes = 0;
      const painelM = { atividade: () => {}, erro: () => {}, estado: () => {}, modulo: () => {}, fazendo: (id, t) => { if (id === 'arquivador-novo' && /^Simulando/.test(t || '')) { if (++lotes === 2) fs.writeFileSync(cfgM, JSON.stringify({ modo: 'desligado' })); } } };
      const vm = C.iniciar(Object.assign({}, base, { origem: oM, controle: kM, painel: painelM, log: (...m) => logs.push(m.join(' ')) }));
      const rM = await vm.ciclo();
      const rM2 = await vm.ciclo();
      vm.parar();
      igual('config: mudou no meio da passada → para no lote seguinte (2 de 5 decididos)', [rM.decididos, rM.esperando], [2, 'o config mudou']);
      igual('config: o modo e a hora da leitura no log', [logs.some(l => /^modo: simulacao, lido às \d{2}:\d{2}$/.test(l)), logs.some(l => /o config mudou no meio da passada \(simulacao → desligado\)/.test(l)), logs.some(l => /^modo: desligado, lido às/.test(l))], [true, true, true]);
      igual('config: na próxima volta o desligado vale', rM2.esperando, 'o arquivador novo está desligado no config');
      fs.writeFileSync(cfgM, JSON.stringify({ modo: 'producao', tiposProducao: 'todos' }));
      igual('config: o arquivo lido inteiro sempre vale (sem o "último bom")', C.lerConfig(cfgM, null).modo, 'producao');
      fs.writeFileSync(cfgM, '{ "modo": "desl');   // gravado pela metade
      igual('config: o arquivo pela metade fica com o último lido inteiro', C.lerConfig(cfgM, null).modo, 'producao');
    }
  } finally { fs.rmSync(sb, { recursive: true, force: true }); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU com erro:', e.stack); process.exit(1); });
