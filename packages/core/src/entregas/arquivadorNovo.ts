// O arquivador novo no site do admin (Admin › Arquivador; Vitor, 22/10/2026: "se possível algo bem visual", "eu preciso
// de um feedback melhor dele" e "quero uma só para ele e bem organizada"). O que o robô do PC publica
// (robo/arquivador-acompanhamento.js):
//   robo/arquivadorNovo.painel   o modo e o config em vigor, a pasta Claudio Secretario (chegando, na fila, sendo lidos,
//                                parados), a passada (feitos de total), o ritmo, as contagens do dia e do mês, os últimos
//                                arquivos com o porquê, os não identificados com o motivo e a sugestão, os erros com o que
//                                fazer, os alertas de agora e o último lado a lado com a rotina antiga.
//   robo/arquivadorNovo/dias/{AAAA-MM-DD}-{n}   o histórico do dia, em partes ({ dia, parte, em, itens }).
// Aqui só a leitura e as contas (o resumo do dia em palavras, o progresso, os grupos de tipo); quem lê o banco é o
// repositório da tela.

export type AcaoDoArquivador = 'arquivou' | 'arquivaria' | 'jaArquivado' | 'naoIdentificado' | 'fica' | 'erro';

/** Um arquivo decidido: o que era, o que o robô fez, para onde foi e por quê. */
export interface ItemDoArquivador {
  id: string; em: string; nome: string; rel: string; acao: AcaoDoArquivador;
  tipo: string; cliente: string; clienteNome: string;
  /** 0 a 100, ou null quando não se aplica */
  confianca: number | null;
  /** o destino a partir da pasta do ano (380 - CLIENTE\CONTÁBIL\…\arquivo.pdf) */
  destino: string; nomeFinal: string; copias: string[]; pastaNova: string;
  /** o porquê, em português */
  evidencias: string[];
  ocr: { confianca: number | null; segundos: number | null; erro: string } | null;
  dentroDe: string;
  /** NÃO IDENTIFICADO / fica na pasta */
  motivo: string; motivoTexto: string; sugestao: string; destinoSugerido: string;
  /** erro */
  erro: string; erroTipo: string; erroTitulo: string; oQueFazer: string;
  naoAplicado: string;
  /** os não identificados: o hash que o robô confere nos pedidos e o caminho na pasta Claudio Secretario */
  hash: string; naPasta: string;
}

export interface ClienteDaContagem { codigo: string; nome: string; n: number }
export interface ContagemDoArquivador {
  chave: string;
  porAcao: Record<AcaoDoArquivador, number>;
  porTipo: Record<string, number>;
  porMotivo: Record<string, number>;
  pastasNovas: string[];
  clientes: ClienteDaContagem[];
  totalDeClientes: number;
}
/** original = evento esperando o documento original (índice de chaves do arquivador, 23/10/2026) */
export type SituacaoNaPasta = 'chegando' | 'fila' | 'lendo' | 'original';
export interface ArquivoNaPasta { nome: string; rel: string; tam: number; desde: string; situacao: SituacaoNaPasta }
export interface PastaDoArquivador { naPasta: number; chegando: number; naFila: number; sendoLidos: number; parados: number; esperandoOriginal: number; lista: ArquivoNaPasta[] }
export interface PassadaDoArquivador { inicio: string; feitos: number; total: number; fim: string }
export interface ConfigDoArquivador {
  modo: 'producao' | 'simulacao' | 'desligado' | ''; emProducao: boolean; tiposProducao: string[]; moverNaoIdentificados: boolean; botaoRotinaAntiga: boolean;
  intervaloMs: number | null; estavelMs: number | null; lote: number | null;
}
export interface AlertaDoArquivador { tipo: string; tom: 'erro' | 'aviso'; titulo: string; texto: string; oQueFazer: string }
export interface ExemploDoLadoALado { tipo: string; nome: string; antigo: string; novo: string }
export interface LadoALado {
  dia: string; rotinaArquivou: number; iguais: number; pastaIgualNomeDiferente: number; diferentes: number; novoNaoIdentificou: number; novoNaoViu: number;
  exemplos: ExemploDoLadoALado[];
}
export interface PainelDoArquivador {
  em: string; maquina: string; config: ConfigDoArquivador | null;
  /** ok | sem-drive | esperando */
  situacao: string; esperando: string;
  pasta: PastaDoArquivador | null; passada: PassadaDoArquivador | null;
  /** decisões por minuto (últimos 10 min) */
  ritmo: number;
  hoje: ContagemDoArquivador; mes: ContagemDoArquivador;
  ultimos: ItemDoArquivador[]; pendentes: ItemDoArquivador[]; erros: ItemDoArquivador[];
  /** quantos estão hoje em NÃO IDENTIFICADOS (a lista mostra até 80) */
  pendentesTotal?: number;
  alertas: AlertaDoArquivador[];
  ladoALado: LadoALado | null;
  historico: { dia: string; partes: number; itens: number };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const numOuNulo = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map(txt).filter(Boolean) : []);
