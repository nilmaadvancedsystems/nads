// O Integra NET da SCI (24/11/2026): mandar ao SCI os XMLs que o SIEG já baixa e conferir o mês. Funções puras; quem fala
// com a API é o integraNetCliente.ts (com o "buscar" de fora). A API (portal-dev.sci.com.br, OpenAPI de 06/11/2026):
//   - toda chamada leva `Service-Token: <Token de Parceiro>` e `Authorization: Bearer <Token de Cliente>` (sem o JWT);
//   - envio: POST {base}/{nfe|nfce|cfe|cte|nfse} { cnpj, nomeArquivo: [...] } → { nome: URL pré-assinada } e o PUT do arquivo
//     nela; o nome tem de terminar em .xml; o cancelamento que vem num evento à parte vai DEPOIS da nota;
//   - consulta: GET {base}/{tipo}/{entrada|saida}?empresaId&dataIni&dataFim (DD-MM-YYYY)&page → lista de URLs (o arquivo
//     tem a chave de acesso no nome); 404 = nada no filtro;
//   - 403 "A empresa informada não possui licença do Integra NET vinculada": a licença é por empresa.

export const INTEGRA_NET = 'https://api-integranet.sci.com.br/api';
/** quantos nomes por pedido de URLs (a API não diz o limite; lotes pequenos não perdem tudo num erro) */
export const INTEGRA_POR_LOTE = 50;

export type TipoNoIntegra = 'nfe' | 'nfce' | 'cfe' | 'cte' | 'nfse';
export const TIPOS_NO_INTEGRA: TipoNoIntegra[] = ['nfe', 'nfce', 'cfe', 'cte', 'nfse'];

/** A chave de acesso de 44 dígitos de uma NF-e, NFC-e, CT-e ou CF-e (do Id, ou do chNFe/chCTe do evento); '' se não tem. */
export function chaveDoXml(xml: string): string {
  const m = /Id="(?:NFe|CTe|CFe)(\d{44})"/.exec(xml) || /<(?:\w+:)?ch(?:NFe|CTe|CFe)>(\d{44})</.exec(xml);
  return m ? m[1] : '';
}

/** O tipo no Integra NET pelo XML (o modelo na chave: 55 NF-e, 65 NFC-e, 57/67 CT-e, 59 CF-e; a NFS-e pelas tags); null se não serve. */
export function tipoNoIntegra(xml: string): TipoNoIntegra | null {
  const chave = chaveDoXml(xml);
  if (chave) return ({ 55: 'nfe', 65: 'nfce', 57: 'cte', 67: 'cte', 59: 'cfe' } as Record<string, TipoNoIntegra>)[chave.slice(20, 22)] ?? null;
  if (/<(?:\w+:)?(?:NFSe|CompNfse|Nfse|InfNfse|infNFSe)[\s>]/.test(xml) || /<(?:\w+:)?chNFSe>/.test(xml)) return 'nfse';
  return null;
}

/** É um evento (cancelamento e afins)? Vai depois das notas, como a SCI pede. */
export const ehEventoDoXml = (xml: string) => /<(?:\w+:)?tpEvento>/.test(xml) || /<(?:\w+:)?infPedReg[\s>]/.test(xml);

/** O nome que o Integra NET aceita: só letras, números, ponto, hífen e sublinhado, terminando em .xml. */
export function nomeNoIntegra(nome: string, xml: string): string {
  const base = String(nome ?? '').replace(/\.xml$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 120);
  return (base || chaveDoXml(xml) || 'documento') + '.xml';
}

export interface XmlParaEnviar { nome: string; xml: string; tipo: TipoNoIntegra; chave: string; evento: boolean }

/**
 * Os XMLs do mês como vão: só os tipos que o Integra NET aceita, sem repetir o nome, sem os que já foram (pela chave ou pelo
 * nome em `jaForam`), as notas antes dos eventos; e por tipo, em lotes de INTEGRA_POR_LOTE.
 */
export function xmlsParaEnviar(arquivos: { nome: string; xml: string }[], jaForam: Iterable<string> = []): { lotes: { tipo: TipoNoIntegra; itens: XmlParaEnviar[] }[]; ignorados: number } {
  const ja = new Set(jaForam);
  const vistos = new Set<string>();
  const itens: XmlParaEnviar[] = [];
  let ignorados = 0;
  for (const a of arquivos) {
    const tipo = tipoNoIntegra(a.xml);
    const nome = nomeNoIntegra(a.nome, a.xml);
    const chave = chaveDoXml(a.xml);
    const evento = ehEventoDoXml(a.xml);
    const marca = evento ? nome : chave || nome;
    if (!tipo || vistos.has(nome)) { ignorados++; continue; }
    vistos.add(nome);
    if (ja.has(marca)) continue;
    itens.push({ nome, xml: a.xml, tipo, chave, evento });
  }
  const ordem = (x: XmlParaEnviar) => TIPOS_NO_INTEGRA.indexOf(x.tipo) * 2 + (x.evento ? 1 : 0);
  itens.sort((a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome));
  const lotes: { tipo: TipoNoIntegra; itens: XmlParaEnviar[] }[] = [];
  for (const x of itens) {
    const ultimo = lotes[lotes.length - 1];
    if (ultimo && ultimo.tipo === x.tipo && ultimo.itens.length < INTEGRA_POR_LOTE && ultimo.itens[0].evento === x.evento) ultimo.itens.push(x);
    else lotes.push({ tipo: x.tipo, itens: [x] });
  }
  return { lotes, ignorados };
}

