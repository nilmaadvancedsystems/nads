// Os NÃO IDENTIFICADOS já decididos com as regras de agora (07/11/2026). Em 05/11, 408 arquivos levaram 3.252 s e 372 voltaram
// com o mesmo motivo; rodadas de 6 arquivos se repetiram 4 vezes com o mesmo resultado. O reprocesso (reprocessar-ni.js)
// guarda, por arquivo, o motivo com que ficou + a versão das regras (arquivador-novo.versaoDasRegras) + tamanho e data do
// arquivo; na rodada seguinte com a MESMA versão, pula o que não mudou. Mudou a versão (as regras mudaram), ou o arquivo
// (outro tamanho/data), ou passaram RETRATO_DIAS: reprocessa de novo.
//
// Só vale para o motivo que depende do conteúdo e das regras (MOTIVOS_FIXOS). O que depende do cadastro, dos índices, do SIEG
// ou do OCR (CLIENTE_*, BANCO_*, EVENTO_SEM_ORIGINAL, CONTEUDO_SEM_TEXTO, erro…) nunca é pulado: o mundo muda sem as regras mudarem.
// Arquivo: <controle>\reprocesso-ni-decididos.json. Nada é apagado dos NÃO IDENTIFICADOS: pular é só não olhar de novo.
'use strict';
const fs = require('fs');

const RETRATO_DIAS = 7;
const MOTIVOS_FIXOS = new Set([
  'TIPO_NAO_RECONHECIDO', 'FORMATO_SEM_REGRA', 'VOCABULARIO_AUSENTE', 'CONFIANCA_ABAIXO_DO_LIMIAR', 'COMPETENCIA_AUSENTE',
  'VENCIMENTO_AUSENTE', 'VALOR_AUSENTE', 'ANO_INDETERMINADO', 'ANO_FORA_DA_FAIXA', 'EMITENTE_INDETERMINADO', 'CONTRATO_SEM_NUMERO',
  'PARCELAMENTO_SEM_REGRA_DETERMINISTICA', 'HASH_CONFIRMADO_SEM_REGRA_DE_DESTINO', 'IMAGEM_NAO_IDENTIFICADA', 'VIDEO_OU_AUDIO',
  'MENSAGEM_DA_SEFAZ', 'PDF_COMPOSTO_NAO_SEPARADO', 'TIPO_XML_NAO_TRATADO', 'ARQUIVO_COMPACTADO_CORROMPIDO',
]);

/** Lê o registro; de outra versão das regras (ou ilegível) vale como vazio. */
function ler(arquivo, versao) {
  try {
    const r = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    if (r && r.versao === versao && r.itens && typeof r.itens === 'object') return { versao, itens: r.itens };
  } catch (e) { /* sem registro */ }
  return { versao, itens: {} };
}
function gravar(arquivo, reg) {
  try { fs.writeFileSync(arquivo + '.tmp', JSON.stringify({ versao: reg.versao, em: new Date().toISOString(), itens: reg.itens })); fs.renameSync(arquivo + '.tmp', arquivo); return true; }
  catch (e) { return false; }
}
const marca = st => ({ t: st.size, mt: Math.round(st.mtimeMs) });

/** O arquivo (com o stat de agora) já foi decidido com estas regras e não mudou? → o motivo, ou null. */
function jaDecidido(reg, rel, st, agora) {
  const e = reg.itens[rel];
  if (!e || !st || !MOTIVOS_FIXOS.has(e.m)) return null;
  if (e.t !== st.size || e.mt !== Math.round(st.mtimeMs)) return null;
  if ((agora || Date.now()) - e.em > RETRATO_DIAS * 864e5) return null;
  return e.m;
}

/**
 * Anota o resultado de um lote: docs = os documentos do reprocesso (planos sem CONTEINER); stats = Map rel → stat do arquivo
 * de cima (o compactado, para o que está dentro dele). O arquivo só entra se TODOS os seus documentos ficaram com um motivo
 * fixo, sem erro; senão sai do registro. Devolve quantos anotou.
 */
function anotar(reg, docs, stats, agora) {
  const grupos = new Map();
  for (const x of docs) { const k = x.dentroDe || x.rel; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); }
  let n = 0;
  for (const [rel, lista] of grupos) {
    const st = stats.get(rel);
    // (09/11/2026) o OCR que falhou (prazo, trabalhador morto) não decide nada: o arquivo volta na próxima rodada
    const fixo = lista.every(x => (x.acao === 'NAO_IDENTIFICADO' || x.acao === 'FICA') && !x.erro && !x.temporario && !(x.ocr && x.ocr.erro) && MOTIVOS_FIXOS.has(x.motivo));
    if (!st || !fixo) { delete reg.itens[rel]; continue; }
    reg.itens[rel] = Object.assign({ m: lista[0].motivo, em: agora || Date.now() }, marca(st));
    n++;
  }
  return n;
}
/** Tira do registro o que já não está na pasta (nada é apagado dos arquivos: só o registro encolhe). */
function podar(reg, relsDaPasta) {
  const vivos = new Set(relsDaPasta);
  let tirou = 0;
  for (const k of Object.keys(reg.itens)) if (!vivos.has(k)) { delete reg.itens[k]; tirou++; }
  return tirou;
}

module.exports = { ler, gravar, jaDecidido, anotar, podar, MOTIVOS_FIXOS, RETRATO_DIAS };
