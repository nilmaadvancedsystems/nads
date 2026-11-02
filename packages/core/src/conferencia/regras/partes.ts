// As notas em pedaços (Vitor, 27/10/2026: "as saídas da 237 não estão ficando armazenadas"). A Conferência grava a empresa
// inteira num documento do banco, e o documento vai até 1 MB: o posto 237 tem 24 mil cupons de saída (3 mil por mês) e a
// gravação falhava. Passou do limite, as listas grandes (entradas, saídas, tomados, prestados) vão em pedaços para baixo da
// empresa (empresas/{slug}/notas/{lista}-{versão}-{n}) e o documento principal guarda só onde estão. Aqui, as contas puras:
// quando dividir, como cortar e como juntar de volta.
import type { Empresa } from '../tipos';

/** As listas que podem ir em pedaços. */
export const LISTAS_GRANDES = ['entradas', 'saidas', 'servPrestados', 'servTomados'] as const;
export type ListaGrande = (typeof LISTAS_GRANDES)[number];

/** Até quanto (em caracteres do JSON) a empresa fica num documento só; o banco aceita 1 MB, com folga. */
export const LIMITE_DO_DOCUMENTO = 700_000;
/** O tamanho de cada pedaço (em caracteres do JSON). */
export const TAMANHO_DO_PEDACO = 600_000;

/** Onde estão os pedaços de cada lista (no documento principal): a versão e quantos. */
export type NotasEmPartes = Partial<Record<ListaGrande, { versao: string; partes: number; qtd: number }>>;

/** A empresa precisa dos pedaços? (o JSON passa do limite) */
export function precisaDePartes(e: Empresa): boolean {
  return JSON.stringify(e).length > LIMITE_DO_DOCUMENTO;
}

/** Corta a lista em pedaços que cabem num documento (pelo tamanho do JSON de cada item). */
export function dividirEmPartes<T>(lista: readonly T[], tamanho = TAMANHO_DO_PEDACO): T[][] {
  const partes: T[][] = [];
  let atual: T[] = [];
  let soma = 0;
  for (const item of lista) {
    const n = JSON.stringify(item).length + 1;
    if (atual.length && soma + n > tamanho) { partes.push(atual); atual = []; soma = 0; }
    atual.push(item);
    soma += n;
  }
  if (atual.length) partes.push(atual);
  return partes;
}

/** O id do pedaço n da lista na versão. */
export const idDoPedaco = (lista: ListaGrande, versao: string, n: number) => lista + '-' + versao + '-' + String(n).padStart(4, '0');

/** Junta os pedaços (os documentos de notas/, em qualquer ordem) de volta na lista, só os da versão; null = falta pedaço. */
export function juntarPartes<T>(docs: readonly { id: string; itens: T[] }[], lista: ListaGrande, info: { versao: string; partes: number }): T[] | null {
  const meus = docs.filter(d => d.id.startsWith(lista + '-' + info.versao + '-')).sort((a, b) => a.id.localeCompare(b.id));
  if (meus.length < info.partes) return null;
  return meus.slice(0, info.partes).flatMap(d => d.itens);
}
