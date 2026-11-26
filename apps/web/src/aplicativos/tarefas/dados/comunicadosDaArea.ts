// A seção Comunicados da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito para
// suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais bonito
// e de facil entendimento possivel"): a situação de cada comunicado (agendado, no ar, encerrado), os filtros com a contagem,
// o "Para quem" em palavras, os regimes tirados das empresas e o seletor de empresas. Funções puras, testadas em
// comunicadosDaArea.test.ts.
import { areaCliente as ac } from '@nads/core';

export type SituacaoDoComunicado = 'agendado' | 'no ar' | 'encerrado';
export type FiltroDosComunicados = 'no-ar' | 'agendados' | 'encerrados' | 'todos';
export type TipoDoAlvo = 'todos' | 'regimes' | 'codigos';

/** A empresa como o seletor enxerga (a EmpresaDoEscritorio do repositório). */
export interface EmpresaParaAlvo { codigo: number | null; nome: string; regime: string }

/** 'aaaa-mm-dd' no fuso do computador */
export const diaDe = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** '2026-12-01' → '01/12/2026' */
export const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

/** Antes do início é agendado; depois do fim, encerrado; no meio (inclusive), no ar. */
export function situacaoDoComunicado(c: Pick<ac.Comunicado, 'publicarEm' | 'ate'>, hoje: string): SituacaoDoComunicado {
  return hoje < c.publicarEm ? 'agendado' : hoje > c.ate ? 'encerrado' : 'no ar';
}

const DO_FILTRO: Record<Exclude<FiltroDosComunicados, 'todos'>, SituacaoDoComunicado> = { 'no-ar': 'no ar', agendados: 'agendado', encerrados: 'encerrado' };

/** Os filtros na ordem da barra, com a contagem. */
export function filtrosDosComunicados(lista: readonly ac.Comunicado[], hoje: string): { valor: FiltroDosComunicados; rotulo: string; conta: number }[] {
  const conta = (s: SituacaoDoComunicado) => lista.filter(c => situacaoDoComunicado(c, hoje) === s).length;
  return [
    { valor: 'no-ar', rotulo: 'No ar', conta: conta('no ar') },
    { valor: 'agendados', rotulo: 'Agendados', conta: conta('agendado') },
    { valor: 'encerrados', rotulo: 'Encerrados', conta: conta('encerrado') },
    { valor: 'todos', rotulo: 'Todos', conta: lista.length },
  ];
}

/** O filtro que abre: No ar quando há algum; senão, Todos. */
export const filtroInicial = (lista: readonly ac.Comunicado[], hoje: string): FiltroDosComunicados =>
  lista.some(c => situacaoDoComunicado(c, hoje) === 'no ar') ? 'no-ar' : 'todos';

const ORDEM: Record<SituacaoDoComunicado, number> = { 'no ar': 0, agendado: 1, encerrado: 2 };

/**
 * A lista do filtro: no ar e encerrados, o mais novo primeiro; agendados, o próximo a entrar primeiro; em Todos, no ar,
 * depois agendados, depois encerrados.
 */
export function comunicadosDoFiltro(lista: readonly ac.Comunicado[], filtro: FiltroDosComunicados, hoje: string): ac.Comunicado[] {
  const sit = (c: ac.Comunicado) => situacaoDoComunicado(c, hoje);
  return lista
    .filter(c => filtro === 'todos' || sit(c) === DO_FILTRO[filtro])
    .slice()
    .sort((a, b) => ORDEM[sit(a)] - ORDEM[sit(b)]
      || (sit(a) === 'agendado' ? a.publicarEm.localeCompare(b.publicarEm) : sit(a) === 'encerrado' ? b.ate.localeCompare(a.ate) : b.publicarEm.localeCompare(a.publicarEm))
      || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** "01/12/2026 – 02/01/2027" (o mesmo dia: só uma data) */
export function periodoDoComunicado(publicarEm: string, ate: string): string {
  if (!publicarEm && !ate) return '';
  return publicarEm === ate ? dataBr(publicarEm) : dataBr(publicarEm) + ' – ' + dataBr(ate);
}

/** O "Para quem" curto da lista: "Todos os clientes", "Simples, MEI", o nome da empresa ou "3 empresas". */
export function rotuloDoAlvo(alvo: ac.AlvoDoComunicado, nomeDe?: (codigo: number) => string | undefined): string {
  if ('todos' in alvo) return 'Todos os clientes';
  if ('regimes' in alvo) return alvo.regimes.length ? alvo.regimes.join(', ') : 'Nenhum regime';
  if (!alvo.codigos.length) return 'Nenhuma empresa';
  if (alvo.codigos.length === 1) return nomeDe?.(alvo.codigos[0]) || 'Empresa ' + alvo.codigos[0];
  return alvo.codigos.length + ' empresas';
}

/** O tipo do alvo (o botão marcado no formulário). */
export const tipoDoAlvo = (alvo: ac.AlvoDoComunicado): TipoDoAlvo => ('todos' in alvo ? 'todos' : 'regimes' in alvo ? 'regimes' : 'codigos');

/** Os regimes que existem nas empresas (sem repetir, em ordem), mais os já marcados que não estão mais em empresa nenhuma. */
export function regimesDasEmpresas(empresas: readonly EmpresaParaAlvo[], marcados: readonly string[] = []): string[] {
  const todos = new Set<string>();
  for (const e of empresas) { const r = e.regime?.trim(); if (r) todos.add(r); }
  for (const r of marcados) if (r.trim()) todos.add(r.trim());
  return [...todos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Quantas empresas (com código) o comunicado alcança. */
export function empresasAlcancadas(alvo: ac.AlvoDoComunicado, empresas: readonly EmpresaParaAlvo[]): number {
  if ('codigos' in alvo) return new Set(alvo.codigos).size;
  return empresas.filter(e => e.codigo != null && ac.comunicadoValeParaEmpresa(alvo, { codigo: e.codigo, regime: e.regime })).length;
}

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O seletor de empresas: as que batem com a busca (nome ou código), sem as já escolhidas, até `limite`. */
export function empresasParaEscolher(empresas: readonly EmpresaParaAlvo[], busca: string, escolhidas: readonly number[], limite = 8): { codigo: number; nome: string; regime: string }[] {
  const q = simples(busca.trim());
  if (!q) return [];
  const ja = new Set(escolhidas);
  const palavras = q.split(/\s+/);
  const saida: { codigo: number; nome: string; regime: string }[] = [];
  for (const e of empresas) {
    if (e.codigo == null || ja.has(e.codigo)) continue;
    const alvo = simples(e.codigo + ' ' + e.nome);
    if (palavras.every(p => alvo.includes(p))) saida.push({ codigo: e.codigo, nome: e.nome, regime: e.regime });
    if (saida.length >= limite) break;
  }
  return saida;
}

/** A busca da lista: título, texto e quem publicou. */
export function bateNaBusca(c: ac.Comunicado, busca: string): boolean {
  const q = simples(busca.trim());
  if (!q) return true;
  const alvo = simples(c.titulo + ' ' + c.texto + ' ' + c.por);
  return q.split(/\s+/).every(p => alvo.includes(p));
}
