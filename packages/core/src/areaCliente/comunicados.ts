// Os comunicados do escritório aos clientes (plano do Acessórias, ficha 3.1 comunicados; o dono, 22/11/2026: "pode fazer
// tudo"). O admin e os diretores publicam um aviso (recesso, mudança de lei, prazo) para todos os clientes, para um regime
// ou para empresas escolhidas, com o período em que vale. O robô do PC espelha em areasCliente/{token}/resumo/comunicados
// só os que valem para as empresas do link; o cliente vê no sino. Vai num sentido só (não é chat: a resposta segue pelo
// WhatsApp ou numa solicitação). Só a lógica.

export type AlvoDoComunicado = { todos: true } | { regimes: string[] } | { codigos: number[] };

export interface Comunicado {
  id: string;
  titulo: string;
  texto: string;
  alvo: AlvoDoComunicado;
  /** 'aaaa-mm-dd': a partir de quando aparece */
  publicarEm: string;
  /** 'aaaa-mm-dd': até quando aparece (inclusive) */
  ate: string;
  /** quem publicou (o nome) */
  por: string;
  /** ISO */
  atualizadoEm: string;
}

/** O que o cliente vê (lista branca: sem alvo, sem quem publicou). */
export interface ComunicadoNaArea { id: string; titulo: string; texto: string; ate: string }

export const MAIOR_TITULO_DO_COMUNICADO = 80;
export const MAIOR_TEXTO_DO_COMUNICADO = 600;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O erro do comunicado ('' = serve). */
export function erroDoComunicado(c: Pick<Comunicado, 'titulo' | 'texto' | 'alvo' | 'publicarEm' | 'ate'>): string {
  if (!c.titulo.trim()) return 'Escreva o título.';
  if (c.titulo.trim().length > MAIOR_TITULO_DO_COMUNICADO) return 'O título pode ter até ' + MAIOR_TITULO_DO_COMUNICADO + ' caracteres.';
  if (!c.texto.trim()) return 'Escreva o texto do comunicado.';
  if (c.texto.trim().length > MAIOR_TEXTO_DO_COMUNICADO) return 'O texto pode ter até ' + MAIOR_TEXTO_DO_COMUNICADO + ' caracteres.';
  if (!DIA.test(c.publicarEm) || !DIA.test(c.ate)) return 'Escolha as datas de início e de fim.';
  if (c.ate < c.publicarEm) return 'A data de fim é antes da de início.';
  if ('regimes' in c.alvo && !c.alvo.regimes.length) return 'Escolha pelo menos um regime.';
  if ('codigos' in c.alvo && !c.alvo.codigos.length) return 'Escolha pelo menos uma empresa.';
  return '';
}

/** O comunicado vale para a empresa (pelo código e pelo regime)? */
export function comunicadoValeParaEmpresa(alvo: AlvoDoComunicado, empresa: { codigo: number; regime?: string }): boolean {
  if ('todos' in alvo) return alvo.todos === true;
  if ('regimes' in alvo) return !!empresa.regime && alvo.regimes.includes(empresa.regime);
  return alvo.codigos.includes(empresa.codigo);
}

/** Os comunicados que o link mostra hoje: os que valem para alguma empresa dele, dentro do período; o mais novo primeiro. */
export function comunicadosDoLink(lista: readonly Comunicado[], empresas: readonly { codigo: number; regime?: string }[], hoje: string): ComunicadoNaArea[] {
  return lista
    .filter(c => !erroDoComunicado(c) && c.publicarEm <= hoje && hoje <= c.ate && empresas.some(e => comunicadoValeParaEmpresa(c.alvo, e)))
    .sort((a, b) => b.publicarEm.localeCompare(a.publicarEm) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
    .slice(0, 10)
    .map(c => ({ id: c.id, titulo: c.titulo.trim(), texto: c.texto.trim(), ate: c.ate }));
}

/** O comunicado lido do banco (o torto vira null). */
export function lerComunicado(id: string, x: unknown): Comunicado | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === 'string' ? v : '');
  const a = (o.alvo && typeof o.alvo === 'object' ? o.alvo : {}) as Record<string, unknown>;
  const alvo: AlvoDoComunicado | null = a.todos === true ? { todos: true }
    : Array.isArray(a.regimes) ? { regimes: a.regimes.filter((r): r is string => typeof r === 'string').slice(0, 10) }
    : Array.isArray(a.codigos) ? { codigos: a.codigos.filter((n): n is number => typeof n === 'number' && Number.isInteger(n)).slice(0, 500) }
    : null;
  if (!alvo) return null;
  const c = { id, titulo: txt(o.titulo), texto: txt(o.texto), alvo, publicarEm: txt(o.publicarEm), ate: txt(o.ate), por: txt(o.por).slice(0, 120), atualizadoEm: txt(o.atualizadoEm) };
  return erroDoComunicado(c) ? null : c;
}