const ACOES: readonly AcaoDoArquivador[] = ['arquivou', 'arquivaria', 'jaArquivado', 'naoIdentificado', 'fica', 'erro'];

/** Um item como veio do banco. */
export function lerItemDoArquivador(d: Obj): ItemDoArquivador {
  const o = d.ocr ? obj(d.ocr) : null;
  const acao = ACOES.includes(d.acao as AcaoDoArquivador) ? (d.acao as AcaoDoArquivador) : 'fica';
  return {
    id: txt(d.id) || txt(d.em) + txt(d.rel), em: txt(d.em), nome: txt(d.nome) || txt(d.rel).split(/[\\/]/).pop() || '', rel: txt(d.rel), acao,
    tipo: txt(d.tipo), cliente: txt(d.cliente), clienteNome: txt(d.clienteNome), confianca: numOuNulo(d.confianca),
    destino: txt(d.destino), nomeFinal: txt(d.nomeFinal), copias: textos(d.copias), pastaNova: txt(d.pastaNova), evidencias: textos(d.evidencias),
    ocr: o ? { confianca: numOuNulo(o.confianca), segundos: numOuNulo(o.segundos), erro: txt(o.erro) } : null, dentroDe: txt(d.dentroDe),
    motivo: txt(d.motivo), motivoTexto: txt(d.motivoTexto), sugestao: txt(d.sugestao), destinoSugerido: txt(d.destinoSugerido),
    erro: txt(d.erro), erroTipo: txt(d.erroTipo), erroTitulo: txt(d.erroTitulo), oQueFazer: txt(d.oQueFazer), naoAplicado: txt(d.naoAplicado),
    hash: txt(d.hash), naPasta: txt(d.naPasta),
  };
}

function lerContagem(v: unknown): ContagemDoArquivador {
  const d = obj(v);
  const pa = obj(d.porAcao);
  const mapa = (m: unknown) => Object.fromEntries(Object.entries(obj(m)).map(([k, n]) => [k, num(n)]).filter(([, n]) => (n as number) > 0));
  return {
    chave: txt(d.chave),
    porAcao: Object.fromEntries(ACOES.map(a => [a, num(pa[a])])) as Record<AcaoDoArquivador, number>,
    porTipo: mapa(d.porTipo), porMotivo: mapa(d.porMotivo), pastasNovas: textos(d.pastasNovas),
    clientes: lista(d.clientes).map(c => ({ codigo: txt(c.codigo), nome: txt(c.nome), n: num(c.n) })).filter(c => c.codigo),
    totalDeClientes: num(d.totalDeClientes),
  };
}

