// A empresa da Conferência no Firestore, sem o limite de 1 MiB por documento.
//
// O erro (Vitor, 27/10/2026, empresa 237 — posto, milhares de notas de saída): a empresa inteira (balancete, notas,
// serviços, histórico) ia num documento só, `empresas/{slug}`. Passando de 1 MiB, o Firestore recusa a gravação; o
// SDK desfaz a escrita local e a tela volta ao que estava no servidor, então as saídas recém-importadas "somem
// sozinhas" (e, depois disso, nada mais daquela empresa grava). Acontece com qualquer empresa que acumule notas.
//
// A solução: quando o documento passaria do tamanho seguro, as listas grandes de notas (saídas, entradas, serviços)
// vão para documentos de partes em `empresas/{slug}/partes/{id}`, e o documento principal fica com o marcador
// `notasEmPartes` (a versão da gravação e quantas partes/notas tem cada lista). Quem lê só aceita as partes da
// versão que o principal aponta, completas — nunca uma mistura de gravações. Empresas pequenas ficam como sempre
// foram (um documento só, que o conferencia.html antigo também lê).
//
// Funções puras: quem fala com o banco é apps/web/src/aplicativos/concilia-ai/dados/conferencia.firestore.ts.

/** O limite do Firestore para um documento. */
export const LIMITE_DOCUMENTO = 1_048_576;
/** Até aqui, o documento vai inteiro (folga para o nome do documento e para o cálculo ser estimado). */
export const TAMANHO_SEGURO = 900_000;
/** Tamanho de cada documento de parte. */
export const TAMANHO_PARTE = 700_000;

/** As listas que podem ir para as partes (as que crescem com as notas importadas). */
export const CAMPOS_EM_PARTES = ['saidas', 'entradas', 'servPrestados', 'servTomados'] as const;
export type CampoEmPartes = (typeof CAMPOS_EM_PARTES)[number];

/** O que fica no documento principal quando há partes. */
export interface MarcadorDePartes {
  versao: string;
  campos: Partial<Record<CampoEmPartes, { partes: number; qtd: number }>>;
}

/** Um documento de parte: um pedaço de uma lista. */
export interface ParteDeNotas {
  versao: string;
  campo: CampoEmPartes;
  indice: number;
  itens: unknown[];
}

const bytesDoTexto = (s: string) => new TextEncoder().encode(s).length;

/**
 * Tamanho de um valor do jeito que o Firestore conta (texto: bytes + 1; número: 8; booleano e nulo: 1; lista: a soma;
 * mapa: nome de cada campo em bytes + 1, mais o valor, mais 32 do próprio documento quando é o de cima).
 */
export function tamanhoNoFirestore(v: unknown): number {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'string') return bytesDoTexto(v) + 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'boolean') return 1;
  if (Array.isArray(v)) { let t = 0; for (const x of v) t += tamanhoNoFirestore(x); return t; }
  if (typeof v === 'object') {
    let t = 0;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x !== undefined) t += bytesDoTexto(k) + 1 + tamanhoNoFirestore(x);
    return t;
  }
  return 8;
}

/** Documento inteiro: o mapa + o nome do documento + os 32 bytes do Firestore. */
export function tamanhoDoDocumento(dados: Record<string, unknown>, id: string): number {
  return tamanhoNoFirestore(dados) + bytesDoTexto('empresas/' + id) + 1 + 32;
}

export const idDaParte = (p: { versao: string; campo: string; indice: number }) => p.versao + '-' + p.campo + '-' + p.indice;

/**
 * Prepara a gravação: cabe no tamanho seguro → o documento inteiro, sem partes. Não cabe → tira as listas de notas,
 * da maior para a menor, até o principal caber, e corta cada uma em partes de até TAMANHO_PARTE.
 * `versao` identifica esta gravação (as partes de gravações anteriores ficam para apagar depois).
 */
