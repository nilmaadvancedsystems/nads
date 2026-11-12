// O FISCAL POR MÊS nos já arquivados (11/11/2026: "tem que mudar o arquivador e ensinar ele que o fiscal também é por mês"; a
// escolha: o mês logo no começo, nos documentos fiscais e no XML; "Mover os de 2026 também").
//
// Desde 11/11/2026 as regras (arquivador-regras.js, comPastaDoMes) arquivam:
//   FISCAL\<regime>\<nº>. DOCUMENTOS FISCAIS\<MM>\EMITIDOS|RECEBIDOS\…
//   FISCAL\<regime>\<nº>. XML\<tipo>\<MM>           e  <tipo>\EVENTOS\<MM>, <tipo>\INUTILIZAÇÕES\<MM>
// Este programa acha os que foram arquivados antes, sem a pasta do mês, e monta o PLANO para movê-los, no formato do plano da
// auditoria, para o MESMO executor (arquivador-correcao.js, etapa "pasta": só rename dentro do G:, nunca sobrescreve, o mesmo
// conteúdo no destino vai para a quarentena, o nome repetido ganha " (N)", confere cada lote, manifesto e diário com o
// --desfazer). Como o arquivador-separar-recebidos.js.
//
// SÓ LEITURA: lista as pastas de G:\Meu Drive\<ano> (nome e tamanho), não abre nenhum arquivo (abrir no G: é baixar). O mês vem
// do NOME que as regras dão:
//   o XML da nota "MM-AAAA_<tipo>_<nº>.xml"; o evento, a inutilização, a cancelada e o PDF "DD-MM-AAAA - …"; o relatório
//   mensal "MM-AAAA - …".
// O ano do nome tem de ser o da raiz (G:\Meu Drive\<ano>): o de outro ano fica onde está (é outro assunto: a raiz errada).
// O ano e o mês que a NFC-e (EMITIDOS\NFC-e\<AAAA>\<MM>) e o relatório mensal (RELATÓRIO MENSAL\<AAAA>) já tinham no fim
// saem do caminho, como nas regras. O que não tem o mês no nome (o nome original guardado) fica e sai na lista "ficam".
//
// Uso (no NILMA-SERVER, onde está o G:):
//   node arquivador-fiscal-por-mes.js [--drive "G:\Meu Drive"] [--anos 2026] [--saida <pasta>]
//     grava <saida>\plano-fiscal-por-mes.jsonl, ficam.csv e resumo.json (padrão: <controle>\fiscal-por-mes\<data-hora>)
//   node arquivador-correcao.js --plano <saida>\plano-fiscal-por-mes.jsonl --etapas pasta                     (simulação)
//   node arquivador-correcao.js --plano <saida>\plano-fiscal-por-mes.jsonl --etapas pasta --producao --confirmo
//     (a produção pede o arquivador contínuo em "desligado" e a rotina antiga parada, como toda correção)
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const W = path.win32;
const N = s => R.norm(s).trim();
const dois = n => String(n).padStart(2, '0');
const PASTA_MES = /^\d{2}$/;
const PASTA_ANO = /^\d{4}$/;

/** O mês (MM) e o ano (AAAA) pelo nome do arquivo, ou null: "MM-AAAA_…" (o XML), "DD-MM-AAAA - …", "MM-AAAA - …". */
function mesDoNome(nome) {
  const s = String(nome || '');
  let m = /^(\d{2})-(\d{2})-(\d{4}) - /.exec(s);
  if (m) return +m[2] >= 1 && +m[2] <= 12 ? { mes: m[2], ano: +m[3] } : null;
  m = /^(\d{2})-(\d{4})(?:_| - )/.exec(s);
  if (m) return +m[1] >= 1 && +m[1] <= 12 ? { mes: m[1], ano: +m[2] } : null;
  return null;
}

