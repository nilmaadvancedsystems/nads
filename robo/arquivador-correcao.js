// O EXECUTOR da correção de G:\Meu Drive\2026 (Vitor, 23/10/2026), a partir do plano da auditoria
// (robo/arquivador-auditoria.js → plano-simulado.jsonl).
//
// SIMULAÇÃO por padrão: confere tudo o que dá sem mexer (a origem existe e é a mesma da auditoria, o destino está livre
// ou tem o mesmo conteúdo, a numeração " (N)") e grava o diário da simulação. PRODUCAO só com --producao --confirmo.
//
// Como mexe (em PRODUCAO):
//   - só RENAME dentro do G: (no Google Drive é trocar a pasta no servidor: nada é baixado nem subido de novo);
//   - nunca sobrescreve: destino com o MESMO conteúdo (sha256) → a origem vai para a quarentena; destino com outro
//     conteúdo → " (N)" (Dicionário §2);
//   - o sha256 da origem é conferido antes (e com o da auditoria, quando ela o tinha) e o do destino depois;
//   - nada é apagado: os repetidos e as pastas que ficam vazias vão para a quarentena DENTRO do G:,
//     G:\Meu Drive\_QUARENTENA ARQUIVADOR\DD-MM-AAAA\<caminho de antes> (nenhuma rotina varre essa pasta);
//   - em lotes de 200; depois de cada lote confere que cada arquivo está no destino com o mesmo tamanho e saiu da origem
//     (para no primeiro erro);
//   - cada passo vira uma linha no manifesto do arquivador novo (o "já arquivado" e os índices acham o lugar novo) e no
//     diário da correção (%LOCALAPPDATA%\nads\arquivador-novo\correcao\correcao-<id>.jsonl), que o --desfazer usa.
//
// Etapas (nesta ordem):
//   zelo        a troca ZELO × AAP (23/10/2026: a ZELO passou a 591 e a AAP a 602 no cadastro): "591 - AAP …" → "602 - AAP …";
//               o conteúdo de "602 - ZELO …" para dentro de "591 - ZELO …"; a 602-ZELO vazia para a quarentena.
//               Só roda se o cadastro (o do arquivador, relido do banco) disser ZELO = 591 e AAP = 602.
//   cliente     ERRADO-CLIENTE do plano      ano         ERRADO-ANO (para a raiz do ano da competência)
//   pasta       ERRADO-PASTA (inclusive as pastas com nome de arquivo)
//   duplicados  DUPLICADO (quarentena)       renomes     NOME-FORA-DO-PADRAO (renomear no lugar)
// Do plano, só os passos "automatico" (confiança ≥ 0,9 e destino conhecido); o resto fica na lista de revisão.
//
//   node arquivador-correcao.js --etapas zelo [--producao --confirmo]
//   node arquivador-correcao.js --plano <plano-simulado.jsonl> --etapas cliente,ano,pasta,duplicados,renomes [--producao --confirmo]
//   node arquivador-correcao.js --desfazer <correcao-<id>.jsonl> [--producao --confirmo]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('./arquivador-novo');
const R = require('./arquivador-regras');
const CT = require('./arquivador-conteudos');

const W = path.win32;
const MEU_DRIVE = process.env.ARQ_CORRECAO_DRIVE || 'G:\\Meu Drive';
const RAIZ = R.RAIZ_CLIENTES;
const QUARENTENA = W.join(MEU_DRIVE, '_QUARENTENA ARQUIVADOR');
const CONTROLE = A.CONTROLE;
const DIARIOS = W.join(CONTROLE, 'correcao');
const MANIFESTO = W.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl');
const LOTE = 200;
const ETAPAS = ['zelo', 'cliente', 'ano', 'pasta', 'duplicados', 'renomes'];   // ano: ERRADO-ANO (26/10/2026; a auditoria já dava a etapa, o executor não)
const ETAPA_DO_PLANO = { 'ERRADO-CLIENTE': 'cliente', 'ERRADO-ANO': 'ano', 'ERRADO-PASTA': 'pasta', DUPLICADO: 'duplicados', 'NOME-FORA-DO-PADRAO': 'renomes' };
const ZELO = { cnpj: '53636418000156', codigo: 591, pasta: '591 - ZELO AGROINDUSTRIAIS LTDA', antiga: '602 - ZELO AGROINDUSTRIAIS LTDA' };
const AAP = { cnpj: '65116389000180', codigo: 602, de: '591 - AAP INTERMEDIACOES LTDA', para: '602 - AAP INTERMEDIACOES LTDA' };

