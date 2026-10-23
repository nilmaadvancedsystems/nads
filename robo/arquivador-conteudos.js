// O índice de conteúdo do arquivador novo (23/10/2026: a carga de ~320 mil arquivos do SIEG, muitos repetidos).
//
// "Já arquivado" tem de ser barato: o hash (e, no XML, a chave + o protocolo) calculado na LEITURA da origem é procurado
// aqui, sem abrir o destino no G: (abrir baixa o arquivo do Google Drive em streaming). Entra no índice:
//   - o manifesto da rotina antiga e o do arquivador novo (hash → caminho arquivado);
//   - continuo\conteudos.jsonl, incremental: o que o arquivador novo arquivou depois, com a chave do XML, e o conteúdo de
//     cada arquivo do destino que ele já teve de abrir uma vez (assim não abre de novo).
// Compacto: a chave guardada é o começo do sha256 (32 hex = 128 bits) ou a chave do XML; a pasta do destino é guardada uma
// vez só (o número dela) e o valor é "número da pasta \u0001 nome".
'use strict';
const fs = require('fs');
const path = require('path');

const SEP = '\u0001', VARIOS = '\u0002';
const curta = k => { const s = String(k || ''); return /^[0-9a-f]{64}$/i.test(s) ? s.slice(0, 32).toLowerCase() : s; };

/** Lê um .jsonl grande sem carregar o arquivo inteiro (pedaços de 1 MB). */
function cadaLinha(arquivo, f) {
  let fd; try { fd = fs.openSync(arquivo, 'r'); } catch (e) { return 0; }
  const buf = Buffer.alloc(1 << 20);
  let resto = '', n = 0, lidos;
  const linha = l => { if (!l.trim()) return; let r; try { r = JSON.parse(l); } catch (e) { try { r = JSON.parse(l.replace(/\\/g, '/')); } catch (e2) { return; } } n++; f(r); };
  try {
    while ((lidos = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      const partes = (resto + buf.toString('utf8', 0, lidos)).split(/\r?\n/);
      resto = partes.pop();
      for (const l of partes) linha(l);
    }
    linha(resto);
  } finally { fs.closeSync(fd); }
  return n;
}

class Conteudos {
  constructor(arquivo) { this.mapa = new Map(); this.pastas = []; this.numDaPasta = new Map(); this.arquivo = arquivo || null; }
  get tamanho() { return this.mapa.size; }
  _valor(onde) {
    const p = path.win32.dirname(onde), nome = path.win32.basename(onde), k = p.toLowerCase();
    let n = this.numDaPasta.get(k);
    if (n == null) { n = this.pastas.length; this.pastas.push(p); this.numDaPasta.set(k, n); }
    return n + SEP + nome;
  }
  _onde(v) { const i = v.indexOf(SEP); return this.pastas[+v.slice(0, i)] + '\\' + v.slice(i + 1); }
  /** Junta (sem gravar). chaves: o sha256 e/ou a chave do XML. */
  juntar(chaves, onde) {
    if (!onde) return false;
    const v = this._valor(String(onde).replace(/\//g, '\\').replace(/ \(neste lote\)$/, ''));
    let mudou = false;
    for (const c of [].concat(chaves)) {
      if (!c) continue;
      const k = curta(c), a = this.mapa.get(k);
      if (a == null) { this.mapa.set(k, v); mudou = true; }
      else if (!a.split(VARIOS).includes(v)) { this.mapa.set(k, a + VARIOS + v); mudou = true; }
    }
    return mudou;
  }
  /** Junta e grava em conteudos.jsonl (o que o arquivador novo arquivou ou leu do destino). */
  anotar(chaves, onde) {
    const lista = [].concat(chaves).filter(Boolean);
    if (!this.juntar(lista, onde) || !this.arquivo) return;
    try { fs.mkdirSync(path.dirname(this.arquivo), { recursive: true }); fs.appendFileSync(this.arquivo, JSON.stringify({ k: lista.map(curta), onde: String(onde).replace(/ \(neste lote\)$/, '') }) + '\n'); } catch (e) { /* o índice em memória continua valendo */ }
  }
  /** Os caminhos já arquivados com este conteúdo (pelo sha256 ou pela chave do XML). */
  achar(...chaves) {
    const out = [];
    for (const c of chaves) { if (!c) continue; const a = this.mapa.get(curta(c)); if (a != null) for (const v of a.split(VARIOS)) { const onde = this._onde(v); if (!out.includes(onde)) out.push(onde); } }
    return out;
  }
}

/** opcoes: { controle (a pasta continuo\ vai dentro), manifestoAntigo, manifestoNovo } → Conteudos, com .estatistica */
function carregar(opcoes) {
  const t0 = Date.now();
  const arq = path.join(opcoes.controle, 'continuo', 'conteudos.jsonl');
  const c = new Conteudos(arq);
  const doManifesto = r => {
    const d = String(r.destino_final || '').replace(/\//g, '\\').replace(/\\+$/, ''), n = String(r.nome_final || '');
    if (!d || !n || r.descarte) return;
    const onde = d.toLowerCase().endsWith('\\' + n.toLowerCase()) ? d : d + '\\' + n;
    c.juntar([r.hash_origem, r.hash_destino, r.conteudo_xml], onde);
  };
  let linhas = 0;
  for (const m of [opcoes.manifestoAntigo, opcoes.manifestoNovo || path.join(opcoes.controle, 'MANIFESTO', 'manifesto.jsonl')]) if (m) linhas += cadaLinha(m, doManifesto);
  linhas += cadaLinha(arq, r => c.juntar(r.k || [], r.onde));
  c.estatistica = { linhas, chaves: c.tamanho, pastas: c.pastas.length, ms: Date.now() - t0 };
  return c;
}

module.exports = { carregar, Conteudos, cadaLinha, curta };