/**
 * O lugar novo de um arquivo do fiscal: { para (o caminho relativo ao regime) } ou { fica: o motivo } ou null (não é com ele:
 * já está na pasta do mês, ou fora das duas pastas). rel: as pastas entre o regime e o arquivo, [<nº>. DOCUMENTOS FISCAIS|<nº>. XML, …].
 */
function lugarNovo(rel, nome, ano) {
  const raiz = rel[0];
  const resto = rel.slice(1);
  const docs = /DOCUMENTOS FISCAIS$/.test(N(raiz));
  const xml = /^\d+\.\s*XML$/i.test(String(raiz).trim());
  if (!docs && !xml) return null;
  if (docs && PASTA_MES.test(resto[0] || '')) return null;                                  // já em DOCUMENTOS FISCAIS\<MM>
  if (xml) {
    if (!resto.length) return { fica: 'XML solto na pasta XML (sem a pasta do tipo)' };
    const sub = N(resto[1] || '');
    if (PASTA_MES.test(resto[1] || '') || ((sub === 'EVENTOS' || sub === 'INUTILIZACOES') && PASTA_MES.test(resto[2] || ''))) return null;   // já no mês
    if (resto.length > 2 || (resto.length === 2 && sub !== 'EVENTOS' && sub !== 'INUTILIZACOES')) return { fica: 'subpasta fora do padrão da pasta XML' };
  }
  const q = mesDoNome(nome);
  if (!q) return { fica: 'sem o mês no nome' };
  if (q.ano !== ano) return { fica: 'o ano do nome (' + q.ano + ') não é o da raiz (' + ano + ')' };
  if (xml) return { para: [raiz].concat(resto, q.mes) };
  // DOCUMENTOS FISCAIS: o mês logo no começo; o <AAAA> (e o <MM> depois dele) que já estavam no caminho saem
  const limpo = [];
  for (let i = 0; i < resto.length; i++) {
    if (PASTA_ANO.test(resto[i]) && +resto[i] === ano) { if (PASTA_MES.test(resto[i + 1] || '')) i++; continue; }
    limpo.push(resto[i]);
  }
  return { para: [raiz, q.mes].concat(limpo) };
}

/** A pasta (rel, a partir da pasta dos documentos ou do XML) já é uma pasta do mês: DOCUMENTOS FISCAIS\<MM>, XML\<tipo>\<MM>, XML\<tipo>\EVENTOS|INUTILIZAÇÕES\<MM>. */
function jaNoMes(rel) {
  if (/DOCUMENTOS FISCAIS$/.test(N(rel[0]))) return PASTA_MES.test(rel[1] || '');
  const sub = N(rel[2] || '');
  return PASTA_MES.test(rel[2] || '') || ((sub === 'EVENTOS' || sub === 'INUTILIZACOES') && PASTA_MES.test(rel[3] || ''));
}

/**
 * O plano de um conjunto de raízes. ler(pasta) → [{ nome, pasta (bool), tamanho }] ou null (não existe/sem acesso).
 * raizes: [{ ano, raiz }]. Devolve { plano (passos no formato do plano da auditoria), ficam: [{ p, nome, porque }], regimes (vistos) }.
 */
