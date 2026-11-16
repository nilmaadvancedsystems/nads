// O resumo embaixo do título das Solicitações (16/11/2026: o dono apresentou a Área do Cliente e ouviu "muita
// informação"). No máximo dois fatos: o que espera o cliente (as respondidas) e o que está com o escritório (as
// abertas). O total saiu: já está na aba "Todas" da lista, logo embaixo.

/** A linha embaixo do título: "1 respondida esperando você · 1 em andamento"; sem nada pendente, "Nada pendente". */
export function resumoDasSolicitacoes(c: { total: number; respondidas: number; abertas: number }): string {
  if (!c.total) return '';
  const fatos = [
    c.respondidas ? c.respondidas + (c.respondidas === 1 ? ' respondida esperando você' : ' respondidas esperando você') : '',
    c.abertas ? c.abertas + ' em andamento' : '',
  ].filter(Boolean);
  return fatos.length ? fatos.join(' · ') : 'Nada pendente';
}
