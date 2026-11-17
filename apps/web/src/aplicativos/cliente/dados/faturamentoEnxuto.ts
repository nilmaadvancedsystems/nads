// As regras curtas da tela de Faturamento (16/11/2026: o dono apresentou a Área do Cliente e ouviu "tinha muita
// informação"). Os números do mês ficam com uma frase curta cada (sem o ano que o seletor já mostra), o dia em foco do
// gráfico vai numa linha só no topo do cartão e a leitura do Banco diz só o que importa. Só a tela de Faturamento usa.

/** "Setembro de 2026" → "setembro": o ano já está no seletor do mês, logo acima (16/11/2026, "muita informação"). */
export function semAno(mesPorExtenso: string): string {
  return mesPorExtenso.replace(/\s+de\s+\d{4}$/, '').toLowerCase();
}

/**
 * O dia em foco do gráfico da venda por dia, numa frase (16/11/2026, "muita informação": antes, a data, o valor grande e
 * o selo "melhor dia do mês" ocupavam três linhas). O melhor dia: "Melhor dia: sábado, 3 de outubro"; outro dia
 * (o mouse, o toque): "Sexta, 15 de outubro".
 */
export function textoDoDia(dataPorExtenso: string, melhor: boolean): string {
  const d = dataPorExtenso.trim();
  if (!d) return '';
  return melhor ? 'Melhor dia: ' + d.charAt(0).toLowerCase() + d.slice(1) : d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * A frase embaixo das notas emitidas (16/11/2026, "muita informação": a média por nota deixou de ser um cartão à parte).
 * A média por nota ("R$ 343,73 por nota") e, só quando houver, as canceladas.
 */
export function dicaDasNotas(media: string | null, canceladas: number): string {
  const c = canceladas > 0 ? canceladas + (canceladas === 1 ? ' cancelada' : ' canceladas') : '';
  return [media ? media + ' por nota' : '', c].filter(Boolean).join(' · ');
}

/**
 * A leitura do faturado contra o banco (16/11/2026, "muita informação"): a parte do faturado que entrou, sem repetir a
 * diferença (os dois valores estão logo acima); a explicação só quando pede atenção (quando o banco acompanha o
 * faturado, a frase "acompanha o faturado" só repetia o verde).
 */
export function leituraDoBanco(r: { cobertura: string; leitura: string; tom: string }): { forte: string; resto: string } {
  const forte = r.cobertura ? r.cobertura + ' do faturado entrou no banco.' : '';
  const resto = forte && r.tom === 'bom' ? '' : r.leitura;
  return { forte, resto };
}
