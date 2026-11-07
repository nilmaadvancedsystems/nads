// O cliente da API do ePlugin do eContador (07/11/2026), pronto e DESLIGADO: só vale com config/econtador.api.ligado e o
// token na variável de ambiente ECONTADOR_TOKEN (no servidor, o cofre/variável do Windows; na VM, o Secret Manager). O
// token nunca vem do git nem do banco, e nunca vai para o log nem para a mensagem de erro.
//
// O que a documentação oficial diz (https://ajuda.alterdata.com.br/alterdatapackup/eplugin-242505358.html,
// https://ajuda.alterdata.com.br/alterdatapackup/integracao-econtador/token e a referência https://eplugin.pack.alterdata.com.br/):
//   - só o pacote eContador Master (ou o Plus de quem comprou antes da mudança); o token se gera em Configurações ›
//     Configurações › ePlugin / Chave de Acesso › Gerar; é um JWT;
//   - authorization: Bearer <token>; o corpo em JSON:API com content-type application/vnd.api+json (application/json o
//     servidor não trata); base https://dp.pack.alterdata.com.br;
//   - documentos: só CONSULTA (GET /api/v1/integracao/documentos com filter[empresaId], e /{id}; as categorias em
//     /api/v1/integracao/categoria-documento com filter[login]) — os que o escritório publicou, inclusive pelo UpDocs;
//   - o único envio de arquivo documentado é POST /api/v1/integracao/integracaoAlterdata (o TXT de lançamentos
//     contábeis em base64, categoriaId 1, cnpjremetente) — NÃO serve para guia nem recibo.
// Por isso a API aqui é para CONFERIR que a guia que a pasta do UpDocs mandou chegou no eContador (documentoDaGuia), e
// não para subir a guia.
const BASE = 'https://dp.pack.alterdata.com.br';
const JSON_API = 'application/vnd.api+json';

/** O token do ambiente (ECONTADOR_TOKEN), ou null. Nunca lê arquivo. */
function tokenDoAmbiente(ambiente = process.env) {
  const t = String((ambiente && ambiente.ECONTADOR_TOKEN) || '').trim();
  return t || null;
}

/** ?filter[empresaId]=1&page[limit]=50 (sem os vazios) */
function consulta(params) {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&') : '';
}

/** Tira o token de qualquer texto (a resposta de erro pode ecoar o cabeçalho). */
function semToken(t, token) {
  let s = String(t || '');
  if (token) s = s.split(token).join('***');
  return s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***').slice(0, 300);
}

/**
 * O cliente. opcoes: { token, fetch, base, timeoutMs }. Os métodos devolvem o JSON:API da resposta ({ data, meta, links }).
 */