export function dividirParaGravar(dados: Record<string, unknown>, id: string, versao: string): { principal: Record<string, unknown>; partes: ParteDeNotas[] } {
  const semMarcador = { ...dados };
  delete semMarcador.notasEmPartes;
  if (tamanhoDoDocumento(semMarcador, id) <= TAMANHO_SEGURO) return { principal: semMarcador, partes: [] };

  const principal = { ...semMarcador };
  const marcador: MarcadorDePartes = { versao, campos: {} };
  const partes: ParteDeNotas[] = [];
  const porTamanho = CAMPOS_EM_PARTES
    .filter(c => Array.isArray(principal[c]) && (principal[c] as unknown[]).length)
    .sort((a, b) => tamanhoNoFirestore(principal[b]) - tamanhoNoFirestore(principal[a]));
  for (const campo of porTamanho) {
    if (tamanhoDoDocumento({ ...principal, notasEmPartes: marcador }, id) <= TAMANHO_SEGURO) break;
    const lista = principal[campo] as unknown[];
    let atual: unknown[] = [], tam = 0, indice = 0;
    for (const item of lista) {
      const t = tamanhoNoFirestore(item);
      if (atual.length && tam + t > TAMANHO_PARTE) { partes.push({ versao, campo, indice: indice++, itens: atual }); atual = []; tam = 0; }
      atual.push(item); tam += t;
    }
    if (atual.length) partes.push({ versao, campo, indice: indice++, itens: atual });
    marcador.campos[campo] = { partes: indice, qtd: lista.length };
    principal[campo] = [];
  }
  principal.notasEmPartes = marcador;
  if (tamanhoDoDocumento(principal, id) > LIMITE_DOCUMENTO) {
    throw new Error('A empresa passa do limite do banco mesmo sem as notas (balancete e cadastro muito grandes).');
  }
  return { principal, partes };
}

/** O marcador do documento principal (null = empresa num documento só). */
export function marcadorDe(dados: Record<string, unknown> | null | undefined): MarcadorDePartes | null {
  const m = dados && (dados.notasEmPartes as MarcadorDePartes | undefined);
  return m && typeof m.versao === 'string' && m.campos && typeof m.campos === 'object' ? m : null;
}

/**
 * Junta o principal com as partes da versão dele. Devolve null quando falta parte ou a contagem não fecha
 * (a gravação ainda está chegando): quem lê espera, em vez de mostrar a empresa sem notas.
 */
export function juntarPartes(principal: Record<string, unknown>, partes: readonly ParteDeNotas[]): Record<string, unknown> | null {
  const m = marcadorDe(principal);
  const inteiro = { ...principal };
  delete inteiro.notasEmPartes;
  if (!m) return inteiro;
  for (const [campo, info] of Object.entries(m.campos) as [CampoEmPartes, { partes: number; qtd: number }][]) {
    const minhas = partes.filter(p => p.versao === m.versao && p.campo === campo).sort((a, b) => a.indice - b.indice);
    if (minhas.length !== info.partes || minhas.some((p, i) => p.indice !== i)) return null;
    const itens = minhas.flatMap(p => p.itens);
    if (itens.length !== info.qtd) return null;
    inteiro[campo] = itens;
  }
  return inteiro;
}

/**
 * Versão de uma gravação: ordena pelo tempo (9 dígitos em base 36) e não repete (sufixo aleatório).
 * É o que permite apagar só as partes MAIS VELHAS — duas abas gravando juntas nunca apagam a parte nova da outra.
 */
export function novaVersao(agora: number, aleatorio: string): string {
  return agora.toString(36).padStart(9, '0') + aleatorio.replace(/[^a-z0-9]/gi, '').slice(0, 6);
}

/**
 * As partes para apagar depois de gravar a versão `gravada`: as de versão mais velha que ela (sobras de gravações
 * anteriores). A da própria `gravada` fica; as mais novas (de outra aba) também.
 */
export function partesVelhas(gravada: string, noBanco: readonly { id: string; versao?: string }[]): string[] {
  return noBanco.filter(p => typeof p.versao !== 'string' || p.versao < gravada).map(p => p.id);
}

/** Assinatura de uma lista (para não regravar as partes quando as notas não mudaram). */
export function assinaturaDaLista(lista: unknown): string {
  const t = JSON.stringify(lista ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return t.length.toString(36) + '.' + h.toString(36);
}
