// Mede o arquivador novo contra a HISTÓRIA da rotina antiga (só leitura).
//
// Para cada linha do manifesto da rotina (_CONTROLE\MANIFESTO\manifesto.jsonl), pega o arquivo que ela gravou no
// destino (se ainda existe), roda as regras novas com o nome ORIGINAL e compara: mesmo cliente? mesmo tipo? mesma pasta?
// mesmo nome? Ignora a carga inicial (BACKFILL: pastas que já existiam, não foram decisão da rotina).
//
// Uso: node arquivador-medir.js [--por-tipo 400] [--saida <pasta>]
//   --por-tipo N   no máximo N casos de cada tipo (os XML são milhares e iguais entre si)
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');

const ROTINA = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const MANIFESTO = path.join(ROTINA, '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');

const semN = n => String(n || '').replace(/ \(\d+\)(\.[^.]+)$/, '$1');
const igualTxt = (a, b) => R.chaveNome(a) === R.chaveNome(b);

async function medir(opcoes) {
  const cadastro = A.carregarCadastro({});
  // contas aprendidas (contas.json); cada arquivo é decidido SEM a própria contribuição (clientePelaConta exclui o hash)
  const ctx = { cadastro, hoje: new Date(), contas: opcoes.semContas ? null : A.lerContas() };
  const casos = [];
  const vistos = new Set();
  const porTipo = {};
  for (const l of fs.readFileSync(MANIFESTO, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { try { r = JSON.parse(l.replace(/\\/g, '/')); } catch (e2) { continue; } }
    if (/^BACKFILL/.test(r.id_execucao || '')) continue;
    const full = A.caminhoArquivado(r.destino_final, r.nome_final);
    if (vistos.has(full.toLowerCase())) continue;
    vistos.add(full.toLowerCase());
    const esp = R.tipoDoDestino(path.dirname(full));
    porTipo[esp.tipo] = (porTipo[esp.tipo] || 0) + 1;
    if (opcoes.porTipo && porTipo[esp.tipo] > opcoes.porTipo) continue;
    casos.push({ r, full, esp });
  }
  const res = [];
  let i = 0;
  for (const c of casos) {
    if (++i % 200 === 0) console.log(i + '/' + casos.length);
    let buffer;
    try { buffer = fs.readFileSync(c.full); } catch (e) { res.push({ tipo: c.esp.tipo, existe: false, full: c.full }); continue; }
    const nomeOrig = String(c.r.nome_original || path.basename(c.full));
    const fragmento = /__p\d+-\d+/.test(nomeOrig + c.full) || (c.r.hash_original && c.r.hash_origem && c.r.hash_original !== c.r.hash_origem && /\.pdf$/i.test(c.full));
    // o arquivo gravado tem a extensão do destino; o nome original às vezes é o do contêiner (.zip/.rar)
    const nomeParaRegra = /\.(zip|rar|7z)$/i.test(nomeOrig) ? path.basename(c.full) : nomeOrig;
    const entrada = await A.montarEntrada(nomeParaRegra, nomeParaRegra, buffer);
    const d = R.decidir(entrada, ctx);
    const obt = d.destinoRelativo ? R.tipoDoDestino(R.RAIZ_CLIENTES + '\\' + d.destinoRelativo) : { codigo: d.cliente || null, tipo: d.tipo || null, resto: '' };
    const restoEsp = c.esp.resto, restoObt = d.destinoRelativo ? d.destinoRelativo.split('\\').slice(1).join('/') : '';
    res.push({
      tipo: c.esp.tipo, existe: true, fragmento, nome: nomeOrig, full: c.full, execucao: c.r.id_execucao,
      acao: d.acao, motivo: d.motivo || null, confianca: d.confianca,
      clienteEsp: c.esp.codigo, clienteObt: d.cliente || null, tipoObt: obt.tipo,
      mesmoCliente: d.cliente === c.esp.codigo, mesmoTipo: obt.tipo === c.esp.tipo,
      mesmaPasta: d.acao === 'ARQUIVAR' && d.cliente === c.esp.codigo && igualTxt(restoEsp, restoObt),
      mesmoNome: d.acao === 'ARQUIVAR' && igualTxt(semN(path.basename(c.full)), d.nomeFinal),
      destinoObt: d.destinoRelativo ? d.destinoRelativo + '\\' + d.nomeFinal : (d.destinoSugerido || null),
      evidencias: (d.evidencias || []).slice(0, 4),
    });
  }
  return { res, porTipo };
}

function resumir(res) {
  const t = {};
  for (const x of res) {
    const k = x.tipo;
    const s = t[k] || (t[k] = { casos: 0, semArquivo: 0, avaliados: 0, arquivou: 0, ni: 0, outro: 0, mesmoCliente: 0, mesmoTipo: 0, mesmaPasta: 0, pastaENome: 0, erradoArquivado: 0, fragmentos: 0 });
    s.casos++;
    if (!x.existe) { s.semArquivo++; continue; }
    s.avaliados++;
    if (x.fragmento) s.fragmentos++;
    if (x.acao === 'ARQUIVAR') {
      s.arquivou++;
      if (x.mesmoCliente) s.mesmoCliente++;
      if (x.mesmoTipo) s.mesmoTipo++;
      if (x.mesmaPasta) s.mesmaPasta++;
      if (x.mesmaPasta && x.mesmoNome) s.pastaENome++;
      if (!x.mesmaPasta) s.erradoArquivado++;
    } else if (x.acao === 'NAO_IDENTIFICADO') s.ni++; else s.outro++;
  }
  return t;
}

/**
 * Os modelos da pasta EXEMPLOS DE ARQUIVOS da rotina (<BANCO>\MODELO <TIPO> <BANCO>.pdf): o gabarito é o nome da pasta
 * (banco) e a palavra do nome do arquivo (tipo). Mede pelo CONTEÚDO (o arquivo entra com nome neutro, "documento.pdf")
 * e também com o nome verdadeiro (como chegaria na origem).
 */
async function medirExemplos(pasta) {
  const fsP = require('path');
  const out = [];
  const cadastro = A.carregarCadastro({});
  for (const banco of fs.readdirSync(pasta)) {
    const dir = fsP.join(pasta, banco);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      const u = R.norm(f);
      const tipoEsp = /MAQUININHA/.test(u) ? 'MAQUININHAS' : /APLICAC/.test(u) ? 'APLICACOES' : /COMPROVANTE/.test(u) ? 'COMPROVANTE' : /EMPRESTIMO/.test(u) ? 'OPERACAO DE CREDITO' : /RECEBIMENTO/.test(u) ? 'RECEBIMENTO DE CLIENTES' : /EXTRATO|EXRATO/.test(u) ? 'EXTRATO' : '?';
      const bancoEsp = R.chaveNome(banco) === 'ITAU' ? 'ITAU' : banco;
      const e = await A.montarEntrada(f, f, fs.readFileSync(fsP.join(dir, f)));
      const conteudo = R.perfilDoDocumento(e, false);
      const comNome = R.perfilDoDocumento(e, true);
      const d = R.decidir(e, { cadastro, hoje: new Date() });
      out.push({ arquivo: banco + '\\' + f, tipoEsp, bancoEsp, conteudo, comNome, decisao: { acao: d.acao, motivo: d.motivo || null, cliente: d.cliente || null, clienteNome: d.clienteNome || null, destino: d.destinoRelativo ? d.destinoRelativo + '\\' + d.nomeFinal : d.destinoSugerido || null, confianca: d.confianca } });
    }
  }
  return out;
}

