// As guias do FGTS da regra antiga (<ano>\<cliente>\SOCIETÁRIO\IMPOSTOS\FGTS\…) para a nova (Vitor, 23/10/2026):
// <ano>\<cliente>\DEPARTAMENTO PESSOAL\<MM>\FGTS\FGTS MM-AAAA.pdf, como o robô do FGTS grava.
//
// Para cada guia: lê, decide pelas regras (o tipo FGTS e a competência pelo conteúdo; o cliente pelo conteúdo ou pela pasta
// do cliente onde ela está) e confere que a raiz do CNPJ da guia é a do cliente da pasta (a guia de outro cliente com o nome
// trocado fica e entra na lista). O mesmo conteúdo já no DP: a da regra antiga vai para a quarentena. Move por rename (o G:),
// sem sobrescrever, vários ao mesmo tempo, com a linha no manifesto.
//   node mover-fgts.js [--aplicar] [--juntos 6] [--saida <pasta>]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./arquivador-novo');
const R = require('./arquivador-regras');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const APLICAR = process.argv.includes('--aplicar');
const JUNTOS = +arg('--juntos', 6);
const CONTROLE = arg('--controle', A.CONTROLE);
const MEU_DRIVE = path.dirname(arg('--clientes', R.RAIZ_CLIENTES));
const SAIDA = arg('--saida', path.join(CONTROLE, 'mover-fgts'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const log = (...m) => console.log(new Date().toLocaleTimeString('pt-BR'), ...m);
const so = s => String(s || '').replace(/\D/g, '');

async function arquivosEm(d) {
  const out = [];
  let l = []; try { l = await fs.promises.readdir(d, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of l) { const c = path.join(d, e.name); if (e.isDirectory()) out.push(...await arquivosEm(c)); else if (e.name !== 'desktop.ini') out.push(c); }
  return out;
}
const pool = async (lista, n, f) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => { while (i < lista.length) { const k = i++; await f(lista[k], k); } })); };

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const cad = A.carregarCadastro({ controle: CONTROLE });
  const ctx = { cadastro: cad, hoje: new Date(), clientes: R.RAIZ_CLIENTES, contas: A.lerContas(CONTROLE), manifesto: new Map(), reservados: new Map(), existe: new Map(), hashes: new Map() };
  // as guias da regra antiga, em todas as raízes de ano
  const guias = [];
  for (const ano of fs.readdirSync(MEU_DRIVE).filter(n => /^(19|20)\d{2}$/.test(n))) {
    let clientes = []; try { clientes = fs.readdirSync(path.join(MEU_DRIVE, ano), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) { continue; }
    for (const c of clientes) for (const f of await arquivosEm(path.join(MEU_DRIVE, ano, c, 'SOCIETÁRIO', 'IMPOSTOS', 'FGTS'))) guias.push({ ano, pasta: c, atual: f });
  }
  log('guias na regra antiga: ' + guias.length);
  const out = [];
  for (const g of guias) {
    const x = Object.assign({}, g);
    out.push(x);
    const cod = +(/^(\d+)\s*-/.exec(g.pasta) || [])[1];
    const cli = cad.porCod.get(cod);
    let buf;
    try { buf = fs.readFileSync(g.atual); } catch (e) { x.situacao = 'ERRO'; x.motivo = e.message; continue; }
    x.hash = sha(buf);
    if (!/\.pdf$/i.test(g.atual)) { x.situacao = 'FICA'; x.motivo = 'não é PDF'; continue; }
    const rel = g.pasta + '\\' + path.basename(g.atual);
    const entrada = await A.montarEntrada(path.basename(g.atual), rel, buf);
    const d = R.decidir(entrada, ctx);
    const texto = (Array.isArray(entrada.texto) ? entrada.texto : [String(entrada.texto || '')]).join('\n');
    const raizNoTexto = so((/CPF\/CNPJ do Empregador\s*([\d./-]{8,18})/i.exec(texto) || [])[1]);
    x.tipo = d.tipo; x.clienteDaGuia = d.cliente || null; x.raizNoTexto = raizNoTexto;
    if (d.tipo !== 'FGTS') { x.situacao = 'FICA'; x.motivo = 'as regras não dizem FGTS (' + (d.tipo || d.motivo || d.acao) + ')'; continue; }
    if (!cli || (raizNoTexto && cli.doc && !cli.doc.startsWith(raizNoTexto.slice(0, 8)))) { x.situacao = 'FICA_OUTRO_CLIENTE'; x.motivo = 'o empregador da guia (' + raizNoTexto + ') não é o cliente da pasta (' + g.pasta + ')'; continue; }
    if (d.acao !== 'ARQUIVAR' || Number(d.cliente) !== cod) { x.situacao = 'FICA'; x.motivo = 'as regras: ' + (d.motivo || d.acao) + (d.cliente ? ' (cliente ' + d.cliente + ')' : ''); continue; }
    const raiz = path.join(MEU_DRIVE, String(d.anoRaiz || g.ano));
    const pastaDoAno = fs.existsSync(path.join(raiz, g.pasta)) ? g.pasta : d.pastaCliente;
    const dir = path.join(raiz, pastaDoAno, path.win32.relative(d.pastaCliente, d.destinoRelativo));
    // o mesmo conteúdo já no DP (o robô do FGTS grava "FGTS MM-AAAA <identificador>.pdf"): duplicado
    let igual = null;
    for (const f of await arquivosEm(dir)) { try { if (sha(fs.readFileSync(f)) === x.hash) { igual = f; break; } } catch (e) { /* segue */ } }
    if (igual) { x.situacao = 'DUPLICADO'; x.para = igual; continue; }
    const c = A.conferirDestino({ destinoRelativo: path.win32.relative(raiz, dir), nomeFinal: d.nomeFinal, raiz }, x.hash, ctx, false, null);
    x.situacao = 'MOVER'; x.para = c.onde.replace(/ \(neste lote\)$/, ''); x.competencia = d.competencia;
  }
  const conta = {}; for (const x of out) conta[x.situacao] = (conta[x.situacao] || 0) + 1;
  fs.writeFileSync(path.join(SAIDA, 'mover-fgts.jsonl'), out.map(x => JSON.stringify(x)).join('\n') + '\n');
  log('lista: ' + JSON.stringify(conta));
  if (!APLICAR) { try { await A.encerrarOcr(); } catch (e) { /* segue */ } process.exit(0); }
  const manifesto = path.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl');
  const quarentena = path.join(CONTROLE, 'QUARENTENA', 'fgts-regra-antiga-' + new Date().toISOString().slice(0, 10));
  const feitos = { movidos: 0, quarentena: 0, erros: 0 };
  const t0 = Date.now();
  await pool(out.filter(x => x.situacao === 'MOVER' || x.situacao === 'DUPLICADO'), JUNTOS, async (x) => {
    try {
      if (x.situacao === 'MOVER') {
        try { await fs.promises.access(x.para); throw new Error('o destino apareceu no meio: ' + x.para); } catch (e) { if (!/ENOENT/.test(e.code || '')) throw e; }
        await fs.promises.mkdir(path.dirname(x.para), { recursive: true });
        await fs.promises.rename(x.atual, x.para);
        fs.appendFileSync(manifesto, JSON.stringify({ hash_origem: x.hash, hash_original: x.hash, nome_original: path.basename(x.atual), destino_final: path.dirname(x.para), nome_final: path.basename(x.para), id_execucao: 'MOVER-FGTS-' + new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(), tipo: 'FGTS', cliente: +(/^(\d+)/.exec(x.pasta) || [])[1], movido: true, correcao: { de: x.atual, motivo: 'FGTS para DEPARTAMENTO PESSOAL\\<MM>\\FGTS (Vitor, 23/10/2026)' } }) + '\n');
        x.feito = 'movido'; feitos.movidos++;
      } else {
        const alvo = path.join(quarentena, path.relative(MEU_DRIVE, x.atual));
        await fs.promises.mkdir(path.dirname(alvo), { recursive: true });
        const buf = await fs.promises.readFile(x.atual);
        await fs.promises.writeFile(alvo, buf, { flag: 'wx' });
        if (sha(await fs.promises.readFile(alvo)) !== x.hash) throw new Error('a cópia para a quarentena não conferiu');
        await fs.promises.unlink(x.atual);
        fs.appendFileSync(manifesto, JSON.stringify({ hash_origem: x.hash, hash_original: x.hash, nome_original: path.basename(x.atual), destino_final: path.dirname(alvo), nome_final: path.basename(alvo), id_execucao: 'MOVER-FGTS-' + new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(), tipo: 'DESCARTE', cliente: null, descarte: true, correcao: { de: x.atual, motivo: 'o mesmo conteúdo já está em ' + x.para + ' (FGTS no DP)' } }) + '\n');
        x.feito = 'quarentena'; feitos.quarentena++;
      }
    } catch (e) { x.feito = 'erro: ' + e.message; feitos.erros++; }
  });
  const ms = Date.now() - t0;
  fs.writeFileSync(path.join(SAIDA, 'mover-fgts-aplicado.jsonl'), out.map(x => JSON.stringify(x)).join('\n') + '\n');
  log('aplicado: ' + JSON.stringify(feitos) + ' em ' + (ms / 1000).toFixed(1) + ' s (' + JUNTOS + ' juntos; ' + ((feitos.movidos + feitos.quarentena) ? (ms / (feitos.movidos + feitos.quarentena) / 1000).toFixed(2) : '-') + ' s por arquivo)');
  try { await A.encerrarOcr(); } catch (e) { /* segue */ }
  process.exit(feitos.erros ? 2 : 0);
})().catch(e => { console.log('erro:', e.stack); process.exit(1); });