/** O documento robo/arquivadorNovo como veio do banco (null sem o painel: o robô ainda não foi atualizado). */
export function lerPainelDoArquivador(doc: Obj | null | undefined): PainelDoArquivador | null {
  const d = doc && doc.painel ? obj(doc.painel) : null;
  if (!d) return null;
  const c = d.config ? obj(d.config) : null;
  const p = d.pasta ? obj(d.pasta) : null;
  const ps = d.passada ? obj(d.passada) : null;
  const l = d.ladoALado ? obj(d.ladoALado) : null;
  const modo = txt(c?.modo);
  const h = obj(d.historico);
  return {
    em: txt(d.em), maquina: txt(d.maquina),
    config: c ? {
      modo: modo === 'producao' || modo === 'simulacao' || modo === 'desligado' ? modo : '', emProducao: !!c.emProducao, tiposProducao: textos(c.tiposProducao),
      moverNaoIdentificados: !!c.moverNaoIdentificados, botaoRotinaAntiga: !!c.botaoRotinaAntiga, intervaloMs: numOuNulo(c.intervaloMs), estavelMs: numOuNulo(c.estavelMs), lote: numOuNulo(c.lote),
    } : null,
    situacao: txt(d.situacao) || 'ok', esperando: txt(d.esperando),
    pasta: p ? {
      naPasta: num(p.naPasta), chegando: num(p.chegando), naFila: num(p.naFila), sendoLidos: num(p.sendoLidos), parados: num(p.parados), esperandoOriginal: num(p.esperandoOriginal),
      lista: lista(p.lista).map(x => ({ nome: txt(x.nome), rel: txt(x.rel), tam: num(x.tam), desde: txt(x.desde), situacao: (['chegando', 'fila', 'lendo', 'original'].includes(txt(x.situacao)) ? txt(x.situacao) : 'fila') as SituacaoNaPasta })),
    } : null,
    passada: ps ? { inicio: txt(ps.inicio), feitos: num(ps.feitos), total: num(ps.total), fim: txt(ps.fim) } : null,
    ritmo: num(d.ritmo),
    hoje: lerContagem(d.hoje), mes: lerContagem(d.mes),
    ultimos: lista(d.ultimos).map(lerItemDoArquivador), pendentes: lista(d.pendentes).map(lerItemDoArquivador), erros: lista(d.erros).map(lerItemDoArquivador),
    pendentesTotal: typeof d.pendentesTotal === 'number' ? d.pendentesTotal : lista(d.pendentes).length,
    alertas: lista(d.alertas).map(a => ({ tipo: txt(a.tipo), tom: a.tom === 'erro' ? 'erro' as const : 'aviso' as const, titulo: txt(a.titulo), texto: txt(a.texto), oQueFazer: txt(a.oQueFazer) })).filter(a => a.titulo),
    ladoALado: l ? {
      dia: txt(l.dia), rotinaArquivou: num(l.rotinaArquivou), iguais: num(l.iguais), pastaIgualNomeDiferente: num(l.pastaIgualNomeDiferente), diferentes: num(l.diferentes),
      novoNaoIdentificou: num(l.novoNaoIdentificou), novoNaoViu: num(l.novoNaoViu),
      exemplos: lista(l.exemplos).map(e => ({ tipo: txt(e.tipo), nome: txt(e.nome), antigo: txt(e.antigo), novo: txt(e.novo) })),
    } : null,
    historico: { dia: txt(h.dia), partes: num(h.partes), itens: num(h.itens) },
  };
}

/** Uma parte do histórico do dia (robo/arquivadorNovo/dias/{dia}-{n}). */
export function lerParteDoDia(d: Obj | null | undefined): { dia: string; parte: number; itens: ItemDoArquivador[] } {
  const x = obj(d);
  return { dia: txt(x.dia), parte: num(x.parte), itens: lista(x.itens).map(lerItemDoArquivador) };
}