module.exports = { medir, resumir, medirExemplos };

if (require.main === module) {
  const a = process.argv.slice(2);
  const v = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
  const saida = v('--saida') || path.join(A.CONTROLE, 'MEDICAO');
  if (v('--exemplos')) {
    medirExemplos(v('--exemplos')).then(res => {
      fs.mkdirSync(saida, { recursive: true });
      fs.writeFileSync(path.join(saida, 'exemplos.json'), JSON.stringify(res, null, 1));
      for (const x of res) console.log([x.arquivo, 'esperado ' + x.tipoEsp + '/' + x.bancoEsp, 'conteúdo ' + (x.conteudo.tipo || x.conteudo.motivo) + '/' + (x.conteudo.banco || '-') + '/' + (x.conteudo.competencia || '-'), 'c/ nome ' + (x.comNome.tipo || '-') + '/' + (x.comNome.banco || '-'), x.decisao.acao + ' ' + (x.decisao.motivo || '') + ' ' + (x.decisao.destino || '')].join(' | '));
    }).catch(e => { console.error(e); process.exit(1); });
    return;
  }
  medir({ porTipo: v('--por-tipo') ? +v('--por-tipo') : 0 }).then(({ res, porTipo }) => {
    fs.mkdirSync(saida, { recursive: true });
    fs.writeFileSync(path.join(saida, 'casos.jsonl'), res.map(x => JSON.stringify(x)).join('\n') + '\n');
    const s = resumir(res);
    fs.writeFileSync(path.join(saida, 'resumo.json'), JSON.stringify({ porTipoNoManifesto: porTipo, resumo: s }, null, 1));
    console.log('tipo | casos | avaliados | arquivou | NI | mesma pasta | pasta+nome | arquivado em outro lugar');
    for (const [k, x] of Object.entries(s).sort((p, q) => q[1].casos - p[1].casos)) console.log([k, x.casos, x.avaliados, x.arquivou, x.ni, x.mesmaPasta, x.pastaENome, x.erradoArquivado].join(' | '));
    console.log('saída:', saida);
  }).catch(e => { console.error(e); process.exit(1); });
}
