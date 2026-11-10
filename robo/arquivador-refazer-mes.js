// REFAZER O MÊS do que o arquivador já arquivou no mês errado (10/11/2026; "procure mais erros no robo, não quero mais erro
// desses acontecendo"). As regras foram corrigidas (arquivador-regras.js); isto acha o que ficou no lugar errado ANTES da
// correção e monta o PLANO para o MESMO executor (arquivador-correcao.js, etapa "pasta": só rename dentro do G:, nunca
// sobrescreve, o mesmo conteúdo no destino vai para a quarentena, o nome repetido ganha " (N)", confere cada lote, manifesto e
// diário com o --desfazer).
//
// Dois casos:
//   DAE de taxa do SIARE   (automático) a guia ia para o mês da VALIDADE ("Mês Ano de Referência 30 a 30/12/2026"): o nome
//                          "12-2026 - DAE TAXA - VALOR R$40,53 - VENCIMENTO 30-12-2026.pdf" tem o mesmo mês e ano do vencimento.
//                          Acha pela pasta "NN. DAE" de cada cliente (só a lista da pasta) e lê só essas guias (~50 KB cada):
//                          o mês certo é o do "Emitido em".
//   extratos               (--extratos <lista.txt>, um caminho por linha) o extrato que foi para o mês da data do nome
//                          ("Comprovante_09-11-2026_174648.pdf" da 444 em 2026\11): lê o PDF e o mês certo é o das datas dos
//                          lançamentos (R.periodoPelasDatas), como as regras de agora.
//
// SÓ LEITURA: nada é mexido aqui. O passo que trocaria o ANO da raiz (G:\Meu Drive\<ano>) fica para revisão (automatico: false):
// a pasta do cliente no outro ano pode ter outro nome.
//
// Uso (no NILMA-SERVER, onde está o G:):
//   node arquivador-refazer-mes.js [--drive "G:\Meu Drive"] [--anos 2015-2026] [--extratos <lista.txt>] [--extrato "<caminho>" …] [--saida <pasta>]
//     grava <saida>\plano-refazer-mes.jsonl, ficam.csv e resumo.json (padrão: <controle>\refazer-mes\<data-hora>)
//   node arquivador-correcao.js --plano <saida>\plano-refazer-mes.jsonl --etapas pasta                     (simulação)
//   node arquivador-correcao.js --plano <saida>\plano-refazer-mes.jsonl --etapas pasta --producao --confirmo
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const W = path.win32;
const N = s => R.norm(s).trim();
const dois = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------------------------------------------------
// puras (teste-arquivador-refazer-mes.js)
// ---------------------------------------------------------------------------------------------------------------------

/** A guia de taxa com o mês do nome igual ao do vencimento (a marca do erro): { mes, ano } do nome, ou null. */
function daeTaxaSuspeita(nome) {
  const m = /^(0[1-9]|1[0-2])-(20\d{2}) - DAE TAXA - .* - VENCIMENTO (\d{2})-(\d{2})-(20\d{2})(?: \(\d+\))?\.pdf$/i.exec(String(nome || ''));
  if (!m || m[1] !== m[4] || m[2] !== m[5]) return null;
  return { mes: +m[1], ano: +m[2] };
}

/** O "Emitido em" da guia do SIARE: { mes, ano } ou null. */
function emissaoDoTexto(texto) {
  const m = /EMITIDO EM:?\s*\d{2}\/(0[1-9]|1[0-2])\/(20\d{2})/.exec(R.norm(String(texto || '')));
  return m ? { mes: +m[1], ano: +m[2] } : null;
}

/** O nome com o mês novo na frente (sem o " (N)" do repetido: o executor numera se precisar). */
function nomeComMes(nome, comp) {
  return String(nome).replace(/^(0[1-9]|1[0-2])-(20\d{2})/, dois(comp.mes) + '-' + comp.ano).replace(/ \(\d+\)(\.[a-z0-9]+)$/i, '$1');
}

/** As partes de um caminho do G:: { drive, ano (da raiz), resto: [...pastas depois da raiz], nome }, ou null fora de <drive>\<ano>\. */
function partes(caminho, drive) {
  const rel = W.relative(drive, caminho);
  if (!rel || rel.startsWith('..') || W.isAbsolute(rel)) return null;
  const p = rel.split('\\');
  if (!/^(19|20)\d{2}$/.test(p[0]) || p.length < 3) return null;
  return { ano: +p[0], resto: p.slice(1, -1), nome: p[p.length - 1] };
}

/** Um passo do plano (o formato do plano da auditoria, etapa "pasta"). O que troca o ano da raiz fica para revisão. */
function passo(de, para, porque, evidencia, tamanho, trocaRaiz) {
  return {
    ordem: 3, etapa: 'pasta', gravidade: 'ERRADO-PASTA', acao: 'MOVER', de, para, igualA: null,
    confianca: 0.95, automatico: !trocaRaiz, porque: porque + (trocaRaiz ? ' — troca o ano da raiz: conferir a pasta do cliente no outro ano' : ''),
    evidencia, tamanho: tamanho == null ? null : tamanho, hash: null, outros: [],
  };
}