// ---------------------------------------------------------------------------------------------------------------------
// as contas da tela
// ---------------------------------------------------------------------------------------------------------------------
/** a logo do órgão (as das guias que já existem no nads) ou o ícone, para cada grupo de tipo */
export type MarcaDoTipo = 'simples' | 'receita' | 'fgts' | 'minas' | null;
/**
 * marca: a logo do órgão; senão formato: o ícone do arquivo (o IconeDeArquivo do @nads/ui: 'XML', 'TXT', 'XLSX'); senão
 * icone: um ícone do nads (NomeIcone do @nads/ui).
 */
export interface GrupoDoTipo { id: string; rotulo: string; marca: MarcaDoTipo; formato: 'XML' | 'TXT' | 'XLSX' | null; icone: string }

const GRUPOS: readonly (readonly [RegExp, GrupoDoTipo])[] = [
  [/^XML NF-e/i, { id: 'xml-nfe', rotulo: 'XML NF-e', marca: null, formato: 'XML', icone: 'fileText' }],
  [/^XML NFC-e/i, { id: 'xml-nfce', rotulo: 'XML NFC-e', marca: null, formato: 'XML', icone: 'fileText' }],
  [/^XML CT-e/i, { id: 'xml-cte', rotulo: 'XML CT-e', marca: null, formato: 'XML', icone: 'fileText' }],
  [/^XML NFS-e/i, { id: 'xml-nfse', rotulo: 'XML NFS-e', marca: null, formato: 'XML', icone: 'fileText' }],
  [/^XML/i, { id: 'xml', rotulo: 'XML (outros)', marca: null, formato: 'XML', icone: 'fileText' }],
  [/^NFC-e/i, { id: 'nfce', rotulo: 'NFC-e (PDF)', marca: null, formato: null, icone: 'recibo' }],
  [/^NF-e|^NFS-e|^CT-e/i, { id: 'nota', rotulo: 'Nota fiscal (PDF)', marca: null, formato: null, icone: 'recibo' }],
  [/^EXTRATO/i, { id: 'extrato', rotulo: 'Extrato bancário', marca: null, formato: null, icone: 'landmark' }],
  [/^COMPROVANTE/i, { id: 'comprovante', rotulo: 'Comprovante', marca: null, formato: null, icone: 'checkCircle' }],
  [/^APLICACOES|^FATURA CARTAO|^MAQUININHAS|^RECEBIMENTO/i, { id: 'financeiro', rotulo: 'Cartões, aplicações e recebimentos', marca: null, formato: null, icone: 'dinheiro' }],
  [/^DAS\b|^DEFIS/i, { id: 'das', rotulo: 'DAS e DEFIS (Simples)', marca: 'simples', formato: null, icone: 'recibo' }],
  [/^DARF|^DIRF|^ECF|^CARTAO CNPJ/i, { id: 'darf', rotulo: 'DARF e Receita Federal', marca: 'receita', formato: null, icone: 'recibo' }],
  [/^FGTS/i, { id: 'fgts', rotulo: 'FGTS', marca: 'fgts', formato: null, icone: 'recibo' }],
  [/^DAE/i, { id: 'dae', rotulo: 'DAE (Minas)', marca: 'minas', formato: null, icone: 'recibo' }],
  [/^SPED|^SINTEGRA|^LIVRO/i, { id: 'sped', rotulo: 'SPED, Sintegra e livros', marca: null, formato: 'TXT', icone: 'fileText' }],
  [/^BALANCETE|^RELATORIO|^PLANILHA/i, { id: 'contabil', rotulo: 'Balancetes e relatórios', marca: null, formato: 'XLSX', icone: 'barChart' }],
  [/^FOLHA/i, { id: 'folha', rotulo: 'Folha de pagamento', marca: null, formato: null, icone: 'usuario' }],
];
const OUTROS: GrupoDoTipo = { id: 'outros', rotulo: 'Outros documentos', marca: null, formato: null, icone: 'arquivo' };