function planejar(ler, raizes) {
  const plano = [], ficam = [];
  let regimes = 0;
  const dirs = p => (ler(p) || []).filter(x => x.pasta);
  for (const { ano, raiz } of raizes) {
    for (const cli of dirs(raiz)) {
      if (!/^\d+ - /.test(cli.nome)) continue;
      const pCli = W.join(raiz, cli.nome);
      for (const fis of dirs(pCli).filter(x => N(x.nome) === 'FISCAL')) {
        for (const reg of dirs(W.join(pCli, fis.nome))) {
          const pReg = W.join(pCli, fis.nome, reg.nome);
          regimes++;
          for (const topo of dirs(pReg).filter(x => /DOCUMENTOS FISCAIS$/.test(N(x.nome)) || /^\d+\.\s*XML$/i.test(x.nome.trim()))) {
            // desce a árvore (sem entrar nas pastas do mês, que já estão no lugar)
            const andar = rel => {
              const p = W.join(pReg, ...rel);
              for (const it of ler(p) || []) {
                const aqui = rel.concat(it.nome);
                if (it.pasta) { if (!jaNoMes(aqui)) andar(aqui); continue; }
                const l = lugarNovo(rel, it.nome, ano);
                if (!l) continue;
                const de = W.join(p, it.nome);
                if (l.fica) { ficam.push({ p: de, nome: it.nome, porque: l.fica }); continue; }
                plano.push({
                  ordem: 3, etapa: 'pasta', gravidade: 'ERRADO-PASTA', acao: 'MOVER', de, para: W.join(pReg, ...l.para, it.nome), igualA: null,
                  confianca: 0.95, automatico: true,
                  porque: 'fiscal por mês (11/11/2026): ' + rel.join('\\') + ' → ' + l.para.join('\\'),
                  evidencia: 'o mês pelo nome do arquivo', tamanho: it.tamanho == null ? null : it.tamanho, hash: null,
                  ano, cliente: cli.nome, outros: [],
                });
              }
            };
            andar([topo.nome]);
          }
        }
      }
    }
  }
  return { plano, ficam, regimes };
}

/** ler() do disco: só metadados (readdir e stat); o tamanho só dos arquivos (o executor confere com ele). */
function lerDoDisco(p) {
  let itens;
  try { itens = fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return null; }
  return itens.map(it => {
    const pasta = it.isDirectory();
    let tamanho = null;
    if (!pasta) { try { tamanho = fs.statSync(W.join(p, it.name)).size; } catch (e) { /* sumiu no meio */ } }
    return { nome: it.name, pasta, tamanho };
  });
}

function resumir(r) {
  const porPasta = {}, porAno = {}, porQue = {};
  for (const p of r.plano) {
    const k = /DOCUMENTOS FISCAIS/i.test(p.para) ? 'DOCUMENTOS FISCAIS' : 'XML';
    porPasta[k] = (porPasta[k] || 0) + 1;
    porAno[p.ano] = (porAno[p.ano] || 0) + 1;
  }
  for (const f of r.ficam) porQue[f.porque] = (porQue[f.porque] || 0) + 1;
  return { regimes: r.regimes, mover: r.plano.length, porPasta, porAno, clientes: new Set(r.plano.map(p => p.ano + '\\' + p.cliente)).size, ficam: r.ficam.length, ficamPorQue: porQue };
}

// ---------- sozinho, na madrugada (11/11/2026: "muito trabalho"; a escolha: "o robô faz sozinho") ----------
// O arquivador do NILMA-SERVER chama tique() de 10 em 10 min. Entre 1h e 5h, uma vez só por ano de raiz: monta o plano, grava em
// <controle>\fiscal-por-mes\<data-hora> e roda o executor de sempre em PRODUÇÃO num processo à parte (o mesmo arquivador-correcao.js
// do terminal, com --pelo-arquivador: quem chama segura o contínuo e o botão "Arquivar agora" com o ocupado, no lugar de exigir o
// contínuo desligado). Terminou bem: grava feito-<ano>.json e avisa na Central dos robôs. Deu erro: avisa e tenta na madrugada
// seguinte (o executor para no primeiro erro de um lote, e o que já foi movido sai do plano da próxima vez).
/**
 * o: { log, painel, ocupado(): bool, ocupar(), desocupar(), controle, drive, anos: [2026], agora(): Date, ler (o lerDoDisco),
 * rodarExecutor(arqPlano) → Promise<{ ok, saida?, erro? }>, travaDaRotinaAntiga (o _execucao.lock) }. Devolve { tique() }.
 */