/**
 * A DAE de taxa: de onde está para o mês do "Emitido em". → { passo } ou { fica: motivo }.
 */
function planoDaDae(caminho, texto, drive, tamanho) {
  const p = partes(caminho, drive);
  const atual = daeTaxaSuspeita(p ? p.nome : W.basename(caminho));
  if (!p || !atual) return { fica: 'não é a DAE de taxa com o mês do vencimento' };
  const em = emissaoDoTexto(texto);
  if (!em) return { fica: 'o "Emitido em" não foi lido' };
  if (em.mes === atual.mes && em.ano === atual.ano) return { fica: 'emitida no mesmo mês do vencimento: já está certa' };
  const para = W.join(drive, String(em.ano), ...p.resto, nomeComMes(p.nome, em));
  return { passo: passo(caminho, para, 'DAE de taxa no mês da validade (' + dois(atual.mes) + '-' + atual.ano + '); emitida em ' + dois(em.mes) + '-' + em.ano,
    'o "Emitido em" da guia (a regra de 10/11/2026)', tamanho, em.ano !== p.ano) };
}

/**
 * O extrato: de onde está (…\EXTRATOS\AAAA\MM\…\MM-AAAA.pdf) para o mês das datas dos lançamentos. → { passo } ou { fica: motivo }.
 */
function planoDoExtrato(caminho, texto, drive, tamanho) {
  const p = partes(caminho, drive);
  if (!p) return { fica: 'fora de ' + drive + '\\<ano>' };
  const i = p.resto.findIndex((x, k) => /^(19|20)\d{2}$/.test(x) && /^(0[1-9]|1[0-2])$/.test(p.resto[k + 1] || '') && k > 0 && N(p.resto[k - 1]) === 'EXTRATOS');
  if (i < 0) return { fica: 'não está numa pasta EXTRATOS\\AAAA\\MM' };
  const pd = R.periodoPelasDatas(R.norm((Array.isArray(texto) ? texto.join('\n') : String(texto || ''))));
  if (!pd) return { fica: 'as datas dos lançamentos não dão um mês' };
  const comp = { mes: pd.ate.mes, ano: pd.ate.ano };
  if (+p.resto[i] === comp.ano && +p.resto[i + 1] === comp.mes) return { fica: 'já está no mês dos lançamentos' };
  const resto = p.resto.slice();
  resto[i] = String(comp.ano); resto[i + 1] = dois(comp.mes);
  const nome = /^(0[1-9]|1[0-2])-(20\d{2})/.test(p.nome) ? nomeComMes(p.nome, comp) : p.nome;
  return { passo: passo(caminho, W.join(drive, String(comp.ano), ...resto, nome), 'extrato no mês da data do nome do arquivo (' + p.resto[i + 1] + '-' + p.resto[i] + '); os lançamentos são de ' + dois(comp.mes) + '-' + comp.ano,
    'as datas dos lançamentos (a regra de 10/11/2026)', tamanho, comp.ano !== p.ano) };
}

/**
 * As DAE de taxa suspeitas de um conjunto de raízes, só pela lista das pastas. ler(pasta) → [{ nome, pasta, tamanho }] ou null.
 * Devolve [{ caminho, tamanho }].
 */
function daesSuspeitas(ler, raizes) {
  const out = [];
  const dirs = p => (ler(p) || []).filter(x => x.pasta);
  for (const { raiz } of raizes) {
    for (const cli of dirs(raiz)) {
      if (!/^\d+ - /.test(cli.nome)) continue;
      const pCli = W.join(raiz, cli.nome);
      for (const fis of dirs(pCli).filter(x => N(x.nome) === 'FISCAL')) {
        for (const reg of dirs(W.join(pCli, fis.nome))) {
          const pReg = W.join(pCli, fis.nome, reg.nome);
          for (const dae of dirs(pReg).filter(x => /^\d{2}\. DAE$/.test(N(x.nome)))) {
            const pDae = W.join(pReg, dae.nome);
            for (const a of (ler(pDae) || []).filter(x => !x.pasta && daeTaxaSuspeita(x.nome))) out.push({ caminho: W.join(pDae, a.nome), tamanho: a.tamanho });
          }
        }
      }
    }
  }
  return out;
}

/**
 * O plano inteiro. opcoes: { drive, raizes, ler, lerTexto (async caminho → texto, as páginas juntas), extratos: [caminhos], tamanho }.
 * → { plano, ficam: [{ p, motivo }], daes (quantas suspeitas), extratos }
 */