/** O grupo de um tipo das regras (XML NF-e, EXTRATO, DAS…) para o gráfico por tipo. */
export function grupoDoTipo(tipo: string): GrupoDoTipo {
  for (const [re, g] of GRUPOS) if (re.test(tipo || '')) return g;
  return OUTROS;
}

export interface BarraDoTipo extends GrupoDoTipo { n: number; tipos: string[] }
/** As barras por tipo: os tipos das regras juntos no grupo, o maior primeiro. */
export function barrasPorTipo(porTipo: Readonly<Record<string, number>>): BarraDoTipo[] {
  const m = new Map<string, BarraDoTipo>();
  for (const [tipo, n] of Object.entries(porTipo)) {
    const g = grupoDoTipo(tipo);
    const b = m.get(g.id) || { ...g, n: 0, tipos: [] };
    b.n += n;
    if (!b.tipos.includes(tipo)) b.tipos.push(tipo);
    m.set(g.id, b);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo));
}

/** "1.240" */
const mil = (n: number) => n.toLocaleString('pt-BR');
const plural = (n: number, um: string, varios: string) => mil(n) + ' ' + (n === 1 ? um : varios);

/** O motivo no plural para o resumo ("5 sem CNPJ cadastrado", "3 com duas empresas possíveis"). */
const NO_RESUMO: Record<string, string | readonly [string, string]> = {
  CLIENTE_NAO_LOCALIZADO: 'sem CNPJ cadastrado', CLIENTE_AMBIGUO: 'com duas empresas possíveis', CONTEUDO_SEM_TEXTO: ['escaneado sem leitura', 'escaneados sem leitura'],
  CONTEUDO_ILEGIVEL: ['escaneado ilegível', 'escaneados ilegíveis'], CONFIANCA_ABAIXO_DO_LIMIAR: 'com pouca certeza', COMPETENCIA_AUSENTE: 'sem a competência',
  TIPO_NAO_RECONHECIDO: 'de tipo desconhecido', FORMATO_SEM_REGRA: 'em formato sem regra', PDF_COMPOSTO_NAO_SEPARADO: ['PDF com vários documentos', 'PDFs com vários documentos'],
  BANCO_AUSENTE: 'sem o banco', VOCABULARIO_AUSENTE: 'com dado faltando', ARQUIVO_INACESSIVEL: ['travado', 'travados'],
};
const noResumo = (m: string, n: number) => { const r = NO_RESUMO[m]; return typeof r === 'string' ? r : r ? r[n === 1 ? 0 : 1] : m.toLowerCase().replace(/_/g, ' '); };
function listaEmPalavras(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
}

/**
 * O resumo do dia em linguagem simples (o topo da página): "Hoje arquivei 312 arquivos de 41 clientes. 9 ficaram para
 * você resolver (5 sem CNPJ cadastrado, 3 com duas empresas possíveis, 1 escaneado sem leitura). Criei 2 pastas novas:
 * …". Em simulação, no condicional ("arquivaria").
 */
