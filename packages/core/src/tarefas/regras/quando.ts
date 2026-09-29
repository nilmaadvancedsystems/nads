// Quando foi, no jeito do GitHub ("há 5 horas", "ontem", "há 3 dias"): a última vez que mexeram numa
// empresa, na lista de Minhas empresas. Mais de 30 dias vira a data (dd/mm/aaaa).

/** A última data (ISO) entre as etapas da execução, ou null se ninguém mexeu. */
export function ultimaVez(execucao: { etapas: Record<string, { em: string }> } | null): string | null {
  const datas = execucao ? Object.values(execucao.etapas).map(e => e.em) : [];
  return datas.length ? datas.reduce((x, y) => (y > x ? y : x)) : null;
}

export function quandoFoi(iso: string, agora: Date): string {
  const d = new Date(iso);
  const min = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  const horas = Math.floor(min / 60);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 86400000);
  if (dias === 0) return 'há ' + horas + (horas === 1 ? ' hora' : ' horas');
  if (dias === 1) return 'ontem';
  if (dias <= 30) return 'há ' + dias + ' dias';
  return d.toLocaleDateString('pt-BR');
}