async function planejar(o) {
  const plano = [], ficam = [];
  const daes = daesSuspeitas(o.ler, o.raizes);
  for (const d of daes) {
    let texto = '';
    try { texto = await o.lerTexto(d.caminho); } catch (e) { ficam.push({ p: d.caminho, motivo: 'não consegui ler: ' + e.message }); continue; }
    const r = planoDaDae(d.caminho, texto, o.drive, d.tamanho);
    if (r.passo) plano.push(r.passo); else ficam.push({ p: d.caminho, motivo: r.fica });
  }
  for (const c of o.extratos || []) {
    let texto = '';
    try { texto = await o.lerTexto(c); } catch (e) { ficam.push({ p: c, motivo: 'não consegui ler: ' + e.message }); continue; }
    const r = planoDoExtrato(c, texto, o.drive, o.tamanho ? o.tamanho(c) : null);
    if (r.passo) plano.push(r.passo); else ficam.push({ p: c, motivo: r.fica });
  }
  return { plano, ficam, daes: daes.length, extratos: (o.extratos || []).length };
}

/** ler() do disco: só metadados (readdir e stat do que está numa pasta DAE). */
function lerDoDisco(p) {
  let itens;
  try { itens = fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return null; }
  const naDae = /^\d{2}\. DAE$/.test(N(W.basename(p)));
  return itens.map(it => {
    const pasta = it.isDirectory();
    let tamanho = null;
    if (!pasta && naDae) { try { tamanho = fs.statSync(W.join(p, it.name)).size; } catch (e) { /* sumiu no meio */ } }
    return { nome: it.name, pasta, tamanho };
  });
}

module.exports = { daeTaxaSuspeita, emissaoDoTexto, nomeComMes, planoDaDae, planoDoExtrato, daesSuspeitas, planejar, lerDoDisco };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  (async () => {
    const drive = valor('--drive') || W.dirname(R.RAIZ_CLIENTES);
    const [de, ate] = String(valor('--anos') || (R.ANO_MINIMO + '-' + new Date().getFullYear())).split('-').map(Number);
    if (!(de >= 1990 && ate >= de)) throw new Error('--anos AAAA-AAAA');
    const raizes = [];
    for (let ano = de; ano <= ate; ano++) { const raiz = W.join(drive, String(ano)); if (fs.existsSync(raiz)) raizes.push({ ano, raiz }); }
    if (!raizes.length) throw new Error('nenhuma raiz de ano em ' + drive + ' (' + de + '-' + ate + ')');
    const extratos = (valor('--extratos') ? fs.readFileSync(valor('--extratos'), 'utf8').split(/\r?\n/) : [])
      .concat(a.map((x, i) => (x === '--extrato' ? a[i + 1] : null)).filter(Boolean))
      .map(s => String(s).trim().replace(/^"|"$/g, '')).filter(Boolean);
    const A = require('./arquivador-novo');
    const lerTexto = async c => { const t = await A.textoDoPdf(fs.readFileSync(c)); if (t.erro) throw new Error(t.erro); return t.paginas.join('\n'); };
    const d = new Date();
    const controle = process.env.ARQ_NOVO_CONTROLE || require('./pastas-locais').CONTROLE;
    const saida = valor('--saida') || W.join(controle, 'refazer-mes', d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds()));
    console.log('lendo as pastas DAE (só a lista) em: ' + raizes.map(x => x.raiz).join(', ') + (extratos.length ? '; e ' + extratos.length + ' extrato(s) da lista' : ''));
    const r = await planejar({ drive, raizes, ler: lerDoDisco, lerTexto, extratos, tamanho: c => { try { return fs.statSync(c).size; } catch (e) { return null; } } });
    fs.mkdirSync(saida, { recursive: true });
    const arqPlano = W.join(saida, 'plano-refazer-mes.jsonl');
    fs.writeFileSync(arqPlano, r.plano.map(p => JSON.stringify(p)).join('\n') + (r.plano.length ? '\n' : ''));
    const csv = s => '"' + String(s).replace(/"/g, '""') + '"';
    fs.writeFileSync(W.join(saida, 'ficam.csv'), '\ufeffcaminho;motivo\n' + r.ficam.map(f => [f.p, f.motivo].map(csv).join(';')).join('\n') + '\n');
    const resumo = { em: d.toISOString(), plano: arqPlano, daesSuspeitas: r.daes, extratos: r.extratos, mover: r.plano.length, automaticos: r.plano.filter(p => p.automatico).length, paraRevisar: r.plano.filter(p => !p.automatico).length, ficam: r.ficam.length,
      passos: r.plano.map(p => W.relative(drive, p.de) + '  →  ' + W.relative(drive, p.para) + (p.automatico ? '' : '  (revisar)')) };
    fs.writeFileSync(W.join(saida, 'resumo.json'), JSON.stringify(resumo, null, 1));
    console.log(JSON.stringify(resumo, null, 1));
    console.log('\nnada foi mexido. Simulação do executor:\n  node arquivador-correcao.js --plano "' + arqPlano + '" --etapas pasta');
  })().catch(e => { console.error('PAREI: ' + e.message); process.exitCode = 1; });
}