function criarMudancaDaMadrugada(o) {
  const log = o.log || (() => {});
  const agora = o.agora || (() => new Date());
  const anos = o.anos || [2026];
  const ler = o.ler || lerDoDisco;
  const dirBase = W.join(o.controle, 'fiscal-por-mes');
  const arqFeito = ano => W.join(dirBase, 'feito-' + ano + '.json');
  let rodando = false;
  const rotinaAntigaRodando = () => {
    if (!o.travaDaRotinaAntiga) return false;
    try { return Date.now() - fs.statSync(o.travaDaRotinaAntiga).mtimeMs < 4 * 36e5; } catch (e) { return false; }
  };
  async function tique() {
    const d = agora();
    if (rodando || d.getHours() < 1 || d.getHours() >= 5) return 'fora da hora';
    const ano = anos.find(a => !fs.existsSync(arqFeito(a)));
    if (ano == null) return 'nada a fazer';
    if (o.ocupado && o.ocupado()) return 'o arquivador está ocupado';
    if (rotinaAntigaRodando()) return 'a rotina antiga está rodando';
    const raiz = W.join(o.drive, String(ano));
    if (!fs.existsSync(raiz)) return 'sem a raiz ' + raiz;
    rodando = true;
    if (o.ocupar) o.ocupar();
    if (o.painel) o.painel.fazendo('fiscal-por-mes', 'Fiscal por mês: movendo os arquivos de ' + ano + ' para as pastas do mês');
    const carimbo = d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes());
    const saida = W.join(dirBase, carimbo);
    try {
      log('fiscal por mês: montando o plano de ' + raiz + ' (só as pastas, nada é aberto)');
      const r = planejar(ler, [{ ano, raiz }]);
      const res = resumir(r);
      fs.mkdirSync(saida, { recursive: true });
      const arqPlano = W.join(saida, 'plano-fiscal-por-mes.jsonl');
      fs.writeFileSync(arqPlano, r.plano.map(p => JSON.stringify(p)).join('\n') + (r.plano.length ? '\n' : ''));
      const csv = s => '"' + String(s).replace(/"/g, '""') + '"';
      fs.writeFileSync(W.join(saida, 'ficam.csv'), '﻿caminho;nome;por que\n' + r.ficam.map(f => [f.p, f.nome, f.porque].map(csv).join(';')).join('\n') + '\n');
      let exec = { ok: true, saida: null };
      if (r.plano.length) {
        log('fiscal por mês: movendo ' + r.plano.length + ' arquivo(s) de ' + res.clientes + ' cliente(s) (o executor, em produção)');
        exec = await o.rodarExecutor(arqPlano);
      }
      const feito = Object.assign({ em: new Date().toISOString(), ano, pasta: saida, executor: exec.saida || null }, res);
      fs.writeFileSync(W.join(saida, 'resumo.json'), JSON.stringify(Object.assign({ ok: exec.ok, erro: exec.erro || null }, feito), null, 1));
      if (!exec.ok) throw new Error(exec.erro || 'o executor parou');
      fs.writeFileSync(arqFeito(ano), JSON.stringify(feito, null, 1));
      const movidos = exec.saida && exec.saida.etapas && exec.saida.etapas.pasta ? exec.saida.etapas.pasta.porTipo || {} : {};
      const texto = r.plano.length + ' arquivo(s) de ' + res.clientes + ' cliente(s) para as pastas do mês' + (res.ficam ? '; ' + res.ficam + ' ficaram onde estavam (sem o mês no nome ou de outro ano: ficam.csv)' : '');
      log('fiscal por mês: pronto - ' + texto + ' ' + JSON.stringify(movidos) + ' (' + saida + ')');
      if (o.painel) o.painel.atividade('arquivamento', 'Fiscal de ' + ano + ' separado por mês', texto);
      return 'feito';
    } catch (err) {
      log('fiscal por mês: parou - ' + (err && err.message) + ' (tenta de novo na próxima madrugada; o diário do executor fica em ' + saida + ')');
      if (o.painel) o.painel.erro('arquivamento', 'A mudança do fiscal para as pastas do mês parou', String(err && err.message || err) + ': tenta de novo na próxima madrugada');
      return 'erro';
    } finally {
      rodando = false;
      if (o.painel) o.painel.fazendo('fiscal-por-mes', null);
      if (o.desocupar) o.desocupar();
    }
  }
  return { tique };
}

