// A SEPARAÇÃO dos PDFs já arquivados em RECEBIDOS (10/11/2026: "separe o PDF da nota fiscal tomadora e recebidos, apenas os pdf
// como outra pasta"; os já arquivados também).
//
// Desde 10/11/2026 as regras (arquivador-regras.js, SUB_RECEBIDOS) põem o PDF da NF-e recebida em
// FISCAL\<regime>\<nº>. DOCUMENTOS FISCAIS\RECEBIDOS\NF-e e o da NFS-e tomada em RECEBIDOS\NFS-e TOMADAS. Este programa acha os
// que ficaram soltos em RECEBIDOS antes disso e monta o PLANO para movê-los, no formato do plano da auditoria, para o MESMO
// executor (arquivador-correcao.js, etapa "pasta": só rename dentro do G:, nunca sobrescreve, o mesmo conteúdo no destino vai
// para a quarentena, o nome repetido ganha " (N)", confere cada lote, manifesto e diário com o --desfazer).
//
// SÓ LEITURA: lista as pastas de G:\Meu Drive\<ano> (metadados: nome e tamanho), não abre nenhum arquivo (abrir no G: é baixar).
// Vai pelo NOME que as regras dão ("DD-MM-AAAA - NF-e 123 - EMITENTE.pdf", "DD-MM-AAAA - NFS-e 45 - PRESTADOR.pdf",
// R.subDoRecebidoPeloNome): o cancelamento, o agro, o CT-e e o nome fora do padrão ficam onde estão e saem na lista "ficam".
//
// Uso (no NILMA-SERVER, onde está o G:):
//   node arquivador-separar-recebidos.js [--drive "G:\Meu Drive"] [--anos 2015-2026] [--saida <pasta>]
//     grava <saida>\plano-recebidos.jsonl, ficam.csv e resumo.json (padrão: <controle>\separar-recebidos\<data-hora>)
//   node arquivador-correcao.js --plano <saida>\plano-recebidos.jsonl --etapas pasta                     (simulação)
//   node arquivador-correcao.js --plano <saida>\plano-recebidos.jsonl --etapas pasta --producao --confirmo
//     (a produção pede o arquivador contínuo em "desligado" e a rotina antiga parada, como toda correção)
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const W = path.win32;
const N = s => R.norm(s).trim();
const dois = n => String(n).padStart(2, '0');

/**
 * O plano de um conjunto de raízes. ler(pasta) → [{ nome, pasta (bool), tamanho }] ou null (não existe/sem acesso).
 * raizes: [{ ano, raiz }]. Devolve { plano (passos no formato do plano da auditoria), ficam: [{ p, nome }], pastas (RECEBIDOS vistas) }.
 */
function planejar(ler, raizes) {
  const plano = [], ficam = [];
  let pastas = 0;
  const dirs = p => (ler(p) || []).filter(x => x.pasta);
  for (const { ano, raiz } of raizes) {
    for (const cli of dirs(raiz)) {
      if (!/^\d+ - /.test(cli.nome)) continue;
      const pCli = W.join(raiz, cli.nome);
      for (const fis of dirs(pCli).filter(x => N(x.nome) === 'FISCAL')) {
        for (const reg of dirs(W.join(pCli, fis.nome))) {
          const pReg = W.join(pCli, fis.nome, reg.nome);
          for (const docs of dirs(pReg).filter(x => /DOCUMENTOS FISCAIS$/.test(N(x.nome)))) {
            for (const rec of dirs(W.join(pReg, docs.nome)).filter(x => N(x.nome) === 'RECEBIDOS')) {
              const pRec = W.join(pReg, docs.nome, rec.nome);
              pastas++;
              for (const arq of (ler(pRec) || []).filter(x => !x.pasta)) {
                const de = W.join(pRec, arq.nome);
                const sub = R.subDoRecebidoPeloNome(arq.nome);
                if (!sub) { ficam.push({ p: de, nome: arq.nome }); continue; }
                plano.push({
                  ordem: 3, etapa: 'pasta', gravidade: 'ERRADO-PASTA', acao: 'MOVER', de, para: W.join(pRec, sub, arq.nome), igualA: null,
                  confianca: 0.95, automatico: true,
                  porque: 'PDF de ' + (sub === R.SUB_RECEBIDOS['NFS-e'] ? 'NFS-e tomada' : 'NF-e recebida') + ' solto em RECEBIDOS (vai para RECEBIDOS\\' + sub + ')',
                  evidencia: 'RECEBIDOS separado por modelo (10/11/2026), pelo nome do arquivo', tamanho: arq.tamanho == null ? null : arq.tamanho, hash: null,
                  ano, cliente: cli.nome, outros: [],
                });
              }
            }
          }
        }
      }
    }
  }
  return { plano, ficam, pastas };
}

