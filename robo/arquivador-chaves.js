// O ÍNDICE DE CHAVES do arquivador novo (Vitor, 23/10/2026: "não tem como ele verificar com a chave de acesso?").
//
// chave de acesso (44 dígitos) → cliente e pasta onde o documento original (NF-e, CT-e, MDF-e) foi arquivado. Um evento
// (cancelamento, CC-e, ciência, MDF-e autorizado, comprovante de entrega…) cuja chave está aqui vai para a MESMA pasta
// do original, na subpasta EVENTOS.
//
// LEVE de propósito: o G: é o Google Drive em streaming e abrir os arquivos arquivados forçaria o download de cada um.
// O índice é montado SEM abrir nada do G:, só com o que já está no PC:
//   - o manifesto da rotina antiga (_CONTROLE\MANIFESTO\manifesto.jsonl: nome original, destino, nome final);
//   - o manifesto do arquivador novo (o mesmo formato; desde 23/10/2026 com a "chave" de cada XML);
//   - o diário do modo contínuo (continuo\decisoes-AAAA-MM.jsonl: o que foi arquivado/já estava arquivado, e onde);
//   - chaves.jsonl (este módulo): o que o arquivador decide daqui para a frente, gravado na hora, e o que o SIEG trouxe.
// A chave vem do campo "chave" (lido do conteúdo na hora da decisão) ou do nome do arquivo (o SIEG grava
// "<chave>-nfe.xml", "<chave>-evento-110111-1.xml"; o DANFE "<chave> - <RAZÃO>.pdf"). Toda chave passa pelo dígito
// verificador (módulo 11), para um número qualquer de 44 dígitos não virar chave.
//
// Fica no PC (%LOCALAPPDATA%\nads\arquivador-novo\chaves.jsonl), nunca no Firestore.
//
// E o SIEG pela chave (criarBuscaSieg): para o evento cujo original não chegou nem está no índice, depois da espera,
// pede ao SIEG (API baixar-xmls, no ritmo do robo/sieg.js: 2 por minuto) os documentos do mesmo emitente (a chave traz
// o CNPJ do emitente, o mês e o modelo) e acha o original entre eles. Limite de chamadas por dia (padrão 200); o
// resultado de cada chave fica guardado (sieg-chaves.json e os XMLs em sieg-originais\), para não perguntar duas vezes.
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const RE_CHAVE = /(?<!\d)(\d{44})(?!\d)/g;
const MODELOS = new Set(['55', '57', '58', '59', '65', '67']);

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita para a esquerda) e modelo conhecido. */
function chaveValida(ch) {
  ch = String(ch || '');
  if (!/^\d{44}$/.test(ch) || !MODELOS.has(ch.slice(20, 22))) return false;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += +ch[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === +ch[43];
}
/** As chaves válidas num texto (nome de arquivo). */
function chavesDoTexto(t) { return [...new Set([...String(t || '').matchAll(RE_CHAVE)].map(m => m[1]).filter(chaveValida))]; }

/**
 * Onde o arquivo está → { cliente, sub, de }: sub são as pastas entre a do cliente e o arquivo, sem o "EVENTOS" do fim;
 * de = 'doc' (o XML do documento), 'evento' (estava em EVENTOS) ou 'outro' (PDF etc.: só o cliente vale).
 */
function lerDestino(arquivo, raiz) {
  const r = String(raiz || R.RAIZ_CLIENTES).replace(/\\+$/, '') + '\\';
  const a = String(arquivo || '').replace(/\//g, '\\');
  if (a.slice(0, r.length).toLowerCase() !== r.toLowerCase()) return null;
  const partes = a.slice(r.length).split('\\').filter(Boolean);
  if (partes.length < 2) return null;
  const m = /^(\d{1,4}) - /.exec(partes[0]);
  if (!m) return null;
  let sub = partes.slice(1, -1);
  const nome = partes[partes.length - 1];
  let de = /\.xml$/i.test(nome) ? 'doc' : 'outro';
  if (sub.length && sub[sub.length - 1].toUpperCase() === 'EVENTOS') { sub = sub.slice(0, -1); de = de === 'doc' ? 'evento' : 'outro'; }
  if (/-evento-|^\d{2}-\d{2}-\d{4} - /i.test(nome) && de === 'doc') de = 'evento';
  return { cliente: +m[1], sub: de === 'outro' ? null : sub, de };
}

const PESO = { doc: 3, evento: 2, outro: 1 };

/** O índice em memória. anotar() grava na hora em chaves.jsonl (quando persistir). */
class Indice {
  constructor(arquivo) { this.mapa = new Map(); this.arquivo = arquivo || null; this.versao = 0; this.salvas = new Set(); }
  get tamanho() { return this.mapa.size; }
  /** Junta uma ocorrência (sem gravar). */
  juntar(ch, cliente, sub, de, fonte) {
    if (!chaveValida(ch) || cliente == null || !Number.isFinite(+cliente)) return false;
    let lista = this.mapa.get(ch);
    if (!lista) this.mapa.set(ch, lista = []);
    const atual = lista.find(x => x.cliente === +cliente);
    if (atual) {
      if ((PESO[de] || 0) > (PESO[atual.de] || 0)) Object.assign(atual, { sub: sub || null, de, fonte });
      else return false;
    } else lista.push({ cliente: +cliente, sub: sub || null, de, fonte });
    this.versao++;
    return true;
  }
  /** Uma decisão nova: entra no índice e (persistir) em chaves.jsonl. onde = caminho do arquivo arquivado, se houver. */
  anotar(ch, o, persistir) {
    const d = o.onde ? lerDestino(o.onde, o.raiz) : null;
    const cliente = d ? d.cliente : o.cliente;
    const sub = d ? d.sub : (o.sub || null);
    const de = d ? d.de : (o.de || 'outro');
    const mudou = this.juntar(ch, cliente, sub, de, o.fonte || 'decisão');
    // grava o que ainda não está em nenhum arquivo (manifestos, diário, chaves.jsonl): a decisão em memória vira registro
    const k = ch + '|' + (+cliente);
    if (persistir && this.arquivo && chaveValida(ch) && cliente != null && (mudou || !this.salvas.has(k))) {
      this.salvas.add(k);
      try { fs.mkdirSync(path.dirname(this.arquivo), { recursive: true }); fs.appendFileSync(this.arquivo, JSON.stringify({ ch, cliente: +cliente, sub, de, fonte: o.fonte || 'decisão', em: new Date().toISOString() }) + '\n'); } catch (e) { /* o índice em memória continua valendo */ }
    }
    return mudou;
  }
  /** Os clientes do original: [{ cliente, sub, de }], o mais confiável primeiro (o XML do documento > evento > outro). */
  achar(ch) {
    const l = this.mapa.get(String(ch || ''));
    return l ? l.slice().sort((a, b) => (PESO[b.de] || 0) - (PESO[a.de] || 0)) : [];
  }
}

function linhasJson(arquivo, f) {
  let texto = '';
  try { texto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { return 0; }
  let n = 0;
  for (const l of texto.split(/\r?\n/)) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch (e) { try { r = JSON.parse(l.replace(/\\/g, '/')); } catch (e2) { continue; } }
    n++; f(r);
  }
  return n;
}

/**
 * Monta o índice com o que já está no PC (nada do G: é aberto).
 * opcoes: { controle, manifestoAntigo, raiz } → Indice, com .estatistica { linhas, chaves, ms, porFonte }.
 */
function carregar(opcoes) {
  const t0 = Date.now();
  const controle = opcoes.controle;
  const idx = new Indice(path.join(controle, 'chaves.jsonl'));
  const porFonte = {};
  const conta = f => { porFonte[f] = (porFonte[f] || 0) + 1; };
  const doManifesto = fonte => r => {
    const onde = (String(r.destino_final || '').replace(/\//g, '\\').replace(/\\+$/, '')) + '\\' + String(r.nome_final || '');
    const d = lerDestino(onde, opcoes.raiz);
    if (!d) return;
    const chs = r.chave ? [r.chave] : chavesDoTexto(r.nome_original + ' ' + r.nome_final);
    for (const ch of chs) { if (idx.juntar(ch, d.cliente, d.sub, d.de, fonte)) conta(fonte); idx.salvas.add(ch + '|' + d.cliente); }
  };
  let linhas = 0;
  if (opcoes.manifestoAntigo) linhas += linhasJson(opcoes.manifestoAntigo, doManifesto('manifesto da rotina antiga'));
  linhas += linhasJson(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), doManifesto('manifesto do arquivador novo'));
  // o diário do contínuo: o que foi de fato arquivado ou já estava (modo PRODUCAO), com o caminho
  let diarios = [];
  try { diarios = fs.readdirSync(path.join(controle, 'continuo')).filter(f => /^decisoes-\d{4}-\d{2}\.jsonl$/.test(f)); } catch (e) { /* sem diário */ }
  for (const f of diarios) {
    linhas += linhasJson(path.join(controle, 'continuo', f), r => {
      if (r.modo !== 'PRODUCAO' || !r.onde || !(r.acao === 'ARQUIVAR' || r.acao === 'JA_ARQUIVADO')) return;
      const d = lerDestino(r.onde, opcoes.raiz);
      if (!d) return;
      const chs = r.chave ? [r.chave] : chavesDoTexto(path.win32.basename(String(r.rel || '')));
      for (const ch of chs) { if (idx.juntar(ch, d.cliente, d.sub, d.de, 'diário do contínuo')) conta('diário do contínuo'); idx.salvas.add(ch + '|' + d.cliente); }
    });
  }
  linhas += linhasJson(idx.arquivo, r => { if (idx.juntar(r.ch, r.cliente, r.sub, r.de, r.fonte || 'chaves.jsonl')) conta('chaves.jsonl'); idx.salvas.add(r.ch + '|' + (+r.cliente)); });
  idx.estatistica = { linhas, chaves: idx.tamanho, ms: Date.now() - t0, porFonte };
  return idx;
}

// ---------------------------------------------------------------------------------------------------------------------
// o SIEG pela chave
// ---------------------------------------------------------------------------------------------------------------------
const TIPO_SIEG = { 55: 1, 57: 2, 67: 2, 65: 4 };   // NFe, CTe (CT-e OS junto), NFCe; MDF-e (58) o SIEG não guarda

/**
 * opcoes: { controle, sieg (o módulo robo/sieg.js, ou um falso nos testes: { chamar(c, rota, corpo), lerCredenciais(),
 *   xmlsDaResposta(r), periodo('AAAA-MM') }), limiteDia (200), paginas (por grupo, 6 = 300 XMLs), log }
 * → { buscar(chaves) → Map chave → xml (o original), chamadasHoje(), restantesHoje(), ligado, motivo }
 * Uma chave já perguntada não volta ao SIEG (sieg-chaves.json); o XML achado fica em sieg-originais\<chave>.xml.
 */
function criarBuscaSieg(opcoes) {
  const o = Object.assign({ limiteDia: 200, paginas: 6, log: () => {} }, opcoes);
  const arqEstado = path.join(o.controle, 'sieg-chaves.json');
  const pastaXml = path.join(o.controle, 'sieg-originais');
  let st = { dia: '', chamadas: 0, chaves: {} };
  try { st = Object.assign(st, JSON.parse(fs.readFileSync(arqEstado, 'utf8'))); } catch (e) { /* começa vazio */ }
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const salvar = () => { try { fs.mkdirSync(o.controle, { recursive: true }); fs.writeFileSync(arqEstado + '.tmp', JSON.stringify(st)); fs.renameSync(arqEstado + '.tmp', arqEstado); } catch (e) { o.log('SIEG por chave: não gravei o estado: ' + e.message); } };
  const virar = () => { if (st.dia !== hoje()) { st.dia = hoje(); st.chamadas = 0; } };
  const cred = o.sieg ? o.sieg.lerCredenciais() : { c: null, faltam: ['módulo do SIEG'] };
  const ligado = !!(cred.c && !cred.faltam.length);
  const guardado = ch => { const p = path.join(pastaXml, ch + '.xml'); try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };
  const chaveDoXml = x => ((/Id="(?:NFe|CTe)(\d{44})"/.exec(x)) || (/<ch(?:NFe|CTe)>(\d{44})</.exec(x)) || [])[1] || '';

  /** Só o que já se sabe (sem chamar): Map chave → xml | null (perguntada e não achada) | undefined (nunca perguntada). */
  function jaSabido(ch) { const s = st.chaves[ch]; if (!s) return undefined; return s.achou ? guardado(ch) : null; }

  async function buscar(chaves) {
    virar();
    const out = new Map();
    const grupos = new Map();
    for (const ch of new Set(chaves)) {
      const s = jaSabido(ch);
      if (s !== undefined) { out.set(ch, s); continue; }
      const tipo = chaveValida(ch) ? TIPO_SIEG[ch.slice(20, 22)] : null;   // a NFS-e nacional (50 dígitos) não vai
      if (!tipo) { st.chaves[ch] = { achou: false, em: new Date().toISOString(), porque: 'modelo ' + ch.slice(20, 22) + ' fora do SIEG' }; out.set(ch, null); continue; }
      const k = ch.slice(6, 20) + '|20' + ch.slice(2, 4) + '-' + ch.slice(4, 6) + '|' + tipo;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(ch);
    }
    if (!ligado) { salvar(); return out; }
    for (const [k, lista] of grupos) {
      const [emit, comp, tipo] = k.split('|');
      const faltam = new Set(lista);
      let completo = true;
      for (let pag = 0; pag < o.paginas && faltam.size; pag++) {
        virar();
        if (st.chamadas >= o.limiteDia) { completo = false; break; }
        st.chamadas++;
        let xmls;
        try { xmls = o.sieg.xmlsDaResposta(await o.sieg.chamar(cred.c, 'baixar-xmls', Object.assign({ TipoXml: +tipo, Take: 50, Skip: pag * 50, CnpjEmit: emit, BaixarEventos: false }, o.sieg.periodo(comp)))); }
        catch (e) { o.log('SIEG por chave: ' + e.message); completo = false; break; }
        for (const x of xmls || []) {
          const ch = chaveDoXml(x);
          if (!faltam.has(ch)) continue;
          fs.mkdirSync(pastaXml, { recursive: true });
          fs.writeFileSync(path.join(pastaXml, ch + '.xml'), x);
          st.chaves[ch] = { achou: true, em: new Date().toISOString() };
          out.set(ch, x); faltam.delete(ch);
        }
        if (!xmls || xmls.length < 50) break;
      }
      // perguntou tudo do emitente no mês e não veio: o SIEG não tem (não pergunta de novo); sem resposta completa
      // (limite do dia, erro): fica sem resposta, tenta outro dia
      for (const ch of faltam) if (completo) { st.chaves[ch] = { achou: false, em: new Date().toISOString() }; out.set(ch, null); }
      salvar();
    }
    salvar();
    return out;
  }
  return { buscar, jaSabido, ligado, motivo: ligado ? '' : 'sem as credenciais do SIEG (' + cred.faltam.join(', ') + ')', chamadasHoje: () => (virar(), st.chamadas), restantesHoje: () => (virar(), Math.max(0, o.limiteDia - st.chamadas)), grupoDe: ch => ch.slice(6, 20) + '|' + ch.slice(2, 6) + '|' + (TIPO_SIEG[ch.slice(20, 22)] || '-') };
}

module.exports = { chaveValida, chavesDoTexto, lerDestino, Indice, carregar, criarBuscaSieg, TIPO_SIEG };

if (require.main === module) {
  const A = require('./arquivador-novo');
  const idx = carregar({ controle: A.CONTROLE, manifestoAntigo: path.join(process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio', '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl') });
  console.log(JSON.stringify(idx.estatistica, null, 1));
}