export function resumoDoDia(p: PainelDoArquivador): string {
  const h = p.hoje;
  const simulando = !p.config?.emProducao;
  const feitos = h.porAcao.arquivou + h.porAcao.arquivaria;
  const frases: string[] = [];
  if (!feitos && !h.porAcao.naoIdentificado && !h.porAcao.fica && !h.porAcao.jaArquivado) frases.push(simulando ? 'Hoje ainda não chegou nada para simular.' : 'Hoje ainda não chegou nada para arquivar.');
  else {
    const verbo = simulando ? (h.porAcao.arquivou ? 'arquivei ' + plural(h.porAcao.arquivou, 'arquivo', 'arquivos') + ' e, em simulação, arquivaria mais ' + mil(h.porAcao.arquivaria) : 'eu arquivaria (simulação) ' + plural(feitos, 'arquivo', 'arquivos'))
      : 'arquivei ' + plural(feitos, 'arquivo', 'arquivos');
    frases.push('Hoje ' + verbo + (h.totalDeClientes ? ' de ' + plural(h.totalDeClientes, 'cliente', 'clientes') : '') + '.');
  }
  // o que está para resolver AGORA (o que está hoje em NÃO IDENTIFICADOS), não as decisões do dia (23/10/2026: o
  // reprocessamento resolve depois, e o resumo continuava dizendo "80 ficaram para você resolver")
  const resolver = paraResolverAgora(p);
  if (resolver) {
    const porMotivo: Record<string, number> = {};
    for (const x of p.pendentes) if (x.motivo) porMotivo[x.motivo] = (porMotivo[x.motivo] || 0) + 1;
    const motivos = Object.entries(porMotivo).sort((a, b) => b[1] - a[1]);
    const partes = motivos.slice(0, 3).map(([m, n]) => mil(n) + ' ' + noResumo(m, n));
    const resto = resolver - motivos.slice(0, 3).reduce((s, [, n]) => s + n, 0);
    if (resto > 0 && partes.length) partes.push(mil(resto) + (resto === 1 ? ' por outro motivo' : ' por outros motivos'));
    frases.push(plural(resolver, 'está', 'estão') + ' para você resolver agora' + (partes.length ? ' (' + listaEmPalavras(partes) + ')' : '') + '.');
  } else frases.push('Nada para resolver.');
  if (h.porAcao.jaArquivado) frases.push(plural(h.porAcao.jaArquivado, 'já estava arquivado', 'já estavam arquivados') + ' (o mesmo conteúdo na pasta do cliente).');
  if (h.pastasNovas.length) frases.push((simulando ? 'Criaria ' : 'Criei ') + plural(h.pastasNovas.length, 'pasta nova', 'pastas novas') + ': ' + listaEmPalavras(h.pastasNovas.slice(0, 4)) + (h.pastasNovas.length > 4 ? ' e outras' : '') + '.');
  if (h.porAcao.erro) frases.push(plural(h.porAcao.erro, 'arquivo deu erro', 'arquivos deram erro') + ': veja a aba Erros.');
  return frases.join(' ');
}

/** Quantos estão para resolver agora: o que está hoje em NÃO IDENTIFICADOS (a mesma conta em todo lugar). */
export function paraResolverAgora(p: PainelDoArquivador | null | undefined): number {
  if (!p) return 0;
  return typeof p.pendentesTotal === 'number' ? p.pendentesTotal : p.pendentes.length;
}

