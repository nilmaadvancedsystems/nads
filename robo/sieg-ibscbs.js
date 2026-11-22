// A conferência do IBS/CBS das notas do SIEG pela calculadora oficial da Receita (21/11/2026: "ligar ao nads as
// calculadoras oficiais da Reforma Tributária"). A calculadora (ReceitaFederal/calculadora-rtc-regime-regular, Java)
// roda neste PC, só para ele (127.0.0.1:18080; ver robo/calculadoras-rtc/LEIAME.md). Depois de cada "Baixar XMLs" do
// SIEG, o robô manda cada NF-e/NFC-e do mês (de 2026 em diante, sem as canceladas) para ela:
//   1. POST /calculadora/xml/validate?tipo=nfe|nfce&subtipo=grupo   o recorte só com os grupos IBSCBS, contra o XSD;
//   2. POST /calculadora/observabilidade/regime-geral               cada item com a base da nota e, de novo, só com os
//                                                                   componentes da base (a base oficial);
// e grava o resumo (as contagens e só as notas divergentes) no próprio siegNotas/{codigo}_{AAAA-MM}, campo ibsCbs, que o
// Fiscal já lê: nenhuma leitura a mais no banco. A regra (ler, montar o pedido, comparar, resumir) é a do core
// (packages/core/src/tarefas/sieg/ibsCbs.ts), pelo robo/gerado/ibscbs.js.
// Sem a calculadora ligada, não faz nada (uma linha no registro) e o Fiscal continua como antes.
const R = require('./gerado/ibscbs');

const URL_PADRAO = 'http://127.0.0.1:18080/api';
const ESPERA_MS = 60000;

/** O texto de um erro da calculadora (o "problem" do Spring: detail, title) ou o corpo cru. */
function motivoDaResposta(texto) {
  try { const j = JSON.parse(texto); return String(j.detail || j.title || j.message || texto).slice(0, 300); } catch { return String(texto || '').slice(0, 300); }
}

/**
 * A calculadora no PC. url: a base (padrão: RTC_URL ou 127.0.0.1:18080/api); buscar: o fetch (os testes passam um falso).
 * Cada função devolve o que o core espera; a calculadora fora do ar vira null (a nota fica "não conferida").
 */
function criarCalculadora({ url = process.env.RTC_URL || URL_PADRAO, buscar = globalThis.fetch } = {}) {
  async function pedir(metodo, rota, corpo, tipo) {
    const r = await buscar(url + rota, {
      method: metodo,
      headers: corpo == null ? { Accept: 'application/json' } : { 'Content-Type': tipo, Accept: 'application/json' },
      body: corpo == null ? undefined : corpo,
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    return { status: r.status, texto: await r.text() };
  }
  return {
    url,
    /** a versão da calculadora (versaoApp, e a da base de dados), ou null se não está no ar */
    async versao() {
      try {
        const r = await pedir('GET', '/calculadora/dados-abertos/versao');
        if (r.status !== 200) return null;
        const j = JSON.parse(r.texto);
        return [j.versaoApp, j.versaoDb && 'base ' + j.versaoDb].filter(Boolean).join(' · ') || 'sem versão';
      } catch { return null; }
    },
    /** o recorte do XML contra o XSD: { valido: true } | { valido: false, mensagem } | null (não respondeu) */
    async validar(tipoXml, xml) {
      try {
        const r = await pedir('POST', '/calculadora/xml/validate?tipo=' + tipoXml + '&subtipo=grupo', xml, 'application/xml');
        if (r.status === 200) return /true/.test(r.texto) ? { valido: true } : { valido: false, mensagem: motivoDaResposta(r.texto) };
        if (r.status === 422 || r.status === 400) return { valido: false, mensagem: motivoDaResposta(r.texto) };
        return null;
      } catch { return null; }
    },
    /**
     * A operação na observabilidade (erro por item, sem derrubar os outros). Um erro da operação inteira (o município,
     * a data) vira a mesma falha em cada item, com o motivo; sem resposta, null.
     */
    async calcular(operacao) {
      try {
        const r = await pedir('POST', '/calculadora/observabilidade/regime-geral', JSON.stringify(operacao), 'application/json');
        if (r.status === 200) return JSON.parse(r.texto);
        if (r.status >= 400 && r.status < 500) {
          const detail = motivoDaResposta(r.texto);
          return { objetos: operacao.itens.map(i => ({ nObj: i.numero, estadoItem: 'FALHA_TECNICA', erros: [{ detail }] })) };
        }
        return null;
      } catch { return null; }
    },
  };
}

/**
 * Confere as notas do mês. arquivos: [{ nome, xml }] (o que o SIEG baixou); cnpj: o do cliente; canceladas: as chaves
 * canceladas (ficam fora). Devolve o resumo (ConferenciaIbsCbs) ou null quando a calculadora não está no ar.
 */
async function conferirMes({ arquivos, cnpj, canceladas = [], calc = criarCalculadora(), aoAndar = () => {}, agora = () => new Date() }) {
  const versao = await calc.versao();
  if (!versao) return null;
  const fora = new Set(canceladas);
  const notas = (arquivos || []).map(a => R.notaParaConferir(a.xml, cnpj)).filter(n => n && !fora.has(n.chave));
  const conferidas = [];
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i];
    aoAndar(i + 1, notas.length);
    const validacao = n.grupoXml ? await calc.validar(n.tipoXml, n.grupoXml) : null;
    const resposta = n.operacao ? await calc.calcular(n.operacao) : null;
    conferidas.push(R.conferirNota(n, resposta, validacao));
  }
  return R.resumoDaConferencia(conferidas, versao, agora().toISOString());
}