function criarCliente({ token, fetch: buscar = globalThis.fetch, base = BASE, timeoutMs = 30000 } = {}) {
  if (!token) throw new Error('sem o token do eContador (a variável ECONTADOR_TOKEN no servidor)');
  if (typeof buscar !== 'function') throw new Error('sem fetch neste Node');
  async function pedir(metodo, caminho, { params, corpo } = {}) {
    const headers = { authorization: 'Bearer ' + token, accept: JSON_API };
    if (corpo !== undefined) headers['content-type'] = JSON_API;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const relogio = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    let r;
    try {
      r = await buscar(base + caminho + consulta(params), { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: ctrl ? ctrl.signal : undefined });
    } catch (err) {
      throw new Error('eContador fora do ar em ' + metodo + ' ' + caminho + ': ' + semToken(err.message, token));
    } finally { if (relogio) clearTimeout(relogio); }
    const bruto = await r.text();
    if (!r.ok) {
      const dica = r.status === 401 || r.status === 403 ? ' (token inválido, vencido ou sem o pacote Master)' : '';
      throw new Error('eContador respondeu ' + r.status + dica + ' em ' + metodo + ' ' + caminho + ': ' + semToken(bruto, token));
    }
    if (!bruto) return {};
    try { return JSON.parse(bruto); } catch (e) { throw new Error('eContador devolveu algo que não é JSON em ' + metodo + ' ' + caminho); }
  }
  const pagina = (offset, limit) => ({ 'page[offset]': offset, 'page[limit]': limit });
  return {
    /** GET /api/v1/empresas: as empresas do escritório no eContador */
    empresas: ({ offset, limit } = {}) => pedir('GET', '/api/v1/empresas', { params: pagina(offset, limit) }),
    /** GET /api/v1/integracao/empresas/{id} */
    empresa: id => pedir('GET', '/api/v1/integracao/empresas/' + encodeURIComponent(String(id))),
    /** GET /api/v1/integracao/documentos: os documentos publicados para a empresa (filtros: os filter[...] da referência) */
    documentos: (empresaId, { offset, limit, filtros } = {}) => {
      if (empresaId === undefined || empresaId === null || empresaId === '') throw new Error('a consulta de documentos pede a empresa (filter[empresaId])');
      const f = Object.fromEntries(Object.entries(filtros || {}).map(([k, v]) => ['filter[' + k + ']', v]));
      return pedir('GET', '/api/v1/integracao/documentos', { params: { 'filter[empresaId]': empresaId, ...f, ...pagina(offset, limit) } });
    },
    /** GET /api/v1/integracao/documentos/{id} */
    documento: (id, empresaId) => pedir('GET', '/api/v1/integracao/documentos/' + encodeURIComponent(String(id)), { params: { 'filter[empresaId]': empresaId } }),
    /** GET /api/v1/integracao/categoria-documento (filter[login] obrigatório) */
    categorias: login => pedir('GET', '/api/v1/integracao/categoria-documento', { params: { 'filter[login]': login } }),
    /**
     * POST /api/v1/integracao/integracaoAlterdata: o TXT de lançamentos contábeis (o layout do Contábil Windows). O único
     * envio de arquivo da referência; guia e recibo não vão por aqui.
     */
    enviarLancamentosContabeis: ({ nomeArquivo, categoriaId = 1, cnpj, buffer }) => {
      const doc = String(cnpj || '').replace(/[^0-9a-z]/gi, '');
      if (doc.length !== 14) throw new Error('o CNPJ do remetente tem de ter 14 caracteres');
      if (!/\.txt$/i.test(String(nomeArquivo || ''))) throw new Error('a integração contábil só aceita o TXT de lançamentos');
      return pedir('POST', '/api/v1/integracao/integracaoAlterdata', {
        corpo: { data: { type: 'integracao/integracaoAlterdata', attributes: { documento: String(nomeArquivo), categoriaId: Number(categoriaId), cnpjremetente: doc, arquivoBase64: Buffer.from(buffer).toString('base64') } } },
      });
    },
  };
}

/**
 * O cliente só quando a configuração liga E o token está no ambiente; senão null (com o motivo em .motivo do retorno de
 * clienteSeLigado). cfg: configDoEcontador(...) de econtador.js.
 */
function clienteSeLigado(cfg, { ambiente = process.env, fetch: buscar } = {}) {
  if (!cfg || !cfg.api || cfg.api.ligado !== true) return { cliente: null, motivo: 'a API do eContador está desligada (config/econtador.api.ligado)' };
  const token = tokenDoAmbiente(ambiente);
  if (!token) return { cliente: null, motivo: 'falta o token do eContador (ECONTADOR_TOKEN no ambiente do servidor)' };
  return { cliente: criarCliente({ token, fetch: buscar }), motivo: '' };
}

/** "2026-11-20", "20/11/2026", "2026-11-20T03:00:00Z" -> "2026-11-20" ('' se não for data) */
function diaIso(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

/**
 * A guia entre os documentos do eContador (o data do JSON:API): o mesmo vencimento e o mesmo valor (diferença de até 1
 * centavo); com titulo, o título tem de conter a palavra (DAS, FGTS…). null quando não achou.
 */
function documentoDaGuia(lista, { vencimento, valor, titulo } = {}) {
  const dia = diaIso(vencimento);
  const v = typeof valor === 'number' ? valor : null;
  const palavra = String(titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  for (const d of Array.isArray(lista) ? lista : []) {
    const a = (d && d.attributes) || {};
    if (dia && diaIso(a.vencimento) !== dia) continue;
    if (v !== null && !(typeof a.valor === 'number' && Math.abs(a.valor - v) <= 0.01)) continue;
    if (palavra && !String(a.titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().includes(palavra)) continue;
    if (!dia && v === null && !palavra) continue;
    return d;
  }
  return null;
}

module.exports = { criarCliente, clienteSeLigado, tokenDoAmbiente, documentoDaGuia, diaIso, consulta, semToken, BASE, JSON_API };