export interface ProgressoDaPassada { feitos: number; total: number; pct: number; faltam: number; terminou: boolean; previsao: string }
/** "1.240 de 17.158" e a previsão de término pelo ritmo ("termina por volta das 15:40", "em uns 25 min"). */
export function progressoDaPassada(p: PassadaDoArquivador | null, ritmo: number, agora = Date.now()): ProgressoDaPassada | null {
  if (!p || !p.total) return null;
  const feitos = Math.min(p.feitos, p.total);
  const faltam = Math.max(0, p.total - feitos);
  const terminou = !!p.fim || faltam === 0;
  let previsao: string;
  if (terminou) previsao = 'Passada concluída' + (p.fim ? ' às ' + new Date(p.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  else if (ritmo > 0) {
    const min = Math.ceil(faltam / ritmo);
    const fim = new Date(agora + min * 60000);
    const hora = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const mesmoDia = new Date(agora).toDateString() === fim.toDateString();
    previsao = min < 60 ? 'Termina em uns ' + min + ' min' : 'Termina por volta ' + (mesmoDia ? 'das ' + hora : 'de ' + fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + hora);
  } else previsao = 'Sem ritmo ainda para prever o fim';
  return { feitos, total: p.total, pct: Math.max(terminou ? 100 : 1, Math.min(100, Math.floor((feitos / p.total) * 100))), faltam, terminou, previsao };
}

export type TomDoArquivador = 'ok' | 'aviso' | 'erro' | 'neutro';
/** A situação do arquivador agora: trabalhando, em dia, esperando, Drive fora, sem sinal. */
export function situacaoDoArquivador(p: PainelDoArquivador | null, agora = Date.now()): { tom: TomDoArquivador; titulo: string; texto: string } {
  if (!p) return { tom: 'neutro', titulo: 'Sem sinal', texto: 'O robô do PC ainda não publicou o acompanhamento do arquivador novo.' };
  const idade = agora - (Date.parse(p.em) || 0);
  const pasta = p.pasta;
  const trabalhando = !!pasta && (pasta.sendoLidos > 0 || pasta.naFila > 0);
  // o robô só publica quando algo muda: parado há muito tempo com fila = ele parou
  if (idade > 15 * 60000 && trabalhando) return { tom: 'erro', titulo: 'Parado', texto: 'Tinha arquivo na fila e o robô não dá sinal há ' + Math.round(idade / 60000) + ' min. Confira se o PC do robô está ligado.' };
  if (p.config?.modo === 'desligado') return { tom: 'aviso', titulo: 'Desligado', texto: 'O arquivador novo está desligado no config.' };
  if (p.situacao === 'sem-drive') return { tom: 'erro', titulo: 'Drive fora do ar', texto: 'Esperando o Google Drive (G:) voltar.' };
  if (p.situacao === 'esperando') return { tom: 'aviso', titulo: 'Esperando', texto: p.esperando || 'Esperando outra execução terminar.' };
  if (trabalhando) return { tom: 'ok', titulo: 'Trabalhando', texto: mil(pasta!.sendoLidos + pasta!.naFila) + ' na fila agora.' };
  return { tom: 'ok', titulo: 'Em dia', texto: 'Nada esperando na pasta: cada arquivo novo é arquivado assim que termina de chegar.' };
}

export interface FiltroDoArquivador { busca?: string; cliente?: string; tipo?: string; acao?: AcaoDoArquivador | '' }
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Filtra os itens pela busca (nome, cliente, destino, motivo), pelo cliente, pelo grupo de tipo e pela ação. */
export function filtrarItens(itens: readonly ItemDoArquivador[], f: FiltroDoArquivador): ItemDoArquivador[] {
  const b = semAcento((f.busca || '').trim());
  return itens.filter(x => (!f.cliente || x.cliente === f.cliente)
    && (!f.tipo || grupoDoTipo(x.tipo).id === f.tipo)
    && (!f.acao || x.acao === f.acao)
    && (!b || semAcento([x.nome, x.cliente, x.clienteNome, x.destino, x.tipo, x.motivoTexto, x.rel].join(' ')).includes(b)));
}

/** Os rótulos de cada ação (o selo da lista). */
export const ROTULO_DA_ACAO: Record<AcaoDoArquivador, string> = {
  arquivou: 'Arquivado', arquivaria: 'Arquivaria (simulação)', jaArquivado: 'Já estava arquivado', naoIdentificado: 'Não identificado', fica: 'Ficou na pasta', erro: 'Erro',
};

// ---------------------------------------------------------------------------------------------------------------------
// os pedidos ao robô (Para resolver: abrir o arquivo, a prévia, arquivar em…, descartar; 23/10/2026)
// ---------------------------------------------------------------------------------------------------------------------
export type TipoDoPedido = 'abrir' | 'previa' | 'arquivar' | 'descartar';
export type SituacaoDoPedido = 'pendente' | 'trabalhando' | 'pronto' | 'feito' | 'erro';
export interface RespostaDoPedido {
  acao: string; destino: string; nomeFinal: string; situacao: string; pastaNova: string; copias: string[]; motivo: string; evidencias: string[];
  cliente: string; clienteNome: string; tipo: string;
}
export interface PedidoDoArquivador {
  id: string; tipo: TipoDoPedido; status: SituacaoDoPedido; erro: string;
  resposta: RespostaDoPedido | null;
  /** abrir: o arquivo em partes (pedidosArquivador/{id}/partes/{n}, base64) */
  arquivo: { nome: string; mime: string; tamanho: number; partes: number } | null;
}
const TIPOS_DE_PEDIDO: readonly TipoDoPedido[] = ['abrir', 'previa', 'arquivar', 'descartar'];
const SITUACOES: readonly SituacaoDoPedido[] = ['pendente', 'trabalhando', 'pronto', 'feito', 'erro'];

/** Um pedido como veio do banco (o robô responde no próprio documento). */
export function lerPedidoDoArquivador(id: string, d: Obj | null | undefined): PedidoDoArquivador | null {
  if (!d) return null;
  const r = d.resposta ? obj(d.resposta) : null;
  const a = d.arquivo ? obj(d.arquivo) : null;
  return {
    id, tipo: TIPOS_DE_PEDIDO.includes(d.tipo as TipoDoPedido) ? d.tipo as TipoDoPedido : 'abrir',
    status: SITUACOES.includes(d.status as SituacaoDoPedido) ? d.status as SituacaoDoPedido : 'pendente', erro: txt(d.erro),
    resposta: r ? {
      acao: txt(r.acao), destino: txt(r.destino), nomeFinal: txt(r.nomeFinal), situacao: txt(r.situacao), pastaNova: txt(r.pastaNova), copias: textos(r.copias),
      motivo: txt(r.motivo), evidencias: textos(r.evidencias), cliente: txt(r.cliente), clienteNome: txt(r.clienteNome), tipo: txt(r.tipo),
    } : null,
    arquivo: a ? { nome: txt(a.nome), mime: txt(a.mime) || 'application/octet-stream', tamanho: num(a.tamanho), partes: num(a.partes) } : null,
  };
}

/** Os clientes e os tipos do formulário "Arquivar em…" (robo/arquivadorNovoCadastro). */
export interface ClienteDoFormulario { codigo: number; nome: string; temPasta: boolean }
export interface TipoDoFormulario { id: string; rotulo: string; precisa: 'mes' | 'ano' | null }
export interface CadastroDoFormulario { carregado: boolean; em: string; clientes: ClienteDoFormulario[]; tipos: TipoDoFormulario[] }
export function lerCadastroDoFormulario(d: Obj | null | undefined): CadastroDoFormulario {
  const x = obj(d);
  return {
    carregado: true, em: txt(x.em),
    clientes: lista(x.clientes).map(c => ({ codigo: num(c.c), nome: txt(c.n), temPasta: !!c.p })).filter(c => c.codigo > 0),
    tipos: lista(x.tipos).map(t => ({ id: txt(t.id), rotulo: txt(t.rotulo), precisa: (t.precisa === 'mes' || t.precisa === 'ano' ? t.precisa : null) as TipoDoFormulario['precisa'] })).filter(t => /^[A-Z_]{2,30}$/.test(t.id)),
  };
}

/** A busca do cliente no formulário: pelo código (começo) ou pelo nome (sem acento), até `max`. */
export function buscarClientesDoFormulario(clientes: readonly ClienteDoFormulario[], texto: string, max = 8): ClienteDoFormulario[] {
  const t = semAcento(texto.trim());
  if (!t) return [];
  const soNum = /^\d+$/.test(t);
  const achados = clientes.filter(c => (soNum ? String(c.codigo).startsWith(t) : semAcento(c.codigo + ' ' + c.nome).includes(t)));
  return achados.sort((a, b) => (soNum ? Number(String(b.codigo) === t) - Number(String(a.codigo) === t) || a.codigo - b.codigo : a.codigo - b.codigo)).slice(0, max);
}

/** O caminho do arquivo na pasta Claudio Secretario, que vai no pedido (o não identificado: em NÃO IDENTIFICADOS). */
export const caminhoDoArquivo = (x: ItemDoArquivador) => x.naPasta || x.rel;