/** A marca de um XML enviado (o que vai para `jaForam` da próxima vez): a chave da nota, ou o nome do evento. */
export const marcaDoEnviado = (x: Pick<XmlParaEnviar, 'chave' | 'nome' | 'evento'>) => (x.evento ? x.nome : x.chave || x.nome);

/** 'aaaa-mm' → { dataIni, dataFim } no formato da consulta (DD-MM-YYYY), do dia 1 ao último dia do mês. */
export function periodoNoIntegra(competencia: string): { dataIni: string; dataFim: string } {
  const [a, m] = competencia.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { dataIni: '01-' + mm + '-' + a, dataFim: String(ultimo).padStart(2, '0') + '-' + mm + '-' + a };
}

/** As URLs da consulta → as chaves de acesso (o nome do arquivo, antes do .xml e da assinatura). */
export function chavesDasUrls(resposta: unknown): string[] {
  const lista = Array.isArray(resposta) ? resposta : [];
  const chaves = new Set<string>();
  for (const u of lista) {
    const m = /(\d{44})\.xml(?:[?#]|$)/i.exec(String(u ?? ''));
    if (m) chaves.add(m[1]);
  }
  return [...chaves];
}

/** O mês conferido: o que está no SIEG e falta no SCI, e o que está no SCI e o SIEG não tem. */
export interface ConferenciaDoIntegra { noSieg: number; noSci: number; faltamNoSci: string[]; soNoSci: string[] }

export function conferirComOSci(chavesDoSieg: Iterable<string>, chavesDoSci: Iterable<string>, canceladas: Iterable<string> = []): ConferenciaDoIntegra {
  const fora = new Set(canceladas);
  const sieg = new Set([...chavesDoSieg].filter(c => /^\d{44}$/.test(c) && !fora.has(c)));
  const sci = new Set([...chavesDoSci].filter(c => /^\d{44}$/.test(c)));
  return {
    noSieg: sieg.size, noSci: sci.size,
    faltamNoSci: [...sieg].filter(c => !sci.has(c)).sort(),
    soNoSci: [...sci].filter(c => !sieg.has(c) && !fora.has(c)).sort(),
  };
}

/** O que fica no resumo do mês (siegNotas/{codigo}_{AAAA-MM}.sci): números e no máximo 50 chaves de cada lado. */
export interface ResumoDoIntegra {
  em: string;
  enviadas: number;
  falhas: number;
  /** a última mensagem de falha (sem token) */
  erro: string;
  conferido: boolean;
  faltamNoSci: number;
  soNoSci: number;
  chavesFaltam: string[];
  chavesSobram: string[];
}

export function resumoDoIntegra(p: { agora: Date; enviadas: number; falhas: number; erro?: string; conferencia?: ConferenciaDoIntegra | null }): ResumoDoIntegra {
  const c = p.conferencia ?? null;
  return {
    em: p.agora.toISOString(), enviadas: p.enviadas, falhas: p.falhas, erro: String(p.erro ?? '').slice(0, 200),
    conferido: !!c, faltamNoSci: c ? c.faltamNoSci.length : 0, soNoSci: c ? c.soNoSci.length : 0,
    chavesFaltam: c ? c.faltamNoSci.slice(0, 50) : [], chavesSobram: c ? c.soNoSci.slice(0, 50) : [],
  };
}

/** O resumo como a tela lê do banco (o que vier torto some; sem ele, null). */
export function lerResumoDoIntegra(v: unknown): ResumoDoIntegra | null {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  if (!o || typeof o.em !== 'string') return null;
  const n = (k: string) => (Number.isFinite(Number(o[k])) ? Math.max(0, Math.trunc(Number(o[k]))) : 0);
  const chaves = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).map(String).filter(c => /^\d{44}$/.test(c)).slice(0, 50) : []);
  return {
    em: o.em, enviadas: n('enviadas'), falhas: n('falhas'), erro: typeof o.erro === 'string' ? o.erro.slice(0, 200) : '', conferido: o.conferido === true,
    faltamNoSci: n('faltamNoSci'), soNoSci: n('soNoSci'), chavesFaltam: chaves('chavesFaltam'), chavesSobram: chaves('chavesSobram'),
  };
}

/** A frase do resumo para a tela do Fiscal ("SCI: 214 enviadas · faltam 3"). */
export function fraseDoIntegra(r: ResumoDoIntegra | null | undefined): string {
  if (!r) return '';
  const partes = ['SCI: ' + r.enviadas + (r.enviadas === 1 ? ' enviada' : ' enviadas')];
  if (r.falhas) partes.push(r.falhas + (r.falhas === 1 ? ' falhou' : ' falharam'));
  if (r.conferido) partes.push(r.faltamNoSci ? 'faltam ' + r.faltamNoSci + ' no SCI' : 'tudo no SCI');
  if (r.conferido && r.soNoSci) partes.push(r.soNoSci + ' só no SCI');
  return partes.join(' · ');
}
