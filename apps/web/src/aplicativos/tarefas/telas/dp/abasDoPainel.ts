// As abas do DP (Vitor, 06/10/2026: "quebre o tabelão em submenus no estilo GitHub"): o Resumo (números, gráficos e o
// progresso) e uma por parte da rotina, cada uma só com as colunas dela. Num arquivo à parte (revisão da UI, 18/10/2026)
// para a rota (AplicacaoAberta) saber as abas sem baixar o painel do DP, que é um pedaço à parte.
export type AbaDoPainel = 'resumo' | 'obrigacoes';
export const ABAS_DO_PAINEL: readonly AbaDoPainel[] = ['resumo', 'obrigacoes'];