const dois = n => String(n).padStart(2, '0');
const lower = s => String(s).toLowerCase();
const shaDe = b => crypto.createHash('sha256').update(b).digest('hex');
function hoje(d) { return dois(d.getDate()) + '-' + dois(d.getMonth() + 1) + '-' + d.getFullYear(); }
function carimbo(d) { return d.getFullYear() + dois(d.getMonth() + 1) + dois(d.getDate()) + '-' + dois(d.getHours()) + dois(d.getMinutes()) + dois(d.getSeconds()); }
/** O caminho relativo a G:\Meu Drive (o que a quarentena preserva). */
const relDoDrive = p => W.relative(MEU_DRIVE, p);

class Correcao {
  constructor(opcoes) {
    this.producao = !!opcoes.producao;
    this.log = opcoes.log || (m => console.log(new Date().toLocaleTimeString('pt-BR'), m));
    const agora = new Date();
    this.id = (this.producao ? 'CORRECAO-' : 'SIMCORRECAO-') + carimbo(agora);
    this.dia = hoje(agora);
    this.passos = [];            // tudo o que foi (ou seria) feito
    this.lote = [];              // os do lote atual, para conferir
    this.lidos = 0; this.bytesLidos = 0;
    this.ocupados = new Map();   // simulação: caminho (minúsculo) → sha256 do que vai estar lá ('' = ocupado, conteúdo desconhecido)
    this.livres = new Set();     // simulação: caminhos que vão ficar livres
    this.hashes = new Map();
    this.tamanhos = new Map();
    this.origemPlanejada = new Map();   // simulação: destino planejado → onde o arquivo está de verdade
    fs.mkdirSync(DIARIOS, { recursive: true });
    this.diario = W.join(DIARIOS, (this.producao ? 'correcao-' : 'simulacao-') + this.id + '.jsonl');
  }
  existe(p) { const k = lower(p); if (this.ocupados.has(k)) return true; if (this.livres.has(k)) return false; try { fs.statSync(p); return true; } catch (e) { return false; } }
  ehPasta(p) { const k = lower(p); if (this.ocupados.has(k)) return false; try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }
  sha(p) {
    const k = lower(p);
    if (this.ocupados.has(k) && this.ocupados.get(k)) return this.ocupados.get(k);
    if (this.hashes.has(k)) return this.hashes.get(k);
    // simulação: o arquivo que um passo anterior "pôs" ali ainda está no lugar de antes
    const real = !this.producao && this.origemPlanejada.has(k) ? this.origemPlanejada.get(k) : p;
    if (real !== p) return this.sha(real);
    const b = fs.readFileSync(p); this.lidos++; this.bytesLidos += b.length;
    const h = shaDe(b); this.hashes.set(k, h); return h;
  }
  /** O primeiro nome livre: "x.pdf", "x (1).pdf", "x (2).pdf"… */
  livre(alvo) {
    const ext = W.extname(alvo), base = alvo.slice(0, alvo.length - ext.length).replace(/ \(\d+\)$/, '');
    for (let k = 0; k < 1000; k++) { const p = k === 0 ? alvo : base + ' (' + k + ')' + ext; if (!this.existe(p)) return p; }
    throw new Error('nomes esgotados: ' + alvo);
  }
  /** Um rename de verdade (ou anotado, na simulação). */
  _rename(de, para, tipo, extra) {
    // na simulação, a origem pode ser um passo anterior (o nome temporário da pasta com nome de arquivo): o tamanho dele
    let st;
    try { st = fs.statSync(de); } catch (e) { if (this.producao || !this.tamanhos.has(lower(de))) throw e; st = { size: this.tamanhos.get(lower(de)), isFile: () => true, isDirectory: () => false }; }
    if (!this.producao && this.livres.has(lower(de))) throw new Error('simulação: a origem já saiu num passo anterior: ' + de);
    const passo = Object.assign({ id: this.id, em: new Date().toISOString(), tipo, de, para, tamanho: st.isFile() ? st.size : null, pasta: st.isDirectory() }, extra || {});
    this.tamanhos.set(lower(para), passo.tamanho);
    if (this.producao) {
      fs.mkdirSync(W.dirname(para), { recursive: true });
      if (fs.existsSync(para)) throw new Error('o destino apareceu antes do rename (não sobrescrevo): ' + para);
      fs.renameSync(de, para);
      fs.appendFileSync(this.diario, JSON.stringify(passo) + '\n');
      if (!passo.pasta) {
        const m = { hash_origem: passo.sha || null, hash_original: passo.sha || null, nome_original: W.basename(de), destino_final: W.dirname(para), nome_final: W.basename(para), id_execucao: this.id, timestamp: passo.em, pai_completo: true, correcao: tipo, de };
        if (tipo === 'QUARENTENA') m.descarte = true;
        fs.appendFileSync(MANIFESTO, JSON.stringify(m) + '\n');
      }
    } else {
      fs.appendFileSync(this.diario, JSON.stringify(passo) + '\n');
      this.livres.add(lower(de)); this.ocupados.delete(lower(de));
      this.ocupados.set(lower(para), passo.sha || '');
      this.origemPlanejada.set(lower(para), this.origemPlanejada.get(lower(de)) || de);
      this.livres.delete(lower(para));
    }
    this.passos.push(passo); this.lote.push(passo);
    return passo;
  }
  quarentena(de, motivo, extra) {
    const alvo = this.livre(W.join(QUARENTENA, this.dia, relDoDrive(de)));
    return this._rename(de, alvo, 'QUARENTENA', Object.assign({ motivo }, extra || {}));
  }
  /**
   * Move um arquivo sem sobrescrever. esperado = sha256 da auditoria (se houver): diferente → a origem mudou, não mexo.
   * Destino com o mesmo conteúdo → a origem vai para a quarentena. Outro conteúdo → " (N)".
   */
  mover(de, para, tipo, extra) {
    extra = Object.assign({}, extra);
    if (!this.existe(de)) return this._pulou(de, para, tipo, 'a origem não existe mais', extra);
    if (lower(de) === lower(para)) return this._pulou(de, para, tipo, 'já está no lugar', extra);
    let h = this.producao || extra.esperado ? this.sha(de) : null;
    if (extra.esperado && h && !h.startsWith(String(extra.esperado).slice(0, 32))) return this._pulou(de, para, tipo, 'o conteúdo mudou desde a auditoria', extra);
    if (this.existe(para) && !this.ehPasta(para)) {
      // tamanhos diferentes: conteúdos diferentes, sem precisar ler (baixar) os dois
      const tam = q => (this.tamanhos.has(lower(q)) ? this.tamanhos.get(lower(q)) : fs.statSync(q).size);
      if (tam(para) === tam(de)) {
        h = h || this.sha(de);
        if (this.sha(para) === h) return this.quarentena(de, 'o mesmo conteúdo já está em ' + para, Object.assign(extra, { sha: h, igualA: para, tipoOriginal: tipo }));
      }
      para = this.livre(para);
    } else if (this.existe(para)) para = this.livre(para);   // uma PASTA com o nome do arquivo (a rotina antiga): " (N)"
    return this._rename(de, para, tipo, Object.assign(extra, { sha: h }));
  }
  _pulou(de, para, tipo, motivo, extra) { const p = Object.assign({ id: this.id, tipo, de, para, pulou: motivo }, extra || {}); this.passos.push(p); fs.appendFileSync(this.diario, JSON.stringify(p) + '\n'); return p; }
  /** Depois de cada lote: cada arquivo está no destino, com o mesmo tamanho (e o mesmo sha256), e saiu da origem. */
  conferirLote() {
    const erros = [];
    if (this.producao) for (const p of this.lote) {
      if (p.pulou) continue;
      let st = null; try { st = fs.statSync(p.para); } catch (e) { erros.push('não está no destino: ' + p.para); continue; }
      if (fs.existsSync(p.de) && lower(p.de) !== lower(p.para)) erros.push('ficou também na origem: ' + p.de);
      if (!p.pasta && st.size !== p.tamanho) erros.push('tamanho diferente: ' + p.para);
      if (!p.pasta && p.sha) { const h = shaDe(fs.readFileSync(p.para)); if (h !== p.sha) erros.push('sha256 diferente no destino: ' + p.para); }
    } else {
      const vistos = new Set();
      for (const p of this.lote) { if (p.pulou) continue; const k = lower(p.para); if (vistos.has(k)) erros.push('dois passos para o mesmo destino: ' + p.para); vistos.add(k); }
    }
    this.lote = [];
    if (erros.length) throw new Error('a conferência do lote falhou: ' + erros.slice(0, 5).join(' | '));
  }
  /** Executa uma lista de funções (um passo cada) em lotes de 200, conferindo depois de cada lote. */
  emLotes(nome, fns) {
    for (let i = 0; i < fns.length; i += LOTE) {
      for (const f of fns.slice(i, i + LOTE)) f();
      this.conferirLote();
      this.log('  ' + nome + ': ' + Math.min(i + LOTE, fns.length) + '/' + fns.length + ' conferidos');
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// etapa zelo: a troca ZELO × AAP
// ---------------------------------------------------------------------------------------------------------------------
function arquivosDe(pasta) {
  const out = [], pilha = [pasta];
  while (pilha.length) { const d = pilha.pop(); for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = W.join(d, e.name); if (e.isDirectory()) pilha.push(p); else out.push(p); } }
  return out.sort();
}
async function etapaZelo(c) {
  await A.atualizarCadastro({ log: c.log });
  const cad = A.carregarCadastro({});
  const z = [...(cad.porDoc.get(ZELO.cnpj) || [])], a = [...(cad.porDoc.get(AAP.cnpj) || [])];
  if (z.length !== 1 || z[0] !== ZELO.codigo || a.length !== 1 || a[0] !== AAP.codigo) throw new Error('o cadastro não diz ZELO = ' + ZELO.codigo + ' e AAP = ' + AAP.codigo + ' (ZELO: ' + z.join(',') + '; AAP: ' + a.join(',') + '): não mexo nas pastas');
  const res = { aap: [], zelo: [] };
  const raizes = fs.readdirSync(MEU_DRIVE, { withFileTypes: true }).filter(d => d.isDirectory() && /^(19|20)\d{2}$/.test(d.name)).map(d => W.join(MEU_DRIVE, d.name));
  // 1. a AAP sai do 591
  for (const r of raizes) {
    const de = W.join(r, AAP.de), para = W.join(r, AAP.para);
    if (!fs.existsSync(de)) continue;
    if (fs.existsSync(para)) throw new Error('já existe ' + para + ': não junto pastas da AAP sem olhar');
    res.aap.push(c._rename(de, para, 'RENOMEAR_PASTA', { motivo: 'AAP INTERMEDIAÇÕES: código 591 → 602 (cadastro, 23/10/2026)', arquivos: arquivosDe(de).length }));
  }
  c.conferirLote();
  // 2. a 602-ZELO para dentro da 591-ZELO
  for (const r of raizes) {
    const de = W.join(r, ZELO.antiga), para = W.join(r, ZELO.pasta);
    if (!fs.existsSync(de)) continue;
    if (!fs.existsSync(para) && !c.ocupados.has(lower(para))) { res.zelo.push(c._rename(de, para, 'RENOMEAR_PASTA', { motivo: 'ZELO: código 602 → 591' })); c.conferirLote(); continue; }
    const arqs = arquivosDe(de);
    c.log('ZELO em ' + W.basename(r) + ': ' + arqs.length + ' arquivos de "' + ZELO.antiga + '" para "' + ZELO.pasta + '"');
    c.emLotes('ZELO', arqs.map(p => () => res.zelo.push(c.mover(p, W.join(para, W.relative(de, p)), 'MOVER', { motivo: 'ZELO: 602 → 591 (junção das pastas)' }))));
    // 3. a 602-ZELO vazia (só pastas) vai inteira para a quarentena
    const sobrou = c.producao ? arquivosDe(de) : arqs.filter(p => c.existe(p));
    if (sobrou.length) { c.log('a pasta ' + de + ' ainda tem ' + sobrou.length + ' arquivo(s): fica'); continue; }
    res.zelo.push(c.quarentena(de, 'pasta da ZELO 602 vazia depois da junção (só subpastas vazias)'));
    c.conferirLote();
  }
  return res;
}

// ---------------------------------------------------------------------------------------------------------------------
// etapas do plano da auditoria
// ---------------------------------------------------------------------------------------------------------------------
function lerPlano(arq) { const out = []; CT.cadaLinha(arq, r => out.push(r)); return out; }
function etapaDoPlano(c, plano, etapa) {
  const passos = plano.filter(p => (p.etapa || ETAPA_DO_PLANO[p.gravidade]) === etapa && !p.excluido);
  const auto = passos.filter(p => p.automatico && (p.para || p.acao === 'QUARENTENA'));
  const revisar = passos.filter(p => !auto.includes(p));
  const fns = auto.map(p => () => {
    if (p.acao === 'QUARENTENA') {
      // repetido: só com o MESMO sha256 do que fica
      if (!p.igualA || !c.existe(p.igualA)) return c._pulou(p.de, null, 'QUARENTENA', 'não há o arquivo igual para comparar (' + (p.igualA || '?') + ')', { gravidade: p.gravidade });
      if (!c.existe(p.de)) return c._pulou(p.de, null, 'QUARENTENA', 'a origem não existe mais', { gravidade: p.gravidade });
      const h = c.sha(p.de);
      if (h !== c.sha(p.igualA)) return c._pulou(p.de, null, 'QUARENTENA', 'o conteúdo é diferente do de ' + p.igualA + ': não é repetido', { gravidade: p.gravidade });
      return c.quarentena(p.de, p.porque, { sha: h, igualA: p.igualA, gravidade: p.gravidade });
    }
    // a pasta com nome de arquivo: "…\X.xml\X.xml" → "…\X.xml" (o arquivo sai, a pasta vazia vai para a quarentena, o arquivo entra no lugar dela)
    if (lower(W.dirname(p.de)) === lower(p.para)) {
      if (!c.existe(p.de)) return c._pulou(p.de, p.para, 'MOVER', 'a origem não existe mais', { gravidade: p.gravidade });
      const irmaos = c.producao ? fs.readdirSync(p.para) : [W.basename(p.de)];
      if (irmaos.length !== 1) return c._pulou(p.de, p.para, 'MOVER', 'a pasta com nome de arquivo tem mais coisas dentro (' + irmaos.length + ')', { gravidade: p.gravidade });
      const tmp = c.livre(p.para + '.correcao-tmp');
      const t = c.mover(p.de, tmp, 'MOVER', { gravidade: p.gravidade, esperado: p.hash, motivo: 'tira o arquivo da pasta com o nome dele' });
      if (t.pulou) return t;
      c.quarentena(p.para, 'pasta com nome de arquivo, vazia', { gravidade: p.gravidade });
      return c.mover(tmp, p.para, 'MOVER', { gravidade: p.gravidade, motivo: p.porque });
    }
    return c.mover(p.de, p.para, p.acao === 'RENOMEAR' ? 'RENOMEAR' : 'MOVER', { gravidade: p.gravidade, esperado: p.hash, motivo: p.porque });
  });
  c.emLotes(etapa, fns);
  return { total: passos.length, automaticos: auto.length, revisar: revisar.length };
}

// ---------------------------------------------------------------------------------------------------------------------
// desfazer: o diário de trás para frente
// ---------------------------------------------------------------------------------------------------------------------
function desfazer(c, arq) {
  const passos = []; CT.cadaLinha(arq, r => { if (!r.pulou && r.de && r.para) passos.push(r); });
  passos.reverse();
  c.emLotes('desfazer', passos.map(p => () => {
    if (!c.existe(p.para)) return c._pulou(p.para, p.de, 'DESFAZER', 'não está mais em ' + p.para);
    if (c.existe(p.de)) return c._pulou(p.para, p.de, 'DESFAZER', 'o lugar de antes está ocupado: ' + p.de);
    return c._rename(p.para, p.de, 'DESFAZER', { desfaz: p.id });
  }));
}

function resumo(c) {
  const por = {};
  for (const p of c.passos) { const k = (p.gravidade || p.tipoOriginal || '') + ' ' + (p.pulou ? 'PULOU (' + p.pulou.replace(/ [A-Z]:\\.*$/, '').replace(/\(.*\)/, '').trim() + ')' : p.tipo); por[k.trim()] = (por[k.trim()] || 0) + 1; }
  return por;
}

module.exports = { Correcao, etapaZelo, etapaDoPlano, desfazer, QUARENTENA };

if (require.main === module) {
  const a = process.argv.slice(2);
  const valor = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const producao = a.includes('--producao');
  (async () => {
    if (producao && !a.includes('--confirmo')) throw new Error('PRODUCAO exige --confirmo');
    if (producao) {
      // o arquivador contínuo tem de estar desligado e a rotina antiga parada
      let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(W.join(CONTROLE, 'config.json'), 'utf8')); } catch (e) { /* sem config */ }
      if (cfg.modo && cfg.modo !== 'desligado') throw new Error('o arquivador contínuo está em "' + cfg.modo + '": desligue antes');
      const trava = W.join(process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio', '_CONTROLE', '_execucao.lock');
      try { if (Date.now() - fs.statSync(trava).mtimeMs < 4 * 36e5) throw new Error('a rotina antiga está rodando (_execucao.lock)'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const c = new Correcao({ producao });
    c.log(c.id + (producao ? ' — PRODUCAO' : ' — SIMULAÇÃO (nada é mexido)'));
    const t0 = Date.now();
    const saida = { id: c.id, modo: producao ? 'PRODUCAO' : 'SIMULACAO', etapas: {} };
    if (valor('--desfazer')) { desfazer(c, valor('--desfazer')); }
    else {
      const pedidas = String(valor('--etapas') || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!pedidas.length || pedidas.some(e => !ETAPAS.includes(e))) throw new Error('--etapas ' + ETAPAS.join(','));
      const plano = valor('--plano') ? lerPlano(valor('--plano')) : null;
      for (const e of ETAPAS.filter(x => pedidas.includes(x))) {
        const antes = c.passos.length;
        if (e === 'zelo') { const r = await etapaZelo(c); saida.etapas.zelo = { aap: r.aap.length, zelo: r.zelo.length }; }
        else { if (!plano) throw new Error('a etapa ' + e + ' precisa do --plano'); saida.etapas[e] = etapaDoPlano(c, plano, e); }
        const desta = c.passos.slice(antes);
        saida.etapas[e] = Object.assign(saida.etapas[e] || {}, { passos: desta.length, porTipo: desta.reduce((m, p) => { const k = p.pulou ? 'PULOU: ' + p.pulou.replace(/ [A-Z]:\\.*$/, '').replace(/\(.*\)/, '').trim() : p.tipo; m[k] = (m[k] || 0) + 1; return m; }, {}) });
        c.log('etapa ' + e + ': ' + JSON.stringify(saida.etapas[e]));
      }
    }
    saida.lidos = c.lidos; saida.mbLidos = +(c.bytesLidos / 1048576).toFixed(1); saida.ms = Date.now() - t0; saida.diario = c.diario;
    console.log(JSON.stringify(saida, null, 1));
  })().catch(e => { console.error('PAREI: ' + e.message); process.exitCode = 1; });
}
