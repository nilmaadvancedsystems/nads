// As abas do Início novo (só no modo desenvolvedor): ficam na barra logo abaixo do cabeçalho, como as do Financeiro e do DP
// (Vitor, 13/11/2026: "Menu superior abaixo do cabeçalho!"); a casca desenha, a tela lê qual está aberta (?aba=).

export type AbaDoInicio = 'painel' | 'tarefas' | 'documentos' | 'notificacoes';
// o Painel com a grade de quadrados (Vitor, 13/11/2026: "Troca o icone de painel tb")
export const ABAS_DO_INICIO: readonly { id: AbaDoInicio; rotulo: string; icone: 'grade' | 'checklist' | 'clipe' | 'sino' }[] = [
  { id: 'painel', rotulo: 'Painel', icone: 'grade' },
  { id: 'tarefas', rotulo: 'Minhas tarefas', icone: 'checklist' },
  { id: 'documentos', rotulo: 'Documentos', icone: 'clipe' },
  { id: 'notificacoes', rotulo: 'Notificações', icone: 'sino' },
];

/** As abas de antes (?aba=minhas, delegadas, concluidas) caem em Minhas tarefas. */
export function abaDaUrl(v: string | null): AbaDoInicio {
  if (v === 'painel' || v === 'tarefas' || v === 'documentos' || v === 'notificacoes') return v;
  return v === 'minhas' || v === 'delegadas' || v === 'concluidas' ? 'tarefas' : 'painel';
}