/** ler() do disco: só metadados (readdir e stat); o tamanho só dos arquivos de RECEBIDOS (o executor confere com ele). */
function lerDoDisco(p) {
  let itens;
  try { itens = fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return null; }
  const dentroDeRecebidos = N(W.basename(p)) === 'RECEBIDOS';
  return itens.map(it => {
    const pasta = it.isDirectory();
    let tamanho = null;
    if (!pasta && dentroDeRecebidos) { try { tamanho = fs.statSync(W.join(p, it.name)).size; } catch (e) { /* sumiu no meio */ } }
    return { nome: it.name, pasta, tamanho };
  });
}

function resumir(r) {
  const porSub = {}, porAno = {};
  for (const p of r.plano) {
    const s = W.basename(W.dirname(p.para));
    porSub[s] = (porSub[s] || 0) + 1;
    porAno[p.ano] = (porAno[p.ano] || 0) + 1;
  }
  return { pastasRecebidos: r.pastas, mover: r.plano.length, porSubpasta: porSub, porAno, clientes: new Set(r.plano.map(p => p.ano + '\\' + p.cliente)).size, ficam: r.ficam.length };
}

module.exports = { planejar, lerDoDisco, resumir };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  try {
    const drive = valor('--drive') || W.dirname(R.RAIZ_CLIENTES);
    const [de, ate] = String(valor('--anos') || (R.ANO_MINIMO + '-' + new Date().getFullYear())).split('-').map(Number);
    if (!(de >= 1990 && ate >= de)) throw new Error('--anos AAAA-AAAA');
    const raizes = [];
    for (let ano = de; ano <= ate; ano++) { const raiz = W.join(drive, String(ano)); if (fs.existsSync(raiz)) raizes.push({ ano, raiz }); }
    if (!raizes.length) throw new Error('nenhuma raiz de ano em ' + drive + ' (' + de + '-' + ate + ')');
    const d = new Date();
    const controle = process.env.ARQ_NOVO_CONTROLE || require('./pastas-locais').CONTROLE;
    const saida = valor('--saida') || W.join(controle, 'separar-recebidos', d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds()));
    console.log('lendo (só as pastas, nada é aberto): ' + raizes.map(x => x.raiz).join(', '));
    const r = planejar(lerDoDisco, raizes);
    fs.mkdirSync(saida, { recursive: true });
    const arqPlano = W.join(saida, 'plano-recebidos.jsonl');
    fs.writeFileSync(arqPlano, r.plano.map(p => JSON.stringify(p)).join('\n') + (r.plano.length ? '\n' : ''));
    const csv = s => '"' + String(s).replace(/"/g, '""') + '"';
    fs.writeFileSync(W.join(saida, 'ficam.csv'), '\ufeffcaminho;nome\n' + r.ficam.map(f => [f.p, f.nome].map(csv).join(';')).join('\n') + '\n');
    const resumo = Object.assign({ em: d.toISOString(), raizes: raizes.map(x => x.raiz), plano: arqPlano }, resumir(r));
    fs.writeFileSync(W.join(saida, 'resumo.json'), JSON.stringify(resumo, null, 1));
    console.log(JSON.stringify(resumo, null, 1));
    console.log('\nnada foi mexido. Simulação do executor:\n  node arquivador-correcao.js --plano "' + arqPlano + '" --etapas pasta');
  } catch (e) { console.error('PAREI: ' + e.message); process.exitCode = 1; }
}