/** Uma linha para o registro do robô. */
function linhaDoRegistro(resumo) {
  const c = k => resumo.emitidas[k] + resumo.recebidas[k];
  return c('conferidas') + ' conferidas (' + c('divergentes') + ' com divergência), ' + c('semGrupo') + ' sem o grupo IBSCBS'
    + (c('naoConferidas') ? ', ' + c('naoConferidas') + ' não conferidas' : '')
    + (c('baseDiferente2026') ? ', ' + c('baseDiferente2026') + ' com a base de 2026 diferente (aviso)' : '') + ' — calculadora ' + resumo.versao;
}

const foraDoAr = { avisou: false };

/**
 * Confere e grava no siegNotas do mês (campo ibsCbs). Nunca lança: o download do SIEG já terminou e a conferência é um
 * a mais. id: {codigo}_{AAAA-MM}.
 */
async function conferirEGravar({ db, id, arquivos, cnpj, canceladas, calc = criarCalculadora(), log = () => {} }) {
  try {
    const resumo = await conferirMes({ arquivos, cnpj, canceladas, calc });
    if (!resumo) {
      // uma linha só até ela voltar (a madrugada baixa dezenas de meses)
      if (!foraDoAr.avisou) log('SIEG: IBS/CBS - a calculadora da Receita não está no ar neste PC (' + (calc ? calc.url : URL_PADRAO) + '); as notas seguem sem essa conferência');
      foraDoAr.avisou = true;
      return null;
    }
    foraDoAr.avisou = false;
    // nenhuma NF-e/NFC-e de 2026 em diante no mês: nada a gravar
    if (!Object.values(resumo.emitidas).concat(Object.values(resumo.recebidas)).some(Boolean)) return resumo;
    await db.collection('siegNotas').doc(id).update({ ibsCbs: resumo });
    log('SIEG: IBS/CBS de', id, '-', linhaDoRegistro(resumo));
    return resumo;
  } catch (err) {
    log('SIEG: IBS/CBS de', id, '- não consegui conferir ou gravar (' + (err && err.message || err) + ')');
    return null;
  }
}

module.exports = { criarCalculadora, conferirMes, conferirEGravar, linhaDoRegistro, motivoDaResposta, URL_PADRAO };
