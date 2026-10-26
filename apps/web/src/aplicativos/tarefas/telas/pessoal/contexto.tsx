// A Minha página é uma janela flutuante (Vitor, 02/10/2026: "queria algo no estilo do Notion, com uma tela
// flutuante"): abre por cima de qualquer tela da Tarefas, pelo avatar do cabeçalho, num tópico. Este contexto guarda
// qual tópico está aberto (null = fechada) e desenha a janela.
import { createContext, Suspense, useContext, useMemo, useState, type ReactNode } from 'react';
import { pedaco } from '../../../../comum/pedaco';

// a janela (com os ícones de perfil, 120 KB) é um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando abre
const JanelaPessoal = pedaco(() => import('./JanelaPessoal'), 'JanelaPessoal');

export type TopicoPessoal = 'caixa' | 'notas' | 'conta' | 'empresas' | 'preferencias' | 'aplicativo' | 'ia' | 'faq' | 'feedbacks';

interface Pessoal { topico: TopicoPessoal | null; abrir: (t: string) => void; fechar: () => void }

const Ctx = createContext<Pessoal | null>(null);
const TOPICOS: readonly string[] = ['conta', 'aplicativo'];

export function PessoalProvider({ children }: { children: ReactNode }) {
  const [topico, setTopico] = useState<TopicoPessoal | null>(null);
  const valor = useMemo<Pessoal>(() => ({
    topico,
    abrir: (t: string) => setTopico((TOPICOS.includes(t) ? t : 'conta') as TopicoPessoal),
    fechar: () => setTopico(null),
  }), [topico]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      {topico && <Suspense fallback={null}><JanelaPessoal topico={topico} mudar={setTopico} fechar={valor.fechar} /></Suspense>}
    </Ctx.Provider>
  );
}

/** Abrir a Minha página num tópico (fora do provedor, não faz nada). */
export function usePessoal(): Pessoal {
  return useContext(Ctx) || { topico: null, abrir: () => {}, fechar: () => {} };
}
