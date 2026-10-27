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
  igual('origem do modo: sem arquivo e sem banco = "padrão" com o caminho', /^padrão: sem config\.json em .*config\.json e sem config no banco$/.test(C.lerConfig(cfgArq, null).origem), true);
  igual('origem do modo: sem arquivo, com banco = "banco"', /^banco \(robo\/arquivadorNovo\.config\)/.test(C.lerConfig(cfgArq, { modo: 'producao' }).origem), true);
  fs.writeFileSync(cfgArq, JSON.stringify({ modo: 'desligado' }));
  igual('o arquivo manda sobre o banco', C.lerConfig(cfgArq, { modo: 'producao' }).modo, 'desligado');
  igual('origem do modo: o config.json com o caminho e a hora de gravação', /^config\.json \(.*config\.json, gravado em \d{2}\/\d{2} \d{2}:\d{2}\)$/.test(C.lerConfig(cfgArq, { modo: 'producao' }).origem), true);
  igual('a origem não entra no JSON do config', 'origem' in JSON.parse(JSON.stringify(C.lerConfig(cfgArq, null))), false);
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
      igual('config: o modo e a hora da leitura no log', [logs.some(l => /^modo: simulacao, lido às \d{2}:\d{2} de config\.json \(.*, gravado em \d{2}\/\d{2} \d{2}:\d{2}\)$/.test(l)), logs.some(l => /o config mudou no meio da passada \(simulacao → desligado\)/.test(l)), logs.some(l => /^modo: desligado, lido às/.test(l))], [true, true, true]);
      igual('config: na próxima volta o desligado vale', rM2.esperando, 'o arquivador novo está desligado no config');
      fs.writeFileSync(cfgM, JSON.stringify({ modo: 'producao', tiposProducao: 'todos' }));
      igual('config: o arquivo lido inteiro sempre vale (sem o "último bom")', C.lerConfig(cfgM, null).modo, 'producao');
      fs.writeFileSync(cfgM, '{ "modo": "desl');   // gravado pela metade
      igual('config: o arquivo pela metade fica com o último lido inteiro', C.lerConfig(cfgM, null).modo, 'producao');
    }
    // 26/10/2026: simulação → produção no meio da passada inteira, com o fs.watch ligado (sem o umaVez): a volta seguinte
    // é inteira (antes, por 15 min, só o que mudou entrava e a pilha antiga não andava) e o decidido em simulação volta
    {
      const oW = path.join(sb, 'origem-w'), kW = path.join(sb, 'controle-w');
      fs.mkdirSync(oW, { recursive: true }); fs.mkdirSync(kW, { recursive: true });
      const cfgW = path.join(kW, 'config.json');
      fs.writeFileSync(cfgW, JSON.stringify({ modo: 'simulacao', estavelMs: 0, lote: 1 }));
      const velho = new Date(Date.now() - 3600e3);
      for (let i = 0; i < 5; i++) { const f = path.join(oW, 'b' + i + '.txt'); fs.writeFileSync(f, 'y' + i); fs.utimesSync(f, velho, velho); }
      let lotes = 0;
      const painelW = { atividade: () => {}, erro: () => {}, estado: () => {}, modulo: () => {}, fazendo: (id, t) => { if (id === 'arquivador-novo' && /^Simulando/.test(t || '') && ++lotes === 2) fs.writeFileSync(cfgW, JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0, lote: 1 })); } };
      const vw = C.iniciar(Object.assign({}, base, { origem: oW, controle: kW, painel: painelW, umaVez: false }));
      const r1 = await vw.ciclo();
      const r2 = await vw.ciclo();
      vw.parar();
      const sobrou = fs.readdirSync(oW).filter(f => /^b\d\.txt$/.test(f));
      igual('troca de modo no meio: a volta seguinte é inteira e move os 5 em produção', [r1.esperando, r2.decididos, sobrou.length], ['o config mudou', 5, 0]);
      const dW = fs.readdirSync(path.join(kW, 'continuo')).find(f => /^decisoes-/.test(f));
      const lW = fs.readFileSync(path.join(kW, 'continuo', dW), 'utf8').trim().split('\n').map(JSON.parse).filter(l => l.modo === 'PRODUCAO');
      igual('o não identificado movido sai no diário como PRODUCAO, com o lugar', [lW.length, lW.every(l => l.acao === 'NAO_IDENTIFICADO' && /NÃO IDENTIFICADOS/.test(l.onde || ''))], [5, true]);
    }
    // 26/10/2026: o escaneado (PDF sem texto) sai do lote comum e é lido no lote do OCR, no fim da passada
    {
      const oO = path.join(sb, 'origem-o'), kO = path.join(sb, 'controle-o');
      fs.mkdirSync(oO, { recursive: true }); fs.mkdirSync(kO, { recursive: true });
      fs.writeFileSync(path.join(kO, 'config.json'), JSON.stringify({ modo: 'simulacao', estavelMs: 0 }));
      const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'];
      let pdf = '%PDF-1.4\n'; const offs = [];
      objs.forEach((x, i) => { offs.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + x + '\nendobj\n'; });
      const xref = pdf.length;
      pdf += 'xref\n0 4\n0000000000 65535 f \n' + offs.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
      const velho = new Date(Date.now() - 3600e3);
      fs.writeFileSync(path.join(oO, 'escaneado.pdf'), pdf); fs.utimesSync(path.join(oO, 'escaneado.pdf'), velho, velho);
      fs.writeFileSync(path.join(oO, 'nota.xml'), xml); fs.utimesSync(path.join(oO, 'nota.xml'), velho, velho);
      const logs = [];
      const vo = C.iniciar(Object.assign({}, base, { origem: oO, controle: kO, log: (...m) => logs.push(m.join(' ')) }));
      const rO = await vo.ciclo();
      vo.parar();
      await require('./arquivador-ocr').encerrar();
      igual('OCR: o lote comum manda o escaneado para a fila; o lote do OCR decide', [logs.some(l => /^lote de 2 \(1 escaneado\(s\) para a fila do OCR\)/.test(l)), logs.some(l => /^lote do OCR de 1 /.test(l)), rO.decididos], [true, true, 2]);
      const dO = fs.readdirSync(path.join(kO, 'continuo')).find(f => /^decisoes-/.test(f));
      igual('OCR: o diário tem os dois, sem o AGUARDANDO_OCR', fs.readFileSync(path.join(kO, 'continuo', dO), 'utf8').trim().split('\n').map(l => JSON.parse(l).acao).filter(x => x === 'AGUARDANDO_OCR').length, 0);
    }
    // 26/10/2026: a contagem da pasta (o painel com o total de verdade, não só o que a passada já leu)
    {
      const oC = path.join(sb, 'origem-c'), kC = path.join(sb, 'controle-c');
      fs.mkdirSync(path.join(oC, 'IMPORTAÇÃO', 'A'), { recursive: true }); fs.mkdirSync(path.join(oC, 'NÃO IDENTIFICADOS'), { recursive: true }); fs.mkdirSync(kC, { recursive: true });
      fs.writeFileSync(path.join(kC, 'config.json'), JSON.stringify({ modo: 'producao', tiposProducao: 'todos', moverNaoIdentificados: true, estavelMs: 0 }));
      const velho = new Date(Date.now() - 3600e3);
      for (let i = 0; i < 3; i++) { const f = path.join(oC, 'IMPORTAÇÃO', 'A', 'c' + i + '.txt'); fs.writeFileSync(f, 'z' + i); fs.utimesSync(f, velho, velho); }
      fs.writeFileSync(path.join(oC, 'NÃO IDENTIFICADOS', 'fora.txt'), 'x');
      fs.writeFileSync(path.join(oC, '~$aberto.xlsx'), 'x');
      const vc = C.iniciar(Object.assign({}, base, { origem: oC, controle: kC }));
      await vc._contarPasta();
      const antes = vc._contados();
      await vc.ciclo();
      const depois = vc._contados();
      vc.parar();
      igual('contagem: só o que o robô arquiva (sem NÃO IDENTIFICADOS e temporários) e desconta o que saiu', [antes, depois], [3, 0]);
    }
  } finally { fs.rmSync(sb, { recursive: true, force: true }); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU com erro:', e.stack); process.exit(1); });
