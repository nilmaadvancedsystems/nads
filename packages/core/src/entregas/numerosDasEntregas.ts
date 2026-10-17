// Os números do Painel do Entregas no nads (16/10/2026, a cópia fiel): o ranking da equipe na competência (e a meta por
// pessoa, config/metas), as entregas confirmadas por dia, o mapa (as entregas com o lugar) e os clientes sem entrega
// confirmada nas últimas 3 competências. Puro: sai do que o Painel já tem carregado.
import { clientesDeEntrega, dataHoraDaEntrega, quandoFoi, textoDosItens, type ClienteDaRota, type Entrega } from './documentos';

/** As entregas confirmadas na competência por pessoa, a que mais fez primeiro. */
export function rankingDaEquipe(doMes: readonly Pick<Entrega, 'status' | 'entregadoPorNome' | 'entregadoPor'>[]): { nome: string; total: number }[] {
  const m = new Map<string, number>();
  for (const e of doMes) {
    if (e.status !== 'confirmada') continue;
    const k = e.entregadoPorNome || e.entregadoPor || 'desconhecido';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}
/** A meta da equipe (a por pessoa vezes quantas pessoas): quanto foi, quanto falta. */
export function metaDaEquipe(ranking: readonly { total: number }[], porPessoa: number) {
  const total = ranking.reduce((s, i) => s + i.total, 0);
  const alvo = porPessoa * ranking.length;
  const pct = alvo ? Math.min(100, Math.round((total / alvo) * 100)) : 0;
  const faltam = Math.max(0, alvo - total);
  return { total, alvo, pct, faltam, texto: 'Meta: ' + porPessoa + ' por pessoa · ' + total + ' de ' + alvo + ' (' + pct + '%)' + (faltam ? ' · faltam ' + faltam : ' · meta da equipe batida') };
}
/** A barra de cada pessoa contra a meta. */
export const pctDaMeta = (total: number, porPessoa: number) => (porPessoa > 0 ? Math.min(100, Math.round((total / porPessoa) * 100)) : 0);

/** As entregas confirmadas por dia da competência ('AAAA-MM-DD' → quantas), os dias em ordem. */
export function entregasPorDia(doMes: readonly Pick<Entrega, 'status' | 'confirmadoEm' | 'criadoEm'>[]): { dia: string; total: number }[] {
  const m = new Map<string, number>();
  for (const e of doMes) {
    if (e.status !== 'confirmada') continue;
    const dia = String(e.confirmadoEm || e.criadoEm || '').slice(0, 10);
    if (dia) m.set(dia, (m.get(dia) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dia, total]) => ({ dia, total }));
}

/** As entregas com o lugar da confirmação (o mapa do Painel): verde a entregue, vermelho a não entregue. */
export function pontosDoMapa(doMes: readonly Entrega[]) {
  return doMes.filter(e => (e.status === 'confirmada' || e.status === 'falha') && e.geo)
    .map(e => ({
      id: e.id, lat: (e.geo as { lat: number }).lat, lng: (e.geo as { lng: number }).lng, falha: e.status === 'falha', nome: e.clienteNome,
      texto: e.status === 'falha' ? e.motivoFalha || 'Não entregue' : textoDosItens(e.itens), quando: dataHoraDaEntrega(quandoFoi(e)),
    }));
}

/** Os clientes do Entregas sem entrega confirmada nas últimas 3 competências (os ids com entrega vêm do banco). */
export function clientesSemEntrega(clientes: readonly ClienteDaRota[], pendentes: readonly Pick<Entrega, 'clienteId'>[], comEntrega: ReadonlySet<string>): ClienteDaRota[] {
  return clientesDeEntrega(clientes, pendentes).filter(c => !comEntrega.has(c.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
/** Os ids dos clientes com entrega confirmada nestas entregas. */
export const idsComEntregaConfirmada = (l: readonly Pick<Entrega, 'status' | 'clienteId'>[]) =>
  [...new Set(l.filter(e => e.status === 'confirmada' && e.clienteId).map(e => e.clienteId as string))];