/** O executor de sempre em produção, num processo à parte (o arquivador segue respondendo); devolve { ok, saida, erro }. */
function rodarExecutorNumProcesso(arqPlano, log) {
  return new Promise(resolve => {
    const { spawn } = require('child_process');
    const p = spawn(process.execPath, [path.join(__dirname, 'arquivador-correcao.js'), '--plano', arqPlano, '--etapas', 'pasta', '--producao', '--confirmo', '--pelo-arquivador'], { cwd: __dirname, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', b => { out += b; });
    p.stderr.on('data', b => { err += b; if (log) for (const l of String(b).split(/\r?\n/).filter(Boolean)) log('fiscal por mês: ' + l); });
    p.on('error', e => resolve({ ok: false, erro: e.message }));
    p.on('close', code => {
      const i = out.lastIndexOf('\n{');
      let saida = null;
      try { saida = JSON.parse(i >= 0 ? out.slice(i + 1) : out); } catch (_) { /* sem o resumo */ }
      resolve(code === 0 ? { ok: true, saida } : { ok: false, saida, erro: (err.match(/PAREI: .*/) || [err.trim().split('\n').pop() || 'o executor saiu com o código ' + code])[0] });
    });
  });
}

module.exports = { planejar, lerDoDisco, resumir, lugarNovo, mesDoNome, criarMudancaDaMadrugada, rodarExecutorNumProcesso };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  try {
    const drive = valor('--drive') || W.dirname(R.RAIZ_CLIENTES);
    const anos = String(valor('--anos') || '2026');
    const [de, ate] = (anos.includes('-') ? anos.split('-') : [anos, anos]).map(Number);
    if (!(de >= 1990 && ate >= de)) throw new Error('--anos AAAA ou AAAA-AAAA');
    const raizes = [];
    for (let ano = de; ano <= ate; ano++) { const raiz = W.join(drive, String(ano)); if (fs.existsSync(raiz)) raizes.push({ ano, raiz }); }
    if (!raizes.length) throw new Error('nenhuma raiz de ano em ' + drive + ' (' + de + '-' + ate + ')');
    const d = new Date();
    const controle = process.env.ARQ_NOVO_CONTROLE || require('./pastas-locais').CONTROLE;
    const saida = valor('--saida') || W.join(controle, 'fiscal-por-mes', d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds()));
    console.log('lendo (só as pastas, nada é aberto): ' + raizes.map(x => x.raiz).join(', '));
    const r = planejar(lerDoDisco, raizes);
    fs.mkdirSync(saida, { recursive: true });
    const arqPlano = W.join(saida, 'plano-fiscal-por-mes.jsonl');
    fs.writeFileSync(arqPlano, r.plano.map(p => JSON.stringify(p)).join('\n') + (r.plano.length ? '\n' : ''));
    const csv = s => '"' + String(s).replace(/"/g, '""') + '"';
    fs.writeFileSync(W.join(saida, 'ficam.csv'), '\ufeffcaminho;nome;por que\n' + r.ficam.map(f => [f.p, f.nome, f.porque].map(csv).join(';')).join('\n') + '\n');
    const resumo = Object.assign({ em: d.toISOString(), raizes: raizes.map(x => x.raiz), plano: arqPlano }, resumir(r));
    fs.writeFileSync(W.join(saida, 'resumo.json'), JSON.stringify(resumo, null, 1));
    console.log(JSON.stringify(resumo, null, 1));
    console.log('\nnada foi mexido. Simulação do executor:\n  node arquivador-correcao.js --plano "' + arqPlano + '" --etapas pasta');
  } catch (e) { console.error('PAREI: ' + e.message); process.exitCode = 1; }
}
